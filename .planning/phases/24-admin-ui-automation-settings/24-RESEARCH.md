# Phase 24: Admin UI — Automation Settings - Research

**Researched:** 2026-04-22
**Domain:** React admin UI — settings form, async mutation button, relative time display
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 24 adds a new "Automation" panel to the existing `BlogSection.tsx` component. The pattern already exists in the codebase: `IntegrationsSection` uses a custom manual tab strip (not shadcn `<Tabs>`), `BlogSection` already uses the `isSaved` + green-button confirmation pattern, and `EstimatesSection` shows exactly how to use `formatDistanceToNow` from `date-fns` for relative timestamps.

The most critical gap discovered: `GET /api/blog/settings` already exists and returns the full `BlogSettings` row including `lastRunAt`. However, there is **no storage method and no route** for fetching the latest `blog_generation_jobs` row. BLOG-19 requires displaying the status of the most recent job, so Phase 24 must add `getLatestBlogGenerationJob()` to `IStorage`/`DatabaseStorage` and expose it through a new route endpoint (e.g. `GET /api/blog/jobs/latest`).

The plan can co-locate the new `BlogAutomationPanel` component inside `BlogSection.tsx` (same file, following the `EstimatesSection`/`PresentationsSection` co-location pattern). The component is a self-contained card with: a settings form (pure client state, PUT on save), a "Generate Now" button (POST mutation with spinner), and a status bar using `formatDistanceToNow`.

**Primary recommendation:** Co-locate `BlogAutomationPanel` inside `BlogSection.tsx`. Use the custom `flex gap-1.5 bg-muted p-1.5 rounded-lg` tab strip from `IntegrationsSection` to add a "Posts" / "Automation" selector before the main content. Use `isSaved` + `setTimeout` pattern for Save confirmation. Use `isPending` on the generate mutation to drive the spinner.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-17 | Admin Blog section gains "Automation" tab/accordion — fields: enabled toggle, postsPerDay select (0-4), seoKeywords textarea, enableTrendAnalysis toggle, promptStyle textarea; Save calls PUT /api/blog/settings | Section 3 (isSaved pattern), Section 7 (field types), Section 8 (tabs pattern), Section 9 (API shape) |
| BLOG-18 | "Generate Now" button — POST /api/blog/generate, loading spinner, success toast with link to draft post, error/skip toast | Section 4 (async button pattern), Section 5 (mutation pattern), Section 9 (response shape) |
| BLOG-19 | Automation UI shows "Last generated: X ago" from blog_settings.lastRunAt, and status of most recent job from blog_generation_jobs | Section 6 (date-fns), GAP: getLatestBlogGenerationJob storage + route needed |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TanStack Query | 18.3.1 / 5.60.5 | Component + data fetching | Project standard |
| `date-fns` | 3.6.0 | `formatDistanceToNow` for relative time | Already used in `EstimatesSection` |
| `lucide-react` | 0.453.0 | Icons (`Zap`, `Loader2`, `Check`, `Clock`) | Project standard |
| `@/components/ui/switch` | Radix UI | Boolean toggles (`enabled`, `enableTrendAnalysis`) | Used in `ChatSection` |
| `@/components/ui/select` | Radix UI | `postsPerDay` 0-4 | Used throughout admin |
| `@/components/ui/textarea` | shadcn | `seoKeywords`, `promptStyle` fields | Used in `BrandGuidelinesSection` |
| `useToast` | project hook | Mutation feedback | Universal admin pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `AdminCard` | shared | Card wrapper | All admin content cards |
| `Loader2` | `@/components/ui/loader` | Spinner inside buttons | `isPending` state |
| `clsx` | installed | Conditional class merging | Conditional button styles |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed beyond potentially co-locating inside `BlogSection.tsx`. If the component exceeds ~200 lines, extract to:

```
client/src/components/admin/
├── BlogSection.tsx              # Existing — add tab strip + import
└── BlogAutomationPanel.tsx      # New — automation settings card
```

However, the co-location approach (all in `BlogSection.tsx`) follows the established pattern used by `EstimatesSection` and `PresentationsSection`.

