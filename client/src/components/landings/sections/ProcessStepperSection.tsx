// Phase 44 — `processStepper` section type.
// A reusable 4-step "how we work" stepper. All copy is prop-driven with
// pt-BR defaults baked in so the /websites seed can pass `props: {}` and
// future service landings can override per-service by passing `props.steps`.

import { z } from "zod";
import { Search, Palette, Code2, Rocket } from "lucide-react";

const stepSchema = z.object({
  title:       z.string(),
  description: z.string(),
});

export const processStepperPropsSchema = z.object({
  eyebrow:     z.string().optional(),
  heading:     z.string().optional(),
  subheading:  z.string().optional(),
  steps:       z.array(stepSchema).length(4).optional(),
});
export type ProcessStepperProps = z.infer<typeof processStepperPropsSchema>;

const DEFAULTS = {
  eyebrow:    "Como trabalhamos",
  heading:    "Do briefing ao lançamento em 4 etapas",
  subheading: "Um processo claro, com prazos e entregas combinados desde o primeiro contato.",
  steps: [
    {
      title:       "Descoberta",
      description: "Entendemos o seu negócio, o público-alvo e os objetivos do site. Você recebe um briefing com escopo e prazos.",
    },
    {
      title:       "Design",
      description: "Criamos protótipos visuais alinhados à sua marca. Você aprova antes de qualquer código ser escrito.",
    },
    {
      title:       "Construção",
      description: "Desenvolvemos o site com foco em velocidade, SEO e conversão. Você acompanha o progresso em ambiente de testes.",
    },
    {
      title:       "Lançamento",
      description: "Publicamos com domínio próprio, integração de analytics e formulários conectados ao seu CRM. Suporte pós-launch incluso.",
    },
  ],
} as const;

const ICONS = [Search, Palette, Code2, Rocket] as const;

export function ProcessStepperSection({ props }: { props: ProcessStepperProps }) {
  const eyebrow    = props.eyebrow    ?? DEFAULTS.eyebrow;
  const heading    = props.heading    ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const steps      = props.steps      ?? DEFAULTS.steps;

  return (
    <section
      className="bg-zinc-50 py-20 sm:py-24"
      data-testid="section-process-stepper"
    >
      <div className="container-custom mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1C53A3] mb-3">
            {eyebrow}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-zinc-900 leading-tight mb-4">
            {heading}
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
            {subheading}
          </p>
        </div>

        <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {/* Connecting line — only on lg, sits behind the numbered circles */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-zinc-300"
          />

          {steps.map((step, idx) => {
            const Icon = ICONS[idx];
            const stepNumber = idx + 1;
            return (
              <li
                key={idx}
                className="relative flex flex-col items-center text-center"
                data-testid={`step-process-${stepNumber}`}
              >
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#1C53A3] text-white shadow-lg shadow-[#1C53A3]/20 mb-5">
                  <Icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFF01] text-xs font-bold text-black border-2 border-zinc-50">
                    {stepNumber}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold font-display text-zinc-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
