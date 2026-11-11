# Downloadable applications

Foundation added on 2026-11-11. This is an independent, free distribution catalog;
`portfolio_services` and `/apps` continue serving the existing SaaS offerings.

Public naming: **Apps** (EN) / **Aplicativos** (PT) identifies installable
applications; **Platforms** / **Plataformas** identifies subscription SaaS.
"Download" / "Baixar" describes the action within an application landing,
not the category name. Navigation, catalog headings, admin labels and SEO use
this distinction. Existing URLs and API/database identifiers are preserved:
`/downloads` is the application catalog and `/apps` remains the SaaS catalog.

## Structure

- `/downloads`: published applications, linked from the public footer.
- `/downloads/:slug`: reusable product landing with description, features and
  published downloads. The `/br` prefix localizes the interface; catalog content
  is currently shared between languages.
- `/admin/downloads`: application editor and release management.
- `downloadable_apps`: one record per application, with a bounded JSON release
  list. New applications and new releases default to draft. Pricing is always
  `free` in the public API; there is no payment, subscription or license gate.
- `/api/downloadable-apps[/:slug]`: public catalog, excluding drafts.
- `/api/admin/downloadable-apps`: admin-only GET/POST; `/:id` accepts PUT of the
  full validated application input. Unpublish to withdraw an application.
- `/api/downloads/:slug/:releaseId`: checks application and release publication,
  validates the URL again and redirects with 302. Responses are `no-store` so
  withdrawing a release also withdraws its stable website download URL.

## Add an application

1. Create its name, permanent lowercase slug, tagline, description and features.
2. Upload the real installer to an owner-controlled public HTTPS release host
   (for example the application's own release storage). This website redirects;
   it neither uploads, proxies nor builds executables. Configure attachment
   headers on the host if the file should download instead of opening in a tab.
3. Add a release with a unique ID, platform, architecture, version, URL, minimum
   requirements, release notes and optional SHA-256. For mobile applications,
   the URL may be an official store listing.
4. Verify the actual installer/version and platform before publishing its release
   and the application. Applications may also publish without a release, in
   which case their landing shows that downloads are being prepared.
5. A button inside XNote or another application can open
   `https://skale.club/downloads/<slug>` for available platforms. An exact-release
   button can open `https://skale.club/api/downloads/<slug>/<releaseId>`.
   The application repositories are not modified by this foundation.

Release IDs identify a specific version/platform and should remain stable. A new
version gets a new ID. Public URLs are public files: unpublishing the website
link does not revoke files already downloaded or their upstream hosting URLs.
The checksum is displayed metadata, not automatic binary verification. Code
signing, installer production, update feeds, download analytics and monetization
are separate follow-ups.

## Migration and release

`supabase/migrations/20261111180000_downloadable_apps.sql` creates the table with
RLS and no anonymous database policies, then adds XNote as an unpublished draft
without installers. Its copy is placeholder editorial content, not verified
product claims. No existing application is reclassified or automatically listed.

Apply this additive migration to the intended database before releasing the
code. No migration, production write or deploy was performed for this task.
Do not run against a production-connected local environment without the owner's
release approval. Rollback: unpublish the entries, then restore the prior code;
the additive table can remain in place without affecting the SaaS catalog.

## Verification

Run the focused route suite with dummy database URLs:

```powershell
$env:DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
$env:POSTGRES_URL = $env:DATABASE_URL
node --import tsx --test server/routes/__tests__/downloads.test.ts
```

The suite uses in-memory application records and no database connection. It
checks draft isolation, authentication wiring, create/update/withdrawal, URL and
input validation, stable redirect behavior, server SEO and sitemap inclusion.
Before release, run type checking and visually inspect the index, app landing
and admin editor on desktop/mobile using a disposable development database.

Measured on Surface Pro 7+: focused suite took 15.7 seconds on the first run
and 4.0 seconds on a warm run (8 tests passed). The esbuild syntax transform
passed for all 5 changed TSX files, and `git diff --check` passed.
Full type checking, build and browser verification
were deferred while the machine was in critical memory mode.
