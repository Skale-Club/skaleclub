// "Export as JSON" / "Import JSON": the board document as a file. Import
// validates with boardDocumentSchema and repairs dangling references, so a
// hand-edited or truncated file can never put the editor in a broken state.
// Pure, so it runs under `npm test`.
import { boardDocumentSchema, type BoardDocument } from "../schema/boards.js";

/** The file written by "Export as JSON": the document, camera left out (it belongs to the screen it was saved on). */
export function serializeBoardJson(doc: BoardDocument): string {
  const { viewport: _viewport, ...rest } = doc;
  return `${JSON.stringify(rest, null, 2)}\n`;
}

export type ParsedBoardJson = { ok: true; document: BoardDocument; repaired: number } | { ok: false; error: string };

/** Drops duplicate ids, edges to missing nodes and parents that do not exist. Returns how many fixes it made. */
export function repairDocument(doc: BoardDocument): { document: BoardDocument; repaired: number } {
  let repaired = 0;
  const seen = new Set<string>();
  const unique = doc.nodes.filter((node) => {
    if (seen.has(node.id)) {
      repaired++;
      return false;
    }
    seen.add(node.id);
    return true;
  });
  const nodes = unique.map((node) => {
    if (node.parentId && (!seen.has(node.parentId) || node.parentId === node.id)) {
      repaired++;
      const { parentId: _parentId, ...rest } = node;
      return rest;
    }
    return node;
  });
  const edgeIds = new Set<string>();
  const edges = doc.edges.filter((edge) => {
    const ok = seen.has(edge.source) && seen.has(edge.target) && !edgeIds.has(edge.id);
    if (ok) edgeIds.add(edge.id);
    else repaired++;
    return ok;
  });
  const strokeIds = new Set<string>();
  const strokes = doc.strokes.filter((stroke) => {
    if (strokeIds.has(stroke.id)) {
      repaired++;
      return false;
    }
    strokeIds.add(stroke.id);
    return true;
  });
  return { document: repaired ? { ...doc, nodes, edges, strokes } : doc, repaired };
}

/** Parses the text of a JSON file into a document: a bare document, or `{ document }` as the API returns a board. */
export function parseBoardJson(text: string): ParsedBoardJson {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw) && !("nodes" in raw) && typeof (raw as { document?: unknown }).document === "object"
      ? (raw as { document: unknown }).document
      : raw;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { ok: false, error: "This file is not a Boards document." };
  }
  const parsed = boardDocumentSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { ok: false, error: `This file is not a valid Boards document${where}: ${issue?.message ?? "invalid"}` };
  }
  const { document, repaired } = repairDocument({ ...parsed.data, viewport: undefined });
  return { ok: true, document, repaired };
}
