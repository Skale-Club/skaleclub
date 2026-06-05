import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SubSidebarLayoutProps {
  /** The navigation rail (typically a <SubSidebar />). */
  nav: ReactNode;
  /** The active section's content. */
  children: ReactNode;
  className?: string;
}

/**
 * Two-column layout pairing a vertical navigation rail with its content.
 * On small screens the rail sits above the content; from `md` up it sits
 * alongside it. The rail manages its own collapsed width.
 */
export function SubSidebarLayout({
  nav,
  children,
  className,
}: SubSidebarLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-start", className)}>
      {nav}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
