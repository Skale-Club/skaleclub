import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Share2,
} from "lucide-react";
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
import QRCode from "react-qr-code";
import { downloadVCard } from "@/lib/vcard";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundState } from "@/components/NotFoundState";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { VCard as VCardType, CompanySettings } from "@shared/schema";
import { formatPhoneDisplay } from "@shared/phone";

import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ReactNode> = {
  instagram: <SiInstagram className="w-5 h-5" />,
  linkedin: <SiLinkedin className="w-5 h-5" />,
  twitter: <SiX className="w-5 h-5" />,
  x: <SiX className="w-5 h-5" />,
  youtube: <SiYoutube className="w-5 h-5" />,
  facebook: <SiFacebook className="w-5 h-5" />,
  tiktok: <SiTiktok className="w-5 h-5" />,
  github: <SiGithub className="w-5 h-5" />,
  pinterest: <SiPinterest className="w-5 h-5" />,
  telegram: <SiTelegram className="w-5 h-5" />,
  whatsapp: <SiWhatsapp className="w-5 h-5" />,
};

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  return iconMap[p] || <ExternalLink className="w-5 h-5" />;
};

// Card background: the business card's top-right corner glow (two radial
// gradients, brand blue over deep blue) plus film grain, on surface-dark.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\") repeat";
const GLOW_BRAND =
  "radial-gradient(circle 216px at calc(100% - 15px) 15px, rgba(81,115,214,0.160) 0%, rgba(81,115,214,0.160) 5%, rgba(81,115,214,0.159) 10%, rgba(81,115,214,0.156) 15%, rgba(81,115,214,0.151) 20%, rgba(81,115,214,0.143) 25%, rgba(81,115,214,0.134) 30%, rgba(81,115,214,0.122) 35%, rgba(81,115,214,0.109) 40%, rgba(81,115,214,0.095) 45%, rgba(81,115,214,0.080) 50%, rgba(81,115,214,0.065) 55%, rgba(81,115,214,0.051) 60%, rgba(81,115,214,0.038) 65%, rgba(81,115,214,0.026) 70%, rgba(81,115,214,0.017) 75%, rgba(81,115,214,0.009) 80%, rgba(81,115,214,0.004) 85%, rgba(81,115,214,0.001) 90%, rgba(81,115,214,0.000) 95%, rgba(81,115,214,0.000) 100%)";
const GLOW_DEEP =
  "radial-gradient(circle 360px at calc(100% - 15px) 15px, rgba(28,83,163,0.500) 0%, rgba(28,83,163,0.499) 5%, rgba(28,83,163,0.496) 10%, rgba(28,83,163,0.487) 15%, rgba(28,83,163,0.471) 20%, rgba(28,83,163,0.448) 25%, rgba(28,83,163,0.418) 30%, rgba(28,83,163,0.382) 35%, rgba(28,83,163,0.341) 40%, rgba(28,83,163,0.297) 45%, rgba(28,83,163,0.250) 50%, rgba(28,83,163,0.203) 55%, rgba(28,83,163,0.159) 60%, rgba(28,83,163,0.118) 65%, rgba(28,83,163,0.082) 70%, rgba(28,83,163,0.052) 75%, rgba(28,83,163,0.029) 80%, rgba(28,83,163,0.013) 85%, rgba(28,83,163,0.004) 90%, rgba(28,83,163,0.001) 95%, rgba(28,83,163,0.000) 100%)";
const CARD_BACKGROUND = `${GRAIN_URL}, ${GLOW_BRAND}, ${GLOW_DEEP}, #111111`;

const SECONDARY_ACTION_CLASS =
  "flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-medium leading-none text-[#D4D4D8] transition-colors hover:bg-white/[0.09] active:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-soft";
const ROW_CLASS =
  "group flex items-center justify-between gap-3 border-b border-white/[0.08] py-[14px] first:border-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-soft";

