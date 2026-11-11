# Platform landing pages

One React template, `client/src/components/platforms/PlatformLanding.tsx`, renders every platform. Change layout, spacing, responsive behavior and CTA behavior there once. Bilingual copy lives in `shared/platformLandings.ts`: one short hero, one sentence, three benefits and one primary CTA. No duplicated page components or subscription/pricing promises.

| Platform | Canonical path | Existing catalog slug | Action |
| --- | --- | --- | --- |
| Xkedule | `/platforms/xkedule` | `scheduling-system` | Open platform |
| Xtimator | `/platforms/xtimator` | `xtimator` | Open platform |
| Xphere | `/platforms/xphere` | `crm-setup` | Open platform |
| Xareable | `/platforms/xareable` | `xareable` | Open platform |
| Xsites | `/platforms/xsites` | `websites` | Contact |
| Xcraper | `/platforms/xcraper` | `xcraper` | Open platform |
| Xpot | `/platforms/xpot` | `xpot` | Open platform |
| XmartMenu | `/platforms/xmartmenu` | `smart-menu` | Open platform |
| Xpeed | `/platforms/xpeed` | `xpeed` | Open platform |

Portuguese paths add `/br`. The platform index remains `/apps`; downloadable applications remain `/downloads`. Xtudio belongs to future Apps work.

`shared/platforms.ts` owns legacy aliases, branded paths and safe access URLs. API and server SEO check the existing catalog's `isActive` flag on each request. Sitemap includes only active records and advertises both languages. Future valid CMS slugs use the same bounded template until editorial copy is added. Catalog details buttons link to these pages; direct platform access remains available.

The Xsites catalog URL is a customer example, not a platform portal, so its primary CTA uses the contact page. Other access URLs remain editable through the existing platform catalog. Known product copy is deliberately curated instead of reusing stale setup-service descriptions.

## Data and release

The eight existing active offers were read from the public `/api/portfolio-services` endpoint on 2026-11-11. `shared/fixtures/platform-catalog.json` is that public snapshot for offline preview and tests only; the application does not import it at runtime.

Xpeed's verified source URL is `https://xpeed.skale.club`. The additive migration `supabase/migrations/20261111210000_xpeed_platform.sql` prepares its missing catalog row without changing existing rows. `shared/platformDefaults.ts` supplies the same seed for previews/tests. No migration or production write has been performed. Xpeed returns 404 until an active catalog row exists.

## Verification

Targeted checks (dummy database URL, no database needed):

```powershell
$env:DATABASE_URL='postgresql://test:test@127.0.0.1:1/test'
$env:POSTGRES_URL=$env:DATABASE_URL
node --max-old-space-size=192 --import tsx --test --test-concurrency=1 shared/platformLandings.test.ts server/routes/__tests__/platforms.test.ts
```

Eight tests passed in 7.6 seconds on the Surface. They cover all nine platforms in both languages, aliases, publication changes, unsafe URLs, Xsites contact behavior, bounded future content, server SEO and active-only sitemap entries.

Twelve existing application API/SEO/rendering regression tests also passed in 7.6 seconds. Twenty-two changed TypeScript files passed a lightweight syntax check. This is not a full type check.

Offline previews use the actual shared React component, real local catalog marks and targeted Tailwind CSS, with a simplified review navigation and system-font fallback:

```powershell
node --max-old-space-size=192 --import tsx scripts/preview-platform-landings.ts C:/absolute/dedicated/platform-preview
```

Generation took 2.5 seconds for 18 pages plus an index. The snapshot is review data, not evidence of production rendering. With only 0.3 GB RAM free, full type checking, application build and desktop/mobile browser verification were deferred. Run these before the approved release. No server, full build, deployment or paid external action was started.
