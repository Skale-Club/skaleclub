import { usePageSeo } from "@/hooks/use-seo";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Radio, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/ui/loader";
import { PhoneCountrySelect } from "@/components/ui/PhoneCountrySelect";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/format";
import { useTranslation } from "@/hooks/useTranslation";
import {
  detectDefaultPhoneCountry,
  formatPhoneForCountry,
  getInternationalPhone,
  isValidPhoneForCountry,
  type PhoneCountry,
} from "@/lib/phoneCountries";

type HubLivePhase = "upcoming" | "live" | "ended";
type HubRegistrationState = "open" | "not_yet_open" | "closed" | "full";

type HubActiveLive = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  hostName: string;
  timezone: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  registrationOpensAt: string | Date | null;
  registrationClosesAt: string | Date | null;
  status: string;
  hasStream: boolean;
  hasReplay: boolean;
  phase: HubLivePhase;
  registrationState: HubRegistrationState;
};

type HubActiveResponse = {
  live: HubActiveLive | null;
  message?: string;
};

type HubRegisterResponse = {
  unlocked: true;
  liveId: number;
  participantId: number;
  registrationId: number;
  accessToken: string;
  phase: HubLivePhase;
  hasStream: boolean;
  hasReplay: boolean;
};

type HubAccessResponse = {
  granted: true;
  destinationUrl: string;
  eventType: "join" | "replay";
};

// What we remember per live so a refresh keeps the access button.
type HubUnlock = {
  liveId: number;
  participantId: number;
  accessToken: string;
};

class HubApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "HubApiError";
    this.status = status;
    this.code = code;
  }
}

async function hubPost<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw new HubApiError(0, "network_error");
  }

  let data: { code?: unknown } | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new HubApiError(response.status, typeof data?.code === "string" ? data.code : "unknown");
  }
  return data as T;
}

const unlockStorageKey = (liveId: number) => `skale-hub-unlock:${liveId}`;

