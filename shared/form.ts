import type { LeadClassification, FormConfig, FormQuestion, FormOption as SchemaFormOption } from "./schema.js";

// Legacy type for backward compatibility
export type FormOption = {
  value: string;
  label: string;
  points: number;
};

export type FormAnswers = {
  nome?: string;
  email?: string;
  telefone?: string;
  cidadeEstado?: string;
  tipoNegocio?: string;
  tempoNegocio?: string;
  experienciaMarketing?: string;
  orcamentoAnuncios?: string;
  principalDesafio?: string;
  disponibilidade?: string;
  expectativaResultado?: string;
  tipoNegocioOutro?: string;
  [key: string]: string | undefined; // Support for custom questions
};

// Default form configuration - used as fallback when no config in database
export const DEFAULT_FORM_CONFIG: FormConfig = {
  questions: [
    {
      id: "nome",
      order: 1,
      title: "What is your full name?",
      type: "text",
      required: true,
      placeholder: "Enter your full name",
    },
    {
      id: "email",
      order: 2,
      title: "What is your email?",
      type: "email",
      required: true,
      placeholder: "example@email.com",
    },
    {
      id: "telefone",
      order: 3,
      title: "What is your cell phone/WhatsApp?",
      type: "tel",
      required: true,
      placeholder: "(555) 123-4567",
    },
    {
      id: "localizacao",
      order: 4,
      title: "Where are you currently located?",
      type: "select",
      required: true,
      options: [
        { value: "I already live in the USA", label: "I already live in the USA", points: 10 },
        { value: "I'm in Brazil, but I have a business in the USA", label: "I'm in Brazil, but I have a business in the USA", points: 8 },
        { value: "I'm moving to the USA soon", label: "I'm moving to the USA soon", points: 7 },
        { value: "Another country", label: "Another country", points: 5 },
      ],
      conditionalField: {
        showWhen: "I already live in the USA",
        id: "cidadeEstado",
        title: "Which city/state?",
        placeholder: "Example: Orlando, FL",
      },
    },
    {
      id: "tipoNegocio",
      order: 5,
      title: "What is your type of business?",
      type: "select",
      required: true,
      options: [
        { value: "Cleaning Services", label: "Cleaning Services", points: 10 },
        { value: "Landscaping", label: "Landscaping", points: 10 },
        { value: "Construction/Remodeling", label: "Construction/Remodeling", points: 10 },
        { value: "Painting", label: "Painting", points: 10 },
        { value: "Handyman", label: "Handyman", points: 10 },
        { value: "Other", label: "Other (specify)", points: 5 },
      ],
      conditionalField: {
        showWhen: "Other",
        id: "tipoNegocioOutro",
        title: "Describe your type of business",
        placeholder: "Example: Consulting, Education, Technology, etc.",
      },
    },
    {
      id: "tempoNegocio",
      order: 6,
      title: "How long have you had this business?",
      type: "select",
      required: true,
      options: [
        { value: "Less than 6 months", label: "Less than 6 months", points: 3 },
        { value: "6 months to 1 year", label: "6 months to 1 year", points: 7 },
        { value: "1 to 3 years", label: "1 to 3 years", points: 10 },
        { value: "More than 3 years", label: "More than 3 years", points: 8 },
      ],
    },
    {
      id: "situacaoMarketing",
      order: 7,
      title: "How is your customer acquisition today?",
      type: "select",
      required: true,
      options: [
        { value: "I only depend on referrals", label: "I only depend on referrals", points: 8 },
        { value: "I've tried advertising on my own, without much result", label: "I've tried advertising on my own, without much result", points: 10 },
        { value: "I've hired someone/agency and it didn't work", label: "I've hired someone/agency and it didn't work", points: 10 },
        { value: "I have some results, but I want to scale", label: "I have some results, but I want to scale", points: 9 },
        { value: "I haven't started any marketing strategy yet", label: "I haven't started any marketing strategy yet", points: 5 },
      ],
    },
    {
      id: "orcamentoAnuncios",
      order: 8,
      title: "To generate clients consistently, it's necessary to invest in marketing (ads and/or structure). How does this fit into your reality today?",
      type: "select",
      required: true,
      options: [
        { value: "Yes, I can invest in marketing to accelerate growth", label: "Yes, I can invest in marketing to accelerate growth", points: 10 },
        { value: "I can start small and increase as results come", label: "I can start small and increase as results come", points: 8 },
        { value: "I can't invest in this at the moment", label: "I can't invest in this at the moment", points: 3 },
      ],
    },
    {
      id: "principalDesafio",
      order: 9,
      title: "What is the biggest obstacle to growing your business today?",
      type: "select",
      required: true,
      options: [
        { value: "I don't have enough clients", label: "I don't have enough clients", points: 8 },
        { value: "I spend on marketing but don't see returns", label: "I spend on marketing but don't see returns", points: 10 },
        { value: "I depend on referrals and have no control over my lead flow", label: "I depend on referrals and have no control over my lead flow", points: 9 },
        { value: "I don't know where to start with digital marketing", label: "I don't know where to start with digital marketing", points: 7 },
        { value: "I have clients, but I can't charge what my service is worth", label: "I have clients, but I can't charge what my service is worth", points: 8 },
      ],
    },
    {
      id: "expectativaTempo",
      order: 10,
      title: "Our clients typically see first leads in 2-4 weeks and consistent results in 60-90 days. Does this work for you?",
      type: "select",
      required: true,
      options: [
        { value: "Yes, I understand that solid results take time", label: "Yes, I understand that solid results take time", points: 10 },
        { value: "I need something faster", label: "I need something faster", points: 5 },
        { value: "I'm not sure yet", label: "I'm not sure yet", points: 3 },
      ],
    },
  ],
  maxScore: 82,
  thresholds: {
    hot: 70,
    warm: 50,
    cold: 30,
  },
};

