// Canvas templates: pure builders that return nodes (and edges) ready to be
// inserted into a board, centred on a point. Used by the editor's template
// picker and by the create dialog (kind "Canvas").
import type { BoardDocument, BoardEdge, BoardNode } from "../schema/boards.js";
import { FRAME_COLORS, STICKY_COLORS, TEXT_SIZES } from "./canvasDefaults.js";
import { centerContent, type Point } from "./canvasOps.js";
import { createBoardId, createEmptyDocument } from "./document.js";

export const BOARD_TEMPLATE_IDS = ["blank", "brainstorm", "swot", "kanban", "journey", "retro"] as const;
export type BoardTemplateId = (typeof BOARD_TEMPLATE_IDS)[number];

export const BOARD_TEMPLATES: { id: BoardTemplateId; label: string; description: string }[] = [
  { id: "blank", label: "Blank", description: "An empty canvas" },
  { id: "brainstorm", label: "Brainstorm", description: "A title and six sticky notes" },
  { id: "swot", label: "SWOT", description: "Strengths, weaknesses, opportunities, threats" },
  { id: "kanban", label: "Kanban", description: "To do, doing, done" },
  { id: "journey", label: "Customer journey", description: "Five stages in a row" },
  { id: "retro", label: "Retrospective", description: "Went well, to improve, actions" },
];

export interface TemplateContent {
  nodes: BoardNode[];
  edges: BoardEdge[];
}

export interface TemplateOptions {
  /** Where the template's bounding box is centred (default: 0,0). */
  center?: Point;
  newId?: () => string;
}

function frame(id: string, x: number, y: number, w: number, h: number, title: string, color?: string): BoardNode {
  return { id, position: { x, y }, size: { w, h }, data: { type: "frame", title, ...(color ? { color } : {}) } };
}

function sticky(id: string, x: number, y: number, text: string, color: string, parentId?: string, size = 200): BoardNode {
  return { id, position: { x, y }, size: { w: size, h: size }, ...(parentId ? { parentId } : {}), data: { type: "sticky", text, color } };
}

function title(id: string, x: number, y: number, text: string): BoardNode {
  return { id, position: { x, y }, data: { type: "text", text, fontSize: TEXT_SIZES.XL, align: "left" } };
}

function columns(newId: () => string, titles: string[], w: number, h: number, gap: number, colors: readonly (string | undefined)[]): BoardNode[] {
  return titles.map((t, i) => frame(newId(), i * (w + gap), 0, w, h, t, colors[i % colors.length]));
}

/** The template's nodes and edges with fresh ids, centred on `opts.center`. */
export function buildTemplate(id: BoardTemplateId, opts: TemplateOptions = {}): TemplateContent {
  const newId = opts.newId ?? createBoardId;
  let nodes: BoardNode[] = [];
  const edges: BoardEdge[] = [];

  switch (id) {
    case "blank":
      return { nodes: [], edges: [] };
    case "brainstorm": {
      nodes.push(title(newId(), 0, -110, "Brainstorm"));
      const prompts = ["Idea", "Idea", "Idea", "Question", "Risk", "Next step"];
      for (let i = 0; i < 6; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        nodes.push(sticky(newId(), col * 232, row * 232, prompts[i], STICKY_COLORS[i]));
      }
      break;
    }
    case "swot": {
      const labels = ["Strengths", "Weaknesses", "Opportunities", "Threats"];
      const colors = [FRAME_COLORS[0], FRAME_COLORS[1], FRAME_COLORS[2], FRAME_COLORS[3]];
      labels.forEach((label, i) => {
        nodes.push(frame(newId(), (i % 2) * 520, Math.floor(i / 2) * 400, 480, 360, label, colors[i]));
      });
      break;
    }
    case "kanban": {
      const [todo, doing, done] = columns(newId, ["To do", "Doing", "Done"], 360, 560, 32, [FRAME_COLORS[5], FRAME_COLORS[2], FRAME_COLORS[0]]);
      nodes = [todo, doing, done];
      nodes.push(sticky(newId(), 40, 40, "First task", STICKY_COLORS[0], todo.id, 180));
      nodes.push(sticky(newId(), 40, 250, "Second task", STICKY_COLORS[3], todo.id, 180));
      nodes.push(sticky(newId(), 40, 40, "In progress", STICKY_COLORS[2], doing.id, 180));
      break;
    }
    case "journey": {
      nodes = columns(newId, ["Awareness", "Consideration", "Purchase", "Retention", "Advocacy"], 320, 420, 24, [
        FRAME_COLORS[2],
        FRAME_COLORS[4],
        FRAME_COLORS[0],
        FRAME_COLORS[3],
        FRAME_COLORS[1],
      ]);
      break;
    }
    case "retro": {
      nodes = columns(newId, ["Went well", "To improve", "Actions"], 400, 520, 32, [FRAME_COLORS[0], FRAME_COLORS[1], FRAME_COLORS[2]]);
      break;
    }
  }
  return centerContent({ nodes, edges }, opts.center ?? { x: 0, y: 0 });
}

/** A new board's starting document for a template (blank = empty). */
export function createTemplateDocument(id: BoardTemplateId, opts: TemplateOptions = {}): BoardDocument {
  const doc = createEmptyDocument();
  const content = buildTemplate(id, opts);
  return { ...doc, nodes: content.nodes, edges: content.edges };
}
