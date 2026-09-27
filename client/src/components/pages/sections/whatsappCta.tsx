import { z } from "zod";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { whatsappHref } from "@shared/nfc-whatsapp";

// Optional "Talk to us on WhatsApp" link shared by landing sections.
//
// `messages` holds the pre-filled text per language and is picked by the page
// language directly — never through t(). The WhatsApp line routes by keywords
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
  /** "button" = outlined pill next to a primary CTA; "link" = quiet text link. */
  variant: "button" | "link";
}) {
  const { t, language } = useTranslation();
  const message = language === "pt" ? cta.messages.pt : cta.messages.en;
  const label = t(cta.label ?? DEFAULT_LABEL);

  const className =
    variant === "button"
      ? "inline-flex w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.04] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-white/10"
      : "inline-flex items-center gap-2 text-sm font-semibold text-[#B4C0D8] underline-offset-4 transition-colors hover:text-white hover:underline";

  return (
    <a
      href={whatsappHref(cta.number, message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("click_whatsapp", { location, label })}
      data-testid={`link-whatsapp-${location}`}
      className={className}
    >
      <MessageCircle aria-hidden="true" className={variant === "button" ? "h-5 w-5" : "h-4 w-4"} />
      {label}
    </a>
  );
}
