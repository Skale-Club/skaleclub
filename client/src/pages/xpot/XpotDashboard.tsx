import { useState } from "react";
import { MapPinned, DollarSign, Target, Clock3, Footprints, Pencil, LogOut } from "lucide-react";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { VisitRow } from "./components/VisitRow";
import { formatCurrency } from "./utils";
import { XpotProfileEditor } from "./XpotProfileEditor";

const METRIC_CARDS = [
  {
    label: "Visits Today",
    key: "visitsToday" as const,
    icon: MapPinned,
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
    glow: "rgba(99,102,241,0.35)",
  },
  {
    label: "Pipeline Value",
    key: "pipelineValue" as const,
    icon: DollarSign,
    gradient: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
    glow: "rgba(16,185,129,0.35)",
  },
  {
    label: "Opportunities",
    key: "openOpportunities" as const,
    icon: Target,
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
    glow: "rgba(139,92,246,0.35)",
  },
  {
    label: "Pending Tasks",
    key: "pendingTasks" as const,
    icon: Clock3,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    glow: "rgba(245,158,11,0.35)",
  },
] as const;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function XpotDashboard() {
  const { dashboardQuery, repName, me, signOut, isOnline } = useXpotQueries();
  const metrics = dashboardQuery.data?.metrics;
  const firstName = repName?.split(" ")[0] ?? "";
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = repName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const avatarUrl = me?.rep.avatarUrl;

  function metricValue(key: typeof METRIC_CARDS[number]["key"]) {
    if (!metrics) return "—";
    if (key === "pipelineValue") return formatCurrency(metrics.pipelineValue ?? 0, "USD");
    return metrics[key] ?? 0;
  }

  return (
    <div className="space-y-6">
      {/* Hero: avatar + greeting + logout */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-4">
          {/* Avatar Button */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="relative shrink-0 transition-transform active:scale-95 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={repName}
                style={{ boxShadow: "0 8px 24px rgba(59,130,246,0.25)" }}
                className="h-[62px] w-[62px] rounded-[22px] object-cover border border-white/10"
              />
            ) : (
              <div
                className="flex h-[62px] w-[62px] items-center justify-center rounded-[22px] text-[22px] font-bold tracking-wide text-white"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 8px 24px rgba(59,130,246,0.25)" }}
              >
                {initials}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-[3px] border-[#080d1a] ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
          </button>

          {/* Greeting block */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400/80 mb-1">{getGreeting()}</div>
            <div className="text-[26px] font-extrabold text-white tracking-tight leading-none mb-1.5">{firstName} 👋</div>
            <div className="text-xs font-medium text-white/40">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={signOut}
          className="flex h-12 w-12 mt-1 shrink-0 items-center justify-center rounded-[20px] bg-white/[0.03] text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400 active:bg-white/10 active:scale-95 touch-manipulation"
          style={{ border: "1px solid rgba(255,255,255,0.05)", WebkitTapHighlightColor: "transparent" }}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3">
        {METRIC_CARDS.map(({ label, key, icon: Icon, gradient, glow }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3)`,
            }}
          >
            <div
              className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40 blur-2xl"
              style={{ background: glow }}
            />
            <div className="relative">
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: gradient, boxShadow: `0 4px 12px ${glow}` }}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-white tabular-nums">{metricValue(key)}</div>
              <div className="mt-0.5 text-[11px] font-medium text-white/40">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent visits */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/30">Recent Visits</div>
        </div>
        {dashboardQuery.data?.recentVisits?.length
          ? dashboardQuery.data.recentVisits.map((visit) => <VisitRow key={visit.id} visit={visit} />)
          : (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl py-10 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(99,102,241,0.15)" }}
              >
                <Footprints className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/60">No visits today</div>
                <div className="mt-0.5 text-xs text-white/30">Go to Check-In to start your day</div>
              </div>
            </div>
          )}
      </div>

      {/* Profile editor */}
      {profileOpen && me && (
        <XpotProfileEditor me={me} onClose={() => setProfileOpen(false)} />
      )}
    </div>
  );
}
