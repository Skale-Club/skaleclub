import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, ChevronLeft, CircleDot, Code2, ExternalLink,
  Layers, Presentation, Trash2, Wand2,
} from 'lucide-react';
import { AdminCard, SectionHeader } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  createPresentationThumbnailDataUrl,
  getPresentationThumbnailSignature,
} from '@/lib/thumbnails';
import type { PresentationWithStats, SlideBlock } from '@shared/schema';
import { SlidePreview } from '@/components/SlideRenderer';

// ─── Quick AI prompts ──────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'More concise', value: 'Make this slide more concise and impactful while keeping the essential information.' },
  { label: 'Improve PT', value: 'Improve the Portuguese translation (headingPt, bodyPt, bulletsPt) to natural, fluent PT-BR.' },
  { label: 'More impact', value: 'Rewrite the heading to be more powerful and the body to be more persuasive.' },
  { label: 'Regenerate', value: 'Completely regenerate this slide while keeping the same layout and overall presentation theme.' },
];

// ─── SlideCard ─────────────────────────────────────────────────────────────────

function SlideCard({
  slide, index, selected, isFirst, isLast, onClick, onDelete, onMoveUp, onMoveDown,
}: {
  slide: SlideBlock;
  index: number;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={`group rounded-lg border transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
      }`}
    >
      <button onClick={onClick} className="w-full text-left p-3 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">
            {index + 1}
          </span>
          <Badge variant="outline" className="text-xs font-mono capitalize">{slide.layout}</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate pl-7">
          {slide.heading ?? slide.headingPt ?? '—'}
        </p>
      </button>
      <div className="flex items-center justify-end gap-0.5 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Move up"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          title="Move down"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/20 text-destructive"
          title="Delete slide"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── SlideDetailPanel ──────────────────────────────────────────────────────────

function SlideDetailPanel({
  slide, index, presentationId, onSlidesUpdated, onSlideEdited, isImproving, setIsImproving,
}: {
  slide: SlideBlock;
  index: number;
  presentationId: string;
  onSlidesUpdated: (slides: SlideBlock[]) => void;
  onSlideEdited: (updated: SlideBlock) => void;
  isImproving: boolean;
  setIsImproving: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [heading, setHeading] = useState(slide.heading ?? '');
  const [headingPt, setHeadingPt] = useState(slide.headingPt ?? '');
  const [body, setBody] = useState(slide.body ?? '');
  const [bodyPt, setBodyPt] = useState(slide.bodyPt ?? '');
  const [bullets, setBullets] = useState(slide.bullets?.join('\n') ?? '');
  const [bulletsPt, setBulletsPt] = useState(slide.bulletsPt?.join('\n') ?? '');
  const [attribution, setAttribution] = useState(slide.attribution ?? '');
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    setHeading(slide.heading ?? '');
    setHeadingPt(slide.headingPt ?? '');
    setBody(slide.body ?? '');
    setBodyPt(slide.bodyPt ?? '');
    setBullets(slide.bullets?.join('\n') ?? '');
    setBulletsPt(slide.bulletsPt?.join('\n') ?? '');
    setAttribution(slide.attribution ?? '');
  }, [slide]);

  function handleApplyEdits() {
    const updated: SlideBlock = {
      ...slide,
      heading: heading || undefined,
      headingPt: headingPt || undefined,
      body: body || undefined,
      bodyPt: bodyPt || undefined,
      bullets: bullets ? bullets.split('\n').filter(Boolean) : undefined,
      bulletsPt: bulletsPt ? bulletsPt.split('\n').filter(Boolean) : undefined,
      attribution: attribution || undefined,
    };
    onSlideEdited(updated);
    toast({ title: t('Slides saved') });
  }

  async function handleImprove() {
    if (!instruction.trim()) return;
    setIsImproving(true);
    try {
      const message = `Edit only slide at index ${index}: ${instruction.trim()}. Keep all other slides identical.`;
      const response = await fetch(`/api/presentations/${presentationId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'done' && Array.isArray(data.slides)) {
              onSlidesUpdated(data.slides);
              setInstruction('');
              toast({ title: t('Slide improved') });
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }
    } catch (err: any) {
      toast({ title: t('Failed to improve slide'), description: err.message, variant: 'destructive' });
    } finally {
      setIsImproving(false);
    }
  }

  const hasBullets = slide.layout === 'bullets';
  const hasAttribution = slide.layout === 'quote';

  return (
    <div className="space-y-5">
      {/* Live slide thumbnail */}
      <SlidePreview slide={slide} lang="en" scale={0.38} className="rounded-md border shadow-sm" />

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground font-mono">#{index + 1}</span>
        <Badge variant="outline" className="capitalize">{slide.layout}</Badge>
      </div>

      {/* Editable fields */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Heading EN</Label>
            <Input value={heading} onChange={(e) => setHeading(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Heading PT</Label>
            <Input value={headingPt} onChange={(e) => setHeadingPt(e.target.value)} className="text-sm" />
          </div>
        </div>

        {!hasBullets && !hasAttribution && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Body EN</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="text-sm resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Body PT</Label>
              <Textarea value={bodyPt} onChange={(e) => setBodyPt(e.target.value)} rows={3} className="text-sm resize-none" />
            </div>
          </div>
        )}

        {hasBullets && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bullets EN</Label>
              <Textarea
                value={bullets}
                onChange={(e) => setBullets(e.target.value)}
                rows={4}
                placeholder={t('One bullet per line')}
                className="text-sm resize-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bullets PT</Label>
              <Textarea
                value={bulletsPt}
                onChange={(e) => setBulletsPt(e.target.value)}
                rows={4}
                placeholder={t('One bullet per line')}
                className="text-sm resize-none font-mono"
              />
            </div>
          </div>
        )}

        {hasAttribution && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Attribution</Label>
            <Input value={attribution} onChange={(e) => setAttribution(e.target.value)} className="text-sm" />
          </div>
        )}

        <Button onClick={handleApplyEdits} variant="outline" size="sm" className="gap-2">
          {t('Apply')}
        </Button>
      </div>

      {/* AI improve */}
      <div className="space-y-2 pt-3 border-t">
        <p className="text-sm font-medium">{t('Improve with AI')}</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => setInstruction(p.value)}
              disabled={isImproving}
              className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <Textarea
          placeholder={t('Give AI instructions to improve this slide')}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          disabled={isImproving}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleImprove(); }}
        />
        <Button onClick={handleImprove} disabled={!instruction.trim() || isImproving} className="w-full gap-2">
          {isImproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {isImproving ? t('Improving...') : t('Improve this slide')}
        </Button>
      </div>
    </div>
  );
}

// ─── PresentationEditor ───────────────────────────────────────────────────────

export function PresentationEditor({
  presentation,
  onBack,
}: {
  presentation: PresentationWithStats;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(presentation.slides ?? [], null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedSlides, setParsedSlides] = useState<SlideBlock[]>(presentation.slides ?? []);

  const saveMutation = useMutation({
    mutationFn: async (slides: SlideBlock[]) => {
      const response = await apiRequest('PUT', `/api/presentations/${presentation.id}`, { slides });
      const saved = await response.json() as PresentationWithStats;
      return { saved, slides };
    },
    onSuccess: async ({ slides: savedSlides }) => {
      const sig = getPresentationThumbnailSignature({ title: presentation.title, slides: savedSlides });
      if (presentation.thumbnailSignature !== sig) {
        try {
          const url = await createPresentationThumbnailDataUrl({ title: presentation.title, slides: savedSlides });
          await apiRequest('PUT', `/api/presentations/${presentation.id}/thumbnail`, {
            thumbnailUrl: url,
            thumbnailSignature: sig,
          });
        } catch (err) {
          console.warn('Failed to cache presentation thumbnail', err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/presentations/slug/${presentation.slug}`] });
      localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(savedSlides));
      setIsDirty(false);
      toast({ title: t('Slides saved') });
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slides'), description: err.message, variant: 'destructive' });
    },
  });

  function syncSlides(slides: SlideBlock[], autoSave = false) {
    setParsedSlides(slides);
    setJsonText(JSON.stringify(slides, null, 2));
    localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(slides));
    if (autoSave) {
      saveMutation.mutate(slides);
    } else {
      setIsDirty(true);
    }
  }

  function handleJsonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      setParsedSlides(parsed);
      setIsDirty(true);
      localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(parsed));
    } catch (err: any) {
      setJsonError(err.message);
    }
  }

  function handleSlideEdited(updated: SlideBlock) {
    if (selectedIndex === null) return;
    const newSlides = parsedSlides.map((s, i) => (i === selectedIndex ? updated : s));
    syncSlides(newSlides, true);
  }

  function handleDeleteSlide(index: number) {
    const newSlides = parsedSlides.filter((_, i) => i !== index);
    setSelectedIndex((prev) => {
      if (prev === null || newSlides.length === 0) return null;
      if (prev >= newSlides.length) return newSlides.length - 1;
      if (prev > index) return prev - 1;
      return prev;
    });
    syncSlides(newSlides, true);
  }

  function handleMoveSlide(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= parsedSlides.length) return;
    const newSlides = [...parsedSlides];
    [newSlides[index], newSlides[target]] = [newSlides[target], newSlides[index]];
    setSelectedIndex(target);
    syncSlides(newSlides, true);
  }

  const selectedSlide = selectedIndex !== null ? parsedSlides[selectedIndex] ?? null : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={presentation.title}
        description={`${parsedSlides.length} ${t('slides')}`}
        icon={<Presentation className="w-5 h-5" />}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            {isDirty && mode === 'json' && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <CircleDot className="w-3 h-3" />
                {t('Unsaved changes')}
              </span>
            )}
            <Button
              variant={mode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('visual')}
              className="gap-1"
            >
              <Layers className="w-4 h-4" />
              {t('Slides')}
            </Button>
            <Button
              variant={mode === 'json' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('json')}
              className="gap-1"
            >
              <Code2 className="w-4 h-4" />
              JSON
            </Button>
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
            {mode === 'json' && (
              <Button
                onClick={() => saveMutation.mutate(parsedSlides)}
                disabled={!!jsonError || saveMutation.isPending}
                size="sm"
                className="gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('Save')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('Back to presentations')}
            </Button>
          </div>
        }
      />

      {mode === 'visual' ? (
        <AdminCard>
          <div className="flex gap-6" style={{ minHeight: '520px' }}>
            {/* Left: slide list */}
            <div className="w-56 shrink-0 space-y-2 overflow-y-auto max-h-[620px] pr-1">
              {parsedSlides.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('No slides yet')}</p>
              ) : (
                parsedSlides.map((slide, i) => (
                  <SlideCard
                    key={i}
                    slide={slide}
                    index={i}
                    selected={selectedIndex === i}
                    isFirst={i === 0}
                    isLast={i === parsedSlides.length - 1}
                    onClick={() => setSelectedIndex(i)}
                    onDelete={() => handleDeleteSlide(i)}
                    onMoveUp={() => handleMoveSlide(i, 'up')}
                    onMoveDown={() => handleMoveSlide(i, 'down')}
                  />
                ))
              )}
            </div>

            {/* Right: detail + AI */}
            <div className="flex-1 border-l pl-6 overflow-y-auto max-h-[620px]">
              {selectedSlide ? (
                <SlideDetailPanel
                  slide={selectedSlide}
                  index={selectedIndex!}
                  presentationId={presentation.id}
                  onSlidesUpdated={(slides) => syncSlides(slides, true)}
                  onSlideEdited={handleSlideEdited}
                  isImproving={isImproving}
                  setIsImproving={setIsImproving}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {t('Select a slide to edit')}
                </div>
              )}
            </div>
          </div>
        </AdminCard>
      ) : (
        <AdminCard>
          <div className="space-y-3">
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
          </div>
        </AdminCard>
      )}
    </div>
  );
}
