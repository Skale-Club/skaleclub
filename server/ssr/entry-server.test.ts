import { strict as assert } from "node:assert";
import { after, afterEach, before, describe, it } from "node:test";
import { createServer, type ViteDevServer } from "vite";
import { hasMainContent, injectHydrationState, MIN_MAIN_CONTENT_TEXT_CHARS } from "../ssr-react.js";

// The entry is loaded through Vite, the way server/vite.ts loads it in development: the
// client sources rely on Vite's aliases, `import.meta.env` and asset handling, which plain
// tsx lacks. The production bundle is a build of the same file.
type EntryServer = typeof import("../../client/src/entry-server.js");
let vite: ViteDevServer;
let renderPage: EntryServer["renderPage"];
let specsForRoute: EntryServer["specsForRoute"];

before(async () => {
  vite = await createServer({ configFile: "vite.config.ts", server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  ({ renderPage, specsForRoute } = (await vite.ssrLoadModule("/src/entry-server.tsx")) as EntryServer);
});
after(async () => {
  await vite.close();
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const ORIGIN = "http://127.0.0.1:7000";

const settings = {
  companyName: "Skale Club",
  socialLinks: [],
  heroTitle: "Automation for growing businesses",
  homepageContent: {},
  pageSlugs: null,
};

const post = {
  id: 1,
  slug: "hello",
  title: "Hello Post",
  excerpt: "A short excerpt",
  content: "<p>Body text of the post.</p>",
  status: "published",
  authorName: "Skale",
  publishedAt: "2026-01-01T00:00:00.000Z",
  tags: [],
  featureImageUrl: null,
};

const baseRoutes: Record<string, unknown> = {
  "/api/company-settings": settings,
  "/api/portfolio-services": [],
  "/api/faqs": [{ id: 1, question: "What do you do?", answer: "We automate the busywork." }],
  "/api/blog?status=published&limit=3&offset=0": [post],
  "/api/blog?status=published&limit=9&offset=0": [post],
  "/api/blog/hello": post,
  "/api/translations/preload?lang=pt": { translations: { "What do you do?": "O que voces fazem?" } },
};

/** Answers the loopback API from `routes`; anything else is a 404. Returns the requests seen. */
function mockApi(routes: Record<string, unknown> = baseRoutes) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const key = url.pathname + url.search;
    seen.push(key);
    if (key in routes) {
      return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  }) as typeof fetch;
  return seen;
}

const h1Of = (html: string) => /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1].replace(/<[^>]+>/g, "").trim();

const landing = (heading: string) => ({
  slug: "websites",
  name: "Websites",
  isActive: true,
  language: "en",
  alternateSlug: null,
  sections: [{ type: "faqAccordion", props: { heading, items: [{ question: "Landing Q?", answer: "Landing A." }] } }],
});

describe("renderPage: the route's own content is in the HTML", () => {
  it("home renders a heading", async () => {
    mockApi();
    const { html } = await renderPage({ url: "/", origin: ORIGIN });
    assert.ok(hasMainContent(html));
    assert.ok(h1Of(html), "no <h1>");
  });

  it("FAQ renders the questions the API returned", async () => {
    mockApi();
    const { html } = await renderPage({ url: "/faq", origin: ORIGIN });
    assert.match(html, /What do you do\?/);
  });

  it("blog index and post render the prefetched articles", async () => {
    mockApi();
    const index = await renderPage({ url: "/blog", origin: ORIGIN });
    assert.match(index.html, /Hello Post/);
    const detail = await renderPage({ url: "/blog/hello", origin: ORIGIN });
    assert.match(detail.html, /Body text of the post\./);
  });

  it("every catalog route renders a heading", async () => {
    mockApi();
    for (const url of ["/portfolio", "/apps", "/services", "/products", "/contact", "/privacy-policy", "/terms-of-service", "/skale-hub", "/nfc-guide"]) {
      const { html } = await renderPage({ url, origin: ORIGIN });
      assert.ok(h1Of(html), `${url} has no <h1>`);
    }
  });

  it("a managed landing renders its sections", async () => {
    mockApi({ ...baseRoutes, "/api/pages/slug/websites": landing("Landing questions") });
    const { html } = await renderPage({ url: "/websites", origin: ORIGIN });
    assert.match(html, /Landing questions/);
    assert.match(html, /Landing Q\?/);
  });

  it("a landing that does not exist renders the not-found page, never a blank one", async () => {
    // server/seo/shell.ts only asks for a render when resolveRoute() said 200, so this is
    // the fail-open case (the route lookup failed): the page must still say what it is.
    mockApi();
    const { html } = await renderPage({ url: "/no-such-landing", origin: ORIGIN });
    assert.equal(h1Of(html), "Page Not Found");
  });

  it("a Portuguese landing with no -br row falls back to the base row, and the browser is told", async () => {
    mockApi({ ...baseRoutes, "/api/pages/slug/websites": landing("Base heading") });
    const result = await renderPage({ url: "/br/websites", origin: ORIGIN });
    assert.match(result.html, /Base heading/);
    // The -br query failed on the server. The browser has to see that it failed, or its
    // first render would wait on a pending query and disagree with this HTML.
    const keys = result.dehydratedState.queries.map((query) => JSON.stringify(query.queryKey));
    assert.ok(keys.includes(JSON.stringify(["/api/pages/slug/websites-br"])), keys.join(","));
  });
});

describe("renderPage: language", () => {
  it("Portuguese pages use the cached translations and report the ones they used", async () => {
    mockApi();
    const result = await renderPage({ url: "/br/faq", origin: ORIGIN });
    assert.match(result.html, /O que voces fazem\?/);
    assert.equal(result.translations["What do you do?"], "O que voces fazem?");
  });

  it("English pages never ask for translations", async () => {
    const seen = mockApi();
    const result = await renderPage({ url: "/faq", origin: ORIGIN });
    assert.deepEqual(result.translations, {});
    assert.ok(!seen.some((key) => key.startsWith("/api/translations")));
  });

  it("links keep the /br prefix on Portuguese pages", async () => {
    mockApi();
    const { html } = await renderPage({ url: "/br/faq", origin: ORIGIN });
    assert.match(html, /href="\/br\/services"/);
  });
});

describe("renderPage: isolation and failure", () => {
  it("does not share data between concurrent renders", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const key = url.pathname + url.search;
      const body =
        key === "/api/company-settings"
          ? { ...settings, companyName: url.port === "7001" ? "Company A" : "Company B" }
          : (baseRoutes[key] ?? {});
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const [a, b] = await Promise.all([
      renderPage({ url: "/faq", origin: "http://127.0.0.1:7001" }),
      renderPage({ url: "/faq", origin: "http://127.0.0.1:7002" }),
    ]);
    assert.ok(a.html.includes("Company A") && !a.html.includes("Company B"));
    assert.ok(b.html.includes("Company B") && !b.html.includes("Company A"));
  });

  it("rejects when the render cannot finish, so the caller serves the text fallback", async () => {
    globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
    await assert.rejects(renderPage({ url: "/faq", origin: ORIGIN }), /timed out/);
  });
});

