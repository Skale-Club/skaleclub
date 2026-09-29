import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { isChunkLoadError } from "@/lib/chunkReload";

type State = { hasError: boolean; error: unknown };

/**
 * Isolates one landing section: if it throws, it renders nothing (the rest of
 * the page stays up) and the error is reported to Sentry. Chunk-load failures are
 * re-thrown so ChunkErrorBoundary can reload the page.
 */
export class SectionErrorBoundary extends Component<{ section: string; children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error)) return;
    Sentry.captureException(error, {
      tags: { landingSection: this.props.section },
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (isChunkLoadError(this.state.error)) throw this.state.error;
    // Loud in dev and in `?preview` (admin preview), silent for real visitors.
    const showError =
      import.meta.env.DEV || new URLSearchParams(window.location.search).has("preview");
    if (!showError) return null;
    const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
    return (
      <div role="alert" className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
        Section {this.props.section} crashed: {message}
      </div>
    );
  }
}
