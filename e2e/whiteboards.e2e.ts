// End-to-end: the production client build, driven in real browsers, against
// the real whiteboard routes (in-memory table, admin session stubbed).
// Run: npm run test:e2e   (builds the client first)
// E2E_BROWSERS=chromium,firefox,webkit picks the engines (default: chromium);
// webkit is Safari's engine, and its phone run emulates an iPhone.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import type { Server } from "node:http";
import express from "express";
import sharp from "sharp";
import { chromium, devices, firefox, webkit, type Browser, type BrowserContext, type Page } from "playwright";
import type { Whiteboard } from "#shared/schema.js";
import {
  createWhiteboardsApp,
  installMemoryWhiteboards,
  listen,
} from "../server/routes/__tests__/helpers/whiteboardsHarness.js";

const DIST = path.resolve(import.meta.dirname, "../dist/public");

const ENGINES = { chromium, firefox, webkit } as const;
type EngineName = keyof typeof ENGINES;
const BROWSERS = (process.env.E2E_BROWSERS || "chromium")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean) as EngineName[];
for (const name of BROWSERS) assert.ok(name in ENGINES, `unknown browser in E2E_BROWSERS: ${name}`);

// A phone for the public page: an iPhone on Safari's engine, a Pixel on
// Chromium's. Firefox has no mobile emulation, so it gets a phone-sized window.
const PHONES: Record<EngineName, Parameters<Browser["newContext"]>[0]> = {
  chromium: devices["Pixel 7"],
  webkit: devices["iPhone 13"],
  firefox: { viewport: { width: 390, height: 800 } },
};

for (const browserName of BROWSERS) whiteboardSuite(browserName);

