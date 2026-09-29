import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const ASPECT = {
  "16/9": "aspect-[16/9]",
  "2/1": "aspect-[2/1]",
  "4/3": "aspect-[4/3]",
} as const;

export interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  tone: "dark" | "light";
  aspect?: keyof typeof ASPECT;
  /** Load immediately (above the fold); lazy otherwise. */
  eager?: boolean;
  /** Small icon shown before the caption. */
  icon?: LucideIcon;
  className?: string;
  /** Extra image classes, e.g. `sm:aspect-[2/1]` to change ratio by breakpoint. */
  imgClassName?: string;
}

/**
 * Sharp-cornered framed image with an optional caption strip.
 * Alt text and caption are translated through `t()`.
 */
export function Figure({ src, alt, caption, tone, aspect = "16/9", eager, icon: Icon, className, imgClassName }: FigureProps) {
  const { t } = useTranslation();
  const dark = tone === "dark";
  return (
    <figure
      className={cn(
        "overflow-hidden border",
        dark
          ? "border-white/10 bg-navy-800 shadow-[0_28px_80px_rgba(0,0,0,.38)]"
          : "border-ink-700/10 bg-white shadow-[0_22px_60px_rgba(26,38,62,.1)]",
        className,
      )}
    >
      <img
        src={src}
        alt={t(alt)}
        className={cn("w-full object-cover", ASPECT[aspect], imgClassName)}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      {caption && (
        <figcaption
          className={cn(
            "border-t px-5 py-3 text-xs leading-5",
            dark ? "border-white/10 text-fog-400" : "border-ink-700/10 text-ink-500",
            Icon && "flex items-start gap-3",
          )}
        >
          {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cta-soft" />}
          {t(caption)}
        </figcaption>
      )}
    </figure>
  );
}
