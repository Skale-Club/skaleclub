# /portfolio redesign v4 (reference: salesforge.ai)

Started 2026-09-22. Built step by step; each step is previewed locally and
approved by Vanildo before the next one starts. Nothing ships without approval.

Brand stays: navy `#0A162E` + CTA blue `#5173D6` (`--cta`), no purple/yellow,
hairline borders, Outfit/Inter. Take the *structure* from Salesforge, not the look.

## Status

| # | Step | Status |
|---|------|--------|
| 1 | Pillars row | approved (not deployed) |
| 2 | Catalog: `headline` field + Xcraper + Xpot | DB applied 2026-09-22; code in review (not deployed) |
| 3 | App blocks | todo |
| 4 | Hero polish + app logo strip with hover card | todo |
| 5 | Final CTA | todo |

## 1. Pillars row

Replaces the 3 trust badges (Fast Implementation / Enterprise Security /
Proven Results) **on /portfolio only**. Those badges are `homepageContent.trustBadges`,
shared with the home page, so the pillars are static page copy via `t()`.

No order, no arrows, no numbers, no app names. Same row format (line icon, title, one line).

| Icon | EN | PT |
|------|----|----|
| target | **Prospect** | Find the right businesses and reach them first / **Prospectar** Encontre as empresas certas e chegue nelas primeiro |
| magnet | **Attract** | Get found online and stay active where customers look / **Atrair** Seja encontrado online e esteja ativo onde o cliente procura |
| handshake | **Convert** | Follow up, book and quote before the lead goes cold / **Converter** Faça o follow-up, agende e orce antes do lead esfriar |

## 2. Catalog

- New `headline` field on portfolio services (benefit title, one part highlighted), editable in admin.
- Description: 2 sentences, max ~180 chars.
- Add **Xcraper**: CRM & Sales, "Google Maps Lead Finder", $9.90 /month (500 credits), xcraper.skale.club.
  Headline "Thousands of leads **from Google Maps**". Features: Google Maps data · AI email discovery · Export.
- Add **Xpot**: CRM & Sales, "Field Sales Companion", no price: show **"Start here"** (PT "Comece aqui")
  instead of price. xpot.skale.club. Headline "Every field visit **logged and synced**".
  Features: GPS check-in · AI voice notes · CRM sync.
- Headline drafts:
  - Xareable: Your social media **on autopilot**
  - Xsites: A professional website **live in 3 days**
  - Xkedule: **Never miss** a booking
  - Xphere: Every lead **followed up automatically**
  - Xtimator: Send the estimate **before you leave the site**
  - XmartMenu: Your menu **on the customer's phone**
- Writes to prod DB need explicit approval.
- Catalog order by importance: Xkedule, Xtimator, Xphere, Xareable, Xsites, Xcraper, Xpot, XmartMenu.
- Applied via `supabase/migrations/20260922120000_portfolio_headline_xcraper_xpot.sql`.
- Existing descriptions kept (already ~2 sentences); headlines render from step 3 on.

## 3. App blocks (the part that bothers most)

- No outer card; blocks separated by a hairline, image side alternates.
- Text: category eyebrow → icon + name (small, as a label) → big headline with highlighted part
  → 2-sentence description → price (or "Start here") + "See details".
- Image: one large app screen on a navy→blue gradient panel, no triple frame.

## 4. Hero

- Keep current structure (centered copy + screenshot reel); polish only:
  blue glow rising from the bottom, bigger/cleaner reel shots.
- New strip with every app's icon + name (like Salesforge "Trusted by" row), hairline cells, ↗ corner.
- Hover: icon blurs, blue ↗ circle appears, a card rises above the cell with icon + name,
  headline, description, price, "See details". Click opens CatalogDetail. Mobile: tap opens detail.

## 5. Final CTA

- Same button ("Book a Strategy Session") + WhatsApp. No email field.
- Two columns, full-bleed band, strong gradient, large composition of app screens on the right.

## Out of scope (decided)

Case studies, AI lead magnet, "human vs agent" hero, demo proposal, cropped UI fragments (for now).
