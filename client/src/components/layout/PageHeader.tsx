import type { ReactNode } from "react";
import { Link } from "wouter";
import { Band } from "@/components/editorial/Band";
import { Eyebrow } from "@/components/editorial/Eyebrow";

interface Breadcrumb {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: Breadcrumb[];
  compact?: boolean;
  eyebrow?: string;
}

/**
 * Shared editorial hero band for public-site content pages (Blog, FAQ,
 * Privacy, Terms). The Band's own container is neutralised so the inner
 * `container-custom container-page` keeps the column width those pages use.
 */
export function PageHeader({ title, subtitle, breadcrumb, compact = false, eyebrow }: PageHeaderProps) {
  return (
    <Band
      tone="hero"
      pattern
      containerClassName={`page-top ${compact ? "pb-12" : "pb-12 md:pb-16"} max-w-none px-0 sm:px-0 lg:px-0`}
    >
      <div className="container-custom container-page">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-4 flex items-center gap-2 text-sm text-fog-400" data-testid="nav-page-breadcrumb">
            {breadcrumb.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-2">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumb.length - 1 ? (
                  <span className="text-fog-50">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="transition-colors hover:text-fog-50">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-fog-50 text-balance sm:text-6xl">
          {title}
        </h1>
        {subtitle && <p className="mt-6 max-w-2xl text-lg leading-8 text-fog-400">{subtitle}</p>}
      </div>
    </Band>
  );
}

export default PageHeader;
