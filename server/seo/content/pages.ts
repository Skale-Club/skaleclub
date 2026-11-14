import { buildPagePaths } from "#shared/pageSlugs.js";
import { withLanguage } from "#shared/languagePath.js";
import { CORE_SEO, type CoreSeoKey } from "#shared/coreSeo.js";
import { catalogProducts, catalogServices } from "#shared/catalog.js";
import { PRODUCT_CARDS } from "#shared/products.js";
import { NFC_GUIDE_FAQ_EN, NFC_GUIDE_FAQ_PT } from "#shared/nfcGuideFaq.js";
import type { BlogPost, CompanySettings, Faq, HomepageContent, PortfolioService } from "#shared/schema.js";
import { cleanText, type ContentItem, type ContentLink, type ContentSection, type PageContent } from "./html.js";
import type { Translate } from "./data.js";

// One builder per site page. English strings are the ones the React pages pass
// to t(), so the PT summary resolves through the same dictionary and cache the
// client uses, and the crawler reads the words a visitor sees.

export interface BuildContext {
  lang: "en" | "pt";
  t: Translate;
  settings: CompanySettings | null;
  /** `/x` for English, `/br/x` for Portuguese. */
  path: (enPath: string) => string;
}

export function makeContext(lang: "en" | "pt", t: Translate, settings: CompanySettings | null): BuildContext {
  return { lang, t, settings, path: (enPath) => (lang === "pt" ? withLanguage(enPath, "pt") : enPath) };
}

export function homepage(ctx: BuildContext): Partial<HomepageContent> {
  return (ctx.settings?.homepageContent as Partial<HomepageContent> | null) ?? {};
}

function paths(ctx: BuildContext) {
  return buildPagePaths(ctx.settings?.pageSlugs);
}

export function shell(ctx: BuildContext, page: Omit<PageContent, "lang" | "nav" | "footer">): PageContent {
  const { t, settings } = ctx;
  const p = paths(ctx);
  const nav: ContentLink[] = [
    { href: ctx.path("/"), label: t("Home") },
    { href: ctx.path(p.portfolio), label: t("Our Solutions") },
    { href: ctx.path("/apps"), label: t("Apps") },
    { href: ctx.path("/services"), label: t("Services") },
    { href: ctx.path("/products"), label: t("Products") },
    { href: ctx.path(p.hub), label: "Skale Hub" },
    { href: ctx.path(p.blog), label: t("Blog") },
    { href: ctx.path(p.faq), label: t("FAQ") },
    { href: ctx.path(p.contact), label: t("Contact") },
  ];
  const hours = settings?.workingHoursStart && settings?.workingHoursEnd
    ? `${t("Hours")}: ${settings.workingHoursStart} - ${settings.workingHoursEnd}`
    : "";
  return {
    ...page,
    lang: ctx.lang,
    nav,
    footer: {
      companyName: cleanText(settings?.companyName) || "Skale Club",
      lines: [cleanText(settings?.companyAddress), cleanText(settings?.companyPhone), cleanText(settings?.companyEmail), hours],
      links: [
        { href: ctx.path(p.privacyPolicy), label: t("Privacy Policy") },
        { href: ctx.path(p.termsOfService), label: t("Terms of Service") },
      ],
    },
  };
}

// ---- shared sections (home and the landing adapters reuse them) ------------

export function trustBadgesSection(ctx: BuildContext, heading = ""): ContentSection {
  const badges = homepage(ctx).trustBadges ?? [];
  return { heading, items: badges.map((b) => ({ title: ctx.t(b.title), text: ctx.t(b.description) })) };
}

export function appsSection(ctx: BuildContext, portfolio: PortfolioService[], heading?: string): ContentSection {
  const { t } = ctx;
  return {
    heading: heading ?? t("Apps"),
    items: catalogProducts(portfolio).map((app) => ({
      title: t(app.title),
      text: [app.headline, app.description].filter(Boolean).map((v) => t(String(v))).join(". "),
      href: ctx.path("/apps"),
    })),
  };
}

