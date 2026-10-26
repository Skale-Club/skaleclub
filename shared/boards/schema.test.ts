import test from "node:test";
import assert from "node:assert/strict";
import { boardDocumentSchema, boardThumbnailSchema, safeUrl } from "../schema/boards.js";

const mind = (data: object) => ({ nodes: [{ id: "a", position: { x: 0, y: 0 }, data: { type: "mind", text: "x", ...data } }] });

test("only http(s) URLs are accepted", () => {
  assert.equal(safeUrl.safeParse("https://example.com/a").success, true);
  assert.equal(safeUrl.safeParse("HTTP://example.com").success, true);
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "vbscript:msgbox(1)", "ftp://example.com"]) {
    assert.equal(safeUrl.safeParse(bad).success, false, bad);
  }
});

test("mind link, mind imageUrl and image url reject unsafe schemes", () => {
  assert.equal(boardDocumentSchema.safeParse(mind({ link: "https://example.com" })).success, true);
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x"]) {
    assert.equal(boardDocumentSchema.safeParse(mind({ link: bad })).success, false, `link ${bad}`);
    assert.equal(boardDocumentSchema.safeParse(mind({ imageUrl: bad })).success, false, `imageUrl ${bad}`);
    const image = { nodes: [{ id: "i", position: { x: 0, y: 0 }, data: { type: "image", url: bad } }] };
    assert.equal(boardDocumentSchema.safeParse(image).success, false, `image ${bad}`);
  }
});

test("thumbnails accept webp, png and jpeg data URLs only", () => {
  for (const type of ["webp", "png", "jpeg"]) {
    assert.equal(boardThumbnailSchema.safeParse(`data:image/${type};base64,AAAA`).success, true, type);
  }
  assert.equal(boardThumbnailSchema.safeParse("data:image/svg+xml;base64,AAAA").success, false);
});
