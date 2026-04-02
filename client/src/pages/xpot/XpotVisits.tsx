import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useVisits } from "./hooks/useVisits";
import { VisitRow } from "./components/VisitRow";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function XpotVisits() {
  const { visitsQuery } = useVisits();
  const [dayOffset, setDayOffset] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const selectedDate = new Date();
  selectedDate.setDate(today.getDate() + dayOffset);

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const picked = new Date(e.target.value + "T12:00:00");
    const todayMid = new Date(toLocalDateString(today) + "T12:00:00");
    const diff = Math.round((picked.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
    setDayOffset(Math.min(0, diff));
  }, []);

  const visitsForDay = (visitsQuery.data || []).filter((visit) => {
    if (!visit.checkedInAt) return false;
    return isSameDay(new Date(visit.checkedInAt), selectedDate);
  });

  const isToday = dayOffset === 0;

  return (
    <div className="space-y-4">
      {/* Day navigator */}
      <div
        className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          type="button"
          onClick={() => setDayOffset((d) => d - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/8 hover:text-white/80"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="relative flex flex-col items-center gap-0.5"
        >
          <span className="text-sm font-semibold text-white">{formatDayLabel(selectedDate)}</span>
          <span className="text-[11px] text-white/35">
            {visitsForDay.length} visit{visitsForDay.length !== 1 ? "s" : ""}
          </span>
          <input
            ref={dateInputRef}
            type="date"
            max={toLocalDateString(today)}
            value={toLocalDateString(selectedDate)}
            onChange={handleDateChange}
            className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
          />
        </button>

        <button
          type="button"
          onClick={() => setDayOffset((d) => Math.min(0, d + 1))}
          disabled={isToday}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/8 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Visit list */}
      {visitsForDay.length ? (
        <div className="space-y-2">
          {visitsForDay.map((visit) => <VisitRow key={visit.id} visit={visit} />)}
        </div>
      ) : (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl py-10 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(99,102,241,0.12)" }}>
            <CalendarDays className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-white/60">No visits {isToday ? "today" : `on ${formatDayLabel(selectedDate).toLowerCase()}`}</div>
            <div className="mt-0.5 text-xs text-white/30">{isToday ? "Go to Check-In to start a visit" : "Nothing recorded for this day"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
