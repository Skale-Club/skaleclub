import { useEffect } from "react";
import { Check } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "@/hooks/useTranslation";
import { formatUsdCentsFor } from "@shared/nfc-pricing";
import { activeOrderTypes, type OrderCatalog, type OrderProductType } from "@shared/order-catalog";

/**
 * Product type cards (keychain styles, plaque models), priced from the form's
 * catalogue (shared/order-catalog.ts) rather than from the form config — one
 * catalogue, one set of numbers.
 *
 * While a single type is active it is selected automatically, so the step
 * becomes a one-glance confirmation instead of a forced click. Adding types to
 * the catalogue turns it into a real choice with no change here.
 */
export function ProductPickerInput({
  catalog,
  value,
  quantity,
  onChange,
}: {
  catalog: OrderCatalog;
  value: string;
  /** Chosen quantity when the type step runs after it; the minimum otherwise. */
  quantity?: number;
  onChange: (typeId: string) => void;
}) {
  const { t, language } = useTranslation();
  const types = activeOrderTypes(catalog);
  const onlyType = types.length === 1 ? types[0] : null;

  useEffect(() => {
    if (onlyType && value !== onlyType.id) onChange(onlyType.id);
  }, [onlyType, value, onChange]);

  return (
    <div className="grid grid-cols-1 gap-3">
      {types.map((type) => (
        <TypeCard
          key={type.id}
          catalog={catalog}
          type={type}
          quantity={quantity}
          selected={value === type.id}
          soleOption={Boolean(onlyType)}
          onSelect={() => onChange(type.id)}
          priceLabel={t}
          formatPrice={formatUsdCentsFor(language)}
        />
      ))}
    </div>
  );
}

function TypeCard({
  catalog,
  type,
  quantity,
  selected,
  soleOption,
  onSelect,
  priceLabel: t,
  formatPrice: formatUsdCents,
}: {
  catalog: OrderCatalog;
  type: OrderProductType;
  quantity?: number;
  selected: boolean;
  soleOption: boolean;
  onSelect: () => void;
  priceLabel: (key: string) => string;
  formatPrice: (cents: number) => string;
}) {
  // Before a quantity exists the card quotes the entry price, hence "from".
  const knownQuantity = typeof quantity === "number" && Number.isFinite(quantity);
  const quote = catalog.quote({
    quantity: knownQuantity ? quantity! : catalog.quantity.min,
    typeId: type.id,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-4 text-left shadow-sm transition-all",
        selected ? "border-cta bg-cta/10 shadow-md" : "border-slate-200 hover:border-cta/70 hover:bg-slate-50",
      )}
      data-testid={`button-${catalog.model}-type-${type.id}`}
    >
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{t(type.label)}</p>
        <p className="mt-0.5 text-sm text-slate-500">{t(type.description)}</p>
        {quote.quoteOnRequest ? (
          <p className="mt-1.5 text-sm font-medium text-slate-700">{t("Price confirmed on WhatsApp")}</p>
        ) : type.priceSummary ? (
          <p className="mt-1.5 text-sm font-medium text-slate-700 tabular-nums">{t(type.priceSummary)}</p>
        ) : (
          <p className="mt-1.5 text-sm font-medium text-slate-700 tabular-nums">
            {!knownQuantity && `${t("from")} `}
            {formatUsdCents(quote.effectiveUnitPriceCents)}
            <span className="font-normal text-slate-500">{` / ${t(catalog.unit.singular)}`}</span>
          </p>
        )}
      </div>
      {selected && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cta text-white">
          <Check className="h-4 w-4" />
        </span>
      )}
      {soleOption && !selected && <span className="sr-only">{t("Selected")}</span>}
    </button>
  );
}
