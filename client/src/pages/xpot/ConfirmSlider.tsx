import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two modes:
 *
 * Check-in (onCancel = undefined):
 *   thumb starts LEFT, drag RIGHT to confirm. Fill grows blue→green.
 *
 * Check-out (onCancel provided):
 *   thumb starts RIGHT (green = active), drag LEFT to confirm check-out.
 *   Fill shrinks and turns red as thumb approaches left.
 */
export function ConfirmSlider({
  label,
  helperText,
  loading,
  disabled,
  onConfirm,
  onCancel,
}: {
  label: string;
  helperText: string;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const isCheckOut = Boolean(onCancel);
  const startValue = isCheckOut ? 100 : 0;
  const [value, setValue] = useState(startValue);
  const hasTriggeredRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(startValue);

  useEffect(() => {
    if (!loading) {
      hasTriggeredRef.current = false;
      setValue(startValue);
    }
  }, [loading, startValue]);

  const THUMB = 44;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartValue.current = value;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || disabled || loading) return;
    const trackWidth = (trackRef.current?.getBoundingClientRect().width ?? 300) - THUMB;
    const dx = e.clientX - dragStartX.current;
    const delta = (dx / trackWidth) * 100;
    const next = Math.min(100, Math.max(0, dragStartValue.current + delta));
    setValue(next);

    if (!isCheckOut && next >= 96 && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onConfirm();
    }
    if (isCheckOut && next <= 4 && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onConfirm(); // check-out confirmed
    }
  }

  function onPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!hasTriggeredRef.current) {
      setValue(startValue);
    }
  }

  // Fill color
  // Check-in: left→right, blue → green
  // Check-out: right→left, green → red (fill shrinks)
  function getFillColor(v: number): string {
    if (!isCheckOut) {
      // 0–60: blue, 60–100: blue→green
      if (v <= 60) return "rgba(28, 83, 163, 0.4)";
      const t = (v - 60) / 40;
      const r = Math.round(28 + t * (22 - 28));
      const g = Math.round(83 + t * (163 - 83));
      const b = Math.round(163 + t * (59 - 163));
      return `rgba(${r}, ${g}, ${b}, 0.5)`;
    } else {
      // v=100→green, v=0→red
      const t = v / 100;
      const r = Math.round(239 + t * (22 - 239));
      const g2 = Math.round(68 + t * (163 - 68));
      const b = Math.round(68 + t * (59 - 68));
      return `rgba(${r}, ${g2}, ${b}, 0.4)`;
    }
  }

  function getThumbColor(v: number): string {
    if (!isCheckOut) {
      if (v <= 60) return "#1C53A3";
      const t = (v - 60) / 40;
      const r = Math.round(28 + t * (22 - 28));
      const g = Math.round(83 + t * (163 - 83));
      const b = Math.round(163 + t * (59 - 163));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const t = v / 100;
      const r = Math.round(239 + t * (22 - 239));
      const g2 = Math.round(68 + t * (163 - 68));
      const b = Math.round(68 + t * (59 - 68));
      return `rgb(${r}, ${g2}, ${b})`;
    }
  }

  const fillColor = getFillColor(value);
  const thumbColor = getThumbColor(value);
  const isSnapping = !isDragging.current && !hasTriggeredRef.current;

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className={cn(
          "relative rounded-full border border-white/10 bg-[#0c1a2e] select-none cursor-grab active:cursor-grabbing",
          (disabled || loading) && "opacity-50 cursor-not-allowed",
        )}
        style={{ height: THUMB + 10, padding: 5 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* fill bar */}
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: 0,
            width: `${value}%`,
            background: fillColor,
            transition: isSnapping ? "width 0.25s, background-color 0.25s" : "none",
          }}
        />

        {/* label */}
        <div className="absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-semibold tracking-[0.16em] text-white pointer-events-none">
          {loading ? "PROCESSING..." : label}
        </div>

        {/* thumb */}
        <div
          className="absolute top-[5px] flex items-center justify-center rounded-full text-white shadow-lg pointer-events-none"
          style={{
            width: THUMB,
            height: THUMB,
            left: `calc(${value / 100} * (100% - ${THUMB}px))`,
            background: thumbColor,
            transition: isSnapping ? "left 0.25s, background-color 0.25s" : "none",
          }}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : isCheckOut
              ? <ChevronLeft className="h-5 w-5" />
              : <ChevronRight className="h-5 w-5" />
          }
        </div>
      </div>
      <div className="text-center text-xs text-white/45">{helperText}</div>
    </div>
  );
}
