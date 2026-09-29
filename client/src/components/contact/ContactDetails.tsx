import { Mail, MapPin, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EditorialCard, Eyebrow } from "@/components/editorial";
import { trackEvent } from "@/lib/analytics";
import { useTranslation } from "@/hooks/useTranslation";

interface ContactDetailsProps {
  phone: string;
  email: string;
  address: string;
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-cta-ink" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{label}</p>
        <div className="mt-1 font-medium text-ink">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetails({ phone, email, address }: ContactDetailsProps) {
  const { t } = useTranslation();
  const linkClass = "hover:text-cta-ink hover:underline";
  return (
    <EditorialCard tone="light" accent>
      <Eyebrow tone="light">{t("Get in Touch")}</Eyebrow>
      <div className="mt-6 space-y-6">
        <Row icon={Phone} label={t("Call Us")}>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              onClick={() => trackEvent("click_call", { location: "contact_page", label: phone })}
              className={linkClass}
            >
              {phone}
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
      </div>
    </EditorialCard>
  );
}
