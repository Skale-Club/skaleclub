import type { LeadClassification } from "./schema";

export type QuizOption = {
  value: string;
  label: string;
  points: number;
};

export type QuizAnswers = {
  tipoNegocio?: string;
  tempoNegocio?: string;
  experienciaMarketing?: string;
  orcamentoAnuncios?: string;
  principalDesafio?: string;
  disponibilidade?: string;
  expectativaResultado?: string;
  tipoNegocioOutro?: string;
};

export const QUIZ_TOTAL_QUESTIONS = 11;
export const QUIZ_MAX_SCORE = 78;

export const quizOptions = {
  tipoNegocio: [
    { value: "Cleaning Services", label: "Cleaning Services", points: 10 },
    { value: "Landscaping", label: "Landscaping", points: 10 },
    { value: "Construction/Remodeling", label: "Construction/Remodeling", points: 10 },
    { value: "HVAC/Plumbing/Elétrica", label: "HVAC/Plumbing/Elétrica", points: 10 },
    { value: "Real Estate", label: "Real Estate", points: 7 },
    { value: "Restaurante/Food Services", label: "Restaurante/Food Services", points: 7 },
    { value: "Outro", label: "Outro", points: 5 },
  ] as QuizOption[],
  tempoNegocio: [
    { value: "Menos de 6 meses", label: "Menos de 6 meses", points: 3 },
    { value: "6 meses a 1 ano", label: "6 meses a 1 ano", points: 7 },
    { value: "1 a 3 anos", label: "1 a 3 anos", points: 10 },
    { value: "Mais de 3 anos", label: "Mais de 3 anos", points: 8 },
  ] as QuizOption[],
  experienciaMarketing: [
    { value: "Nunca investi", label: "Nunca investi", points: 5 },
    { value: "Já tentei por conta própria sem sucesso", label: "Já tentei por conta própria sem sucesso", points: 8 },
    { value: "Já contratei agência e não funcionou", label: "Já contratei agência e não funcionou", points: 10 },
    { value: "Estou investindo agora mas quero aprender", label: "Estou investindo agora mas quero aprender", points: 9 },
    { value: "Tenho algum conhecimento mas quero me aprofundar", label: "Tenho algum conhecimento mas quero me aprofundar", points: 7 },
  ] as QuizOption[],
  orcamentoAnuncios: [
    { value: "Ainda não tenho orçamento", label: "Ainda não tenho orçamento", points: 2 },
    { value: "$500 - $1,000", label: "$500 - $1,000", points: 6 },
    { value: "$1,000 - $2,500", label: "$1,000 - $2,500", points: 10 },
    { value: "$2,500 - $5,000", label: "$2,500 - $5,000", points: 10 },
    { value: "Acima de $5,000", label: "Acima de $5,000", points: 8 },
  ] as QuizOption[],
  principalDesafio: [
    { value: "Não tenho clientes suficientes", label: "Não tenho clientes suficientes", points: 8 },
    { value: "Gasto muito em marketing e não vejo resultado", label: "Gasto muito em marketing e não vejo resultado", points: 10 },
    { value: "Não sei por onde começar no marketing digital", label: "Não sei por onde começar no marketing digital", points: 7 },
    { value: "Dependo muito de indicação e quero diversificar", label: "Dependo muito de indicação e quero diversificar", points: 9 },
    { value: "Quero parar de depender de agências", label: "Quero parar de depender de agências", points: 10 },
  ] as QuizOption[],
  disponibilidade: [
    { value: "Menos de 2 horas", label: "Menos de 2 horas", points: 4 },
    { value: "2-4 horas", label: "2-4 horas", points: 8 },
    { value: "4-6 horas", label: "4-6 horas", points: 10 },
    { value: "Mais de 6 horas", label: "Mais de 6 horas", points: 10 },
  ] as QuizOption[],
  expectativaResultado: [
    { value: "Imediatamente (1-2 semanas)", label: "Imediatamente (1-2 semanas)", points: 2 },
    { value: "1 mês", label: "1 mês", points: 6 },
    { value: "2-3 meses", label: "2-3 meses", points: 10 },
    { value: "3-6 meses", label: "3-6 meses", points: 10 },
    { value: "Estou focado no longo prazo", label: "Estou focado no longo prazo", points: 8 },
  ] as QuizOption[],
};

function resolvePoints(options: QuizOption[], value?: string, fallback = 0): number {
  if (!value) return 0;
  const match = options.find((option) => option.value === value || option.label === value);
  return match?.points ?? fallback;
}

export function calculateQuizScores(answers: Partial<QuizAnswers>) {
  const scoreTipoNegocio = resolvePoints(quizOptions.tipoNegocio, answers.tipoNegocio, answers.tipoNegocioOutro ? 5 : 0);
  const scoreTempoNegocio = resolvePoints(quizOptions.tempoNegocio, answers.tempoNegocio);
  const scoreExperiencia = resolvePoints(quizOptions.experienciaMarketing, answers.experienciaMarketing);
  const scoreOrcamento = resolvePoints(quizOptions.orcamentoAnuncios, answers.orcamentoAnuncios);
  const scoreDesafio = resolvePoints(quizOptions.principalDesafio, answers.principalDesafio);
  const scoreDisponibilidade = resolvePoints(quizOptions.disponibilidade, answers.disponibilidade);
  const scoreExpectativa = resolvePoints(quizOptions.expectativaResultado, answers.expectativaResultado);

  const total =
    scoreTipoNegocio +
    scoreTempoNegocio +
    scoreExperiencia +
    scoreOrcamento +
    scoreDesafio +
    scoreDisponibilidade +
    scoreExpectativa;

  return {
    total,
    breakdown: {
      scoreTipoNegocio,
      scoreTempoNegocio,
      scoreExperiencia,
      scoreOrcamento,
      scoreDesafio,
      scoreDisponibilidade,
      scoreExpectativa,
    },
  };
}

export function classifyLead(score: number): LeadClassification {
  if (score >= 70) return "QUENTE";
  if (score >= 50) return "MORNO";
  if (score >= 30) return "FRIO";
  return "DESQUALIFICADO";
}
