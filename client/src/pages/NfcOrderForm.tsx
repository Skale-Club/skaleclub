import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";

const FORM_SLUG = "nfc-keychain-order";

export default function NfcOrderForm() {
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("Complete your NFC keychain order | Skale Club");

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    const previousRobots = robots?.content;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, follow";

    return () => {
      document.title = previousTitle;
      if (created) robots?.remove();
      else if (robots && previousRobots !== undefined) robots.content = previousRobots;
    };
  }, [t]);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#10151e] text-[#e3e7ee] [color-scheme:dark]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 py-5 sm:px-8 sm:py-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            {settings?.logoMain ? (
              <img src={settings.logoMain} alt={settings.companyName || "Skale Club"} width={54} height={54} className="h-auto w-[54px] object-contain" />
            ) : (
              <span className="font-display text-sm font-bold tracking-[0.18em] text-[#f3f5f8]">SKALE CLUB</span>
            )}
            <span className="border-l border-white/10 pl-3 text-xs font-bold uppercase tracking-[0.18em] text-[#a9bcef]">
              {t("NFC order")}
            </span>
          </Link>
          <Link
            href="/nfc-guide"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[#171e2a]/85 px-4 py-2 text-sm font-semibold text-[#cdd3dc] transition hover:border-[#8fa9ee]/60 hover:bg-[#222b3a] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("Read the keychain guide")}</span>
            <span className="sm:hidden">{t("Guide")}</span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16 lg:py-10">
          <aside className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8fa9ee]">
              {t("Order details")}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-[1.04] tracking-[-0.025em] text-[#f3f5f8]">
              {t("Everything we need to prepare your order.")}
            </h1>
            <p className="mt-5 text-sm leading-6 text-[#a7afbc]">
              {t("Answer one question at a time. Your progress is saved automatically on this device.")}
            </p>
            <div className="mt-8 border-l-2 border-[#8fa9ee] bg-[#161d28]/90 p-6 text-sm leading-6 text-[#cdd3dc] shadow-[0_22px_60px_rgba(0,0,0,.28)]">
              <p className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8fa9ee]" />
                {t("No payment is taken on this page")}
              </p>
              <p className="mt-4 flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8fa9ee]" />
                {t("We confirm the design and final price before production")}
              </p>
            </div>
          </aside>

          <LeadFormModal open onClose={() => {}} formSlug={FORM_SLUG} mode="page" />
        </div>
      </div>
    </main>
  );
}
