import test from "node:test";
import assert from "node:assert/strict";

import {
  BLOG_COVER_HEIGHT,
  BLOG_COVER_SAFE_AREA_PERCENT,
  BLOG_COVER_WIDTH,
  buildBlogCoverPrompt,
  pickBlogCoverVisualDirection,
} from "../cover-prompt.js";

const POST = {
  title: "Como não perder leads depois do primeiro contato",
  excerpt: "Um processo de acompanhamento para pequenas empresas.",
  metaDescription: null,
  focusKeyword: "gestão de leads",
};

test("cover prompt encodes the production image contract", () => {
  const prompt = buildBlogCoverPrompt(POST, {
    visualDirection: pickBlogCoverVisualDirection(11),
    recentCoverTitles: ["Post anterior A", "Post anterior B", "Post anterior C", "Ignorado"],
  });

  assert.match(prompt, new RegExp(`${BLOG_COVER_WIDTH} x ${BLOG_COVER_HEIGHT}`));
  assert.match(prompt, new RegExp(`${BLOG_COVER_SAFE_AREA_PERCENT}% de respiro`));
  assert.match(prompt, /84% centrais/);
  assert.match(prompt, /não repita pessoa, local, ângulo de câmera, composição, meio visual ou metáfora/i);
  assert.match(prompt, /hologramas.*circuitos neon.*robôs humanoides/is);
  assert.match(prompt, /Post anterior A/);
  assert.match(prompt, /Post anterior C/);
  assert.doesNotMatch(prompt, /Ignorado/);
});

test("three consecutive jobs receive three visibly different directions", () => {
  const directions = [20, 21, 22].map(pickBlogCoverVisualDirection);
  assert.equal(new Set(directions).size, 3);
});
