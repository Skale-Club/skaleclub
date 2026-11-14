// Renders a page summary (PageContent) as real HTML for the first response.
//
// The SPA used to ship an empty `#root` under a full-screen `#initial-loader`:
// zero characters of body text, which Google Search Console reports as Soft 404.
// This block puts the page's own words, one h1 and internal links in the raw
// HTML, outside `#root`, and takes the loader's place (the two are never served
// together). React removes it when the route mounts: see clearInitialShell() in
// client/src/lib/initialLoad.tsx. It is a readable fallback, not a copy of the
// React tree, so it styles itself and cannot disturb the real layout.

export const CONTENT_ID = "seo-content";
export const CONTENT_PLACEHOLDER = "<!-- SEO_CONTENT -->";
const LOADER_BLOCK = /<!-- INITIAL_LOADER_START -->[\s\S]*?<!-- INITIAL_LOADER_END -->/;

export interface ContentLink {
  href: string;
  label: string;
}

export interface ContentItem {
  title: string;
  text?: string;
  href?: string;
}

export interface ContentSection {
  heading: string;
  paragraphs?: string[];
  items?: ContentItem[];
}

export interface PageContent {
  lang: "en" | "pt";
  h1: string;
  eyebrow?: string;
  lead?: string;
  paragraphs?: string[];
  sections: ContentSection[];
  nav: ContentLink[];
  footer: { companyName: string; lines: string[]; links: ContentLink[] };
}

const MAX_SECTIONS = 14;
const MAX_ITEMS = 40;
const MAX_TEXT = 600;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapses whitespace and strips the `**highlight**` markers headlines use. */
export function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\*\*/g, "").replace(/\s+/g, " ").trim() : "";
}

