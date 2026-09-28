import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { LeadFormModal } from "@/components/LeadFormModal";
import { useTranslation } from "@/hooks/useTranslation";

const FORM_SLUG = "nfc-keychain-order";

export default function NfcOrderForm() {
  const { t } = useTranslation();

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
    <main className="relative min-h-screen overflow-hidden bg-[#071326] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(64,110,241,.3), transparent 30%), radial-gradient(circle at 85% 80%, rgba(15,190,180,.16), transparent 28%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1120px] flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-[#0a1c3d]">
              S
            </span>
            <div>
              <p className="font-display text-sm font-bold tracking-[0.18em]">SKALE CLUB</p>
              <p className="text-xs text-blue-200/70">{t("NFC order")}</p>
            </div>
          </div>
          <Link
            href="/nfc-guide"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-blue-100 transition-colors hover:border-white/30 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("Read the keychain guide")}</span>
            <span className="sm:hidden">{t("Guide")}</span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-10">
          <aside className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
              {t("Order details")}
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">
              {t("Everything we need to prepare your order.")}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {t("Answer one question at a time. Your progress is saved automatically on this device.")}
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-200">
              <p className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                {t("No payment is taken on this page")}
              </p>
              <p className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
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
