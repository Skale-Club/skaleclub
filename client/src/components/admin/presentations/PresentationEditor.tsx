import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, ExternalLink, Presentation } from 'lucide-react';
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

export function PresentationEditor({
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
