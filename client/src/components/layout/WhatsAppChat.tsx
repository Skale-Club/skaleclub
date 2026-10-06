import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { CheckCheck, ChevronDown, SendHorizontal, X } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { whatsappPageRef } from "@shared/site-whatsapp";
import { useTranslation } from "@/hooks/useTranslation";
import { useSiteWhatsappHref } from "@/hooks/use-site-whatsapp";
import { trackEvent } from "@/lib/analytics";
import { getStoredVisitorId } from "@/lib/attribution";
import {
  PHONE_COUNTRIES,
  detectDefaultPhoneCountry,
  formatPhoneForCountry,
  getInternationalPhone,
  getPhoneCountryFlagUrl,
  isValidPhoneForCountry,
  type PhoneCountry,
} from "@/lib/phoneCountries";
import { WHATSAPP_CHAT_FORM, rememberWhatsAppChatLead, type WhatsAppChatEntry } from "@/lib/whatsappChat";

// The script is picked per language here, NOT run through t(): a
// machine-translated fallback would rephrase a conversation that has to read
// like a person typing. No em-dashes in this copy.
const COPY = {
  en: {
    status: "online",
    today: "TODAY",
    greet: "Hi! 👋 Thanks for reaching out.",
    askName: "Before we jump to WhatsApp, what's your name?",
    retryName: "Sorry, I didn't catch your name. What should I call you?",
    askPhone: (name: string) => `Nice to meet you, ${name}! What's your WhatsApp number?`,
    retryPhone: "That number doesn't look complete. Can you check it and send it again?",
    done: (name: string) => `Perfect, ${name}! Opening WhatsApp now. If we miss each other there, we'll message you on this number.`,
    open: "Continue on WhatsApp",
    namePlaceholder: "Type your name",
    send: "Send",
    close: "Close",
    country: "Phone country",
  },
  pt: {
    status: "online",
    today: "HOJE",
    greet: "Oi! 👋 Que bom que você chamou.",
    askName: "Antes de ir para o WhatsApp, qual é o seu nome?",
    retryName: "Não peguei o seu nome. Como posso te chamar?",
    askPhone: (name: string) => `Prazer, ${name}! Qual é o seu número de WhatsApp?`,
    retryPhone: "Esse número parece incompleto. Pode conferir e mandar de novo?",
    done: (name: string) => `Perfeito, ${name}! Abrindo o WhatsApp agora. Se a gente se desencontrar por lá, eu te chamo nesse número.`,
    open: "Continuar no WhatsApp",
    namePlaceholder: "Digite seu nome",
    send: "Enviar",
    close: "Fechar",
    country: "País do telefone",
  },
} as const;

type Step = "name" | "phone" | "saving" | "done";
type Message = { id: number; from: "them" | "me"; text: string; time: string };

const TYPING_MS = 850;

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    urlOrigem: window.location.href.slice(0, 500),
    utmSource: p.get("utm_source") || undefined,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
  };
}

interface WhatsAppChatProps {
  open: boolean;
  entry: WhatsAppChatEntry;
  onClose: () => void;
  phone: string;
  companyName: string;
  avatarUrl?: string;
}

/**
 * WhatsApp-looking chat that asks for a name, then a phone number, saves them
 * as a lead and only then hands the visitor to wa.me. The phone is mandatory:
 * the lead conversion fires on a saved contact, never on a bare click.
 */
