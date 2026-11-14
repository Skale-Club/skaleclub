import { legacyLanguagePath, splitLanguagePath } from "#shared/languagePath.js";
import { coreKeyForPath } from "#shared/coreSeo.js";
import type { BlogPost, PortfolioService } from "#shared/schema.js";
import type { InjectContext } from "../inject.js";
import { contentData, htmlToParagraphs, makeTranslator, type ContentData } from "./data.js";
import { renderPageContent, type PageContent } from "./html.js";
import { landingPage } from "./landing.js";
import {
  appsPage,
  blogPage,
  blogPostPage,
  contactPage,
  faqPage,
  homePage,
  hubPage,
  linksPage,
  makeContext,
  nfcGuidePage,
  portfolioPage,
  privacyPage,
  productsPage,
  servicesPage,
  termsPage,
} from "./pages.js";

export { applyPageContent, renderPageContent } from "./html.js";

// Never let a slow or broken read hold the page: content is best-effort.
async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error("[seo] page content read failed:", (err as Error).message);
    return fallback;
  }
}

/** The summary of an indexable page, or null for private, unknown and unmapped URLs. */
export async function buildPageContent(
  pathname: string,
  { settings, route }: InjectContext,
  data: ContentData = contentData,
): Promise<PageContent | null> {
  if (route.status !== 200 || route.noindex) return null;

  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const normalized = legacyLanguagePath(cleanPath) ?? cleanPath;
  const { path: basePath, language } = splitLanguagePath(normalized);
  const lang: "en" | "pt" = route.landing ? (route.landing.language === "pt" || language === "pt" ? "pt" : "en") : language === "pt" ? "pt" : "en";
  const cached = lang === "pt" ? await safe(() => data.ptTranslations(), null) : null;
  const ctx = makeContext(lang, makeTranslator(lang, cached), settings);

  const portfolio = () => safe<PortfolioService[]>(() => data.portfolio(), []);
  const posts = () => safe<BlogPost[]>(() => data.recentPosts(), []);

  if (route.blog) {
    const body = await safe(() => data.postBody(route.blog!.slug), null);
    return blogPostPage(ctx, route.blog, body ? htmlToParagraphs(body) : [], await posts());
  }
  if (route.landing) return landingPage(ctx, route.landing, await portfolio(), await posts());

  if (basePath === "/products") return productsPage(ctx);
  if (basePath === "/nfc-guide") return nfcGuidePage(ctx);

  switch (coreKeyForPath(basePath, settings?.pageSlugs)) {
    case "home":
      return homePage(ctx, await portfolio(), await posts());
    case "portfolio":
      return portfolioPage(ctx, await portfolio());
    case "apps":
      return appsPage(ctx, await portfolio());
    case "services":
      return servicesPage(ctx);
    case "contact":
      return contactPage(ctx);
    case "faq":
      return faqPage(ctx, await safe(() => data.faqs(), []));
    case "blog":
      return blogPage(ctx, await posts());
    case "hub":
      return hubPage(ctx);
    case "privacyPolicy":
      return privacyPage(ctx);
    case "termsOfService":
      return termsPage(ctx);
    case "links":
      return linksPage(ctx);
    default:
      return null;
  }
}

/** HTML for the shell, "" when the page gets no summary. */
export async function buildPageContentHtml(pathname: string, ctx: InjectContext, data?: ContentData): Promise<string> {
  const content = await buildPageContent(pathname, ctx, data);
  return content ? renderPageContent(content) : "";
}
