// End-to-end: the production client build, driven in a real browser, against
// the real board routes (in-memory table, admin session stubbed).
// Run: npm run test:e2e   (builds the client first)
// E2E_BROWSERS=chromium,firefox,webkit picks the engines (default: chromium).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import express from "express";
import { chromium, devices, firefox, webkit, type Browser, type BrowserContext, type Download, type Locator, type Page } from "playwright";
import type { Board, BoardDocument, MindNodeData } from "#shared/schema.js";
import { createBoardsApp, installMemoryBoards, listen } from "../server/routes/__tests__/helpers/boardsHarness.js";
import type { BoardsAiProvider, BoardsAiRequest } from "../server/routes/boardsAi.js";
import { boardContentBounds } from "#shared/boards/bounds.js";
import { effectiveZ } from "#shared/boards/canvasOps.js";

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
  finishingSuite(browserName);
  resilienceSuite(browserName);
}

async function startBoardsServer(opts: { ai?: BoardsAiProvider; beforeRoutes?: (app: express.Express) => void } = {}) {
  const rows = installMemoryBoards();
  const app = createBoardsApp({ alwaysAdmin: true, ai: opts.ai, beforeRoutes: opts.beforeRoutes });
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

// The name a download is saved under. WebKit's download path swaps spaces for
// underscores in the name the page suggested; every other character must match.
function assertDownloadName(file: Download, expected: string) {
  const name = file.suggestedFilename();
  assert.ok(name === expected || name === expected.replace(/ /g, "_"), `download named ${JSON.stringify(name)}, expected ${JSON.stringify(expected)}`);
}

// Opens the ⋯ menu and one of its submenus (a click opens it; no hover timing involved).
async function openMoreSub(target: Page, sub: "import" | "export") {
  await target.getByTestId("board-more").click();
  await target.getByTestId("board-more-menu").waitFor();
  await target.getByTestId(`board-more-${sub}`).click();
  await target.getByTestId(`board-more-${sub}-menu`).waitFor();
}

// Opens "More tools" on the rail and picks one of its tools.
async function pickMoreTool(target: Page, tool: "connector" | "image" | "frame") {
  await target.getByTestId("board-tool-more").click();
  await target.getByTestId("board-tool-more-menu").waitFor();
  await target.getByTestId(`board-tool-${tool}`).click();
  await target.getByTestId("board-tool-more-menu").waitFor({ state: "detached" });
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

    it("Tab then Escape, or clearing the title, leaves the board saved and sends nothing", async () => {
      const id = board().id;
      const puts: string[] = [];
      const onRequest = (req: { method: () => string; url: () => string }) => {
        if (req.method() === "PUT" && req.url().endsWith(`/api/boards/${id}`)) puts.push(req.url());
      };
      page.on("request", onRequest);
      try {
        const version = board().version;
        await select("Plano de marketing");
        await page.keyboard.press("Tab");
        await editorFocused();
        await page.keyboard.press("Escape");
        await page.getByTestId("mind-node-editor").waitFor({ state: "detached" });
        assert.equal(await mindNodes().count(), 1, "the empty topic was cancelled");
        // Longer than the autosave delay.
        await page.waitForTimeout(2_200);
        assert.equal((await page.getByTestId("board-save-status").textContent())?.trim(), "All changes saved");

        // A cleared title is not a change; leaving the field shows the saved one again.
        const titleInput = page.getByTestId("board-title-input");
        await titleInput.fill("");
        await page.waitForTimeout(2_200);
        assert.equal((await page.getByTestId("board-save-status").textContent())?.trim(), "All changes saved");
        await titleInput.press("Enter");
        assert.equal(await titleInput.inputValue(), "Plano de marketing");
        assert.deepEqual(puts, [], "no save for identical content");
        assert.equal(board().version, version);
        assert.equal(board().title, "Plano de marketing");
      } finally {
        page.off("request", onRequest);
      }
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

    it("the side panel is a floating card: the Outline toggle opens it, its close button puts it away", async () => {
      // Opened fresh from the reload: nothing is selected, so there is no panel.
      assert.equal(await page.getByTestId("board-style-panel").count(), 0);
      const viewport = page.viewportSize()!;
      assert.equal((await page.getByTestId("board-canvas").boundingBox())!.width, viewport.width, "the canvas has the whole width");

      await page.getByTestId("board-outline-toggle").click();
      await page.getByTestId("board-style-panel").waitFor();
      await page.getByTestId("outline-panel").waitFor();
      assert.equal(await page.getByTestId("board-panel-tab-outline").getAttribute("data-state"), "active");
      assert.equal(await page.getByTestId("board-outline-toggle").count(), 0, "the toggle gives way to the card");
      const card = (await page.getByTestId("board-style-panel").boundingBox())!;
      assert.ok(card.x + card.width <= viewport.width && card.x > viewport.width - 320, `card at the top right: ${JSON.stringify(card)}`);
      assert.equal((await page.getByTestId("board-canvas").boundingBox())!.width, viewport.width, "the card takes no layout width");

      // Picking a topic from the outline keeps the Outline tab; the Style tab is one click away.
      await selectFromOutline("Ads");
      assert.equal(await page.getByTestId("board-panel-tab-outline").getAttribute("data-state"), "active");
      await page.getByTestId("board-panel-tab-style").click();
      await page.getByTestId("mind-style-section").waitFor();
      assert.equal(await page.getByTestId("board-palette-brand").count(), 0, "board settings are not in the panel");

      await page.getByTestId("board-panel-close").click();
      await page.getByTestId("board-style-panel").waitFor({ state: "detached" });
      assert.equal(await page.locator(".react-flow__node.selected").count(), 0, "closing clears the selection");
      await page.getByTestId("board-outline-toggle").waitFor();

      // A new selection from the canvas brings the card back on the Style tab.
      await select("Meta");
      await page.getByTestId("mind-style-section").waitFor();
      assert.equal(await page.getByTestId("board-panel-tab-style").getAttribute("data-state"), "active");
      await page.getByTestId("board-panel-close").click();
      await page.getByTestId("board-style-panel").waitFor({ state: "detached" });
    });

    it("exports the outline as Markdown and imports text as a new map", async () => {
      const download = page.waitForEvent("download");
      await openMoreSub(page, "export");
      await page.getByTestId("board-export-markdown").click();
      const file = await download;
      const stream = await file.createReadStream();
      let markdown = "";
      for await (const chunk of stream) markdown += chunk.toString();
      assert.equal(markdown, ["# Plano de marketing", "", "- Ads", "  - Google", "- Meta", "- SEO", ""].join("\n"));

      await page.getByTestId("board-more-menu").waitFor({ state: "detached" });
      await openMoreSub(page, "import");
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

    it("a topic's panel: the icon sits in a popover and Details open by themselves when there is a note", async () => {
      await select("SEO");
      await page.getByTestId("mind-style-section").waitFor();
      assert.equal(await page.getByTestId("mind-details-toggle").getAttribute("aria-expanded"), "false");
      assert.equal(await page.getByTestId("mind-note-input").count(), 0, "details start closed on a plain topic");
      assert.equal(await page.getByTestId("mind-icon-option").count(), 0, "the emoji grid is not on the panel");
      assert.match((await page.getByTestId("mind-icon-button").textContent()) ?? "", /Add icon/);

      await page.getByTestId("mind-icon-button").click();
      await page.getByTestId("mind-icon-popover").waitFor();
      assert.equal(await page.getByTestId("mind-icon-clear").count(), 0, "nothing to remove yet");
      await page.getByTestId("mind-icon-option").nth(1).click();
      await page.getByTestId("mind-icon-popover").waitFor({ state: "detached" });
      assert.equal(((await page.getByTestId("mind-icon-button").textContent()) ?? "").trim(), "⭐");
      await waitForSaveStatus("All changes saved");
      const iconOf = () => (savedMind().doc.nodes.find((n) => (n.data as MindNodeData).text === "SEO")!.data as MindNodeData).icon;
      assert.equal(iconOf(), "⭐");

      await page.getByTestId("mind-icon-button").click();
      await page.getByTestId("mind-icon-clear").click();
      await page.getByTestId("mind-icon-popover").waitFor({ state: "detached" });
      assert.match((await page.getByTestId("mind-icon-button").textContent()) ?? "", /Add icon/);

      await page.getByTestId("mind-details-toggle").click();
      await page.getByTestId("mind-note-input").fill("Check the audit");
      await page.getByTestId("mind-details-toggle").click(); // blur commits the note
      assert.equal(await page.getByTestId("mind-note-input").count(), 0, "details close again");
      await waitForSaveStatus("All changes saved");
      assert.equal(iconOf(), undefined, "the icon was removed");

      // Another topic starts closed; this one opens by itself because it has a note.
      await select("Feira");
      assert.equal(await page.getByTestId("mind-details-toggle").getAttribute("aria-expanded"), "false");
      await select("SEO");
      assert.equal(await page.getByTestId("mind-details-toggle").getAttribute("aria-expanded"), "true");
      assert.equal(await page.getByTestId("mind-note-input").inputValue(), "Check the audit");
      await page.getByTestId("mind-note-input").fill("");
      await page.getByTestId("mind-details-toggle").click();
      await waitForSaveStatus("All changes saved");
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
      // Room below the maps for the drags (the import lands on the first map's branches on a wide canvas).
      await page.getByTestId("board-zoom-out").click();
      await page.waitForTimeout(400);
      const before = (await mindNode("Feira").boundingBox())!;
      const rootBefore = (await mindNode("Eventos").boundingBox())!;
      // Far enough down to clear the first map's branches (a drop lands on the smallest topic under the pointer).
      await dragBy(mindNode("Eventos").locator(".mind-node-body"), 0, 200);
      await settle();
      const after = (await mindNode("Feira").boundingBox())!;
      const rootAfter = (await mindNode("Eventos").boundingBox())!;
      const dy = rootAfter.y - rootBefore.y;
      assert.ok(dy > 100, `the root moved (${dy}px)`);
      assert.ok(Math.abs(after.y - before.y - dy) < 2 && Math.abs(after.x - before.x - (rootAfter.x - rootBefore.x)) < 2, `map followed its root: ${JSON.stringify({ before, after, dy })}`);

      // A branch dropped on empty canvas snaps back into the layout.
      const webinar = (await mindNode("Webinar").boundingBox())!;
      await dragBy(mindNode("Webinar").locator(".mind-node-body"), 0, 150);
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
      // Writes the public page sends (the editor tab may still send its card thumbnail meanwhile).
      const viewerWrites: string[] = [];
      phone.on("request", (req) => {
        if (req.method() !== "GET" && req.url().includes("/api/boards")) viewerWrites.push(`${req.method()} ${req.url()}`);
      });
      try {
        await phone.goto(`${baseUrl}/b/${board().slug}`);
        await phone.getByTestId("board-viewer").waitFor({ timeout: 30_000 });
        await mindNode("Plano de marketing", phone).waitFor({ timeout: 30_000 });
        assert.equal(await mindNodes(phone).count(), 11 + 9 * 11);
        assert.equal(await phone.getByTestId("mind-add-child").count(), 0, "nothing editable");
        assert.equal(await phone.getByTestId("board-toolbar").count(), 0);

        // The viewer fits the whole board on screen. It refits once late layout settles,
        // which on WebKit can land after a fixed delay: wait for it, then check.
        await phone
          .waitForFunction(
            () =>
              Array.from(document.querySelectorAll('[data-testid="board-node-mind"]')).every((el) => {
                const r = el.getBoundingClientRect();
                return r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
              }),
            null,
            { timeout: 10_000 },
          )
          .catch(() => undefined);
        const viewport = phone.viewportSize()!;
        const all = await phone.$$eval('[data-testid="board-node-mind"]', (els) => els.map((el) => el.getBoundingClientRect().toJSON()));
        for (const r of all) {
          assert.ok(r.left >= -1 && r.right <= viewport.width + 1 && r.top >= -1 && r.bottom <= viewport.height + 1, `on screen: ${JSON.stringify(r)}`);
        }
        await screenshot(phone, "public-phone");

        // Folding a branch works read-only (and is not saved).
        const doc = JSON.stringify(board().document);
        await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").click({ force: true });
        await mindNode("Google", phone).waitFor({ state: "detached" });
        assert.equal((await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").textContent())?.trim(), "+1");
        await mindNode("Ads", phone).getByTestId("mind-collapse-toggle").click({ force: true });
        await mindNode("Google", phone).waitFor();
        await phone.waitForTimeout(300);
        assert.deepEqual(viewerWrites, [], "the viewer never saves");
        assert.equal(JSON.stringify(board().document), doc, "the stored map is unchanged");
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

      // The create dialog fades out over the editor; until it is gone its overlay
      // takes clicks and, in WebKit (which never focuses a clicked button), its
      // title field still has focus and takes the shortcut key.
      await page.getByTestId("board-create-dialog").waitFor({ state: "detached" });
      // A blank board offers a way in near the top, out of the way of the canvas.
      await byTestId("board-empty-state").waitFor();
      const hint = (await byTestId("board-empty-state").boundingBox())!;
      assert.ok(hint.y < 200 && Math.abs(hint.x + hint.width / 2 - 720) < 40, `empty-state card at the top centre: ${JSON.stringify(hint)}`);
      assert.equal(await byTestId("board-empty-ai").count(), 0, "no AI button without a provider");
      await byTestId("board-empty-template").click();
      await byTestId("board-template-picker").waitFor();
      await page.keyboard.press("Escape");
      await byTestId("board-template-picker").waitFor({ state: "detached" });
      await byTestId("board-empty-import").click();
      await byTestId("board-import-dialog").waitFor();
      await page.keyboard.press("Escape");
      await byTestId("board-import-dialog").waitFor({ state: "detached" });

      await page.keyboard.press("m");
      await page.waitForFunction(() => document.querySelector('[data-testid="board-canvas"]')?.getAttribute("data-tool") === "mind");
      await page.mouse.click(700, 650);
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "mind-node-editor");
      await page.keyboard.press("Escape");
      await byTestId("board-node-mind").waitFor({ state: "detached" });
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(150);
      assert.equal(await byTestId("board-node-mind").count(), 0, "undo does not bring the cancelled topic back");
      await byTestId("board-empty-state").waitFor();
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
      await byTestId("board-empty-state").waitFor({ state: "detached" });
    });

    it("draws a shape by dragging", async () => {
      await page.keyboard.press("s");
      await drag({ x: 700, y: 160 }, { x: 880, y: 260 });
      await byTestId("board-node-shape").waitFor();
      const { box } = await center(byTestId("board-node-shape"));
      assert.ok(Math.abs(box.width - 180) <= 2 && Math.abs(box.height - 100) <= 2, `drawn size ${box.width}x${box.height}`);
    });

    it("the style panel floats over the canvas, only while something is selected", async () => {
      const viewport = page.viewportSize()!;
      await page.mouse.click(1000, 780); // deselect
      await byTestId("board-style-panel").waitFor({ state: "detached" });
      assert.equal((await byTestId("board-canvas").boundingBox())!.width, viewport.width);

      const shape = await center(byTestId("board-node-shape"));
      await page.mouse.click(shape.x, shape.y);
      await byTestId("board-style-panel").waitFor();
      await byTestId("board-canvas-style").waitFor();
      const card = (await byTestId("board-style-panel").boundingBox())!;
      assert.ok(card.x + card.width <= viewport.width && card.x > viewport.width - 320, `card at the top right: ${JSON.stringify(card)}`);
      assert.equal((await byTestId("board-canvas").boundingBox())!.width, viewport.width, "the card takes no layout width");

      // Arrange keeps the everyday actions; lock and the single-step z-order moved to the context menu.
      for (const id of ["board-arrange-duplicate", "board-arrange-delete", "board-arrange-front", "board-arrange-back"]) await byTestId(id).waitFor();
      for (const id of ["board-arrange-lock", "board-arrange-forward", "board-arrange-backward", "board-palette-brand", "board-snap-toggle"]) {
        assert.equal(await byTestId(id).count(), 0, `${id} is not on the panel`);
      }

      await byTestId("board-panel-close").click();
      await byTestId("board-style-panel").waitFor({ state: "detached" });
      assert.equal(await page.locator(".react-flow__node.selected").count(), 0, "closing clears the selection");
    });

    it("More tools holds the occasional tools; their single keys still work", async () => {
      for (const id of ["board-tool-select", "board-tool-mind", "board-tool-sticky", "board-tool-shape", "board-tool-text", "board-tool-pen"]) await byTestId(id).waitFor();
      for (const id of ["board-tool-templates", "board-tool-ai", "board-tool-connector", "board-tool-image", "board-tool-frame"]) {
        assert.equal(await byTestId(id).count(), 0, `${id} is not on the rail`);
      }
      await byTestId("board-tool-more").click();
      await byTestId("board-tool-more-menu").waitFor();
      for (const id of ["board-tool-connector", "board-tool-image", "board-tool-frame"]) await byTestId(id).waitFor();
      await page.keyboard.press("Escape");
      await byTestId("board-tool-more-menu").waitFor({ state: "detached" });
      assert.equal(await byTestId("board-tool-more").getAttribute("data-active"), null);

      await page.mouse.move(700, 500);
      await page.keyboard.press("c");
      await page.waitForFunction(() => document.querySelector('[data-testid="board-tool-more"]')?.getAttribute("data-tool") === "connector");
      assert.equal(await byTestId("board-tool-more").getAttribute("data-active"), "true", "More tools shows that a tool inside it is on");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector('[data-testid="board-tool-more"]')?.getAttribute("data-active") === null);
      assert.equal(await byTestId("board-tool-select").getAttribute("data-active"), "true");
    });

    it("draws a frame; a sticky dropped in it becomes a child and moves with the frame", async () => {
      await pickMoreTool(page, "frame");
      assert.equal(await page.getByTestId("board-tool-more").getAttribute("data-tool"), "frame", "More tools wears the active tool");
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
      assert.equal(await page.locator(".react-flow__node.selected").count(), 0, "connecting leaves no node drawn as selected");
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

    it("the context menu locks an item and steps it forward or backward", async () => {
      const rank = (id: string) =>
        board()
          .document.nodes.filter((n) => n.data.type !== "frame")
          .map((n, index) => ({ n, index }))
          .sort((a, b) => effectiveZ(a.n) - effectiveZ(b.n) || a.index - b.index)
          .findIndex(({ n }) => n.id === id);
      const shape = byTestId("board-node-shape").nth(1);
      const id = nodesOf("shape")[1].id;
      const menuItem = async (testId: string) => {
        await shape.click({ button: "right" });
        await byTestId("canvas-context-menu").waitFor();
        await byTestId(testId).click();
        await byTestId("canvas-context-menu").waitFor({ state: "detached" });
        await waitForSaved(page);
      };

      const before = rank(id);
      assert.ok(before > 0, "not already at the back");
      await menuItem("canvas-menu-backward");
      assert.equal(rank(id), before - 1, "sent one step backward");
      await menuItem("canvas-menu-forward");
      assert.equal(rank(id), before, "brought one step forward");

      await menuItem("canvas-menu-lock");
      assert.equal(nodesOf("shape").find((n) => n.id === id)?.locked, true);
      await shape.click({ button: "right" });
      await byTestId("canvas-context-menu").waitFor();
      assert.match((await byTestId("canvas-menu-lock").textContent()) ?? "", /Unlock/);
      await byTestId("canvas-menu-lock").click();
      await byTestId("canvas-context-menu").waitFor({ state: "detached" });
      await waitForSaved(page);
      assert.equal(nodesOf("shape").find((n) => n.id === id)?.locked, undefined, "unlocked again");
      await page.keyboard.press("Escape");
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
      await page.getByTestId("board-more").click();
      await page.getByTestId("board-more-templates").click();
      await page.getByTestId("board-template-picker").waitFor();
      await page.getByTestId("board-template-swot").click();
      await page.getByTestId("board-template-picker").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 5);
      await waitForSaved(page);
      const titles = nodesOf("frame").map((n) => (n.data as { title?: string }).title);
      for (const t of ["Strengths", "Weaknesses", "Opportunities", "Threats"]) assert.ok(titles.includes(t), `${t} frame`);
    });

    it("Board settings: branch colors, background, snap to grid and the minimap", async () => {
      const open = async () => {
        await page.getByTestId("board-more").click();
        await byTestId("board-more-settings").click();
        await byTestId("board-settings-dialog").waitFor();
      };
      const close = async () => {
        await page.keyboard.press("Escape");
        await byTestId("board-settings-dialog").waitFor({ state: "detached" });
      };
      const theme = () => board().document.theme;

      await open();
      assert.equal(await byTestId("board-snap-toggle").getAttribute("data-state"), "unchecked");
      assert.equal(await byTestId("board-minimap-toggle").getAttribute("data-state"), "unchecked", "the minimap is off by default");
      assert.equal(await page.locator(".react-flow__minimap").count(), 0);
      await byTestId("board-palette-pastel").click();
      await byTestId("board-background-grid").click();
      await byTestId("board-snap-toggle").click();
      await byTestId("board-minimap-toggle").click();
      assert.equal(await byTestId("board-palette-pastel").getAttribute("aria-pressed"), "true");
      assert.equal(await byTestId("board-background-grid").getAttribute("aria-pressed"), "true");
      assert.equal(await byTestId("board-snap-toggle").getAttribute("data-state"), "checked");
      assert.equal(await byTestId("board-minimap-toggle").getAttribute("data-state"), "checked");
      await close();
      await page.locator(".react-flow__minimap").waitFor();
      await waitForSaved(page);
      assert.equal(theme().palette, "pastel");
      assert.equal(theme().background, "grid");

      // The minimap is a per-browser preference: it is still on after a reload.
      await page.reload();
      await page.getByTestId("board-editor").waitFor();
      await page.locator(".react-flow__minimap").waitFor({ timeout: 30_000 });

      await open();
      assert.equal(await byTestId("board-minimap-toggle").getAttribute("data-state"), "checked");
      await byTestId("board-palette-brand").click();
      await byTestId("board-background-dots").click();
      await byTestId("board-minimap-toggle").click();
      await close();
      await page.locator(".react-flow__minimap").waitFor({ state: "detached" });
      await waitForSaved(page);
      assert.equal(theme().palette, "brand");
      assert.equal(theme().background, "dots");
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

    it("the style card slides the board away from an item it would cover", async () => {
      await page.mouse.click(1000, 780); // deselect
      await byTestId("board-style-panel").waitFor({ state: "detached" });
      const start = await center(byTestId("board-node-shape").first());
      const camera = await page.locator(".react-flow__viewport").getAttribute("style");
      // Dropped where the card is about to appear.
      await drag(start, { x: 1250, y: start.y });
      await byTestId("board-style-panel").waitFor();
      await page.waitForFunction(
        () => {
          const card = document.querySelector('[data-testid="board-style-panel"]')!.getBoundingClientRect();
          const item = document.querySelector(".react-flow__node.selected")!.getBoundingClientRect();
          return item.right <= card.left - 12;
        },
        null,
        { timeout: 5_000 },
      );
      assert.notEqual(await page.locator(".react-flow__viewport").getAttribute("style"), camera, "the camera panned");
      await page.keyboard.press("Control+z");
      await waitForSaved(page);
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
        await phone.getByTestId("board-tool-more").waitFor();
        assert.equal(await phone.getByTestId("board-style-sheet-open").count(), 0, "Style only shows with a selection");
        await phone.keyboard.press("Control+a");
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

// Export, present mode, JSON round trip, AI assist and the public page's controls.
function finishingSuite(browserName: EngineName) {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let page: Page;
  let rows: Map<string, Board>;
  let boardId = "";
  let slug = "";

  // The AI provider the routes talk to: off at first, then answering with `outline`.
  const ai = { enabled: false, outline: "- Podcast\n  - Guests\n  - Gear", delayMs: 0, requests: [] as BoardsAiRequest[] };
  const provider: BoardsAiProvider = {
    async isConfigured() {
      return ai.enabled;
    },
    async complete(request) {
      ai.requests.push(request);
      if (ai.delayMs) await new Promise((resolve) => setTimeout(resolve, ai.delayMs));
      return ai.outline;
    },
  };

  const byTestId = (id: string, target: Page = page) => target.locator(`[data-testid="${id}"]`);
  const frame = (id: string, title: string, x: number, y: number) => ({
    id,
    position: { x, y },
    size: { w: 400, h: 300 },
    data: { type: "frame" as const, title },
  });
  // Three frames in two rows (reading order: Alpha, Beta, Gamma), a sticky inside Alpha, and a pen stroke far to the right.
  const DOCUMENT: BoardDocument = {
    schemaVersion: 1,
    nodes: [
      frame("f-gamma", "Gamma", 0, 500),
      frame("f-alpha", "Alpha", 0, 0),
      frame("f-beta", "Beta", 600, 10),
      { id: "s1", position: { x: 40, y: 60 }, size: { w: 160, h: 160 }, parentId: "f-alpha", data: { type: "sticky", text: "Hello" } },
    ],
    edges: [],
    strokes: [{ id: "p1", points: [1600, 100, 0.5, 1700, 160, 0.5, 1800, 120, 0.5], color: "#EF4444", size: 8 }],
    theme: { palette: "brand", background: "dots" },
  };

  // Escape, then wait out the exit animation (a click during it is swallowed).
  const closeOverlays = async (target: Page = page) => {
    await target.keyboard.press("Escape");
    await target.waitForFunction(() => document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"]').length === 0, null, { timeout: 5_000 });
  };
  const openMore = async () => {
    await byTestId("board-more").click();
    await byTestId("board-more-menu").waitFor();
  };
  const pngSize = async (path: string) => {
    const bytes = await readFile(path);
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
  };
  async function download(trigger: () => Promise<void>) {
    const [file] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), trigger()]);
    return file;
  }
  async function exportViaMenu(testId: string) {
    const file = await download(async () => {
      await openMoreSub(page, "export");
      await byTestId(testId).click();
    });
    // The menu fades out after the click; keys and clicks during that are swallowed.
    await byTestId("board-more-menu").waitFor({ state: "detached" });
    return file;
  }
  const frameCenters = () =>
    page.$$eval('[data-testid="board-node-frame"]', (els) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        return { title: el.querySelector('[data-testid="frame-title"]')?.textContent?.trim() ?? "", d: Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy) };
      });
    });
  const closestFrame = async () => (await frameCenters()).sort((a, b) => a.d - b.d)[0].title;
  const counter = async (target: Page = page) => (await byTestId("present-counter", target).textContent())?.trim();
  async function waitForCounter(expected: string, target: Page = page) {
    await target.waitForFunction((text) => document.querySelector('[data-testid="present-counter"]')?.textContent?.trim() === text, expected, { timeout: 5_000 });
  }

  describe(`boards export, present, JSON and AI (${browserName})`, { timeout: 170_000 }, () => {
    before(async () => {
      ({ server, baseUrl, rows } = await startBoardsServer({ ai: provider }));
      browser = await ENGINES[browserName].launch();
      const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true });
      page = await context.newPage();
      const created = await fetch(`${baseUrl}/api/boards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Quarterly Review", kind: "canvas", document: DOCUMENT }),
      });
      assert.equal(created.status, 201);
      const row = (await created.json()) as Board;
      boardId = row.id;
      slug = row.slug;
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    async function openEditor() {
      const status = page.waitForResponse((res) => res.url().includes("/api/boards/ai/status"), { timeout: 30_000 });
      await page.goto(`${baseUrl}/admin/boards/${boardId}`);
      await byTestId("board-node-frame").first().waitFor({ timeout: 30_000 });
      await status;
      await page.waitForTimeout(200);
    }

    it("hides every AI entry while the server reports no provider", async () => {
      await openEditor();
      assert.equal(await byTestId("board-tool-ai").count(), 0);
      await openMore();
      assert.equal(await byTestId("board-more-ai-generate").count(), 0);
      assert.equal(await byTestId("board-more-ai-summarize").count(), 0);
      assert.equal(await byTestId("board-more-present").count(), 0, "Present lives in the header only");
      // Shortcuts moved from the header and the zoom bar into the menu ("?" still works).
      await byTestId("board-more-shortcuts").click();
      await byTestId("board-shortcuts-dialog").waitFor();
      await closeOverlays();
      await page.mouse.click(1000, 780);
      await page.keyboard.press("?");
      await byTestId("board-shortcuts-dialog").waitFor();
      await closeOverlays();
      for (const id of ["board-shortcuts", "board-zoom-shortcuts", "board-snap-toggle", "board-save"]) {
        assert.equal(await byTestId(id).count(), 0, `${id} is not on screen`);
      }
      assert.equal(await byTestId("board-node-frame").count(), 3);
    });

    it("exports the board as a PNG named after the title, pen strokes included", async () => {
      const file = await exportViaMenu("board-export-png");
      assertDownloadName(file, "Quarterly Review.png");
      const { w, h } = await pngSize((await file.path())!);
      // 2x the content (frames and the far-away pen stroke) plus 32px on every side.
      const bounds = boardContentBounds(DOCUMENT)!;
      assert.ok(bounds.w > 1_800, "the stroke widens the bounds");
      assert.ok(Math.abs(w - 2 * (bounds.w + 64)) <= 6, `png width ${w} vs ${2 * (bounds.w + 64)}`);
      assert.ok(Math.abs(h - 2 * (bounds.h + 64)) <= 6, `png height ${h} vs ${2 * (bounds.h + 64)}`);
    });

    it("exports the selected frame cropped to its bounds, and the whole board as SVG", async () => {
      await byTestId("frame-title").getByText("Alpha", { exact: true }).click();
      await page.waitForFunction(() => document.querySelector(".react-flow__node-frame.selected") !== null);
      const file = await exportViaMenu("board-export-png");
      assertDownloadName(file, "Quarterly Review - Alpha.png");
      const { w, h } = await pngSize((await file.path())!);
      assert.ok(Math.abs(w - 2 * (400 + 64)) <= 4 && Math.abs(h - 2 * (300 + 64)) <= 4, `frame png ${w}x${h}`);

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector(".react-flow__node-frame.selected") === null);
      const svg = await exportViaMenu("board-export-svg");
      assertDownloadName(svg, "Quarterly Review.svg");
      const text = await readFile((await svg.path())!, "utf8");
      assert.match(text, /^<svg/);
      assert.match(text, /Hello/, "node content is in the SVG");
      assert.match(text, /board-stroke|<path/, "the pen stroke is in the SVG");

      // The Share popover is only about sharing now; exports live in the ⋯ menu.
      await byTestId("board-share").click();
      await byTestId("board-share-menu").waitFor();
      assert.equal(await byTestId("board-share-export-png").count(), 0);
      await closeOverlays();
    });

    it("presents the frames in reading order; arrows, Space and the buttons step; Escape leaves", async () => {
      await byTestId("board-node-sticky").click();
      await page.locator(".react-flow__node.selected").waitFor();
      await byTestId("board-present").click();
      await byTestId("present-controls").waitFor();
      await waitForCounter("1 / 3");
      assert.equal(await byTestId("board-editor").getAttribute("data-presenting"), "true");
      await page.waitForTimeout(400);
      assert.equal(await page.locator(".react-flow__node.selected").count(), 0, "no selection chrome while presenting");
      assert.equal(await byTestId("board-toolbar").count(), 0, "the editor chrome is gone");
      await page.waitForTimeout(600);
      assert.equal(await closestFrame(), "Alpha");
      const camera1 = await page.locator(".react-flow__viewport").getAttribute("style");

      await page.keyboard.press("ArrowRight");
      await waitForCounter("2 / 3");
      await page.waitForTimeout(600);
      assert.equal(await closestFrame(), "Beta");
      assert.notEqual(await page.locator(".react-flow__viewport").getAttribute("style"), camera1, "the camera moved");

      await page.keyboard.press("Space");
      await waitForCounter("3 / 3");
      await page.waitForTimeout(600);
      assert.equal(await closestFrame(), "Gamma");
      assert.equal(await byTestId("present-next").isDisabled(), true);

      await byTestId("present-prev").click();
      await waitForCounter("2 / 3");
      await byTestId("present-surface").click({ position: { x: 300, y: 300 } });
      await waitForCounter("3 / 3");
      assert.equal(await byTestId("board-node-frame").count(), 3, "keys did not edit the board");

      await page.keyboard.press("Escape");
      await byTestId("present-controls").waitFor({ state: "detached" });
      await byTestId("board-title-input").waitFor();
      assert.equal(await byTestId("board-editor").getAttribute("data-presenting"), null);
    });

    it("round-trips the document through JSON, undoably", async () => {
      const file = await exportViaMenu("board-export-json");
      assertDownloadName(file, "Quarterly Review.json");
      const path = (await file.path())!;
      const exported = JSON.parse(await readFile(path, "utf8")) as BoardDocument;
      assert.equal(exported.nodes.length, 4);
      assert.equal(exported.strokes.length, 1);

      // Delete a frame, then import the file: the board is whole again. (Fit
      // first: leaving present mode can leave the camera off the frames.)
      await byTestId("board-zoom-fit").click();
      await page.waitForTimeout(400);
      await byTestId("frame-title").getByText("Gamma", { exact: true }).click();
      await page.keyboard.press("Delete");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 2);

      await openMoreSub(page, "import");
      await Promise.all([page.waitForEvent("filechooser").then((chooser) => chooser.setFiles(path)), byTestId("board-import-json").click()]);
      await byTestId("board-import-json-confirm").click();
      await byTestId("board-import-json-confirm-dialog").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 3);
      await waitForSaved(page);
      assert.equal(rows.get(boardId)!.document.nodes.length, 4);

      // One undo brings back the board as it was before the import.
      await page.waitForTimeout(300);
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 2);
      await page.keyboard.press("Control+y");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 3);

      // A file that is not a board is refused and changes nothing.
      await page.setInputFiles('[data-testid="board-import-json-input"]', { name: "nope.json", mimeType: "application/json", buffer: Buffer.from("{\"nodes\": 5}") });
      await page.getByText("Could not import the file").first().waitFor();
      assert.equal(await byTestId("board-node-frame").count(), 3);
    });

    it("shows the AI button once a provider is configured and inserts the generated map", async () => {
      ai.enabled = true;
      await waitForSaved(page);
      await page.reload();
      await byTestId("board-node-frame").first().waitFor({ timeout: 30_000 });
      await openMore();
      await byTestId("board-more-ai-generate").waitFor();
      assert.equal(await byTestId("board-tool-ai").count(), 0, "the rail has no AI button");

      await byTestId("board-more-ai-generate").click();
      await byTestId("board-ai-generate-dialog").waitFor();
      assert.equal(await byTestId("board-ai-generate").isDisabled(), true, "a topic is required");
      await byTestId("board-ai-topic").fill("Launching a podcast");
      await byTestId("board-ai-depth-3").click();
      await byTestId("board-ai-generate").click();
      await byTestId("board-ai-generate-dialog").waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-mind"]').length === 3);
      assert.equal(ai.requests.length, 1);
      assert.equal(ai.requests[0].user, "Topic: Launching a podcast");
      assert.match(ai.requests[0].system, /3 levels/);
      for (const text of ["Podcast", "Guests", "Gear"]) await byTestId("mind-node-text").getByText(text, { exact: true }).waitFor();

      // One undo removes the whole generated map.
      await page.waitForTimeout(300);
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-mind"]').length === 0);
      await page.keyboard.press("Control+y");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-mind"]').length === 3);
    });

    it("a blank board offers Template, Generate with AI and Paste text, each opening its dialog", async () => {
      const created = await fetch(`${baseUrl}/api/boards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Blank one", kind: "canvas" }),
      });
      const blank = (await created.json()) as Board;
      const other = await page.context().newPage();
      try {
        const status = other.waitForResponse((res) => res.url().includes("/api/boards/ai/status"), { timeout: 30_000 });
        await other.goto(`${baseUrl}/admin/boards/${blank.id}`);
        await byTestId("board-empty-state", other).waitFor({ timeout: 30_000 });
        await status;
        await byTestId("board-empty-ai", other).waitFor();

        await byTestId("board-empty-ai", other).click();
        await byTestId("board-ai-generate-dialog", other).waitFor();
        await closeOverlays(other);
        await byTestId("board-empty-import", other).click();
        await byTestId("board-import-dialog", other).waitFor();
        await closeOverlays(other);
        assert.equal(await byTestId("board-empty-state", other).count(), 1, "still blank");

        await byTestId("board-empty-template", other).click();
        await byTestId("board-template-swot", other).click();
        await byTestId("board-empty-state", other).waitFor({ state: "detached" });
        await other.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-frame"]').length === 4);
      } finally {
        await other.close();
      }
    });

    it("expands a topic with AI in one undo step, with a spinner while it thinks", async () => {
      // "Guests" is the node itself: it is dropped, so three new children arrive.
      ai.outline = "- Alpha idea\n- Beta idea\n- Gamma idea\n- Guests";
      ai.delayMs = 700;
      await byTestId("board-node-mind").filter({ has: page.getByText("Guests", { exact: true }) }).click({ button: "right" });
      await byTestId("mind-menu-ai-expand").click();
      await byTestId("mind-ai-busy").waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-mind"]').length === 6, null, { timeout: 15_000 });
      await byTestId("mind-ai-busy").waitFor({ state: "detached" });
      const request = ai.requests[ai.requests.length - 1];
      assert.match(request.user, /Node: Guests/);
      assert.match(request.user, /Podcast/);
      ai.delayMs = 0;

      await page.waitForTimeout(300);
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="board-node-mind"]').length === 3);
    });

    it("summarizes the board in a dialog with a copy button", async () => {
      ai.outline = "A podcast plan.\n- Guests\n- Gear";
      await openMore();
      await byTestId("board-more-ai-summarize").click();
      await byTestId("board-ai-summary-text").waitFor();
      assert.match((await byTestId("board-ai-summary-text").textContent()) ?? "", /A podcast plan/);
      const request = ai.requests[ai.requests.length - 1];
      assert.match(request.user, /Podcast/);
      assert.equal(await byTestId("board-ai-summary-copy").isEnabled(), true);
      await closeOverlays();
    });

    it("the public page: title, made-with link, present, share; a private board is a 404", async () => {
      await waitForSaved(page);
      await fetch(`${baseUrl}/api/boards/${boardId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility: "link" }) });

      const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const view = await desktop.newPage();
      try {
        await view.goto(`${baseUrl}/b/${slug}`);
        await byTestId("board-viewer", view).waitFor({ timeout: 30_000 });
        await byTestId("board-node-frame", view).first().waitFor({ timeout: 30_000 });
        assert.equal((await byTestId("board-viewer-title", view).textContent())?.trim(), "Quarterly Review");
        assert.equal(await byTestId("board-viewer-made-with", view).getAttribute("href"), "/");
        await byTestId("board-viewer-theme", view).waitFor();
        await byTestId("board-viewer-share", view).waitFor();
        await byTestId("board-zoom-shortcuts", view).click();
        await byTestId("board-shortcuts-dialog", view).waitFor();
        await view.keyboard.press("Escape");

        // The fit button frames the pen stroke as well as the frames.
        await view.waitForTimeout(500);
        const stroke = (await byTestId("board-stroke", view).boundingBox())!;
        assert.ok(stroke.x >= 0 && stroke.x + stroke.width <= 1280, `stroke on screen: ${JSON.stringify(stroke)}`);

        await byTestId("board-viewer-present", view).click();
        await waitForCounter("1 / 3", view);
        await view.keyboard.press("ArrowRight");
        await waitForCounter("2 / 3", view);
        await view.keyboard.press("Escape");
        await byTestId("present-controls", view).waitFor({ state: "detached" });
        await byTestId("board-viewer-present", view).waitFor();
      } finally {
        await desktop.close();
      }

      const phoneContext = await browser.newContext(PHONES[browserName]);
      const phone = await phoneContext.newPage();
      try {
        await phone.goto(`${baseUrl}/b/${slug}`);
        await byTestId("board-viewer-bar", phone).waitFor({ timeout: 30_000 });
        assert.equal(await byTestId("board-zoom-bar", phone).isVisible(), false, "the zoom bar is not shown on phones");
        const bar = (await byTestId("board-viewer-bar", phone).boundingBox())!;
        assert.ok(bar.y > phone.viewportSize()!.height / 2, "controls are in a bottom bar");
        await byTestId("board-viewer-present", phone).click();
        await waitForCounter("1 / 3", phone);
        await byTestId("present-next", phone).click();
        await waitForCounter("2 / 3", phone);
        await byTestId("present-exit", phone).click();
        await byTestId("board-viewer-bar", phone).waitFor();
      } finally {
        await phoneContext.close();
      }

      // Private again: the page is a 404 and the API agrees.
      await fetch(`${baseUrl}/api/boards/${boardId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ visibility: "private" }) });
      const missing = await page.context().newPage();
      try {
        await missing.goto(`${baseUrl}/b/${slug}`);
        await byTestId("board-not-found", missing).waitFor({ timeout: 30_000 });
        assert.equal((await fetch(`${baseUrl}/api/boards/slug/${slug}`)).status, 404);
      } finally {
        await missing.close();
      }
    });
  });
}

