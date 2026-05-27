-- Estimate Guidelines singleton — mirrors brand_guidelines pattern from Phase 17
-- Holds the playbook MCP tools fetch BEFORE building or editing any estimate.
CREATE TABLE IF NOT EXISTS estimate_guidelines (
  id         SERIAL PRIMARY KEY,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial content distilled from the Vita Cell MedSpa build.
-- Markdown — read by the AI as a single document.
INSERT INTO estimate_guidelines (content)
SELECT $md$
# Skale Club | Estimate Building Playbook

Always read this before building or editing an estimate. These rules + the standard catalog cover ~90% of cases.

---

## Hard rules (never break these)

1. **No em-dashes (—)** in any client-facing copy (title, subtitle, description, features, section). Always use pipes (`|`) as separator. Em-dashes are still fine in internal comments and git messages.
2. **Never invent prices.** Use the standard catalog below, or ask the user before adding a price you do not have. If a price is variable ("custom quote"), say so explicitly.
3. **Title is short.** Brand name only ("Xphere CRM + AI Assistants"). Put secondary content like "Voice & Text" or "Scheduling System" in the `subtitle` field, never jammed in the title with parentheses or em-dashes.
4. **Write EN first.** When the deck is structurally final, call `estimates_translate_to_pt` to populate PT fields. Do not write PT manually.
5. **Catalog vs custom:** call `portfolio_services_list` first. If the service requested exists there, use `type: "catalog"` with the matching `sourceId`. Otherwise `type: "custom"`. Custom is the common case for one-off requests.

---

## Section taxonomy (use these labels exactly)

Three standard sections cover most estimates. Custom labels only when the user asks.

- **`Foundation`** | `sectionPt: "Base"` — the essential start. Marketing consultation, website, Google Business Profile. The "if you take nothing else, take these" tier.
- **`Growth Engine`** | `sectionPt: "Motor de Crescimento"` — ongoing growth levers. Paid Media, AI Blog, Xkedule scheduling. Add when the client is ready to scale.
- **`Must Have`** | `sectionPt: "Essencial"` — bundled critical infrastructure with required external dependencies. Currently just the Xphere CRM + AI Assistants bundle.

Order in the deck: Foundation first, Growth Engine second, Must Have last (closes the pitch with the bundle that anchors operations).

---

## Standard service catalog with confirmed prices

These are the verified prices used on real client estimates. Reuse them unless the user explicitly changes them.

### Foundation tier

| Service | Title | Subtitle | Price | Notes |
|---|---|---|---|---|
| Marketing Consultation | `Marketing Consultation` | `Weekly strategy + always-on support` | `$600/month` | $150/session, 4 sessions/month, 1 hour each. Always-on availability between sessions for feedback. Includes content direction, brand positioning, growth strategy, personal brand coaching. |
| Website | `Website` | `Custom-built, AI-ready, owned by you` | `$900 one-time + $15/month hosting` | Built from scratch, optimized for AI search. Client owns it forever. Maintenance billed per request (do NOT promise turnaround time). |
| Google Business Profile Optimization | `Google Business Profile Optimization` | `Show up on Google Maps and local search` | `$150 one-time` | Keyword optimization, service categories, hours, photos. NOT setup (that requires owner video proof). |

### Growth Engine tier

| Service | Title | Subtitle | Price | Notes |
|---|---|---|---|---|
| Paid Media Management | `Paid Media Management` | `Meta + Google Ads` | `$399/month per channel` | Each channel priced separately. Meta is primary for MedSpa / visual-heavy industries. Ad spend paid directly to platforms, recommended $1000 to $2000/month total. |
| AI Blog Engine | `AI Blog Engine` | `Automated SEO content production` | `$59/month` | 1 article per day (about 30/month). Optimized for Google + AI search (ChatGPT, Perplexity). Lowest-priority slide, mention but do not push. |
| Xkedule | `Xkedule` | `Scheduling System` | `$299 setup + $89/month` | Proprietary AI-powered scheduling by Skale Club. Full setup + onboarding included. |

### Must Have tier

| Service | Title | Subtitle | Price | Notes |
|---|---|---|---|---|
| Xphere CRM + AI Assistants | `Xphere CRM + AI Assistants` | `Voice & Text` | `$299 setup + $79/month` | Bundled CRM + AI voice + AI text assistants. ManyChat ($15/mo) + dedicated Twilio number (~$20/mo) are required externals, included in the monthly price. AI text covers SMS, Instagram, Facebook Messenger. |

---

## Copywriting voice

- Warm, confident, results-oriented. Never salesy or generic.
- Avoid filler openers ("In today's dynamic landscape...", "We believe that...", "Reach out to discuss next steps").
- Each feature bullet must be specific to the actual service, not corporate filler ("Strategic Alignment", "Operational Efficiency").
- Personalize cover slide with the lead's name (e.g. "Adriane Shahraki" below "Vita Cell MedSpa") when available.

### Standard slides

- **Cover:** `proposalFor` label, large company name, optional contact name as subtitle, Skale Club logo at bottom (clickable to skale.club).
- **About (intro slide, auto-rendered):** "Skale Club is a company that helps businesses automate growth, close more deals, and deliver standout client experiences."
- **Closing (auto-rendered):** `Let's grow your business.` / `Ready when you are.` (EN). `Vamos fazer seu negócio crescer.` / `Quando você estiver pronto, nós estamos.` (PT).

---

## Tool usage flow (typical)

1. `estimate_guidelines_get()` — read this doc
2. `portfolio_services_list()` — see if requested services exist in catalog
3. `estimates_create(...)` — create blank estimate with client name + slug
4. `estimates_add_service(...)` — add each service one at a time (use `type: "catalog"` with sourceId for catalog items, `type: "custom"` for one-offs)
5. `estimates_update_service(id, index, patch)` — iterate on individual services as the user gives feedback
6. `estimates_reorder_service(id, fromIdx, toIdx)` — adjust order if needed
7. `estimates_translate_to_pt(id)` — populate all PT fields when the deck is final
8. Send `https://skale.club/e/<slug>` to the user

---

## Anti-patterns to avoid

- Putting "(Voice & Text)" inside the title — use `subtitle` instead.
- Writing "Xkedule — Scheduling System" with em-dash — use title `Xkedule` + subtitle `Scheduling System`.
- Promising "(small changes, same day)" or any same-day turnaround in features.
- Inventing a bundled "unified price" for two services without confirming with the user.
- Writing PT manually word-by-word — use `estimates_translate_to_pt`.
- Adding a `section-break` style slide that just says a category name (we no longer use those; the `section` label per service does the grouping).
$md$
WHERE NOT EXISTS (SELECT 1 FROM estimate_guidelines);
