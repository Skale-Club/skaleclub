import { Link, useLocation } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { Menu, X, Phone } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { trackEvent } from "@/lib/analytics";
import { languageHref } from "@/lib/languageRouting";
import { formatPhoneDisplay, telHref } from "@shared/phone";
import { MobileActionBar } from "./MobileActionBar";
import {
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiLinkedin,
  SiTiktok,
} from "react-icons/si";

const platformIcons: Record<string, any> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  twitter: SiX,
  x: SiX,
  youtube: SiYoutube,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
};

export function Navbar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });
  const pagePaths = useMemo(() => buildPagePaths(companySettings?.pageSlugs), [companySettings?.pageSlugs]);

  const displayPhone = companySettings?.companyPhone || "";
  const phoneLabel = formatPhoneDisplay(displayPhone);

  const navLinks = [
    { href: pagePaths.portfolio, label: t("Portfolio") },
  ];

  const handleHashNavigation = useCallback((hash: string) => {
    if (location === "/") {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      window.location.href = languageHref(`/#${hash}`);
    }
  }, [location]);

  return (
    <>
    <nav className="fixed top-4 left-0 right-0 z-50 px-4 tablet:px-0">
      <div className="container-nav bg-navy-800/85 backdrop-blur-md border border-white/10 rounded-full shadow-[0_12px_35px_rgba(0,0,0,.22)] px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 min-h-[40px] min-w-[54px] pl-3 pr-4">
            {companySettings?.logoMain ? (
              <img
                src={companySettings.logoMain}
                alt={companySettings.companyName || ""}
                width={54}
                height={54}
                className="h-auto w-[54px] object-contain p-1.5"
              />
            ) : (
              companySettings?.companyName ? (
                <span className="text-fog-50 font-semibold">{companySettings.companyName}</span>
              ) : null
            )}
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isHashLink = link.href.startsWith("/#");
              const isActive = location === link.href;

              if (isHashLink) {
                const hash = link.href.replace("/#", "");
                return (
                  <button
                    key={link.href}
                    onClick={() => handleHashNavigation(hash)}
                    className={clsx(
                      "text-sm font-semibold transition-colors",
                      isActive ? "text-fog-50" : "text-fog-300 hover:text-fog-50"
                    )}
                  >
                    {link.label}
                  </button>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "text-sm font-semibold transition-colors",
                    isActive ? "text-fog-50" : "text-fog-300 hover:text-fog-50"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <LanguageToggle />

            {displayPhone && (
              <a
                href={telHref(displayPhone)}
                onClick={() => trackEvent("click_call", { location: "navbar" })}
                className="px-4 py-2 bg-cta hover:bg-cta-hover text-white font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2"
              >
                <Phone className="w-4 h-4 fill-current" />
                {phoneLabel}
              </a>
            )}
          </div>

          <div className="flex md:hidden items-center gap-3">
            <div className="scale-90 origin-right">
              <LanguageToggle />
            </div>
            <button
              className="p-2 -mr-2 text-fog-50"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-navy-950 flex flex-col animate-in fade-in duration-200">
          {/* Top: logo + close */}
          <div className="flex items-center justify-between h-20 px-6 shrink-0">
            <Link
              href="/"
              className="flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              {companySettings?.logoMain ? (
                <img
                  src={companySettings.logoMain}
                  alt={companySettings.companyName || ""}
                  width={54}
                  height={54}
                  className="h-auto w-[54px] object-contain p-1.5"
                />
              ) : companySettings?.companyName ? (
                <span className="text-fog-50 font-semibold text-lg">{companySettings.companyName}</span>
              ) : null}
            </Link>
            <button
              className="p-2 -mr-2 text-fog-50"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Menu options (vertically centered) */}
          <div className="flex-1 overflow-y-auto flex flex-col justify-center gap-8 px-8">
            <nav className="flex flex-col gap-6">
              {navLinks.map((link) => {
                const isHashLink = link.href.startsWith("/#");

                if (isHashLink) {
                  const hash = link.href.replace("/#", "");
                  return (
                    <button
                      key={link.href}
                      className="text-left text-3xl font-semibold text-fog-200 hover:text-fog-50 transition-colors"
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleHashNavigation(hash);
                      }}
                    >
                      {link.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-3xl font-semibold text-fog-200 hover:text-fog-50 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="w-fit">
              <LanguageToggle />
            </div>

            {displayPhone && (
              <a
                href={telHref(displayPhone)}
                onClick={() => {
                  trackEvent("click_call", { location: "navbar" });
                  setIsMenuOpen(false);
                }}
                className="inline-flex w-fit items-center gap-2 px-5 py-3 bg-cta hover:bg-cta-hover text-white font-bold rounded-full transition-all text-base"
              >
                <Phone className="w-4 h-4 fill-current" />
                {phoneLabel}
              </a>
            )}
          </div>

          {/* Social media (bottom) */}
          {companySettings && (companySettings as any).socialLinks && Array.isArray((companySettings as any).socialLinks) && (companySettings as any).socialLinks.length > 0 && (
            <div className="shrink-0 px-8 py-8 border-t border-white/10 flex gap-6 justify-center">
              {((companySettings as any).socialLinks as { platform: string; url: string }[]).map((link, i) => {
                const Icon = platformIcons[link.platform.toLowerCase()] || SiFacebook;
                return (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("click_social", { location: "navbar_mobile", label: link.platform })}
                    className="text-fog-300 hover:text-fog-50 transition-colors"
                  >
                    <Icon className="w-6 h-6" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
    <MobileActionBar />
    </>
  );
}
