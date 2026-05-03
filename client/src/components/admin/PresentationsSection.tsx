import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, Copy, ExternalLink, Eye, Layers, Plus, Presentation, Trash2, Search, X } from 'lucide-react';
import { PageThumbnail } from '@/components/ui/PageThumbnail';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import { BrandGuidelinesSection } from './BrandGuidelinesSection';
import {
  createPresentationThumbnailDataUrl,
  getPresentationThumbnailSignature,
} from '@/lib/thumbnails';
import type { PresentationWithStats, SlideBlock } from '@shared/schema';

// ─── SlideCard ────────────────────────────────────────────────────────────────

function SlideCard({ slide }: { slide: SlideBlock; index: number }) {
  return (
    <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
      <Badge variant="outline" className="text-xs font-mono capitalize">
        {slide.layout}
      </Badge>
      <p className="text-xs text-muted-foreground truncate">
        {slide.heading ?? slide.headingPt ?? slide.layout}
      </p>
    </div>
  );
}

// ─── PresentationEditor ───────────────────────────────────────────────────────

function normalizePresentationSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function PresentationEditor({
  presentation,
  onBack,
}: {
  presentation: PresentationWithStats;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(presentation.slides ?? [], null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedSlides, setParsedSlides] = useState<SlideBlock[]>(
    presentation.slides ?? [],
  );

  function handleJsonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      setParsedSlides(parsed);
    } catch (err: any) {
      setJsonError(err.message);
    }
  }

  // Auto-save draft to localStorage so the preview tab can pick up edits in real time
  useEffect(() => {
    if (jsonError) return;
    localStorage.setItem(
      `presentation_draft_${presentation.slug}`,
      JSON.stringify(parsedSlides),
    );
  }, [parsedSlides, presentation.slug, jsonError]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', `/api/presentations/${presentation.id}`, {
        slides: parsedSlides,
      });
      return response.json() as Promise<PresentationWithStats>;
    },
    onSuccess: async () => {
      const thumbnailSignature = getPresentationThumbnailSignature({
        title: presentation.title,
        slides: parsedSlides,
      });

      if (presentation.thumbnailSignature !== thumbnailSignature) {
        try {
          const thumbnailUrl = await createPresentationThumbnailDataUrl({
            title: presentation.title,
            slides: parsedSlides,
          });
          await apiRequest('PUT', `/api/presentations/${presentation.id}/thumbnail`, {
            thumbnailUrl,
            thumbnailSignature,
          });
        } catch (err) {
          console.warn('Failed to cache presentation thumbnail', err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/slug/${presentation.slug}`] });
      // Keep draft in localStorage so any open preview tab stays in sync; storage event will refetch
      localStorage.setItem(
        `presentation_draft_${presentation.slug}`,
        JSON.stringify(parsedSlides),
      );
      toast({ title: t('Slides saved') });
    },
    onError: (err: any) => {
      toast({
        title: t('Failed to save slides'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title={presentation.title}
        description={`${parsedSlides.length} ${t('slides')}`}
        icon={<Presentation className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(parsedSlides));
                window.open(`/p/${presentation.slug}?edit=1`, '_blank');
              }}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {t('Preview')}
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('Back to presentations')}
            </Button>
          </div>
        }
      />

      <AdminCard>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: JSON editor */}
          <div className="flex-1 min-w-0 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              {t('JSON — paste Claude Code output here')}
            </p>
            <Textarea
              value={jsonText}
              onChange={handleJsonChange}
              rows={20}
              className="font-mono text-sm resize-y min-h-[300px]"
            />
            {jsonError && (
              <p className="text-xs text-destructive">
                {t('Invalid JSON')}: {jsonError}
              </p>
            )}
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!!jsonError || saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {t('Save')}
              </Button>
            </div>
          </div>

          {/* Right: Slide mini-cards */}
          <div className="w-full lg:w-72 space-y-3">
            <p className="text-sm font-medium">{t('Slide preview')}</p>
            {parsedSlides.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('No slides yet')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {parsedSlides.map((slide, i) => (
                  <SlideCard key={i} slide={slide} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminCard>
    </div>
  );
}

// ─── PresentationsSection (main export) ──────────────────────────────────────

export function PresentationsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PresentationWithStats | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null);
  const [slugValue, setSlugValue] = useState('');
  const skipSlugBlurRef = useRef(false);
  const thumbnailJobsRef = useRef(new Set<string>());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newSlugEdited, setNewSlugEdited] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  
  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const { data: queryData, isLoading } = useQuery<{ data: PresentationWithStats[], total: number }>({
    queryKey: ['/api/presentations', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', offset.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      return fetch(`/api/presentations?${params.toString()}`).then(r => r.json());
    },
  });

  const presentations = queryData?.data ?? [];
  const totalItems = queryData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  useEffect(() => {
    if (!newSlugEdited) {
      setNewSlug(normalizePresentationSlug(newTitle));
    }
  }, [newTitle, newSlugEdited]);

  useEffect(() => {
    presentations.forEach((presentation) => {
      const thumbnailSignature = getPresentationThumbnailSignature(presentation);
      if (presentation.thumbnailUrl && presentation.thumbnailSignature === thumbnailSignature) return;

      const jobKey = `${presentation.id}:${thumbnailSignature}`;
      if (thumbnailJobsRef.current.has(jobKey)) return;
      thumbnailJobsRef.current.add(jobKey);

      void (async () => {
        try {
          const thumbnailUrl = await createPresentationThumbnailDataUrl(presentation);
          await apiRequest('PUT', `/api/presentations/${presentation.id}/thumbnail`, {
            thumbnailUrl,
            thumbnailSignature,
          });
          const applyThumbnail = (current: { data: PresentationWithStats[]; total: number } | undefined) =>
            current
              ? {
                  ...current,
                  data: current.data.map((row) =>
                    row.id === presentation.id
                      ? { ...row, thumbnailUrl, thumbnailSignature }
                      : row,
                  ),
                }
              : current;

          queryClient.setQueryData<{ data: PresentationWithStats[]; total: number }>(
            ['/api/presentations', page, debouncedSearch],
            applyThumbnail,
          );
          queryClient.setQueriesData<{ data: PresentationWithStats[]; total: number }>(
            { queryKey: ['/api/presentations'] },
            applyThumbnail,
          );
        } catch (err) {
          console.warn('Failed to cache presentation thumbnail', err);
        } finally {
          thumbnailJobsRef.current.delete(jobKey);
        }
      })();
    });
  }, [debouncedSearch, page, presentations]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; slug: string }) =>
      apiRequest('POST', '/api/presentations', data).then((r) => r.json()),
    onSuccess: (newPres: { id: string; slug: string; slides: SlideBlock[] }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      toast({ title: t('Presentation created') });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewSlug('');
      setNewSlugEdited(false);
      setSelectedId(newPres.id);
    },
    onError: (err: any) => {
      toast({
        title: t('Failed to create presentation'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiRequest('PUT', `/api/presentations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setRenamingId(null);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slides'), description: err.message, variant: 'destructive' });
      setRenamingId(null);
    },
  });

  function commitRename(id: string) {
    const trimmed = renamingTitle.trim();
    if (!trimmed) return setRenamingId(null);
    const current = presentations.find((p) => p.id === id);
    if (current && trimmed !== current.title) {
      renameMutation.mutate({ id, title: trimmed });
    } else {
      setRenamingId(null);
    }
  }

  const slugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const response = await apiRequest('PUT', `/api/presentations/${id}`, { slug });
      const updated = (await response.json()) as PresentationWithStats;
      if (updated.slug !== slug) {
        throw new Error(`Server did not save the slug. Returned: ${updated.slug}`);
      }
      return updated;
    },
    onSuccess: (updatedPresentation, variables) => {
      const savedSlug = updatedPresentation.slug || variables.slug;
      const updatePresentationSlug = (current: { data: PresentationWithStats[]; total: number } | undefined) =>
        current
          ? {
              ...current,
              data: current.data.map((presentation) =>
                presentation.id === variables.id
                  ? { ...presentation, slug: savedSlug, version: updatedPresentation.version ?? presentation.version + 1 }
                  : presentation,
              ),
            }
          : current;

      queryClient.setQueryData<{ data: PresentationWithStats[]; total: number }>(
        ['/api/presentations', page, debouncedSearch],
        updatePresentationSlug,
      );
      queryClient.setQueriesData<{ data: PresentationWithStats[]; total: number }>(
        { queryKey: ['/api/presentations'] },
        updatePresentationSlug,
      );
      setEditingSlugId(null);
      setSlugValue('');
      toast({ title: t('Slug saved') });
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slug'), description: err.message, variant: 'destructive' });
    },
  });

  function startSlugEdit(presentation: PresentationWithStats) {
    skipSlugBlurRef.current = false;
    setEditingSlugId(presentation.id);
    setSlugValue(presentation.slug);
  }

  function commitSlug(presentation: PresentationWithStats, value = slugValue) {
    if (skipSlugBlurRef.current) {
      skipSlugBlurRef.current = false;
      return;
    }

    const slug = normalizePresentationSlug(value);

    if (!slug) {
      setSlugValue(presentation.slug);
      return;
    }

    if (slug !== presentation.slug) {
      setSlugValue(slug);
      slugMutation.mutate({ id: presentation.id, slug });
      return;
    }

    setEditingSlugId(null);
    setSlugValue('');
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/presentations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setDeleteTarget(null);
      toast({ title: t('Presentation deleted') });
    },
    onError: (err: any) => {
      toast({
        title: t('Failed to delete presentation'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  function handleCopyLink(slug: string) {
    navigator.clipboard
      .writeText(`${window.location.origin}/p/${slug}`)
      .then(() => toast({ title: t('Link copied') }))
      .catch(() =>
        toast({ title: t('Copy failed'), variant: 'destructive' }),
      );
  }

  // Editor sub-view
  if (selectedId !== null) {
    const selected = presentations.find((p) => p.id === selectedId);
    if (!selected) {
      // Was deleted while editor was open — fall back to list
      setSelectedId(null);
    } else {
      return (
        <PresentationEditor
          key={selectedId}
          presentation={selected}
          onBack={() => setSelectedId(null)}
        />
      );
    }
  }

  // List view
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Presentations')}
        description={t(
          'Build AI-powered slide decks and share them as immersive fullscreen experiences.',
        )}
        icon={<Presentation className="w-5 h-5" />}
        action={
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={t('Search presentations...')}
                className="pl-9 pr-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              {t('New Presentation')}
            </Button>
          </div>
        }
      />

      <AdminCard>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : presentations.length === 0 ? (
          <EmptyState
            title={t('No presentations yet')}
            description={t('Create your first presentation to get started.')}
          />
        ) : (
          <div className="space-y-3">
            {presentations.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 border rounded-lg p-4 bg-card md:flex-row md:items-center"
              >
                <PageThumbnail thumbnailUrl={p.thumbnailUrl} title={`${p.title} thumbnail`} />
                <div className="min-w-0 flex-1 space-y-2">
                  {renamingId === p.id ? (
                    <Input
                      autoFocus
                      value={renamingTitle}
                      onChange={(e) => setRenamingTitle(e.target.value)}
                      onBlur={() => commitRename(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(p.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="h-8 text-sm font-semibold"
                    />
                  ) : (
                    <span
                      className="block font-semibold text-sm truncate cursor-pointer hover:underline"
                      title={t('Click to rename')}
                      onClick={() => { setRenamingId(p.id); setRenamingTitle(p.title); }}
                    >
                      {p.title}
                    </span>
                  )}
                  {editingSlugId === p.id ? (
                    <div className="flex h-6 max-w-xs items-center overflow-hidden rounded border bg-background focus-within:ring-1 focus-within:ring-ring">
                      <span className="shrink-0 border-r bg-muted/50 px-2 text-[10px] font-mono leading-5 text-muted-foreground">
                        /p/
                      </span>
                      <Input
                        autoFocus
                        value={slugValue}
                        onChange={(e) => setSlugValue(e.target.value)}
                        onBlur={(e) => commitSlug(p, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            skipSlugBlurRef.current = true;
                            setEditingSlugId(null);
                            setSlugValue('');
                          }
                        }}
                        disabled={slugMutation.isPending}
                        aria-label={t('Presentation slug')}
                        className="h-5 min-w-0 border-0 bg-transparent px-2 text-[9px] font-mono leading-5 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startSlugEdit(p)}
                      className="inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[10px] font-mono leading-4 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      title={t('Edit slug')}
                    >
                      <span className="truncate">/p/{p.slug}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Layers className="w-3 h-3" />
                    {p.slideCount}
                  </Badge>
                </div>
                <div className="flex gap-1 shrink-0 self-start md:self-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('Open presentation')}
                    onClick={() => window.open(`/p/${p.slug}`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('Link copied')}
                    onClick={() => handleCopyLink(p.slug)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedId(p.id)}
                  >
                    {t('Open Editor')}
                  </Button>
                </div>
              </div>
            ))}
            
            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={page === p}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Delete confirmation */}
      {deleteTarget && (
        <AlertDialog
          open={true}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Delete presentation?')}</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{deleteTarget.title}&quot; —{' '}
                {t(
                  'This will permanently remove this presentation. This action cannot be undone.',
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="border-none hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('Delete')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create presentation dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => {
        setIsCreateOpen(o);
        if (!o) {
          setNewTitle('');
          setNewSlug('');
          setNewSlugEdited(false);
        }
      }}>
        <DialogContent className="sm:max-w-sm border-0">
          <DialogHeader>
            <DialogTitle>{t('New Presentation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-title" className="text-xs">{t('Title')}</Label>
              <Input
                id="new-title"
                autoFocus
                placeholder="e.g. Acme Corp Q2 2025"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim() && newSlug.trim() && !createMutation.isPending) {
                    createMutation.mutate({ title: newTitle.trim(), slug: newSlug.trim() });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-slug" className="text-xs">{t('Slug')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/p/</span>
                <Input
                  id="new-slug"
                  placeholder="acme-corp-q2-2025"
                  value={newSlug}
                  onChange={(e) => {
                    setNewSlug(normalizePresentationSlug(e.target.value));
                    setNewSlugEdited(true);
                  }}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTitle.trim() && newSlug.trim() && !createMutation.isPending) {
                      createMutation.mutate({ title: newTitle.trim(), slug: newSlug.trim() });
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>{t('Cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate({ title: newTitle.trim(), slug: newSlug.trim() })}
              disabled={!newTitle.trim() || !newSlug.trim() || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Guidelines always visible below presentations list */}
      <BrandGuidelinesSection />
    </div>
  );
}
