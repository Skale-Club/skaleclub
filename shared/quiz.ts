import type { LeadClassification, QuizConfig, QuizQuestion, QuizOption as SchemaQuizOption } from "./schema";

// Legacy type for backward compatibility
export type QuizOption = {
  value: string;
  label: string;
  points: number;
};

export type QuizAnswers = {
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

// Default quiz configuration - used as fallback when no config in database
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questions: [
    {
      id: "nome",
      order: 1,
      title: "Qual é o seu nome completo?",
      type: "text",
      required: true,
      placeholder: "Digite seu nome completo",
    },
    {
      id: "email",
      order: 2,
      title: "Qual é o seu email?",
      type: "email",
      required: true,
      placeholder: "exemplo@email.com",
    },
    {
      id: "telefone",
      order: 3,
      title: "Qual é o seu telefone/WhatsApp?",
      type: "tel",
      required: true,
      placeholder: "+1 (555) 123-4567",
    },
    {
      id: "cidadeEstado",
      order: 4,
      title: "Em qual cidade e estado você está nos EUA?",
      type: "text",
      required: true,
      placeholder: "New York, NY",
    },
    {
      id: "tipoNegocio",
      order: 5,
      title: "Qual tipo de negócio você tem?",
      type: "select",
      required: true,
      options: [
        { value: "Cleaning Services", label: "Cleaning Services", points: 10 },
        { value: "Landscaping", label: "Landscaping", points: 10 },
        { value: "Construction/Remodeling", label: "Construction/Remodeling", points: 10 },
        { value: "HVAC/Plumbing/Elétrica", label: "HVAC/Plumbing/Elétrica", points: 10 },
        { value: "Real Estate", label: "Real Estate", points: 7 },
        { value: "Restaurante/Food Services", label: "Restaurante/Food Services", points: 7 },
        { value: "Outro", label: "Outro", points: 5 },
      ],
      conditionalField: {
        showWhen: "Outro",
        id: "tipoNegocioOutro",
        title: "Conte qual é o seu negócio",
        placeholder: "Descreva seu tipo de negócio",
      },
    },
    {
      id: "tempoNegocio",
      order: 6,
      title: "Há quanto tempo você tem esse negócio nos EUA?",
      type: "select",
      required: true,
      options: [
        { value: "Menos de 6 meses", label: "Menos de 6 meses", points: 3 },
        { value: "6 meses a 1 ano", label: "6 meses a 1 ano", points: 7 },
        { value: "1 a 3 anos", label: "1 a 3 anos", points: 10 },
        { value: "Mais de 3 anos", label: "Mais de 3 anos", points: 8 },
      ],
    },
    {
      id: "experienciaMarketing",
      order: 7,
      title: "Você já investiu em marketing digital antes?",
      type: "select",
      required: true,
      options: [
        { value: "Nunca investi", label: "Nunca investi", points: 5 },
        { value: "Já tentei por conta própria sem sucesso", label: "Já tentei por conta própria sem sucesso", points: 8 },
        { value: "Já contratei agência e não funcionou", label: "Já contratei agência e não funcionou", points: 10 },
        { value: "Estou investindo agora mas quero aprender", label: "Estou investindo agora mas quero aprender", points: 9 },
        { value: "Tenho algum conhecimento mas quero me aprofundar", label: "Tenho algum conhecimento mas quero me aprofundar", points: 7 },
      ],
    },
    {
      id: "orcamentoAnuncios",
      order: 8,
      title: "Quanto você está disposto a investir MENSALMENTE em anúncios?",
      type: "select",
      required: true,
      options: [
        { value: "Ainda não tenho orçamento", label: "Ainda não tenho orçamento", points: 2 },
        { value: "$500 - $1,000", label: "$500 - $1,000", points: 6 },
        { value: "$1,000 - $2,500", label: "$1,000 - $2,500", points: 10 },
        { value: "$2,500 - $5,000", label: "$2,500 - $5,000", points: 10 },
        { value: "Acima de $5,000", label: "Acima de $5,000", points: 8 },
      ],
    },
    {
      id: "principalDesafio",
      order: 9,
      title: "Qual é o seu MAIOR desafio hoje?",
      type: "select",
      required: true,
      options: [
        { value: "Não tenho clientes suficientes", label: "Não tenho clientes suficientes", points: 8 },
        { value: "Gasto muito em marketing e não vejo resultado", label: "Gasto muito em marketing e não vejo resultado", points: 10 },
        { value: "Não sei por onde começar no marketing digital", label: "Não sei por onde começar no marketing digital", points: 7 },
        { value: "Dependo muito de indicação e quero diversificar", label: "Dependo muito de indicação e quero diversificar", points: 9 },
        { value: "Quero parar de depender de agências", label: "Quero parar de depender de agências", points: 10 },
      ],
    },
    {
      id: "disponibilidade",
      order: 10,
      title: "Quanto tempo por semana você consegue dedicar ao aprendizado?",
      type: "select",
      required: true,
      options: [
        { value: "Menos de 2 horas", label: "Menos de 2 horas", points: 4 },
        { value: "2-4 horas", label: "2-4 horas", points: 8 },
        { value: "4-6 horas", label: "4-6 horas", points: 10 },
        { value: "Mais de 6 horas", label: "Mais de 6 horas", points: 10 },
      ],
    },
    {
      id: "expectativaResultado",
      order: 11,
      title: "Em quanto tempo você espera começar a ver resultados?",
      type: "select",
      required: true,
      options: [
        { value: "Imediatamente (1-2 semanas)", label: "Imediatamente (1-2 semanas)", points: 2 },
        { value: "1 mês", label: "1 mês", points: 6 },
        { value: "2-3 meses", label: "2-3 meses", points: 10 },
        { value: "3-6 meses", label: "3-6 meses", points: 10 },
        { value: "Estou focado no longo prazo", label: "Estou focado no longo prazo", points: 8 },
      ],
    },
  ],
  maxScore: 78,
  thresholds: {
    hot: 70,
    warm: 50,
    cold: 30,
  },
};

