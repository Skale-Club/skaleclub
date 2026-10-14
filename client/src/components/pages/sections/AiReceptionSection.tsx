import type { z } from "zod";
import { PhoneCall } from "lucide-react";
import { SiFacebook, SiImessage, SiInstagram, SiMessenger, SiWhatsapp } from "react-icons/si";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import { Band, PillLink } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";
import { aiReceptionPropsSchema } from "@shared/section-definitions";

type AiReceptionProps = z.infer<typeof aiReceptionPropsSchema>;
type ChannelIcon = LucideIcon | IconType;

const CHANNEL_ICONS: Record<AiReceptionProps["channels"][number]["icon"], ChannelIcon> = {
  phone: PhoneCall,
  facebook: SiFacebook,
  instagram: SiInstagram,
  whatsapp: SiWhatsapp,
  imessage: SiImessage,
  messenger: SiMessenger,
  messages: SiMessenger,
};

export function AiReceptionSection({ props }: { props: AiReceptionProps }) {
  const { t } = useTranslation();
  const dark = props.theme !== "light";
  const bandTone = props.bandTone ?? (dark ? "dark" : "cream");
  const imageLeft = props.imagePosition === "left";

  const content = (
    <div className={imageLeft ? "lg:order-2" : undefined}>
      <SectionHeading
        variant="editorial"
        tone={dark ? "dark" : "light"}
        eyebrow={props.eyebrow}
        title={props.heading}
        subtitle={props.subheading}
        className="[&_h2]:text-3xl sm:[&_h2]:text-4xl [&_h2]:leading-[1.08] [&_p:last-child]:mt-3 [&_p:last-child]:text-base [&_p:last-child]:leading-6"
      />

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {props.channels.map((channel) => {
          const icons = channel.icons?.length ? channel.icons : [channel.icon];
          return (
            <li
              key={`${channel.icon}-${channel.title}`}
              className={`flex h-full flex-col rounded-2xl border p-4 ${
                dark ? "border-white/10 bg-white/[0.035]" : "border-ink-700/10 bg-white"
              }`}
            >
              <h3 className={`font-display text-base font-semibold ${dark ? "text-fog-50" : "text-ink"}`}>
                {t(channel.title)}
              </h3>
              <p className={`mt-2 text-sm leading-6 ${dark ? "text-fog-400" : "text-ink-500"}`}>
                {t(channel.description)}
              </p>
              {channel.actionLabel && channel.actionHref ? (
                <div className="mt-auto pt-5">
                  <PillLink
                    href={channel.actionHref}
                    variant="ghost"
                    size="sm"
                    tone={dark ? "dark" : "light"}
                    className="min-h-16 max-w-full justify-start gap-3 px-5 py-3 text-left"
                    onClick={() => trackEvent("click_call", { location: "ai-reception-card" })}
                  >
                    <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex min-w-0 flex-col items-start leading-tight">
                      <span>{t(channel.actionLabel)}</span>
                      {channel.actionNote ? (
                        <span className={`mt-1 text-xs font-normal ${dark ? "text-fog-400" : "text-ink-500"}`}>
                          {t(channel.actionNote)}
                        </span>
                      ) : null}
                    </span>
                  </PillLink>
                </div>
              ) : (
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5" aria-hidden="true">
                  {icons.map((iconName) => {
                    const Icon = CHANNEL_ICONS[iconName];
                    return (
                      <span
                        key={iconName}
                        className={`grid h-8 w-8 place-items-center rounded-full ${dark ? "bg-white/5 text-cta-soft" : "bg-cta-ink/10 text-cta-ink"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  const media = props.imageUrl ? (
    <figure className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border lg:aspect-auto lg:max-w-[460px] lg:self-stretch ${imageLeft ? "lg:order-1 lg:justify-self-start" : "lg:justify-self-end"} ${dark ? "border-white/10 bg-navy-800 shadow-xl" : "border-ink-700/10 bg-white shadow-lg"}`}>
      <img
        src={props.imageUrl}
        alt={t(props.imageAlt ?? "")}
        width={props.imageWidth}
        height={props.imageHeight}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        sizes="(min-width: 1024px) 50vw, 100vw"
      />
    </figure>
  ) : null;

  return (
    <div data-testid="section-ai-reception">
      <Band tone={bandTone}>
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-12">
          {content}
          {media}
        </div>
      </Band>
    </div>
  );
}
