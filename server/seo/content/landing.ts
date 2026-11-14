import type { PageSection } from "#shared/schema.js";
import { getLandingSeo } from "#shared/landingSeo.js";
import {
  FAQ_ACCORDION_DEFAULTS,
  HERO_WEBSITES_DEFAULTS,
  LEAD_FORM_CTA_DEFAULTS,
  PROCESS_STEPPER_DEFAULTS,
  WHATSAPP_GROUP_DEFAULTS,
} from "#shared/sectionCopyDefaults.js";
import type { BlogPost, PortfolioService } from "#shared/schema.js";
import { cleanText, type ContentItem, type ContentSection, type PageContent } from "./html.js";
import {
  aboutSection,
  appsSection,
  areasServedSection,
  postsSection,
  reviewsSection,
  servicesCardsSection,
  shell,
  solutionsSection,
  trustBadgesSection,
  type BuildContext,
} from "./pages.js";

// Text of a managed landing (the `pages` table): its sections, read the way the
// section components read them (row props over the shared copy defaults, and
// the "global" sections from the homepage settings).

type Props = Record<string, unknown>;

const DEFAULTS: Partial<Record<string, Props>> = {
  heroWebsites: HERO_WEBSITES_DEFAULTS,
  processStepper: PROCESS_STEPPER_DEFAULTS,
  leadFormCta: LEAD_FORM_CTA_DEFAULTS,
  faqAccordion: FAQ_ACCORDION_DEFAULTS,
  whatsappGroup: WHATSAPP_GROUP_DEFAULTS,
};

const HEADING_KEYS = ["heading", "title", "headline"];
const TEXT_KEYS = ["subheading", "subtitle", "subheadline", "description", "text", "footnote"];
const ITEM_TITLE_KEYS = ["title", "question", "name", "heading", "label"];
const ITEM_TEXT_KEYS = ["description", "answer", "text", "subtitle", "body", "price", "priceLabel", "outcome"];
const ITEM_LIST_KEYS = ["paragraphs", "bullets", "features", "items"];
// Arrays that hold icon names, media or line fragments, not copy.
const SKIP_ARRAYS = new Set(["icons", "mediaItems", "headlineLines", "images", "popupSliderImages"]);

function str(value: unknown): string {
  return cleanText(value);
}

function first(obj: Props, keys: string[]): string {
  for (const key of keys) {
    const value = str(obj[key]);
    if (value) return value;
  }
  return "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => (typeof v === "string" ? str(v) : first((v ?? {}) as Props, ["text", "title"]))).filter(Boolean) : [];
}

function toItem(value: unknown, t: (s: string) => string): ContentItem | null {
  if (typeof value === "string") return str(value) ? { title: t(str(value)) } : null;
  if (!value || typeof value !== "object") return null;
  const obj = value as Props;
  const title = first(obj, ITEM_TITLE_KEYS);
  const texts = [
    ...ITEM_TEXT_KEYS.map((key) => str(obj[key])).filter(Boolean),
    ...ITEM_LIST_KEYS.flatMap((key) => stringList(obj[key])),
  ];
  if (!title && !texts.length) return null;
  return { title: t(title), text: texts.map(t).join(". ") };
}

/** A section's own props (merged over its defaults) as heading, paragraphs and items. */
function genericSection(props: Props, t: (s: string) => string): ContentSection {
  const items: ContentItem[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (!Array.isArray(value) || SKIP_ARRAYS.has(key)) continue;
    for (const entry of value) {
      const item = toItem(entry, t);
      if (item) items.push(item);
    }
  }
  return {
    heading: t(first(props, HEADING_KEYS)),
    paragraphs: TEXT_KEYS.map((key) => str(props[key])).filter(Boolean).map(t),
    items,
  };
}

function hasOwnContent(props: Props): boolean {
  return Object.entries(props).some(([key, value]) => key !== "theme" && key !== "tone" && (typeof value === "string" ? value.trim() : Array.isArray(value) && value.length > 0));
}

interface Hero {
  h1: string;
  eyebrow?: string;
  lead?: string;
}

function heroOf(section: PageSection, ctx: BuildContext): Hero | null {
  const { t } = ctx;
  const props = { ...(DEFAULTS[section.type] ?? {}), ...((section.props ?? {}) as Props) };
  if (section.type === "heroWebsites") {
    const lines = Array.isArray(props.headlineLines) ? stringList(props.headlineLines) : [];
    const h1 = lines.length ? lines.map(t).join(" ") : t(str(props.headline));
    return { h1, eyebrow: t(str(props.eyebrow)), lead: t(str(props.subheadline)) };
  }
  if (section.type === "whatsappGroup") {
    return { h1: [str(props.headline), str(props.headlineAccent)].filter(Boolean).join(" "), eyebrow: str(props.badgeLabel), lead: str(props.subheadline) };
  }
  if (section.type === "hero") {
    return { h1: t(str(ctx.settings?.heroTitle)), lead: t(str(ctx.settings?.heroSubtitle)) };
  }
  return null;
}

function bodyOf(section: PageSection, ctx: BuildContext, portfolio: PortfolioService[], posts: BlogPost[]): ContentSection[] {
  const own = (section.props ?? {}) as Props;
  const props = { ...(DEFAULTS[section.type] ?? {}), ...own };
  switch (section.type) {
    case "whatsappGroup":
      return [{ heading: str(props.formTitle), items: stringList(props.bullets).map((title) => ({ title })) }];
    case "trustBadges":
      return [hasOwnContent(own) ? genericSection(own, ctx.t) : trustBadgesSection(ctx)];
    case "ourServices":
      return [hasOwnContent(own) ? genericSection(own, ctx.t) : servicesCardsSection(ctx)];
    case "reviews":
      return [hasOwnContent(own) ? genericSection(own, ctx.t) : reviewsSection(ctx)];
    case "services":
      return [solutionsSection(ctx), appsSection(ctx, portfolio)];
    case "about":
      return [aboutSection(ctx)];
    case "areasServed":
      return [areasServedSection(ctx)];
    case "blog":
      return [postsSection(ctx, posts)];
    default:
      return [genericSection(props, ctx.t)];
  }
}

export function landingPage(
  ctx: BuildContext,
  row: { slug: string; sections: PageSection[] },
  portfolio: PortfolioService[],
  posts: BlogPost[],
): PageContent {
  let hero: Hero | null = null;
  const sections: ContentSection[] = [];
  for (const section of row.sections ?? []) {
    const found: Hero | null = hero ? null : heroOf(section, ctx);
    if (found?.h1) {
      hero = found;
      if (section.type !== "whatsappGroup") continue;
    }
    if (section.type === "hero" || section.type === "heroWebsites") continue;
    sections.push(...bodyOf(section, ctx, portfolio, posts));
  }
  const seo = getLandingSeo(row.slug);
  // No hero row: the curated SEO copy is the page's headline.
  const h1 = hero?.h1 || cleanText(seo?.title?.split("|")[0]) || cleanText(sections[0]?.heading);
  return shell(ctx, {
    eyebrow: hero?.eyebrow,
    h1,
    lead: hero?.lead || seo?.description || "",
    sections,
  });
}
