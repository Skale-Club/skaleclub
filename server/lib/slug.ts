import crypto from "node:crypto";

/** 8 random bytes rendered in base36 (about 13 chars): unguessable slug suffix. */
export function randomSlugSuffix(): string {
  return BigInt("0x" + crypto.randomBytes(8).toString("hex")).toString(36);
}

/** Lowercase ASCII slug from a title: accents stripped, runs of other characters become "-". */
export function slugifyTitle(title: string, opts: { fallback?: string; maxLength?: number } = {}): string {
  const slug = title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, opts.maxLength ?? Infinity)
    .replace(/-+$/, "");
  return slug || opts.fallback || "";
}

/** Escapes %, _ and \ so a user's search term is matched literally by LIKE/ILIKE. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
