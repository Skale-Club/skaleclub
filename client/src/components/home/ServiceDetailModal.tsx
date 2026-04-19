import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import type { PortfolioService } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { badgeColorMap } from '@/components/PortfolioCard';

const checkColorMap: Record<string, string> = {
  blue: "text-blue-500",
  purple: "text-purple-400",
  green: "text-green-500",
  orange: "text-orange-500",
  red: "text-red-500",
};

interface ServiceDetailModalProps {
  service: PortfolioService | null;
  isOpen: boolean;
  onClose: () => void;
  onCta: () => void;
}

export function ServiceDetailModal({ service, isOpen, onClose, onCta }: ServiceDetailModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !service) return null;

  const badgeColors = badgeColorMap[service.accentColor || 'blue'] || badgeColorMap.blue;
  const checkColor = checkColorMap[service.accentColor || 'blue'] || checkColorMap.blue;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <span className={`inline-block ${badgeColors.bg} ${badgeColors.text} text-xs font-bold px-3 py-1 rounded-full mb-4`}>
                {t(service.badgeText)}
              </span>

              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                {t(service.title)}
              </h2>

              <p className="text-lg text-slate-600 mb-6">
                {t(service.subtitle)}
              </p>

              <p className="text-slate-700 mb-8 leading-relaxed">
                {t(service.description)}
              </p>

              <div className="bg-slate-50 border rounded-2xl p-6 mb-8">
                <div className="flex items-baseline gap-2 mb-4 text-slate-900">
                  <span className="text-4xl font-extrabold">{service.price}</span>
                  <span className="text-slate-500 font-medium">{t(service.priceLabel)}</span>
                </div>
                <ul className="space-y-3">
                  {(service.features || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-5 h-5 ${checkColor} shrink-0 mt-0.5`} />
                      <span className="text-slate-700 font-medium">{t(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onCta();
                }}
                className="w-full px-8 py-4 bg-primary text-white font-bold rounded-full text-lg hover:shadow-lg hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                {t(service.ctaText)}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {service.imageUrl && (
              <div className="flex-1 hidden md:block">
                <div className="aspect-square relative flex items-center justify-center bg-slate-100 border rounded-3xl shadow-xl overflow-hidden">
                  <img
                    src={service.imageUrl}
                    alt={service.title}
                    className="w-[80%] h-[80%] object-cover rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
