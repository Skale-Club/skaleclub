import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <div className="space-y-3">
      {/* Day navigator */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDayOffset((d) => d - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="text-sm font-medium text-foreground hover:text-primary transition-colors relative"
        >
          {formatDayLabel(selectedDate)}
          <span className="ml-2 text-xs text-muted-foreground">({visitsForDay.length} visit{visitsForDay.length !== 1 ? "s" : ""})</span>
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
          disabled={dayOffset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Visit list */}
      {visitsForDay.length ? visitsForDay.map((visit) => (
        <VisitRow key={visit.id} visit={visit} />
      )) : (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground text-center">
            No visits on {formatDayLabel(selectedDate).toLowerCase()}.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
