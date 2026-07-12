import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock } from "lucide-react";
import { addHours, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";
import type { BlogSettings } from "#shared/schema.js";

interface BlogHealth {
  openrouterKeyConfigured: boolean;
  textModelConfigured: boolean;
  imageModelConfigured: boolean;
  configured: boolean;
}

function computeNextRun(settings: BlogSettings | undefined): Date | null {
  if (!settings?.lastRunAt || !settings.postsPerDay || settings.postsPerDay <= 0) return null;
  const intervalHours = 24 / settings.postsPerDay;
  return addHours(new Date(settings.lastRunAt), intervalHours);
}

// W-5: NO onOpenIntegrations prop. The remedy link is an unconditional
// anchor inside the banner (so the link works whether or not a parent passes
// a callback). D-11 mandates "Link to Integrations section as remedy".
export function AutomationStatusBanners() {
  const { t } = useTranslation();

  const { data: health } = useQuery<BlogHealth>({
    queryKey: ["/api/blog/health"],
    staleTime: 30_000,
  });
  const { data: settings } = useQuery<BlogSettings>({
    queryKey: ["/api/blog/settings"],
    staleTime: 30_000,
  });

  const showBanner = useMemo(() => {
    if (!health) return false;
    return !health.configured;
  }, [health]);

  const missingPieces = useMemo(() => {
    if (!health) return [];
    const pieces: string[] = [];
    if (!health.openrouterKeyConfigured) pieces.push(t("OpenRouter API key (Integrations)"));
    if (!health.textModelConfigured) pieces.push(t("text model (Automation settings)"));
    if (!health.imageModelConfigured) pieces.push(t("image model (Automation settings)"));
    return pieces;
  }, [health, t]);

  const nextRun = useMemo(() => computeNextRun(settings), [settings]);

  return (
    <div className="space-y-3">
      {showBanner && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4"
          data-testid="banner-blog-unavailable"
        >
          <AlertCircle className="w-5 h-5 mt-0.5 text-red-500 shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {t("Blog generator unavailable — missing configuration:")} {missingPieces.join(", ")}
            </p>
            {/* W-5: unconditional remedy link to Integrations admin section.
                Uses the project's existing `?section=` query-string nav
                convention (already in use by RssQueuePanel "View resulting post"). */}
            <a
              href="/admin?section=integrations"
              className="inline-flex items-center text-sm font-medium underline text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
              data-testid="link-open-integrations"
            >
              {t("Open Integrations")}
            </a>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs"
                data-testid="chip-next-run"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t("Next run")}:</span>
                <span className="font-medium">
                  {nextRun ? formatDistanceToNow(nextRun, { addSuffix: true }) : t("No upcoming run scheduled")}
                </span>
              </div>
            </TooltipTrigger>
            {nextRun && <TooltipContent>{nextRun.toLocaleString()}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
