import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Inbox, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminCard } from "@/components/admin/shared/AdminCard";
import { EmptyState } from "@/components/admin/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

type Status = "pending" | "used" | "skipped";
const STATUSES: Status[] = ["pending", "used", "skipped"];
const PAGE_SIZE = 50;

interface RssItemWithSource {
  id: number;
  sourceId: number;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  status: Status;
  usedAt: string | null;
  usedPostId: number | null;
  skipReason: string | null;
  sourceName: string | null;
  score: number | null; // D-05: present (numeric) on pending rows; null on used/skipped
}

function statusLabelKey(status: Status): "Pending" | "Used" | "Skipped" {
  if (status === "pending") return "Pending";
  if (status === "used") return "Used";
  return "Skipped";
}

export function RssQueuePanel() {
  const { t } = useTranslation();
  const [activeStatus, setActiveStatus] = useState<Status>("pending");
  const [page, setPage] = useState(0);

  const { data: items, isLoading } = useQuery<RssItemWithSource[]>({
    queryKey: ["/api/blog/rss-items", activeStatus, page],
    queryFn: async () => {
      const offset = page * PAGE_SIZE;
      const res = await fetch(
        `/api/blog/rss-items?status=${activeStatus}&limit=${PAGE_SIZE}&offset=${offset}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const hasMore = (items?.length ?? 0) === PAGE_SIZE;

  return (
    <AdminCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t("RSS Queue")}</h3>
      </div>

      {/* Status sub-tabs */}
      <div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setActiveStatus(status);
              setPage(0);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-all flex-1 justify-center ${
              activeStatus === status
                ? "bg-white dark:bg-card border-border shadow-sm"
                : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50"
            }`}
            data-testid={`tab-queue-${status}`}
          >
            {t(statusLabelKey(status))}
          </button>
        ))}
      </div>

      {!isLoading && items && items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("No items in this bucket")} />
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3"
              data-testid={`row-rss-item-${item.id}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{item.sourceName ?? "—"}</Badge>
                  {/* D-05 (B-1): score badge rendered ONLY on pending rows */}
                  {item.status === "pending" && typeof item.score === "number" && (
                    <Badge
                      variant="outline"
                      className="font-mono"
                      data-testid={`badge-score-${item.id}`}
                      title="Relevance score (computed via scoreItem against current SEO keywords)"
                    >
                      {item.score.toFixed(2)}
                    </Badge>
                  )}
                  {item.publishedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.publishedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                >
                  {item.title}
                </a>
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                )}
                {item.status === "skipped" && item.skipReason && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {t("Skip reason")}: {item.skipReason}
                  </p>
                )}
              </div>
              {item.status === "used" && item.usedPostId && (
                <a
                  href={`/admin?section=blog&postId=${item.usedPostId}`}
                  className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t("View resulting post")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-3 h-3 mr-1" />
            {t("Previous")}
          </Button>
          <span>
            {t("Page")} {page + 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
          >
            {t("Next")}
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </AdminCard>
  );
}
