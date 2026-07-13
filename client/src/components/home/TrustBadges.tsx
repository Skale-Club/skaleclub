import { Star, Shield, Clock, Sparkles, Heart, BadgeCheck, ThumbsUp, Trophy, Zap, Rocket, Users, Award } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";

type TrustBadge = NonNullable<HomepageContent["trustBadges"]>[number];

interface TrustBadgesProps {
  badges: TrustBadge[];
}

const badgeIconMap: Record<string, React.ComponentType<any>> = {
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
    <div className="relative z-20 bg-[#111111] rounded-2xl shadow-xl border border-white/10 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">
      {badges.map((feature, i) => {
        const iconKey = (feature.icon || '').toLowerCase();
        const Icon = badgeIconMap[iconKey] || badgeIconMap.star || Star;
        return (
          <div key={i} className="p-8 flex items-center gap-6 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 bg-white/10 text-blue-300 rounded-full flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-white">{t(feature.title)}</p>
              <p className="text-sm text-slate-400">{t(feature.description)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