export default function VCard() {
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const hasTrackedView = useRef(false);
  const reduceMotion = useReducedMotion();

  const { data: contactData, isLoading, error } = useQuery<VCardType>({
    queryKey: [`/api/vcards/${username}`],
    enabled: !!username,
  });

  // Track view on page load
  const { mutate: trackViewMutation } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vcards/${username}/view`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to track view');
      return res.json();
    },
    onSuccess: () => {
      if (import.meta.env.DEV) console.log('VCard view tracked');
    },
    onError: (err) => {
      console.error('Failed to track view:', err);
    }
  });

  // Track download
  const { mutate: trackDownloadMutation } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vcards/${username}/download`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to track download');
      return res.json();
    },
    onSuccess: () => {
      if (import.meta.env.DEV) console.log('VCard download tracked');
    },
    onError: (err) => {
      console.error('Failed to track download:', err);
    }
  });

  useEffect(() => {
    if (contactData) {
      document.title = `${contactData.organization || "VCard"} | ${contactData.firstName} ${contactData.lastName}`;
    }
  }, [contactData]);

  // Trigger view tracking only once per component mount
  useEffect(() => {
    if (username && contactData && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackViewMutation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, contactData]);

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  if (!username) {
    return (
      <NotFoundState
        layout="screen"
        title="Card not found"
        description="This link is missing a card name, so there is nothing to show."
        actionLabel="Visit website"
        actionHref="/"
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex justify-center px-5 pt-7" aria-busy="true">
        <div className="w-full max-w-[400px] flex flex-col">
          <Skeleton className="h-9 w-28 rounded-lg bg-white/5" />
          <Skeleton className="mt-14 h-10 w-64 max-w-full rounded-lg bg-white/5" />
          <Skeleton className="mt-3 h-4 w-32 rounded-lg bg-white/5" />
          <Skeleton className="mt-8 h-[52px] w-full rounded-xl bg-white/5" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-white/5" />
            ))}
          </div>
          <Skeleton className="mt-8 h-[140px] w-full rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !contactData) {
    return (
      <NotFoundState
        layout="screen"
        title="Card not found"
        description={`We could not find a digital card for "${username}".`}
        actionLabel="Visit website"
        actionHref="/"
      />
    );
  }

  if (!contactData.isActive) {
    return (
      <NotFoundState
        layout="screen"
        title="This card is inactive"
        description="The owner has turned this digital card off. Reach out to them for an up-to-date link."
        actionLabel="Visit website"
        actionHref="/"
      />
    );
  }

  const handleSaveContact = async () => {
    // Download the vCard first
    downloadVCard({
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      organization: contactData.organization,
      title: contactData.title,
      cellPhone: contactData.cellPhone,
      email: contactData.email,
      url: contactData.url,
      note: contactData.bio,
    }, `${contactData.firstName}_${contactData.lastName}.vcf`);
    // Track download after successful download initiation
    trackDownloadMutation();
    toast({ title: "Contact Saved", description: "vCard has been downloaded to your device." });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${contactData!.firstName} ${contactData!.lastName} - ${contactData!.title || ''}`,
          text: contactData!.bio || '',
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link Copied", description: "Link has been copied to clipboard!" });
    }
  };

  const phoneDigits = contactData.cellPhone ? contactData.cellPhone.replace(/\D/g, "") : "";
  const telHref = phoneDigits ? `tel:${phoneDigits.startsWith("1") ? "+" + phoneDigits : "+1" + phoneDigits}` : "";
  const mailHref = contactData.email ? `mailto:${contactData.email}` : "";
  const websiteDisplay = contactData.url ? contactData.url.replace(/^https?:\/\//i, "").replace(/\/$/, "") : "";
  const socialLinks = contactData.socialLinks ?? [];
  const logoSrc = companySettings?.logoMain || companySettings?.logoDark || "";
  const fullName = `${contactData.firstName} ${contactData.lastName}`.trim();
  const secondaryCount = (telHref ? 1 : 0) + (mailHref ? 1 : 0) + 1;

  let footerHost = "skale.club";
  let footerHref = "/";
  if (companySettings?.seoCanonicalUrl) {
    try {
      const canonical = new URL(companySettings.seoCanonicalUrl);
      footerHost = canonical.host;
      footerHref = canonical.origin;
    } catch {
      // Malformed canonical URL: keep the literal fallback.
    }
  }

  return (
    <div className="relative min-h-screen bg-[#111111] text-white font-sans antialiased overflow-x-hidden">
      {/* Fixed background: surface-dark + corner glow + grain */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: CARD_BACKGROUND }}
      />

      <motion.main
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-[400px] flex-col px-5"
        style={{ paddingTop: "calc(28px + env(safe-area-inset-top))" }}
        {...(reduceMotion
          ? {}
          : {
              initial: { opacity: 0, y: 12 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.4, ease: "easeOut" },
            })}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt={contactData.organization || companySettings?.companyName || "Company logo"}
            className="h-9 w-auto self-start select-none"
            draggable={false}
          />
        )}

        <section className="mt-14">
          {contactData.avatarUrl && (
            <img
              src={contactData.avatarUrl}
              alt={fullName}
              width={72}
              height={72}
              className="mb-5 h-[72px] w-[72px] rounded-full object-cover ring-1 ring-white/10"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
            />
          )}
          <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-white [text-wrap:balance]">
            {fullName}
          </h1>
          {contactData.title && (
            <p className="mt-1.5 text-[15px] leading-tight text-[#A1A1AA]">{contactData.title}</p>
          )}
          {contactData.organization && (
            <p className="mt-1.5 text-[15px] leading-tight text-[#A1A1AA]">{contactData.organization}</p>
          )}
          {contactData.bio && (
            <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-[#D4D4D8]">
              {contactData.bio}
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={handleSaveContact}
          className="mt-8 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#FAFAFA] text-[15px] font-semibold leading-none text-[#0B0B0C] transition-colors hover:bg-white active:bg-[#E4E4E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-soft"
        >
          <Download className="h-[18px] w-[18px]" aria-hidden="true" />
          Save contact
        </button>

        <div
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${secondaryCount}, minmax(0, 1fr))` }}
        >
          {telHref && (
            <a href={telHref} className={SECONDARY_ACTION_CLASS}>
              <Phone className="h-5 w-5 text-cta-soft" aria-hidden="true" />
              <span>Call</span>
            </a>
          )}
          {mailHref && (
            <a href={mailHref} className={SECONDARY_ACTION_CLASS}>
              <Mail className="h-5 w-5 text-cta-soft" aria-hidden="true" />
              <span>Email</span>
            </a>
          )}
          <button type="button" onClick={handleShare} className={SECONDARY_ACTION_CLASS}>
            <Share2 className="h-5 w-5 text-cta-soft" aria-hidden="true" />
            <span>Share</span>
          </button>
        </div>

        {(telHref || mailHref || contactData.url) && (
          <nav className="mt-8" aria-label="Contact details">
            {telHref && (
              <a href={telHref} className={ROW_CLASS}>
                <span className="min-w-0">
                  <span className="block text-xs leading-tight text-[#71717A]">Phone</span>
                  <span className="mt-1 block text-[15px] leading-snug text-[#FAFAFA] [overflow-wrap:anywhere]">
                    {formatPhoneDisplay(contactData.cellPhone)}
                  </span>
                </span>
                <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-[#52525B] transition-colors group-hover:text-cta-soft" aria-hidden="true" />
              </a>
            )}
            {mailHref && (
              <a href={mailHref} className={ROW_CLASS}>
                <span className="min-w-0">
                  <span className="block text-xs leading-tight text-[#71717A]">Email</span>
                  <span className="mt-1 block text-[15px] leading-snug text-[#FAFAFA] [overflow-wrap:anywhere]">
                    {contactData.email}
                  </span>
                </span>
                <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-[#52525B] transition-colors group-hover:text-cta-soft" aria-hidden="true" />
              </a>
            )}
            {contactData.url && (
              <a href={contactData.url} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
                <span className="min-w-0">
                  <span className="block text-xs leading-tight text-[#71717A]">Website</span>
                  <span className="mt-1 block text-[15px] leading-snug text-[#FAFAFA] [overflow-wrap:anywhere]">
                    {websiteDisplay}
                  </span>
                </span>
                <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-[#52525B] transition-colors group-hover:text-cta-soft" aria-hidden="true" />
              </a>
            )}
          </nav>
        )}

        {socialLinks.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {socialLinks.map((social, idx) => (
              <a
                key={idx}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.platform}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/5 text-[#D4D4D8] transition-colors hover:bg-cta/15 hover:text-white focus-visible:bg-cta/15 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-soft"
              >
                {getSocialIcon(social.platform)}
              </a>
            ))}
          </div>
        )}

        {contactData.couponCode && contactData.couponAmount && (
          <section className="mt-6 rounded-xl p-4" style={{ border: "1px solid rgba(81,115,214,0.4)" }}>
            <p className="text-xs font-medium leading-none text-cta-soft">Exclusive offer</p>
            <p className="mt-2 text-2xl font-semibold leading-[1.1] tracking-[-0.01em] text-white">
              {contactData.couponAmount}
            </p>
            <span className="mt-3 inline-block rounded-lg border border-white/10 bg-white/[0.08] px-2.5 py-1.5 font-mono text-[13px] font-medium leading-none tracking-[0.06em] text-[#FAFAFA]">
              {contactData.couponCode}
            </span>
          </section>
        )}

        <section className="mt-10 flex flex-col items-center">
          <p className="mb-3.5 text-center text-[13px] leading-tight text-[#71717A]">
            Show this code to share my card
          </p>
          <div
            className="h-[148px] w-[148px] rounded-lg bg-white p-3"
            role="img"
            aria-label={`QR code: ${window.location.href}`}
          >
            <QRCode
              value={window.location.href}
              fgColor="#111111"
              bgColor="#FFFFFF"
              style={{ display: "block", height: "100%", width: "100%" }}
              aria-hidden="true"
            />
          </div>
        </section>

        <footer className="mb-8 mt-10 text-center text-[13px] leading-none">
          <a href={footerHref} className="text-[#52525B] transition-colors hover:text-[#D4D4D8]">
            {footerHost}
          </a>
        </footer>
      </motion.main>
    </div>
  );
}