export function servicesCardsSection(ctx: BuildContext, heading?: string): ContentSection {
  const { t } = ctx;
  const section = homepage(ctx).ourServicesSection;
  return {
    heading: heading ?? t(section?.title || "Our Services"),
    paragraphs: section?.subtitle ? [t(section.subtitle)] : [],
    items: catalogServices(section?.cards).map((card) => ({
      title: t(card.title),
      text: [card.description, ...card.features].filter(Boolean).map((v) => t(String(v))).join(". "),
      href: ctx.path("/services"),
    })),
  };
}

export function solutionsSection(ctx: BuildContext): ContentSection {
  const { t } = ctx;
  const content = homepage(ctx);
  const section = content.horizontalScrollSection ?? content.consultingStepsSection;
  const cards = ((section as { cards?: { title: string; description?: string; features?: string[] }[] } | undefined)?.cards) ?? [];
  return {
    heading: t(cleanText(section?.title)),
    paragraphs: section?.subtitle ? [t(section.subtitle)] : [],
    items: cards.map((card) => ({
      title: t(card.title),
      text: [card.description, ...(card.features ?? [])].filter(Boolean).map((v) => t(String(v))).join(". "),
    })),
  };
}

export function aboutSection(ctx: BuildContext): ContentSection {
  const { t } = ctx;
  const about = homepage(ctx).aboutSection;
  return {
    heading: t(about?.heading || about?.label || "About Us"),
    paragraphs: about?.description ? [t(about.description)] : [],
    items: (about?.highlights ?? []).map((h) => ({ title: t(h.title), text: t(h.description) })),
  };
}

export function areasServedSection(ctx: BuildContext): ContentSection {
  const { t } = ctx;
  const areas = homepage(ctx).areasServedSection;
  return {
    heading: t(areas?.heading || areas?.label || ""),
    paragraphs: areas?.description ? [t(areas.description)] : [],
  };
}

export function reviewsSection(ctx: BuildContext): ContentSection {
  const reviews = homepage(ctx).reviewsSection;
  return { heading: ctx.t(reviews?.title || ""), paragraphs: reviews?.subtitle ? [ctx.t(reviews.subtitle)] : [] };
}

export function postsSection(ctx: BuildContext, posts: BlogPost[], heading?: string): ContentSection {
  const blog = homepage(ctx).blogSection;
  const blogPath = paths(ctx).blog;
  return {
    heading: heading ?? ctx.t(blog?.title || "Blog"),
    paragraphs: heading === undefined && blog?.subtitle ? [ctx.t(blog.subtitle)] : [],
    // Post bodies are single-language: /br/blog/x serves the English post.
    items: posts.map((post) => ({
      title: post.title,
      text: post.excerpt || post.metaDescription || "",
      href: ctx.path(`${blogPath}/${post.slug}`),
    })),
  };
}

function productsSection(ctx: BuildContext, heading: string): ContentSection {
  return {
    heading,
    items: PRODUCT_CARDS.map((card) => ({ title: ctx.t(card.title), text: ctx.t(card.description), href: ctx.path(card.href) })),
  };
}

function seoCopy(ctx: BuildContext, key: CoreSeoKey) {
  return CORE_SEO[key][ctx.lang] ?? null;
}

// ---- pages --------------------------------------------------------------------

export function homePage(ctx: BuildContext, portfolio: PortfolioService[], posts: BlogPost[]): PageContent {
  const { t, settings } = ctx;
  const seo = seoCopy(ctx, "home");
  return shell(ctx, {
    h1: t(cleanText(settings?.heroTitle) || cleanText(settings?.seoTitle) || "Skale Club"),
    lead: t(cleanText(settings?.heroSubtitle) || cleanText(settings?.seoDescription) || seo?.description || ""),
    sections: [
      trustBadgesSection(ctx),
      solutionsSection(ctx),
      servicesCardsSection(ctx),
      appsSection(ctx, portfolio),
      postsSection(ctx, posts),
      aboutSection(ctx),
      areasServedSection(ctx),
    ],
  });
}

export function portfolioPage(ctx: BuildContext, portfolio: PortfolioService[]): PageContent {
  const { t } = ctx;
  const hero = homepage(ctx).portfolioHero;
  return shell(ctx, {
    eyebrow: t(hero?.badge || "Our Solutions"),
    h1: t(hero?.title || "Stop Doing Repetitive Work. Automate It."),
    lead: t(hero?.subtitle || "Explore the tools and services we've built to help businesses grow."),
    sections: [appsSection(ctx, portfolio), servicesCardsSection(ctx, t("Services")), productsSection(ctx, t("Products"))],
  });
}

