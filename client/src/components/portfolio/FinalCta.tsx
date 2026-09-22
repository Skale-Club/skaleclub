import { useTranslation } from "@/hooks/useTranslation";
import { getImageUrl } from "@/components/admin/shared/utils";

/**
 * Closing band: copy and the same CTA on the left, a tilted stack of real app
 * screens bleeding off the right edge.
 */
export function FinalCta({
  title,
  subtitle,
  buttonText,
  whatsapp,
  screens,
  onCta,
}: {
  title: string;
  subtitle?: string;
  buttonText: string;
  whatsapp?: string;
  screens: string[];
  onCta: () => void;
}) {
  const { t } = useTranslation();
  const shots = screens.slice(0, 3);

  return (
    <section className="pf-cta" id="cta">
      <div className="pf-cta__inner container-custom container-page mx-auto">
        <div className="pf-cta__copy">
          <span className="pf-cta__pill">{t("Next step")}</span>
          <h2 className="pf-cta__title">{title}</h2>
          {subtitle && <p className="pf-cta__sub">{subtitle}</p>}
          <div className="pf-cta__actions">
            <button
              type="button"
              onClick={onCta}
              className="inline-flex items-center gap-2 rounded-full bg-cta px-7 py-4 font-bold text-white transition-colors hover:bg-cta-hover"
            >
              {buttonText} <span aria-hidden="true">→</span>
            </button>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#B4C0D8] transition-colors hover:text-white"
              >
                {t("or talk on WhatsApp")} ↗
              </a>
            )}
          </div>
        </div>

        {shots.length > 0 && (
          <div className="pf-cta__stage" aria-hidden="true">
            {shots.map((src, i) => (
              <span key={src} className={`pf-cta__shot pf-cta__shot--${i}`}>
                <img src={getImageUrl(src, { width: 1000, quality: 80 })} alt="" loading="lazy" decoding="async" />
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
