import { useEffect, useRef, useState } from "react";
import { ChevronsRight, ChevronsLeft, Loader2 } from "lucide-react";
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
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(startValue);

  useEffect(() => {
    if (!loading) {
      hasTriggeredRef.current = false;
      setValue(startValue);
    }
  }, [loading, startValue]);

  const THUMB = 48;
  const PADDING = 4;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartValue.current = value;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || disabled || loading) return;
    const trackWidth = (trackRef.current?.getBoundingClientRect().width ?? 300) - THUMB - PADDING * 2;
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
      onConfirm();
    }
  }

  function onPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    if (!hasTriggeredRef.current) {
      setValue(startValue);
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

  const thumbColor = getThumbColor(value);
  const isSnapping = !dragging && !hasTriggeredRef.current;

  // Label fades out as the thumb progresses
  const progress = isCheckOut ? (1 - value / 100) : (value / 100);
  const labelOpacity = Math.max(0, 1 - progress * 2.5);

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className={cn(
          "relative select-none rounded-xl border border-border overflow-hidden",
          dragging ? "cursor-grabbing" : "cursor-grab",
          (disabled || loading) && "opacity-40 cursor-not-allowed",
        )}
        style={{
          height: THUMB + PADDING * 2,
          background: `color-mix(in srgb, ${thumbColor} 18%, #0d1520)`,
          transition: isSnapping ? "background 0.3s ease" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >

        {/* label */}
        <div
          className="absolute inset-0 flex items-center justify-center text-center text-xs font-bold tracking-[0.22em] text-white/90 pointer-events-none drop-shadow-sm leading-none"
          style={{
            paddingLeft: isCheckOut ? 16 : THUMB + PADDING * 2 + 8,
            paddingRight: isCheckOut ? THUMB + PADDING * 2 + 8 : 16,
            opacity: labelOpacity,
            transition: "opacity 0.1s",
          }}
        >
          {loading ? "PROCESSING..." : label}
        </div>

        {/* thumb */}
        <div
          className="absolute flex items-center justify-center rounded-[10px] text-white pointer-events-none top-1/2 -translate-y-1/2"
          style={{
            width: THUMB,
            height: THUMB,
            left: `calc(${PADDING}px + ${value / 100} * (100% - ${THUMB}px - ${PADDING * 2}px))`,
            background: thumbColor,
            boxShadow: `0 4px 16px ${thumbColor}55`,
            transition: isSnapping ? "left 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease" : "none",
          }}
        >
          {loading
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : isCheckOut
              ? <ChevronsLeft className="h-5 w-5" />
              : <ChevronsRight className="h-5 w-5" />
          }
        </div>
      </div>
      <div className="text-center text-xs text-white/30 tracking-wide">{helperText}</div>
    </div>
  );
}
