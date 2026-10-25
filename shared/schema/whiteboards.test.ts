// Run: npx tsx --test shared/schema/whiteboards.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { insertWhiteboardSchema } from "./whiteboards.js";

const rectangle = { id: "a1", type: "rectangle", x: 10, y: 20, width: 100, height: 50, version: 3, isDeleted: false };

test("a saved editor scene passes as is, extra appState included", () => {
  const scene = {
    elements: [rectangle],
    appState: { viewBackgroundColor: "#ffffff", theme: "dark", gridModeEnabled: false, gridSize: 20 },
    files: { f1: { id: "f1", mimeType: "image/png", dataURL: "data:image/png;base64,AAAA", created: 1 } },
  };
  const parsed = insertWhiteboardSchema.partial().parse({ scene });
  assert.deepEqual(parsed.scene, scene);
});

test("thumbnail must be a WebP or PNG data URL, or null", () => {
  const parse = (thumbnailUrl: unknown) => insertWhiteboardSchema.partial().safeParse({ thumbnailUrl }).success;
  assert.equal(parse("data:image/webp;base64,UklGRg=="), true);
  assert.equal(parse("data:image/png;base64,iVBORw0KGgo="), true);
  assert.equal(parse(null), true);
  assert.equal(parse("https://example.com/x.png"), false);
  assert.equal(parse("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(parse(`data:image/webp;base64,${"A".repeat(1_000_000)}`), false);
});

test("title is trimmed and cannot be blank", () => {
  assert.equal(insertWhiteboardSchema.parse({ title: "  Google Ads  " }).title, "Google Ads");
  assert.equal(insertWhiteboardSchema.safeParse({ title: "   " }).success, false);
});
