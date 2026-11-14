import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CompanySettings, PageSection } from "#shared/schema.js";
import { isNoindexPath } from "#shared/coreSeo.js";
import { foldAccents, slugify } from "#shared/slug.js";
import type { RouteResolution } from "../routes.js";
import type { ContentData } from "./data.js";
import { htmlToParagraphs, makeTranslator } from "./data.js";
import { applyPageContent, buildPageContentHtml } from "./index.js";

const settings = {
  companyName: "Skale Club",
  companyEmail: "info@skale.club",
  companyPhone: "(508) 801-8190",
  companyAddress: "36 South St, Framingham",
  workingHoursStart: "08:00",
  workingHoursEnd: "18:00",
  heroTitle: "Stop Doing Repetitive Work. Automate It.",
  heroSubtitle: "From AI chatbots to custom dashboards, we build the tech your business actually needs",
  pageSlugs: null,
  homepageContent: {
    trustBadges: [{ title: "Fast Implementation", description: "Solutions deployed in weeks, not months" }],
    aboutSection: { heading: "Tech Solutions That Drive Results", description: "We are a technology solutions company specializing in AI, automation, and custom software development." },
    ourServicesSection: {
      title: "Our Services",
      cards: [
        { order: 0, title: "Paid Advertising", description: "Google Ads, Meta and TikTok Ads.", features: ["Retargeting campaigns"] },
        { order: 1, title: "<script>alert(1)</script>", description: "Escaped & safe", features: [] },
      ],
    },
  },
  linksPageConfig: { title: "Skale Club", description: "We help businesses grow smarter.", links: [{ title: "Bad", url: "javascript:alert(1)" }] },
} as unknown as CompanySettings;

const posts = [
  { slug: "first-post", title: "First post", excerpt: "Why leads go cold after the first message.", metaDescription: null, status: "published" },
  { slug: "second-post", title: "Second post", excerpt: "A website that converts.", metaDescription: null, status: "published" },
];

const data: ContentData = {
  faqs: async () => [{ id: 1, question: "How long does a website take?", answer: "Most sites launch in two to four weeks.", order: 0 }] as never,
  portfolio: async () => [{ id: 1, slug: "xkedule", title: "Xkedule", subtitle: "", headline: "Booking that fills itself", description: "Online booking for service businesses.", price: "$99", priceLabel: "Monthly", features: [], isActive: true, order: 0, ctaText: "Start" }] as never,
  recentPosts: async () => posts as never,
  postBody: async () => "<h2>Leads go cold</h2><p>Answer in five minutes &amp; win.</p><script>bad()</script>",
  ptTranslations: async () => new Map([["Stop Doing Repetitive Work. Automate It.", "Pare de Fazer Trabalho Repetitivo. Automatize."]]),
};

const ok = (extra: Partial<RouteResolution> = {}): RouteResolution => ({ status: 200, noindex: false, landing: null, alternate: null, blog: null, ...extra });

const textOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const count = (html: string, re: RegExp) => (html.match(re) || []).length;

test("home: one h1, substantive text, escaped database copy", async () => {
  const html = await buildPageContentHtml("/", { settings, route: ok() }, data);
  assert.equal(count(html, /<h1\b/g), 1);
  assert.match(html, /<h1>Stop Doing Repetitive Work\. Automate It\.<\/h1>/);
  assert.ok(textOf(html).length > 500, `text length ${textOf(html).length}`);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.match(html, /href="\/blog\/first-post"/);
  assert.match(html, /Xkedule/);
});

test("Portuguese routes use the PT translations and /br links", async () => {
  const html = await buildPageContentHtml("/br", { settings, route: ok() }, data);
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /<h1>Pare de Fazer Trabalho Repetitivo\. Automatize\.<\/h1>/);
  assert.match(html, /href="\/br\/blog"/);
});

test("private, unknown and thin pages get no content", async () => {
  assert.equal(await buildPageContentHtml("/nope", { settings, route: { ...ok(), status: 404, noindex: true } }, data), "");
  assert.equal(await buildPageContentHtml("/thankyou", { settings, route: ok({ noindex: true }) }, data), "");
  assert.equal(await buildPageContentHtml("/admin", { settings, route: ok() }, data), "");
});

