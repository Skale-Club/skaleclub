import type { ReactNode } from "react";
import { Link } from "wouter";

interface Breadcrumb {
  label: string;
  href: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumb?: Breadcrumb[];
  compact?: boolean;
}

/**
 * Shared dark header band for public-site content pages (Blog, Contact,
 * About, FAQ, Privacy, Terms). Keeps title/subtitle/breadcrumb treatment
 * consistent across pages that aren't full marketing landing sections.
 */
export function PageHeader({ title, subtitle, breadcrumb, compact = false }: PageHeaderProps) {
  return (
    <section className={`${compact ? "page-top pb-12" : "page-top pb-12 md:pb-16"} bg-surface-dark text-white`}>
      <div className="container-custom container-page">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-white/60 mb-4" data-testid="nav-page-breadcrumb">
            {breadcrumb.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-2">
                {idx > 0 && <span>/</span>}
                {idx === breadcrumb.length - 1 ? (
                  <span className="text-white">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-white transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-lg text-white/70 max-w-2xl">{subtitle}</p>
        )}
      </div>
    </section>
  );
}

export default PageHeader;
