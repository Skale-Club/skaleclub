export type VisitStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "invalid"
  | "no_answer"
  | "came_back_later"
  | "not_interested"
  | "follow_up"
  | "sale_made";

export const VISIT_STATUSES: { value: VisitStatus; label: string; color: string; bg: string; border: string }[] = [
  { value: "sale_made",       label: "Sale Made",        color: "text-emerald-300", bg: "bg-emerald-950/60",  border: "border-emerald-500/40" },
  { value: "completed",       label: "Completed",        color: "text-sky-300",     bg: "bg-sky-950/60",      border: "border-sky-500/40" },
  { value: "follow_up",       label: "Follow Up",        color: "text-violet-300",  bg: "bg-violet-950/60",   border: "border-violet-500/40" },
  { value: "came_back_later", label: "Come Back Later",  color: "text-amber-300",   bg: "bg-amber-950/60",    border: "border-amber-500/40" },
  { value: "no_answer",       label: "No Answer",        color: "text-orange-300",  bg: "bg-orange-950/60",   border: "border-orange-500/40" },
  { value: "not_interested",  label: "Not Interested",   color: "text-rose-300",    bg: "bg-rose-950/60",     border: "border-rose-500/40" },
  { value: "cancelled",       label: "Cancelled",        color: "text-slate-400",   bg: "bg-slate-800/60",    border: "border-slate-600/40" },
  { value: "in_progress",     label: "In Progress",      color: "text-blue-300",    bg: "bg-blue-950/60",     border: "border-blue-500/40" },
  { value: "planned",         label: "Planned",          color: "text-slate-300",   bg: "bg-slate-800/40",    border: "border-slate-600/30" },
  { value: "invalid",         label: "Invalid",          color: "text-red-400",     bg: "bg-red-950/40",      border: "border-red-700/30" },
];

export function getStatusMeta(status: string) {
  return VISIT_STATUSES.find((s) => s.value === status) ?? {
    value: status,
    label: status,
    color: "text-muted-foreground",
    bg: "bg-secondary/40",
    border: "border-border",
  };
}

export function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.color} ${meta.bg} ${meta.border}`}>
      {meta.label}
    </span>
  );
}

export function StatusPicker({ value, onChange }: { value: string; onChange: (v: VisitStatus) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50">Visit Outcome</div>
      <div className="flex flex-wrap gap-1.5">
        {VISIT_STATUSES.filter((s) => !["planned", "in_progress", "invalid"].includes(s.value)).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${s.color} ${s.bg} ${s.border} ${value === s.value ? "ring-2 ring-offset-1 ring-offset-background ring-current opacity-100" : "opacity-60 hover:opacity-90"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
