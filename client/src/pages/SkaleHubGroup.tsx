import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, MessageCircle, Radio, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  if (typeof window === "undefined") {
    return {};
  }

  const params = new URLSearchParams(window.location.search);
  return {
    urlOrigem: window.location.href,
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
  };
}

export default function SkaleHubGroup() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());
  const [submitted, setSubmitted] = useState(false);

  const phoneHasValue = phone.trim().length > 0;
  const phoneIsValid = phoneHasValue && isValidPhoneForCountry(phone, selectedCountry);
  const phoneError = phoneHasValue && !phoneIsValid
    ? `Digite um telefone válido para ${selectedCountry.name}.`
    : null;

  const payload = useMemo(() => ({
    phone: getInternationalPhone(phone, selectedCountry),
    ...readUtmParams(),
  }), [phone, selectedCountry]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/forms/skale-hub-group/leads", payload);
      return response.json() as Promise<{ success: boolean; leadId: number }>;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Cadastro recebido",
        description: "Vamos usar esse telefone para te colocar no radar do Skale Hub.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível registrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(64,110,241,0.20),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_36%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#406EF1]/15 bg-white/80 px-4 py-2 text-sm font-semibold text-[#355CD0] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Skale Hub
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
              Entre no grupo da live do Skale Hub
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Acompanhe os avisos das próximas lives sobre aquisição de clientes nos Estados Unidos, Google Ads, Meta Ads, CRM, automação e IA.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <Radio className="h-4 w-4 text-[#406EF1]" />
                Lives semanais
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <MessageCircle className="h-4 w-4 text-[#406EF1]" />
                Avisos no WhatsApp
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-[#406EF1]" />
                Conteúdo prático
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-2xl shadow-[#406EF1]/10 backdrop-blur">
            {submitted ? (
              <div className="flex min-h-[320px] flex-col justify-center rounded-xl bg-emerald-50 p-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h2 className="mt-5 text-2xl font-semibold text-emerald-950">Você está na lista</h2>
                <p className="mt-3 text-sm leading-6 text-emerald-800">
                  Recebemos seu telefone. Agora você pode receber os próximos avisos do Skale Hub pelo WhatsApp.
                </p>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (phoneIsValid && !submitMutation.isPending) {
                    submitMutation.mutate();
                  }
                }}
              >
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#406EF1]">Entrada rápida</p>
                  <h2 className="mt-2 text-2xl font-semibold">Coloque seu WhatsApp</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use o número que você prefere receber os avisos das lives.
                  </p>
                </div>

                <div>
                  <div className={`flex rounded-md border bg-white ${phoneError ? "border-red-300" : "border-input"}`}>
                    <PhoneCountrySelect
                      aria-label="País do telefone"
                      value={selectedCountry}
                      onChange={(nextCountry) => {
                        setSelectedCountry(nextCountry);
                        setPhone((current) => formatPhoneForCountry(current, nextCountry));
                      }}
                      buttonClassName="min-h-11 rounded-l-md"
                    />
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={selectedCountry.format}
                      value={phone}
                      onChange={(event) => setPhone(formatPhoneForCountry(event.target.value, selectedCountry))}
                      className="min-h-11 border-0 bg-white focus-visible:ring-0"
                      data-testid="input-skale-hub-group-phone"
                    />
                  </div>
                  {phoneError ? (
                    <p className="mt-2 text-xs font-medium text-red-600">{phoneError}</p>
                  ) : null}
                </div>

                <Button
                  type="submit"
                  className="min-h-11 w-full bg-[#406EF1] hover:bg-[#355CD0]"
                  disabled={!phoneIsValid || submitMutation.isPending}
                  data-testid="button-skale-hub-group-submit"
                >
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Entrar no grupo
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
