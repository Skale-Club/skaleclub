/**
 * Auto-blog parity SC-05 — the editorial pillar rotation.
 *
 * The problem this fixes: until now the generator had exactly one prompt shape,
 * "refine this RSS item into a post". That gives a consistent voice and almost
 * no structural variety — every post is the same kind of commentary on whatever
 * the feed brought in. Breadth cannot be requested in an adjective; it has to be
 * scheduled. One pillar per run, rotated least-recently-used, plus a title shape
 * and a length band.
 *
 * The rotation machinery is shared with Xkedule (same functions, same tests
 * where they apply); the pillars themselves are this site's own, because
 * Xkedule's are written for trades that visit a customer's home and this is a
 * B2B marketing agency.
 */
import test from "node:test";
import { strict as assert } from "node:assert";

import {
  BLOG_PILLARS,
  BLOG_TITLE_STYLES,
  assignPillar,
  availablePillars,
  buildCatalogSection,
  buildKeywordDedupSection,
  buildPillarSection,
  pickNextPillar,
  sanitizeGeneratedLinks,
  type BlogPillar,
} from "#shared/blog-prompt.js";

const ALL_DATA = { hasCatalog: true, hasFaqs: true, hasRssItem: true };

// ─── Rotation ───────────────────────────────────────────────────────────────

test("a never-used pillar beats every used one", () => {
  const a: BlogPillar = { ...BLOG_PILLARS[0], id: "a" };
  const b: BlogPillar = { ...BLOG_PILLARS[0], id: "b" };
  const c: BlogPillar = { ...BLOG_PILLARS[0], id: "c" };
  assert.equal(pickNextPillar(["a", "c"], [a, b, c]).id, "b");
});

test("among used pillars the least recently used wins", () => {
  const a: BlogPillar = { ...BLOG_PILLARS[0], id: "a" };
  const b: BlogPillar = { ...BLOG_PILLARS[0], id: "b" };
  // Newest-first history: "b" was used most recently, so "a" is due.
  assert.equal(pickNextPillar(["b", "a"], [a, b]).id, "a");
});

test("rotation walks the whole catalogue before repeating", () => {
  const available = availablePillars(ALL_DATA);
  const history: string[] = [];
  for (let i = 0; i < available.length; i++) {
    history.unshift(pickNextPillar(history, available).id);
  }
  assert.equal(new Set(history).size, available.length, "every pillar used exactly once");
});

test("an empty pillar list is a programming error, not a silent default", () => {
  assert.throws(() => pickNextPillar([], []), /no pillars available/);
});

// ─── Availability ───────────────────────────────────────────────────────────

test("pillars that need data they do not have are excluded", () => {
  const none = availablePillars({ hasCatalog: false, hasFaqs: false, hasRssItem: false });
  assert.equal(none.some((p) => p.requires), false, "no pillar with a requirement survives");
  assert.ok(none.length > 0, "and something is still available, so a run is always possible");
});

test("a run with no RSS item still has pillars — that is what makes RSS optional", () => {
  // The whole point of SC-04: an empty feed must not stop the blog.
  const withoutRss = availablePillars({ hasCatalog: true, hasFaqs: true, hasRssItem: false });
  assert.ok(withoutRss.length >= 6);
  assert.equal(withoutRss.some((p) => p.id === "news-analysis"), false);
});

test("the news pillar appears only when there is something to react to", () => {
  const withRss = availablePillars(ALL_DATA);
  assert.equal(withRss.some((p) => p.id === "news-analysis"), true);
});

// ─── Assignment ─────────────────────────────────────────────────────────────

test("an assignment is deterministic for the same history and seed", () => {
  const first = assignPillar([], ALL_DATA, 42);
  const second = assignPillar([], ALL_DATA, 42);
  assert.equal(first.pillar.id, second.pillar.id);
  assert.equal(first.titleStyleId, second.titleStyleId);
  assert.equal(first.length.id, second.length.id);
});

