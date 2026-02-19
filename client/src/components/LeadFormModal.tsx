import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { DEFAULT_FORM_CONFIG, calculateFormScoresWithConfig, classifyLead, getSortedQuestions, KNOWN_FIELD_IDS } from "@shared/form";
import type { LeadClassification, FormLead, FormConfig, FormQuestion } from "@shared/schema";

type FormView = "form" | "loading";

// Dynamic answers type - supports any question ID
type Answers = Record<string, string>;

type StoredFormState = {
  sessionId: string;
  answers: Answers;
  currentStep: number;
  lastAnsweredStep: number;
  startedAt: string;
  lastUpdatedAt: string;
  pendingSync: boolean;
  selectedCountry?: string;
};

// Country configuration for phone input
type CountryConfig = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  format: string; // e.g., "(###) ###-####" for US
  maxDigits: number;
};

const COUNTRIES: CountryConfig[] = [
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸", format: "(###) ###-####", maxDigits: 10 },
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷", format: "(##) #####-####", maxDigits: 11 },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽", format: "(##) ####-####", maxDigits: 10 },
  { code: "CA", name: "Canadá", dialCode: "+1", flag: "🇨🇦", format: "(###) ###-####", maxDigits: 10 },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹", format: "### ### ###", maxDigits: 9 },
  { code: "ES", name: "Espanha", dialCode: "+34", flag: "🇪🇸", format: "### ### ###", maxDigits: 9 },
  { code: "UK", name: "Reino Unido", dialCode: "+44", flag: "🇬🇧", format: "#### ######", maxDigits: 10 },
  { code: "DE", name: "Alemanha", dialCode: "+49", flag: "🇩🇪", format: "### #######", maxDigits: 10 },
  { code: "FR", name: "França", dialCode: "+33", flag: "🇫🇷", format: "# ## ## ## ##", maxDigits: 9 },
  { code: "IT", name: "Itália", dialCode: "+39", flag: "🇮🇹", format: "### ### ####", maxDigits: 10 },
];

const DEFAULT_COUNTRY = "US";

const STORAGE_KEY = "skale-form-state";
const EXPIRATION_HOURS = 24;
const NAME_REGEX = /^[A-Za-zÀ-ÿ\s]{3,100}$/;

// Build initial answers from config
function buildInitialAnswers(config: FormConfig): Answers {
  const answers: Answers = {};
  for (const q of config.questions) {
    answers[q.id] = "";
    if (q.conditionalField) {
      answers[q.conditionalField.id] = "";
    }
  }
  return answers;
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 generator (non-crypto secure but valid format)
  const random = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${random()}${random()}-${random()}-${random()}-${random()}-${random()}${random()}${random()}`;
}

function formatPhoneForCountry(value: string, country: CountryConfig): string {
  // Only keep digits
  const digits = value.replace(/\D/g, "").slice(0, country.maxDigits);

  if (!digits) return "";

  // Apply format pattern
  let result = "";
  let digitIndex = 0;

  for (const char of country.format) {
    if (digitIndex >= digits.length) break;
    if (char === "#") {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += char;
    }
  }

  return result;
}

function getFullPhoneNumber(formattedPhone: string, country: CountryConfig): string {
  const digits = formattedPhone.replace(/\D/g, "");
  if (!digits) return "";
  return `${country.dialCode} ${formattedPhone}`;
}

function isValidPhoneForCountry(value: string, country: CountryConfig): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === country.maxDigits;
}

function isExpired(timestamp: string) {
  const last = new Date(timestamp).getTime();
  if (!last) return true;
  const diffHours = (Date.now() - last) / (1000 * 60 * 60);
  return diffHours > EXPIRATION_HOURS;
}

function loadStoredState(): StoredFormState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFormState;
    if (!parsed.sessionId || !parsed.startedAt || isExpired(parsed.lastUpdatedAt)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredState(state: StoredFormState) {
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

function getFieldError(question: FormQuestion | undefined, answers: Answers, selectedCountry?: CountryConfig): string | null {
  if (!question) return null;

  const value = (answers[question.id] || "").trim();

  // Check if required and empty
  if (question.required && !value) {
    if (question.type === "select") {
      return "Please select an option";
    }
    return "This field is required";
  }

  // Type-specific validation
  switch (question.type) {
    case "text": {
      // Special validation for name field
      if (question.id === "nome" && value) {
        if (value.length < 3 || value.length > 100) return "Please enter your full name";
        if (!NAME_REGEX.test(value)) return "Use only letters and spaces";
      }
      // Generic text validation
      if (value && value.length < 3) return "Please enter at least 3 characters";
      break;
    }
    case "email": {
      if (value && !/.+@.+\..+/.test(value)) return "Please enter a valid email";
      break;
    }
    case "tel": {
      if (value && selectedCountry) {
        if (!isValidPhoneForCountry(value, selectedCountry)) {
          return `Please enter a valid phone number (${selectedCountry.maxDigits} digits)`;
        }
      }
      break;
    }
    case "select": {
      // Check conditional field if applicable
      if (question.conditionalField && value === question.conditionalField.showWhen) {
        const conditionalValue = (answers[question.conditionalField.id] || "").trim();
        if (!conditionalValue) {
          return `Please fill in the additional field`;
        }
      }
      break;
    }
  }

  return null;
}

type LeadFormModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LeadFormModal({ open, onClose }: LeadFormModalProps) {
  // Fetch form config
  const { data: formConfig, isLoading: isConfigLoading } = useQuery<FormConfig>({
    queryKey: ['/api/form-config'],
    queryFn: async () => {
      const res = await fetch('/api/form-config');
      if (!res.ok) throw new Error('Failed to load form config');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const config = formConfig || DEFAULT_FORM_CONFIG;
  const sortedQuestions = useMemo(() => getSortedQuestions(config), [config]);
  const totalQuestions = sortedQuestions.length;

  const [answers, setAnswers] = useState<Answers>(() => buildInitialAnswers(DEFAULT_FORM_CONFIG));
  const [currentStep, setCurrentStep] = useState(1);
  const [lastAnsweredStep, setLastAnsweredStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [view, setView] = useState<FormView>("form");
  const [pendingSync, setPendingSync] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [originUrl, setOriginUrl] = useState("");
  const [utmParams, setUtmParams] = useState({ source: "", medium: "", campaign: "" });
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(DEFAULT_COUNTRY);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 256 });
  const autoSaveRef = useRef<number>();
  const answersRef = useRef<Answers>(buildInitialAnswers(DEFAULT_FORM_CONFIG));
  const syncedOnOpenRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const countryButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const conditionalInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCountry = useMemo(() =>
    COUNTRIES.find(c => c.code === selectedCountryCode) || COUNTRIES[0],
    [selectedCountryCode]
  );

  // Update answers when config loads
  useEffect(() => {
    if (formConfig) {
      const newInitial = buildInitialAnswers(formConfig);
      setAnswers(prev => ({ ...newInitial, ...prev }));
      answersRef.current = { ...newInitial, ...answersRef.current };
    }
  }, [formConfig]);

  const score = useMemo(() => calculateFormScoresWithConfig(answers, config), [answers, config]);
  const classification = useMemo(() => classifyLead(score.total, config.thresholds), [score.total, config.thresholds]);
  const progressPercent = Math.min((currentStep / totalQuestions) * 100, 100);

  const currentQuestion = sortedQuestions[currentStep - 1];
  const currentQuestionId = currentQuestion?.id;

  const handleFieldFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    lastFocusedInputRef.current = event.currentTarget;
  };

  useEffect(() => {
    try {
      const testKey = "__form_check__";
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
      setCurrentStep(Math.min(stored.currentStep, totalQuestions));
      setLastAnsweredStep(stored.lastAnsweredStep || 0);
      setStartedAt(new Date(stored.startedAt));
      setPendingSync(stored.pendingSync);
      if (stored.selectedCountry) {
        setSelectedCountryCode(stored.selectedCountry);
      }
    }
  }, []);

  // Close country dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      ensureSession();
      trackEvent("form_open", { location: "home" });
    } else {
      document.body.style.overflow = "";
      syncedOnOpenRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, ensureSession]);

  useEffect(() => {
    lastFocusedInputRef.current = null;
  }, [currentQuestionId]);

  // Auto-focus input when changing steps
  useEffect(() => {
    if (!open || view !== "form") return;

    // Use requestAnimationFrame to ensure DOM is ready after AnimatePresence animation
    const rafId = requestAnimationFrame(() => {
      // Add a small delay to ensure the animation has completed
      const timerId = setTimeout(() => {
        const target = lastFocusedInputRef.current || primaryInputRef.current || conditionalInputRef.current;
        if (target && document.activeElement !== target) {
          target.focus();
        }
      }, 50);

      return () => clearTimeout(timerId);
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentQuestionId, open, view]);

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
      const payload: StoredFormState = {
        sessionId: session,
        answers,
        currentStep: stepToResume,
        lastAnsweredStep: answeredStep,
        startedAt: (startedAt || new Date()).toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        pendingSync: pending,
        selectedCountry: selectedCountryCode,
      };
      saveStoredState(payload);
    },
    [answers, ensureSession, pendingSync, selectedCountryCode, startedAt, storageAvailable],
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const persistProgress = useCallback(
    async (
      questionNumber: number,
      opts?: { stepToResume?: number; markComplete?: boolean; tempoTotalSegundos?: number; overrideAnswers?: Partial<Answers> }
    ): Promise<FormLead | null> => {
      const session = ensureSession();
      const effectiveAnswers = { ...answersRef.current, ...(opts?.overrideAnswers || {}) };
      const effectiveScore = calculateFormScoresWithConfig(effectiveAnswers, config);
      const customAnswers = Object.fromEntries(
        Object.entries(effectiveAnswers)
          .filter(([key, value]) => !KNOWN_FIELD_IDS.includes(key) && typeof value === "string" && value.trim())
          .map(([key, value]) => [key, (value as string).trim()])
      );
      const payload: any = {
        sessionId: session,
        questionNumber,
        startedAt: (startedAt || new Date()).toISOString(),
        urlOrigem: originUrl,
        utmSource: utmParams.source || undefined,
        utmMedium: utmParams.medium || undefined,
        utmCampaign: utmParams.campaign || undefined,
        formCompleto: opts?.markComplete || false,
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
      if (Object.keys(customAnswers).length > 0) {
        payload.customAnswers = customAnswers;
      }

      if (effectiveAnswers.nome) payload.nome = effectiveAnswers.nome.trim();
      if (effectiveAnswers.email) payload.email = effectiveAnswers.email.trim();
      if (effectiveAnswers.telefone) {
        // Include country code in the phone number
        const phoneDigits = effectiveAnswers.telefone.replace(/\D/g, "");
        if (phoneDigits.length === selectedCountry.maxDigits) {
          payload.telefone = getFullPhoneNumber(effectiveAnswers.telefone, selectedCountry);
        } else {
          payload.telefone = effectiveAnswers.telefone.trim();
        }
      }
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
        const res = await fetch("/api/form-leads/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorText = await res.text();
          let friendlyMessage = errorText;
          try {
            const parsed = JSON.parse(errorText);
            friendlyMessage = parsed?.message || errorText;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(friendlyMessage || "Error saving progress");
        }
        const lead = (await res.json()) as FormLead;
        setPendingSync(false);
        updateStoredState(opts?.stepToResume ?? currentStep, questionNumber, false);
        setLastAnsweredStep(questionNumber);
        return lead;
      } catch (err) {
        console.error("Failed to sync lead progress", err);
        setPendingSync(true);
        updateStoredState(opts?.stepToResume ?? currentStep, questionNumber, true);
        throw err;
      }
    },
    [
      config,
      currentStep,
      ensureSession,
      originUrl,
      pendingSync,
      selectedCountry,
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

  const handleAnswerChange = (field: string, value: string) => {
    ensureSession();
    // Format phone if it's a tel field
    const question = sortedQuestions.find(q => q.id === field);
    if (question?.type === "tel") {
      value = formatPhoneForCountry(value, selectedCountry);
    }
    setAnswers(prev => ({ ...prev, [field]: value }));
    setErrorMessage(null);

    if (autoSaveRef.current) window.clearTimeout(autoSaveRef.current);
    autoSaveRef.current = window.setTimeout(() => {
      const error = getFieldError(question, { ...answers, [field]: value }, selectedCountry);
      if (!error && currentQuestion?.id === field) {
        // For phone fields, save with country code prefix
        const valueToSave = question?.type === "tel" && value
          ? getFullPhoneNumber(value, selectedCountry)
          : value;
        void persistProgress(currentStep, { stepToResume: currentStep, overrideAnswers: { [field]: valueToSave } });
      }
    }, 400);
  };

  const handleOptionSelect = (field: string, value: string) => {
    const updated = { ...answers, [field]: value };
    // Clear conditional field if option changes
    const question = sortedQuestions.find(q => q.id === field);
    if (question?.conditionalField && value !== question.conditionalField.showWhen) {
      updated[question.conditionalField.id] = "";
    }
    setAnswers(updated);
    setErrorMessage(null);
    void persistProgress(currentStep, { stepToResume: currentStep, overrideAnswers: { [field]: value } });
  };

  const handleNext = async () => {
    // Clear any pending auto-save to avoid race conditions
    if (autoSaveRef.current) {
      window.clearTimeout(autoSaveRef.current);
      autoSaveRef.current = undefined;
    }

    const error = getFieldError(currentQuestion, answers, selectedCountry);
    if (error) {
      setErrorMessage(error);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Clear error and advance step immediately for responsive UI
    setErrorMessage(null);
    const questionNumber = currentStep;
    const nextStep = Math.min(currentStep + 1, totalQuestions);
    setDirection(1);
    setCurrentStep(nextStep);

    try {
      const lead = await persistProgress(questionNumber, { stepToResume: nextStep });
      if (lead) {
        setLastAnsweredStep(questionNumber);
      }
      trackEvent("form_step_completed", { step: questionNumber, classificationPreview: classification, score: score.total });
    } catch (err: any) {
      // Don't revert step on network errors - just mark as pending sync
      // This allows the user to continue filling the form
      setErrorMessage(err?.message || "Could not send right now. Please try again in a moment.");
      setPendingSync(true);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) return;
    // Clear any pending auto-save to avoid race conditions
    if (autoSaveRef.current) {
      window.clearTimeout(autoSaveRef.current);
      autoSaveRef.current = undefined;
    }
    setDirection(-1);
    setCurrentStep(prev => Math.max(1, prev - 1));
    setErrorMessage(null);
  };

  const handleFinish = async () => {
    const error = getFieldError(currentQuestion, answers, selectedCountry);
    if (error) {
      setErrorMessage(error);
      return;
    }
    setView("loading");
    const durationSeconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : undefined;
    try {
      const lead = await persistProgress(totalQuestions, {
        stepToResume: totalQuestions,
        markComplete: true,
        tempoTotalSegundos: durationSeconds,
      });

      setLastAnsweredStep(totalQuestions);
      if (lead) {
        clearStoredState();
        const leadClassification = lead.classificacao || classification;
        const leadScore = lead.scoreTotal ?? score.total;
        trackEvent("form_completed", {
          classification: leadClassification,
          score: leadScore,
          synced: true,
        });
        onClose();
        window.location.href = "/thankyou";
        return;
      }

      setPendingSync(true);
      setErrorMessage("Could not send right now. Please try again in a moment.");
      setView("form");
    } catch (err: any) {
      const msg = err?.message || "Could not send right now. Please try again in a moment.";
      setErrorMessage(msg);
      setPendingSync(true);
      setView("form");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLastStep) {
      await handleFinish();
    } else {
      await handleNext();
    }
  };

  const handleClose = () => {
    if (view === "form") {
      trackEvent("form_abandoned", { step: currentStep });
    }
    clearStoredState();
    setAnswers(buildInitialAnswers(config));
    setCurrentStep(1);
    setLastAnsweredStep(0);
    setSessionId(generateSessionId());
    setStartedAt(new Date());
    setView("form");
    setErrorMessage(null);
    setDirection(1);
    onClose();
  };

  if (!open) return null;

  // Show loading while config is loading
  if (isConfigLoading) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#406EF1]" />
          <p className="text-slate-600">Carregando formulário...</p>
        </div>
      </div>,
      document.body
    );
  }

  const isLastStep = currentStep === totalQuestions;
  const canProceed = !getFieldError(currentQuestion, answers, selectedCountry);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6 sm:py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="w-full max-w-[640px]">
          <div className="relative bg-white text-slate-900 h-full sm:h-auto rounded-none sm:rounded-3xl shadow-2xl overflow-hidden" ref={containerRef}>
            <button
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close form"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col h-full">
            <div className="absolute inset-x-6 sm:inset-x-10 h-3 -top-[6px] bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#406EF1] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="px-6 pb-6 pt-14 sm:pt-12 sm:px-10 space-y-4 overflow-y-auto max-h-[85vh]">
                {storageAvailable ? null : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div>
                      <p className="font-semibold">Important</p>
                      <p>Don't close this window until you complete the form. Your browser doesn't allow local saves.</p>
                    </div>
                  </div>
                )}

                {view === "form" && currentQuestion && (
                  <form onSubmit={handleSubmit}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#406EF1] uppercase tracking-wide">Vamos começar!</p>
                        <h2 className="text-2xl sm:text-3xl font-bold leading-tight mt-1">{currentQuestion.title}</h2>
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
                        {/* Text input fields */}
                        {(currentQuestion.type === "text" || currentQuestion.type === "email") && (
                          <input
                            ref={primaryInputRef}
                            type={currentQuestion.type === "email" ? "email" : "text"}
                            value={answers[currentQuestion.id] || ""}
                            onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                            onFocus={handleFieldFocus}
                            placeholder={currentQuestion.placeholder || ""}
                            className={clsx(
                              "w-full rounded-xl border px-4 py-3 text-lg transition-colors",
                              errorMessage ? "border-red-400" : "border-slate-200",
                              "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                            )}
                            aria-label={currentQuestion.title}
                          />
                        )}

                        {/* Phone input with country selector */}
                        {currentQuestion.type === "tel" && (
                          <div className="flex gap-2">
                            {/* Country selector */}
                            <div className="relative flex-shrink-0" ref={countryDropdownRef}>
                              <button
                                ref={countryButtonRef}
                                type="button"
                                onClick={() => {
                                  if (!isCountryDropdownOpen && countryButtonRef.current) {
                                    const rect = countryButtonRef.current.getBoundingClientRect();
                                    setDropdownPosition({
                                      top: rect.bottom + 4,
                                      left: rect.left,
                                      width: Math.max(256, rect.width),
                                    });
                                  }
                                  setIsCountryDropdownOpen(!isCountryDropdownOpen);
                                }}
                                className={clsx(
                                  "flex items-center gap-1 rounded-xl border px-2 sm:px-3 py-3 text-base sm:text-lg transition-colors h-[52px]",
                                  errorMessage ? "border-red-400" : "border-slate-200",
                                  "hover:border-[#406EF1]/70 focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                                )}
                              >
                                <span className="text-lg sm:text-xl">{selectedCountry.flag}</span>
                                <span className="text-xs sm:text-sm text-slate-600">{selectedCountry.dialCode}</span>
                                <ChevronDown className={clsx(
                                  "h-3 w-3 sm:h-4 sm:w-4 text-slate-400 transition-transform",
                                  isCountryDropdownOpen && "rotate-180"
                                )} />
                              </button>

                              {/* Dropdown - rendered via portal to avoid overflow clipping */}
                              {isCountryDropdownOpen && createPortal(
                                <AnimatePresence>
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.15 }}
                                    className="fixed z-[200] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
                                    style={{
                                      top: dropdownPosition.top,
                                      left: dropdownPosition.left,
                                      width: dropdownPosition.width,
                                    }}
                                  >
                                    <div className="max-h-48 overflow-y-auto py-1">
                                      {COUNTRIES.map((country) => (
                                        <button
                                          key={country.code}
                                          type="button"
                                          onClick={() => {
                                            setSelectedCountryCode(country.code);
                                            setIsCountryDropdownOpen(false);
                                            // Clear phone when changing country
                                            setAnswers(prev => ({ ...prev, [currentQuestion.id]: "" }));
                                          }}
                                          className={clsx(
                                            "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors",
                                            selectedCountryCode === country.code && "bg-[#EFF3FF]"
                                          )}
                                        >
                                          <span className="text-xl">{country.flag}</span>
                                          <span className="flex-1 text-sm font-medium text-slate-700">{country.name}</span>
                                          <span className="text-sm text-slate-500">{country.dialCode}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                </AnimatePresence>,
                                document.body
                              )}
                            </div>

                            {/* Phone input */}
                            <input
                              ref={primaryInputRef}
                              type="tel"
                              value={answers[currentQuestion.id] || ""}
                              onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                              onFocus={handleFieldFocus}
                              placeholder={selectedCountry.format.replace(/#/g, "0")}
                              className={clsx(
                                "flex-1 min-w-0 rounded-xl border px-3 sm:px-4 py-3 text-base sm:text-lg transition-colors",
                                errorMessage ? "border-red-400" : "border-slate-200",
                                "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                              )}
                              aria-label={currentQuestion.title}
                              maxLength={selectedCountry.format.length}
                            />
                          </div>
                        )}

                        {/* Multiple choice fields */}
                        {currentQuestion.type === "select" && currentQuestion.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {currentQuestion.options.map(option => (
                              <button
                                type="button"
                                key={option.value}
                                onClick={() => handleOptionSelect(currentQuestion.id, option.value)}
                                className={clsx(
                                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all shadow-sm",
                                  answers[currentQuestion.id] === option.value
                                    ? "border-[#406EF1] bg-[#EFF3FF] shadow-md"
                                    : "border-slate-200 hover:border-[#406EF1]/70 hover:bg-slate-50",
                                  errorMessage && !answers[currentQuestion.id] ? "border-red-400" : ""
                                )}
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">{option.label}</p>
                                </div>
                                {answers[currentQuestion.id] === option.value && (
                                  <span className="h-8 w-8 min-h-8 min-w-8 rounded-full bg-[#406EF1] text-white flex items-center justify-center shrink-0">
                                    <Check className="h-4 w-4" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Conditional field (e.g., "Outro" text input) */}
                        {currentQuestion.conditionalField &&
                         answers[currentQuestion.id] === currentQuestion.conditionalField.showWhen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200"
                          >
                            <label htmlFor={`conditional-${currentQuestion.conditionalField.id}`} className="text-sm font-semibold text-slate-700 block mb-2">
                              {currentQuestion.conditionalField.title}
                            </label>
                            <input
                              id={`conditional-${currentQuestion.conditionalField.id}`}
                              ref={conditionalInputRef}
                              value={answers[currentQuestion.conditionalField.id] || ""}
                              onChange={e => handleAnswerChange(currentQuestion.conditionalField!.id, e.target.value)}
                              onFocus={handleFieldFocus}
                              placeholder={currentQuestion.conditionalField.placeholder}
                              className={clsx(
                                "w-full rounded-lg border px-4 py-2 text-base transition-colors",
                                errorMessage ? "border-red-400 bg-red-50" : "border-blue-300 bg-white",
                                "focus:border-[#406EF1] focus:ring-2 focus:ring-[#406EF1]/30"
                              )}
                            />
                          </motion.div>
                        )}

                        {errorMessage && (
                          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 animate-form-shake">
                            <AlertCircle className="h-5 w-5 mt-0.5" />
                            <p className="font-medium">{errorMessage}</p>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-8 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={currentStep === 1}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 p-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Go back"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="submit"
                        aria-disabled={!canProceed}
                        className={clsx(
                          "inline-flex items-center justify-center gap-2 rounded-xl bg-[#406EF1] px-6 py-3 text-white font-semibold hover:bg-[#355CD0] transition-colors flex-1",
                          !canProceed && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {isLastStep ? "Finish" : "Next"}
                        <ArrowRight className="h-4 w-4 flex-shrink-0" />
                      </button>
                    </div>
                  </form>
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
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
