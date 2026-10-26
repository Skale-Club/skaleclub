import test from "node:test";
import assert from "node:assert/strict";
import { escapeLike, slugifyTitle } from "../slug.js";

test("escapeLike escapes %, _ and backslash", () => {
  assert.equal(escapeLike("100%_done\\x"), "100\\%\\_done\\\\x");
  assert.equal(escapeLike("plain"), "plain");
});

test("slugifyTitle strips accents, caps length and falls back", () => {
  assert.equal(slugifyTitle("  Aula 1: Lançamentos! "), "aula-1-lancamentos");
  assert.equal(slugifyTitle("???", { fallback: "board" }), "board");
  assert.equal(slugifyTitle("a".repeat(100), { maxLength: 80 }).length, 80);
});
