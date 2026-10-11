# Public Section Inventory

Updated 2026-10-11. This inventory classifies public page bands by structural
role. It is maintained alongside `PUBLIC_SECTION_TEMPLATE_SYSTEM.md` and is the
first place to check before introducing a new spacing exception.

## Route families

| Route family | Hero | Main bands | Smaller/special bands |
|---|---|---|---|
| Homepage `/` | `homepage` | services, our services, reviews, blog, about, areas served — `editorial` | hero trust badges — `bridge` |
| Managed landing `/:slug`, `/products/:slug` | `split-landing`, `dark-product`, or `campaign-form` | registered content templates — definition role | trust badges `compact`, link callout `pill`, lead form `cta` |
| Portfolio `/portfolio`, `/apps`, `/services`, `/products` | `portfolio` | group sections `editorial`; repeated rows `dense` | closing conversion band `cta` |
| Blog `/blog`, `/blog/:slug` | `editorial-header` or `blog-post` | listing and article body `editorial` | none |
| Content `/faq`, `/contact`, privacy, terms | `editorial-header` | body `editorial` | none |
| NFC guide `/nfc-guide` | `dark-product` | guide chapters `editorial` | sticky sub-navigation is layout chrome, not a content section |
| Skale Hub and WhatsApp campaigns | `campaign-form` | composition-owned form/content | pills inside the hero remain micro-components |

## Registered managed templates

The authoritative list, labels, roles, versions, content ownership, and Zod
schemas live in `shared/section-definitions.ts`. The current classifications
are:

| Role/family | Templates |
|---|---|
| Hero | `hero`, `heroWebsites`, `whatsappGroup` |
| Editorial | `services`, `ourServices`, `reviews`, `blog`, `about`, `areasServed`, `processStepper`, `pricingTable`, `faqAccordion`, `contentBlocks`, `featureGrid`, `pricingPlans` |
| Compact | `trustBadges` |
| Pill | `linkCallout` |
| CTA | `leadFormCta` |

## Intentional exceptions

- Homepage trust badges straddle the hero and first content band. The homepage
  composition owns their vertical placement; they do not receive editorial
  padding.
- Hero variants own navbar clearance, viewport height, image geometry, and
  bottom handoff. Direct top/bottom utilities are permitted only inside those
  named variants.
- Sticky guide navigation, the site header, footer, mobile action bar, and
  floating WhatsApp control are layout chrome and do not receive section roles.
- Card, list-row, accordion-item, button, badge, and pill padding is internal
  component spacing and is not part of the section-frame audit.

## Audit procedure

1. Check rendered page order against this inventory.
2. Inspect every outer band for `data-section-role`.
3. Confirm ordinary frames obtain padding from `section-tokens.css` only.
4. Treat a hero or bridge override as valid only when its named variant is
   documented here and in the maintenance guide.
5. Run `npm test`, `npm run check`, and `npm run build` before release review.

## Canonical implementation

- Role values: `client/src/styles/section-tokens.css`
- Outer frame and hero variants: `client/src/components/editorial/SectionFrame.tsx`
- Managed-template contracts: `shared/section-definitions.ts`
- React renderer binding: `client/src/components/pages/sectionRegistry.ts`
- Generated admin composer: `client/src/components/admin/pages/SectionComposer.tsx`
- Legacy review compatibility: `shared/reviews-embed.ts`

Do not duplicate any of these lists or values inside a page component.
