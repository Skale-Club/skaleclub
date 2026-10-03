import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { EditorialCard } from "@/components/editorial";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { usePageSeo } from "@/hooks/use-seo";
import type { TranslationKey } from "@/lib/translations";

/**
 * Full-screen order page around a priced order form (/nfc-order, /plaque-order).
 * Same chrome for every product; only the form, the badge, the tab title and
 * the back link change. Props are TranslationKeys so every label has a PT entry.
 */
export function OrderFormPage({
  formSlug,
  badge,
  documentTitle,
  backHref,
  backLabel,
  backLabelShort,
}: {
  formSlug: string;
  badge: TranslationKey;
  documentTitle: TranslationKey;
  backHref: string;
  backLabel: TranslationKey;
  backLabelShort: TranslationKey;
}) {
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  // Order form: never indexed (the server sends the same noindex header and meta).
  usePageSeo({ title: "", noindex: true });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t(documentTitle);
    return () => {
      document.title = previousTitle;
    };
  }, [t, documentTitle]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-900 pattern-grid-dark text-fog-200">
      <div className="container-editorial relative flex min-h-screen flex-col py-5 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            {settings?.logoMain ? (
              <img src={settings.logoMain} alt={settings.companyName || "Skale Club"} width={54} height={54} className="h-auto w-[54px] object-contain" />
            ) : (
              <span className="font-display text-sm font-bold tracking-[0.18em] text-fog-50">SKALE CLUB</span>
            )}
            <span className="border-l border-white/10 pl-3 text-xs font-bold uppercase tracking-[0.18em] text-cta-softer">
              {t(badge)}
            </span>
          </Link>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-navy-800/85 px-4 py-2 text-sm font-semibold text-fog-300 transition hover:border-cta-soft/60 hover:bg-navy-600 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t(backLabel)}</span>
            <span className="sm:hidden">{t(backLabelShort)}</span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16 lg:py-10">
          <aside className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cta-soft">
              {t("Order details")}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.04] tracking-[-0.025em] text-fog-50">
              {t("Everything we need to prepare your order.")}
            </h1>
            <p className="mt-5 text-sm leading-6 text-fog-400">
              {t("Answer one question at a time. Your progress is saved automatically on this device.")}
            </p>
            <EditorialCard tone="dark" accent className="mt-8 bg-navy-800/90 text-sm leading-6 text-fog-300 shadow-[0_22px_60px_rgba(0,0,0,.28)] sm:p-6">
              <p className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft" />
                {t("No payment is taken on this page")}
              </p>
              <p className="mt-4 flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft" />
                {t("We confirm the design and final price before production")}
              </p>
            </EditorialCard>
          </aside>

          <LeadFormModal open onClose={() => {}} formSlug={formSlug} mode="page" />
        </div>
      </div>
    </main>
  );
}