test("every core page has one h1 and real text", async () => {
  for (const p of ["/portfolio", "/apps", "/services", "/products", "/contact", "/faq", "/blog", "/skale-hub", "/privacy-policy", "/terms-of-service", "/nfc-guide", "/br/faq", "/br/nfc-guide"]) {
    const html = await buildPageContentHtml(p, { settings, route: ok() }, data);
    assert.equal(count(html, /<h1\b/g), 1, p);
    assert.ok(textOf(html).length > 300, `${p}: ${textOf(html).length}`);
  }
});

test("links page never emits a javascript: href", async () => {
  const html = await buildPageContentHtml("/links", { settings, route: ok() }, data);
  assert.ok(!/href="javascript:/i.test(html));
  assert.match(html, /Bad/);
});

test("blog post: body text, no script, other posts linked", async () => {
  const route = ok({ blog: { slug: "first-post", title: "First post", metaDescription: "Lead speed matters.", featureImageUrl: null } });
  const html = await buildPageContentHtml("/blog/first-post", { settings, route }, data);
  assert.match(html, /<h1>First post<\/h1>/);
  assert.match(html, /Answer in five minutes &amp; win\./);
  assert.ok(!html.includes("bad()"));
  assert.match(html, /href="\/blog\/second-post"/);
  assert.ok(!/href="\/blog\/first-post"/.test(html));
});

test("landing with empty section props renders the shared copy defaults", async () => {
  const sections = [
    { type: "heroWebsites", version: 1, props: {} },
    { type: "processStepper", version: 1, props: { icons: ["Search"] } },
    { type: "leadFormCta", version: 1, props: { formSlug: "x" } },
  ] as unknown as PageSection[];
  const route = ok({ landing: { slug: "websites", language: "en", alternateSlug: null, sections, updatedAt: null } });
  const html = await buildPageContentHtml("/websites", { settings, route }, data);
  assert.match(html, /<h1>Is your website still stuck in the Stone Age\?<\/h1>/);
  assert.match(html, /From briefing to launch in 4 steps/);
  assert.match(html, /Let&#39;s talk about your website/);
  assert.ok(!/>Search</.test(html), "icon names are not copy");
});

test("WhatsApp group landing takes its Portuguese defaults", async () => {
  const sections = [{ type: "whatsappGroup", version: 1, props: {} }] as unknown as PageSection[];
  const route = ok({ landing: { slug: "grupo", language: "pt", alternateSlug: null, sections, updatedAt: null } });
  const html = await buildPageContentHtml("/grupo", { settings, route }, data);
  assert.match(html, /<h1>Receba os avisos das lives semanais no seu WhatsApp<\/h1>/);
  assert.match(html, /Lives toda semana/);
});

test("applyPageContent swaps the loader for the content, never both", () => {
  const shell = readFileSync(path.resolve("client/index.html"), "utf8");
  assert.match(shell, /<!-- SEO_CONTENT -->/);
  const withContent = applyPageContent(shell, '<div id="seo-content"><h1>Hi</h1></div>');
  assert.ok(withContent.includes('<div id="seo-content">'));
  assert.ok(!withContent.includes("initial-loader"));
  assert.ok(!withContent.includes("loader-dot"));
  assert.ok(withContent.includes('src="/src/main.tsx"'), "the app script survives");
  assert.equal(applyPageContent(shell, ""), shell);
});

test("thin utility pages are noindex", () => {
  for (const p of ["/thankyou", "/br/thankyou", "/f/default", "/vcard", "/vcard/someone", "/svg"]) assert.ok(isNoindexPath(p), p);
  for (const p of ["/", "/br", "/faq", "/blog", "/blog/x", "/portfolio", "/products", "/websites"]) assert.ok(!isNoindexPath(p), p);
});

test("slugs fold accents instead of deleting letters", () => {
  assert.equal(foldAccents("São Paulo"), "Sao Paulo");
  assert.equal(slugify("Ação Rápida em São Paulo!"), "acao-rapida-em-sao-paulo");
  assert.equal(slugify("***", { fallback: "export" }), "export");
});

test("translator and html helpers", () => {
  const pt = makeTranslator("pt", new Map([["Hello", "Olá"]]));
  assert.equal(pt("Hello"), "Olá");
  assert.equal(pt("Services"), "Serviços");
  assert.equal(pt("Unknown"), "Unknown");
  assert.deepEqual(htmlToParagraphs("<p>a</p><p>b &amp; c</p>"), ["a", "b & c"]);
});
