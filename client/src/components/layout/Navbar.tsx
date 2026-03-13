import { Link, useLocation } from "wouter";
import { useTranslation } from "@/hooks/useTranslation";
import { Menu, X, Phone, User } from "lucide-react";
import { useState, useCallback } from "react";
import { clsx } from "clsx";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";

export function Navbar() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const displayPhone = companySettings?.companyPhone || "";
  const telPhone = displayPhone.replace(/\D/g, "");

  const navLinks = [
    { href: "/portfolio", label: t("Portfolio") },
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
    <nav className="bg-[#1c1e24]/85 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
      <div className="container-custom mx-auto">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 min-h-[40px] min-w-[54px]">
            {companySettings?.logoMain ? (
              <img
                src={companySettings.logoMain}
                alt={companySettings.companyName || ""}
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

            <Link
              href="/admin/login"
              className="text-sm font-semibold text-white bg-transparent border border-white/40 px-4 py-2 rounded-full hover:bg-white/10 transition-colors"
              data-testid="button-login"
            >
              {t("Login")}
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-3">
            <div className="scale-90 origin-right">
              <LanguageToggle />
            </div>
            <button
              className="p-2 -mr-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 py-6 px-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-5">
            {navLinks.map((link) => {
              const isHashLink = link.href.startsWith("/#");
              const content = (
                <span className="text-lg font-semibold text-slate-700 hover:text-primary transition-colors">
                  {link.label}
                </span>
              );

              if (isHashLink) {
                const hash = link.href.replace("/#", "");
                return (
                  <button
                    key={link.href}
                    className="block text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleHashNavigation(hash);
                    }}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {content}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col gap-6">
            <Link
              href="/admin/login"
              className="flex items-center gap-3 text-lg font-bold text-primary hover:opacity-80 transition-opacity"
              data-testid="button-mobile-login"
              onClick={() => setIsMenuOpen(false)}
            >
              <User className="w-6 h-6" />
              {t("Login")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
