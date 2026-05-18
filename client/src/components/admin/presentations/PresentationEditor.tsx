import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ChevronLeft, Code2, ExternalLink, Layers, Presentation, Wand2,
} from 'lucide-react';
import { AdminCard, SectionHeader } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

// ─── SlideCard ─────────────────────────────────────────────────────────────────

function SlideCard({
  slide,
  index,
  selected,
  onClick,
}: {
  slide: SlideBlock;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 space-y-1 transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono w-5 shrink-0 text-right">
          {index + 1}
        </span>
        <Badge variant="outline" className="text-xs font-mono capitalize">
          {slide.layout}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate pl-7">
        {slide.heading ?? slide.headingPt ?? '—'}
      </p>
    </button>
  );
}

// ─── SlideDetailPanel ──────────────────────────────────────────────────────────

function SlideDetailPanel({
  slide,
  index,
  presentationId,
  onSlidesUpdated,
  isImproving,
  setIsImproving,
}: {
  slide: SlideBlock;
  index: number;
  presentationId: string;
  onSlidesUpdated: (slides: SlideBlock[]) => void;
  isImproving: boolean;
  setIsImproving: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [instruction, setInstruction] = useState('');

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

  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Layout', value: slide.layout },
    { label: 'Heading EN', value: slide.heading },
    { label: 'Heading PT', value: slide.headingPt },
    { label: 'Body EN', value: slide.body },
    { label: 'Body PT', value: slide.bodyPt },
  ];
  if (slide.bullets?.length) fields.push({ label: 'Bullets EN', value: slide.bullets.join(' · ') });
  if (slide.bulletsPt?.length) fields.push({ label: 'Bullets PT', value: slide.bulletsPt.join(' · ') });
  if (slide.stats?.length) {
    fields.push({ label: 'Stats', value: slide.stats.map((s) => `${s.label}: ${s.value}`).join(' · ') });
  }
  if (slide.attribution) fields.push({ label: 'Attribution', value: slide.attribution });
  if (slide.style?.bgImageUrl) fields.push({ label: 'Background image', value: slide.style.bgImageUrl });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground font-mono">#{index + 1}</span>
        <Badge variant="outline" className="capitalize">{slide.layout}</Badge>
      </div>

      <div className="space-y-2">
        {fields.filter((f) => f.value).map(({ label, value }) => (
          <div key={label} className="rounded-md bg-muted/30 border px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm text-foreground line-clamp-3">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-3 border-t">
        <p className="text-sm font-medium">{t('Improve with AI')}</p>
        <Textarea
          placeholder={t('Give AI instructions to improve this slide')}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          disabled={isImproving}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleImprove();
          }}
        />
        <p className="text-xs text-muted-foreground">Ctrl+Enter para enviar</p>
        <Button
          onClick={handleImprove}
          disabled={!instruction.trim() || isImproving}
          className="w-full gap-2"
        >
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

  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(presentation.slides ?? [], null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [parsedSlides, setParsedSlides] = useState<SlideBlock[]>(presentation.slides ?? []);

  function handleSlidesUpdated(slides: SlideBlock[]) {
    setParsedSlides(slides);
    setJsonText(JSON.stringify(slides, null, 2));
    localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(slides));
  }

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

  useEffect(() => {
    if (jsonError) return;
    localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(parsedSlides));
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
      localStorage.setItem(`presentation_draft_${presentation.slug}`, JSON.stringify(parsedSlides));
      toast({ title: t('Slides saved') });
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slides'), description: err.message, variant: 'destructive' });
    },
  });

  const selectedSlide = selectedIndex !== null ? parsedSlides[selectedIndex] ?? null : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={presentation.title}
        description={`${parsedSlides.length} ${t('slides')}`}
        icon={<Presentation className="w-5 h-5" />}
        action={
          <div className="flex flex-wrap gap-2">
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
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!!jsonError || saveMutation.isPending || isImproving}
              size="sm"
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('Save')}
            </Button>
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
            <div className="w-56 shrink-0 space-y-2 overflow-y-auto max-h-[600px] pr-1">
              {parsedSlides.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('No slides yet')}</p>
              ) : (
                parsedSlides.map((slide, i) => (
                  <SlideCard
                    key={i}
                    slide={slide}
                    index={i}
                    selected={selectedIndex === i}
                    onClick={() => setSelectedIndex(i)}
                  />
                ))
              )}
            </div>

            {/* Right: detail + AI */}
            <div className="flex-1 border-l pl-6 overflow-y-auto max-h-[600px]">
              {selectedSlide ? (
                <SlideDetailPanel
                  slide={selectedSlide}
                  index={selectedIndex!}
                  presentationId={presentation.id}
                  onSlidesUpdated={handleSlidesUpdated}
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
