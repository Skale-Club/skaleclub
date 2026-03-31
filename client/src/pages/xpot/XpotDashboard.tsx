import { MapPinned, DollarSign, Target, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { formatCurrency, formatDateTime } from "./utils";

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

      <Card className="border-border bg-card shadow-sm">
        <CardHeader><CardTitle className="text-base text-card-foreground">Recent Visits</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {dashboardQuery.data?.recentVisits?.length ? dashboardQuery.data.recentVisits.map((visit) => (
            <div key={visit.id} className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-foreground">{visit.lead?.name || `Lead #${visit.leadId}`}</div>
                <Badge variant="secondary">{visit.status}</Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(visit.checkedInAt)}</div>
            </div>
          )) : <div className="text-sm text-muted-foreground">No visits yet.</div>}
        </CardContent>
      </Card>
    </>
  );
}
