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

for (const browserName of BROWSERS) {
  boardsSuite(browserName);
  canvasSuite(browserName);
}

async function startBoardsServer() {
  const rows = installMemoryBoards();
  const app = createBoardsApp({ alwaysAdmin: true });
  app.get("/api/admin/session", (_req, res) => {
    res.json({ isAdmin: true, email: "admin@skale.club", firstName: "Admin", lastName: "" });
  });
  app.get("/api/supabase-config", (_req, res) => res.json({}));
  app.get("/api/company-settings", (_req, res) => res.json({ companyName: "Skale Club", sectionsOrder: [] }));
  app.all("/api/*", (req, res) => (req.method === "GET" ? res.json([]) : res.json({})));
  app.use(express.static(DIST, { index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
  return { rows, ...(await listen(app)) };
}

async function waitForSaved(target: Page) {
  await target.waitForFunction(
    () => document.querySelector('[data-testid="board-save-status"]')?.textContent?.trim() === "All changes saved",
    null,
    { timeout: 10_000 },
  );
}

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

  async function startServer() {
    const started = await startBoardsServer();
    rows = started.rows;
    return started;
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

// The free canvas: sticky notes, shapes, frames, connectors, duplicate/undo,
// pen strokes and templates, then the public page on a phone.
function canvasSuite(browserName: EngineName) {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let page: Page;
  let rows: Map<string, Board>;
  const board = () => {
    const [only] = Array.from(rows.values());
    assert.ok(only, "a board exists");
    return only;
  };
  const nodesOf = (type: string) => board().document.nodes.filter((n) => n.data.type === type);
  const byTestId = (id: string, target: Page = page) => target.locator(`[data-testid="${id}"]`);

  async function screenshot(target: Page, name: string) {
    const dir = process.env.E2E_SCREENSHOTS;
    if (dir) await target.screenshot({ path: path.join(dir, `${browserName}-canvas-${name}.png`) });
  }

  async function drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps });
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  }

  async function center(locator: Locator) {
    const box = (await locator.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  }

  describe(`boards free canvas (${browserName})`, { timeout: 150_000 }, () => {
    before(async () => {
      ({ server, baseUrl, rows } = await startBoardsServer());
      browser = await ENGINES[browserName].launch();
      const context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
      page = await context.newPage();
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    it("creates a blank canvas board; Escape cancels a new empty mind-map topic", async () => {
      await page.goto(`${baseUrl}/admin/boards`);
      await page.getByText("No boards yet").waitFor({ timeout: 30_000 });
      await page.getByTestId("boards-new").click();
      await page.getByTestId("board-kind-option-canvas").click();
      await page.getByTestId("board-template-blank").waitFor();
      await page.getByTestId("board-new-title").fill("Workshop");
      await page.getByTestId("board-create").click();
      await page.getByTestId("board-editor").waitFor();
      await page.getByTestId("board-canvas").waitFor({ timeout: 30_000 });
      assert.equal(board().kind, "canvas");
      assert.equal(board().document.nodes.length, 0);

      await page.keyboard.press("m");
      await page.mouse.click(700, 650);
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "mind-node-editor");
      await page.keyboard.press("Escape");
      await byTestId("board-node-mind").waitFor({ state: "detached" });
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(150);
      assert.equal(await byTestId("board-node-mind").count(), 0, "undo does not bring the cancelled topic back");
    });

    it("places a sticky note and types into it", async () => {
      await page.getByTestId("board-tool-sticky").click();
      await page.mouse.click(300, 250);
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "sticky-editor");
      await page.keyboard.type("Hello sticky");
      await page.keyboard.press("Enter");
      await byTestId("sticky-editor").waitFor({ state: "detached" });
      assert.equal((await byTestId("sticky-text").textContent())?.trim(), "Hello sticky");
      assert.equal(await page.getByTestId("board-tool-select").getAttribute("data-active"), "true", "back to Select");
    });

    it("draws a shape by dragging", async () => {
      await page.keyboard.press("s");
      await drag({ x: 700, y: 160 }, { x: 880, y: 260 });
      await byTestId("board-node-shape").waitFor();
      const { box } = await center(byTestId("board-node-shape"));
      assert.ok(Math.abs(box.width - 180) <= 2 && Math.abs(box.height - 100) <= 2, `drawn size ${box.width}x${box.height}`);
    });

    it("draws a frame; a sticky dropped in it becomes a child and moves with the frame", async () => {
      await page.getByTestId("board-tool-frame").click();
      await drag({ x: 150, y: 420 }, { x: 600, y: 760 });
      await byTestId("board-node-frame").waitFor();
      await page.mouse.click(1000, 780); // deselect

      const sticky = byTestId("board-node-sticky");
      const start = await center(sticky);
      await drag(start, { x: 330, y: 560 });
      await waitForSaved(page);
      const [frame] = nodesOf("frame");
      const [note] = nodesOf("sticky");
      assert.equal(note.parentId, frame.id, "the sticky joined the frame");

      const before = (await sticky.boundingBox())!;
      const title = (await byTestId("frame-title").boundingBox())!;
      await drag({ x: title.x + 12, y: title.y + title.height / 2 }, { x: title.x + 132, y: title.y + title.height / 2 });
      const after = (await sticky.boundingBox())!;
      assert.ok(Math.abs(after.x - before.x - 120) <= 8 && Math.abs(after.y - before.y) <= 8, `sticky moved with the frame: ${before.x} -> ${after.x}`);
      await waitForSaved(page);
      assert.equal(nodesOf("sticky")[0].parentId, frame.id, "still inside after the frame moved");
    });

    it("connects two shapes with the connector tool and labels the connector", async () => {
      await page.getByTestId("board-tool-shape").click();
      await drag({ x: 850, y: 450 }, { x: 1030, y: 550 });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-shape"]').length === 2);
      const [first, second] = await Promise.all([center(byTestId("board-node-shape").nth(0)), center(byTestId("board-node-shape").nth(1))]);

      await page.keyboard.press("c");
      await page.mouse.click(first.x, first.y);
      await page.mouse.click(second.x, second.y);
      await page.locator(".react-flow__edge-connector").waitFor();

      // Bottom of the first shape to the top of the second: the curve's middle.
      const mid = { x: (first.x + second.x) / 2, y: (first.box.y + first.box.height + second.box.y) / 2 };
      await page.mouse.dblclick(mid.x, mid.y);
      await byTestId("edge-label-editor").waitFor();
      await page.keyboard.type("depends on");
      await page.keyboard.press("Enter");
      await page.getByTestId("edge-label").getByText("depends on").waitFor();
      await waitForSaved(page);
      const [edge] = board().document.edges;
      assert.equal(edge.kind, "connector");
      assert.equal(edge.data?.label, "depends on");
      await screenshot(page, "editor");
    });

    it("Ctrl+D duplicates the selection and undo removes the copy", async () => {
      const second = await center(byTestId("board-node-shape").nth(1));
      await page.mouse.click(second.x, second.y);
      await page.keyboard.press("Control+d");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-shape"]').length === 3);
      const copy = (await byTestId("board-node-shape").nth(2).boundingBox())!;
      assert.ok(Math.abs(copy.x - second.box.x - 24) <= 1 && Math.abs(copy.y - second.box.y - 24) <= 1, `offset by 24px: ${JSON.stringify({ copy, orig: second.box, shapes: await page.$$eval('[data-testid="board-node-shape"]', (els) => els.map((e) => e.getBoundingClientRect().toJSON())) })}`);
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-shape"]').length === 2);
    });

    it("a pen stroke is saved and is there after a reload", async () => {
      await page.keyboard.press("p");
      await byTestId("board-pen-overlay").waitFor();
      await page.mouse.move(750, 640);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(750 + i * 11, 640 + Math.sin(i / 2) * 25);
      await page.mouse.up();
      await byTestId("board-stroke").waitFor();
      await page.keyboard.press("Escape");
      await waitForSaved(page);
      assert.equal(board().document.strokes.length, 1);
      assert.ok(board().document.strokes[0].points.length >= 9);

      await page.reload();
      await page.getByTestId("board-editor").waitFor();
      await byTestId("board-stroke").waitFor({ timeout: 30_000 });
      assert.equal(await byTestId("board-stroke").count(), 1);
      assert.equal(await byTestId("board-node-shape").count(), 2);
    });

    it("the SWOT template inserts four titled frames", async () => {
      await page.getByTestId("board-tool-templates").click();
      await page.getByTestId("board-template-picker").waitFor();
      await page.getByTestId("board-template-swot").click();
      await page.getByTestId("board-template-picker").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 5);
      await waitForSaved(page);
      const titles = nodesOf("frame").map((n) => (n.data as { title?: string }).title);
      for (const t of ["Strengths", "Weaknesses", "Opportunities", "Threats"]) assert.ok(titles.includes(t), `${t} frame`);
    });

    it("the public page renders the canvas on a phone", async () => {
      await page.getByTestId("board-share").click();
      await page.getByTestId("board-visibility-switch").click();
      for (let i = 0; i < 50 && board().visibility !== "link"; i++) await page.waitForTimeout(100);
      assert.equal(board().visibility, "link");
      await page.keyboard.press("Escape");

      const phoneContext = await browser.newContext(PHONES[browserName]);
      const phone = await phoneContext.newPage();
      try {
        await phone.goto(`${baseUrl}/b/${board().slug}`);
        await phone.getByTestId("board-viewer").waitFor({ timeout: 30_000 });
        await byTestId("board-node-sticky", phone).waitFor({ timeout: 30_000 });
        assert.equal(await byTestId("board-node-frame", phone).count(), 5);
        assert.equal(await byTestId("board-node-shape", phone).count(), 2);
        assert.equal(await byTestId("board-stroke", phone).count(), 1);
        await phone.getByTestId("edge-label").getByText("depends on").waitFor();
        await phone.getByTestId("frame-title").getByText("Opportunities").waitFor();
        assert.equal((await byTestId("sticky-text", phone).textContent())?.trim(), "Hello sticky");
        assert.equal(await phone.getByTestId("board-toolbar").count(), 0);
        await screenshot(phone, "public-phone");
      } finally {
        await phoneContext.close();
      }
    });

    it("on a phone the editor has a bottom toolbar, a style sheet, and touch drags move nodes", async () => {
      await page.close();
      const phoneContext = await browser.newContext({ ...PHONES[browserName], hasTouch: true });
      const phone = await phoneContext.newPage();
      try {
        await phone.goto(`${baseUrl}/admin/boards/${board().id}`);
        await byTestId("board-node-shape", phone).first().waitFor({ timeout: 30_000 });
        await phone.waitForFunction(() => document.querySelector('[data-testid="board-toolbar"]')?.getAttribute("data-orientation") === "horizontal");
        const bar = (await phone.getByTestId("board-toolbar").boundingBox())!;
        assert.ok(bar.y + bar.height > phone.viewportSize()!.height - 40, "toolbar at the bottom");
        await phone.getByTestId("board-style-sheet-open").click();
        await phone.getByTestId("board-style-sheet").waitFor();
        await phone.keyboard.press("Escape");
        await phone.getByTestId("board-style-sheet").waitFor({ state: "detached" });
        await screenshot(phone, "editor-phone");
        if (browserName !== "chromium") return; // touch moves are driven through CDP

        await phone.getByTestId("board-zoom-fit").click();
        await phone.waitForTimeout(400);
        const shape = byTestId("board-node-shape", phone).first();
        const before = (await shape.boundingBox())!;
        const cdp = await phoneContext.newCDPSession(phone);
        const x = before.x + before.width / 2;
        const y = before.y + before.height / 2;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 8, y: y + i * 5 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        const after = (await shape.boundingBox())!;
        assert.ok(after.x - before.x > 30 && after.y - before.y > 15, `touch drag moved the shape: ${JSON.stringify({ before, after })}`);
      } finally {
        await phoneContext.close();
      }
    });
  });
}
