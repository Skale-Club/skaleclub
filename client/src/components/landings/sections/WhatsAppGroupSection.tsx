// Phase 43 — `whatsappGroup` section type.
// Extracted verbatim from pages/SkaleHubGroup.tsx — same visual design, same
// form behavior, same UTM tracking, same POST to /api/forms/skale-hub-group/leads.
// Only the plumbing changed: hardcoded strings became optional props with
// defaults that preserve the current production look.

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowRight, CheckCircle2, Loader2, Radio, Sparkles, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PhoneCountrySelect } from "@/components/ui/PhoneCountrySelect";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  detectDefaultPhoneCountry,
  formatPhoneForCountry,
  getInternationalPhone,
  isValidPhoneForCountry,
  type PhoneCountry,
} from "@/lib/phoneCountries";

// All optional — defaults preserve the current SkaleHubGroup look verbatim.
export const whatsAppGroupPropsSchema = z.object({
  badgeLabel: z.string().optional(),
  groupName: z.string().optional(),
  groupSubtitle: z.string().optional(),
  groupLabel: z.string().optional(),
  groupOfficialLabel: z.string().optional(),
  socialProofLabel: z.string().optional(),
  headline: z.string().optional(),
  headlineAccent: z.string().optional(),
  subheadline: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  formTitle: z.string().optional(),
  formSubtitle: z.string().optional(),
  formHelper: z.string().optional(),
  phoneCountryAriaLabel: z.string().optional(),
  submitLabel: z.string().optional(),
  privacyLabel: z.string().optional(),
  submitEndpoint: z.string().optional(),
  successTitle: z.string().optional(),
  successBody: z.string().optional(),
  toastSuccessTitle: z.string().optional(),
  toastSuccessBody: z.string().optional(),
  toastErrorTitle: z.string().optional(),
  phoneInvalidPrefix: z.string().optional(),
});
export type WhatsAppGroupProps = z.infer<typeof whatsAppGroupPropsSchema>;

const DEFAULTS = {
  badgeLabel: "Skale Hub",
  groupName: "Skale Hub",
  groupSubtitle: "Grupo aberto para novos membros",
  groupLabel: "Lives",
  groupOfficialLabel: "Grupo oficial",
  socialProofLabel: "Avisos e conteúdos das lives",
  headline: "Receba os avisos das lives semanais",
  headlineAccent: "no seu WhatsApp",
  subheadline:
    "Aquisição de clientes nos EUA, Google Ads, Meta Ads, CRM, automação e IA toda semana, ao vivo.",
  bullets: [
    "Lives toda semana sobre crescimento de negócios",
    "Avisos antecipados direto no WhatsApp",
    "Conteúdo prático e aplicável imediatamente",
  ],
  formTitle: "Entrar no grupo gratuito",
  formSubtitle: "Seu número do WhatsApp",
  formHelper: "Use o número que você acessa o WhatsApp.",
  phoneCountryAriaLabel: "País do telefone",
  submitLabel: "Entrar no grupo do WhatsApp",
  privacyLabel: "🔒 Sem spam. Só avisos de lives. Saia quando quiser.",
  submitEndpoint: "/api/forms/skale-hub-group/leads",
  successTitle: "Recebemos suas informações",
  successBody: "Em breve alguém da nossa equipe entrará em contato com você.",
  toastSuccessTitle: "Informações recebidas!",
  toastSuccessBody: "Em breve alguém da nossa equipe entrará em contato com você.",
  toastErrorTitle: "Não foi possível registrar",
  phoneInvalidPrefix: "Digite um número válido para",
} as const;

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function readUtmParams() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    urlOrigem: window.location.href,
    utmSource: p.get("utm_source") || undefined,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
  };
}

