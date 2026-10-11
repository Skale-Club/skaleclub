import type { z } from "zod";
import { ArrowRight, MessageCircle, PhoneCall } from "lucide-react";
import { SiInstagram, SiWhatsapp } from "react-icons/si";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import { Band, PillButton, PillLink } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import { trackCTAClick, trackEvent } from "@/lib/analytics";
import { requestLeadFormOpen } from "@/lib/leadForm";
import { aiReceptionPropsSchema } from "@shared/section-definitions";

type AiReceptionProps = z.infer<typeof aiReceptionPropsSchema>;
type ChannelIcon = LucideIcon | IconType;

const CHANNEL_ICONS: Record<AiReceptionProps["channels"][number]["icon"], ChannelIcon> = {
  phone: PhoneCall,
  instagram: SiInstagram,
  whatsapp: SiWhatsapp,
  messages: MessageCircle,
};

export function AiReceptionSection({ props }: { props: AiReceptionProps }) {
  const { t } = useTranslation();
  const dark = props.theme !== "light";
  const imageLeft = props.imagePosition === "left";
  const ctaLabel = props.ctaLabel ?? "Get my AI receptionist";

  const content = (
    <div className={imageLeft ? "lg:order-2" : undefined}>
      <SectionHeading
        variant="editorial"
        tone={dark ? "dark" : "light"}
        eyebrow={props.eyebrow}
        title={props.heading}
        subtitle={props.subheading}
      />

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {props.channels.map((channel) => {
          const Icon = CHANNEL_ICONS[channel.icon];
          return (
            <li
              key={`${channel.icon}-${channel.title}`}
              className={`rounded-2xl border p-5 ${
                dark ? "border-white/10 bg-white/[0.035]" : "border-ink-700/10 bg-white"
              }`}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${dark ? "bg-white/5 text-cta-soft" : "bg-cta-ink/10 text-cta-ink"}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className={`mt-4 font-display text-lg font-semibold ${dark ? "text-fog-50" : "text-ink"}`}>
                {t(channel.title)}
              </h3>
              <p className={`mt-2 text-sm leading-6 ${dark ? "text-fog-400" : "text-ink-500"}`}>
                {t(channel.description)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <PillButton
          variant="primary"
          data-floating-lead-inline
          onClick={() => {
            requestLeadFormOpen("ai-reception");
            trackCTAClick("ai-reception", ctaLabel);
          }}
          className="w-full sm:w-auto"
        >
          {t(ctaLabel)}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </PillButton>
        {props.demoLabel && props.demoHref ? (
          <div>
            <PillLink
              href={props.demoHref}
              variant="ghost"
              tone={dark ? "dark" : "light"}
              className="w-full sm:w-auto"
              onClick={() => trackEvent("click_call", { location: "ai-reception" })}
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              {t(props.demoLabel)}
            </PillLink>
            {props.demoNote ? (
              <p className={`mt-2 px-2 text-xs leading-5 ${dark ? "text-fog-400" : "text-ink-500"}`}>
                {t(props.demoNote)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const media = props.imageUrl ? (
    <figure className={`overflow-hidden rounded-3xl border ${imageLeft ? "lg:order-1" : undefined} ${dark ? "border-white/10 bg-navy-800 shadow-2xl" : "border-ink-700/10 bg-white shadow-xl"}`}>
      <img
        src={props.imageUrl}
        alt={t(props.imageAlt ?? "")}
        width={props.imageWidth}
        height={props.imageHeight}
        loading="lazy"
        decoding="async"
        className="aspect-[3/2] h-full w-full object-cover"
        sizes="(min-width: 1024px) 50vw, 100vw"
      />
    </figure>
  ) : null;

  return (
    <div data-testid="section-ai-reception">
      <Band tone={dark ? "dark" : "cream"}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {content}
          {media}
        </div>
      </Band>
    </div>
  );
}