function readStoredUnlock(liveId: number): HubUnlock | null {
  try {
    const raw = window.localStorage.getItem(unlockStorageKey(liveId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HubUnlock> | null;
    if (
      parsed &&
      parsed.liveId === liveId &&
      typeof parsed.participantId === "number" &&
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.length > 0
    ) {
      return { liveId, participantId: parsed.participantId, accessToken: parsed.accessToken };
    }
  } catch {
    // Storage unavailable or corrupt: behave as if nothing was stored.
  }
  return null;
}

function writeStoredUnlock(unlock: HubUnlock) {
  try {
    window.localStorage.setItem(unlockStorageKey(unlock.liveId), JSON.stringify(unlock));
  } catch {
    // Private mode / blocked storage: the unlock simply lives in memory.
  }
}

function clearStoredUnlock(liveId: number) {
  try {
    window.localStorage.removeItem(unlockStorageKey(liveId));
  } catch {
    // Ignore.
  }
}

function formatLiveTime(value: string | Date, timeZone: string, lang: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

// "in 3 days" / "em 3 dias": coarse countdown using the largest sensible unit.
function formatStartsIn(startsAt: string | Date, now: number, lang: string) {
  const diffMs = new Date(startsAt).getTime() - now;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { numeric: "always" });
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(diffMs / 86_400_000), "day");
}

export default function SkaleHub() {
  usePageSeo({ title: "Skale Hub" });
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());
  // In-memory copy of the unlock (covers browsers where localStorage is blocked);
  // `storageVersion` re-reads localStorage after we write or clear it.
  const [sessionUnlock, setSessionUnlock] = useState<HubUnlock | null>(null);
  const [storageVersion, setStorageVersion] = useState(0);
  const [isOpening, setIsOpening] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Honeypot for the registration card (see the hidden input below).
  const honeypotRef = useRef<HTMLInputElement>(null);

  const activeQuery = useQuery<HubActiveResponse>({
    queryKey: ["/api/skale-hub/active"],
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const live = activeQuery.data?.live ?? null;
  const liveId = live?.id ?? null;
  const livePhase = live?.phase ?? null;

  // Tick so the "starts in" note stays fresh while the page is open.
  useEffect(() => {
    if (livePhase !== "upcoming") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [livePhase]);

  const unlockData = useMemo<HubUnlock | null>(() => {
    if (liveId === null) return null;
    if (sessionUnlock && sessionUnlock.liveId === liveId) return sessionUnlock;
    return readStoredUnlock(liveId);
    // storageVersion is the invalidation signal for the localStorage read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId, sessionUnlock, storageVersion]);

  const forgetUnlock = (id: number) => {
    clearStoredUnlock(id);
    setSessionUnlock(null);
    setStorageVersion((value) => value + 1);
  };

  const getErrorMessage = (error: unknown) => {
    const code = error instanceof HubApiError ? error.code : "unknown";
    const status = error instanceof HubApiError ? error.status : 0;
    switch (code) {
      case "no_live":
        return t("There is no active live right now.");
      case "not_yet_open":
        return t("Registration for this live hasn't opened yet.");
      case "closed":
        return t("Registration for this live is closed.");
      case "full":
        return t("This live is full. Registration is no longer available.");
      case "invalid_token":
      case "registration_required":
        return t("Please register again to get access.");
      case "registration_not_allowed":
        return t("Your registration can't be used to access this live. Please contact us.");
      case "live_not_available":
        return t("This live isn't available right now.");
      case "destination_missing":
        return t("The access link will be released soon.");
      case "network_error":
        return t("We couldn't reach the server. Check your connection and try again.");
      default:
        if (status === 429) return t("Too many attempts. Please wait a moment and try again.");
        if (status === 400) return t("Please check your details and try again.");
        return t("Something went wrong on our side. Please try again in a moment.");
    }
  };

  const registerMutation = useMutation({
    mutationFn: () =>
      hubPost<HubRegisterResponse>("/api/skale-hub/register", {
        ...form,
        phone: getInternationalPhone(form.phone, selectedCountry),
        hp_extra: honeypotRef.current?.value || "",
      }),
    onSuccess: (data) => {
      const unlock: HubUnlock = {
        liveId: data.liveId,
        participantId: data.participantId,
        accessToken: data.accessToken,
      };
      writeStoredUnlock(unlock);
      setSessionUnlock(unlock);
      setStorageVersion((value) => value + 1);
      toast({
        title: t("Registration confirmed"),
        description: t("You can now access the live."),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("Unable to unlock access"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
      if (error instanceof HubApiError && ["not_yet_open", "closed", "full", "no_live"].includes(error.code)) {
        void activeQuery.refetch();
      }
    },
  });

  // Must stay synchronous up to window.open: popup blockers (iOS Safari in
  // particular) only allow it inside the click's user gesture, so the blank
  // window is opened first and navigated once the access API answers.
  const handleAccess = async () => {
    if (!unlockData || isOpening) return;
    const win = window.open("about:blank", "_blank");
    setIsOpening(true);

    try {
      const data = await hubPost<HubAccessResponse>(`/api/skale-hub/${unlockData.liveId}/access`, {
        participantId: unlockData.participantId,
        accessToken: unlockData.accessToken,
        metadata: { source: "public-page" },
      });

      if (win && !win.closed) {
        try {
          win.opener = null;
        } catch {
          // Ignore: navigating is what matters.
        }
        win.location.href = data.destinationUrl;
      } else {
        window.location.href = data.destinationUrl;
      }
    } catch (error) {
      try {
        win?.close();
      } catch {
        // Ignore.
      }
      if (error instanceof HubApiError && (error.code === "invalid_token" || error.code === "registration_required")) {
        forgetUnlock(unlockData.liveId);
      }
      toast({
        title: t("Unable to open the live"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsOpening(false);
    }
  };

  const liveMeta = useMemo(() => {
    if (!live) {
      return null;
    }

    return {
      date: formatDate(live.startsAt, language, live.timezone),
      time: formatLiveTime(live.startsAt, live.timezone, language),
    };
  }, [live, language]);

  const phoneHasValue = form.phone.trim().length > 0;
  const phoneIsValid = !phoneHasValue || isValidPhoneForCountry(form.phone, selectedCountry);
  const phoneError = phoneHasValue && !phoneIsValid
    ? t("Enter a valid {country} phone number ({digits} digits).")
        .replace("{country}", selectedCountry.name)
        .replace("{digits}", String(selectedCountry.maxDigits))
    : null;
  const canSubmit = form.name.trim().length > 0 && phoneIsValid && (phoneHasValue || form.email.trim().length > 0);

  // What the visitor sees below the live card.
  const isEnded = live?.phase === "ended";
  const endedWithoutReplay = !!live && isEnded && !live.hasReplay;
  const accessAvailable = !!live && (isEnded ? live.hasReplay : live.hasStream || live.hasReplay);
  const accessLabel = !live
    ? ""
    : isEnded
      ? t("Watch replay")
      : live.phase === "live"
        ? t("Join the live now")
        : t("Open live room");
  const startsInText = live?.phase === "upcoming" ? formatStartsIn(live.startsAt, now, language) : "";
  const registrationBlockedMessage = (() => {
    if (!live) return null;
    switch (live.registrationState) {
      case "not_yet_open": {
        if (!live.registrationOpensAt) return t("Registration for this live hasn't opened yet.");
        return t("Registration opens on {date} at {time}.")
          .replace("{date}", formatDate(live.registrationOpensAt, language, live.timezone))
          .replace("{time}", formatLiveTime(live.registrationOpensAt, live.timezone, language));
      }
      case "closed":
        return t("Registration for this live is closed.");
      case "full":
        return t("This live is full. Registration is no longer available.");
      default:
        return null;
    }
  })();

  return (
    <div className="bg-gradient-to-b from-[#f7f9fc] via-[#eef4ff] to-white">
      <section data-section-role="hero" data-hero-variant="campaign-form" className="relative overflow-hidden pb-20 page-top">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[420px]"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, color-mix(in srgb, var(--cta) 18%, transparent), transparent 58%), radial-gradient(circle at top right, rgba(28,30,36,0.08), transparent 42%)',
          }}
        />
        <div className="container-custom container-page relative">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cta/15 bg-white/80 px-4 py-2 text-sm font-semibold text-cta-hover shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Skale Hub by Skale Club
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Skale Hub
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                {t("Skale Hub is Skale Club's weekly session for business owners who want to learn how to acquire clients in the United States using Google Ads, Meta Ads, Google Local Services, Thumbtack, Yelp, CRM, automation, and artificial intelligence.")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">{t("Weekly live access")}</div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">{t("US client acquisition")}</div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">{t("Registration required")}</div>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-cta/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Radio className="h-5 w-5 text-cta" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t("Live every week")}</p>
                      <p className="text-xs text-slate-500">{t("Fresh tactical sessions")}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-cta/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Users className="h-5 w-5 text-cta" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t("Business focused")}</p>
                      <p className="text-xs text-slate-500">{t("Built for growth-minded owners")}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-cta/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <CheckCircle2 className="h-5 w-5 text-cta" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t("Fast unlock")}</p>
                      <p className="text-xs text-slate-500">{t("No account or password")}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border-slate-200/80 bg-white/90 shadow-xl shadow-cta/10">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">{t("This week's live")}</CardTitle>
                  <CardDescription>
                    {t("Access is released after a quick registration.")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeQuery.isLoading ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin text-cta" />
                    </div>
                  ) : activeQuery.isError ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="text-lg font-semibold text-slate-900">{t("We couldn't load this week's live.")}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {t("Something went wrong on our side. Please try again in a moment.")}
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        disabled={activeQuery.isFetching}
                        onClick={() => activeQuery.refetch()}
                        data-testid="button-skale-hub-retry"
                      >
                        {activeQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {t("Try again")}
                      </Button>
                    </div>
                  ) : !live ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="text-lg font-semibold text-slate-900">{t("The next live will be announced soon.")}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {t("We update Skale Hub every week with the next session on US client acquisition.")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-2xl bg-surface-dark p-6 text-white shadow-lg">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">{t("Skale Hub Weekly Live")}</p>
                        <h2 className="mt-3 text-2xl font-semibold leading-tight">{live.title}</h2>
                        <p className="mt-3 text-sm leading-6 text-white/72">
                          {live.description || t("A practical weekly session on attracting and converting clients in the United States.")}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/80">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                            <CalendarDays className="h-4 w-4" />
                            {liveMeta?.date}
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                            <Clock3 className="h-4 w-4" />
                            {liveMeta?.time}
                          </div>
                        </div>
                        <p className="mt-4 text-sm font-medium text-white/90" data-testid="text-skale-hub-phase">
                          {live.phase === "live"
                            ? t("Live now")
                            : live.phase === "ended"
                              ? (live.hasReplay ? t("Replay available") : t("This live has ended."))
                              : startsInText
                                ? t("Starts {time}").replace("{time}", startsInText)
                                : t("Starting soon")}
                        </p>
                      </div>

                      {endedWithoutReplay ? (
                        <div
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"
                          data-testid="text-skale-hub-ended-no-replay"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {t("This live has ended. The replay will be available soon.")}
                          </p>
                        </div>
                      ) : unlockData ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            <div className="space-y-3">
                              <div>
                                <p className="font-semibold">{t("Registration confirmed. You can now access the live.")}</p>
                                <p className="mt-1 text-emerald-800/80">
                                  {t("Your participation has been recorded and the access button is now available.")}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                                disabled={isOpening || !accessAvailable}
                                onClick={handleAccess}
                                data-testid="button-skale-hub-access"
                              >
                                {isOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                                {isOpening ? t("Opening...") : accessLabel}
                              </Button>
                              {!accessAvailable ? (
                                <p className="text-xs text-emerald-800/80" data-testid="text-skale-hub-link-soon">
                                  {t("The access link will be released soon.")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : registrationBlockedMessage ? (
                        <div
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"
                          data-testid="text-skale-hub-registration-blocked"
                        >
                          <p className="text-sm font-semibold text-slate-900">{registrationBlockedMessage}</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <p className="text-sm font-semibold text-slate-900">
                            {isEnded ? t("Unlock the replay") : t("Unlock the live link")}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {t("Fill in your details and we'll release the access button right away.")}
                          </p>

                          <div className="mt-4 space-y-3">
                            <Input
                              aria-label={t("Your name")}
                              placeholder={t("Your name")}
                              value={form.name}
                              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                              data-testid="input-skale-hub-name"
                            />
                            <div>
                              <div className={`flex rounded-md border bg-white ${phoneError ? "border-red-300" : "border-input"}`}>
                                <PhoneCountrySelect
                                  ariaLabel={t("Phone country")}
                                  value={selectedCountry}
                                  onChange={(nextCountry) => {
                                    setSelectedCountry(nextCountry);
                                    setForm((current) => ({
                                      ...current,
                                      phone: formatPhoneForCountry(current.phone, nextCountry),
                                    }));
                                  }}
                                  buttonClassName="rounded-l-md"
                                />
                                <Input
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  aria-label={t("Phone number")}
                                  placeholder={selectedCountry.placeholder}
                                  value={form.phone}
                                  onChange={(event) => setForm((current) => ({
                                    ...current,
                                    phone: formatPhoneForCountry(event.target.value, selectedCountry),
                                  }))}
                                  className="border-0 bg-white focus-visible:ring-0"
                                  data-testid="input-skale-hub-phone"
                                />
                              </div>
                              {phoneError ? (
                                <p className="mt-1 text-xs font-medium text-red-600" data-testid="text-skale-hub-phone-error">{phoneError}</p>
                              ) : null}
                            </div>
                            <Input
                              type="email"
                              aria-label={t("Email")}
                              placeholder={t("Email")}
                              value={form.email}
                              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                              data-testid="input-skale-hub-email"
                            />
                            {/* Honeypot: invisible to people, filled by naive bots. Last child so
                                it cannot shift the space-y spacing of the real fields. */}
                            <input
                              ref={honeypotRef}
                              type="text"
                              name="hp_extra"
                              tabIndex={-1}
                              autoComplete="new-password"
                              aria-hidden="true"
                              defaultValue=""
                              style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
                            />
                          </div>

                          <Button
                            variant="cta"
                            size="pill"
                            className="mt-5 w-full"
                            disabled={!canSubmit || registerMutation.isPending}
                            onClick={() => registerMutation.mutate()}
                            data-testid="button-skale-hub-register"
                          >
                            {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {registerMutation.isPending
                              ? t("Unlocking access...")
                              : isEnded
                                ? t("Unlock replay access")
                                : t("Unlock live access")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
