import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "@/hooks/useTranslation";

type BookingSlot = {
  start: string;
  end: string;
  startLocal: string;
  endLocal: string;
};

type BookingContext = {
  event: {
    title: string;
    description: string | null;
    durationMinutes: number;
    timezone: string;
    availableDows: number[];
  };
  slots?: BookingSlot[];
};

type EmbeddedBookingProps = {
  formSlug: string;
  sessionId: string;
  onComplete: () => void;
  onSkip: () => void;
};

function dateId(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "Request failed");
  return body;
}

export function EmbeddedBooking({ formSlug, sessionId, onComplete, onSkip }: EmbeddedBookingProps) {
  const { t, language } = useTranslation();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const bookingUrl = `/api/forms/slug/${encodeURIComponent(formSlug)}/booking`;

  const contextQuery = useQuery<BookingContext>({
    queryKey: [bookingUrl, "context"],
    queryFn: async () => readJson(await fetch(bookingUrl)),
    staleTime: 60_000,
  });

  const availableDates = useMemo(() => {
    const allowed = new Set(contextQuery.data?.event.availableDows ?? []);
    const dates: Date[] = [];
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < 28 && dates.length < 10; offset += 1) {
      const candidate = new Date(cursor);
      candidate.setDate(cursor.getDate() + offset);
      if (allowed.has(candidate.getDay())) dates.push(candidate);
    }
    return dates;
  }, [contextQuery.data?.event.availableDows]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) setSelectedDate(dateId(availableDates[0]));
  }, [availableDates, selectedDate]);

  const slotsQuery = useQuery<BookingContext>({
    queryKey: [bookingUrl, "slots", selectedDate],
    queryFn: async () => readJson(await fetch(`${bookingUrl}?date=${encodeURIComponent(selectedDate)}`)),
    enabled: Boolean(selectedDate),
    staleTime: 15_000,
  });

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate]);

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlot) throw new Error(t("Choose a time first."));
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
      return readJson<{ id: string; status: string }>(await fetch(bookingUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, startAt: selectedSlot.start, timezone }),
      }));
    },
  });

  const locale = language === "pt" ? "pt-BR" : "en-US";

  if (bookingMutation.isSuccess) {
    return (
      <div className="flex flex-col items-center py-8 text-center" data-testid="booking-confirmed">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-9 w-9" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-slate-900">{t("Meeting confirmed")}</h2>
        <p className="mt-2 max-w-md text-slate-600">
          {t("Your meeting is on our calendar. We sent the confirmation and meeting link to your email.")}
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-7 inline-flex w-full items-center justify-center rounded-full bg-cta px-6 py-3 font-semibold text-white transition-colors hover:bg-cta-hover sm:w-auto"
        >
          {t("Done")}
        </button>
      </div>
    );
  }

  if (contextQuery.isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center" aria-label={t("Loading available times")}>
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  if (contextQuery.isError || !contextQuery.data) {
    return (
      <div className="py-10 text-center">
        <h2 className="text-xl font-bold text-slate-900">{t("We received your information")}</h2>
        <p className="mt-2 text-slate-600">{t("The calendar is unavailable right now, but our team will contact you.")}</p>
        <button type="button" onClick={onSkip} className="mt-6 rounded-full bg-cta px-6 py-3 font-semibold text-white">
          {t("Continue")}
        </button>
      </div>
    );
  }

  const event = contextQuery.data.event;
  const slots = slotsQuery.data?.slots ?? [];

  return (
    <div data-testid="embedded-booking">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-cta">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cta">{t("One last step")}</p>
          <h2 id="lead-form-question" className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("Choose the best time to talk")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {event.durationMinutes} {t("minutes")} · {event.timezone}
          </p>
        </div>
      </div>

      <div className="mt-7">
        <p className="mb-3 text-sm font-semibold text-slate-700">{t("Select a date")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {availableDates.map((date) => {
            const value = dateId(date);
            const selected = selectedDate === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedDate(value)}
                className={clsx(
                  "rounded-xl border px-3 py-3 text-center transition-colors",
                  selected ? "border-cta bg-cta text-white" : "border-slate-200 bg-white text-slate-700 hover:border-cta/60",
                )}
                aria-pressed={selected}
              >
                <span className="block text-xs font-semibold uppercase">
                  {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}
                </span>
                <span className="mt-1 block text-sm font-bold">
                  {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-slate-700">{t("Available times")}</p>
        {slotsQuery.isLoading ? (
          <div className="flex h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cta" /></div>
        ) : slotsQuery.isError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t("Could not load times. Choose another date or try again.")}</p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">{t("No times are available on this date. Choose another day.")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const selected = selectedSlot?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={clsx(
                    "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                    selected ? "border-cta bg-cta/10 text-cta" : "border-slate-200 text-slate-700 hover:border-cta/60",
                  )}
                  aria-pressed={selected}
                >
                  <Clock3 className="h-4 w-4" />
                  {slot.startLocal}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {bookingMutation.isError ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{bookingMutation.error.message}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="button"
          disabled={!selectedSlot || bookingMutation.isPending}
          onClick={() => bookingMutation.mutate()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cta px-6 py-3 font-semibold text-white transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("Confirm meeting")}
        </button>
        <button type="button" onClick={onSkip} className="px-5 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800">
          {t("I'll schedule later")}
        </button>
      </div>
    </div>
  );
}
