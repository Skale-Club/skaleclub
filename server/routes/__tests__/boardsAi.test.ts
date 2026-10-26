import test from "node:test";
import assert from "node:assert/strict";
import { AI_MAX_OUTLINE_ITEMS, AiNotConfiguredError, limitOutline, normalizeExpandAnswer, normalizeMindmapAnswer, stripCodeFences, type BoardsAiProvider, type BoardsAiRequest } from "../boardsAi.js";
import { countOutlineItems, parseIndentedText } from "#shared/boards/outline.js";
import { createBoardsApp, installMemoryBoards, listen } from "./helpers/boardsHarness.js";

type Call = (method: string, path: string, body?: unknown, admin?: boolean) => Promise<{ status: number; json: any }>;

// A provider that answers with `answer` (or throws) and records what it was asked.
function stubProvider(answer: string | Error, configured = true) {
  const requests: BoardsAiRequest[] = [];
  const provider: BoardsAiProvider = {
    async isConfigured() {
      return configured;
    },
    async complete(request) {
      requests.push(request);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
  return { provider, requests };
}

async function withAi(provider: BoardsAiProvider, fn: (call: Call) => Promise<void>) {
  installMemoryBoards();
  const { server, baseUrl } = await listen(createBoardsApp({ ai: provider }));
  const call: Call = async (method, path, body, admin = true) => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(admin ? { "x-test-admin": "1" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };
  try {
    await fn(call);
  } finally {
    server.close();
  }
}

test("code fences are stripped, with or without chatter before them", () => {
  assert.equal(stripCodeFences("```markdown\n- A\n  - B\n```"), "- A\n  - B");
  assert.equal(stripCodeFences("Here you go:\n```\n- A\n```\nEnjoy!"), "- A");
  assert.equal(stripCodeFences("- A\n- B"), "- A\n- B");
  assert.equal(stripCodeFences("```\n- A\n- B"), "- A\n- B", "an unclosed fence");
});

test("a mind map answer becomes one rooted, depth- and size-limited outline", () => {
  const answer = "```\n- **Marketing**\n  - Ads\n    - Google\n      - Too deep\n  - SEO\n```";
  assert.equal(normalizeMindmapAnswer(answer, "Marketing", { depth: 2 }), "- Marketing\n  - Ads\n    - Google\n  - SEO");
  // Several top-level items hang under the topic.
  assert.equal(normalizeMindmapAnswer("- Ads\n- SEO", "Marketing", { depth: 2 }), "- Marketing\n  - Ads\n  - SEO");
  // Nothing usable.
  assert.equal(normalizeMindmapAnswer("", "x", { depth: 2 }), null);
  assert.equal(normalizeMindmapAnswer("- Lonely", "x", { depth: 2 }), null);

  const huge = ["- Root", ...Array.from({ length: 10 }, (_, i) => [`  - B${i}`, ...Array.from({ length: 30 }, (_, j) => `    - B${i}.${j}`)]).flat()].join("\n");
  const limited = parseIndentedText(normalizeMindmapAnswer(huge, "Root", { depth: 3 })!);
  assert.equal(countOutlineItems(limited), AI_MAX_OUTLINE_ITEMS);
  assert.equal(limited[0].children.length, 10, "every branch survives the cut (breadth first)");
  assert.equal(limitOutline([], { maxDepth: 2, maxItems: 5 }).length, 0);
});

test("expand answers drop duplicates, the node itself and extras", () => {
  const answer = "- Email\n- email\n- Social\n- Ads\n- Events\n- Partners\n- Print\n- Radio";
  assert.deepEqual(normalizeExpandAnswer(answer, ["Marketing", "Ads"], 4), ["Email", "Social", "Events", "Partners"]);
  assert.deepEqual(normalizeExpandAnswer("- Ads", ["Ads"], 4), []);
});

test("GET /status reports whether a provider is configured; all routes are admin only", () =>
  withAi(stubProvider("- A").provider, async (call) => {
    assert.deepEqual((await call("GET", "/api/boards/ai/status")).json, { enabled: true });
    assert.equal((await call("GET", "/api/boards/ai/status", undefined, false)).status, 401);
    for (const path of ["mindmap", "expand", "summarize"]) {
      assert.equal((await call("POST", `/api/boards/ai/${path}`, { topic: "x", outline: "- x" }, false)).status, 401, path);
    }
  }));

test("status is false without a provider, and the generators answer 503", () =>
  withAi(stubProvider(new AiNotConfiguredError(), false).provider, async (call) => {
    assert.deepEqual((await call("GET", "/api/boards/ai/status")).json, { enabled: false });
    const res = await call("POST", "/api/boards/ai/mindmap", { topic: "Marketing" });
    assert.equal(res.status, 503);
    assert.match(res.json.message, /Integrations/);
  }));

test("POST /mindmap asks for the requested shape and returns a clean outline", () => {
  const { provider, requests } = stubProvider("```markdown\n- Marketing\n  - Ads\n  - SEO\n```");
  return withAi(provider, async (call) => {
    const res = await call("POST", "/api/boards/ai/mindmap", { topic: "  Marketing  ", language: "pt", depth: 3, maxChildren: 4 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { outline: "- Marketing\n  - Ads\n  - SEO" });
    assert.equal(requests.length, 1);
    assert.match(requests[0].system, /3 levels/);
    assert.match(requests[0].system, /at most 4 children/);
    assert.match(requests[0].system, /Portuguese/);
    assert.equal(requests[0].user, "Topic: Marketing");

    assert.equal((await call("POST", "/api/boards/ai/mindmap", {})).status, 400);
    assert.equal((await call("POST", "/api/boards/ai/mindmap", { topic: "x", depth: 5 })).status, 400);
    assert.equal((await call("POST", "/api/boards/ai/mindmap", { topic: "x".repeat(301) })).status, 400);
    assert.equal(requests.length, 1, "invalid bodies never reach the model");
  });
});

test("POST /mindmap: an unusable answer is 422 and a provider failure is 502", async () => {
  await withAi(stubProvider("sorry, I cannot").provider, async (call) => {
    assert.equal((await call("POST", "/api/boards/ai/mindmap", { topic: "x" })).status, 422);
  });
  const quiet = console.error;
  console.error = () => undefined;
  try {
    await withAi(stubProvider(new Error("upstream 500")).provider, async (call) => {
      const res = await call("POST", "/api/boards/ai/mindmap", { topic: "x" });
      assert.equal(res.status, 502);
      assert.doesNotMatch(JSON.stringify(res.json), /upstream/, "provider errors are not leaked");
    });
  } finally {
    console.error = quiet;
  }
});

test("POST /expand returns new short children, never the existing ones", () => {
  const { provider, requests } = stubProvider("- Ads\n- Email\n- Social\n- Events\n- Partners");
  return withAi(provider, async (call) => {
    const res = await call("POST", "/api/boards/ai/expand", { topic: "Marketing", path: ["Plan", "Marketing"], existing: ["Ads"], count: 3 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { children: ["Email", "Social", "Events"] });
    assert.match(requests[0].user, /Plan > Marketing/);
    assert.match(requests[0].user, /do not repeat\): Ads/);
    assert.equal((await call("POST", "/api/boards/ai/expand", { topic: "x", count: 9 })).status, 400);
  });
});

test("POST /summarize returns the model's text without fences", () => {
  const { provider, requests } = stubProvider("```\nA plan.\n- One\n- Two\n```");
  return withAi(provider, async (call) => {
    const res = await call("POST", "/api/boards/ai/summarize", { outline: "- Plan\n  - One\n  - Two", language: "en" });
    assert.equal(res.status, 200);
    assert.equal(res.json.summary, "A plan.\n- One\n- Two");
    assert.equal(requests[0].user, "- Plan\n  - One\n  - Two");
    assert.equal((await call("POST", "/api/boards/ai/summarize", { outline: "   " })).status, 400);
  });
});

test("the AI routes are rate limited per client", () =>
  withAi(stubProvider("- Root\n  - A").provider, async (call) => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call("POST", "/api/boards/ai/mindmap", { topic: "x" })).status;
    assert.equal(last, 429);
  }));
