import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, LayoutPanelLeft, Loader2, Upload, Video, X } from 'lucide-react';
import { AdminCard, SectionHeader } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { isReservedSlug } from '@shared/reservedSlugs';
import type { LandingPage } from '@shared/schema';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Section types currently registered. Update as the registry grows.
// Plan 43-05 adds `whatsappGroup`.
const AVAILABLE_TYPES = [
  'hero',
  'trustBadges',
  'services',
  'reviews',
  'blog',
  'about',
  'areasServed',
  'leadFormCta',
];

interface LandingEditorProps {
  landingId: string;
  onBack: () => void;
}

interface SectionShape {
  type: string;
  props: Record<string, unknown>;
}

/**
 * Validate the parsed sections value. Returns null on success, error string on failure.
 * Allows empty arrays (UI surfaces a non-blocking warning instead).
 */
function validateSections(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Sections must be a JSON array.';
  for (let i = 0; i < value.length; i++) {
    const section = value[i];
    if (typeof section !== 'object' || section === null || Array.isArray(section)) {
      return `Section ${i + 1} must be a JSON object.`;
    }
    const s = section as Record<string, unknown>;
    if (typeof s.type !== 'string' || s.type.length === 0) {
      return `Section ${i + 1}: "type" must be a non-empty string.`;
    }
    if (s.props === undefined || s.props === null || typeof s.props !== 'object' || Array.isArray(s.props)) {
      return `Section ${i + 1}: "props" must be an object.`;
    }
  }
  return null;
}

