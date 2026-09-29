import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

interface StyleProps {
  variant?: Variant;
  size?: "md" | "sm";
  /** Surface the pill sits on; only affects the ghost variant. */
  tone?: "dark" | "light";
}

function pillClasses({ variant = "primary", size = "md", tone = "dark" }: StyleProps, className?: string) {
  const variants: Record<Variant, string> = {
    primary: "bg-cta text-white hover:bg-cta-hover font-bold",
    secondary: "bg-fog-50 text-navy-850 hover:bg-white font-bold",
    ghost:
      tone === "light"
        ? "border border-ink-700/15 text-ink hover:bg-ink/5 font-semibold"
        : "border border-white/20 text-white hover:bg-white/5 font-semibold",
  };
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full transition",
    size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3.5",
    variants[variant],
    className,
  );
}

export interface PillLinkProps extends StyleProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

/**
 * Pill-shaped link. Internal paths use the wouter router; hash, external and
 * `target` links render a plain anchor.
 */
export function PillLink({ href, variant, size, tone, className, children, ...rest }: PillLinkProps) {
  const classes = pillClasses({ variant, size, tone }, className);
  const internal = href.startsWith("/") && !href.startsWith("//") && !rest.target;
  if (internal) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={classes} {...rest}>
      {children}
    </a>
  );
}

export interface PillButtonProps extends StyleProps, ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

/** Pill-shaped button with the same variants as PillLink. */
export function PillButton({ variant, size, tone, className, type = "button", children, ...rest }: PillButtonProps) {
  return (
    <button type={type} className={pillClasses({ variant, size, tone }, className)} {...rest}>
      {children}
    </button>
  );
}
