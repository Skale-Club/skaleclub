import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, Radio, ShieldCheck } from "lucide-react";

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

const FEATURES = [
  { icon: Radio, text: "Lives semanais sobre crescimento" },
  { icon: MessageCircle, text: "Avisos direto no WhatsApp" },
  { icon: ShieldCheck, text: "Conteúdo prático e aplicável" },
];

export default function SkaleHubGroup() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());
  const [submitted, setSubmitted] = useState(false);

  // Ensure background fills the full viewport including the main flex gap
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0d1117";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  const phoneHasValue = phone.trim().length > 0;
  const phoneIsValid = phoneHasValue && isValidPhoneForCountry(phone, selectedCountry);
  const phoneError = phoneHasValue && !phoneIsValid
    ? `Digite um número válido para ${selectedCountry.name}.`
    : null;

  const payload = useMemo(() => ({
    phone: getInternationalPhone(phone, selectedCountry),
    ...readUtmParams(),
  }), [phone, selectedCountry]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/forms/skale-hub-group/leads", payload);
      return res.json() as Promise<{ success: boolean; leadId: number }>;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Cadastro recebido!", description: "Você receberá os avisos pelo WhatsApp." });
    },
    onError: (err: Error) => {
      toast({ title: "Não foi possível registrar", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 bg-[#0d1117] text-white">
      {/* Subtle gradient top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(28,83,163,0.35),transparent)]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center justify-center gap-16 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8">

        {/* ── Left: copy ── */}
        <div className="flex-1 text-center lg:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#1C53A3]">
            <Radio className="h-3.5 w-3.5" />
            Skale Hub
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
            Entre no grupo<br className="hidden sm:block" /> das lives ao vivo
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-white/60 lg:max-w-sm">
            Aquisição de clientes nos EUA, Google Ads, Meta Ads,
            CRM, automação e IA — toda semana, ao vivo.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center justify-center gap-3 text-sm text-white/70 lg:justify-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C53A3]/20">
                  <Icon className="h-3.5 w-3.5 text-[#1C53A3]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: form card ── */}
        <div className="w-full max-w-sm shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
            {submitted ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </span>
                <h2 className="mt-5 text-xl font-bold">Você está dentro!</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Recebemos seu número. Você vai receber os próximos avisos do Skale Hub pelo WhatsApp.
                </p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (phoneIsValid && !submitMutation.isPending) submitMutation.mutate();
                }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#1C53A3]">Acesso gratuito</p>
                  <h2 className="mt-1.5 text-xl font-bold">Coloque seu WhatsApp</h2>
                  <p className="mt-1 text-sm text-white/50">
                    Número pelo qual você quer receber os avisos.
                  </p>
                </div>

                <div className={`flex overflow-hidden rounded-lg border bg-white/5 ${phoneError ? "border-red-500/50" : "border-white/10"} focus-within:border-[#1C53A3]/60 transition-colors`}>
                  <PhoneCountrySelect
                    aria-label="País do telefone"
                    value={selectedCountry}
                    onChange={(c) => {
                      setSelectedCountry(c);
                      setPhone((cur) => formatPhoneForCountry(cur, c));
                    }}
                    buttonClassName="min-h-11 rounded-none border-0 bg-transparent text-white"
                  />
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={selectedCountry.format}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneForCountry(e.target.value, selectedCountry))}
                    className="min-h-11 border-0 bg-transparent text-white placeholder:text-white/30 focus-visible:ring-0"
                    data-testid="input-skale-hub-group-phone"
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-red-400">{phoneError}</p>
                )}

                <button
                  type="submit"
                  disabled={!phoneIsValid || submitMutation.isPending}
                  data-testid="button-skale-hub-group-submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFFF01] px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {submitMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ArrowRight className="h-4 w-4" />
                  }
                  Entrar no grupo
                </button>

                <p className="text-center text-xs text-white/30">
                  Sem spam. Só avisos de lives.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