function HeroVideoPanel({
  sectionsText,
  onPatch,
}: {
  sectionsText: string;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Only show when sections contain a heroWebsites entry.
  let currentVideoUrl: string | null = null;
  try {
    const sections = JSON.parse(sectionsText);
    const hero = sections.find((s: any) => s.type === 'heroWebsites');
    currentVideoUrl = hero?.props?.bgVideoUrl ?? null;
  } catch { /* invalid JSON */ }

  const hasHero = (() => {
    try { return JSON.parse(sectionsText).some((s: any) => s.type === 'heroWebsites'); }
    catch { return false; }
  })();

  if (!hasHero) return null;

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'webm'].includes(ext ?? '')) {
      toast({ title: 'Only .mp4 and .webm files are supported', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const signRes = await apiRequest('POST', '/api/uploads/landing-media/sign', { filename: file.name });
      const { uploadUrl, publicUrl } = await signRes.json();
      const up = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!up.ok) throw new Error('Upload to storage failed');
      onPatch({ bgVideoUrl: publicUrl });
      toast({ title: 'Video uploaded', description: 'Save the landing to apply.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-muted-foreground" />
        <Label className="text-base font-semibold">Hero background video</Label>
        <span className="text-xs text-muted-foreground ml-1">.mp4 or .webm</span>
      </div>

      {currentVideoUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border text-sm">
          <Video className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate flex-1 font-mono text-xs text-muted-foreground">{currentVideoUrl}</span>
          <button
            type="button"
            onClick={() => onPatch({ bgVideoUrl: null })}
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove video"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No video set — hero uses the gradient background.</p>
      )}

      <input ref={fileRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading…' : currentVideoUrl ? 'Replace video' : 'Upload video'}
      </button>
    </AdminCard>
  );
}

export function LandingEditor({ landingId, onBack }: LandingEditorProps) {
  const { toast } = useToast();

  const queryKey = useMemo(() => [`/api/landing-pages/${landingId}`] as const, [landingId]);

  const { data: landing, isLoading, error } = useQuery<LandingPage>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/landing-pages/${landingId}`);
      return res.json();
    },
  });

  // Local edit state — synced from server data once loaded.
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [pageLanguage, setPageLanguage] = useState<'en' | 'pt'>('pt');
  const [alternateSlug, setAlternateSlug] = useState('');
  const [sectionsText, setSectionsText] = useState('[]');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!landing) return;
    setName(landing.name);
    setSlug(landing.slug);
    setIsActive(landing.isActive);
    setPageLanguage(landing.language === 'en' ? 'en' : 'pt');
    setAlternateSlug(landing.alternateSlug ?? '');
    const sections = Array.isArray(landing.sections) ? landing.sections : [];
    setSectionsText(JSON.stringify(sections, null, 2));
    setParseError(null);
  }, [landing]);

  let slugError: string | null = null;
  if (slug.length > 0) {
    if (!SLUG_PATTERN.test(slug)) {
      slugError = 'Slug must be lowercase letters, digits, and single hyphens between segments.';
    } else if (isReservedSlug(slug)) {
      slugError = `"${slug}" is a reserved slug — pick a different one.`;
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      slug: string;
      isActive: boolean;
      language: 'en' | 'pt';
      alternateSlug: string | null;
      sections: SectionShape[];
    }) => {
      const res = await apiRequest('PUT', `/api/landing-pages/${landingId}`, payload);
      return res.json() as Promise<LandingPage>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-pages'] });
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Landing saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    setParseError(null);

    // 1. Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(sectionsText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      setParseError(msg);
      toast({ title: 'Invalid JSON', description: msg, variant: 'destructive' });
      return;
    }

    // 2. Validate shape
    const shapeError = validateSections(parsed);
    if (shapeError) {
      setParseError(shapeError);
      toast({ title: 'Invalid sections', description: shapeError, variant: 'destructive' });
      return;
    }

    const sections = parsed as SectionShape[];

    // 3. Empty-array warning (non-blocking — per CONTEXT.md, save still proceeds)
    if (sections.length === 0) {
      setParseError('A landing must have at least one section.');
      toast({
        title: 'A landing must have at least one section.',
        description: 'The landing was not saved — add at least one section and try again.',
        variant: 'destructive',
      });
      return;
    }

    // 4. Slug validation
    if (slug.trim().length === 0 || slugError) {
      toast({ title: 'Fix the slug before saving', variant: 'destructive' });
      return;
    }
    if (name.trim().length === 0) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    saveMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      isActive,
      language: pageLanguage,
      alternateSlug: alternateSlug.trim() || null,
      sections,
    });
  };

  const patchHeroSections = (patch: Record<string, unknown>) => {
    try {
      const sections = JSON.parse(sectionsText);
      const idx = sections.findIndex((s: any) => s.type === 'heroWebsites');
      if (idx === -1) return;
      sections[idx] = { ...sections[idx], props: { ...sections[idx].props, ...patch } };
      setSectionsText(JSON.stringify(sections, null, 2));
    } catch { /* invalid JSON — silently ignore */ }
  };

  const previewHref = isActive && landing ? `/${landing.slug}` : null;

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !landing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-to-landings">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to landings
        </Button>
        <AdminCard>
          <p className="text-sm text-destructive">
            Failed to load landing: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={landing.name}
        description={`/${landing.slug}`}
        icon={<LayoutPanelLeft className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/${landing.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              title="Open in new tab"
            >
              /{landing.slug} <ExternalLink className="w-3 h-3" />
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              data-testid="button-back-to-landings"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        }
      />

      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-landing-name">Name</Label>
            <Input
              id="edit-landing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              data-testid="input-edit-landing-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-landing-slug">Slug</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
              <Input
                id="edit-landing-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                maxLength={80}
                className="pl-7 font-mono"
                data-testid="input-edit-landing-slug"
              />
            </div>
            {slugError ? (
              <p className="text-xs text-destructive">{slugError}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-landing-language">Language</Label>
            <Select value={pageLanguage} onValueChange={(v) => setPageLanguage(v === 'en' ? 'en' : 'pt')}>
              <SelectTrigger id="edit-landing-language" data-testid="select-edit-landing-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português (pt-BR)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Drives the page chrome language and is the t() source ('en') vs translation ('pt').
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-landing-alternate-slug">Alternate slug</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
              <Input
                id="edit-landing-alternate-slug"
                value={alternateSlug}
                onChange={(e) => setAlternateSlug(e.target.value.toLowerCase())}
                maxLength={80}
                placeholder="websites-br"
                className="pl-7 font-mono"
                data-testid="input-edit-landing-alternate-slug"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Slug of this page in the other language (powers hreflang). Optional.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Switch
            id="edit-landing-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid="switch-edit-landing-active"
          />
          <Label htmlFor="edit-landing-active" className="cursor-pointer">
            Active {isActive ? null : <span className="text-muted-foreground text-xs">(public URL returns 404)</span>}
          </Label>
        </div>
      </AdminCard>

      <HeroVideoPanel sectionsText={sectionsText} onPatch={patchHeroSections} />

      <AdminCard className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Label htmlFor="edit-landing-sections" className="text-base font-semibold">
              Sections (JSON)
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Available types: {AVAILABLE_TYPES.join(', ')}
            </p>
          </div>
        </div>
        <Textarea
          id="edit-landing-sections"
          value={sectionsText}
          onChange={(e) => {
            setSectionsText(e.target.value);
            if (parseError) setParseError(null);
          }}
          spellCheck={false}
          className="font-mono text-xs min-h-[400px] resize-y"
          data-testid="textarea-edit-landing-sections"
        />
        {parseError ? (
          <p className="text-sm text-destructive" data-testid="error-edit-landing-sections">
            {parseError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Each section must be {'{ "type": "...", "props": {...} }'}. Per-type prop validation runs at render time.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save-landing"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
      </AdminCard>
    </div>
  );
}