test("the title shape is always one the pillar allows", () => {
  for (let seed = 0; seed < 40; seed++) {
    const a = assignPillar([], ALL_DATA, seed);
    assert.ok(a.pillar.titleStyles.includes(a.titleStyleId), `${a.pillar.id} got ${a.titleStyleId}`);
    assert.ok(BLOG_TITLE_STYLES[a.titleStyleId], "and the shape has guidance text");
    assert.ok(a.pillar.lengths.includes(a.length.id));
  }
});

test("a pillar does not freeze onto one title shape across consecutive runs", () => {
  // The trap this guards: the seed is the job id, incrementing by 1, while the
  // rotation cycles N pillars in a stable order — so one pillar's seeds form an
  // arithmetic sequence. If gcd(N, styles) > 1, indexing by the raw seed locks
  // that pillar to a single shape forever. Hashing the seed into the pillar id
  // is what breaks it.
  const target = BLOG_PILLARS.find((p) => p.titleStyles.length > 1)!;
  const shapes = new Set<string>();
  for (let run = 0; run < 25; run++) {
    // Feed a history that keeps electing the same pillar.
    const others = BLOG_PILLARS.filter((p) => p.id !== target.id).map((p) => p.id);
    shapes.add(assignPillar(others, ALL_DATA, 100 + run * BLOG_PILLARS.length).titleStyleId);
  }
  assert.ok(shapes.size > 1, `"${target.label}" froze onto a single title shape`);
});

test("the assignment section names the pillar, the shape and the length", () => {
  const section = buildPillarSection(assignPillar([], ALL_DATA, 7));
  assert.match(section, /PAUTA DESTE POST/);
  assert.match(section, /FORMATO DO TÍTULO/);
  assert.match(section, /TAMANHO ALVO/);
  assert.match(section, /UM POST, UM ASSUNTO/);
});

// ─── Grounded sections ──────────────────────────────────────────────────────

test("an empty catalogue produces no section rather than an empty heading", () => {
  assert.equal(buildCatalogSection([]), "");
  assert.equal(buildCatalogSection(["  ", ""]), "");
});

test("the catalogue forbids inventing a service", () => {
  const section = buildCatalogSection(["Tráfego pago", "SEO"]);
  assert.match(section, /Tráfego pago; SEO/);
  assert.match(section, /Nunca escreva sobre um serviço que não está neste catálogo/);
});

test("keyword dedup is case-insensitive and drops duplicates", () => {
  const section = buildKeywordDedupSection(["SEO", "seo", " Leads ", ""]);
  assert.match(section, /seo, leads/);
});

// ─── Link sanitiser ─────────────────────────────────────────────────────────

test("an invented href loses the link but keeps the words", () => {
  const html = '<p>Veja <a href="/inventado">isto</a> e <a href="/servicos">aquilo</a>.</p>';
  const clean = sanitizeGeneratedLinks(html, ["/servicos"]);
  assert.equal(clean.includes('href="/inventado"'), false);
  assert.match(clean, /Veja isto e <a href="\/servicos">aquilo<\/a>\./);
});

test("an allowed anchor is rebuilt with href only, dropping anything else", () => {
  const html = '<a href="/servicos" target="_blank" onclick="x()">Serviços</a>';
  const clean = sanitizeGeneratedLinks(html, ["/servicos"]);
  assert.equal(clean, '<a href="/servicos">Serviços</a>');
});

test("an external URL is stripped even when it looks harmless", () => {
  const clean = sanitizeGeneratedLinks('<a href="https://example.com">fonte</a>', ["/servicos"]);
  assert.equal(clean, "fonte");
});

test("non-string input returns empty rather than throwing", () => {
  // The caller feeds this model output, where an optional field is often
  // missing entirely. Throwing here would cost the day's post.
  assert.equal(sanitizeGeneratedLinks(undefined, []), "");
  assert.equal(sanitizeGeneratedLinks(null, []), "");
});
