import { useQuery } from "@tanstack/react-query";
import { Activity, BriefcaseBusiness, CircleAlert, MapPinned, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";

type FieldOverviewResponse = {
  reps: {
    id: number;
    displayName: string;
    role: string;
    team?: string | null;
    isActive: boolean;
  }[];
  metrics: {
    activeReps: number;
    accounts: number;
    visitsInProgress: number;
    completedVisits: number;
    openOpportunities: number;
    pipelineValue: number;
    pendingTasks: number;
    syncIssues: number;
  };
  latestSyncEvents: {
    id: number;
    entityType: string;
    entityId: string;
    status: string;
    lastError?: string | null;
    createdAt?: string | Date | null;
  }[];
};

const metricCards = [
  { key: "activeReps", label: "Active Reps", icon: Users },
  { key: "accounts", label: "Accounts", icon: BriefcaseBusiness },
  { key: "visitsInProgress", label: "Active Visits", icon: MapPinned },
  { key: "syncIssues", label: "Sync Issues", icon: CircleAlert },
] as const;

export function FieldSalesSection() {
  const { data, isLoading } = useQuery<FieldOverviewResponse>({
    queryKey: ["/api/field/admin/overview"],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Field Sales</h2>
          <p className="text-sm text-muted-foreground">
            Monitor rep activity, sync health, and live pipeline creation from the field app.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/field/admin/overview"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <a href="/field" target="_blank" rel="noreferrer">
              Open Field App
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="border-0 bg-muted">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">
                {isLoading ? "..." : data?.metrics[key] ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Rep Roster
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading reps...</div>
            ) : data?.reps?.length ? (
              data.reps.map((rep) => (
                <div key={rep.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                  <div>
                    <div className="font-medium">{rep.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {rep.role}{rep.team ? ` • ${rep.team}` : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${rep.isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-slate-500/15 text-slate-500"}`}>
                    {rep.isActive ? "Active" : "Paused"}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                No field reps yet. The first authenticated field user will be auto-provisioned.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Sync Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading sync events...</div>
            ) : data?.latestSyncEvents?.length ? (
              data.latestSyncEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{event.entityType} #{event.entityId}</div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${event.status === "synced" ? "bg-emerald-500/15 text-emerald-600" : event.status === "failed" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>
                      {event.status}
                    </span>
                  </div>
                  {event.lastError ? (
                    <div className="mt-1 text-xs text-muted-foreground">{event.lastError}</div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                No sync events yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
