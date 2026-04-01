import { useEffect } from "react";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useXpotQueries } from "./xpot/hooks/useXpotQueries";
import { useVisits } from "./xpot/hooks/useVisits";
import { GeoProvider } from "./xpot/hooks/GeoProvider";
import { tabs } from "./xpot/utils";
import { XpotCheckIn } from "./xpot/XpotCheckIn";
import { XpotLeads } from "./xpot/XpotLeads";
import { XpotVisits } from "./xpot/XpotVisits";
import { XpotSales } from "./xpot/XpotSales";
import { XpotDashboard } from "./xpot/XpotDashboard";
import type { EnrichedSalesVisit } from "./xpot/types";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">        
        {xpotMeQuery.isError ? (
          <>
            <p className="text-sm text-muted-foreground">Failed to load session</p>
            <Button variant="outline" onClick={() => setLocation("/xpot/login")}>
              Go to Login
            </Button>
          </>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-primary/75">{isOnline ? "Online" : "Offline"}</div>
            <div className="mt-1 text-lg font-semibold">{repName}</div>
            <div className="text-sm text-muted-foreground">{me.rep.role}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={!isOnline || syncMutation.isPending} onClick={() => syncMutation.mutate(undefined as any)}>
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {!isOnline && (
          <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            You are offline. Check-in, check-out, and sync are disabled until connection is restored.
          </div>
        )}


        <main className="flex-1 space-y-4">
          {activeTab === "dashboard" ? <XpotDashboard /> : null}
          {activeTab === "leads" ? <XpotLeads /> : null}
          {activeTab === "check-in" ? <XpotCheckIn /> : null}
          {activeTab === "visits" ? <XpotVisits /> : null}
          {activeTab === "sales" ? <XpotSales /> : null}
        </main>

        <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"> 
          <div className="mx-auto flex max-w-md items-center justify-between gap-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLocation(`/xpot/${id}`)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
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
    <GeoProvider>
      <XpotAppShell />
    </GeoProvider>
  );
}