export function appsPage(ctx: BuildContext, portfolio: PortfolioService[]): PageContent {
  const { t } = ctx;
  return shell(ctx, {
    eyebrow: t("Apps"),
    h1: t("Tools to sell more and work less"),
    lead: t("Booking, content, website, CRM and sales solutions that simplify your day-to-day and help your business grow."),
    sections: [appsSection(ctx, portfolio, "")],
  });
}

export function servicesPage(ctx: BuildContext): PageContent {
  const { t } = ctx;
  return shell(ctx, {
    eyebrow: t("Services"),
    h1: t("Built by us, for your business"),
    lead: t("Tailored marketing and technology, quoted for your case."),
    sections: [servicesCardsSection(ctx, ""), solutionsSection(ctx)],
  });
}

export function productsPage(ctx: BuildContext): PageContent {
  const { t } = ctx;
  return shell(ctx, {
    eyebrow: t("Products"),
    h1: t("One tap, more customers"),
    lead: t("NFC plaques and keychains that open your Google reviews, Instagram or menu. Made by us, ready to use."),
    sections: [productsSection(ctx, "")],
  });
}

export function contactPage(ctx: BuildContext): PageContent {
  const { t, settings } = ctx;
  const candidates: (ContentItem | null)[] = [
    settings?.companyPhone ? { title: t("Phone"), text: settings.companyPhone } : null,
    settings?.companyEmail ? { title: t("Email"), text: settings.companyEmail } : null,
    settings?.companyAddress ? { title: t("Address"), text: settings.companyAddress } : null,
    settings?.workingHoursStart && settings?.workingHoursEnd
      ? { title: t("Hours"), text: `${settings.workingHoursStart} - ${settings.workingHoursEnd}` }
      : null,
  ];
  const items = candidates.filter((item): item is ContentItem => item !== null);
  return shell(ctx, {
    eyebrow: t("Contact"),
    h1: t("Contact Us"),
    lead: t("Have questions about our services or need a custom quote? We're here to help. Reach out to us today."),
    sections: [{ heading: t("Get in touch"), items }, servicesCardsSection(ctx, t("Services")), areasServedSection(ctx)],
  });
}

export function faqPage(ctx: BuildContext, faqs: Faq[]): PageContent {
  const { t } = ctx;
  return shell(ctx, {
    h1: t("Frequently Asked Questions"),
    lead: t("Find answers to common questions about our services."),
    sections: [{ heading: "", items: faqs.map((faq) => ({ title: t(faq.question), text: t(faq.answer) })) }],
  });
}

export function blogPage(ctx: BuildContext, posts: BlogPost[]): PageContent {
  return shell(ctx, {
    h1: ctx.t("Our Blog"),
    lead: ctx.t("Tips, guides, and insights about marketing services"),
    sections: [postsSection(ctx, posts, ctx.t("Latest articles"))],
  });
}

export function blogPostPage(
  ctx: BuildContext,
  post: { title: string; metaDescription: string | null; slug: string },
  body: string[],
  posts: BlogPost[],
): PageContent {
  return shell(ctx, {
    eyebrow: ctx.t("Blog"),
    h1: post.title,
    lead: post.metaDescription ?? "",
    paragraphs: body,
    sections: [postsSection(ctx, posts.filter((p) => p.slug !== post.slug), ctx.t("More articles"))],
  });
}

export function hubPage(ctx: BuildContext): PageContent {
  const { t } = ctx;
  return shell(ctx, {
    eyebrow: "Skale Hub by Skale Club",
    h1: "Skale Hub",
    lead: t("Skale Hub is Skale Club's weekly session for business owners who want to learn how to acquire clients in the United States using Google Ads, Meta Ads, Google Local Services, Thumbtack, Yelp, CRM, automation, and artificial intelligence."),
    sections: [
      {
        heading: t("Weekly live access"),
        items: [
          { title: t("Live every week"), text: t("Fresh tactical sessions") },
          { title: t("Business focused"), text: t("US client acquisition") },
          { title: t("Registration required"), text: t("Weekly live access") },
        ],
      },
    ],
  });
}

