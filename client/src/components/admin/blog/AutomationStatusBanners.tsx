import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, DollarSign } from "lucide-react";
import { addHours, formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";
import type { BlogSettings } from "#shared/schema.js";

// Phase 37 D-16: hardcoded cost pricing — UI-side approximation, NOT billing-grade.
// Source: ai.google.dev/pricing (verified 2026-05-05)
export const BLOG_COST_PRICING = {
  contentTokensPerPost: 3000,
  contentPricePer1M: 0.075,    // gemini-2.5-flash, USD per 1M tokens
  imagePricePerImage: 0.039,   // gemini-2.0-flash-exp image, USD per image
} as const;

interface BlogHealth {
  apiKeyConfigured: boolean;
  integrationEnabled: boolean;
}

function computeMonthlyCost(postsPerDay: number): number {
  const contentCost = (BLOG_COST_PRICING.contentTokensPerPost / 1_000_000)
    * BLOG_COST_PRICING.contentPricePer1M
    * postsPerDay
    * 30;
  const imageCost = BLOG_COST_PRICING.imagePricePerImage * postsPerDay * 30;
  return Math.round((contentCost + imageCost) * 100) / 100;
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
    return !health.apiKeyConfigured || !health.integrationEnabled;
  }, [health]);

  const nextRun = useMemo(() => computeNextRun(settings), [settings]);
  const monthlyCost = useMemo(() => {
    if (!settings?.postsPerDay) return null;
    return computeMonthlyCost(settings.postsPerDay);
  }, [settings]);

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
              {t("Blog generator unavailable: configure Gemini integration to enable RSS-driven generation.")}
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

          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs"
                data-testid="chip-cost"
              >
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t("Estimated cost")}:</span>
                <span className="font-medium">
                  {monthlyCost !== null ? `~$${monthlyCost.toFixed(2)} ${t("per month")}` : "—"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("approximate, based on Gemini list pricing")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
