import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarClock, CircleAlert, Clock, MapPinned, RefreshCw, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getXpotAppUrl } from "@/lib/xpot";
import { queryClient } from "@/lib/queryClient";
import { SectionHeader } from "./shared";

type XpotOverviewResponse = {
  reps: {
    id: number;
    displayName: string;
    role: string;
    team?: string | null;
    isActive: boolean;
  }[];
  metrics: {
    activeReps: number;
    leads: number;
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

type RecentVisitsResponse = {
  data: {
    visit: {
      id: number;
      status: string;
      checkedInAt?: string | Date | null;
      checkedOutAt?: string | Date | null;
      scheduledAt?: string | Date | null;
      createdAt?: string | Date | null;
      durationSeconds?: number | null;
      validationStatus?: string | null;
    };
    rep?: {
      id: number;
      displayName: string;
      team?: string | null;
    } | null;
    lead?: {
      id: number;
      name: string;
      industry?: string | null;
    } | null;
    location?: {
      id: number;
      label: string;
      addressLine1: string;
      city?: string | null;
      state?: string | null;
    } | null;
    note?: {
      summary?: string | null;
      outcome?: string | null;
      nextStep?: string | null;
      sentiment?: string | null;
    } | null;
    syncStatus?: string | null;
    syncLastError?: string | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
};

const metricCards = [
  { key: "activeReps", label: "Active Reps", icon: Users },
  { key: "leads", label: "Leads", icon: BriefcaseBusiness },
  { key: "visitsInProgress", label: "Active Visits", icon: MapPinned },
  { key: "syncIssues", label: "Sync Issues", icon: CircleAlert },
] as const;

const VISITS_PAGE_SIZE = 5;

function formatVisitDate(value?: string | Date | null) {
  if (!value) return "No time recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getVisitStatusClass(status: string) {
  if (status === "completed" || status === "sale_made") return "bg-emerald-500/15 text-emerald-600";
  if (status === "in_progress") return "bg-blue-500/15 text-blue-600";
  if (status === "not_interested" || status === "cancelled" || status === "invalid") return "bg-red-500/15 text-red-600";
  return "bg-amber-500/15 text-amber-600";
}

function getSyncStatusClass(status?: string | null) {
  if (status === "synced") return "bg-emerald-500/15 text-emerald-600";
  if (status === "failed") return "bg-red-500/15 text-red-600";
  if (status === "needs_review") return "bg-amber-500/15 text-amber-600";
  return "bg-muted text-muted-foreground";
}

export function XpotSalesSection() {
  const [visitsPage, setVisitsPage] = useState(1);
  const [selectedRepId, setSelectedRepId] = useState("all");
  const { data, isLoading } = useQuery<XpotOverviewResponse>({
    queryKey: ["/api/xpot/admin/overview"],
  });
  const visitsQueryUrl = selectedRepId === "all"
    ? `/api/xpot/admin/recent-visits?page=${visitsPage}&pageSize=${VISITS_PAGE_SIZE}`
    : `/api/xpot/admin/recent-visits?page=${visitsPage}&pageSize=${VISITS_PAGE_SIZE}&repId=${selectedRepId}`;
  const { data: recentVisits, isLoading: isVisitsLoading } = useQuery<RecentVisitsResponse>({
    queryKey: [visitsQueryUrl],
  });

  const totalVisitPages = Math.max(1, Math.ceil((recentVisits?.total ?? 0) / VISITS_PAGE_SIZE));
  const visitStart = recentVisits?.total ? (visitsPage - 1) * VISITS_PAGE_SIZE + 1 : 0;
  const visitEnd = recentVisits?.total ? Math.min(visitsPage * VISITS_PAGE_SIZE, recentVisits.total) : 0;
  const visibleVisitPages = Array.from({ length: totalVisitPages }, (_, index) => index + 1)
    .filter((page) => totalVisitPages <= 5 || page === 1 || page === totalVisitPages || Math.abs(page - visitsPage) <= 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Xpot"
        description="Monitor rep activity, sync health, and live pipeline creation from the Xpot app."
        icon={<MapPinned className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/xpot/admin/overview"] });
                queryClient.invalidateQueries({ queryKey: [visitsQueryUrl] });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" asChild>
              <a href={getXpotAppUrl("/")} target="_blank" rel="noreferrer">
                Open Xpot
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ key, label, icon: Icon }) => (
          <Card key={key} className="rounded-2xl shadow-none">
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
        <Card className="rounded-2xl shadow-none">
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
                No xpot reps yet. The first authenticated xpot user will be auto-provisioned.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-none">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Recent Visits
              </CardTitle>
              <Select
                value={selectedRepId}
                onValueChange={(value) => {
                  setSelectedRepId(value);
                  setVisitsPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reps</SelectItem>
                  {data?.reps?.map((rep) => (
                    <SelectItem key={rep.id} value={String(rep.id)}>
                      {rep.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isVisitsLoading ? (
              <div className="text-sm text-muted-foreground">Loading visits...</div>
            ) : recentVisits?.data?.length ? (
              <>
                <div className="space-y-3">
                  {recentVisits.data.map((item) => {
                    const primaryTime = item.visit.checkedOutAt || item.visit.checkedInAt || item.visit.scheduledAt || item.visit.createdAt;
                    const duration = formatDuration(item.visit.durationSeconds);
                    return (
                      <div key={item.visit.id} className="rounded-lg border border-border/50 bg-background/60 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.lead?.name ?? `Visit #${item.visit.id}`}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3.5 w-3.5" />
                                {item.rep?.displayName ?? "Unassigned rep"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatVisitDate(primaryTime)}
                              </span>
                              {duration ? <span>{duration}</span> : null}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium capitalize ${getVisitStatusClass(item.visit.status)}`}>
                            {formatStatus(item.visit.status)}
                          </span>
                        </div>

                        {item.location ? (
                          <div className="mt-2 truncate text-xs text-muted-foreground">
                            {item.location.addressLine1}
                            {item.location.city ? `, ${item.location.city}` : ""}
                            {item.location.state ? `, ${item.location.state}` : ""}
                          </div>
                        ) : null}

                        {item.note?.summary || item.note?.outcome || item.note?.nextStep ? (
                          <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {item.note.summary || item.note.outcome || item.note.nextStep}
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">Visit #{item.visit.id}</span>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${getSyncStatusClass(item.syncStatus)}`}>
                            {item.syncStatus ?? "not synced"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Showing {visitStart}-{visitEnd} of {recentVisits.total}
                  </div>
                  {totalVisitPages > 1 ? (
                    <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setVisitsPage((page) => Math.max(1, page - 1))}
                            className={visitsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {visibleVisitPages.map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              isActive={visitsPage === page}
                              onClick={() => setVisitsPage(page)}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setVisitsPage((page) => Math.min(totalVisitPages, page + 1))}
                            className={visitsPage === totalVisitPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                No visits yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
