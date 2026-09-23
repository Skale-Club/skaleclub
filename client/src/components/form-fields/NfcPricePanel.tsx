import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatUsdCents, type NfcQuote } from "@shared/nfc-pricing";

/**
 * The running quote shown under the type and quantity steps.
 *
 * Display only — the number that counts is recomputed server-side when the
 * order is submitted, so nothing here can change what is actually charged.
 */
export function NfcPricePanel({
  quote,
  onApplyUpgrade,
}: {
  quote: NfcQuote;
  onApplyUpgrade?: (quantity: number) => void;
}) {
  const { t } = useTranslation();

  // Relief and custom shapes are priced by hand: no number, just what happens next.
  if (quote.quoteOnRequest) {
    return (
      <div className="rounded-2xl border border-cta/20 bg-cta/5 p-4" data-testid="nfc-price-panel">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-slate-600">{t(quote.typeLabel)}</span>
          <span className="text-sm font-medium text-slate-900 tabular-nums">
            {quote.quantity} {t("pieces")}
          </span>
        </div>
        <p className="mt-3 border-t border-cta/15 pt-3 text-base font-semibold text-slate-900" data-testid="nfc-price-total">
          {t("Price confirmed on WhatsApp")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("Custom pieces are priced one by one. After you send the form, we reply on WhatsApp with the total before anything is produced.")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cta/20 bg-cta/5 p-4" data-testid="nfc-price-panel">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{t("Estimated total")}</span>
        <span className="text-3xl font-bold text-slate-900 tabular-nums" data-testid="nfc-price-total">
          {formatUsdCents(quote.totalCents)}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-cta/15 pt-3 text-sm">
        <div className="flex justify-between gap-3">
          {/* When the tier cap is in play the effective unit price does not
              divide evenly (90 pieces at $800 is $8.888...), so showing
              "90 x $8.89" would not add up to the subtotal beside it. Only
              spell out the multiplication when it actually multiplies. */}
          <dt className="text-slate-600">
            {quote.quantity} {t("pieces")}
            {!quote.upgrade && ` × ${formatUsdCents(quote.effectiveUnitPriceCents)}`}
          </dt>
          <dd className="font-medium text-slate-900 tabular-nums">{formatUsdCents(quote.subtotalCents)}</dd>
        </div>
        {quote.artFeeApplies && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">{t("Art fee (first order only)")}</dt>
            <dd className="font-medium text-slate-900 tabular-nums">{formatUsdCents(quote.artFeeCents)}</dd>
          </div>
        )}
      </dl>

      {quote.upgrade && (
        <button
          type="button"
          onClick={() => onApplyUpgrade?.(quote.upgrade!.quantity)}
          disabled={!onApplyUpgrade}
          className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-cta/30 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-cta hover:bg-cta/5 disabled:cursor-default disabled:hover:border-cta/30 disabled:hover:bg-white"
          data-testid="nfc-price-upgrade"
        >
          <span className="text-slate-700">
            {t("Take")} <strong className="text-slate-900">{quote.upgrade.quantity} {t("pieces")}</strong>{" "}
            {t("for the same price")}
          </span>
          {onApplyUpgrade && <ArrowUpRight className="h-4 w-4 shrink-0 text-cta" />}
        </button>
      )}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {t("Estimate only — we confirm the final total with you before anything is produced.")}
      </p>
    </div>
  );
}
