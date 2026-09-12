import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { DotsLoader, PageLoader } from "@/components/ui/spinner";
import { useTranslation } from "@/hooks/useTranslation";
import { isChunkLoadError, requestChunkReload, type ChunkReloadStatus } from "@/lib/chunkReload";

type State = { hasError: boolean; error: unknown; reload: ChunkReloadStatus | null };

/**
 * Replaces the Suspense loader that would otherwise spin forever when a route
 * chunk fails to load: reloads while the attempt budget lasts, then offers a
 * button. Any other render error is re-thrown so it behaves exactly as before.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null, reload: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (!isChunkLoadError(error)) return;
    // Caught errors never reach Sentry's global handler — report it here.
    Sentry.captureException(error, {
      level: "warning",
      tags: { chunkLoad: true },
      extra: { componentStack: info.componentStack },
    });
    this.setState({ reload: requestChunkReload() });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (!isChunkLoadError(this.state.error)) throw this.state.error;
    return <ChunkErrorFallback reload={this.state.reload} />;
  }
}

function ChunkErrorFallback({ reload }: { reload: ChunkReloadStatus | null }) {
  const { t } = useTranslation();
  // An immediate reload is already on its way — keep showing a loader, not an error.
  const imminent = reload === null || (reload.kind === "scheduled" && reload.delayMs === 0);

  useEffect(() => {
    // index.html's pre-React loader sits above everything at z-index 9999.
    if (!imminent) document.getElementById("initial-loader")?.remove();
  }, [imminent]);

  if (imminent) return <PageLoader />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1014] px-6 text-center text-white">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <h1 className="text-xl font-semibold">{t("This page failed to load")}</h1>
        <p className="text-sm text-white/70">
          {t("Part of the site failed to load, usually because a new version was just published.")}
        </p>
        {reload?.kind === "scheduled" && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <DotsLoader size="xs" tone="muted" />
            {t("Trying again automatically in a moment.")}
          </div>
        )}
        <Button className="bg-[#406EF1] text-white" onClick={() => window.location.reload()}>
          {t("Reload page")}
        </Button>
      </div>
    </div>
  );
}
