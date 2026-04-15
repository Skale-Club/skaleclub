# Multi-Forms Support — Implementation Plan

## Goal
Migrate from a single global lead form (one `formConfig` JSON on `company_settings`) to N independent forms, each with its own questions, thresholds, GHL mappings, and captured leads. Existing lead data must be preserved and associated with a default form.

---

## Current Architecture (as-is)

- **Storage**: `company_settings.formConfig` (JSON) holds the only form config. Leads live in `form_leads`, un-scoped.
- **Reading the form**: `GET /api/form-config` → returns the single `FormConfig`.
- **Saving leads**: `POST /api/form-leads/progress` — session-scoped, progressive save. Scoring and GHL sync use the global config.
- **Chat widget**: AI agent calls `get_form_config()` tool which returns the global config; qualifies leads through it.
- **Public form**: `<LeadFormModal>` on `Home.tsx` reads `/api/form-config` and submits progress with `sessionId`.
- **GHL sync**: each question carries `ghlFieldId`; server iterates questions and pushes mapped fields into GHL custom fields.

---

## Target Architecture (to-be)

### Data model

**New table `forms`:**
```
forms (
  id            serial PK
  slug          text UNIQUE NOT NULL      -- e.g. "qualification", "contact-us"
  name          text NOT NULL             -- admin-facing label
  description   text
  is_default    boolean NOT NULL default false  -- exactly one form is default
  is_active     boolean NOT NULL default true
  config        jsonb NOT NULL            -- { questions, maxScore, thresholds }
  created_at    timestamp default now()
  updated_at    timestamp default now()
)
```

**Change `form_leads`:** add `form_id integer NOT NULL REFERENCES forms(id)`.

**Deprecate** `company_settings.formConfig` (keep column for one release, null-allowed; migration copies its value into a seeded `forms` row).

### Routing / API surface

| Old | New |
|---|---|
| `GET /api/form-config` | `GET /api/forms/:slug/config` (public) |
| `PUT /api/form-config` | `PUT /api/forms/:id` (admin, full form update) |
| `POST /api/form-leads/progress` | `POST /api/forms/:slug/leads/progress` |
| `GET /api/form-leads` | `GET /api/form-leads?formId=…` (filter) |
| — | `GET /api/forms` (list, admin) |
| — | `POST /api/forms` (create) |
| — | `DELETE /api/forms/:id` (block if leads exist OR cascade-soft-delete) |
| — | `POST /api/forms/:id/duplicate` |

### Chat widget