export function WhatsAppChat({ open, entry, onClose, phone, companyName, avatarUrl }: WhatsAppChatProps) {
  const [location] = useLocation();
  const { language } = useTranslation();
  const copy = language === "pt" ? COPY.pt : COPY.en;
  const whatsappLink = useSiteWhatsappHref(phone);

  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState<Step>("name");
  const [draft, setDraft] = useState("");
  const [country, setCountry] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());
  const [countryOpen, setCountryOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const nameRef = useRef("");
  const startedRef = useRef(false);
  const openedAtRef = useRef(0);
  const handedOffRef = useRef(false);
  const nextIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const honeypotRef = useRef<HTMLInputElement | null>(null);

  const push = useCallback((from: Message["from"], text: string) => {
    setMessages((cur) => [...cur, { id: nextIdRef.current++, from, text, time: nowLabel() }]);
  }, []);

  // Shows the typing dots, then each line as its own bubble.
  const say = useCallback((lines: string[], after?: () => void) => {
    setTyping(true);
    lines.forEach((line, i) => {
      timersRef.current.push(window.setTimeout(() => {
        push("them", line);
        if (i === lines.length - 1) {
          setTyping(false);
          after?.();
        }
      }, TYPING_MS * (i + 1)));
    });
  }, [push]);

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  // First open starts the conversation; reopening resumes it where it was.
  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    openedAtRef.current = Date.now();
    trackEvent("form_open", { location: entry, label: WHATSAPP_CHAT_FORM });
    say([copy.greet, copy.askName]);
  }, [open, entry, say, copy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open, step]);

  useEffect(() => {
    if (open && !typing && step !== "done" && step !== "saving") inputRef.current?.focus({ preventScroll: true });
  }, [open, typing, step]);

  // On phones the on-screen keyboard covers a bottom-fixed panel; lift it by
  // the part of the layout viewport the keyboard hides.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const update = () => setKeyboardInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trackHandoff = () => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    trackEvent("click_whatsapp", { location: entry, label: WHATSAPP_CHAT_FORM });
  };

  const handleClose = () => {
    if (startedRef.current && step !== "done") {
      trackEvent("form_abandoned", { location: entry, label: WHATSAPP_CHAT_FORM, step });
    }
    onClose();
  };

  const submitPhone = async (international: string) => {
    setStep("saving");
    setTyping(true);
    let saved = false;
    try {
      const visitorId = getStoredVisitorId();
      const res = await fetch("/api/forms/whatsapp-chat/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          name: nameRef.current,
          phone: international,
          countryCode: country.code,
          pageRef: whatsappPageRef(location),
          entry,
          ...readUtmParams(),
          hp_extra: honeypotRef.current?.value || "",
          elapsedMs: Date.now() - openedAtRef.current,
          ...(visitorId ? { __visitorId: visitorId } : {}),
        }),
      });
      saved = res.ok;
    } catch {
      // Never hold the visitor back from WhatsApp over a failed save.
    }
    if (saved) {
      rememberWhatsAppChatLead();
      // form_completed is the lead conversion (Meta `Lead`); generate_lead is
      // its GA4/GTM twin, normally fired by the thank-you page this flow skips.
      trackEvent("form_completed", { location: entry, label: WHATSAPP_CHAT_FORM, form: WHATSAPP_CHAT_FORM });
      trackEvent("generate_lead", { location: window.location.pathname, label: WHATSAPP_CHAT_FORM });
    }
    push("them", copy.done(nameRef.current.split(/\s+/)[0]));
    setTyping(false);
    setStep("done");
    // Browsers that block a tab opened after an await (iOS Safari) return
    // null; the button under the last bubble is the way through there.
    const tab = window.open(whatsappLink, "_blank");
    if (tab) {
      tab.opener = null;
      trackHandoff();
    }
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;

    if (step === "name") {
      push("me", text);
      setDraft("");
      if (text.replace(/[\s\d.,;:!?@#$%&*()\-_+=/\'"]/g, "").length < 2) {
        say([copy.retryName]);
        return;
      }
      nameRef.current = text.slice(0, 100);
      trackEvent("form_step_completed", { location: entry, label: WHATSAPP_CHAT_FORM, step: 1 });
      say([copy.askPhone(text.split(/\s+/)[0])], () => setStep("phone"));
      return;
    }

    if (step === "phone") {
      push("me", `${country.dialCode} ${text}`);
      setDraft("");
      if (!isValidPhoneForCountry(text, country)) {
        say([copy.retryPhone]);
        return;
      }
      void submitPhone(getInternationalPhone(text, country));
    }
  };

  if (!open) return null;

  const isPhoneStep = step === "phone" || step === "saving";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={handleClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label={`WhatsApp ${companyName}`}
        className="fixed inset-x-0 bottom-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 md:inset-x-auto md:bottom-24 md:right-6 md:w-[360px]"
        style={keyboardInset ? { bottom: keyboardInset } : undefined}
        data-testid="whatsapp-chat"
      >
        <div
          className="flex h-[min(78dvh,520px)] flex-col overflow-hidden rounded-t-2xl bg-[#EFEAE2] shadow-2xl shadow-black/30 md:rounded-2xl"
          style={keyboardInset ? { height: `min(520px, calc(100dvh - ${keyboardInset}px - 12px))` } : undefined}
        >
          <header className="flex shrink-0 items-center gap-3 bg-[#008069] px-4 py-3 text-white">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#DFE5E7]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <SiWhatsapp className="h-5 w-5 text-[#008069]" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight">{companyName}</p>
              <p className="text-xs leading-tight text-white/80">{copy.status}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={copy.close}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3" aria-live="polite">
            <div className="flex justify-center pb-1">
              <span className="rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-[#54656F] shadow-sm">{copy.today}</span>
            </div>
            {messages.map((m) => (
              <div key={m.id} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.from === "me"
                      ? "max-w-[82%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-[#111B21] shadow-sm"
                      : "max-w-[82%] rounded-lg rounded-tl-none bg-white px-2.5 pb-1 pt-1.5 text-[14.5px] leading-snug text-[#111B21] shadow-sm"
                  }
                >
                  <span className="whitespace-pre-wrap break-words">{m.text}</span>
                  <span className="float-right ml-2 mt-1.5 flex items-center gap-0.5 text-[10.5px] leading-none text-[#667781]">
                    {m.time}
                    {m.from === "me" && <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" aria-hidden="true" />}
                  </span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3 shadow-sm" aria-hidden="true">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8696A0]" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {step === "done" && (
              <div className="flex justify-center pt-2">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackHandoff}
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1EBE5A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 focus-visible:ring-offset-2"
                  data-testid="whatsapp-chat-continue"
                >
                  <SiWhatsapp className="h-4 w-4" aria-hidden="true" />
                  {copy.open}
                </a>
              </div>
            )}
          </div>

          {step !== "done" && (
            <form onSubmit={handleSend} className="relative flex shrink-0 items-center gap-2 px-2 pb-2 pt-1">
              {/* Honeypot: must stay empty (server/lib/botTrap.ts). */}
              <input ref={honeypotRef} type="text" name="hp_extra" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute h-0 w-0 opacity-0" />
              {countryOpen && (
                <div role="listbox" aria-label={copy.country} className="absolute bottom-full left-2 mb-1 max-h-56 w-60 overflow-auto rounded-xl bg-white py-1 shadow-xl">
                  {PHONE_COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={c.code === country.code}
                      onClick={() => {
                        setCountry(c);
                        setDraft((cur) => formatPhoneForCountry(cur, c));
                        setCountryOpen(false);
                        inputRef.current?.focus();
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[#111B21] transition-colors hover:bg-[#F0F2F5]"
                    >
                      <img src={getPhoneCountryFlagUrl(c)} alt="" className="h-4 w-5 rounded-[2px] object-cover" />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-[#667781]">{c.dialCode}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex min-h-11 flex-1 items-center rounded-full bg-white pl-1 pr-4 shadow-sm">
                {isPhoneStep && (
                  <button
                    type="button"
                    aria-label={copy.country}
                    aria-haspopup="listbox"
                    aria-expanded={countryOpen}
                    onClick={() => setCountryOpen((cur) => !cur)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-2.5 pr-1.5 text-[15px] text-[#111B21] transition-colors hover:bg-[#F0F2F5]"
                  >
                    <img src={getPhoneCountryFlagUrl(country)} alt="" className="h-4 w-5 rounded-[2px] object-cover" />
                    {country.dialCode}
                    <ChevronDown className="h-3.5 w-3.5 text-[#667781]" aria-hidden="true" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(isPhoneStep ? formatPhoneForCountry(e.target.value, country) : e.target.value)}
                  type={isPhoneStep ? "tel" : "text"}
                  inputMode={isPhoneStep ? "tel" : "text"}
                  autoComplete={isPhoneStep ? "tel-national" : "name"}
                  maxLength={isPhoneStep ? 24 : 100}
                  disabled={step === "saving"}
                  placeholder={isPhoneStep ? country.placeholder : copy.namePlaceholder}
                  aria-label={isPhoneStep ? country.placeholder : copy.namePlaceholder}
                  className={`min-w-0 flex-1 bg-transparent py-2 text-base text-[#111B21] outline-none placeholder:text-[#8696A0] ${isPhoneStep ? "pl-1.5" : "pl-3.5"}`}
                  data-testid="whatsapp-chat-input"
                />
              </div>
              <button
                type="submit"
                aria-label={copy.send}
                disabled={!draft.trim() || typing}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white shadow-sm transition-colors hover:bg-[#008F72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A884]/50 focus-visible:ring-offset-2 disabled:opacity-60"
                data-testid="whatsapp-chat-send"
              >
                <SendHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
