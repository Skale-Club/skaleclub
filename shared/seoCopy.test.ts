import assert from "node:assert/strict";
import test from "node:test";
import { CORE_SEO } from "./coreSeo.js";
import { LANDING_SEO, getLandingSeo } from "./landingSeo.js";

// The crawl rules from the SEO plan: no duplicate titles across pages or across the
// EN/PT pair, and no description too thin to use as a search snippet.
const MIN_DESCRIPTION = 110;
const MAX_DESCRIPTION = 165;

function entries() {
  const rows: Array<{ id: string; title: string; description: string }> = [];
  for (const [key, entry] of Object.entries(CORE_SEO)) {
    for (const lang of ["en", "pt"] as const) {
      const copy = entry[lang];
      // /links has no Portuguese twin (it is not paired), so its pt copy is never served.
      if (key === "links" && lang === "pt") continue;
      if (copy) rows.push({ id: `core:${key}:${lang}`, title: copy.title, description: copy.description });
    }
  }
  for (const slug of Object.keys(LANDING_SEO)) {
    const seo = getLandingSeo(slug)!;
    rows.push({ id: `landing:${slug}`, title: seo.title, description: seo.description });
  }
  return rows;
}

test("every title and description fits a search result", () => {
  for (const row of entries()) {
    assert.ok(row.description.length >= MIN_DESCRIPTION, `${row.id}: description is ${row.description.length} characters`);
    assert.ok(row.description.length <= MAX_DESCRIPTION, `${row.id}: description is ${row.description.length} characters`);
  }
});

test("no two pages share a title, and no EN/PT pair does either", () => {
  const seen = new Map<string, string>();
  for (const row of entries()) {
    const other = seen.get(row.title);
    assert.equal(other, undefined, `${row.id} repeats the title of ${other}: "${row.title}"`);
    seen.set(row.title, row.id);
  }
});

test("inner pages are keyword-first, only the Portuguese home is brand-first", () => {
  for (const row of entries()) {
    if (row.id === "core:home:pt") assert.match(row.title, /^Skale Club \| /);
    else assert.match(row.title, / \| Skale Club$/, row.id);
  }
});

test("the Portuguese apps page is called Aplicativos", () => {
  assert.equal(CORE_SEO.apps.pt.title, "Aplicativos | Skale Club");
  assert.equal(CORE_SEO.apps.crumb.pt, "Aplicativos");
});
