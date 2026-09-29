import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BandTone = "dark" | "hero" | "cream" | "ice" | "white" | "cta";

const TONE_CLASSES: Record<BandTone, string> = {
  dark: "bg-navy-950 text-fog-200 py-20 sm:py-28",
  hero: "bg-navy-900 text-fog-200 border-b border-white/10",
  cream: "bg-paper text-ink-700 py-20 sm:py-28",
  ice: "bg-paper-ice text-ink-700 py-20 sm:py-28",
  white: "bg-white text-ink-700 py-20 sm:py-28",
  cta: "bg-navy-850 text-white border-t border-cta-soft/20 py-14 sm:py-16",
};

// Must not start with "bg-": tailwind-merge (cn) would treat it as a background color and strip the tone bg.
const PATTERN_CLASSES: Record<BandTone, string> = {
  dark: "pattern-grid-dark",
  hero: "pattern-grid-dark",
  cream: "pattern-grid-light",
  ice: "pattern-grid-light",
  white: "pattern-grid-light",
  cta: "pattern-grid-dark",
};

export interface BandProps {
  tone: BandTone;
  id?: string;
  className?: string;
  /** Extra classes for the inner container (e.g. `page-top` on a hero). */
  containerClassName?: string;
  children: ReactNode;
  /** Adds scroll margin so anchors clear the navbar and the sticky sub-nav. */
  subnav?: boolean;
  /** Adds the flat grid background matching the tone. */
  pattern?: boolean;
  /** Skip the 1240px editorial column; the caller supplies its own container. */
  bare?: boolean;
}

/**
 * Full-bleed section wrapper for editorial pages: tone background, standard
 * vertical rhythm and the 1240px container. One Band per page section.
 */
export function Band({ tone, id, className, containerClassName, children, subnav, pattern, bare }: BandProps) {
  return (
    <section
      id={id}
      className={cn(TONE_CLASSES[tone], pattern && PATTERN_CLASSES[tone], subnav && "scroll-mt-subnav", className)}
    >
      <div className={cn(!bare && "container-editorial", containerClassName)}>{children}</div>
    </section>
  );
}
