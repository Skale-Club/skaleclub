import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Sparkles, Home, CalendarCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";

const Lottie = lazy(() => import("lottie-react"));

export default function LeadThankYou() {
  const { t, language } = useTranslation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const [successAnimation, setSuccessAnimation] = useState<object | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Warm the lazy chunk now so the library and the JSON download in parallel.
    void import("lottie-react");
    void import("../assets/success-animation.json").then((mod) => {
      if (!cancelled) setSuccessAnimation((mod.default ?? mod) as object);
    });
    return () => { cancelled = true; };
  }, []);

  // Thank-you pages should never be indexed or crawled — they're
  // per-submission confirmations, not content worth surfacing in search.
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const existed = Boolean(meta);
    const previousContent = meta?.getAttribute("content") ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    return () => {
      if (!meta) return;
      if (existed && previousContent !== null) {
        meta.setAttribute("content", previousContent);
      } else {
        meta.remove();
      }
    };
  }, []);

  const companyName = companySettings?.companyName || "Company Name";
  const headline = t(`Thank you for trusting ${companyName}.`);
  const formSlug = useMemo(() => new URLSearchParams(window.location.search).get("form"), []);
  const isNfcLead = formSlug === "nfc-keychain-leads";
  const isGroupLead = formSlug === "skale-hub-group";

  // Xphere visit booking CTA (quick 260906-g80). Open-redirect guard: only
  // accept URLs on Xphere's public booking host.
  const bookingUrl = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('booking');
    return raw && raw.startsWith('https://xphere.app/') ? raw : null;
  }, []);

  const heroGradient = `
    linear-gradient(
      to right bottom,
      #09152d,
      #0b152a,
      #0d1427,
      #0f1424,
      #101421,
      #121622,
      #151723,
      #171924,
      #1c1c29,
      #21202e,
      #262332,
      #2c2637
    )
  `;

  return (
    <div
      className="w-full text-white overflow-hidden flex items-center pt-16"
      style={{ background: heroGradient, minHeight: 'calc(100vh - 120px)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 flex-shrink-0">
                <Suspense fallback={<div className="w-16 h-16" />}>
                  {successAnimation && (
                    <Lottie
                      animationData={successAnimation}
                      loop={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                </Suspense>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#5173D6]/10 text-blue-200 text-xs font-semibold border border-[#5173D6]/30">
                {t('We received your information')}
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white">{headline}</h1>
            <p className="mt-4 text-slate-200 text-lg leading-relaxed">
              {t(isGroupLead
                ? 'You are in. We will add you to the Skale Hub WhatsApp group using the number you provided.'
                : isNfcLead
                  ? 'Your NFC keychain request was submitted successfully. We will review the quantity, artwork, and preferred contact method, then contact you on WhatsApp.'
                  : 'Your form was submitted successfully. A specialist from our team will review the information and contact you shortly for the next step.')}
            </p>
            {bookingUrl && (
              <div className="mt-6">
                <a
                  href={bookingUrl}
                  data-testid="link-book-visit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5173D6] hover:bg-[#3B5BBE] text-white font-semibold py-3.5 text-lg shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <CalendarCheck className="w-5 h-5" />
                  {t('Schedule your visit')}
                </a>
                <p className="mt-2 text-sm text-slate-300">
                  {t('Pick the day and time that work best for you. It only takes a minute.')}
                </p>
              </div>
            )}
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <Link href="/">
                <button
                  className={
                    bookingUrl
                      ? "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 transition-all"
                      : "w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5173D6] hover:bg-[#3B5BBE] text-white font-semibold py-3 shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all"
                  }
                >
                  <Home className="w-4 h-4" />
                  {t('Back to website')}
                </button>
              </Link>
              {isNfcLead && (
                <Link href={language === "pt" ? "/nfc-pricing/br" : "/nfc-pricing"}>
                  <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold py-3 transition-all">
                    <Sparkles className="w-4 h-4" />
                    {t('Review pricing and details')}
                  </button>
                </Link>
              )}
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {t(isGroupLead
                ? 'Keep your WhatsApp available. We will use the number you provided.'
                : isNfcLead
                  ? 'Keep your WhatsApp available. We will use the number you provided in the form.'
                  : 'Keep your preferred contact channel available so our team can reach you.')}
            </p>
          </div>

          <div className="hidden md:block">
            <div className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#5173D6,transparent_35%),radial-gradient(circle_at_80%_0%,#60a5fa,transparent_30%),radial-gradient(circle_at_50%_80%,#3b82f6,transparent_25%)]" />
              <div className="relative space-y-4">
                <p className="text-sm text-slate-200/90">{t('Next steps')}</p>
                <div className="space-y-3 text-sm text-white/90">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#5173D6]/20 border border-[#5173D6]/30 flex items-center justify-center text-blue-300 font-bold text-sm">1</span>
                    <span>{t(isGroupLead ? 'We check the number you provided.' : isNfcLead ? 'We review your quantity, logo, and the link you want the NFC tap to open.' : 'Our team reviews your answers and identifies the best plan.')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#5173D6]/20 border border-[#5173D6]/30 flex items-center justify-center text-blue-300 font-bold text-sm">2</span>
                    <span>{t(isGroupLead ? 'We add you to the Skale Hub WhatsApp group.' : isNfcLead ? 'We contact you on WhatsApp to confirm the artwork, total, and production window.' : 'We will contact you to align objectives and next steps.')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#5173D6]/20 border border-[#5173D6]/30 flex items-center justify-center text-blue-300 font-bold text-sm">3</span>
                    <span>{t(isGroupLead ? 'You get the live announcements straight on WhatsApp.' : isNfcLead ? 'Production starts after payment and your artwork approval.' : 'You receive a summary of the initial plan and practical instructions.')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
