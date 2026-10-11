import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { PillButton } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick } from "@/lib/analytics";
import { requestLeadFormOpen } from "@/lib/leadForm";
import { isFloatingChromeHidden } from "./MobileActionBar";

type FloatingState = { available: boolean; visible: boolean; label: string };

/**
 * Keeps the page's primary form action available after the hero CTA scrolls
 * above the fixed header. The page continues to own its modal and form slug.
 */
export function FloatingLeadCta() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const [state, setState] = useState<FloatingState>({ available: false, visible: false, label: "Get started" });
  const [scrollLocked, setScrollLocked] = useState(false);

  useEffect(() => {
    const check = () => setScrollLocked(
      document.body.style.overflow === "hidden" || document.body.hasAttribute("data-scroll-locked"),
    );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let source: HTMLElement | null = null;
    let inlineTargets: HTMLElement[] = [];
    let sourceObserver: IntersectionObserver | null = null;
    let heroPassed = false;

    const updateVisibility = () => {
      const inlineVisible = inlineTargets.some((target) => {
        const rect = target.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });
      const nextVisible = heroPassed && !inlineVisible;
      setState((current) => current.visible === nextVisible ? current : { ...current, visible: nextVisible });
    };

    const connect = () => {
      const next = document.querySelector<HTMLElement>("[data-floating-lead-source]");
      const nextInlineTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-floating-lead-inline]"));
      const sameInlineTargets = nextInlineTargets.length === inlineTargets.length
        && nextInlineTargets.every((target, index) => target === inlineTargets[index]);
      if (next === source && sameInlineTargets) return;

      sourceObserver?.disconnect();
      source = next;
      inlineTargets = nextInlineTargets;
      if (!source) {
        document.body.removeAttribute("data-floating-lead-page");
        setState((current) => ({ ...current, available: false, visible: false }));
        return;
      }

      document.body.setAttribute("data-floating-lead-page", "true");
      const label = source.dataset.floatingLeadLabel || source.textContent?.trim() || "Get started";
      setState({ available: true, visible: false, label });
      sourceObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          heroPassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= 96;
          updateVisibility();
        },
        { rootMargin: "-96px 0px 0px 0px", threshold: 0 },
      );
      sourceObserver.observe(source);
      updateVisibility();
    };

    connect();
    const domObserver = new MutationObserver(connect);
    domObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility, { passive: true });
    return () => {
      domObserver.disconnect();
      sourceObserver?.disconnect();
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
      document.body.removeAttribute("data-floating-lead-page");
    };
  }, [location]);

  const hidden = isFloatingChromeHidden(location, buildPagePaths(settings?.pageSlugs).thankYou);
  if (hidden || scrollLocked || !state.available || !state.visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 px-3 pt-2.5 backdrop-blur animate-in slide-in-from-bottom-3 fade-in duration-200 md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
      data-testid="floating-lead-cta"
    >
      <PillButton
        variant="primary"
        size="sm"
        className="mx-auto flex w-full max-w-sm whitespace-nowrap px-6 shadow-[0_14px_36px_rgba(0,0,0,.3)] md:w-auto md:max-w-none md:py-3"
        onClick={() => {
          requestLeadFormOpen("floating-cta");
          trackCTAClick("floating-cta", state.label);
        }}
      >
        {t(state.label)}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </PillButton>
    </div>
  );
}
