import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { History, RotateCw, X, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminCard } from "@/components/admin/shared/AdminCard";
import { EmptyState } from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import type { BlogSettings } from "#shared/schema.js";

interface BlogGenerationJobWithRssItem {
  id: number;
  status: string;
  reason: string | null;
  postId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  rssItemTitle: string | null;
  rssItemId: number | null;
}

const STATUS_TO_BADGE_VARIANT: Record<
  string,
  "default" | "destructive" | "secondary"
> = {
  completed: "default",
  failed: "destructive",
  skipped: "secondary",
  running: "secondary",
  pending: "secondary",
};

const STALE_LOCK_MS = 10 * 60 * 1000;

const QUERY_KEY = ["/api/blog/jobs", 50] as const;

export function JobHistoryPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: jobs, isLoading, refetch } = useQuery<BlogGenerationJobWithRssItem[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/blog/jobs?limit=50", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    // D-18: poll every 5s ONLY while the latest job is still running.
    refetchInterval: (query) => {
      const data = query.state.data as
        | BlogGenerationJobWithRssItem[]
        | undefined;
      return data && data[0]?.status === "running" ? 5000 : false;
    },
    staleTime: 30_000,
  });

  // B-2: read settings to access lockAcquiredAt — the SAME field the server
  // cancel handler checks. Using job.startedAt would diverge from the server
  // gate and let the UI show a "Cancel" button that the server then rejects.
  const { data: settings } = useQuery<BlogSettings>({
    queryKey: ["/api/blog/settings"],
    staleTime: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/blog/jobs/${id}/retry`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: t("Job retried — new run started") });
    },
    onError: (err: Error) => {
      const msg = err?.message ?? t("Source item no longer available");
      toast({
        title: t("Error"),
        description: msg,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/blog/jobs/${id}/cancel`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: t("Job cancelled") });
    },
    onError: (err: Error) => {
      toast({
        title: t("Lock not stale yet"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const now = useMemo(() => Date.now(), [jobs]);

  // B-2: gate the cancel button on settings.lockAcquiredAt — exactly the field
  // the server cancel handler reads for its 10-min staleness check. Using
  // job.startedAt instead would let the UI offer Cancel for jobs whose lock
  // is fresh, leading to 409s. Both must read the same source of truth.
  function isStaleRunning(
    job: BlogGenerationJobWithRssItem,
    currentSettings: BlogSettings | undefined,
  ): boolean {
    if (job.status !== "running") return false;
    if (!currentSettings?.lockAcquiredAt) return false;
    const ageMs = now - new Date(currentSettings.lockAcquiredAt).getTime();
    return ageMs > STALE_LOCK_MS;
  }

  return (
    <AdminCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          {t("Job History")}
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          data-testid="button-refresh-jobs"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("Refresh")}
        </Button>
      </div>

      {!isLoading && jobs && jobs.length === 0 ? (
        <EmptyState icon={<History />} title={t("No jobs yet")} />
      ) : (
        <div className="space-y-2">
          {(jobs ?? []).map((job) => (
            <div
              key={job.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
              data-testid={`row-job-${job.id}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={STATUS_TO_BADGE_VARIANT[job.status] ?? "secondary"}
                  >
                    {job.status}
                  </Badge>
                  {job.reason && (
                    <span className="text-xs text-muted-foreground">
                      {job.reason}
                    </span>
                  )}
                  {job.startedAt && (
                    <span className="text-xs text-muted-foreground">
                      {t("Started")}:{" "}
                      {formatDistanceToNow(new Date(job.startedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                  {job.completedAt && (
                    <span className="text-xs text-muted-foreground">
                      {t("Completed")}:{" "}
                      {formatDistanceToNow(new Date(job.completedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                {job.rssItemTitle && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      {t("Source item")}:{" "}
                    </span>
                    {job.rssItemTitle}
                  </div>
                )}
                {job.error && (
                  <div className="text-xs text-red-500 line-clamp-2">
                    {job.error}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex flex-col gap-1">
                {job.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryMutation.mutate(job.id)}
                    disabled={retryMutation.isPending}
                    data-testid={`button-retry-job-${job.id}`}
                  >
                    <RotateCw className="w-3 h-3 mr-1" />
                    {t("Retry")}
                  </Button>
                )}
                {isStaleRunning(job, settings) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelMutation.mutate(job.id)}
                    disabled={cancelMutation.isPending}
                    data-testid={`button-cancel-job-${job.id}`}
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t("Cancel job")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
