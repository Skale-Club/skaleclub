import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { trackEvent } from "@/lib/analytics";
import { quizOptions, calculateQuizScores, classifyLead, QUIZ_TOTAL_QUESTIONS } from "@shared/quiz";
import type { LeadClassification, QuizLead } from "@shared/schema";

type QuizView = "quiz" | "loading" | "result";

type Answers = {
  nome: string;
  email: string;
  telefone: string;
  cidadeEstado: string;
  tipoNegocio: string;
  tipoNegocioOutro: string;
  tempoNegocio: string;
  experienciaMarketing: string;
  orcamentoAnuncios: string;
  principalDesafio: string;
  disponibilidade: string;
  expectativaResultado: string;
};

type StoredQuizState = {
  sessionId: string;
  answers: Answers;
  currentStep: number;
  lastAnsweredStep: number;
  startedAt: string;
  lastUpdatedAt: string;
  pendingSync: boolean;
};

const STORAGE_KEY = "skale-quiz-state";
const EXPIRATION_HOURS = 24;
const PHONE_REGEX = /^\+1 \(\d{3}\) \d{3}-\d{4}$/;
const NAME_REGEX = /^[A-Za-zÀ-ÿ\s]{3,100}$/;

const INITIAL_ANSWERS: Answers = {
  nome: "",
  email: "",
  telefone: "",
  cidadeEstado: "",
  tipoNegocio: "",
  tipoNegocioOutro: "",
  tempoNegocio: "",
  experienciaMarketing: "",
  orcamentoAnuncios: "",
  principalDesafio: "",
  disponibilidade: "",
  expectativaResultado: "",
};

