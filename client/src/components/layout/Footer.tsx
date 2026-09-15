import { memo, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { buildPagePaths } from "@shared/pageSlugs";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { Phone, Mail, MapPin } from "lucide-react";
import {
  SiFacebook,
  SiInstagram,
  SiX,
  SiYoutube,
  SiLinkedin,
  SiTiktok
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

function FooterComponent() {
  const { t } = useTranslation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const pagePaths = useMemo(() => buildPagePaths(companySettings?.pageSlugs), [companySettings?.pageSlugs]);

  const companyName = companySettings?.companyName?.trim() || "";
  const tagline =
    companySettings?.heroSubtitle?.trim() ||
    companySettings?.seoDescription?.trim() ||
    '';

  const phone = companySettings?.companyPhone?.trim() || "";
  const email = companySettings?.companyEmail?.trim() || "";
  const address = companySettings?.companyAddress?.trim() || "";

  // Built from pagePaths rather than hard-coded hrefs, so renaming a page slug
  // in the admin keeps the footer in step with the navbar.
  const navLinks = [
    { href: pagePaths.portfolio, label: "Portfolio" },
    { href: pagePaths.blog, label: "Blog" },
    { href: pagePaths.faq, label: "FAQ" },
    { href: pagePaths.contact, label: "Contact" },
  ];

  const socialLinks = Array.isArray(companySettings?.socialLinks)
    ? (companySettings!.socialLinks as { platform: string; url: string }[])
    : [];

  return (
    <footer className="bg-surface-dark text-slate-300 pt-14 pb-8 md:pt-16 md:pb-10">
      <div className="container-custom mx-auto">
        {/* Brand column is wider than the link columns: it carries the logo and
            the tagline, the others are single-word links. */}
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1.4fr]">
          <div className="space-y-5">
            <Link href="/" className="inline-flex items-center gap-2">
              {companySettings?.logoDark ? (
                <img
                  src={companySettings.logoDark}
                  alt={companyName}
                  width={54}
                  height={54}
                  className="h-auto w-[54px] object-contain p-1.5"
                />
              ) : companySettings?.logoIcon ? (
                <img
                  src={companySettings.logoIcon}
                  alt={companyName}
                  width={54}
                  height={54}
                  className="h-auto w-[54px] object-contain p-1.5 brightness-0 invert"
                />
              ) : (
                companyName ? <span className="text-white font-semibold text-lg">{companyName}</span> : null
              )}
            </Link>

            {tagline ? (
              <p className="text-gray-400 max-w-sm text-sm leading-relaxed">{t(tagline)}</p>
            ) : null}

            {socialLinks.length > 0 && (
              <div className="flex gap-3">
                {socialLinks.map((link, i) => {
                  const Icon = platformIcons[link.platform.toLowerCase()] || SiFacebook;
                  return (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.platform}
                      onClick={() => trackEvent('click_social', { location: 'footer', label: link.platform })}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-white/10 text-gray-400 transition-colors hover:text-white hover:bg-cta hover:border-cta"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <nav aria-label={t('Footer')}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-cta">
              {t('Explore')}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-cta">
              {t('Get in touch')}
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {phone && (
                <li>
                  <a
                    href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                    onClick={() => trackEvent('click_call', { location: 'footer' })}
                    className="flex items-start gap-3 text-gray-400 transition-colors hover:text-white"
                  >
                    <Phone className="w-4 h-4 mt-0.5 shrink-0 text-cta" aria-hidden="true" />
                    <span>{phone}</span>
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    onClick={() => trackEvent('click_email', { location: 'footer' })}
                    className="flex items-start gap-3 text-gray-400 transition-colors hover:text-white break-all"
                  >
                    <Mail className="w-4 h-4 mt-0.5 shrink-0 text-cta" aria-hidden="true" />
                    <span>{email}</span>
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-3 text-gray-400">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-cta" aria-hidden="true" />
                  <span>{address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="container-custom mx-auto mt-12 pt-6 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-gray-400 text-xs md:text-sm">&copy; {new Date().getFullYear()} {companyName}. {t('All rights reserved.')}</p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-xs md:text-sm md:justify-end">
            <Link href={pagePaths.privacyPolicy} className="text-gray-400 hover:text-gray-200 transition-colors">{t('Privacy Policy')}</Link>
            <Link href={pagePaths.termsOfService} className="text-gray-400 hover:text-gray-200 transition-colors">{t('Terms of Service')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Footer's output doesn't depend on route — memoize so it skips re-rendering
// on every navigation (it was previously re-rendering on each Router location change).
export const Footer = memo(FooterComponent);
