import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLegacyReviewsEmbed } from "./reviews-embed.js";

describe("legacy reviews embed parser", () => {
  it("converts an existing-style Xphere snippet into structured config", () => {
    const result = parseLegacyReviewsEmbed(`
      <div data-operator-reviews data-token="shop_ABC-123" data-layout="carousel"
        data-theme="dark" data-min-rating="5" data-limit="500" data-hero="1"
        data-hero-style="full" data-shape="square" data-equal-height="1"
        data-footer-cta="0"></div>
      <script src="https://xphere.app/reviews-widget.js"></script>
    `);

    assert.deepEqual(result, {
      type: "xphere",
      config: {
        token: "shop_ABC-123",
        layout: "carousel",
        theme: "dark",
        minRating: 5,
        sort: undefined,
        limit: 500,
        showHero: true,
        heroStyle: "full",
        cardShape: "square",
        equalHeight: true,
        footerCta: false,
      },
    });
  });

  it("accepts only allowlisted legacy iframe hosts", () => {
    const allowed = parseLegacyReviewsEmbed('<iframe src="https://widgets.reputationhub.site/reviews/123"></iframe>');
    const rejected = parseLegacyReviewsEmbed('<iframe src="https://example.com/reviews/123"></iframe>');

    assert.equal(allowed.type, "iframe");
    assert.equal(rejected.type, "invalid");
  });

  it("never accepts an arbitrary script as a widget", () => {
    const result = parseLegacyReviewsEmbed(
      '<div data-token="valid-token"></div><script src="https://example.com/payload.js"></script>',
    );

    assert.equal(result.type, "invalid");
  });

  it("parses allowlisted structured Xphere URLs", () => {
    const result = parseLegacyReviewsEmbed(
      "https://xphere.app/reviews?token=shop_123&layout=grid&theme=light&min_rating=4&limit=24&hero=0",
    );

    assert.equal(result.type, "xphere");
    if (result.type !== "xphere") return;
    assert.deepEqual(result.config, {
      token: "shop_123",
      layout: "grid",
      theme: "light",
      minRating: 4,
      sort: undefined,
      limit: 24,
      showHero: false,
      heroStyle: undefined,
      cardShape: undefined,
      equalHeight: undefined,
      footerCta: undefined,
    });
  });
});
