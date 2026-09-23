# NFC keychains landing v2

Started 2026-09-22 after Vanildo's review of /br/nfc-keychains ("muito errada e mal diagramada").

## Decisions (Vanildo)

- The price is delivered in the order form (live preview) and confirmed on WhatsApp.
  No price table on any NFC page. One entry-price line is fine: "from $10".
- Keychain styles: **Flat** (list price), **Raised relief** and **Custom shape**
  (no list price: quoted on WhatsApp). Answered in the FAQ and asked in the form.

## What changed

- `/nfc-keychains` (+ `/br`) is the single selling page, all on the navy surface:
  dark product hero (copy left, product right; product first on phones) →
  badge band (full-bleed, no container steps) → "What the tap opens" (6 cards) →
  "Where to use it" (4 cards) → how it works (anchor `#how-it-works`) → FAQ → closing band.
- Google reviews section removed: every review was about websites.
- `/nfc-pricing` (+ PT shapes) 301 → `/nfc-keychains` (`server/canonicalHost.ts`);
  its page rows are deactivated, not deleted.
- `/nfc-order`: price table removed, secondary link → landing, dark hero.
- `shared/nfc-pricing.ts`: three active types; `quoteOnRequest` types show
  "Price confirmed on WhatsApp", freeze "On request (WhatsApp)" in the lead
  snapshot and Telegram alert, and send no order value to Meta/GA4.
- Entry price copy comes from `nfcPriceCopy()` in `shared/nfc-price-lines.ts`, used by
  both the landing seed and the translation seed.
- Dark section theme moved from neutral #0f1014/#111 to navy (`DARK_SURFACE`); only NFC pages use it.
- New section type `featureGrid`.

## Deploy order

Code first, then seeds (the old code rejects `#how-it-works` in the hero):

1. push → Coolify deploy
2. `npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts`
3. `npx tsx --env-file=.env scripts/seed-nfc-order-page.ts`
(Translations were seeded before deploy: additive rows only.)

## Open

- Relief could get a list price later: set `quoteOnRequest: false` and a `priceMultiplier`.
- `/nfc-order` copy still has two em-dashes (strings keyed by their PT translation rows).
