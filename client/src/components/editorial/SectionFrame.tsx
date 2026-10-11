import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SectionRole as SharedSectionRole } from "@shared/section-definitions";

export type SectionTone = "dark" | "hero" | "cream" | "ice" | "white" | "cta" | "steel" | "steel-2" | "steel-3";
export type SectionRole = SharedSectionRole;
export type HeroVariant = "homepage" | "split-landing" | "dark-product" | "editorial-header" | "portfolio" | "campaign-form" | "blog-post";

const ManagedSectionRoleContext = createContext<SectionRole | undefined>(undefined);

/**
 * Connects the shared registry metadata to the visual frame. Managed section
 * renderers provide this automatically; explicit `role` props remain useful
 * for intentional nested or non-managed compositions.
 */
export function SectionRoleProvider({ role, children }: { role: SectionRole; children?: ReactNode }) {
  return <ManagedSectionRoleContext.Provider value={role}>{children}</ManagedSectionRoleContext.Provider>;
}

const TONE_CLASSES: Record<SectionTone, string> = {
  dark: "bg-navy-950 text-fog-200",
  hero: "bg-navy-900 text-fog-200 border-b border-white/10",
  cream: "bg-paper text-ink-700",
  ice: "bg-paper-ice text-ink-700",
  white: "bg-white text-ink-700",
  cta: "bg-navy-850 text-white border-t border-cta-soft/20",
  steel: "bg-steel-700 text-fog-200",
  "steel-2": "bg-steel-600 text-fog-200",
  "steel-3": "bg-steel-500 text-fog-200",
};

// Must not start with "bg-": tailwind-merge would treat it as a background
// utility and remove the tone background.
const PATTERN_CLASSES: Record<SectionTone, string> = {
  dark: "pattern-grid-dark",
  hero: "pattern-grid-dark",
  cream: "pattern-grid-light",
  ice: "pattern-grid-light",
  white: "pattern-grid-light",
  cta: "pattern-grid-dark",
  steel: "pattern-grid-dark",
  "steel-2": "pattern-grid-dark",
  "steel-3": "pattern-grid-dark",
};

const OUTER_PADDING_UTILITY = /(?:^|\s)(?:(?:sm|md|tablet|lg|xl|2xl):)*(?:py|pt|pb)-[^\s]+/;

export interface SectionFrameProps {
  tone: SectionTone;
  role?: SectionRole;
  id?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  subnav?: boolean;
  pattern?: boolean;
  bare?: boolean;
  heroVariant?: HeroVariant;
}

/**
 * The public site's outer section contract. It owns vertical rhythm,
 * full-bleed tone, editorial container, borders, and anchor clearance.
 * Internal card/pill spacing belongs to descendants, never to this frame.
 */
export function SectionFrame({
  tone,
  role,
  id,
  className,
  containerClassName,
  children,
  subnav,
  pattern,
  bare,
  heroVariant,
}: SectionFrameProps) {
  const managedRole = useContext(ManagedSectionRoleContext);
  const resolvedRole = role ?? managedRole ?? (tone === "hero" ? "hero" : tone === "cta" ? "cta" : "editorial");

  if (import.meta.env.DEV && resolvedRole !== "hero" && resolvedRole !== "bridge" && OUTER_PADDING_UTILITY.test(className ?? "")) {
    console.warn(
      `[SectionFrame] ${id ? `#${id} ` : ""}uses a direct outer padding utility. ` +
      "Choose the correct role instead of overriding py/pt/pb.",
    );
  }
  if (import.meta.env.DEV && resolvedRole === "hero" && !heroVariant) {
    console.warn(`[SectionFrame] ${id ? `#${id} ` : ""}hero is missing a named heroVariant.`);
  }

  return (
    <section
      id={id}
      data-section-role={resolvedRole}
      data-hero-variant={resolvedRole === "hero" ? heroVariant : undefined}
      className={cn(
        TONE_CLASSES[tone],
        `section-frame--${resolvedRole}`,
        pattern && PATTERN_CLASSES[tone],
        subnav && "scroll-mt-subnav",
        className,
      )}
    >
      <div className={cn(!bare && "container-editorial", containerClassName)}>{children}</div>
    </section>
  );
}
