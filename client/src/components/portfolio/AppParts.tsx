import { headlineParts, type CatalogItem } from "@shared/catalog";
import { useTranslation } from "@/hooks/useTranslation";

/** An app's benefit title with its **highlight**; falls back to the subtitle. */
export function AppHeadline({ item, className = "" }: { item: CatalogItem; className?: string }) {
  const { t } = useTranslation();
  const source = item.headline ?? item.subtitle;
  if (!source) return null;
  return (
    <span className={className}>
      {headlineParts(t(source)).map((part, i) =>
        part.highlight ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>,
      )}
    </span>
  );
}

/** "$49 /month", or "Start here" for an app without a price. */
export function AppPrice({ item, className = "" }: { item: CatalogItem; className?: string }) {
  const { t } = useTranslation();
  if (!item.price) return <span className={className}>{t("Start here")}</span>;
  return (
    <span className={className}>
      {item.price.value}
      {item.price.label && <small>{t(item.price.label)}</small>}
    </span>
  );
}