const RESULT_CONFIG: Record<LeadClassification, { title: string; message: string; cta: string; color: string; href: string; icon: string }> = {
  QUENTE: {
    title: "🎯 Você tem o perfil ideal!",
    message: "Seu negócio tem tudo para se beneficiar da nossa mentoria. Vamos agendar uma conversa?",
    cta: "Agendar Minha Call Agora",
    color: "#22C55E",
    href: "/booking",
    icon: "sparkles",
  },
  MORNO: {
    title: "📈 Você tem potencial!",
    message: "Vejo que você está no caminho certo. Que tal receber nosso guia gratuito para começar?",
    cta: "Receber Guia Gratuito",
    color: "#F59E0B",
    href: "/contact",
    icon: "sparkles",
  },
  FRIO: {
    title: "🙏 Obrigado pelo interesse!",
    message: "Vamos te manter informado com conteúdos relevantes para quando você estiver pronto.",
    cta: "Receber Conteúdos",
    color: "#3B82F6",
    href: "/blog",
    icon: "sparkles",
  },
  DESQUALIFICADO: {
    title: "✨ Obrigado por seu tempo!",
    message: "No momento, nossa mentoria pode não ser o melhor fit. Mas fique à vontade para explorar nosso conteúdo gratuito.",
    cta: "Ver Blog",
    color: "#6B7280",
    href: "/blog",
    icon: "sparkles",
  },
};

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 generator (non-crypto secure but valid format)
  const random = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${random()}${random()}-${random()}-${random()}-${random()}-${random()}${random()}${random()}`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;
  const limited = normalized.slice(0, 10);
  const area = limited.slice(0, 3);
  const mid = limited.slice(3, 6);
  const tail = limited.slice(6, 10);
  if (tail) return `+1 (${area}) ${mid}-${tail}`;
  if (mid) return `+1 (${area}) ${mid}`;
  if (area) return `+1 (${area})`;
  return "";
}

function isExpired(timestamp: string) {
  const last = new Date(timestamp).getTime();
  if (!last) return true;
  const diffHours = (Date.now() - last) / (1000 * 60 * 60);
  return diffHours > EXPIRATION_HOURS;
}

function loadStoredState(): StoredQuizState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuizState;
    if (!parsed.sessionId || !parsed.startedAt || isExpired(parsed.lastUpdatedAt)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredState(state: StoredQuizState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore persistence failures
  }
}

function clearStoredState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getFieldError(stepId: keyof Answers, answers: Answers) {
  switch (stepId) {
    case "nome": {
      const name = answers.nome.trim();
      if (!name) return "Por favor, insira seu nome completo";
      if (name.length < 3 || name.length > 100) return "Por favor, insira seu nome completo";
      if (!NAME_REGEX.test(name)) return "Use apenas letras e espaços";
      return null;
    }
    case "email": {
      const email = answers.email.trim();
      if (!email || !/.+@.+\..+/.test(email)) return "Por favor, insira um email válido";
      return null;
    }
    case "telefone": {
      const phone = answers.telefone.trim();
      if (!phone || !PHONE_REGEX.test(phone)) return "Por favor, insira um telefone válido";
      return null;
    }
    case "cidadeEstado": {
      const city = answers.cidadeEstado.trim();
      if (!city || city.length < 3) return "Por favor, insira sua cidade e estado";
      return null;
    }
    case "tipoNegocio": {
      if (!answers.tipoNegocio) return "Por favor, selecione uma opção";
      if (answers.tipoNegocio === "Outro" && !answers.tipoNegocioOutro.trim()) {
        return "Por favor, descreva seu tipo de negócio";
      }
      return null;
    }
    case "tempoNegocio":
    case "experienciaMarketing":
    case "orcamentoAnuncios":
    case "principalDesafio":
    case "disponibilidade":
    case "expectativaResultado": {
      if (!(answers[stepId] as string)) return "Por favor, selecione uma opção";
      return null;
    }
    default:
      return null;
  }
}

type LeadQuizModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LeadQuizModal({ open, onClose }: LeadQuizModalProps) {
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [currentStep, setCurrentStep] = useState(1);
  const [lastAnsweredStep, setLastAnsweredStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [view, setView] = useState<QuizView>("quiz");
  const [pendingSync, setPendingSync] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [resultLead, setResultLead] = useState<QuizLead | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [originUrl, setOriginUrl] = useState("");
  const [utmParams, setUtmParams] = useState({ source: "", medium: "", campaign: "" });
  const autoSaveRef = useRef<number>();
  const answersRef = useRef<Answers>(INITIAL_ANSWERS);
  const syncedOnOpenRef = useRef(false);
  const loadingTimerRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const score = useMemo(() => calculateQuizScores(answers), [answers]);
  const classification = useMemo(() => classifyLead(score.total), [score.total]);
  const progressPercent = Math.min((currentStep / QUIZ_TOTAL_QUESTIONS) * 100, 100);

  const questionOrder: Array<keyof Answers> = [
    "nome",
    "email",
    "telefone",
    "cidadeEstado",
    "tipoNegocio",
    "tempoNegocio",
    "experienciaMarketing",
    "orcamentoAnuncios",
    "principalDesafio",
    "disponibilidade",
    "expectativaResultado",
  ];

  const currentQuestionId = questionOrder[currentStep - 1];

  useEffect(() => {
    try {
      const testKey = "__quiz_check__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, []);

  const ensureSession = useCallback(() => {
    let currentSession = sessionId;
    if (!currentSession) {
      currentSession = generateSessionId();
      setSessionId(currentSession);
    }
    if (!startedAt) {
      setStartedAt(new Date());
    }
    return currentSession;
  }, [sessionId, startedAt]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.href);
      const params = new URLSearchParams(window.location.search);
      setUtmParams({
        source: params.get("utm_source") || "",
        medium: params.get("utm_medium") || "",
        campaign: params.get("utm_campaign") || "",
      });
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredState();
    if (stored) {
      setSessionId(stored.sessionId);
      setAnswers(stored.answers);
      setCurrentStep(Math.min(stored.currentStep, QUIZ_TOTAL_QUESTIONS));
      setLastAnsweredStep(stored.lastAnsweredStep || 0);
      setStartedAt(new Date(stored.startedAt));
      setPendingSync(stored.pendingSync);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      ensureSession();
      trackEvent("quiz_open", { location: "home" });
    } else {
      document.body.style.overflow = "";
      syncedOnOpenRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, ensureSession]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const updateStoredState = useCallback(
    (stepToResume: number, answeredStep: number, pending = pendingSync) => {
      const session = ensureSession();
      if (!storageAvailable || !session) return;
      const payload: StoredQuizState = {
        sessionId: session,
        answers,
        currentStep: stepToResume,
        lastAnsweredStep: answeredStep,
        startedAt: (startedAt || new Date()).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        pendingSync: pending,
      };
      saveStoredState(payload);
    },
    [answers, ensureSession, pendingSync, startedAt, storageAvailable],
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const persistProgress = useCallback(
    async (
      questionNumber: number,
      opts?: { stepToResume?: number; markComplete?: boolean; tempoTotalSegundos?: number; overrideAnswers?: Partial<Answers> }
    ): Promise<QuizLead | null> => {
      const session = ensureSession();
      const effectiveAnswers = { ...answersRef.current, ...(opts?.overrideAnswers || {}) };
      const effectiveScore = calculateQuizScores(effectiveAnswers);
      const payload: any = {
        sessionId: session,
        questionNumber,
        startedAt: (startedAt || new Date()).toISOString(),
        urlOrigem: originUrl,
        utmSource: utmParams.source || undefined,
        utmMedium: utmParams.medium || undefined,
        utmCampaign: utmParams.campaign || undefined,
        quizCompleto: opts?.markComplete || false,
        tempoTotalSegundos: opts?.tempoTotalSegundos,
        scoreTotal: effectiveScore.total,
        scoreTipoNegocio: effectiveScore.breakdown.scoreTipoNegocio,
        scoreTempoNegocio: effectiveScore.breakdown.scoreTempoNegocio,
        scoreExperiencia: effectiveScore.breakdown.scoreExperiencia,
        scoreOrcamento: effectiveScore.breakdown.scoreOrcamento,
        scoreDesafio: effectiveScore.breakdown.scoreDesafio,
        scoreDisponibilidade: effectiveScore.breakdown.scoreDisponibilidade,
        scoreExpectativa: effectiveScore.breakdown.scoreExpectativa,
      };

      if (effectiveAnswers.nome) payload.nome = effectiveAnswers.nome.trim();
      if (effectiveAnswers.email) payload.email = effectiveAnswers.email.trim();
      if (effectiveAnswers.telefone) payload.telefone = effectiveAnswers.telefone.trim();
      if (effectiveAnswers.cidadeEstado) payload.cidadeEstado = effectiveAnswers.cidadeEstado.trim();
      if (effectiveAnswers.tipoNegocio) payload.tipoNegocio = effectiveAnswers.tipoNegocio;
      if (effectiveAnswers.tipoNegocioOutro) payload.tipoNegocioOutro = effectiveAnswers.tipoNegocioOutro.trim();
      if (effectiveAnswers.tempoNegocio) payload.tempoNegocio = effectiveAnswers.tempoNegocio;
      if (effectiveAnswers.experienciaMarketing) payload.experienciaMarketing = effectiveAnswers.experienciaMarketing;
      if (effectiveAnswers.orcamentoAnuncios) payload.orcamentoAnuncios = effectiveAnswers.orcamentoAnuncios;
      if (effectiveAnswers.principalDesafio) payload.principalDesafio = effectiveAnswers.principalDesafio;
      if (effectiveAnswers.disponibilidade) payload.disponibilidade = effectiveAnswers.disponibilidade;
      if (effectiveAnswers.expectativaResultado) payload.expectativaResultado = effectiveAnswers.expectativaResultado;

      updateStoredState(opts?.stepToResume ?? currentStep, questionNumber, pendingSync);
      try {
        const res = await fetch("/api/quiz-leads/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const lead = (await res.json()) as QuizLead;
        setPendingSync(false);
        updateStoredState(opts?.stepToResume ?? currentStep, questionNumber, false);
        setLastAnsweredStep(questionNumber);
        return lead;
      } catch (err) {
        console.error("Failed to sync lead progress", err);
        setPendingSync(true);
        updateStoredState(opts?.stepToResume ?? currentStep, questionNumber, true);
        return null;
      }
    },
    [
      answers,
      currentStep,
      ensureSession,
      originUrl,
      pendingSync,
      score.breakdown.scoreDesafio,
      score.breakdown.scoreDisponibilidade,
      score.breakdown.scoreExperiencia,
      score.breakdown.scoreExpectativa,
      score.breakdown.scoreOrcamento,
      score.breakdown.scoreTempoNegocio,
      score.breakdown.scoreTipoNegocio,
      score.total,
      sessionId,
      startedAt,
      updateStoredState,
      utmParams.campaign,
      utmParams.medium,
      utmParams.source,
    ],
  );

  useEffect(() => {
    if (open && sessionId && lastAnsweredStep > 0 && !syncedOnOpenRef.current) {
      syncedOnOpenRef.current = true;
      void persistProgress(lastAnsweredStep, { stepToResume: currentStep });
    }
  }, [currentStep, lastAnsweredStep, open, persistProgress, sessionId]);

  const handleAnswerChange = (field: keyof Answers, value: string) => {
    ensureSession();
    if (field === "telefone") {
      value = formatPhone(value);
    }
    setAnswers(prev => ({ ...prev, [field]: value }));
    setErrorMessage(null);

    if (autoSaveRef.current) window.clearTimeout(autoSaveRef.current);
    autoSaveRef.current = window.setTimeout(() => {
      const error = getFieldError(field, { ...answers, [field]: value });
      if (!error && questionOrder[currentStep - 1] === field) {
        void persistProgress(currentStep, { stepToResume: currentStep, overrideAnswers: { [field]: value } });
      }
    }, 400);
  };

  const handleOptionSelect = (field: keyof Answers, value: string) => {
    const updated = { ...answers, [field]: value };
    if (field === "tipoNegocio" && value !== "Outro") {
      updated.tipoNegocioOutro = "";
    }
    setAnswers(updated);
    setErrorMessage(null);
    void persistProgress(currentStep, { stepToResume: currentStep, overrideAnswers: { [field]: value } });
  };

  const handleNext = async () => {
    const error = getFieldError(currentQuestionId, answers);
    if (error) {
      setErrorMessage(error);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const questionNumber = currentStep;
    const nextStep = Math.min(currentStep + 1, QUIZ_TOTAL_QUESTIONS);
    setDirection(1);
    setCurrentStep(nextStep);
    const lead = await persistProgress(questionNumber, { stepToResume: nextStep });
    if (lead) {
      setLastAnsweredStep(questionNumber);
    }
    trackEvent("quiz_step_completed", { step: questionNumber, classificationPreview: classification, score: score.total });
  };

  const handleBack = () => {
    if (currentStep === 1) return;
    setDirection(-1);
    setCurrentStep(prev => Math.max(1, prev - 1));
    setErrorMessage(null);
  };

  const handleFinish = async () => {
    const error = getFieldError(currentQuestionId, answers);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setView("loading");
    const durationSeconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : undefined;
    const lead = await persistProgress(QUIZ_TOTAL_QUESTIONS, {
      stepToResume: QUIZ_TOTAL_QUESTIONS,
      markComplete: true,
      tempoTotalSegundos: durationSeconds,
    });

    setLastAnsweredStep(QUIZ_TOTAL_QUESTIONS);
    setResultLead(lead ?? null);
    if (lead) {
      clearStoredState();
    } else {
      setPendingSync(true);
    }
    const leadClassification = lead?.classificacao || classification;
    const leadScore = lead?.scoreTotal ?? score.total;
    loadingTimerRef.current = window.setTimeout(() => {
      setView("result");
      trackEvent("quiz_completed", {
        classification: leadClassification,
        score: leadScore,
        synced: !!lead,
      });
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (view !== "result") {
      trackEvent("quiz_abandoned", { step: currentStep });
    } else if (!pendingSync) {
      clearStoredState();
      setAnswers(INITIAL_ANSWERS);
      setCurrentStep(1);
      setLastAnsweredStep(0);
      setResultLead(null);
      setSessionId(generateSessionId());
      setStartedAt(new Date());
    }
    setView("quiz");
    setErrorMessage(null);
    setDirection(1);
    onClose();
  };

  const handleResultAction = (href: string, classificationValue: LeadClassification) => {
    trackEvent("quiz_result_action", { classification: classificationValue, href });
    window.location.href = href;
  };

  if (!open) return null;

  const currentQuestionTitleMap: Record<keyof Answers, string> = {
    nome: "Qual é o seu nome completo?",
    email: "Qual é o seu email?",
    telefone: "Qual é o seu telefone/WhatsApp?",
    cidadeEstado: "Em qual cidade e estado você está nos EUA?",
    tipoNegocio: "Qual tipo de negócio você tem?",
    tempoNegocio: "Há quanto tempo você tem esse negócio nos EUA?",
    experienciaMarketing: "Você já investiu em marketing digital antes?",
    orcamentoAnuncios: "Quanto você está disposto a investir MENSALMENTE em anúncios?",
    principalDesafio: "Qual é o seu MAIOR desafio hoje?",
    disponibilidade: "Quanto tempo por semana você consegue dedicar ao aprendizado?",
    expectativaResultado: "Em quanto tempo você espera começar a ver resultados?",
    tipoNegocioOutro: "",
  };

  const isLastStep = currentStep === QUIZ_TOTAL_QUESTIONS;
  const resultClassification = (resultLead?.classificacao || classification) as LeadClassification;
  const resultConfig = RESULT_CONFIG[resultClassification];
  const canProceed = !getFieldError(currentQuestionId, answers);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6 sm:py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="w-full max-w-[640px]">
          <div className="relative overflow-hidden bg-white text-slate-900 h-full sm:h-auto rounded-none sm:rounded-3xl shadow-2xl" ref={containerRef}>
            <button
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Fechar quiz"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col h-full">
              <div className="w-full h-1 bg-slate-100">
                <div
                  className="h-full bg-[#406EF1] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="px-6 pb-6 pt-14 sm:pt-12 sm:px-10 space-y-4 overflow-y-auto max-h-[85vh]">
                {storageAvailable ? null : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-semibold">Importante</p>
                      <p>Não feche esta janela até completar o quiz. Seu navegador não permite salvar localmente.</p>
                    </div>
                  </div>
                )}

                {view === "quiz" && (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#406EF1] uppercase tracking-wide">Vamos começar!</p>
                        <h2 className="text-2xl sm:text-3xl font-bold leading-tight mt-1">{currentQuestionTitleMap[currentQuestionId]}</h2>
                      </div>
                    </div>

                    <AnimatePresence mode="wait" initial={false} custom={direction}>
                      <motion.div
                        key={currentStep}
                        custom={direction}
                        initial={{ x: direction > 0 ? 30 : -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: direction > 0 ? -30 : 30, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="mt-6 space-y-4"
                      >
                        {currentQuestionId === "nome" && (
                          <input
                            value={answers.nome}
                            onChange={e => handleAnswerChange("nome", e.target.value)}
                            placeholder="Digite seu nome completo"
                            className={clsx(
                              "w-full rounded-xl border px-4 py-3 text-lg transition-colors",
                              errorMessage ? "border-red-400" : "border-slate-200",
                              "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                            )}
                            aria-label="Nome completo"
                          />
                        )}

                        {currentQuestionId === "email" && (
                          <input
                            type="email"
                            value={answers.email}
                            onChange={e => handleAnswerChange("email", e.target.value)}
                            placeholder="exemplo@email.com"
                            className={clsx(
                              "w-full rounded-xl border px-4 py-3 text-lg transition-colors",
                              errorMessage ? "border-red-400" : "border-slate-200",
                              "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                            )}
                            aria-label="Email"
                          />
                        )}

                        {currentQuestionId === "telefone" && (
                          <input
                            type="tel"
                            value={answers.telefone}
                            onChange={e => handleAnswerChange("telefone", e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className={clsx(
                              "w-full rounded-xl border px-4 py-3 text-lg transition-colors",
                              errorMessage ? "border-red-400" : "border-slate-200",
                              "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                            )}
                            aria-label="Telefone"
                            maxLength={18}
                          />
                        )}

                        {currentQuestionId === "cidadeEstado" && (
                          <input
                            value={answers.cidadeEstado}
                            onChange={e => handleAnswerChange("cidadeEstado", e.target.value)}
                            placeholder="Boston, MA"
                            className={clsx(
                              "w-full rounded-xl border px-4 py-3 text-lg transition-colors",
                              errorMessage ? "border-red-400" : "border-slate-200",
                              "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                            )}
                            aria-label="Cidade e Estado"
                          />
                        )}

                        {currentQuestionId && ["tipoNegocio", "tempoNegocio", "experienciaMarketing", "orcamentoAnuncios", "principalDesafio", "disponibilidade", "expectativaResultado"].includes(currentQuestionId) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {quizOptions[currentQuestionId as keyof typeof quizOptions].map(option => (
                              <button
                                type="button"
                                key={option.value}
                                onClick={() => handleOptionSelect(currentQuestionId, option.value)}
                                className={clsx(
                                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all shadow-sm",
                                  answers[currentQuestionId] === option.value
                                    ? "border-[#406EF1] bg-[#EFF3FF] shadow-md"
                                    : "border-slate-200 hover:border-[#406EF1]/70 hover:bg-slate-50",
                                  errorMessage && !answers[currentQuestionId] ? "border-red-400" : ""
                                )}
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">{option.label}</p>
                                </div>
                                {answers[currentQuestionId] === option.value && (
                                  <span className="h-8 w-8 rounded-full bg-[#406EF1] text-white flex items-center justify-center">
                                    <Check className="h-4 w-4" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {currentQuestionId === "tipoNegocio" && answers.tipoNegocio === "Outro" && (
                          <div className="mt-2">
                            <label className="text-sm font-semibold text-slate-700">Conte qual é o seu negócio</label>
                            <input
                              value={answers.tipoNegocioOutro}
                              onChange={e => handleAnswerChange("tipoNegocioOutro", e.target.value)}
                              placeholder="Descreva seu tipo de negócio"
                              className={clsx(
                                "mt-1 w-full rounded-xl border px-4 py-3 text-base transition-colors",
                                errorMessage ? "border-red-400" : "border-slate-200",
                                "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                              )}
                            />
                          </div>
                        )}

                        {errorMessage && (
                          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 animate-quiz-shake">
                            <AlertCircle className="h-5 w-5 mt-0.5" />
                            <p className="font-medium">{errorMessage}</p>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                      </button>
                      <button
                        type="button"
                        aria-disabled={!canProceed}
                        onClick={isLastStep ? handleFinish : handleNext}
                        className={clsx(
                          "inline-flex items-center justify-center gap-2 rounded-xl bg-[#406EF1] px-5 py-3 text-white font-semibold hover:bg-[#355CD0] transition-colors w-full sm:w-auto",
                          !canProceed && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {isLastStep ? "Finalizar" : "Próximo"}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}

                {view === "loading" && (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <div className="h-14 w-14 rounded-full border-4 border-slate-200 border-t-[#406EF1] animate-spin" />
                    <div className="text-center space-y-2">
                      <p className="text-xl font-semibold text-slate-900">Analisando seu perfil...</p>
                      <p className="text-slate-500">Isso leva apenas alguns instantes.</p>
                    </div>
                  </div>
                )}

                {view === "result" && (
                  <div className="space-y-6 py-4">
                    <div
                      className="rounded-2xl border px-6 py-6 shadow-sm"
                      style={{ borderColor: resultConfig.color + "55", background: `${resultConfig.color}0f` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: resultConfig.color }}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: resultConfig.color }}>
                            {resultClassification === "QUENTE" ? "Lead Quente" : resultClassification === "MORNO" ? "Lead Morno" : resultClassification === "FRIO" ? "Lead Frio" : "Desqualificado"}
                          </p>
                          <h3 className="text-2xl font-bold text-slate-900">{resultConfig.title}</h3>
                          <p className="text-slate-600 text-lg">{resultConfig.message}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => handleResultAction(resultConfig.href, resultClassification)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-white font-semibold shadow-lg transition-transform hover:scale-[1.01]"
                          style={{ backgroundColor: resultConfig.color }}
                        >
                          {resultConfig.cta}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            clearStoredState();
                            setAnswers(INITIAL_ANSWERS);
                            setCurrentStep(1);
                            setLastAnsweredStep(0);
                            setView("quiz");
                            setResultLead(null);
                            setSessionId(generateSessionId());
                            setStartedAt(new Date());
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Refazer quiz
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">Seus dados foram salvos com segurança.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