// Legacy exports for backward compatibility
export const FORM_TOTAL_QUESTIONS = DEFAULT_FORM_CONFIG.questions.length;
export const FORM_MAX_SCORE = DEFAULT_FORM_CONFIG.maxScore;

export const formOptions: Record<string, FormOption[]> = DEFAULT_FORM_CONFIG.questions
  .filter((q) => q.type === "select" && q.options)
  .reduce((acc, q) => {
    acc[q.id] = q.options!;
    return acc;
  }, {} as Record<string, FormOption[]>);

// Known field IDs that map to columns in form_leads table
export const KNOWN_FIELD_IDS = [
  "nome",
  "email",
  "telefone",
  "cidadeEstado",
  "tipoNegocio",
  "tipoNegocioOutro",
  "tempoNegocio",
  "situacaoMarketing",
  "orcamentoAnuncios",
  "principalDesafio",
  "expectativaTempo",
];

// Score field mapping for known questions
export const SCORE_FIELD_MAPPING: Record<string, string> = {
  tipoNegocio: "scoreTipoNegocio",
  tempoNegocio: "scoreTempoNegocio",
  experienciaMarketing: "scoreExperiencia",
  orcamentoAnuncios: "scoreOrcamento",
  principalDesafio: "scoreDesafio",
  disponibilidade: "scoreDisponibilidade",
  expectativaResultado: "scoreExpectativa",
};

function resolvePoints(options: SchemaFormOption[] | undefined, value?: string, fallback = 0): number {
  if (!value || !options) return 0;
  const match = options.find((option) => option.value === value || option.label === value);
  return match?.points ?? fallback;
}

// Calculate scores using config (supports dynamic questions)
export function calculateFormScoresWithConfig(answers: FormAnswers, config: FormConfig) {
  const breakdown: Record<string, number> = {};
  let total = 0;

  for (const question of config.questions) {
    if (question.type === "select" && question.options) {
      const answer = answers[question.id];
      let points = resolvePoints(question.options, answer);

      // Handle conditional field with fallback points (e.g., "Other" option)
      if (question.conditionalField && answer === question.conditionalField.showWhen) {
        const conditionalAnswer = answers[question.conditionalField.id];
        if (conditionalAnswer && points === 0) {
          // Use the points from the trigger option
          const triggerOption = question.options.find(o => o.value === question.conditionalField!.showWhen);
          points = triggerOption?.points ?? 0;
        }
      }

      const scoreKey = SCORE_FIELD_MAPPING[question.id] || `score_${question.id}`;
      breakdown[scoreKey] = points;
      total += points;
    }
  }

  return { total, breakdown };
}

// Legacy function - uses default config for backward compatibility
export function calculateFormScores(answers: Partial<FormAnswers>) {
  const result = calculateFormScoresWithConfig(answers as FormAnswers, DEFAULT_FORM_CONFIG);

  // Map to legacy format
  return {
    total: result.total,
    breakdown: {
      scoreTipoNegocio: result.breakdown.scoreTipoNegocio || 0,
      scoreTempoNegocio: result.breakdown.scoreTempoNegocio || 0,
      scoreExperiencia: result.breakdown.scoreExperiencia || 0,
      scoreOrcamento: result.breakdown.scoreOrcamento || 0,
      scoreDesafio: result.breakdown.scoreDesafio || 0,
      scoreDisponibilidade: result.breakdown.scoreDisponibilidade || 0,
      scoreExpectativa: result.breakdown.scoreExpectativa || 0,
    },
  };
}

export function classifyLead(score: number, thresholds?: FormConfig["thresholds"]): LeadClassification {
  const t = thresholds || DEFAULT_FORM_CONFIG.thresholds;
  if (score >= t.hot) return "QUENTE";
  if (score >= t.warm) return "MORNO";
  if (score >= t.cold) return "FRIO";
  return "DESQUALIFICADO";
}

// Helper to calculate max possible score from config
export function calculateMaxScore(config: FormConfig): number {
  return config.questions
    .filter((q) => q.type === "select" && q.options)
    .reduce((sum, q) => {
      const maxPoints = Math.max(...(q.options || []).map((o) => o.points));
      return sum + maxPoints;
    }, 0);
}

// Helper to get questions sorted by order
export function getSortedQuestions(config: FormConfig): FormQuestion[] {
  return [...config.questions].sort((a, b) => a.order - b.order);
}
