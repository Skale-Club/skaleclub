import { z } from "zod";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { whatsappHref } from "@shared/nfc-whatsapp";
import { PillLink } from "@/components/editorial";

// Optional "Talk to us on WhatsApp" link shared by landing sections.
//
// `messages` holds the pre-filled text per language and is picked by the page
// language directly, never through t(). The WhatsApp line routes by keywords
// in that first message (see shared/nfc-whatsapp.ts), and a machine-translated
// fallback could drop the keyword. The button label does go through t().
export const whatsappCtaSchema = z
  .object({
    number: z.string().regex(/^\+?[0-9 ()-]{8,20}$/, "WhatsApp number, digits with country code"),
    label: z.string().optional(),
    messages: z.object({ en: z.string().min(1), pt: z.string().min(1) }),
  })
  .optional();
export type WhatsappCta = z.infer<typeof whatsappCtaSchema>;

const DEFAULT_LABEL = "Talk to us on WhatsApp";

export function WhatsappCtaLink({
  cta,
  location,
  variant,
}: {
  cta: NonNullable<WhatsappCta>;
  /** Analytics location, e.g. "nfc_closing_cta". */
  location: string;
  /** "button" = ghost pill next to a primary CTA; "link" = quiet text link. */
  variant: "button" | "link";
}) {
  const { t, language } = useTranslation();
  const message = language === "pt" ? cta.messages.pt : cta.messages.en;
  const label = t(cta.label ?? DEFAULT_LABEL);
  const href = whatsappHref(cta.number, message);
  const onClick = () => trackEvent("click_whatsapp", { location, label });
  const testId = `link-whatsapp-${location}`;

  if (variant === "button") {
    return (
      <PillLink
        href={href}
        target="_blank"
        variant="ghost"
        onClick={onClick}
        data-testid={testId}
        className="w-full whitespace-nowrap sm:w-auto"
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        {label}
      </PillLink>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex items-center gap-2 text-sm font-semibold text-fog-400 underline-offset-4 transition-colors hover:text-white hover:underline"
    >
      <MessageCircle aria-hidden="true" className="h-4 w-4" />
      {label}
    </a>
  );
}