### Pattern 1: Custom Tab Strip (IntegrationsSection pattern)

**What:** Manual `useState` tab selector using a `flex gap-1.5 bg-muted p-1.5 rounded-lg` container. No shadcn `<Tabs>` — custom button-based toggle.

**When to use:** When adding a second "view" to an existing section.

**Example (from `IntegrationsSection.tsx`):**
```typescript
// Source: client/src/components/admin/IntegrationsSection.tsx
const [activeTab, setActiveTab] = useState<'posts' | 'automation'>('posts');

<div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
  {TABS.map(tab => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 min-w-0 justify-center ${
        activeTab === tab.id
          ? 'bg-white dark:bg-card border-border shadow-sm'
          : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
      }`}
    >
      <tab.icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{tab.label}</span>
    </button>
  ))}
</div>

{activeTab === 'posts' && <PostsContent />}
{activeTab === 'automation' && <BlogAutomationPanel />}
```

### Pattern 2: isSaved Save Confirmation (BlogSection pattern)

**What:** `useState<boolean>` flag set to `true` in `onSuccess`, cleared after 3s via `setTimeout`. Button turns green + shows "Saved" text.

**When to use:** Any admin settings PUT that needs inline confirmation without a toast.

**Example (from `BlogSection.tsx` lines 43, 240-246, 826-833):**
```typescript
// Source: client/src/components/admin/BlogSection.tsx
const [isSaved, setIsSaved] = useState(false);

const saveMutation = useMutation({
  mutationFn: (data: FormData) => apiRequest('PUT', '/api/blog/settings', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  },
  onError: (err: any) => {
    toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
  },
});

<Button
  type="submit"
  disabled={saveMutation.isPending}
  className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
>
  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
  {isSaved && <Check className="w-4 h-4 mr-2" />}
  {isSaved ? 'Saved' : 'Save Settings'}
</Button>
```

### Pattern 3: Async Mutation Button with Spinner

**What:** `useMutation` with `isPending` driving a `Loader2` spinner inside the button. Button is `disabled={mutation.isPending}`.

**When to use:** Any one-shot async action (not a form save) — "Generate Now", "Delete", etc.

**Example (from `BrandGuidelinesSection.tsx`):**
```typescript
// Source: client/src/components/admin/BrandGuidelinesSection.tsx
const generateMutation = useMutation({
  mutationFn: () => apiRequest('POST', '/api/blog/generate'),
  onSuccess: async (res) => {
    const data = await res.json();
    if (data.skipped) {
      toast({ title: 'Generation skipped', description: data.reason, variant: 'default' });
      return;
    }
    const postSlug = data.post?.slug;
    toast({
      title: 'Post generated',
      description: postSlug ? `Draft created — "${data.post.title}"` : 'Draft created successfully',
    });
    queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/blog/jobs/latest'] });
  },
  onError: (err: any) => {
    toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
  },
});

<Button
  onClick={() => generateMutation.mutate()}
  disabled={generateMutation.isPending}
>
  {generateMutation.isPending
    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    : <Zap className="w-4 h-4 mr-2" />
  }
  {generateMutation.isPending ? 'Generating...' : 'Generate Now'}
</Button>
```

### Pattern 4: formatDistanceToNow (EstimatesSection pattern)

**What:** `date-fns` `formatDistanceToNow` for "X ago" display. Import alongside `format`.

**When to use:** Displaying `lastRunAt` relative time and job timestamps.

**Example (from `EstimatesSection.tsx` line 13, 472):**
```typescript
// Source: client/src/components/admin/EstimatesSection.tsx
import { format, formatDistanceToNow } from 'date-fns';

