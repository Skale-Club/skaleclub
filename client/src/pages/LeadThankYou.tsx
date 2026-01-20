import { Link } from "wouter";
import { Sparkles, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";

export default function LeadThankYou() {
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const companyName = companySettings?.companyName || "Skale Club";
  const isSkale = companyName.trim().toLowerCase() === "skale club";
  const headline = isSkale
    ? "Obrigado por confiar na Skale Club."
    : `Obrigado por confiar no ${companyName}.`;

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
      className="w-full text-white overflow-hidden flex items-center"
      style={{ background: heroGradient, minHeight: '80vh' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 items-start">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-200 text-xs font-semibold border border-emerald-400/30 mb-4">
              <Sparkles className="w-4 h-4" />
              Recebemos seus dados
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white">{headline}</h1>
            <p className="mt-4 text-slate-200 text-lg leading-relaxed">
              Seu formulário foi enviado com sucesso. Um especialista do nosso time vai revisar as informações e entrar em contato em breve para o próximo passo.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              <Link href="/">
                <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 font-semibold py-3 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all">
                  <Home className="w-4 h-4" />
                  Voltar para o site
                </button>
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Se preferir, você também pode responder este email com horários e canal de contato preferido.
            </p>
          </div>

          <div className="hidden md:block">
            <div className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#22c55e,transparent_35%),radial-gradient(circle_at_80%_0%,#22d3ee,transparent_30%),radial-gradient(circle_at_50%_80%,#a855f7,transparent_25%)]" />
              <div className="relative space-y-4">
                <p className="text-sm text-slate-200/90">Próximos passos</p>
                <div className="space-y-3 text-sm text-white/90">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">Nossa equipe revisa suas respostas e identifica o melhor plano.</div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">Entraremos em contato para alinhar objetivos e próximos passos.</div>
                  <div className="p-3 rounded-xl bg-white/10 border border-white/10">Você recebe um resumo do plano inicial e instruções práticas.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
