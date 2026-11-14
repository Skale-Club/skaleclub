// Accent-safe slugs. "Ação Rápida" must become "acao-rapida", never "ao-rpida":
// decompose (NFD) and drop the combining marks before anything else is stripped.

/** Removes diacritics, keeping the base letters ("São Paulo" → "Sao Paulo"). */
export function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Lowercase ASCII slug: accents folded, every other run of characters becomes "-". */
export function slugify(text: string, opts: { fallback?: string; maxLength?: number } = {}): string {
  const slug = foldAccents(text.toLowerCase().trim())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, opts.maxLength ?? Infinity)
    .replace(/-+$/, "");
  return slug || opts.fallback || "";
}
