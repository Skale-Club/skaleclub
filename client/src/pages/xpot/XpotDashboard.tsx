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
          <Card key={label} className="border-white/10 bg-white/5 text-white">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Recent Visits</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {dashboardQuery.data?.recentVisits?.length ? dashboardQuery.data.recentVisits.map((visit) => (
            <div key={visit.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{visit.lead?.name || `Lead #${visit.leadId}`}</div>
                <Badge variant="secondary" className="bg-white/10 text-white">{visit.status}</Badge>
              </div>
              <div className="mt-1 text-sm text-white/55">{formatDateTime(visit.checkedInAt)}</div>
            </div>
          )) : <div className="text-sm text-white/50">No visits yet.</div>}
        </CardContent>
      </Card>
    </>
  );
}