const PRIVACY_SECTIONS = [
  "1. Introduction", "2. Information We Collect", "3. How We Use Your Information",
  "4. Information Sharing and Disclosure", "5. Data Security", "6. Cookies and Tracking Technologies",
  "7. Your Privacy Rights", "8. Data Retention", "9. Children's Privacy",
  "10. Changes to This Privacy Policy", "11. SMS / Text Message Communications", "12. Contact Us",
];

const TERMS_SECTIONS = [
  "1. Acceptance of Terms", "2. Services and Scope", "3. Eligibility and Accounts",
  "4. Quotes, Pricing, and Payments", "5. Scheduling, Rescheduling, and Cancellations",
  "6. Access, Safety, and Preparation", "7. Service Quality and Re-Cleans",
  "8. Customer Responsibilities and Conduct", "9. Marketing Materials and Assets",
  "10. Recurring Services and Subscriptions", "11. Limitations of Liability",
  "12. Intellectual Property and Acceptable Use", "13. Third-Party Services and Links",
  "14. Changes and Termination", "15. Governing Law and Dispute Resolution", "16. Contact",
];

function companyName(ctx: BuildContext): string {
  return cleanText(ctx.settings?.companyName) || "Skale Club";
}

export function privacyPage(ctx: BuildContext): PageContent {
  const { t } = ctx;
  const name = companyName(ctx);
  return shell(ctx, {
    h1: t("Privacy Policy"),
    lead: t(`Your privacy is important to us. This policy explains how ${name} collects, uses, and protects your personal information.`),
    paragraphs: [
      t(`Welcome to ${name} ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our marketing services.`),
      t("By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services."),
      t("Last updated: January 10, 2026"),
    ],
    sections: [{ heading: t("Privacy Policy"), items: PRIVACY_SECTIONS.map((title) => ({ title: t(title) })) }],
  });
}

export function termsPage(ctx: BuildContext): PageContent {
  const { t } = ctx;
  const name = companyName(ctx);
  return shell(ctx, {
    h1: t("Terms of Service"),
    lead: t(`These terms govern your use of ${name}'s website and services. Please read them carefully before using our platform.`),
    paragraphs: [
      t(`By accessing the site, creating an account, or requesting services with ${name}, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use our services.`),
      t("We provide digital marketing services including lead generation, advertising management, and growth consulting for service businesses. Service details, deliverables, and exclusions may vary by package and engagement type."),
      t("Last updated: January 10, 2026"),
    ],
    sections: [{ heading: t("Terms of Service"), items: TERMS_SECTIONS.map((title) => ({ title: t(title) })) }],
  });
}

export function nfcGuidePage(ctx: BuildContext): PageContent {
  const { t, lang } = ctx;
  const groups = lang === "pt" ? NFC_GUIDE_FAQ_PT : NFC_GUIDE_FAQ_EN;
  return shell(ctx, {
    h1: t("NFC Keychain Guide: Models, Pricing and FAQs"),
    lead: t("Understand flat, raised-relief and custom-shaped NFC keychains, what changes the price, phone compatibility, artwork and the complete order process."),
    sections: [
      ...groups.map((group) => ({
        heading: group.title,
        items: group.items.map(([question, answer]) => ({ title: question, text: answer })),
      })),
      { heading: "", items: [{ title: t("NFC keychains"), text: t("Custom keychains with your branding, plus a display to sell them at your counter."), href: ctx.path("/nfc-keychains") }] },
    ],
  });
}

export function linksPage(ctx: BuildContext): PageContent {
  const config = ctx.settings?.linksPageConfig as { title?: string; description?: string; links?: { title?: string; url?: string; isActive?: boolean }[] } | null;
  const links = (config?.links ?? []).filter((l) => l.isActive !== false && l.title);
  return shell(ctx, {
    h1: cleanText(config?.title) || companyName(ctx),
    lead: cleanText(config?.description),
    sections: [{ heading: ctx.t("Links"), items: links.map((l) => ({ title: String(l.title), href: l.url })) }],
  });
}
