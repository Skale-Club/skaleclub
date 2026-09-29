import { lazy, Suspense, type ComponentProps } from "react";

const DottedSurface = lazy(() =>
  import("@/components/ui/dotted-surface").then((m) => ({ default: m.DottedSurface })),
);

/** three.js is heavy: skip it for reduced-motion users and low-memory devices. */
function shouldSkipSurface(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === "number" && memory < 4;
}

/** Code-split wrapper around DottedSurface so three.js stays out of the viewer chunk. */
export function LazyDottedSurface(props: ComponentProps<typeof DottedSurface>) {
  if (shouldSkipSurface()) return null;
  return (
    <Suspense fallback={null}>
      <DottedSurface {...props} />
    </Suspense>
  );
}