/** Shortens on a word boundary so a summary never ends mid-word. */
export function truncate(text: string, max = MAX_TEXT): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).replace(/[\s,;:.-]+$/, "")}…`;
}

// Only same-site paths and http(s) URLs become links: a value from the database
// must never turn into a `javascript:` href.
function safeHref(href: string): string | null {
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function link(href: string, label: string, className?: string): string {
  const safe = safeHref(href);
  const text = escapeHtml(label);
  if (!safe) return text;
  return `<a href="${escapeHtml(safe)}"${className ? ` class="${className}"` : ""}>${text}</a>`;
}

const STYLE = `<style>
#${CONTENT_ID}{position:fixed;inset:0;z-index:9999;overflow-y:auto;background:#0d121a;color:#c4ccda;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
#${CONTENT_ID} *{box-sizing:border-box}
#${CONTENT_ID} a{color:#8fa8ec;text-decoration:none}
#${CONTENT_ID} .scx-w{max-width:72rem;margin:0 auto;padding:0 1.25rem}
#${CONTENT_ID} .scx-bar{border-bottom:1px solid rgba(255,255,255,.08);padding:1rem 0}
#${CONTENT_ID} .scx-bar .scx-w{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1.5rem}
#${CONTENT_ID} .scx-brand{color:#f4f6fa;font-weight:700;font-size:1.125rem}
#${CONTENT_ID} .scx-nav{list-style:none;display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;margin:0;padding:0;font-size:.9375rem}
#${CONTENT_ID} .scx-nav a{color:#c4ccda}
#${CONTENT_ID} .scx-hero{padding:3.5rem 0 2rem}
#${CONTENT_ID} .scx-eyebrow{margin:0 0 .75rem;font-size:.8125rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8fa8ec}
#${CONTENT_ID} h1{margin:0 0 1rem;max-width:48rem;color:#f4f6fa;font-size:clamp(2rem,5vw,3.25rem);line-height:1.05;font-weight:600;letter-spacing:-.03em}
#${CONTENT_ID} .scx-lead{margin:0;max-width:44rem;font-size:clamp(1.0625rem,2vw,1.25rem)}
#${CONTENT_ID} section{padding:1.75rem 0;border-top:1px solid rgba(255,255,255,.08)}
#${CONTENT_ID} h2{margin:0 0 .75rem;color:#f4f6fa;font-size:1.375rem;font-weight:600;letter-spacing:-.01em}
#${CONTENT_ID} p{margin:0 0 .75rem;max-width:48rem}
#${CONTENT_ID} ul.scx-items{list-style:none;margin:0;padding:0;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))}
#${CONTENT_ID} ul.scx-items li{border:1px solid rgba(255,255,255,.08);padding:1rem}
#${CONTENT_ID} .scx-t{display:block;margin-bottom:.25rem;color:#f4f6fa;font-weight:600}
#${CONTENT_ID} .scx-x{margin:0;font-size:.9375rem}
#${CONTENT_ID} footer{margin-top:2rem;padding:2rem 0 3rem;border-top:1px solid rgba(255,255,255,.08);font-size:.9375rem}
#${CONTENT_ID} footer p{margin:0 0 .25rem}
@media (max-width:640px){#${CONTENT_ID} .scx-hero{padding:2.25rem 0 1.5rem}#${CONTENT_ID} ul.scx-items{grid-template-columns:1fr}}
</style>`;

function renderItem(item: ContentItem): string {
  const title = cleanText(item.title);
  const text = cleanText(item.text);
  if (!title && !text) return "";
  const head = title ? (item.href ? link(item.href, title, "scx-t") : `<strong class="scx-t">${escapeHtml(title)}</strong>`) : "";
  return `<li>${head}${text ? `<p class="scx-x">${escapeHtml(truncate(text))}</p>` : ""}</li>`;
}

function renderSection(section: ContentSection): string {
  const heading = cleanText(section.heading);
  const paragraphs = (section.paragraphs ?? []).map(cleanText).filter(Boolean);
  const items = (section.items ?? []).slice(0, MAX_ITEMS).map(renderItem).filter(Boolean);
  if (!paragraphs.length && !items.length) return "";
  return [
    "<section>",
    heading ? `<h2>${escapeHtml(heading)}</h2>` : "",
    ...paragraphs.map((p) => `<p>${escapeHtml(truncate(p, 1600))}</p>`),
    items.length ? `<ul class="scx-items">${items.join("")}</ul>` : "",
    "</section>",
  ].join("");
}

/** The whole block, or "" when there is no headline to show (the loader stays). */
export function renderPageContent(content: PageContent): string {
  const h1 = cleanText(content.h1);
  if (!h1) return "";
  const lead = cleanText(content.lead);
  const eyebrow = cleanText(content.eyebrow);
  const homeHref = content.lang === "pt" ? "/br" : "/";
  const sections = content.sections.slice(0, MAX_SECTIONS).map(renderSection).filter(Boolean);
  const paragraphs = (content.paragraphs ?? []).map(cleanText).filter(Boolean);
  const footer = content.footer;

  return [
    `<div id="${CONTENT_ID}" lang="${content.lang === "pt" ? "pt-BR" : "en"}">`,
    STYLE,
    `<header class="scx-bar"><div class="scx-w">${link(homeHref, footer.companyName || "Skale Club", "scx-brand")}`,
    `<nav aria-label="Main"><ul class="scx-nav">${content.nav.map((l) => `<li>${link(l.href, l.label)}</li>`).join("")}</ul></nav></div></header>`,
    `<main class="scx-w"><div class="scx-hero">`,
    eyebrow ? `<p class="scx-eyebrow">${escapeHtml(eyebrow)}</p>` : "",
    `<h1>${escapeHtml(h1)}</h1>`,
    lead ? `<p class="scx-lead">${escapeHtml(lead)}</p>` : "",
    "</div>",
    paragraphs.length ? `<section>${paragraphs.map((p) => `<p>${escapeHtml(truncate(p, 1600))}</p>`).join("")}</section>` : "",
    ...sections,
    "</main>",
    `<footer><div class="scx-w"><p><strong>${escapeHtml(footer.companyName)}</strong></p>`,
    ...footer.lines.filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`),
    footer.links.length ? `<p>${footer.links.map((l) => link(l.href, l.label)).join(" | ")}</p>` : "",
    "</div></footer></div>",
  ].join("");
}

/**
 * Puts the block in the shell. With content, the loader block is removed: an
 * opaque overlay over the text is exactly the Soft 404 this exists to fix.
 * Without content (private and unknown URLs) the shell is returned untouched.
 */
export function applyPageContent(html: string, block: string): string {
  if (!block || !html.includes(CONTENT_PLACEHOLDER)) return html;
  return html.replace(LOADER_BLOCK, "").replace(CONTENT_PLACEHOLDER, () => block);
}
