import { MapPinned, DollarSign, Target, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { VisitRow } from "./components/VisitRow";
import { formatCurrency } from "./utils";

export function XpotDashboard() {
  const { dashboardQuery } = useXpotQueries();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Visits Today", value: dashboardQuery.data?.metrics.visitsToday ?? 0, icon: MapPinned },
          { label: "Pipeline Value", value: formatCurrency(dashboardQuery.data?.metrics.pipelineValue ?? 0, "USD"), icon: DollarSign },
          { label: "Open Opportunities", value: dashboardQuery.data?.metrics.openOpportunities ?? 0, icon: Target },
          { label: "Pending Tasks", value: dashboardQuery.data?.metrics.pendingTasks ?? 0, icon: Clock3 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border bg-card shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
                <div className="mt-2 text-2xl font-semibold text-card-foreground">{value}</div>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-1">Recent Visits</div>
        {dashboardQuery.data?.recentVisits?.length
          ? dashboardQuery.data.recentVisits.map((visit) => <VisitRow key={visit.id} visit={visit} />)
          : <div className="text-sm text-muted-foreground px-1">No visits yet.</div>}
      </div>
    </>
  );
}
