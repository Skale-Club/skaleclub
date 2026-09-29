import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EditorialCardProps {
  tone: "dark" | "light";
  /** Replaces the hairline frame with a blue left rule, used for callouts. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Sharp-cornered content card for editorial pages, dark or light.
 * Padding and frame are defaults; override surface details through className.
 */
export function EditorialCard({ tone, accent, className, children }: EditorialCardProps) {
  return (
    <div
      className={cn(
        "p-6 sm:p-8",
        accent ? "border-l-2 border-cta-soft" : "border",
        tone === "dark"
          ? cn("bg-navy-800 shadow-[0_18px_50px_rgba(0,0,0,.18)]", !accent && "border-white/10")
          : cn("bg-white", !accent && "border-ink-700/10"),
        className,
      )}
    >
      {children}
    </div>
  );
}