// Saving under stress: offline, a save from another tab (conflict dialog) and
// the local snapshot offered back after a tab dies with unsaved changes.
function resilienceSuite(browserName: EngineName) {
  let server: Server;
  let baseUrl: string;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let rows: Map<string, Board>;
  let boardId = "";

  const byTestId = (id: string, target: Page = page) => target.locator(`[data-testid="${id}"]`);
  const board = () => rows.get(boardId)!;
  const stickyTexts = (doc: BoardDocument) =>
    doc.nodes.flatMap((n) => (n.data.type === "sticky" ? [n.data.text] : [])).sort();
  // A save made by another tab or device (never dropped by blockSaves).
  const put = (body: unknown) =>
    fetch(`${baseUrl}/api/boards/${boardId}`, { method: "PUT", headers: { "content-type": "application/json", "x-test-elsewhere": "1" }, body: JSON.stringify(body) });

  async function openBoard(target: Page = page) {
    await target.goto(`${baseUrl}/admin/boards/${boardId}`);
    await byTestId("board-canvas", target).waitFor({ timeout: 30_000 });
  }
  async function addSticky(text: string, x: number, y: number, target: Page = page) {
    await byTestId("board-tool-sticky", target).click();
    await target.mouse.click(x, y);
    await target.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "sticky-editor");
    await target.keyboard.type(text);
    await target.keyboard.press("Enter");
    await byTestId("sticky-editor", target).waitFor({ state: "detached" });
  }
  async function waitForStatus(expected: string, target: Page = page) {
    await target.waitForFunction((value) => document.querySelector('[data-testid="board-save-status"]')?.getAttribute("data-status") === value, expected, { timeout: 15_000 });
  }
  const snapshotKey = () => `skale:board-snapshot:${boardId}`;
  // Saves fail like a dropped connection, so a tab can "die" with changes only in
  // its snapshot. Dropped on the server rather than with context.route(): the
  // production build's service worker claims the page, and in WebKit a request
  // the worker lets through (it ignores PUTs) never reaches Playwright's routing.
  const SAVE_PATH = /^\/api\/boards\/[0-9a-f-]{36}$/;
  let dropSaves = false;
  const dropBrowserSaves = (app: express.Express) =>
    app.use((req, _res, next) => {
      if (dropSaves && req.method === "PUT" && SAVE_PATH.test(req.path) && !req.get("x-test-elsewhere")) req.socket.destroy();
      else next();
    });
  const blockSaves = () => {
    dropSaves = true;
  };
  let rejectSaves = false;
  const rejectBrowserSaves = (app: express.Express) =>
    app.use((req, res, next) => {
      if (rejectSaves && req.method === "PUT" && SAVE_PATH.test(req.path) && !req.get("x-test-elsewhere")) res.status(400).json({ message: "rejected" });
      else next();
    });
  const unblockSaves = () => {
    dropSaves = false;
  };

  describe(`boards saving: offline, conflict, local snapshot (${browserName})`, { timeout: 150_000 }, () => {
    before(async () => {
      ({ server, baseUrl, rows } = await startBoardsServer({ beforeRoutes: (app) => (rejectBrowserSaves(app), dropBrowserSaves(app)) }));
      browser = await ENGINES[browserName].launch();
      context = await browser.newContext({ viewport: { width: 1440, height: 860 } });
      page = await context.newPage();
      const created = await fetch(`${baseUrl}/api/boards`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Offline test", kind: "canvas" }) });
      boardId = ((await created.json()) as Board).id;
    });

    after(async () => {
      await browser?.close();
      server?.close();
    });

    it("goes offline with pending changes, then saves them when the connection returns", async () => {
      await openBoard();
      await context.setOffline(true);
      await addSticky("while offline", 400, 300);
      await waitForStatus("offline");
      assert.match((await byTestId("board-save-status").textContent()) ?? "", /Offline/);
      await byTestId("board-save").waitFor(); // saving by hand is offered only when autosave cannot reach the server
      assert.deepEqual(stickyTexts(board().document), []);
      await context.setOffline(false);
      await waitForStatus("saved");
      await byTestId("board-save").waitFor({ state: "detached" });
      assert.deepEqual(stickyTexts(board().document), ["while offline"]);
    });

    it("a save from another tab opens the conflict dialog: load the saved version, or overwrite", async () => {
      // Another tab saves a different sticky.
      const base = board();
      const theirs: BoardDocument = { ...base.document, nodes: [...base.document.nodes, { id: "theirs", position: { x: 700, y: 100 }, data: { type: "sticky", text: "from another tab" } }] };
      assert.equal((await put({ document: theirs })).status, 200);

      await addSticky("mine", 400, 520);
      await byTestId("board-conflict").waitFor({ timeout: 15_000 });
      assert.equal((await byTestId("board-save-status").getAttribute("data-status")), "conflict");

      await byTestId("board-conflict-load").click();
      await byTestId("board-conflict").waitFor({ state: "detached" });
      await page.getByTestId("sticky-text").getByText("from another tab").waitFor();
      assert.equal(await page.getByTestId("sticky-text").getByText("mine", { exact: true }).count(), 0, "local edits were dropped");
      await waitForStatus("saved");

      // Again, this time keeping my version over a second remote edit.
      const second: BoardDocument = { ...board().document, nodes: [...board().document.nodes, { id: "theirs-2", position: { x: 900, y: 100 }, data: { type: "sticky", text: "second remote edit" } }] };
      assert.equal((await put({ document: second })).status, 200);
      await addSticky("kept", 400, 520);
      await byTestId("board-conflict").waitFor({ timeout: 15_000 });
      await byTestId("board-conflict-overwrite").click();
      await waitForStatus("saved");
      assert.ok(stickyTexts(board().document).includes("kept"), "my version was saved over theirs");
      assert.ok(!stickyTexts(board().document).includes("second remote edit"), "the remote edit was overwritten");
    });

    it("offers the local snapshot of a tab that died with unsaved changes: restore it, or discard it", async () => {
      blockSaves();
      await addSticky("unsaved work", 800, 520);
      await waitForStatus("offline");
      // The snapshot is written (throttled to 1s) while changes are pending.
      await page.waitForFunction((key) => !!window.localStorage.getItem(key)?.includes("unsaved work"), snapshotKey(), { timeout: 5_000 });
      assert.ok(!stickyTexts(board().document).includes("unsaved work"));
      await page.close(); // the tab dies; its localStorage stays
      unblockSaves();

      page = await context.newPage();
      await openBoard();
      await byTestId("board-restore").waitFor();
      await byTestId("board-restore-confirm").click();
      await page.getByTestId("sticky-text").getByText("unsaved work").waitFor();
      await waitForStatus("saved");
      assert.ok(stickyTexts(board().document).includes("unsaved work"), "the restored change was saved");
      assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), snapshotKey()), null, "the snapshot is cleared after saving");

      // Discard: a second dead tab, this time thrown away.
      blockSaves();
      await addSticky("discard me", 800, 300);
      await waitForStatus("offline");
      await page.waitForFunction((key) => !!window.localStorage.getItem(key)?.includes("discard me"), snapshotKey(), { timeout: 5_000 });
      await page.close();
      unblockSaves();
      page = await context.newPage();
      await openBoard();
      await byTestId("board-restore").waitFor();
      await byTestId("board-restore-discard").click();
      await byTestId("board-restore").waitFor({ state: "detached" });
      assert.equal(await page.getByTestId("sticky-text").getByText("discard me").count(), 0);
      assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), snapshotKey()), null);
      assert.ok(!stickyTexts(board().document).includes("discard me"));
    });

    it("a restored snapshot saves against the version it was based on: a save made elsewhere raises the conflict dialog", async () => {
      await waitForStatus("saved");
      blockSaves();
      // Another device saves while this tab still works on the version it loaded.
      const base = board();
      const theirs: BoardDocument = { ...base.document, nodes: [...base.document.nodes, { id: "other-device", position: { x: 1000, y: 650 }, data: { type: "sticky", text: "from another device" } }] };
      assert.equal((await put({ document: theirs })).status, 200);
      await addSticky("stale draft", 600, 650);
      await waitForStatus("offline");
      await page.waitForFunction((key) => !!window.localStorage.getItem(key)?.includes("stale draft"), snapshotKey(), { timeout: 5_000 });
      await page.close();
      unblockSaves();

      page = await context.newPage();
      await openBoard();
      await byTestId("board-restore").waitFor();
      await byTestId("board-restore-confirm").click();
      await byTestId("board-conflict").waitFor({ timeout: 15_000 });
      assert.equal(await byTestId("board-save-status").getAttribute("data-status"), "conflict");
      assert.ok(stickyTexts(board().document).includes("from another device"), "the other save was not overwritten");
      assert.ok(!stickyTexts(board().document).includes("stale draft"));

      await byTestId("board-conflict-load").click();
      await byTestId("board-conflict").waitFor({ state: "detached" });
      await page.getByTestId("sticky-text").getByText("from another device").waitFor();
      await waitForStatus("saved");
    });

    it("closing with the Back arrow never leaves the editor under the list in history", async () => {
      // Opened from the list, edited (a guard entry is pushed), saved, closed.
      await page.close();
      page = await context.newPage();
      await page.goto(`${baseUrl}/admin/boards`);
      await byTestId(`board-edit-${boardId}`).click();
      await byTestId("board-canvas").waitFor({ timeout: 30_000 });
      await addSticky("history", 600, 200);
      await waitForStatus("saved");
      await byTestId("board-back").click();
      await byTestId("board-editor").waitFor({ state: "detached" });
      await byTestId(`board-card-${boardId}`).waitFor();
      assert.ok(page.url().endsWith("/admin/boards"), page.url());
      await page.goBack();
      await page.waitForTimeout(500);
      assert.equal(await byTestId("board-editor").count(), 0, "browser Back did not reopen the editor");
      assert.ok(!page.url().includes(boardId), page.url());

      // Opened from its URL: the editor entry is replaced by the list.
      await page.goto(`${baseUrl}/admin/boards`);
      await byTestId(`board-card-${boardId}`).waitFor({ timeout: 30_000 });
      await openBoard();
      await addSticky("history 2", 600, 320);
      await waitForStatus("saved");
      await byTestId("board-back").click();
      await byTestId("board-editor").waitFor({ state: "detached" });
      assert.ok(page.url().endsWith("/admin/boards"), page.url());
      await page.goBack();
      await page.waitForTimeout(500);
      assert.equal(await byTestId("board-editor").count(), 0, "browser Back did not reopen the editor");
      assert.ok(page.url().endsWith("/admin/boards"), page.url());
      assert.ok(stickyTexts(board().document).includes("history 2"));
    });

    it("a save the server refuses (400) leaves the board unsaved and offers Save now, which works once the server accepts", async () => {
      await page.goto(`${baseUrl}/admin/boards`);
      await openBoard();
      rejectSaves = true;
      try {
        await addSticky("refused", 900, 650);
        await byTestId("board-save").waitFor({ timeout: 15_000 });
        assert.equal(await byTestId("board-save-status").getAttribute("data-status"), "dirty", "not offline: the server answered");
        assert.ok(!stickyTexts(board().document).includes("refused"));
      } finally {
        rejectSaves = false;
      }
      await byTestId("board-save").click();
      await waitForStatus("saved");
      assert.ok(stickyTexts(board().document).includes("refused"), "saved by hand once the server accepted");
      await byTestId("board-save").waitFor({ state: "detached" });
    });
  });
}
