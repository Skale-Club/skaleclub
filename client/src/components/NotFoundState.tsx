import type { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface NotFoundStateProps {
  /** Large label above the title, e.g. "404". Optional. */
  code?: string;
  title: string;
  description?: string;
  /** Primary action. Defaults to a link back to the homepage when `actionLabel` is set. */
  actionLabel?: string;
  actionHref?: string;
  /** Optional brand mark rendered above the title (e.g. company logo). */
  logoUrl?: string | null;
  logoAlt?: string;
  /** `screen` fills the viewport (standalone routes); `section` sits inside a page layout. */
  layout?: "screen" | "section";
  /** True when this always renders under the fixed public navbar (never on a
   * navbar-less standalone route) — adds clearance so the content isn't
   * hidden behind it. */
  underNav?: boolean;
  children?: ReactNode;
}

/**
 * Single "not found / unavailable" screen shared by the public site so the
 * 404, missing blog posts, forms, vCards and estimates all read as one
 * product. No provider dependencies: safe on standalone routes.
 */
export function NotFoundState({
  code,
  title,
  description,
  actionLabel,
  actionHref = "/",
  logoUrl,
  logoAlt = "",
  layout = "section",
  underNav = false,
  children,
}: NotFoundStateProps) {
  const heightClass = layout === "screen" ? "min-h-[100dvh]" : "min-h-[60vh]";
  // `py-16` would be overridden by a `pt-*` utility applied alongside it (same
  // Tailwind utilities layer, last one in source wins) — so when clearing the
  // navbar, replace it outright instead of adding a second top-padding class.
  const verticalPadding = underNav ? "pb-16 pt-[calc(var(--nav-offset)+4rem)]" : "py-16";

  return (
    <div
      className={`${heightClass} w-full flex items-center justify-center bg-background text-foreground px-4 ${verticalPadding} relative overflow-hidden`}
      data-testid="not-found-state"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-full h-[520px] bg-cta/10 rounded-full blur-[100px] pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={logoAlt} width={56} height={56} className="h-14 w-14 object-contain mb-2" />
        ) : null}
        {code ? (
          <span className="font-display text-7xl font-bold tracking-tighter text-cta/80 leading-none">{code}</span>
        ) : null}
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-base text-muted-foreground max-w-sm leading-relaxed text-balance">{description}</p>
        ) : null}
        {children}
        {actionLabel ? (
          <Button asChild variant="cta" size="pill" className="mt-4">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