function whiteboardSuite(browserName: EngineName) {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let rows: Map<string, Whiteboard>;
  let board: () => Whiteboard;
  const fontRequests: { url: string; status: number }[] = [];

  // E2E_SCREENSHOTS=<dir> keeps a screenshot of the key screens (for PR notes).
  async function screenshot(target: Page, name: string) {
    const dir = process.env.E2E_SCREENSHOTS;
    if (dir) await target.screenshot({ path: path.join(dir, `${browserName}-${name}.png`) });
  }

  // When set, the next whiteboard save waits on the server until released.
  let saveHold: { gate: Promise<void>; landed: () => void } | null = null;

  function startServer() {
    rows = installMemoryWhiteboards();
    board = () => {
      const [only] = Array.from(rows.values());
      assert.ok(only, "a whiteboard exists");
      return only;
    };
    const app = createWhiteboardsApp({
      alwaysAdmin: true,
      beforeRoutes: (app) =>
        app.use((req, res, next) => {
          if (!saveHold || req.method !== "PUT" || !/^\/api\/whiteboards\/[^/]+$/.test(req.path)) return next();
          const hold = saveHold;
          saveHold = null;
          res.on("finish", hold.landed);
          void hold.gate.then(() => next());
        }),
    });
    // Everything else the admin shell and public pages ask for.
    app.get("/api/admin/session", (_req, res) => {
      res.json({ isAdmin: true, email: "admin@skale.club", firstName: "Admin", lastName: "" });
    });
    app.get("/api/supabase-config", (_req, res) => res.json({}));
    app.get("/api/company-settings", (_req, res) => res.json({ companyName: "Skale Club", sectionsOrder: [] }));
    app.all("/api/*", (req, res) => (req.method === "GET" ? res.json([]) : res.json({})));
    app.use(express.static(DIST, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
    return listen(app);
  }

  // Bounding box of drawn (dark) pixels on the static canvas, as a fraction of it.
  async function inkBox(target: Page) {
    return target.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas.excalidraw__canvas.static");
      if (!canvas) return null;
      const { width, height } = canvas;
      const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] > 0 && data[i] < 160 && data[i + 1] < 160 && data[i + 2] < 160) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return { empty: true, left: 0, top: 0, right: 0, bottom: 0 };
      return { empty: false, left: minX / width, top: minY / height, right: maxX / width, bottom: maxY / height };
    });
  }

  async function saveStatus(target: Page = page) {
    return (await target.getByTestId("whiteboard-save-status").textContent())?.trim();
  }

  async function waitForSaveStatus(expected: string, target: Page = page) {
    await target.waitForFunction(
      (text) => document.querySelector('[data-testid="whiteboard-save-status"]')?.textContent?.trim() === text,
      expected,
      { timeout: 10_000 },
    );
  }

  async function canvasBox(target: Page = page) {
    const box = await target.locator("canvas.excalidraw__canvas.interactive").boundingBox();
    assert.ok(box);
    return box;
  }

  // Clicks a toolbar tool the way a user does (its radio input sits under the icon).
  async function pickTool(tool: string, target: Page = page) {
    await target.locator("label", { has: target.getByTestId(`toolbar-${tool}`) }).click();
  }

  // Picks the tool from the toolbar (keyboard shortcuts need the canvas focused).
  async function drag(
    tool: "rectangle" | "diamond" | "ellipse" | "arrow",
    from: [number, number],
    to: [number, number],
    target: Page = page,
  ) {
    const box = await canvasBox(target);
    await pickTool(tool, target);
    await target.mouse.move(box.x + from[0], box.y + from[1]);
    await target.mouse.down();
    await target.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
    await target.mouse.up();
  }

  async function openEditorReady(target: Page = page) {
    await target.getByTestId("whiteboard-editor").waitFor();
    await target.locator("canvas.excalidraw__canvas.interactive").waitFor({ timeout: 30_000 });
    // Let Excalidraw settle (restore, font load) before judging dirtiness.
    await target.waitForTimeout(1200);
  }

  function countByType(type: string) {
    return board().scene.elements.filter((element) => element.type === type).length;
  }

  // Clearly red pixels (the pasted test image) in what the page shows on
  // screen. Read from a screenshot, not the canvas: in dark theme the canvas
  // holds pre-inverted colours that a CSS filter turns back.
  async function redPixelsOnScreen(target: Page) {
    const { data, info } = await sharp(await target.screenshot()).raw().toBuffer({ resolveWithObject: true });
    let red = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > data[i + 1] + 60 && data[i] > data[i + 2] + 60) red++;
    }
    return red;
  }

  describe(`whiteboards (${browserName})`, { timeout: 300_000 }, () => {
    before(async () => {
      assert.ok(existsSync(path.join(DIST, "index.html")), "run `vite build` first (npm run test:e2e does)");
      ({ server, baseUrl } = await startServer());
      browser = await ENGINES[browserName].launch();
      context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
      context.on("requestfinished", async (request) => {
        if (!request.url().endsWith(".woff2")) return;
        const response = await request.response();
        fontRequests.push({ url: request.url(), status: response?.status() ?? 0 });
      });
      page = await context.newPage();
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    it("starts with an empty list and creates a board from the dialog", async () => {
      await page.goto(`${baseUrl}/admin/whiteboards`);
      await page.getByText("No whiteboards yet").waitFor({ timeout: 30_000 });
      await page.getByTestId("whiteboards-new").click();
      await page.getByTestId("whiteboard-new-title").fill("Como funciona o Google Ads");
      await page.getByTestId("whiteboard-create").click();
      await openEditorReady();

      assert.equal(rows.size, 1);
      assert.match(page.url(), new RegExp(`/admin/whiteboards/${board().id}$`));
      assert.equal(await page.getByTestId("whiteboard-title-input").inputValue(), "Como funciona o Google Ads");
      assert.equal(await saveStatus(), "All changes saved");
      assert.equal(await page.getByTestId("whiteboard-save").isDisabled(), true);
    });

    it("drawing marks the board unsaved and Ctrl+S stores the scene and a thumbnail", async () => {
      await drag("rectangle", [300, 200], [600, 380]);
      await drag("ellipse", [700, 200], [950, 400]);
      await drag("arrow", [610, 290], [690, 300]);
      const box = await canvasBox();
      await pickTool("text");
      await page.mouse.click(box.x + 330, box.y + 120);
      await page.keyboard.type("Leilao do Google Ads");
      await page.keyboard.press("Escape");
      await waitForSaveStatus("Unsaved changes");

      await page.keyboard.press("Control+s");
      await waitForSaveStatus("All changes saved");

      const saved = board();
      assert.deepEqual(
        saved.scene.elements.map((element) => element.type).sort(),
        ["arrow", "ellipse", "rectangle", "text"],
      );
      assert.equal(saved.scene.elements.find((element) => element.type === "text")?.text, "Leilao do Google Ads");
      assert.match(saved.thumbnailUrl ?? "", /^data:image\/(webp|png);base64,/);
    });

    it("the thumbnail is a 16:9 picture of the drawing", async () => {
      const thumbnail = board().thumbnailUrl!;
      const stats = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] < 160) ink++;
        return { width: image.naturalWidth, height: image.naturalHeight, inkRatio: ink / (data.length / 4) };
      }, thumbnail);
      assert.equal(stats.width, 640);
      assert.equal(stats.height, 360);
      assert.ok(stats.inkRatio > 0.005, `thumbnail shows the drawing (ink ${stats.inkRatio})`);
      assert.ok(stats.inkRatio < 0.5, `thumbnail is not a solid block (ink ${stats.inkRatio})`);
    });

    // Holds the next save on the server (a slow network, in any browser) until
    // the returned release() lets it through; resolves once its response is sent.
    async function holdNextSave() {
      let open: () => void = () => {};
      let landed: () => void = () => {};
      const gate = new Promise<void>((resolve) => (open = resolve));
      const done = new Promise<void>((resolve) => (landed = resolve));
      saveHold = { gate, landed };
      return async () => {
        open();
        await done;
      };
    }

    it("strokes drawn while a save is in flight stay unsaved", async () => {
      const release = await holdNextSave();
      await drag("rectangle", [300, 500], [450, 600]);
      await page.getByTestId("whiteboard-save").click();
      await waitForSaveStatus("Saving…");
      // Drawn after the snapshot was taken.
      await drag("diamond", [1000, 500], [1150, 600]);
      await release();
      await waitForSaveStatus("Unsaved changes");
      assert.equal(board().scene.elements.length, 5, "the in-flight save holds the 5 elements it snapshotted");

      await page.keyboard.press("Control+s");
      await waitForSaveStatus("All changes saved");
      assert.equal(board().scene.elements.length, 6);
    });

    it("a title typed while a save is in flight is kept and stays unsaved", async () => {
      await page.getByTestId("whiteboard-title-input").fill("Google Ads: lances");
      const release = await holdNextSave();
      await page.getByTestId("whiteboard-save").click();
      await waitForSaveStatus("Saving…");
      await page.getByTestId("whiteboard-title-input").fill("Google Ads: leilao");
      await release();
      await waitForSaveStatus("Unsaved changes");
      assert.equal(board().title, "Google Ads: lances");
      assert.equal(await page.getByTestId("whiteboard-title-input").inputValue(), "Google Ads: leilao");

      await page.keyboard.press("Control+s");
      await waitForSaveStatus("All changes saved");
      assert.equal(board().title, "Google Ads: leilao");
      assert.equal(board().scene.elements.length, 6);
      await screenshot(page, "editor");
    });

    it("leaving with unsaved changes asks first", async () => {
      await drag("rectangle", [1000, 650], [1100, 720]);
      await waitForSaveStatus("Unsaved changes");

      page.once("dialog", (dialog) => void dialog.dismiss());
      await page.getByTestId("whiteboard-back").click();
      assert.equal(await page.getByTestId("whiteboard-editor").isVisible(), true, "dismiss keeps the editor open");

      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByTestId("whiteboard-back").click();
      await page.getByTestId("whiteboard-editor").waitFor({ state: "detached" });
      assert.match(page.url(), /\/admin\/whiteboards$/);
      assert.equal(board().scene.elements.length, 6, "discarded stroke never reached the server");
    });

    it("the list card shows the saved thumbnail and element count", async () => {
      const { id, thumbnailUrl } = board();
      const thumbnail = page.getByTestId(`whiteboard-thumbnail-${id}`).locator("img");
      await thumbnail.waitFor();
      assert.equal(await thumbnail.getAttribute("src"), thumbnailUrl);
      assert.equal(await thumbnail.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth), 640);
      const card = page.getByTestId(`whiteboard-card-${id}`);
      assert.match((await card.textContent()) ?? "", /Google Ads: leilao/);
      assert.match((await card.textContent()) ?? "", /6 elements/);
      await screenshot(page, "admin-list");
    });

    it("reopening a saved board loads it clean (no phantom unsaved changes)", async () => {
      await page.getByTestId(`whiteboard-edit-${board().id}`).click();
      await openEditorReady();
      await page.waitForTimeout(1500);
      assert.equal(await saveStatus(), "All changes saved");
      assert.equal((await inkBox(page))?.empty, false, "the saved drawing is on the canvas");
    });

    it("a reload on the editor URL keeps the board open", async () => {
      await page.reload();
      await openEditorReady();
      assert.equal(await page.getByTestId("whiteboard-title-input").inputValue(), "Google Ads: leilao");
      assert.equal(await saveStatus(), "All changes saved");
    });

    it("browser back on a board with nothing unsaved goes straight to the list", async () => {
      await page.evaluate(() => history.back());
      await page.getByTestId("whiteboard-editor").waitFor({ state: "detached" });
      assert.match(page.url(), /\/admin\/whiteboards$/);
      await page.getByTestId(`whiteboard-edit-${board().id}`).click();
      await openEditorReady();
    });

    it("browser back with unsaved changes asks first", async () => {
      const editorUrl = page.url();
      await drag("rectangle", [1000, 650], [1100, 720]);
      await waitForSaveStatus("Unsaved changes");

      const asked = page.waitForEvent("dialog", { timeout: 5_000 });
      await page.evaluate(() => history.back());
      await (await asked).dismiss();
      await page.waitForTimeout(300);
      assert.equal(await page.getByTestId("whiteboard-editor").isVisible(), true, "dismiss keeps the editor open");
      assert.equal(page.url(), editorUrl);
      assert.equal(await saveStatus(), "Unsaved changes", "the drawing is still there");

      page.once("dialog", (dialog) => void dialog.accept());
      await page.evaluate(() => history.back());
      await page.getByTestId("whiteboard-editor").waitFor({ state: "detached" });
      assert.match(page.url(), /\/admin\/whiteboards$/);
      assert.equal(board().scene.elements.length, 6, "discarded stroke never reached the server");

      await page.getByTestId(`whiteboard-edit-${board().id}`).click();
      await openEditorReady();
      assert.equal(await saveStatus(), "All changes saved");
    });

    it("the hand-drawn fonts are served by the site itself", () => {
      const excalifont = fontRequests.filter((request) => request.url.includes("Excalifont"));
      assert.ok(excalifont.length > 0, "Excalifont was requested");
      for (const request of excalifont) {
        assert.ok(request.url.startsWith(`${baseUrl}/excalidraw/fonts/`), request.url);
        assert.equal(request.status, 200, request.url);
      }
    });

    it("the public page shows the saved drawing read-only, with its title and noindex", async () => {
      const viewer = await context.newPage();
      try {
        await viewer.goto(`${baseUrl}/w/${board().slug}`);
        await viewer.getByTestId("whiteboard-viewer").waitFor({ timeout: 30_000 });
        await viewer.waitForTimeout(1500);
        assert.equal(await viewer.title(), "Skale Club | Google Ads: leilao");
        assert.match((await viewer.locator('meta[name="robots"]').getAttribute("content")) ?? "", /noindex/);
        assert.equal(await viewer.locator(".excalidraw.excalidraw--view-mode").count(), 1, "view mode");
        assert.equal(await viewer.locator(".App-toolbar").count(), 0, "no drawing tools");
        const box = await inkBox(viewer);
        assert.equal(box?.empty, false, "drawing visible");
        await screenshot(viewer, "public-desktop");
      } finally {
        await viewer.close();
      }
    });

    it("on a phone the public page fits the whole drawing on screen", async () => {
      const phoneContext = await browser.newContext(PHONES[browserName]);
      const phone = await phoneContext.newPage();
      try {
        await phone.goto(`${baseUrl}/w/${board().slug}`);
        await phone.getByTestId("whiteboard-viewer").waitFor({ timeout: 30_000 });
        await phone.waitForTimeout(1500);
        const box = await inkBox(phone);
        assert.ok(box && !box.empty, "drawing visible");
        assert.ok(box.left > 0.01 && box.right < 0.99, `fits horizontally: ${JSON.stringify(box)}`);
        assert.ok(box.top > 0.01 && box.bottom < 0.99, `fits vertically: ${JSON.stringify(box)}`);
        await screenshot(phone, "public-phone");
      } finally {
        await phoneContext.close();
      }
    });

    it("a dark-theme board is saved and shown dark", async () => {
      await page.keyboard.press("Alt+Shift+D");
      await waitForSaveStatus("Unsaved changes");
      await page.keyboard.press("Control+s");
      await waitForSaveStatus("All changes saved");
      assert.equal(board().scene.appState?.theme, "dark");

      const viewer = await context.newPage();
      try {
        await viewer.goto(`${baseUrl}/w/${board().slug}`);
        await viewer.getByTestId("whiteboard-viewer").waitFor({ timeout: 30_000 });
        await viewer.locator(".excalidraw.theme--dark").waitFor({ timeout: 10_000 });
      } finally {
        await viewer.close();
      }
    });

    it("a save from another tab is never overwritten silently", async () => {
      const tabB = await context.newPage();
      try {
        await tabB.goto(page.url());
        await openEditorReady(tabB);
        const rectangles = countByType("rectangle");
        const diamonds = countByType("diamond");

        // Tab A saves first.
        await drag("rectangle", [300, 650], [380, 720]);
        await page.keyboard.press("Control+s");
        await waitForSaveStatus("All changes saved");
        assert.equal(countByType("rectangle"), rectangles + 1);

        // Tab B, still on the old version, is stopped and asked.
        await drag("diamond", [500, 650], [580, 720], tabB);
        await tabB.keyboard.press("Control+s");
        await tabB.getByTestId("whiteboard-conflict").waitFor();
        assert.equal(countByType("rectangle"), rectangles + 1, "tab A's work is intact");
        assert.equal(countByType("diamond"), diamonds);
        await screenshot(tabB, "conflict");

        // Tab B keeps its own version.
        await tabB.getByTestId("whiteboard-conflict-overwrite").click();
        await waitForSaveStatus("All changes saved", tabB);
        assert.equal(countByType("diamond"), diamonds + 1);
        assert.equal(countByType("rectangle"), rectangles, "overwrite replaced tab A's version");

        // Tab A is now the stale one; it chooses to load what tab B saved.
        await drag("ellipse", [700, 650], [780, 720]);
        await page.keyboard.press("Control+s");
        await page.getByTestId("whiteboard-conflict").waitFor();
        await page.getByTestId("whiteboard-conflict-load").click();
        await waitForSaveStatus("All changes saved");
        await page.getByTestId("whiteboard-conflict").waitFor({ state: "detached" });
        const versionAfterLoad = board().version;

        // And saves normally from there.
        await drag("arrow", [300, 760], [380, 780]);
        await page.keyboard.press("Control+s");
        await waitForSaveStatus("All changes saved");
        assert.equal(board().version, versionAfterLoad + 1);
        assert.equal(countByType("diamond"), diamonds + 1, "tab B's diamond survived the reload");
        assert.equal(countByType("ellipse"), 1, "tab A's discarded ellipse never reached the server");
      } finally {
        await tabB.close();
      }
    });

    it("an image pasted into the editor is saved, shown publicly and in the thumbnail", async () => {
      const box = await canvasBox();
      await page.mouse.move(box.x + 1100, box.y + 250);
      await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, 160, 120);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
        const data = new DataTransfer();
        data.items.add(new File([blob], "red.png", { type: "image/png" }));
        const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "clipboardData", { value: data });
        document.dispatchEvent(event);
      });
      await waitForSaveStatus("Unsaved changes");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+s");
      await waitForSaveStatus("All changes saved");

      const image = board().scene.elements.find((element) => element.type === "image");
      assert.ok(image, "an image element was saved");
      const file = board().scene.files?.[image.fileId as string];
      assert.match(String(file?.dataURL ?? ""), /^data:image\//, "with its picture embedded");
      assert.ok(Object.keys(board().scene.files ?? {}).length >= 1);

      const thumbnailRed = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > data[i + 1] + 60 && data[i] > data[i + 2] + 60) red++;
        return red;
      }, board().thumbnailUrl!);
      assert.ok(thumbnailRed > 50, `thumbnail shows the image (${thumbnailRed} red pixels)`);

      const viewer = await context.newPage();
      try {
        await viewer.goto(`${baseUrl}/w/${board().slug}`);
        await viewer.getByTestId("whiteboard-viewer").waitFor({ timeout: 30_000 });
        // The image decodes after the first paint; give it a few seconds.
        let red = 0;
        for (let attempt = 0; attempt < 30 && red <= 500; attempt++) {
          red = await redPixelsOnScreen(viewer);
          if (red <= 500) await viewer.waitForTimeout(500);
        }
        assert.ok(red > 500, `public page draws the image (${red} red pixels on screen)`);
        await screenshot(viewer, "public-with-image");
      } finally {
        await viewer.close();
      }
    });

    it("an unknown public link shows the not-found screen", async () => {
      const viewer = await context.newPage();
      try {
        await viewer.goto(`${baseUrl}/w/nao-existe-123`);
        await viewer.getByText("Whiteboard not found").waitFor({ timeout: 30_000 });
      } finally {
        await viewer.close();
      }
    });

    it("deleting a board removes its card and its public page", async () => {
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByTestId("whiteboard-back").click();
      const { id, slug } = board();
      await page.getByTestId(`whiteboard-delete-${id}`).click();
      await page.getByRole("button", { name: "Delete" }).last().click();
      await page.getByText("No whiteboards yet").waitFor({ timeout: 10_000 });
      assert.equal(rows.size, 0);
      const res = await fetch(`${baseUrl}/api/whiteboards/slug/${slug}`);
      assert.equal(res.status, 404);
    });

    it("the list loads a page at a time", async () => {
      for (let i = 1; i <= 30; i++) {
        const res = await fetch(`${baseUrl}/api/whiteboards`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: `Board ${i}` }),
        });
        assert.equal(res.status, 201);
      }
      await page.reload();
      await page.getByTestId("whiteboards-load-more").waitFor({ timeout: 30_000 });
      assert.equal(await page.locator('[data-testid^="whiteboard-card-"]').count(), 24);
      await page.getByTestId("whiteboards-load-more").click();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid^="whiteboard-card-"]').length === 30);
      assert.equal(await page.getByTestId("whiteboards-load-more").count(), 0, "no more pages");

      await page.getByTestId("whiteboards-search").fill("Board 3");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid^="whiteboard-card-"]').length === 2);
      const titles = await page.locator('[data-testid^="whiteboard-card-"] p.font-semibold').allTextContents();
      assert.deepEqual(titles.sort(), ["Board 3", "Board 30"]);
    });
  });
}
