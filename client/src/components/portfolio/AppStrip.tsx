import { ArrowUpRight } from "lucide-react";
import type { CatalogItem } from "@shared/catalog";
import { useTranslation } from "@/hooks/useTranslation";
import { getImageUrl } from "@/components/admin/shared/utils";
import { AppHeadline, AppPrice } from "./AppParts";

/**
 * Every app's mark in one hairline row. On hover (pointer devices only) the
 * mark blurs behind a ↗ disc and a card rises above the cell with the pitch;
 * a click or tap always opens the detail popup.
 */
export function AppStrip({ apps, onOpen }: { apps: CatalogItem[]; onOpen: (item: CatalogItem) => void }) {
  const { t } = useTranslation();
  if (apps.length === 0) return null;
  const last = apps.length - 1;

  return (
    <div className="pf-strip container-custom container-page mx-auto">
      <div className="pf-strip__label">{t("Apps we build and run")}</div>
      <div className="pf-strip__grid">
        {apps.map((item, i) => {
          const edge = i < 2 ? "pf-strip__cell--start" : i > last - 2 ? "pf-strip__cell--end" : "";
          return (
            <button key={item.key} type="button" className={`pf-strip__cell ${edge}`} onClick={() => onOpen(item)} aria-label={item.title}>
              <ArrowUpRight className="pf-strip__corner" aria-hidden="true" />
              <span className="pf-strip__mark" aria-hidden="true">
                {item.logo && <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" loading="lazy" />}
                <span>{item.title}</span>
              </span>
              <span className="pf-strip__disc" aria-hidden="true"><ArrowUpRight /></span>

              <span className="pf-strip__card" aria-hidden="true">
                <span className="pf-strip__card-name">
                  {item.logo && <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" loading="lazy" />}
                  {item.title}
                </span>
                <AppHeadline item={item} className="pf-strip__card-title" />
                {item.description && <span className="pf-strip__card-desc">{t(item.description)}</span>}
                <span className="pf-strip__card-foot">
                  <AppPrice item={item} className="pf-strip__card-price" />
                  <span className="pf-strip__card-go">{t("See details")} →</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
