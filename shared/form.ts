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
      title: "Qual é o seu Celular/WhatsApp?",
      type: "tel",
      required: true,
      placeholder: "(555) 123-4567",
    },
    {
      id: "localizacao",
      order: 4,
      title: "Onde você está hoje?",
      type: "select",
      required: true,
      options: [
        { value: "Já moro nos EUA", label: "Já moro nos EUA", points: 10 },
        { value: "Estou no Brasil, mas tenho negócio nos EUA", label: "Estou no Brasil, mas tenho negócio nos EUA", points: 8 },
        { value: "Estou me mudando para os EUA em breve", label: "Estou me mudando para os EUA em breve", points: 7 },
        { value: "Outro país", label: "Outro país", points: 5 },
      ],
      conditionalField: {
        showWhen: "Já moro nos EUA",
        id: "cidadeEstado",
        title: "Em qual cidade/estado?",
        placeholder: "Ex: Orlando, FL",
      },
    },
    {
      id: "tipoNegocio",
      order: 5,
      title: "Qual o seu tipo de negócio?",
      type: "select",
      required: true,
      options: [
        { value: "Cleaning Services", label: "Cleaning Services", points: 10 },
        { value: "Landscaping", label: "Landscaping", points: 10 },
        { value: "Construction/Remodeling", label: "Construction/Remodeling", points: 10 },
        { value: "Painting", label: "Painting", points: 10 },
        { value: "Handyman", label: "Handyman", points: 10 },
        { value: "Outro", label: "Outro (especificar)", points: 5 },
      ],
      conditionalField: {
        showWhen: "Outro",
        id: "tipoNegocioOutro",
        title: "Descreva seu tipo de negócio",
        placeholder: "Ex: Consultoria, Educação, Tecnologia, etc.",
      },
    },
    {
      id: "tempoNegocio",
      order: 6,
      title: "Há quanto tempo você tem esse negócio?",
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
      id: "situacaoMarketing",
      order: 7,
      title: "Como está sua captação de clientes hoje?",
      type: "select",
      required: true,
      options: [
        { value: "Dependo só de indicações", label: "Dependo só de indicações", points: 8 },
        { value: "Já tentei anúncios por conta própria, sem muito resultado", label: "Já tentei anúncios por conta própria, sem muito resultado", points: 10 },
        { value: "Já contratei alguém/agência e não funcionou", label: "Já contratei alguém/agência e não funcionou", points: 10 },
        { value: "Tenho alguns resultados, mas quero escalar", label: "Tenho alguns resultados, mas quero escalar", points: 9 },
        { value: "Ainda não comecei nenhuma estratégia de marketing", label: "Ainda não comecei nenhuma estratégia de marketing", points: 5 },
      ],
    },
    {
      id: "orcamentoAnuncios",
      order: 8,
      title: "Para gerar clientes com consistência, é necessário investir em marketing (anúncios e/ou estrutura). Como isso se encaixa na sua realidade hoje?",
      type: "select",
      required: true,
      options: [
        { value: "Sim, consigo investir em marketing para acelerar o crescimento", label: "Sim, consigo investir em marketing para acelerar o crescimento", points: 10 },
        { value: "Consigo começar com pouco e aumentar conforme os resultados", label: "Consigo começar com pouco e aumentar conforme os resultados", points: 8 },
        { value: "No momento não consigo investir nisso", label: "No momento não consigo investir nisso", points: 3 },
      ],
    },
    {
      id: "principalDesafio",
      order: 9,
      title: "Qual o maior obstáculo para crescer seu negócio hoje?",
      type: "select",
      required: true,
      options: [
        { value: "Não tenho clientes suficientes", label: "Não tenho clientes suficientes", points: 8 },
        { value: "Gasto em marketing mas não vejo retorno", label: "Gasto em marketing mas não vejo retorno", points: 10 },
        { value: "Dependo de indicações e não tenho controle sobre meu fluxo de leads", label: "Dependo de indicações e não tenho controle sobre meu fluxo de leads", points: 9 },
        { value: "Não sei por onde começar no marketing digital", label: "Não sei por onde começar no marketing digital", points: 7 },
        { value: "Tenho clientes, mas não consigo cobrar o que meu serviço vale", label: "Tenho clientes, mas não consigo cobrar o que meu serviço vale", points: 8 },
      ],
    },
    {
      id: "expectativaTempo",
      order: 10,
      title: "Nossos clientes geralmente veem os primeiros leads em 2-4 semanas e resultados consistentes em 60-90 dias. Isso funciona para você?",
      type: "select",
      required: true,
      options: [
        { value: "Sim, entendo que resultado sólido leva tempo", label: "Sim, entendo que resultado sólido leva tempo", points: 10 },
        { value: "Preciso de algo mais rápido", label: "Preciso de algo mais rápido", points: 5 },
        { value: "Não tenho certeza ainda", label: "Não tenho certeza ainda", points: 3 },
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
