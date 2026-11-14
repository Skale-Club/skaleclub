// Copy defaults of the managed-landing sections: what a section renders when its
// row leaves a prop unset. English is the t() source language (PT comes from the
// translation dictionary), except the WhatsApp group section, which was written
// in Portuguese. Shared so the client renderer and the server-side crawlable
// summary (server/seo/content) read the same words.

export const HERO_WEBSITES_DEFAULTS = {
  headline: "Is your website still stuck in the Stone Age?",
  subheadline: "We build fast, Google-optimized websites for service businesses, deployed in days, not months.",
  ctaLabel: "I want my website",
  // Served from client/public: language-neutral brand illustration.
  backgroundImageUrl: "/SkaleClub.webp",
} as const;

export const PROCESS_STEPPER_DEFAULTS = {
  eyebrow:    "How we work",
  heading:    "From briefing to launch in 4 steps",
  subheading: "A clear process, with deadlines and deliverables agreed from the first contact.",
  steps: [
    {
      title:       "Discovery",
      description: "We understand your business, target audience, and website goals. You get a briefing with scope and timeline.",
    },
    {
      title:       "Design",
      description: "We create visual prototypes aligned with your brand. You approve before any code is written.",
    },
    {
      title:       "Build",
      description: "We develop the website focused on speed, SEO, and conversion. You follow the progress in a staging environment.",
    },
    {
      title:       "Launch",
      description: "We publish with your own domain, analytics integration, and forms connected to your CRM. Post-launch support included.",
    },
  ],
} as const;

export const LEAD_FORM_CTA_DEFAULTS = {
  heading: "Let's talk about your website",
  subheading: "Tell us about your project in 1 minute. We'll reply within 24 hours with a proposal.",
  ctaLabel: "I want my website",
} as const;

export const FAQ_ACCORDION_DEFAULTS = {
  eyebrow:    "FAQ",
  heading:    "Common questions",
  subheading: "Quick answers to what people usually ask before ordering.",
  items: [
    {
      question: "How do I get started?",
      answer:   "Fill out the short form on this page and we will reach out on WhatsApp to confirm the details of your order.",
    },
    {
      question: "Can I see the design before it goes to production?",
      answer:   "Yes. We send you the artwork for approval, and nothing is produced until you say it is good to go.",
    },
    {
      question: "What if I have more questions?",
      answer:   "Just message us on WhatsApp. We answer every question before you commit to anything.",
    },
  ],
} as const;

export const WHATSAPP_GROUP_DEFAULTS = {
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

