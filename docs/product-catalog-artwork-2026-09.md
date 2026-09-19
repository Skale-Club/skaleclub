# Product catalog artwork — September 2026

Every product card follows one visual rule: an official product mark plus a real
desktop capture of the live website, composed by the catalog UI inside its
browser frame. No product logo or interface in this set is AI-generated.

## Sources

| Product | Website captured | Logo source |
| --- | --- | --- |
| Xareable | `https://xareable.com` | Existing official Xareable brand mark |
| Xsites | `https://mvpbuildergroup.com` | Skale Club Websites platform favicon |
| Xkedule | `https://xkedule.com` | Current Xkedule `XK` gradient favicon |
| XmartMenu | `https://xmartmenu.skale.club` | Current live XmartMenu platform favicon |
| Xphere | `https://xphere.app` | Xphere repository brand icon |
| Xtimator | `https://xtimator.com` | Xtimator repository app icon |

Xsites is a multi-tenant website platform. Its platform origin opens the private
administration login, so its cover uses a real customer site produced by the
platform. This demonstrates the product instead of exposing an internal login
screen.

## Capture contract

- Captured from a desktop viewport (1440 × 900; Xphere uses the 1270 px
  in-app browser viewport), then normalized to 1200 px wide and at most
  2400 px tall. Each page was scrolled before capture so lazy and animated
  sections were visible in the exported image.
- WebP quality 80 keeps the six captures between roughly 74 KB and 213 KB.
- Captured from the public live pages on 2026-09-18/19.
- Stored as WebP under `client/public/product-assets/catalog-2026-09/`.
- Cards use the shared browser-frame treatment. Product modals show the real
  long front page directly, anchored to the top and clipped by the full-height
  visual panel, without a second nested browser frame.
- The production bootstrap task only replaces empty fields and the documented
  legacy assets; an unexpected later admin upload is preserved.

## Verified internal screens

The product popup now uses its carousel for the verified screens below. Captures
are genuine interfaces, not AI-generated dashboard mockups. Images were cropped
only to remove demo chrome or unused viewport space, then resized to 1200 px
wide and exported as WebP. No customer lead names, emails, or private records
are included.

| Product | Internal screen source | Asset |
| --- | --- | --- |
| Xsites | Tenant website editor, `skaleclub-websites/tests/visual/admin-dark-mode.spec.ts-snapshots/admin-website-sections-dark.png` | `websites-dashboard.webp` |
| Xkedule | Public read-only Cuts & Culture demo, `https://xkedule.com/demo?view=admin` | `scheduling-system-dashboard.webp` |
| XmartMenu | Public Bella Vista demo, `https://xmartmenu.skale.club/demo`, then `/dashboard` in the demo session | `smart-menu-dashboard.webp` |
| Xtimator | Local read-only demo at `http://demo.localhost:9634/dashboard`, using the project's configured sample workspace | `xtimator-dashboard.webp` |

No internal capture is assigned yet to Xareable or Xphere. Xareable
has no public demo or checked-in dashboard screenshot. Xphere's `/demo` returns
a broken redirect to `0.0.0.0:3000/`. Xtimator's public `/demo/entry` returns
503 and the configured `demo.xtimator.com` hostname is not published, but its
local demo session works against the dedicated sample workspace. XmartMenu's
`/demo` also redirects to `0.0.0.0:3000/dashboard`, but its public demo session
was accessed without following that redirect, then the genuine dashboard was
opened on the correct host. Fixing those separate apps' demo routing is not part
of this catalog artwork change.

A product with only `homeImageUrl` continues to show its current top-anchored
front page, without empty slides or carousel controls.

When another verified internal screenshot is available, add it through the
product admin's `dashboardImageUrl` field. The popup displays the homepage
first, the dashboard second, and any `popupSliderImages` after it. These images
remain out of the print cover. Gallery controls support clicks, keyboard arrows
while focused, and reduced-motion preferences. Do not use invented dashboards
or customer data without approval; capture a legitimate demo or approved
account. The production bootstrap assigns the four packaged captures only
when the dashboard field is empty, preserving later admin choices.
