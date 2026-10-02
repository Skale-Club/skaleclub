import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * A portfolio section heading, plus the "See all" link that takes the
 * /portfolio umbrella into that category's own page. Without `seeAllHref`
 * (the category pages themselves) it renders the heading alone.
 */
export function SectionHeadingRow({ seeAllHref, children }: { seeAllHref?: string; children: ReactNode }) {
  const { t } = useTranslation();
  if (!seeAllHref) return <>{children}</>;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
      {children}
      <PillLink href={seeAllHref} variant="ghost">
        {t("See all")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </PillLink>
    </div>
  );
}