export function WhatsAppGroupSection({ props }: { props: WhatsAppGroupProps }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());
  const [submitted, setSubmitted] = useState(false);

  // Resolved display values — props override defaults, defaults preserve the original look.
  const badgeLabel = props.badgeLabel ?? DEFAULTS.badgeLabel;
  const groupName = props.groupName ?? DEFAULTS.groupName;
  const groupSubtitle = props.groupSubtitle ?? DEFAULTS.groupSubtitle;
  const groupLabel = props.groupLabel ?? DEFAULTS.groupLabel;
  const groupOfficialLabel = props.groupOfficialLabel ?? DEFAULTS.groupOfficialLabel;
  const socialProofLabel = props.socialProofLabel ?? DEFAULTS.socialProofLabel;
  const headline = props.headline ?? DEFAULTS.headline;
  const headlineAccent = props.headlineAccent ?? DEFAULTS.headlineAccent;
  const subheadline = props.subheadline ?? DEFAULTS.subheadline;
  const bullets = props.bullets ?? DEFAULTS.bullets;
  const formTitle = props.formTitle ?? DEFAULTS.formTitle;
  const formSubtitle = props.formSubtitle ?? DEFAULTS.formSubtitle;
  const formHelper = props.formHelper ?? DEFAULTS.formHelper;
  const phoneCountryAriaLabel = props.phoneCountryAriaLabel ?? DEFAULTS.phoneCountryAriaLabel;
  const submitLabel = props.submitLabel ?? DEFAULTS.submitLabel;
  const privacyLabel = props.privacyLabel ?? DEFAULTS.privacyLabel;
  const submitEndpoint = props.submitEndpoint ?? DEFAULTS.submitEndpoint;
  const successTitle = props.successTitle ?? DEFAULTS.successTitle;
  const successBody = props.successBody ?? DEFAULTS.successBody;
  const toastSuccessTitle = props.toastSuccessTitle ?? DEFAULTS.toastSuccessTitle;
  const toastSuccessBody = props.toastSuccessBody ?? DEFAULTS.toastSuccessBody;
  const toastErrorTitle = props.toastErrorTitle ?? DEFAULTS.toastErrorTitle;
  const phoneInvalidPrefix = props.phoneInvalidPrefix ?? DEFAULTS.phoneInvalidPrefix;

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0a0f0d";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  const phoneHasValue = phone.trim().length > 0;
  const phoneIsValid = phoneHasValue && isValidPhoneForCountry(phone, selectedCountry);
  const phoneError = phoneHasValue && !phoneIsValid
    ? `${phoneInvalidPrefix} ${selectedCountry.name}.`
    : null;

  const payload = useMemo(() => ({
    phone: getInternationalPhone(phone, selectedCountry),
    ...readUtmParams(),
  }), [phone, selectedCountry]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", submitEndpoint, payload);
      return res.json() as Promise<{ success: boolean; leadId: number }>;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: toastSuccessTitle,
        description: toastSuccessBody,
      });
    },
    onError: (err: Error) => {
      toast({ title: toastErrorTitle, description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 bg-[#0a0f0d] text-white">
      {/* Top gradient blob */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_70%_60%_at_60%_-5%,rgba(37,211,102,0.12),transparent)]" />

      <section className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-9 px-4 pt-[calc(5rem+36px)] pb-9 sm:px-6 lg:grid-cols-[1fr_437px] lg:px-8">

        {/* ── Left column ── */}
        <div className="text-center lg:text-left">

          {/* Skale Hub badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#25D366]">
            <Sparkles className="h-3 w-3" />
            {badgeLabel}
          </div>

          {/* WhatsApp group info + social proof — mesma linha */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
            {/* Grupo WA */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] shadow-lg shadow-[#25D366]/30">
                <WhatsAppIcon className="h-9 w-9 text-white" />
              </div>
              <div className="flex flex-col gap-0.5 text-left">
                <span className="text-xs text-white/40">{groupOfficialLabel}</span>
                <span className="flex items-center gap-2 text-lg font-bold text-white">
                  {groupName}
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  {groupLabel}
                </span>
                <span className="text-xs text-[#25D366]">{groupSubtitle}</span>
              </div>
            </div>

            {/* Membros ativos */}
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {["#25D366", "#128C7E", "#075E54", "#34C75A"].map((color, i) => (
                  <div key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0a0f0d] text-[10px] font-bold text-white" style={{ backgroundColor: color }}>
                    {["M", "A", "P", "R"][i]}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Users className="h-3.5 w-3.5 text-white/50" />
                {socialProofLabel}
              </div>
            </div>
          </div>

          <h1 className="mt-8 text-[clamp(2.5rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-white">
            {headline} <span className="text-[#25D366]">{headlineAccent}</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-white/50">
            {subheadline}
          </p>

          <ul className="mt-5 space-y-1.5 text-xs text-white/40">
              {bullets.map((item) => (
                <li key={item} className="flex items-center justify-center gap-2 lg:justify-start">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#25D366]" />
                  {item}
                </li>
              ))}
            </ul>
        </div>

        {/* ── Right column: form card + social proof ── */}
        <div className="w-full space-y-5">
          <div className="overflow-hidden rounded-2xl bg-[#111a14] shadow-2xl shadow-black/40 ring-1 ring-white/10">

            {/* Card header */}
            <div className="flex items-center gap-4 bg-[#25D366] px-7 py-5">
              <WhatsAppIcon className="h-8 w-8 shrink-0 text-white" />
              <p className="text-xl font-bold text-white">{formTitle}</p>
              <Radio className="ml-auto h-7 w-7 text-white/80 animate-pulse" />
            </div>

            {/* Card body */}
            <div className="p-7">
              {submitted ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#25D366]/10">
                    <WhatsAppIcon className="h-10 w-10 text-[#25D366]" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-white">{successTitle}</h2>
                  <p className="mt-3 text-base leading-7 text-white/50">
                    {successBody}
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (phoneIsValid && !submitMutation.isPending) submitMutation.mutate();
                  }}
                >
                  <div>
                    <p className="text-base font-semibold text-white">{formSubtitle}</p>
                    <p className="mt-1 text-sm text-white/40">
                      {formHelper}
                    </p>
                  </div>

                  <div className={`flex overflow-hidden rounded-xl border bg-white/5 transition-colors ${phoneError ? "border-red-300" : "border-white/10 focus-within:border-[#25D366]"}`}>
                    <PhoneCountrySelect
                      ariaLabel={phoneCountryAriaLabel}
                      value={selectedCountry}
                      onChange={(c) => {
                        setSelectedCountry(c);
                        setPhone((cur) => formatPhoneForCountry(cur, c));
                      }}
                      buttonClassName="min-h-14 rounded-none border-0 bg-transparent text-white text-base hover:bg-white/10"
                    />
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={selectedCountry.placeholder}
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneForCountry(e.target.value, selectedCountry))}
                      className="min-h-14 border-0 bg-transparent text-base text-white placeholder:text-white/50 focus-visible:ring-0"
                      data-testid="input-skale-hub-group-phone"
                    />
                  </div>

                  {phoneError && (
                    <p className="text-xs text-red-500">{phoneError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!phoneIsValid || submitMutation.isPending}
                    data-testid="button-skale-hub-group-submit"
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] py-4 text-base font-bold text-white shadow-md shadow-[#25D366]/30 transition-all hover:bg-[#22c55e] hover:shadow-[#25D366]/40 disabled:opacity-50"
                  >
                    {submitMutation.isPending
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <WhatsAppIcon className="h-5 w-5" />
                    }
                    {submitLabel}
                    {!submitMutation.isPending && <ArrowRight className="h-5 w-5" />}
                  </button>

                  <p className="text-center text-sm text-white/30">
                    {privacyLabel}
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
