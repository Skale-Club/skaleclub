// Small string-level editor for the <head> of the built index.html. Every setter
// removes whatever the build (or an earlier pass) already put in the document and
// appends the new tag, so the result never carries duplicates whatever shape the
// input had. Replacements use function replacers: descriptions contain "$"
// ("$8 each") and a string replacement would read "$8" as a capture group.

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class HeadEditor {
  private additions: string[] = [];

  constructor(private html: string) {}

  private strip(pattern: RegExp): void {
    this.html = this.html.replace(pattern, () => "");
  }

  lang(lang: string): this {
    this.html = this.html.replace(/<html lang="[^"]*"/, () => `<html lang="${lang}"`);
    return this;
  }

  title(value: string): this {
    const tag = `<title>${escapeHtml(value)}</title>`;
    this.html = /<title>[\s\S]*?<\/title>/.test(this.html)
      ? this.html.replace(/<title>[\s\S]*?<\/title>/, () => tag)
      : this.html.replace(/<\/head>/, () => `${tag}\n</head>`);
    return this;
  }

  meta(attr: "name" | "property", key: string, content: string): this {
    this.strip(new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*>\\s*`, "gi"));
    this.additions.push(`<meta ${attr}="${key}" content="${escapeHtml(content)}" />`);
    return this;
  }

  removeMeta(attr: "name" | "property", key: string): this {
    this.strip(new RegExp(`<meta\\s+[^>]*${attr}=["']${escapeRegExp(key)}["'][^>]*>\\s*`, "gi"));
    return this;
  }

  canonical(href: string | null): this {
    this.strip(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi);
    if (href) this.additions.push(`<link rel="canonical" href="${escapeHtml(href)}" />`);
    return this;
  }

  alternates(links: Array<{ hreflang: string; href: string }>): this {
    this.strip(/<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=[^>]*>\s*/gi);
    for (const { hreflang, href } of links) {
      this.additions.push(
        `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}" data-site-i18n="true" />`,
      );
    }
    return this;
  }

  jsonLd(blocks: object[]): this {
    this.strip(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>\s*/gi);
    for (const block of blocks) {
      // "<" escaped so no string inside the data can close the script element.
      const json = JSON.stringify(block).replace(/</g, "\\u003c");
      this.additions.push(`<script type="application/ld+json">${json}</script>`);
    }
    return this;
  }

  toString(): string {
    if (this.additions.length === 0) return this.html;
    const block = `${this.additions.join("\n")}\n`;
    return this.html.replace(/<\/head>/, () => `${block}</head>`);
  }
}
