// End-to-end: the production client build, driven in a real browser, against
// the real board routes (in-memory table, admin session stubbed).
// Run: npm run test:e2e   (builds the client first)
// E2E_BROWSERS=chromium,firefox,webkit picks the engines (default: chromium).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import type { Server } from "node:http";
import express from "express";
import { chromium, devices, firefox, webkit, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import type { Board, BoardDocument, MindNodeData } from "#shared/schema.js";
import { createBoardsApp, installMemoryBoards, listen } from "../server/routes/__tests__/helpers/boardsHarness.js";

const DIST = path.resolve(import.meta.dirname, "../dist/public");

const ENGINES = { chromium, firefox, webkit } as const;
type EngineName = keyof typeof ENGINES;
const BROWSERS = (process.env.E2E_BROWSERS || "chromium")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean) as EngineName[];
for (const name of BROWSERS) assert.ok(name in ENGINES, `unknown browser in E2E_BROWSERS: ${name}`);

const PHONES: Record<EngineName, Parameters<Browser["newContext"]>[0]> = {
  chromium: devices["Pixel 7"],
  webkit: devices["iPhone 13"],
  firefox: { viewport: { width: 390, height: 800 } },
};

for (const browserName of BROWSERS) boardsSuite(browserName);

function boardsSuite(browserName: EngineName) {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let rows: Map<string, Board>;
  const board = () => {
    const [only] = Array.from(rows.values());
    assert.ok(only, "a board exists");
    return only;
  };

  async function screenshot(target: Page, name: string) {
    const dir = process.env.E2E_SCREENSHOTS;
    if (dir) await target.screenshot({ path: path.join(dir, `${browserName}-boards-${name}.png`) });
  }

  function startServer() {
    rows = installMemoryBoards();
    const app = createBoardsApp({ alwaysAdmin: true });
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

  const mindNodes = (target: Page = page) => target.locator('[data-testid="board-node-mind"]');
  const mindNode = (text: string, target: Page = page): Locator =>
    target.locator('[data-testid="board-node-mind"]').filter({ has: target.getByTestId("mind-node-text").getByText(text, { exact: true }) });

  async function waitForSaveStatus(expected: string, target: Page = page) {
    await target.waitForFunction(
      (text) => document.querySelector('[data-testid="board-save-status"]')?.textContent?.trim() === text,
      expected,
      { timeout: 10_000 },
    );
  }

  // Types into the node editor that the last command opened, then commits it.
  async function editorFocused(target: Page = page) {
    await target.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "mind-node-editor", null, { timeout: 5_000 });
  }

  async function typeTopic(text: string) {
    const editor = page.getByTestId("mind-node-editor");
    await editorFocused();
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await editor.waitFor({ state: "detached" });
    await mindNode(text).waitFor();
  }

  // Selects a topic from the Outline tab (which also centres it on the canvas).
  async function selectFromOutline(text: string) {
    await page.getByTestId("outline-item").getByText(text, { exact: true }).click();
    await page.waitForFunction(
      (t) =>
        Array.from(document.querySelectorAll(".react-flow__node.selected [data-testid='mind-node-text']")).some((el) => el.textContent === t),
      text,
    );
  }

  async function select(text: string) {
    await mindNode(text).getByTestId("mind-node-text").click();
    await page.waitForFunction(
      (t) =>
        Array.from(document.querySelectorAll(".react-flow__node.selected [data-testid='mind-node-text']")).some((el) => el.textContent === t),
      text,
    );
  }

  const savedMind = () => {
    const doc: BoardDocument = board().document;
    const byId = new Map(doc.nodes.map((n) => [n.id, n]));
    const textOf = (id: string) => (byId.get(id)?.data as MindNodeData | undefined)?.text;
    const parentOf = (text: string) => {
      const node = doc.nodes.find((n) => (n.data as MindNodeData).text === text);
      const edge = doc.edges.find((e) => e.kind === "tree" && e.target === node?.id);
      return edge ? textOf(edge.source) : null;
    };
    return { doc, texts: doc.nodes.map((n) => (n.data as MindNodeData).text).sort(), parentOf };
  };

  // Topics of one map never overlap (`only` narrows the check to some topics).
  async function assertNoOverlap(target: Page = page, only?: (text: string) => boolean) {
    const all = await target.$$eval('[data-testid="board-node-mind"] .mind-node-body', (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent ?? "", x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    const boxes = only ? all.filter((box) => only(box.text)) : all;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const hit = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
        assert.ok(!hit, `"${a.text}" overlaps "${b.text}"`);
      }
    }
  }

  // Lets the 180ms layout transition finish before measuring positions.
  const settle = (target: Page = page) => target.waitForTimeout(260);

  describe(`boards mind map (${browserName})`, { timeout: 180_000 }, () => {
    before(async () => {
      assert.ok(existsSync(path.join(DIST, "index.html")), "run `vite build` first (npm run test:e2e does)");
      ({ server, baseUrl } = await startServer());
      browser = await ENGINES[browserName].launch();
      context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
      page = await context.newPage();
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    it("creates a mind-map board that opens on its central topic", async () => {
      await page.goto(`${baseUrl}/admin/boards`);
      await page.getByText("No boards yet").waitFor({ timeout: 30_000 });
      await page.getByTestId("boards-new").click();
      await page.getByTestId("board-kind-option-mindmap").click();
      await page.getByTestId("board-new-title").fill("Plano de marketing");
      await page.getByTestId("board-create").click();
      await page.getByTestId("board-editor").waitFor();
      await mindNode("Plano de marketing").waitFor({ timeout: 30_000 });
      assert.equal(rows.size, 1);
      assert.equal(board().kind, "mindmap");
      assert.equal(await mindNodes().count(), 1);
      await waitForSaveStatus("All changes saved");
    });

    it("Tab adds a child and types into it; Enter adds a sibling", async () => {
      await select("Plano de marketing");
      await page.keyboard.press("Tab");
      await typeTopic("Ads");
      assert.equal(await mindNode("Ads").getAttribute("data-depth"), "1");

      await page.keyboard.press("Enter");
      await typeTopic("SEO");
      assert.equal(await mindNode("SEO").getAttribute("data-depth"), "1");

      await select("Ads");
      await page.keyboard.press("Tab");
      await typeTopic("Google");
      await page.keyboard.press("Enter");
      await typeTopic("Meta");
      assert.equal(await mindNode("Google").getAttribute("data-depth"), "2");
      assert.equal(await mindNode("Meta").getAttribute("data-depth"), "2");
      assert.equal(await mindNodes().count(), 5);

      await settle();
      await assertNoOverlap();
      // Children sit outward from their parent.
      const ads = (await mindNode("Ads").boundingBox())!;
      const google = (await mindNode("Google").boundingBox())!;
      const root = (await mindNode("Plano de marketing").boundingBox())!;
      const outward = ads.x > root.x ? 1 : -1;
      assert.ok((google.x - ads.x) * outward > 0, "grandchild is further out than its parent");
      await screenshot(page, "editor");
    });

    it("Space collapses a branch and shows how many topics it hides", async () => {
      await select("Ads");
      await page.keyboard.press("Space");
      await mindNode("Google").waitFor({ state: "detached" });
      assert.equal(await mindNode("Meta").count(), 0);
      assert.equal((await mindNode("Ads").getByTestId("mind-collapse-toggle").textContent())?.trim(), "+2");

      await page.keyboard.press("Space");
      await mindNode("Google").waitFor();
      await mindNode("Meta").waitFor();
    });

    it("Shift+Tab moves a topic up a level", async () => {
      await select("Meta");
      await page.keyboard.press("Shift+Tab");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[data-testid="board-node-mind"]')).some(
          (el) => el.textContent?.includes("Meta") && el.getAttribute("data-depth") === "1",
        ),
      );
      await settle();
      await assertNoOverlap();
    });

    it("Delete removes a branch and undo brings it back", async () => {
      await select("Ads");
      await page.keyboard.press("Delete");
      await mindNode("Google").waitFor({ state: "detached" });
      assert.equal(await mindNode("Ads").count(), 0);
      await page.keyboard.press("Control+z");
      await mindNode("Ads").waitFor();
      await mindNode("Google").waitFor();
      assert.equal(await mindNodes().count(), 5);
    });

    it("autosaves the map, and a reload shows it again", async () => {
      await waitForSaveStatus("All changes saved");
      const saved = savedMind();
      assert.deepEqual(saved.texts, ["Ads", "Google", "Meta", "Plano de marketing", "SEO"]);
      assert.equal(saved.parentOf("Ads"), "Plano de marketing");
      assert.equal(saved.parentOf("Google"), "Ads");
      assert.equal(saved.parentOf("Meta"), "Plano de marketing", "the Shift+Tab move was saved");
      assert.equal(saved.parentOf("Plano de marketing"), null);

      await page.reload();
      await page.getByTestId("board-editor").waitFor();
      await mindNode("Google").waitFor({ timeout: 30_000 });
      assert.equal(await mindNodes().count(), 5);
      await page.waitForTimeout(800);
      assert.equal((await page.getByTestId("board-save-status").textContent())?.trim(), "All changes saved", "opens clean");
    });

    it("exports the outline as Markdown and imports text as a new map", async () => {
      const download = page.waitForEvent("download");
      await page.getByTestId("board-more").click();
      await page.getByTestId("board-export-markdown").click();
      const file = await download;
      const stream = await file.createReadStream();
      let markdown = "";
      for await (const chunk of stream) markdown += chunk.toString();
      assert.equal(markdown, ["# Plano de marketing", "", "- Ads", "  - Google", "- Meta", "- SEO", ""].join("\n"));

      await page.getByTestId("board-more-menu").waitFor({ state: "detached" });
      await page.getByTestId("board-more").click();
      await page.getByTestId("board-import-text").click();
      await page.getByTestId("board-import-textarea").fill("Eventos\n  Feira\n  Webinar");
      await page.getByTestId("board-import-confirm").click();
      await page.getByTestId("board-import-dialog").waitFor({ state: "detached" });
      await mindNode("Webinar").waitFor();
      assert.equal(await mindNode("Eventos").getAttribute("data-depth"), "0");
      assert.equal(await mindNodes().count(), 8);

      // Ctrl+V of indented text onto a selected topic adds it as a branch.
      await select("SEO");
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.setData("text/plain", "- Blog\n  - Pautas\n- Local");
        const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "clipboardData", { value: data });
        document.body.dispatchEvent(event);
      });
      await mindNode("Pautas").waitFor();
      assert.equal(await mindNode("Blog").getAttribute("data-depth"), "2");
      assert.equal(await mindNodes().count(), 11);
    });

    async function dragBy(locator: Locator, dx: number, dy: number) {
      const box = (await locator.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx / 2, box.y + box.height / 2 + dy / 2, { steps: 6 });
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
      await page.mouse.up();
    }

    it("dragging a root moves its map; dropping a topic on another reparents it", async () => {
      await page.getByTestId("board-zoom-fit").click();
      await page.waitForTimeout(400);
      const before = (await mindNode("Feira").boundingBox())!;
      const rootBefore = (await mindNode("Eventos").boundingBox())!;
      await dragBy(mindNode("Eventos").locator(".mind-node-body"), 0, 160);
      await settle();
      const after = (await mindNode("Feira").boundingBox())!;
      const rootAfter = (await mindNode("Eventos").boundingBox())!;
      const dy = rootAfter.y - rootBefore.y;
      assert.ok(dy > 100, `the root moved (${dy}px)`);
      assert.ok(Math.abs(after.y - before.y - dy) < 2 && Math.abs(after.x - before.x - (rootAfter.x - rootBefore.x)) < 2, `map followed its root: ${JSON.stringify({ before, after, dy })}`);

      // A branch dropped on empty canvas snaps back into the layout.
      const webinar = (await mindNode("Webinar").boundingBox())!;
      await dragBy(mindNode("Webinar").locator(".mind-node-body"), 0, 220);
      await settle();
      const back = (await mindNode("Webinar").boundingBox())!;
      assert.ok(Math.abs(back.y - webinar.y) < 3 && Math.abs(back.x - webinar.x) < 3, "snapped back");

      // Dropped on another topic, it becomes that topic's child.
      const feira = (await mindNode("Feira").boundingBox())!;
      await dragBy(mindNode("Webinar").locator(".mind-node-body"), feira.x + feira.width / 2 - (back.x + back.width / 2), feira.y + feira.height / 2 - (back.y + back.height / 2));
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[data-testid="board-node-mind"]')).some(
          (el) => el.textContent?.includes("Webinar") && el.getAttribute("data-depth") === "2",
        ),
      );
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[data-testid="board-node-mind"]')).some(
          (el) => el.textContent?.includes("Webinar") && el.getAttribute("data-depth") === "1",
        ),
      );
    });

    it("builds a 100-topic map from the keyboard without overlaps", async () => {
      await select("Eventos");
      await page.getByTestId("board-panel-tab-outline").click();
      await page.getByTestId("outline-panel").waitFor();
      const started = Date.now();
      // 9 branches of 10 topics each (plus the 2 already there).
      for (let b = 0; b < 9; b++) {
        await selectFromOutline("Eventos");
        await page.keyboard.press("Tab");
        await editorFocused();
        await page.keyboard.type(`B${b}`);
        await page.keyboard.press("Enter");
        await page.keyboard.press("Tab");
        for (let i = 0; i < 10; i++) {
          await editorFocused();
          await page.keyboard.type(`B${b}.${i}`);
          await page.keyboard.press("Enter");
          if (i < 9) await page.keyboard.press("Enter");
        }
      }
      await page.getByTestId("mind-node-editor").waitFor({ state: "detached" });
      const elapsed = Date.now() - started;
      assert.equal(await mindNodes().count(), 11 + 9 * 11);
      await settle();
      await page.getByTestId("board-zoom-fit").click();
      await page.waitForTimeout(400);
      // (Separate maps may grow into each other; one map never overlaps itself.)
      await assertNoOverlap(page, (text) => /^(B\d|Eventos|Feira|Webinar)/.test(text));
      assert.ok(elapsed < 60_000, `took ${elapsed}ms`);
      console.log(`# 99 topics typed in ${elapsed}ms`);
      await screenshot(page, "editor-100");
      await waitForSaveStatus("All changes saved");
      await page.getByTestId("board-panel-tab-style").click();
    });

    it("shares by link; on a phone the public page shows the map and folding works", async () => {
      await page.getByTestId("board-share").click();
      await page.getByTestId("board-visibility-switch").click();
      await page.waitForFunction(() => document.querySelector('[data-testid="board-visibility-switch"]')?.getAttribute("data-state") === "checked");
      for (let i = 0; i < 50 && board().visibility !== "link"; i++) await page.waitForTimeout(100);
      assert.equal(board().visibility, "link");
      await page.keyboard.press("Escape");

      const phoneContext = await browser.newContext(PHONES[browserName]);
      const phone = await phoneContext.newPage();
      try {
        await phone.goto(`${baseUrl}/b/${board().slug}`);
        await phone.getByTestId("board-viewer").waitFor({ timeout: 30_000 });
        await mindNode("Plano de marketing", phone).waitFor({ timeout: 30_000 });
        assert.equal(await mindNodes(phone).count(), 11 + 9 * 11);
        assert.equal(await phone.getByTestId("mind-add-child").count(), 0, "nothing editable");
        assert.equal(await phone.getByTestId("board-toolbar").count(), 0);

        // The viewer fits the whole board on screen.
        await phone.waitForTimeout(500);
        const viewport = phone.viewportSize()!;
        const all = await phone.$$eval('[data-testid="board-node-mind"]', (els) => els.map((el) => el.getBoundingClientRect().toJSON()));
        for (const r of all) {
          assert.ok(r.left >= -1 && r.right <= viewport.width + 1 && r.top >= -1 && r.bottom <= viewport.height + 1, `on screen: ${JSON.stringify(r)}`);
        }
        await screenshot(phone, "public-phone");

        // Folding a branch works read-only (and is not saved).
        const version = board().version;
        await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").click({ force: true });
        await mindNode("Google", phone).waitFor({ state: "detached" });
        assert.equal((await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").textContent())?.trim(), "+1");
        await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").click({ force: true });
        await mindNode("Google", phone).waitFor();
        assert.equal(board().version, version, "the viewer never saves");
      } finally {
        await phoneContext.close();
      }
    });
  });
}
