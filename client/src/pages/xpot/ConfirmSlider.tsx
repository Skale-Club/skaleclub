import { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfirmSlider({
  label,
  helperText,
  loading,
  disabled,
  onConfirm,
  accentClassName,
}: {
  label: string;
  helperText: string;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  accentClassName?: string;
}) {
  const [value, setValue] = useState([0]);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      hasTriggeredRef.current = false;
      setValue([0]);
    }
  }, [loading, label]);

  const progress = value[0] || 0;

  return (
    <div className="space-y-2">
      <div className="relative rounded-full border border-[#1C53A3]/30 bg-[#0c1a2e] p-[5px]">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full bg-[#1C53A3]/30 transition-[width] duration-200", accentClassName)}
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-semibold tracking-[0.16em] text-white">
          {loading ? "PROCESSING..." : label}
        </div>
        <SliderPrimitive.Root
          value={value}
          max={100}
          step={1}
          disabled={disabled || loading}
          onValueChange={(next) => {
            setValue(next);
            if (next[0] >= 96 && !hasTriggeredRef.current && !disabled && !loading) {
              hasTriggeredRef.current = true;
              onConfirm();
            }
          }}
          onValueCommit={(next) => {
            if (next[0] < 96) {
              setValue([0]);
            }
          }}
          className="relative flex h-[44px] w-full touch-none select-none items-center"
        >
          <SliderPrimitive.Track className="relative h-[44px] w-full rounded-full bg-transparent">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-transparent" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[#1C53A3] text-white shadow-[0_12px_35px_rgba(28,83,163,0.4)] outline-none ring-0 transition-transform focus-visible:scale-105 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
          </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
      </div>
      <div className="text-center text-xs text-white/45">{helperText}</div>
    </div>
  );
}