// Legacy exports for backward compatibility
export const QUIZ_TOTAL_QUESTIONS = DEFAULT_QUIZ_CONFIG.questions.length;
export const QUIZ_MAX_SCORE = DEFAULT_QUIZ_CONFIG.maxScore;

// Legacy quizOptions object - used by old code, built from DEFAULT_QUIZ_CONFIG
export const quizOptions: Record<string, QuizOption[]> = DEFAULT_QUIZ_CONFIG.questions
  .filter((q) => q.type === "select" && q.options)
  .reduce((acc, q) => {
    acc[q.id] = q.options!;
    return acc;
  }, {} as Record<string, QuizOption[]>);

// Known field IDs that map to columns in quiz_leads table
export const KNOWN_FIELD_IDS = [
  "nome",
  "email",
  "telefone",
  "cidadeEstado",
  "tipoNegocio",
  "tipoNegocioOutro",
  "tempoNegocio",
  "experienciaMarketing",
  "orcamentoAnuncios",
  "principalDesafio",
  "disponibilidade",
  "expectativaResultado",
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

function resolvePoints(options: SchemaQuizOption[] | undefined, value?: string, fallback = 0): number {
  if (!value || !options) return 0;
  const match = options.find((option) => option.value === value || option.label === value);
  return match?.points ?? fallback;
}

// Calculate scores using config (supports dynamic questions)
export function calculateQuizScoresWithConfig(answers: QuizAnswers, config: QuizConfig) {
  const breakdown: Record<string, number> = {};
  let total = 0;

  for (const question of config.questions) {
    if (question.type === "select" && question.options) {
      const answer = answers[question.id];
      let points = resolvePoints(question.options, answer);

      // Handle conditional field with fallback points (e.g., "Outro" option)
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
export function calculateQuizScores(answers: Partial<QuizAnswers>) {
  const result = calculateQuizScoresWithConfig(answers as QuizAnswers, DEFAULT_QUIZ_CONFIG);

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

export function classifyLead(score: number, thresholds?: QuizConfig["thresholds"]): LeadClassification {
  const t = thresholds || DEFAULT_QUIZ_CONFIG.thresholds;
  if (score >= t.hot) return "QUENTE";
  if (score >= t.warm) return "MORNO";
  if (score >= t.cold) return "FRIO";
  return "DESQUALIFICADO";
}

// Helper to calculate max possible score from config
export function calculateMaxScore(config: QuizConfig): number {
  return config.questions
    .filter((q) => q.type === "select" && q.options)
    .reduce((sum, q) => {
      const maxPoints = Math.max(...(q.options || []).map((o) => o.points));
      return sum + maxPoints;
    }, 0);
}

// Helper to get questions sorted by order
export function getSortedQuestions(config: QuizConfig): QuizQuestion[] {
  return [...config.questions].sort((a, b) => a.order - b.order);
}
