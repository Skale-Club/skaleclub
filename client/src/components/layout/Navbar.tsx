import { Link, useLocation } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { Menu, X, Phone } from "lucide-react";
import { useState, useCallback } from "react";
import { clsx } from "clsx";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { trackEvent } from "@/lib/analytics";
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
  const pagePaths = buildPagePaths(companySettings?.pageSlugs);

  const displayPhone = companySettings?.companyPhone || "";
  const telPhone = displayPhone.replace(/\D/g, "");

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
      window.location.href = `/#${hash}`;
    }
  }, [location]);

  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="max-w-7xl mx-auto bg-[#1c1e24]/60 backdrop-blur-md border border-white/5 rounded-full shadow-md shadow-black/10 px-4">
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
                <span className="text-white font-semibold">{companySettings.companyName}</span>
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
                      isActive ? "text-white" : "text-white/70 hover:text-white"
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
                    isActive ? "text-white" : "text-white/70 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <LanguageToggle />

            {displayPhone && (
              <a
                href={`tel:${telPhone}`}
                onClick={() => trackEvent("click_call", { location: "navbar", label: displayPhone })}
                className="px-4 py-2 bg-[#406EF1] hover:bg-[#355CD0] text-white font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2"
              >
                <Phone className="w-4 h-4 fill-current" />
                {displayPhone}
              </a>
            )}
          </div>

          <div className="flex md:hidden items-center gap-3">
            <div className="scale-90 origin-right">
              <LanguageToggle />
            </div>
            <button
              className="p-2 -mr-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-[#1c1e24] flex flex-col animate-in fade-in duration-200">
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
                <span className="text-white font-semibold text-lg">{companySettings.companyName}</span>
              ) : null}
            </Link>
            <button
              className="p-2 -mr-2 text-white"
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
                      className="text-left text-3xl font-semibold text-white/90 hover:text-white transition-colors"
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
                    className="text-3xl font-semibold text-white/90 hover:text-white transition-colors"
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
                href={`tel:${telPhone}`}
                onClick={() => {
                  trackEvent("click_call", { location: "navbar_mobile", label: displayPhone });
                  setIsMenuOpen(false);
                }}
                className="inline-flex w-fit items-center gap-2 px-5 py-3 bg-[#406EF1] hover:bg-[#355CD0] text-white font-bold rounded-full transition-all text-base"
              >
                <Phone className="w-4 h-4 fill-current" />
                {displayPhone}
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
                    className="text-white/70 hover:text-white transition-colors"
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
  );
}
