import { Handshake, Magnet, Target } from "lucide-react";
import { Band, EditorialCard } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";

/** The three things we solve. Page copy, not the home's trust badges. */
const PILLARS = [
  { icon: Target, title: "Prospect", desc: "Find the right businesses and reach them first" },
  { icon: Magnet, title: "Attract", desc: "Get found online and stay active where customers look" },
  { icon: Handshake, title: "Convert", desc: "Follow up, book and quote before the lead goes cold" },
] as const;

export function PortfolioPillars() {
  const { t } = useTranslation();
  return (
    <Band tone="cream">
      <SectionHeading variant="editorial" tone="light" eyebrow="What we solve" title="Three problems, one system" />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, desc }) => (
          <EditorialCard key={title} tone="light">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cta-ink/10 text-cta-ink ring-1 ring-inset ring-cta-ink/10">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-6 font-display text-2xl font-semibold text-ink">{t(title)}</h3>
            <p className="mt-3 text-sm leading-6 text-ink-500">{t(desc)}</p>
          </EditorialCard>
        ))}
      </div>
    </Band>
  );
}