describe("specsForRoute", () => {
  it("honours custom page slugs", () => {
    const keys = specsForRoute("/questions", { faq: "questions" }).map((spec) => spec.queryKey[0]);
    assert.ok(keys.includes("/api/faqs"));
  });
  it("prefetches only the layout for unknown deep paths", () => {
    assert.equal(specsForRoute("/a/b/c").length, 2);
  });
});

describe("hasMainContent", () => {
  it("accepts a heading, or enough text without one", () => {
    assert.equal(hasMainContent("<nav>menu</nav><h1>Title</h1>"), true);
    assert.equal(hasMainContent("<h2>FAQ</h2>"), true);
    assert.equal(hasMainContent(`<p>${"word ".repeat(MIN_MAIN_CONTENT_TEXT_CHARS)}</p>`), true);
  });
  it("rejects the layout alone", () => {
    assert.equal(hasMainContent("<nav>Home Apps Services</nav><footer>Privacy</footer>"), false);
    assert.equal(hasMainContent(`<script>${"x".repeat(2000)}</script><nav>menu</nav>`), false);
  });
});

describe("injectHydrationState", () => {
  it("inlines the state before </body> without a script breakout", () => {
    const html = injectHydrationState('<body><div id="root"></div></body>', {
      dehydratedState: { queries: [{ data: "</script><script>alert(1)</script> $& end" }] },
      translations: { a: "b" },
    });
    assert.ok(html.indexOf("__REACT_QUERY_STATE__") < html.indexOf("</body>"));
    assert.ok(html.includes("__SSR_TRANSLATIONS__"));
    assert.equal((html.match(/<\/script>/g) ?? []).length, 2, "the payload must not close the script tag early");
    assert.ok(html.includes("$&"), "replacement patterns in the payload stay literal");
  });
  it("omits the translations tag when there are none", () => {
    const html = injectHydrationState("<body></body>", { dehydratedState: {}, translations: {} });
    assert.ok(!html.includes("__SSR_TRANSLATIONS__"));
  });
});
