import { Link } from "wouter";
import { CircleHelp, Home, Menu, MessageSquareText, Newspaper, Phone, RadioTower, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { trackEvent } from "@/lib/analytics";
import { formatPhoneDisplay, telHref } from "@shared/phone";
import { MobileActionBar } from "./MobileActionBar";
import { FloatingWhatsApp } from "./FloatingWhatsApp";
import { PortfolioMegaMenu, PortfolioMobileMenu } from "./PortfolioMenu";
import { useTranslation } from "@/hooks/useTranslation";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });
  const pagePaths = useMemo(() => buildPagePaths(companySettings?.pageSlugs), [companySettings?.pageSlugs]);

  const displayPhone = companySettings?.companyPhone || "";
  const phoneLabel = formatPhoneDisplay(displayPhone);

  const mobileLinks = [
    { href: pagePaths.home, label: "Home", icon: Home },
    { href: pagePaths.hub, label: "Skale Hub", icon: RadioTower },
    { href: pagePaths.blog, label: "Blog", icon: Newspaper },
    { href: pagePaths.faq, label: "FAQ", icon: CircleHelp },
    { href: pagePaths.contact, label: "Contact", icon: MessageSquareText },
  ];

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <>
    <nav className="fixed top-4 left-0 right-0 z-50 px-4 tablet:px-0">
      <div className="container-nav relative z-[70] bg-navy-800/85 backdrop-blur-md border border-white/10 rounded-full shadow-[0_12px_35px_rgba(0,0,0,.22)] px-4">
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
            <PortfolioMegaMenu portfolioHref={pagePaths.portfolio} />

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

          <div className="flex md:hidden items-center gap-1.5 min-[420px]:gap-2">
            {displayPhone && (
              <a
                href={telHref(displayPhone)}
                aria-label={phoneLabel}
                onClick={() => trackEvent("click_call", { location: "navbar_mobile_header" })}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cta px-3 font-bold text-white transition-colors hover:bg-cta-hover min-[520px]:px-4"
              >
                <Phone className="h-4 w-4 fill-current" aria-hidden="true" />
                <span className="hidden whitespace-nowrap text-sm min-[520px]:inline">{phoneLabel}</span>
              </a>
            )}
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
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-navy-950 px-6 pb-8 pt-28 animate-in fade-in duration-200">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <nav className="flex flex-col gap-8" aria-label={t("Main navigation")}>
              <PortfolioMobileMenu portfolioHref={pagePaths.portfolio} onNavigate={() => setIsMenuOpen(false)} />

              <div className="border-t border-white/10 pt-6">
                <ul className="grid grid-cols-2 gap-2.5">
                  {mobileLinks.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setIsMenuOpen(false)}
                        className="group flex min-h-14 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 text-sm font-semibold text-fog-300 transition-colors hover:border-white/15 hover:bg-white/[0.07] hover:text-fog-50"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-cta-soft transition-colors group-hover:text-fog-50" aria-hidden="true" />
                        {t(label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {companySettings && (companySettings as any).socialLinks && Array.isArray((companySettings as any).socialLinks) && (companySettings as any).socialLinks.length > 0 && (
              <div className="mt-auto flex justify-center gap-7 border-t border-white/10 pt-8">
                {((companySettings as any).socialLinks as { platform: string; url: string }[]).map((link, i) => {
                  const Icon = platformIcons[link.platform.toLowerCase()] || SiFacebook;
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.platform}
                      onClick={() => trackEvent("click_social", { location: "navbar_mobile", label: link.platform })}
                      className="text-fog-400 transition-colors hover:text-fog-50"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
    <MobileActionBar />
    <FloatingWhatsApp />
    </>
  );
}
