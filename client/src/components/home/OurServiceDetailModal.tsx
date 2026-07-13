import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { HomepageContent } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-0 border-0 [&>button]:hidden">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-10">
          {card.imageUrl && (
            <div className="w-full aspect-[16/10] mb-6 rounded-2xl overflow-hidden border bg-slate-100 flex items-center justify-center">
              <img
                src={getImageUrl(card.imageUrl, { width: 1000, quality: 85 })}
                alt={card.title}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{card.title}</h2>
          {card.subtitle && <p className="text-lg text-slate-600 mb-4">{t(card.subtitle)}</p>}
          {card.description && (
            <p className="text-slate-700 leading-relaxed mb-6 whitespace-pre-line">{t(card.description)}</p>
          )}

          {features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {features.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {t(f)}
                </span>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
