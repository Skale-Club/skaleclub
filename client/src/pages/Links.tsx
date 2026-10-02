import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, ExternalLink, Globe, Mail } from "lucide-react";
import {
  SiFacebook,
  SiGithub,
  SiInstagram,
  SiLinkedin,
  SiPinterest,
  SiTelegram,
  SiTiktok,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { getLinkIcon as getCuratedIcon } from '@/components/links/linkIcons';
import type { LinksPageLink } from '@shared/schema';
import { DEFAULT_LINKS_PAGE_THEME } from '@shared/links';
import type { CSSProperties } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettingsData } from "@/components/admin/shared/types";
import { Skeleton } from '@/components/ui/skeleton';
import { buildPagePaths } from "@shared/pageSlugs";
import { telHref, formatPhoneDisplay } from "@shared/phone";
import { MobileActionBar } from "@/components/layout/MobileActionBar";

const iconMap: Record<string, React.ReactNode> = {
  instagram: <SiInstagram className="w-5 h-5" />,
  linkedin: <SiLinkedin className="w-5 h-5" />,
  twitter: <SiX className="w-5 h-5" />,
  x: <SiX className="w-5 h-5" />,
  youtube: <SiYoutube className="w-5 h-5" />,
  github: <SiGithub className="w-5 h-5" />,
  facebook: <SiFacebook className="w-5 h-5" />,
  tiktok: <SiTiktok className="w-5 h-5" />,
  pinterest: <SiPinterest className="w-5 h-5" />,
  telegram: <SiTelegram className="w-5 h-5" />,
  whatsapp: <SiWhatsapp className="w-5 h-5" />,
  email: <Mail className="w-5 h-5" />,
  website: <Globe className="w-5 h-5" />,
};

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  return iconMap[p] || <ExternalLink className="w-5 h-5" />;
};

const getLinkIcon = (url: string) => {
  if (url.includes('mailto:')) return <Mail className="w-5 h-5" />;
  if (url.includes('skale.club') || url.startsWith('/')) return <Globe className="w-5 h-5" />;
  return <ExternalLink className="w-5 h-5" />;
};

const renderLinkIcon = (link: LinksPageLink) => {
  if (link.iconType === 'lucide' && link.iconValue) {
    const Icon = getCuratedIcon(link.iconValue);
    if (Icon) return <Icon className="w-5 h-5" />;
  }
  if (link.iconType === 'upload' && link.iconValue) {
    return (
      <img
        src={link.iconValue}
        alt=""
        className="w-6 h-6 object-contain"
      />
    );
  }
  return getLinkIcon(link.url);
};

const trackLinkClick = (linkId: string | undefined) => {
  if (!linkId) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(`/api/links-page/click/${encodeURIComponent(linkId)}`);
    }
  } catch {
    // Swallow — analytics is non-critical, must never block navigation.
  }
};

