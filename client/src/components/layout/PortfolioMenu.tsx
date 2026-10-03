import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Briefcase, ChevronDown, Package, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import type { CompanySettings, PortfolioService } from "@shared/schema";
import { catalogProducts, catalogServices } from "@shared/catalog";
import { PRODUCT_CARDS } from "@shared/products";
import { getImageUrl } from "@/components/admin/shared/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface MenuItem {
  href: string;
  icon: LucideIcon;
  title: string;
  /** How many items the category holds, and the word for them ("3 apps"). */
  count: number;
  unit: "apps" | "services" | "products";
  /** Thumbnail for the desktop panel: a photo/screenshot (cover) or a cut-out (contain). */
  image?: { src: string; fit: "cover" | "contain" };
}

/** Apps, Services and Products: the three categories /portfolio is made of. */
function usePortfolioMenuItems(): MenuItem[] {
  // The same lists /portfolio reads; cached, so the navbar adds no extra request on those pages.
  const { data: portfolioServices } = useQuery<PortfolioService[]>({
    queryKey: ["/api/portfolio-services"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  return useMemo(() => {
    const apps = catalogProducts(portfolioServices);
    const services = catalogServices(settings?.homepageContent?.ourServicesSection?.cards);
    const appCover = apps.find((app) => app.cover)?.cover;
    const serviceCover = services.find((service) => service.cover)?.cover;
    return [
      {
        href: "/apps",
        icon: AppWindow,
        title: "Apps",
        count: apps.length,
        unit: "apps",
        image: appCover ? { src: getImageUrl(appCover, { width: 480, quality: 75 }), fit: "cover" } : undefined,
      },
      {
        href: "/services",
        icon: Briefcase,
        title: "Services",
        count: services.length,
        unit: "services",
        image: serviceCover ? { src: getImageUrl(serviceCover, { width: 480, quality: 75 }), fit: "cover" } : undefined,
      },
      {
        href: "/products",
        icon: Package,
        title: "Products",
        count: PRODUCT_CARDS.length,
        unit: "products",
        image: { src: PRODUCT_CARDS[0].image.src, fit: "contain" },
      },
    ];
  }, [portfolioServices, settings]);
}

/** True while the current page is the portfolio or one of its category pages. */
function useInPortfolio(portfolioHref: string, items: MenuItem[]): boolean {
  const [location] = useLocation();
  return [portfolioHref, ...items.map((item) => item.href)].some(
    (href) => location === href || location.startsWith(`${href}/`),
  );
}

/**
 * Desktop nav item: "Portfolio" stays a link to /portfolio, and the chevron
 * next to it (or hover / keyboard focus on the item) opens a panel with the
 * three categories. Focus order is link, chevron, then the panel's cards.
 */
export function PortfolioMegaMenu({ portfolioHref }: { portfolioHref: string }) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const items = usePortfolioMenuItems();
  const active = useInPortfolio(portfolioHref, items);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastPointerType = useRef("");
  const panelId = useId();

  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    // A short grace period so the pointer can cross the gap to the panel.
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  useEffect(() => cancelClose, []);

  // Navigating (a card, the label, the browser's back button) always closes it.
  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Escape" || !open) return;
      setOpen(false);
      // Hand focus back to the chevron when it was inside the panel.
      if (rootRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
    },
    [open],
  );

  return (
    <div
      ref={rootRef}
      className="flex items-center"
      // Touch taps emit a mouse-like enter too; only a real mouse hovers.
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      }}
      onFocus={(event) => {
        // Keyboard focus opens it; a mouse click on the label must not.
        let keyboardFocus = true;
        try {
          keyboardFocus = event.target.matches(":focus-visible");
        } catch {
          // Safari < 15.4 rejects the selector; treat it as keyboard focus.
        }
        if (keyboardFocus) {
          cancelClose();
          setOpen(true);
        }
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={onKeyDown}
    >
      <Link
        href={portfolioHref}
        className={clsx(
          "text-sm font-semibold transition-colors",
          active ? "text-fog-50" : "text-fog-300 hover:text-fog-50",
        )}
      >
        {t("Portfolio")}
      </Link>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("Portfolio menu")}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
        }}
        // Hovering already opened it, so a mouse click must not toggle it shut.
        onClick={() => (lastPointerType.current === "mouse" ? setOpen(true) : setOpen((value) => !value))}
        className={clsx(
          "ml-1 -mr-1 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/5",
          active || open ? "text-fog-50" : "text-fog-300 hover:text-fog-50",
        )}
      >
        <ChevronDown className={clsx("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      {/* Anchored to the navbar pill (the nearest positioned ancestor), always
          mounted so opening never shifts layout; `invisible` also takes the
          cards out of the tab order while it is closed. The top padding is a
          hover bridge across the gap between the pill and the panel. */}
      <div
        id={panelId}
        className={clsx(
          "absolute left-1/2 top-full z-50 w-[min(46rem,100%)] -translate-x-1/2 pt-3 transition-[opacity,transform,visibility] duration-150",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <div
          role="group"
          aria-label={t("Portfolio")}
          className="grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-navy-800 p-3 shadow-[0_24px_60px_rgba(0,0,0,.35)] backdrop-blur-md"
        >
          {/* Picture first, two words under it: the panel is for choosing, not reading. */}
          {items.map(({ href, icon: Icon, title, count, unit, image }) => (
            <Link
              key={href}
              href={href}
              className="group block overflow-hidden rounded-2xl border border-white/5 bg-navy-900/70 transition-colors hover:border-cta-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cta-soft"
            >
              <span className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(81,115,214,0.16),transparent_70%)]">
                {image ? (
                  <img
                    src={image.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={clsx(
                      "absolute inset-0 h-full w-full transition duration-300 group-hover:scale-105",
                      image.fit === "cover" ? "object-cover object-top" : "object-contain p-3",
                    )}
                  />
                ) : (
                  <Icon className="h-8 w-8 text-cta-soft" aria-hidden="true" />
                )}
              </span>
              <span className="flex items-baseline justify-between gap-2 px-4 py-3">
                <span className="font-display text-base font-semibold text-fog-50">{t(title)}</span>
                {count > 0 && <span className="text-xs font-medium text-fog-400">{count} {t(unit)}</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Mobile menu row: "Portfolio" is still a link, with a chevron that reveals
 * the three categories as indented links.
 */
export function PortfolioMobileMenu({ portfolioHref, onNavigate }: { portfolioHref: string; onNavigate: () => void }) {
  const { t } = useTranslation();
  const items = usePortfolioMenuItems();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href={portfolioHref}
          className="text-3xl font-semibold text-fog-200 hover:text-fog-50 transition-colors"
          onClick={onNavigate}
        >
          {t("Portfolio")}
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={t("Portfolio menu")}
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-fog-300 hover:text-fog-50"
        >
          <ChevronDown className={clsx("h-6 w-6 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <ul id={panelId} className="mt-4 ml-1 flex flex-col gap-4 border-l border-white/10 pl-5">
          {items.map(({ href, title }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-2xl font-semibold text-fog-300 hover:text-fog-50 transition-colors"
                onClick={onNavigate}
              >
                {t(title)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
