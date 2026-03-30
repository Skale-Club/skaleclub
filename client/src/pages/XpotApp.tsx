import { useEffect } from "react";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XpotAppProvider, useXpotApp } from "./xpot/XpotContext";
import { tabs } from "./xpot/utils";
import { XpotCheckIn } from "./xpot/XpotCheckIn";
import { XpotAccounts } from "./xpot/XpotAccounts";
import { XpotVisits } from "./xpot/XpotVisits";
import { XpotSales } from "./xpot/XpotSales";
import { XpotDashboard } from "./xpot/XpotDashboard";

function XpotAppShell() {
  const {
    me,
    repName,
    isOnline,
    activeTab,
    activeVisit,
    signOut,
    syncMutation,
    setLocation,
  } = useXpotApp();

  useEffect(() => {
    document.title = "Xpot";
  }, []);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06090f] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06090f] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-primary/75">{isOnline ? "Online" : "Offline"}</div>
            <div className="mt-1 text-lg font-semibold">{repName}</div>
            <div className="text-sm text-white/45">{me.rep.role}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => syncMutation.mutate(undefined as any)}>
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 to-cyan-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Live Status</div>
              <div className="mt-2 text-lg font-semibold">
                {activeVisit ? `Checked in at ${activeVisit.account?.name || `Account #${activeVisit.accountId}`}` : "Ready for next visit"}
              </div>
            </div>
            <Badge className={activeVisit ? "bg-primary text-black" : "bg-white/10 text-white"}>
              {activeVisit ? "Active" : "Idle"}
            </Badge>
          </div>
        </div>

        <main className="flex-1 space-y-4">
          {activeTab === "dashboard" ? <XpotDashboard /> : null}
          {activeTab === "accounts" ? <XpotAccounts /> : null}
          {activeTab === "check-in" ? <XpotCheckIn /> : null}
          {activeTab === "visits" ? <XpotVisits /> : null}
          {activeTab === "sales" ? <XpotSales /> : null}
        </main>

        <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0a0e15]/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLocation(`/xpot/${id}`)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-white/45 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{label}</span>
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
  return (
    <XpotAppProvider>
      <XpotAppShell />
    </XpotAppProvider>
  );
}
