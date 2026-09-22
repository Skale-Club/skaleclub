import { CATALOG_CATEGORY_LABEL, type CatalogItem } from "@shared/catalog";
import { useTranslation } from "@/hooks/useTranslation";
import { getImageUrl } from "@/components/admin/shared/utils";
import { Cover } from "@/components/catalog/Cover";
import { AppHeadline, AppPrice } from "./AppParts";

/**
 * One open block per app: no outer card, a hairline between blocks, the text
 * beside a single large screen on a gradient panel. Sides alternate.
 */
export function AppBlocks({ apps, onOpen }: { apps: CatalogItem[]; onOpen: (item: CatalogItem) => void }) {
  const { t } = useTranslation();

  return (
    <div className="pf-apps">
      {apps.map((item, i) => {
        const eyebrow = item.category ? t(CATALOG_CATEGORY_LABEL[item.category]) : undefined;
        return (
          <button
            key={item.key}
            type="button"
            className={`pf-app ${i % 2 === 1 ? "pf-app--flip" : ""}`}
            onClick={() => onOpen(item)}
          >
            <span className="pf-app__text">
              <span className="pf-app__eyebrow">
                {eyebrow}
                {item.badge && <span className="pf-app__badge">{t(item.badge)}</span>}
              </span>
              <span className="pf-app__name">
                {item.logo && <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" loading="lazy" />}
                <span>{item.title}</span>
              </span>
              <h3 className="pf-app__headline"><AppHeadline item={item} /></h3>
              {item.description && <span className="pf-app__desc">{t(item.description)}</span>}
              <span className="pf-app__foot">
                <AppPrice item={item} className="pf-app__price" />
                <span className="pf-app__go">{t("See details")} <span aria-hidden="true">→</span></span>
              </span>
            </span>

            <span className="pf-app__media" aria-hidden="true">
              {item.cover ? (
                <span className="pf-app__screen">
                  <img src={getImageUrl(item.cover, { width: 1200, quality: 80 })} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <Cover item={item} className="pf-app__screen" width={1200} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
