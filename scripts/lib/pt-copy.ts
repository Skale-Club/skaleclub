// Apply the approved pt-BR copy (scripts/data/landing-pt-copy.ts) to page
// sections. Shared by scripts/patch-landing-pt-copy.ts and seedPage() so a
// landing seed never writes English into a `pt` page row.
//
// A string is replaced only when it exactly equals a known EN source (or its
// em-dash-cleaned form), so hand edits are never overwritten. Identifier / URL /
// enum keys (and their whole subtrees, e.g. whatsapp `messages`) are skipped.

import type { PageSection } from "../../shared/schema/pages.js";
import { LANDING_PT_COPY } from "../data/landing-pt-copy.js";

export const PT_SKIP_KEYS = new Set([
  "type", "id", "anchorId", "theme", "formSlug", "icons", "icon", "kind", "href", "url", "src",
  "image", "imageUrl", "backgroundImageUrl", "secondaryCtaHref", "logo", "video", "poster",
  "number", "align", "variant", "layout", "messages",
]);

const cleanEmDash = (s: string) => s.replace(/ — /g, " | ").replace(/—/g, " | ");

const LOOKUP = new Map<string, string>();
for (const [en, pt] of Object.entries(LANDING_PT_COPY)) {
  LOOKUP.set(en, pt);
  LOOKUP.set(cleanEmDash(en), pt);
  LOOKUP.set(en.replace(/ — /g, " | ").replace(/—/g, "|"), pt);
}

export const PT_COPY_VALUES = new Set(Object.values(LANDING_PT_COPY));

function walk(value: unknown, key: string, unmatched: Set<string>): unknown {
  if (PT_SKIP_KEYS.has(key)) return value;
  if (typeof value === "string") {
    const pt = LOOKUP.get(value);
    if (pt !== undefined) return pt;
    if (/\s/.test(value) && !/^https?:/.test(value)) unmatched.add(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, key, unmatched));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v, k, unmatched);
    return out;
  }
  return value;
}

export function applyPtCopy(sections: PageSection[]): { sections: PageSection[]; unmatched: Set<string> } {
  const unmatched = new Set<string>();
  const next = sections.map((s) => ({ ...s, props: walk(s.props, "props", unmatched) as Record<string, unknown> }));
  return { sections: next, unmatched };
}

/** Every string in the sections that equals an approved PT value (whether or not it changed this run). */
export function collectPtValues(value: unknown, key = "", out = new Set<string>()): Set<string> {
  if (PT_SKIP_KEYS.has(key)) return out;
  if (typeof value === "string") {
    if (PT_COPY_VALUES.has(value)) out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectPtValues(v, key, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) collectPtValues(v, k, out);
  }
  return out;
}