- Chat settings gain a `formSlug` field. When the AI starts a conversation, it resolves the form via that slug and uses it for the whole session.
- The existing `get_form_config()` tool gets a `formSlug` argument (defaults to conversation's form).

### GHL mapping

- Keep `ghlFieldId` per question (inside the form config JSON). No schema change needed — each form owns its own mappings independently.
- When two forms map to the same GHL field: that's allowed, the latest write wins on the contact record. Document this.

---

## Phases

The work is large enough to split into 5 sub-phases. Each phase is independently shippable and leaves the app in a working state.

### Phase 5.1 — Schema + Migration (backend-only, invisible to users)

**Goal**: stand up the new schema and seed the existing form into it, keeping all old endpoints working via a compatibility shim.

**Tasks:**
1. Create Drizzle table `forms` in `shared/schema/forms.ts`. Export `Form`, `InsertForm` types.
2. Add `formId` FK column to `form_leads`. Keep nullable at first to allow zero-downtime.
3. Write migration `0011_multi_forms.sql`:
   - `CREATE TABLE forms (...)`
   - `INSERT INTO forms (slug, name, is_default, config) SELECT 'default', 'Default Form', true, form_config FROM company_settings WHERE form_config IS NOT NULL;` (fallback to `DEFAULT_FORM_CONFIG` if null)
   - `ALTER TABLE form_leads ADD COLUMN form_id INTEGER REFERENCES forms(id);`
   - `UPDATE form_leads SET form_id = (SELECT id FROM forms WHERE is_default = true);`
   - `ALTER TABLE form_leads ALTER COLUMN form_id SET NOT NULL;`
4. Add storage methods: `listForms()`, `getForm(id)`, `getFormBySlug(slug)`, `getDefaultForm()`, `createForm()`, `updateForm()`, `deleteForm()`, `duplicateForm()`.
5. **Compat shim**: `GET /api/form-config` and `PUT /api/form-config` keep working — they read/write the default form's config. No frontend change yet.
6. `upsertFormLeadProgress` accepts optional `formId`; defaults to default form when absent.

**Verification**: existing flows (public form, chat, admin leads) still function. `forms` table has 1 row. All existing leads have `form_id` pointing to it.

### Phase 5.2 — Admin Forms List + Editor (backend endpoints + UI)

**Goal**: admin can create, rename, duplicate, delete, activate/deactivate forms. Editor still opens the default form initially to keep current UX.

**Tasks:**
1. Implement new REST endpoints (`GET/POST/PUT/DELETE /api/forms`, `POST /api/forms/:id/duplicate`).
2. Protection: deleting a form with leads returns 409 unless `?cascade=soft` (sets `is_active=false`).
3. New `<FormsListSection>` in admin — simple table with Name, Slug, Default badge, Active toggle, Leads count, actions (Edit / Duplicate / Delete).
4. Edit flow: clicking a form opens existing `<FormEditorContent>` in a dialog or dedicated route `/admin/forms/:id`.
5. `FormEditorContent` now receives `formId` prop and saves to `/api/forms/:id`. It no longer assumes a global config.
6. Slug validation: kebab-case, unique, required. Auto-generated from name on create.
7. "Set as default" action — only one default at a time (transactional swap).

**Verification**: admin can create a second form, rename it, switch default, and delete non-default empty forms. Existing default form editing still works identically.

### Phase 5.3 — Public Form + Chat Widget pick form by slug

**Goal**: public-facing capture points know which form to load.

**Tasks:**
1. `<LeadFormModal>` accepts `formSlug` prop (default `"default"`). Fetches `/api/forms/:slug/config`.
2. Home page passes `formSlug` from query string if present (`?form=contact`). Fallback is default.
3. `POST /api/forms/:slug/leads/progress` — new endpoint. Server resolves slug → formId, stores lead with `form_id`.
4. Chat widget: add `formSlug` to `chat_settings`. Default `"default"`.
5. AI tool `get_form_config` resolves the session's form (from conversation → settings). No API-shape change for the model.
6. Keep `POST /api/form-leads/progress` alive as compat (routes to default form).

**Verification**: create a second form "Contact Us" with 3 questions. Visit `/?form=contact-us` and submit — lead lands in the right form. Chat still qualifies via default form.

### Phase 5.4 — Leads Section scoping

**Goal**: admin can see leads segmented per form, dashboard reflects this.

**Tasks:**
1. Leads filter gains a "Form" dropdown (default: all forms).
2. `GET /api/form-leads` accepts `?formId=`.
3. Lead row / detail panel shows which form the lead came from (small badge).
4. Dashboard cards (`Total Leads`, `Hot Leads`, etc.) add a form selector. "All forms" aggregates.
5. CSV export (if exists) includes `form_name` column.

**Verification**: leads from two different forms are correctly filtered and never mixed. Dashboard metrics aggregate or scope correctly.

### Phase 5.5 — Cleanup and docs

**Goal**: remove the deprecated path.

**Tasks:**
1. Remove `company_settings.formConfig` column (migration `0012_drop_legacy_form_config.sql`).
2. Delete compat endpoints `GET/PUT /api/form-config` and `POST /api/form-leads/progress`.
3. Remove any code branches checking `formId ?? defaultFormId`.
4. Update README / inline docs if any reference the old single-form model.
5. Translation file: add new PT strings for any new admin UI text introduced.

**Verification**: no references to `formConfig` on `company_settings` remain. `grep` for the old endpoints returns zero call sites.

---

## Open Decisions (ask user before phase 5.2)

1. **Routing**: separate `/admin/forms` section in sidebar, or keep forms list inside the Leads section? *Recommendation: new top-level admin section "Forms" — it's its own concept now.*
2. **Form identification in public URL**: `/?form=slug` query param, or `/f/:slug` dedicated route? *Recommendation: dedicated route — cleaner to share.*
3. **Chat + multiple forms**: should admins be able to pick which form the chat uses per conversation, or globally in Chat settings? *Recommendation: global in Chat settings for v1; per-URL-rule matching later.*
4. **Deleting a form with leads**: hard delete blocked vs. soft delete (hide but keep leads)? *Recommendation: soft delete (set `is_active=false`); provide "Archive" action instead of Delete when leads exist.*
5. **GHL field collisions across forms**: allow or warn? *Recommendation: allow, with a small "shared with: <form names>" hint in the editor.*

---

## Risk Log

| Risk | Mitigation |
|---|---|
| Migration on prod with active leads table | Do it in a maintenance window; migration is idempotent and backed by the `is_default` seed |
| Chat tool contract changes break live conversations | Keep `get_form_config` signature stable; resolve form server-side |
| Admins accidentally delete a form with submitted leads | Soft-delete default; confirm dialog lists lead count |
| Duplicate slugs | Unique index + server-side validation on create |
| Public users hitting an unknown slug | Return the default form and log a warning |

---

## Effort Estimate (rough)

- Phase 5.1 — Schema + migration + compat: **1–1.5 days**
- Phase 5.2 — Admin Forms List + Editor wiring: **1.5–2 days**
- Phase 5.3 — Public + Chat slug awareness: **1 day**
- Phase 5.4 — Leads section scoping: **0.5–1 day**
- Phase 5.5 — Cleanup: **0.5 day**

**Total**: ~5–6 dev days, shippable in 5 separate commits/PRs.
