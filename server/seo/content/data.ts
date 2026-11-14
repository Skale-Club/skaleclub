import { and, eq } from "drizzle-orm";
import { db } from "../../db.js";
import { storage } from "../../storage.js";
import { translations, type BlogPost, type Faq, type PortfolioService } from "#shared/schema.js";
import { translations as staticDictionary } from "#shared/i18n/pt.js";
import { faqsCache, portfolioCache, postBodyCache, recentPostsCache, translationsCache } from "../caches.js";

// Cached (5 min) reads behind the page-content summaries. Every loader is
// wrapped by the caller in a try/catch: a database error drops the summary, it
// never fails the page.

export const RECENT_POSTS = 6;

export interface ContentData {
  faqs(): Promise<Faq[]>;
  portfolio(): Promise<PortfolioService[]>;
  recentPosts(): Promise<BlogPost[]>;
  postBody(slug: string): Promise<string | null>;
  ptTranslations(): Promise<Map<string, string>>;
}

const staticPt = staticDictionary.pt as Record<string, string>;

export const contentData: ContentData = {
  faqs: () => faqsCache.get("faqs", () => storage.getFaqs()),
  portfolio: () => portfolioCache.get("portfolio", () => storage.getPortfolioServices()),
  recentPosts: () => recentPostsCache.get("recent", () => storage.getPublishedBlogPosts(RECENT_POSTS)),
  postBody: (slug) =>
    postBodyCache.get(slug, async () => {
      const post = await storage.getBlogPostBySlug(slug);
      return post && post.status === "published" ? post.content : null;
    }),
  // The same lookup the client's t() does for PT: the AI translation cache in
  // the `translations` table (the static dictionary is layered on top by
  // makeTranslator). Loaded whole: it is the set of strings the site has shown.
  ptTranslations: () =>
    translationsCache.get("pt", async () => {
      const rows = await db
        .select({ sourceText: translations.sourceText, translatedText: translations.translatedText })
        .from(translations)
        .where(and(eq(translations.sourceLanguage, "en"), eq(translations.targetLanguage, "pt")));
      return new Map(rows.map((row) => [row.sourceText, row.translatedText]));
    }),
};

export type Translate = (text: string) => string;

/** t() for the server: static dictionary, then the DB cache, then the English source. */
export function makeTranslator(lang: "en" | "pt", cached: Map<string, string> | null): Translate {
  if (lang === "en") return (text) => text;
  return (text) => {
    if (!text) return text;
    if (Object.prototype.hasOwnProperty.call(staticPt, text)) return staticPt[text];
    return cached?.get(text) ?? text;
  };
}

/** Plain text of a blog post's HTML body, split into paragraphs. */
export function htmlToParagraphs(html: string, maxChars = 6000): string[] {
  const text = html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|div|tr)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  const out: string[] = [];
  let total = 0;
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    out.push(line);
    total += line.length;
    if (total >= maxChars) break;
  }
  return out;
}
