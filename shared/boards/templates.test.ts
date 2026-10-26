// Run: npx tsx --test shared/boards/templates.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { boardDocumentSchema, type FrameNodeData } from "../schema/boards.js";
import { absoluteBox, indexNodes, unionBox } from "./canvasOps.js";
import { BOARD_TEMPLATE_IDS, BOARD_TEMPLATES, buildTemplate, createTemplateDocument } from "./templates.js";

const counter = () => {
  let i = 0;
  return () => `t${++i}`;
};

const framesOf = (id: (typeof BOARD_TEMPLATE_IDS)[number]) =>
  buildTemplate(id, { newId: counter() }).nodes.filter((n) => n.data.type === "frame").map((n) => (n.data as FrameNodeData).title);

test("every template id has picker metadata", () => {
  assert.deepEqual(BOARD_TEMPLATES.map((t) => t.id), [...BOARD_TEMPLATE_IDS]);
});

test("blank is empty", () => {
  assert.deepEqual(buildTemplate("blank"), { nodes: [], edges: [] });
});

test("brainstorm: a title text and six stickies in six colors", () => {
  const { nodes } = buildTemplate("brainstorm", { newId: counter() });
  const stickies = nodes.filter((n) => n.data.type === "sticky");
  assert.equal(stickies.length, 6);
  assert.equal(new Set(stickies.map((n) => (n.data as { color?: string }).color)).size, 6);
  const text = nodes.filter((n) => n.data.type === "text");
  assert.equal(text.length, 1);
  // The title sits above the grid.
  assert.ok(text[0].position.y < Math.min(...stickies.map((s) => s.position.y)));
});

test("frame templates have the expected titles", () => {
  assert.deepEqual(framesOf("swot"), ["Strengths", "Weaknesses", "Opportunities", "Threats"]);
  assert.deepEqual(framesOf("kanban"), ["To do", "Doing", "Done"]);
  assert.deepEqual(framesOf("journey"), ["Awareness", "Consideration", "Purchase", "Retention", "Advocacy"]);
  assert.deepEqual(framesOf("retro"), ["Went well", "To improve", "Actions"]);
});

test("SWOT is a 2x2 grid of frames that do not overlap", () => {
  const { nodes } = buildTemplate("swot", { newId: counter() });
  const xs = new Set(nodes.map((n) => n.position.x));
  const ys = new Set(nodes.map((n) => n.position.y));
  assert.equal(xs.size, 2);
  assert.equal(ys.size, 2);
});

test("kanban stickies live inside their columns", () => {
  const { nodes } = buildTemplate("kanban", { newId: counter() });
  const byId = indexNodes(nodes);
  const stickies = nodes.filter((n) => n.data.type === "sticky");
  assert.equal(stickies.length, 3);
  for (const s of stickies) {
    assert.ok(s.parentId && byId.get(s.parentId)?.data.type === "frame");
    const frame = absoluteBox(byId, byId.get(s.parentId!)!);
    const box = absoluteBox(byId, s);
    assert.ok(box.x >= frame.x && box.x + box.w <= frame.x + frame.w && box.y + box.h <= frame.y + frame.h, "inside");
  }
  // Frames come before their children (React Flow needs parents first).
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  for (const s of stickies) assert.ok(index.get(s.parentId!)! < index.get(s.id)!);
});

test("templates are centred on the requested point, with fresh ids each time", () => {
  for (const id of BOARD_TEMPLATE_IDS) {
    if (id === "blank") continue;
    const { nodes } = buildTemplate(id, { center: { x: 1000, y: -500 } });
    const byId = indexNodes(nodes);
    const box = unionBox(nodes.filter((n) => !n.parentId).map((n) => absoluteBox(byId, n)))!;
    assert.ok(Math.abs(box.x + box.w / 2 - 1000) <= 1, `${id} centred on x`);
    assert.ok(Math.abs(box.y + box.h / 2 + 500) <= 1, `${id} centred on y`);
    const again = buildTemplate(id);
    assert.equal(new Set([...nodes, ...again.nodes].map((n) => n.id)).size, nodes.length * 2, `${id} ids are unique`);
  }
});

test("template documents validate", () => {
  for (const id of BOARD_TEMPLATE_IDS) {
    const doc = createTemplateDocument(id);
    assert.equal(boardDocumentSchema.safeParse(doc).success, true, id);
  }
});
