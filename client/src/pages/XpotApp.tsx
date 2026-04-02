import { useEffect } from "react";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { useXpotQueries } from "./xpot/hooks/useXpotQueries";
import { useVisits } from "./xpot/hooks/useVisits";
import { GeoProvider } from "./xpot/hooks/GeoProvider";
import { tabs } from "./xpot/utils";
import { XpotCheckIn } from "./xpot/XpotCheckIn";
import { XpotLeads } from "./xpot/XpotLeads";
import { XpotVisits } from "./xpot/XpotVisits";
import { XpotSales } from "./xpot/XpotSales";
import { XpotDashboard } from "./xpot/XpotDashboard";

function XpotAppShell() {
  const {
    me,
    xpotMeQuery,
    repName,
    isOnline,
    activeTab,
    signOut,
    syncMutation,
    setLocation,
  } = useXpotQueries();
  const { activeVisit } = useVisits();

  useEffect(() => {
    document.title = "Xpot";
  }, []);

  if (!me) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0f1e] text-white">
        {xpotMeQuery.isError ? (
          <>
            <p className="text-sm text-white/50">Failed to load session</p>
            <button
              onClick={() => setLocation("/xpot/login")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              Go to Login
            </button>
          </>
        ) : (
          <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
        )}
      </div>
    );
  }

  const initials = repName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "linear-gradient(160deg, #060912 0%, #090f1c 50%, #060c14 100%)" }}
    >
      {/* subtle grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)", backgroundSize: "32px 32px" }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-5">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
              >
                {initials}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0f1e] ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">{repName}</div>
              <div className="text-[11px] text-white/40">{me.rep.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={!isOnline || syncMutation.isPending}
              onClick={() => syncMutation.mutate(undefined as any)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/8 hover:text-white/80 disabled:opacity-30"
            >
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/8 hover:text-white/80"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {!isOnline && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            You are offline. Check-in and sync are disabled.
          </div>
        )}

        <main className="flex-1 space-y-4">
          {activeTab === "dashboard" ? <XpotDashboard /> : null}
          {activeTab === "leads" ? <XpotLeads /> : null}
          {activeTab === "check-in" ? <XpotCheckIn /> : null}
          {activeTab === "visits" ? <XpotVisits /> : null}
          {activeTab === "sales" ? <XpotSales /> : null}
        </main>

        {/* Bottom nav — glass pill */}
        <nav className="fixed inset-x-0 bottom-0 px-4 pb-4 pt-2">
          <div
            className="mx-auto flex max-w-md items-center gap-1 rounded-2xl border border-white/10 px-2 py-1.5"
            style={{ background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(20px)" }}
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLocation(`/xpot/${id}`)}
                  className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-all ${
                    isActive ? "text-white" : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(99,102,241,0.25) 100%)" }}
                    />
                  )}
                  <Icon className={`relative h-[18px] w-[18px] transition-all ${isActive ? "drop-shadow-[0_0_6px_rgba(99,102,241,0.8)]" : ""}`} />
                  <span className="relative truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default function XpotApp() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <GeoProvider>
      <XpotAppShell />
    </GeoProvider>
  );
}
