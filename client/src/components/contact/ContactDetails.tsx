import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EditorialCard, Eyebrow, PillLink } from "@/components/editorial";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "@/hooks/useTranslation";
import { defaultWhatsappMessage, formatPhoneDisplay, telHref, whatsappHref } from "@shared/phone";

interface ContactDetailsProps {
  phone: string;
  email: string;
  address: string;

}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

interface DayHours { isOpen?: boolean; start?: string; end?: string }

/** Groups consecutive days that share hours: [["monday","friday","09:00 - 17:00"], ...]. */
function groupHours(hours: unknown): { from: (typeof DAYS)[number]; to: (typeof DAYS)[number]; range: string }[] {
  if (!hours || typeof hours !== "object") return [];
  const map = hours as Record<string, DayHours | undefined>;
  const groups: { from: (typeof DAYS)[number]; to: (typeof DAYS)[number]; range: string }[] = [];
  for (const day of DAYS) {
    const d = map[day];
    if (!d?.isOpen || !d.start || !d.end) continue;
    const range = `${d.start} - ${d.end}`;
    const last = groups[groups.length - 1];
    if (last && last.range === range && DAYS.indexOf(last.to) === DAYS.indexOf(day) - 1) last.to = day;
    else groups.push({ from: day, to: day, range });
  }
  return groups;
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cta-ink" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">{label}</p>
        <div className="mt-1 font-medium text-ink">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetails({ phone, email, address }: ContactDetailsProps) {
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });
  const { t, language } = useTranslation();
  const linkClass = "hover:text-cta-ink hover:underline";
  const hours = groupHours(settings?.businessHours);
  const short: Record<(typeof DAYS)[number], string> = {
    monday: t("Mon"), tuesday: t("Tue"), wednesday: t("Wed"), thursday: t("Thu"),
    friday: t("Fri"), saturday: t("Sat"), sunday: t("Sun"),
  };
  return (
    <EditorialCard tone="light" accent>
      <Eyebrow tone="light">{t("Get in Touch")}</Eyebrow>
      <div className="mt-6 space-y-6">
        <Row icon={Phone} label={t("Call Us")}>
          {phone ? (
            <a
              href={telHref(phone)}
              onClick={() => trackEvent("click_call", { location: "contact", label: phone })}
              className={linkClass}
            >
              {formatPhoneDisplay(phone)}
            </a>
          ) : (
            <p className="text-ink-500">{t("Contact us for phone")}</p>
          )}
        </Row>
        <Row icon={Mail} label={t("Email Us")}>
          {email ? (
            <a
              href={`mailto:${email}`}
              onClick={() => trackEvent("click_email", { location: "contact_page", label: email })}
              className={`${linkClass} break-all`}
            >
              {email}
            </a>
          ) : (
            <p className="text-ink-500">{t("Contact us for email")}</p>
          )}
        </Row>
        <Row icon={MapPin} label={t("Visit Us")}>
          <p>{address || t("Contact us for address")}</p>
        </Row>
        {hours.length > 0 && (
          <Row icon={Clock} label={t("Business Hours")}>
            <ul className="space-y-0.5 text-sm">
              {hours.map((g) => (
                <li key={g.from}>
                  {g.from === g.to ? short[g.from] : `${short[g.from]} - ${short[g.to]}`}: {g.range}
                </li>
              ))}
            </ul>
          </Row>
        )}
      </div>
      {phone && (
        <PillLink
          href={whatsappHref(phone, defaultWhatsappMessage(language))}
          target="_blank"
          variant="primary"
          className="mt-8"
          onClick={() => trackEvent("click_whatsapp", { location: "contact" })}
        >
          <MessageCircle className="h-4 w-4" />
          {t("Talk on WhatsApp")}
        </PillLink>
      )}
    </EditorialCard>
  );
}