// Render:
{lastRunAt && (
  <span className="text-xs text-muted-foreground">
    Last generated: {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
  </span>
)}
```

### Pattern 5: Settings Form with useEffect hydration (BrandGuidelinesSection pattern)

**What:** Local `useState` for draft form values, `useEffect` to sync from query data. This avoids controlled form resets on re-render.

**Example (from `BrandGuidelinesSection.tsx`):**
```typescript
// Source: client/src/components/admin/BrandGuidelinesSection.tsx
const [formDraft, setFormDraft] = useState({ enabled: false, postsPerDay: 0, ... });

const { data: settings } = useQuery<BlogSettings>({
  queryKey: ['/api/blog/settings'],
});

useEffect(() => {
  if (settings) {
    setFormDraft({
      enabled: settings.enabled,
      postsPerDay: settings.postsPerDay,
      seoKeywords: settings.seoKeywords ?? '',
      enableTrendAnalysis: settings.enableTrendAnalysis,
      promptStyle: settings.promptStyle ?? '',
    });
  }
}, [settings]);
```

### Anti-Patterns to Avoid

- **Using shadcn `<Tabs>` component:** No existing admin section uses it. Use the custom button tab strip from `IntegrationsSection` for visual consistency.
- **Using `usePagePaths().blogPost(slug)` in toast description string:** Toast `description` is a string. Use `window.open(path, '_blank')` from a `ToastAction` element, or include the URL as plain text. The `ToastAction` element pattern (`action?: ToastActionElement`) is supported but rarely used in admin — keep it simple with a description string.
- **Calling `apiRequest('PUT', ...)` then `.json()` inside `mutationFn`:** `apiRequest` returns a `Response`. Parse JSON in `onSuccess: async (res) => { const data = await res.json() }`.
- **Not invalidating `/api/blog/settings` after generate:** `lastRunAt` is updated server-side; the query must be invalidated to show the updated "Last generated" time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative time display | Custom date arithmetic | `formatDistanceToNow` from `date-fns` | Handles all edge cases, already in bundle |
| Toggle/switch | Custom checkbox styled as toggle | `<Switch>` from `@/components/ui/switch` | Radix accessible, already used in ChatSection |
| Loading spinner | Custom CSS animation | `<Loader2>` from `@/components/ui/loader` | Project's standard `DotsLoader` wrapper |
| Tab navigation | Accordion with Radix | Custom button strip (IntegrationsSection pattern) | Consistent with all other multi-tab admin sections |

---

## Critical Gap: BLOG-19 Requires New Storage + Route

**Finding:** `GET /api/blog/settings` returns `lastRunAt` (for "Last generated" display). However, there is **no existing endpoint or storage method** for fetching the latest `blog_generation_jobs` row. BLOG-19 requires showing "status of most recent job (completed/failed/skipped)."

**Required additions (Phase 24 plan must include these):**

1. **`server/storage.ts` — `IStorage` interface:** Add `getLatestBlogGenerationJob(): Promise<BlogGenerationJob | undefined>`

2. **`server/storage.ts` — `DatabaseStorage` implementation:**
```typescript
async getLatestBlogGenerationJob(): Promise<BlogGenerationJob | undefined> {
  const [job] = await db
    .select()
    .from(blogGenerationJobs)
    .orderBy(desc(blogGenerationJobs.id))
    .limit(1);
  return job;
}
```

3. **`server/routes/blogAutomation.ts`:** Add route:
```typescript
// Admin-auth: GET /api/blog/jobs/latest
app.get("/api/blog/jobs/latest", requireAdmin, async (_req, res) => {
  const job = await storage.getLatestBlogGenerationJob();
  res.json(job ?? null);
});
```

4. **Client query in `BlogAutomationPanel`:**
```typescript
const { data: latestJob } = useQuery<BlogGenerationJob | null>({
  queryKey: ['/api/blog/jobs/latest'],
});
```

**Confidence:** HIGH — verified by inspecting `IStorage` interface at `storage.ts:653-656`, `DatabaseStorage` at `storage.ts:1790-1823`, and `blogAutomation.ts` routes at full file. No such method or route exists.

---

## API Response Shapes

### GET /api/blog/settings
```typescript
// Returns BlogSettings row or safe defaults when no row exists
{
  id?: number,              // present when DB row exists
  enabled: boolean,         // default: false
  postsPerDay: number,      // int 0-4, default: 0
  seoKeywords: string,      // default: ""
  enableTrendAnalysis: boolean, // default: false
  promptStyle: string,      // default: ""
  lastRunAt: Date | null,   // null when never run
  lockAcquiredAt: Date | null,
  updatedAt?: Date | null,
}
```

### PUT /api/blog/settings (request body)
```typescript
// lockAcquiredAt and lastRunAt are OMITTED by server (cannot be set by admin)
{
  enabled: boolean,
  postsPerDay: number,
  seoKeywords: string,
  enableTrendAnalysis: boolean,
  promptStyle: string,
}
```

### POST /api/blog/generate — three possible response shapes
```typescript
// Success
{ jobId: number, postId: number, post: BlogPost }

// Skipped (still 200)
{ skipped: true, reason: string }
// reason values: "no_settings" | "disabled" | "rate_limit" | "locked"

// Error (500)
{ error: string }
```

---

## Common Pitfalls

### Pitfall 1: GET /api/blog/settings returns defaults without `id`
**What goes wrong:** Client code does `settings.id` for cache key or display — crashes when row doesn't exist yet.
**Why it happens:** `BLOG_SETTINGS_DEFAULTS` constant has no `id` field.
**How to avoid:** Type the query result as `BlogSettings | typeof BLOG_SETTINGS_DEFAULTS`. Only rely on `id` if `settings.id !== undefined`.

### Pitfall 2: lastRunAt arrives as ISO string from JSON, not Date object
**What goes wrong:** `formatDistanceToNow(settings.lastRunAt)` crashes — `lastRunAt` is a string after `res.json()`.
**Why it happens:** JSON serialization converts `Date` to ISO string; Zod schema type says `Date` but runtime is string.
**How to avoid:** Always wrap: `formatDistanceToNow(new Date(settings.lastRunAt), { addSuffix: true })` with a null guard.
```typescript
{settings?.lastRunAt && (
  <span>Last generated: {formatDistanceToNow(new Date(settings.lastRunAt), { addSuffix: true })}</span>
)}
```

### Pitfall 3: apiRequest response body consumed twice
**What goes wrong:** `mutationFn` calls `await res.json()` but `apiRequest` already threw if not ok; then `onSuccess` tries to read again — body already consumed.
**Why it happens:** `apiRequest` calls `throwIfResNotOk(res)` but does NOT consume the body. Safe to call `.json()` in `onSuccess`.
**How to avoid:** Parse JSON only in `onSuccess: async (res) => { const data = await res.json(); }`.

### Pitfall 4: POST /api/blog/generate skipped response is 200, not 4xx
**What goes wrong:** Developer expects a skip to trigger `onError` — it won't. A skipped generation is a 200 response.
**Why it happens:** BLOG-14 explicitly specifies skip results are 200.
**How to avoid:** In `onSuccess`, check `if (data.skipped)` first and handle as a non-error toast before proceeding to success flow.

### Pitfall 5: Missing query invalidation after generate
**What goes wrong:** "Last generated" timestamp doesn't update after a successful generation until page reload.
**Why it happens:** `lastRunAt` is written server-side by `BlogGenerator` — React Query cache is stale.
**How to avoid:** In `generateMutation.onSuccess`, invalidate both:
```typescript
queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
queryClient.invalidateQueries({ queryKey: ['/api/blog/jobs/latest'] });
```

### Pitfall 6: registerBlogAutomationRoutes wildcard ordering
**What goes wrong:** Adding `/api/blog/jobs/latest` after `/api/blog/:idOrSlug` causes the wildcard to match first and return a 404.
**Why it happens:** Express routes match in registration order. `blog.ts` has `GET /api/blog/:idOrSlug`.
**How to avoid:** New routes go in `blogAutomation.ts` which is registered BEFORE `blog.ts` (this ordering is already established in Phase 23 — `registerBlogAutomationRoutes` is called before `registerBlogRoutes`).

---

## Code Examples

### Switch (toggle) field
```typescript
// Source: client/src/components/admin/ChatSection.tsx lines 581-590
<div className="flex items-center justify-between p-3 border rounded-lg bg-card">
  <div className="space-y-0.5">
    <Label className="text-base">Enable Automation</Label>
    <p className="text-xs text-muted-foreground">Automatically generate blog posts on schedule</p>
  </div>
  <Switch
    checked={formDraft.enabled}
    onCheckedChange={(checked) => setFormDraft(prev => ({ ...prev, enabled: checked }))}
  />
</div>
```

### postsPerDay Select (0 through 4)
```typescript
// Source: client/src/components/admin/BlogSection.tsx (uses Select pattern)
<Select
  value={String(formDraft.postsPerDay)}
  onValueChange={(v) => setFormDraft(prev => ({ ...prev, postsPerDay: Number(v) }))}
>
  <SelectTrigger className="border-0 bg-background">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="0">0 (disabled)</SelectItem>
    <SelectItem value="1">1 post/day</SelectItem>
    <SelectItem value="2">2 posts/day</SelectItem>
    <SelectItem value="3">3 posts/day</SelectItem>
    <SelectItem value="4">4 posts/day</SelectItem>
  </SelectContent>
</Select>
```

### Success toast with draft post link
```typescript
// Source: toast pattern from use-toast.ts + apiRequest pattern
onSuccess: async (res) => {
  const data = await res.json();
  if (data.skipped) {
    toast({
      title: 'Generation skipped',
      description: `Reason: ${data.reason}`,
    });
    return;
  }
  const postSlug = data.post?.slug;
  toast({
    title: 'Draft created',
    description: postSlug
      ? `"${data.post.title}" — view at /blog/${postSlug}`
      : 'New draft post created successfully.',
  });
  queryClient.invalidateQueries({ queryKey: ['/api/blog/settings'] });
  queryClient.invalidateQueries({ queryKey: ['/api/blog/jobs/latest'] });
},
```

### Latest job status display
```typescript
// Combining BlogGenerationJob status with formatDistanceToNow
const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  failed:    { label: 'Failed',    className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  skipped:   { label: 'Skipped',   className: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  running:   { label: 'Running',   className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
};

{latestJob && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span>Last job:</span>
    <span className={clsx('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE[latestJob.status]?.className)}>
      {STATUS_BADGE[latestJob.status]?.label ?? latestJob.status}
    </span>
    {latestJob.startedAt && (
      <span>{formatDistanceToNow(new Date(latestJob.startedAt), { addSuffix: true })}</span>
    )}
  </div>
)}
```

---

## Research Answers by Question Number

1. **Where is BlogSection?** `client/src/components/admin/BlogSection.tsx` — 1,107 lines. The existing component handles create/edit/delete of posts. The list view renders in `<AdminCard>`. The Automation panel must be added alongside the post list using a tab selector.

2. **What pattern for admin tabs/accordions?** Use the custom button tab strip from `IntegrationsSection.tsx` (lines 32-48). No shadcn `<Tabs>` used anywhere in admin. State: `useState<'posts' | 'automation'>('posts')`.

3. **Settings save confirmation pattern?** `isSaved` boolean + `setTimeout(3000)` in `onSuccess`, green button + Check icon. From `BlogSection` lines 240-246, 826-833. Alternatively, a simple success toast (used by `BrandGuidelinesSection`).

4. **Async button with spinner?** `disabled={mutation.isPending}` + conditional `<Loader2>` inside button. From `BrandGuidelinesSection.tsx` lines 92-102.

5. **React Query mutation pattern for POST/PUT?** `useMutation({ mutationFn: () => apiRequest('POST', url, body), onSuccess: async (res) => { const data = await res.json(); ... } })`. `apiRequest` is from `@/lib/queryClient`.

6. **date-fns relative time?** `formatDistanceToNow(new Date(dateValue), { addSuffix: true })`. Import from `date-fns`. Used in `EstimatesSection.tsx` line 472. Always wrap in `new Date()` since JSON returns ISO string, not Date.

7. **Field types:**
   - `enabled`: `<Switch checked={...} onCheckedChange={...} />` from `@/components/ui/switch`
   - `postsPerDay`: `<Select>` 0-4 from `@/components/ui/select`
   - `seoKeywords`: `<Textarea>` from `@/components/ui/textarea`
   - `enableTrendAnalysis`: `<Switch>` same as enabled
   - `promptStyle`: `<Textarea>` same as seoKeywords

8. **shadcn Tabs vs Accordion?** Both exist in `client/src/components/ui/` but neither is used in admin sections. Admin sections all use custom button strips. Do NOT use shadcn Tabs or Accordion — follow the `IntegrationsSection` custom button pattern.

9. **API response shapes:** Documented above. Key: `GET /api/blog/settings` returns full row or defaults. `POST /api/blog/generate` returns `{ jobId, postId, post }` OR `{ skipped, reason }` OR `{ error }` at 500.

10. **Where should new component live?** Co-locate inside `BlogSection.tsx` (following `EstimatesSection`/`PresentationsSection` pattern) if it stays under ~200 lines. Otherwise extract to `client/src/components/admin/BlogAutomationPanel.tsx` and import into `BlogSection.tsx`.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure client-side UI + existing API endpoints)

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Manual QA only (per CLAUDE.md: "No test framework available — verify critical flows manually").

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (CLAUDE.md: manual QA only) |
| Config file | None |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-17 | Automation tab renders all 5 fields + Save button | manual | `npm run check` (TS only) | N/A |
| BLOG-18 | Generate Now shows spinner → success/skip toast | manual | `npm run check` (TS only) | N/A |
| BLOG-19 | "Last generated" + job status display | manual | `npm run check` (TS only) | N/A |

### Wave 0 Gaps
None — existing infrastructure (`npm run check`) is sufficient. No test files to create.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `client/src/components/admin/BlogSection.tsx` — existing component structure, isSaved pattern
- Direct inspection: `client/src/components/admin/IntegrationsSection.tsx` — custom tab strip pattern
- Direct inspection: `client/src/components/admin/BrandGuidelinesSection.tsx` — settings form + save mutation
- Direct inspection: `client/src/components/admin/EstimatesSection.tsx` — `formatDistanceToNow` usage
- Direct inspection: `client/src/components/admin/ChatSection.tsx` — Switch usage pattern
- Direct inspection: `server/routes/blogAutomation.ts` — API response shapes verified
- Direct inspection: `shared/schema/blog.ts` — BlogSettings + BlogGenerationJob types
- Direct inspection: `server/storage.ts:653-656` + `1790-1823` — confirmed no `getLatestBlogGenerationJob` exists

### Secondary (MEDIUM confidence)
- None required — all findings from direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in codebase
- Architecture: HIGH — verified against 4 canonical admin components
- Pitfalls: HIGH — derived from direct code inspection and API contract
- GAP (BLOG-19): HIGH — absence of `getLatestBlogGenerationJob` confirmed by full interface scan

**Research date:** 2026-04-22
**Valid until:** Stable — no external dependencies, codebase-derived findings

---

## Summary of What Phase 24 Must Build

| Artifact | Type | Notes |
|----------|------|-------|
| `BlogAutomationPanel` | React component | Co-located in `BlogSection.tsx` or extracted file |
| Tab strip in `BlogSection` | JSX modification | Add "Posts" / "Automation" tabs wrapping existing content |
| `getLatestBlogGenerationJob()` | Storage method | IStorage interface + DatabaseStorage impl |
| `GET /api/blog/jobs/latest` | Express route | In `blogAutomation.ts`, admin-auth, returns latest job or null |
| Settings form | 5 fields | enabled (Switch), postsPerDay (Select), seoKeywords (Textarea), enableTrendAnalysis (Switch), promptStyle (Textarea) |
| Save button | PUT mutation | isSaved pattern, invalidates `/api/blog/settings` |
| Generate Now button | POST mutation | Spinner on pending, success/skip/error toasts |
| Status bar | Display only | `lastRunAt` via formatDistanceToNow + job status badge |
