import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps {
  tone?: "dark" | "light";
  className?: string;
  children: ReactNode;
}

/**
 * Small uppercase label with the editorial eyebrow style.
 * Use inside cards where a full SectionHeading is too much.
 */
export function Eyebrow({ tone = "dark", className, children }: EyebrowProps) {
  return (
    <p
      className={cn(
        "text-xs font-bold uppercase tracking-[0.24em]",
        tone === "light" ? "text-cta-ink" : "text-cta-soft",
        className,
      )}
    >
      {children}
    </p>
  );
}
