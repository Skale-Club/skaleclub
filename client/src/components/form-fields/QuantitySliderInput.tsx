import { useEffect } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { OrderCatalog } from "@shared/order-catalog";

// Radix works in integers, so the 0..1 curve position is carried as 0..1000.
const TRACK_RESOLUTION = 1000;

/**
 * Quantity picker. The track's curve comes from the catalogue: exponential for
 * keychains (most of the travel at the low end, where nearly every order
 * lands), linear for plaques. The +/- buttons give exact single-step control.
 */
export function QuantitySliderInput({
  catalog,
  value,
  onChange,
}: {
  catalog: OrderCatalog;
  value: string;
  onChange: (quantity: number) => void;
}) {
  const { t } = useTranslation();
  const parsed = Number.parseInt(value, 10);
  const hasValue = Number.isFinite(parsed);
  const { min, max, step } = catalog.quantity;
  const quantity = hasValue ? catalog.snapQuantity(parsed) : min;

  // Land on the minimum so the step is answerable by pressing Next, and so the
  // price panel has something to show the moment the question opens.
  useEffect(() => {
    if (!hasValue) onChange(min);
  }, [hasValue, onChange, min]);

  const setQuantity = (next: number) => {
    const snapped = catalog.snapQuantity(next);
    if (snapped !== quantity) onChange(snapped);
  };

  const atMin = quantity <= min;
  const atMax = quantity >= max;
  const unitLabel = t(quantity === 1 ? catalog.unit.singular : catalog.unit.plural);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-4">
        <StepButton
          direction="down"
          disabled={atMin}
          label={t(catalog.unit.fewer)}
          onClick={() => setQuantity(quantity - step)}
        />
        <div className="min-w-[7rem] text-center">
          <span
            className="block text-5xl font-bold tabular-nums text-slate-900"
            data-testid="input-quantity-value"
          >
            {quantity}
          </span>
          <span className="text-sm text-slate-500">{unitLabel}</span>
        </div>
        <StepButton
          direction="up"
          disabled={atMax}
          label={t(catalog.unit.more)}
          onClick={() => setQuantity(quantity + step)}
        />
      </div>

      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center py-2"
        value={[Math.round(catalog.positionFromQuantity(quantity) * TRACK_RESOLUTION)]}
        min={0}
        max={TRACK_RESOLUTION}
        step={1}
        onValueChange={([position]) => setQuantity(catalog.quantityFromPosition(position / TRACK_RESOLUTION))}
        aria-label={t("Quantity")}
        aria-valuetext={`${quantity} ${unitLabel}`}
        data-testid="input-quantity-slider"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
          <SliderPrimitive.Range className="absolute h-full bg-cta" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-[3px] border-cta bg-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-2" />
      </SliderPrimitive.Root>

      <div className="flex justify-between text-xs font-medium text-slate-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function StepButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? Plus : Minus;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-cta hover:text-cta disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
      data-testid={`button-quantity-${direction}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