export default function Links() {
  // Force dark mode — this page always uses its own dark palette regardless
  // of the user's system preference or admin session state.
  useEffect(() => {
    const root = document.documentElement;
    const previousRootBackground = root.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;

    root.classList.remove('light');
    root.classList.add('dark');
    root.style.backgroundColor = DEFAULT_LINKS_PAGE_THEME.backgroundColor;
    document.body.style.backgroundColor = DEFAULT_LINKS_PAGE_THEME.backgroundColor;

    return () => {
      root.style.backgroundColor = previousRootBackground;
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, []);

  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  // Url of an avatar that failed to load, so the initials block replaces a broken image.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  // The admin live preview embeds this page in a narrow iframe; skip the sticky action bar there.
  const [embedded] = useState(() => typeof window !== "undefined" && window.self !== window.top);
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });
  const pagePaths = buildPagePaths(settings?.pageSlugs);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center pt-16 px-5"
        style={{
          background: DEFAULT_LINKS_PAGE_THEME.backgroundColor,
          colorScheme: 'dark',
        }}
        aria-busy="true"
      >
        <div className="w-full max-w-[420px] flex flex-col items-center">
          <Skeleton className="h-3 w-36 rounded bg-white/10 mb-6" />
          <Skeleton className="w-24 h-24 rounded-full bg-white/10 mb-5" />
          <Skeleton className="h-8 w-44 rounded-lg bg-white/10 mb-3" />
          <Skeleton className="h-4 w-64 max-w-full rounded-lg bg-white/10 mb-10" />
          <div className="w-full space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const config = settings?.linksPageConfig || {
    avatarUrl: "/ghl-logo.webp",
    title: "Skale Club",
    description: "Data-Driven Marketing & Scalable Growth Solutions",
    links: [
      { title: "Skale Club Official Website", url: pagePaths.home, order: 0 },
      { title: "Book a Strategy Call", url: pagePaths.contact, order: 1 },
      { title: "View Our Portfolio", url: pagePaths.portfolio, order: 2 },
      { title: "Read Our Blog", url: pagePaths.blog, order: 3 }
    ],
    socialLinks: [
      { platform: "instagram", url: "#", order: 0 },
      { platform: "linkedin", url: "#", order: 1 },
      { platform: "twitter", url: "#", order: 2 },
      { platform: "youtube", url: "#", order: 3 },
      { platform: "email", url: "mailto:hello@skale.club", order: 4 }
    ]
  };

  const visibleLinks = config.links.filter((l) => l.visible !== false);
  const theme = { ...DEFAULT_LINKS_PAGE_THEME, ...(config.theme ?? {}) };
  const rootStyle: CSSProperties = {
    background: theme.backgroundGradient || theme.backgroundColor,
    backgroundColor: theme.backgroundColor,
    colorScheme: 'dark',
    // primaryColor as CSS vars — consumed by the ambient glow and by the
    // link/social hover states (pure CSS, no style mutation on mouse events).
    ['--links-primary' as any]: theme.primaryColor,
    ['--link-color' as any]: theme.primaryColor,
  };

  const companyPhone = settings?.companyPhone?.trim() || "";
  const companyEmail = settings?.companyEmail?.trim() || "";
  const companyAddress = settings?.companyAddress?.trim() || "";
  const contactParts: React.ReactNode[] = [];
  if (companyPhone) {
    contactParts.push(
      <a key="phone" href={telHref(companyPhone)} className="transition-colors hover:text-white">
        {formatPhoneDisplay(companyPhone)}
      </a>,
    );
  }
  if (companyEmail) {
    contactParts.push(
      <a key="email" href={`mailto:${companyEmail}`} className="transition-colors hover:text-white">
        {companyEmail}
      </a>,
    );
  }

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden"
      style={rootStyle}
    >
      {/* Optional background image layer — sits behind grid and ambient glow */}
      {theme.backgroundImageUrl && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none bg-cover bg-center"
          style={{ backgroundImage: `url(${theme.backgroundImageUrl})` }}
        />
      )}
      {/* Same flat grid the editorial sections use (index.css .pattern-grid-dark) */}
      <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none pattern-grid-dark" />
      {/* Background ambient glow, top-right biased — inline style avoids Tailwind's opacity-modifier/CSS-var incompatibility */}
      <div
        aria-hidden="true"
        className="absolute top-[-12%] right-[-15%] w-[60%] h-[45%] min-w-[280px] rounded-full blur-[120px] pointer-events-none z-[1]"
        style={{ backgroundColor: theme.primaryColor, opacity: 0.2 }}
      />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cta/10 rounded-full blur-[120px] pointer-events-none z-[1]" />

      <motion.div
        className={`relative z-10 mx-auto w-full max-w-[420px] px-5 ${embedded ? "pb-12" : "pb-28 md:pb-12"} flex flex-col items-center`}
        // Clear the phone's status bar / notch, then a generous top margin.
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.4 },
            })}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cta-soft text-center">
          SKALE CLUB · LINKS
        </p>

        <div className="mt-8 mb-5 h-24 w-24 rounded-full">
          {config.avatarUrl && config.avatarUrl !== failedAvatarUrl ? (
            <img
              src={config.avatarUrl}
              alt={config.title}
              width={96}
              height={96}
              className="h-full w-full rounded-full object-cover"
              onError={() => setFailedAvatarUrl(config.avatarUrl)}
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            />
          ) : (
            <div
              className="h-full w-full rounded-full flex items-center justify-center bg-cta/20 text-cta-soft text-2xl font-bold"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {config.title.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-tight text-center text-white">
          {config.title}
        </h1>
        <p className="mt-2 mb-8 max-w-[320px] text-center text-base leading-relaxed text-[#A1A1AA] whitespace-pre-wrap">
          {t(config.description)}
        </p>

        <div className="w-full flex flex-col gap-3">
          {visibleLinks.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">
              {t('No links available yet.')}
            </p>
          )}
          {[...visibleLinks]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((link, index) => {
              const featured = link.featured === true;
              const subtitle = link.subtitle?.trim();
              return (
                <motion.a
                  key={link.id ?? index}
                  href={link.url}
                  target={link.url.startsWith('http') ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  onClick={() => trackLinkClick(link.id)}
                  className={
                    featured
                      ? "group flex w-full items-center gap-[14px] rounded-2xl bg-cta p-[18px] transition-colors hover:bg-cta-hover focus-visible:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      : "group flex w-full items-center gap-[14px] rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-[14px] transition-colors hover:border-[var(--link-color)] hover:bg-[color-mix(in_srgb,var(--link-color)_10%,transparent)] focus-visible:border-[var(--link-color)] focus-visible:bg-[color-mix(in_srgb,var(--link-color)_10%,transparent)] focus-visible:outline-none"
                  }
                  {...(reduceMotion
                    ? {}
                    : {
                        initial: { opacity: 0, y: 12 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.4, delay: 0.1 + index * 0.06 },
                        whileTap: { scale: 0.98 },
                      })}
                >
                  <span
                    className={
                      featured
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"
                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cta/[0.14] text-cta-soft"
                    }
                  >
                    {renderLinkIcon(link)}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    {featured && (
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                        {t('Start here')}
                      </span>
                    )}
                    <span className="block text-base font-semibold leading-snug text-white">
                      {t(link.title)}
                    </span>
                    {subtitle && (
                      <span
                        className={
                          featured
                            ? "mt-0.5 block text-[13px] leading-snug text-white/80 line-clamp-1"
                            : "mt-0.5 block text-[13px] leading-snug text-[#A1A1AA] line-clamp-1"
                        }
                      >
                        {t(subtitle)}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className={
                      featured
                        ? "h-[18px] w-[18px] shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5"
                        : "h-[18px] w-[18px] shrink-0 text-[#52525B] transition group-hover:translate-x-0.5 group-hover:text-cta-soft group-focus-visible:translate-x-0.5 group-focus-visible:text-cta-soft"
                    }
                  />
                </motion.a>
              );
            })}
        </div>

        {config.socialLinks.length > 0 && (
          <motion.div
            className="mt-7 flex flex-wrap justify-center gap-3"
            {...(reduceMotion
              ? {}
              : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay: 0.5 } })}
          >
            {config.socialLinks.map((social, index) => (
              <a
                key={index}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.platform}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/5 text-[#D4D4D8] transition-colors hover:bg-cta/15 hover:text-white focus-visible:bg-cta/15 focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--link-color)]"
              >
                {getSocialIcon(social.platform)}
              </a>
            ))}
          </motion.div>
        )}

        <footer className="mt-10 flex flex-col items-center text-center">
          {contactParts.length > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-[#71717A]">
              {contactParts.map((part, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {part}
                </span>
              ))}
            </p>
          )}
          {companyAddress && (
            <p className="mt-1 text-[13px] text-[#71717A]">{companyAddress}</p>
          )}
          <Link href={pagePaths.home} className="mt-3 text-xs text-[#52525B] transition-colors hover:text-[#D4D4D8]">
            skale.club
          </Link>
        </footer>
      </motion.div>
      {!embedded && <MobileActionBar />}
    </div>
  );
}
