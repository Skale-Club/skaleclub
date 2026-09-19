import { useEffect } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  NFC_QUANTITY,
  quantityFromSliderPosition,
  sliderPositionFromQuantity,
  snapQuantity,
} from "@shared/nfc-pricing";

// Radix works in integers, so the 0..1 curve position is carried as 0..1000.
const TRACK_RESOLUTION = 1000;

/**
 * Quantity picker on an exponential track: most of the travel sits at the low
 * end, where nearly every order lands, and the top end compresses. The +/-
 * buttons give exact single-step control the drag can't offer up there.
 */
export function QuantitySliderInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (quantity: number) => void;
}) {
  const { t } = useTranslation();
  const parsed = Number.parseInt(value, 10);
  const hasValue = Number.isFinite(parsed);
  const quantity = hasValue ? snapQuantity(parsed) : NFC_QUANTITY.min;

  // Land on the minimum so the step is answerable by pressing Next, and so the
  // price panel has something to show the moment the question opens.
  useEffect(() => {
    if (!hasValue) onChange(NFC_QUANTITY.min);
  }, [hasValue, onChange]);

  const setQuantity = (next: number) => {
    const snapped = snapQuantity(next);
    if (snapped !== quantity) onChange(snapped);
  };

  const atMin = quantity <= NFC_QUANTITY.min;
  const atMax = quantity >= NFC_QUANTITY.max;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-4">
        <StepButton
          direction="down"
          disabled={atMin}
          label={t("Fewer pieces")}
          onClick={() => setQuantity(quantity - NFC_QUANTITY.step)}
        />
        <div className="min-w-[7rem] text-center">
          <span
            className="block text-5xl font-bold tabular-nums text-slate-900"
            data-testid="input-quantity-value"
          >
            {quantity}
          </span>
          <span className="text-sm text-slate-500">{t("pieces")}</span>
        </div>
        <StepButton
          direction="up"
          disabled={atMax}
          label={t("More pieces")}
          onClick={() => setQuantity(quantity + NFC_QUANTITY.step)}
        />
      </div>

      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center py-2"
        value={[Math.round(sliderPositionFromQuantity(quantity) * TRACK_RESOLUTION)]}
        min={0}
        max={TRACK_RESOLUTION}
        step={1}
        onValueChange={([position]) => setQuantity(quantityFromSliderPosition(position / TRACK_RESOLUTION))}
        aria-label={t("Quantity")}
        aria-valuetext={`${quantity} ${t("pieces")}`}
        data-testid="input-quantity-slider"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
          <SliderPrimitive.Range className="absolute h-full bg-cta" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-[3px] border-cta bg-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-2" />
      </SliderPrimitive.Root>

      <div className="flex justify-between text-xs font-medium text-slate-400">
        <span>{NFC_QUANTITY.min}</span>
        <span>{NFC_QUANTITY.max}</span>
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
