# SEO Injection System - Eliminating FODC

## 📋 Original Problem

The application displayed a **FODC (Flash of Default Content)** for ~2 seconds after loading:

- **Browser tab**: "Skale Club | Your 5-Star Marketing Company" → then changed to the correct title
- **Cause**: Hardcoded values in `index.html` while React Query fetched real data

## ✅ Implemented Solution

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ 1. npm run build                                        │
│    ├─ Vite build (client)                              │
│    ├─ 🔧 Inject SEO (scripts/inject-seo-build.ts)      │
│    │   ├─ Fetch data from database                     │
│    │   ├─ Inject into dist/public/index.html           │
│    │   └─ Add meta tags, title, OG, Twitter Cards      │
│    └─ esbuild (server)                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. Production (server running)                          │
│    ├─ User visits site                                 │
│    ├─ Browser loads index.html (already with SEO!)     │
│    ├─ React hydrates                                   │
│    └─ No flash, SEO data already present ✅            │
└─────────────────────────────────────────────────────────┘
```

### Modified Files

#### 1. **[client/index.html](../client/index.html)**
```diff
- <title>Skale Club | Your 5-Star Marketing Company</title>
- <meta name="description" content="Professional marketing services..." />
+ <!-- SEO meta tags are injected at build time -->
+ <title>Loading...</title>
+ <meta name="description" content="" />
```

#### 2. **[scripts/inject-seo-build.ts](../scripts/inject-seo-build.ts)** (NEW)
Script that:
- ✅ Fetches data from database (`company_settings`)
- ✅ Injects `<title>`, `<meta>`, OG tags, Twitter Cards
- ✅ Updates favicon if customized
- ✅ Escapes HTML correctly
- ✅ Doesn't break build if it fails (just warns)

#### 3. **[script/build.ts](../script/build.ts)**
```diff
+ import { spawn } from "child_process";

  async function buildAll() {
    await viteBuild();
+   await injectSEO(); // ← Runs after Vite build
    await esbuild(...);
  }
```

#### 4. **[client/src/hooks/use-seo.ts](../client/src/hooks/use-seo.ts)**
```diff
  const { data: settings } = useQuery({
    queryKey: ['/api/company-settings'],
+   refetchOnMount: false,
+   refetchOnWindowFocus: false,
  });
```

## 🚀 How to Use

### Development
```bash
npm run dev
```
- **Behavior**: Title shows "Loading..." for ~1-2s until React loads
- **Acceptable**: Only happens in dev, doesn't affect production

### Production
```bash
npm run build
npm start
```
- **Behavior**: Title comes correct from the server ✅
- **Result**: Zero flash, perfect SEO

### Update SEO in Admin

1. Access `/admin` → Settings → SEO
2. Update title, description, images, etc.
3. **IMPORTANT**: Run `npm run build` again
4. Restart the server: `npm start`

> **⚠️ Note**: In production, SEO changes in admin require rebuild. This is intentional for maximum performance (zero loading delay).

## 🧪 How to Test

### Test 1: Verify build
```bash
npm run build
```
**Expected output:**
```
building client...
🔍 Fetching SEO data from database...
✅ SEO data fetched successfully
📄 Reading index.html...
✏️  Injecting SEO data:
   - Title: Skale Club
   - Description: Professional marketing...
✅ SEO data injected successfully!
```

### Test 2: Verify generated HTML
```bash
cat dist/public/index.html | grep -A 5 "<title>"
```
**Expected:** See the correct title from database, not "Loading..."

### Test 3: Test in production
```bash
npm start
# Open http://localhost:1000
```
**Expected:**
- Title in tab already correct from the first frame
- Inspect page: all meta tags filled
- No flash of "Your 5-Star Marketing Company"

### Test 4: SEO Crawler Simulation
```bash
curl -s http://localhost:1000 | grep "<title>"
```
**Expected:** `<title>Skale Club</title>` (or the value in database)

## 📊 Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **FODC** | ~2s of wrong title | ✅ Zero flash |
| **SEO** | Title changes after JS loads | ✅ Title already in initial HTML |
| **Google Bot** | Sees "Loading..." initially | ✅ Sees correct title |
| **Speed** | Fetch on mount | ✅ Zero fetch (already injected) |
| **UX** | Visible flash | ✅ Seamless |

## 🔧 Maintenance

### Add new SEO fields

1. Add the field in `shared/schema.ts` → `companySettings`
2. Update `SeoSettings` interface in `use-seo.ts`
3. Add injection in `scripts/inject-seo-build.ts`:
```typescript
const newField = seoData.newField || "default";
html = html.replace(
  /<\/head>/,
  `<meta property="new:field" content="${escapeHtml(newField)}" />\n  </head>`
);
```
4. Build and test

### Fallbacks

If the injection script fails:
- ✅ Build doesn't break (just warning)
- ✅ React Query still updates the title at runtime
- ✅ Site works normally (just without optimized SEO)

## 🐛 Troubleshooting

### "No company settings found in database"
**Cause**: Empty database or not connected during build
**Solution**:
```bash
# Make sure DATABASE_URL is configured
echo $DATABASE_URL
# Run migrations if necessary
npm run db:push
```

### "index.html not found"
**Cause**: Vite build failed before injection
**Solution**: Check Vite build logs above the error

### Title still shows "Loading..."
**Cause**: Injection script didn't run or failed silently
**Solution**:
```bash
# Execute manually
tsx scripts/inject-seo-build.ts
# Check logs for errors
```

### In dev, title takes time to update
**Expected**: In dev, there's no build injection. React Query fetches normally.
**Solution**: Not a problem, only affects production.

## 📚 References

- [Preventing FODC in SPAs](https://web.dev/avoid-invisible-text/)
- [SEO for React Apps](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Build-time Pre-rendering](https://vitejs.dev/guide/ssr.html)

---

**Implemented on:** 2026-01-24
**Maintained by:** Skale Club Team
