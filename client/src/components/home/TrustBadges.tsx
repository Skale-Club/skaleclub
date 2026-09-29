import { Star, Shield, Clock, Sparkles, Heart, BadgeCheck, ThumbsUp, Trophy, Zap, Rocket, Users, Award } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { EditorialCard } from "@/components/editorial";

type TrustBadge = NonNullable<HomepageContent["trustBadges"]>[number];

interface TrustBadgesProps {
  badges: TrustBadge[];
}

export const badgeIconMap: Record<string, React.ComponentType<any>> = {
  star: Star,
  shield: Shield,
  clock: Clock,
  sparkles: Sparkles,
  heart: Heart,
  badgecheck: BadgeCheck,
  thumbsup: ThumbsUp,
  trophy: Trophy,
  zap: Zap,
  rocket: Rocket,
  users: Users,
  award: Award,
};

export function TrustBadges({ badges }: TrustBadgesProps) {
  const { t } = useTranslation();

  if (badges.length === 0) {
    return null;
  }

  return (
    <EditorialCard
      tone="dark"
      className="relative z-20 grid grid-cols-1 tablet:grid-cols-3 divide-y tablet:divide-y-0 tablet:divide-x divide-white/10 overflow-hidden p-0 sm:p-0 shadow-[0_24px_60px_rgba(0,0,0,.35)]"
    >
      {badges.map((feature, i) => {
        const iconKey = (feature.icon || '').toLowerCase();
        const Icon = badgeIconMap[iconKey] || badgeIconMap.star || Star;
        return (
          <div key={i} className="p-8 flex items-center gap-6">
            <Icon className="w-7 h-7 shrink-0 text-cta-soft" />
            <div>
              <p className="font-display font-semibold text-fog-50">{t(feature.title)}</p>
              <p className="text-sm text-fog-400">{t(feature.description)}</p>
            </div>
          </div>
        );
      })}
    </EditorialCard>
  );
}
