import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { HomepageContent } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getImageUrl } from '@/components/admin/shared/utils';

type OurServicesCard = NonNullable<NonNullable<HomepageContent['ourServicesSection']>['cards']>[number];

interface OurServiceDetailModalProps {
  card: OurServicesCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OurServiceDetailModal({ card, isOpen, onClose }: OurServiceDetailModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    history.pushState({ __ourServiceModal: true }, '');
    let triggeredByPopstate = false;
    const onPopState = () => {
      triggeredByPopstate = true;
      onClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (
        !triggeredByPopstate &&
        (window.history.state as { __ourServiceModal?: boolean } | null)?.__ourServiceModal
      ) {
        history.back();
      }
    };
  }, [isOpen, onClose]);

  if (!card) return null;
  const features = Array.isArray(card.features) ? card.features : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0a0f18] to-[#0d1320] p-0 text-white [&>button]:hidden">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image sits in its own side column on desktop so it can never take
            over the popup; on mobile it collapses to a short banner above the
            text instead of a full-width hero. object-contain everywhere —
            these are illustrations, cropping them loses the subject. */}
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-8 md:p-8">
          {card.imageUrl && (
            <div className="aspect-[16/9] w-full self-start overflow-hidden rounded-2xl border bg-white/5 md:aspect-[4/3]">
              <img
                src={getImageUrl(card.imageUrl, { width: 800, quality: 85 })}
                alt={card.title}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <div className="min-w-0">
            <DialogTitle className="mb-2 pr-10 text-2xl font-bold text-white md:text-3xl">{card.title}</DialogTitle>
            {card.subtitle && <p className="mb-4 text-lg text-slate-300">{t(card.subtitle)}</p>}
            {card.description && (
              <p className="mb-6 whitespace-pre-line leading-relaxed text-slate-300">{t(card.description)}</p>
            )}

            {features.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-medium text-white/80"
                  >
                    {t(f)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
