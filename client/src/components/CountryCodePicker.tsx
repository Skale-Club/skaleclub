import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { CountryFlag } from "@/components/CountryFlag";

// The country code next to a phone field. A native <select> cannot show an
// image inside its options, so this is a small listbox with SVG flags.

export interface CountryOption {
  /** Unique key (two countries can share a dial code, e.g. US and Canada). */
  id: string;
  /** ISO 3166 alpha-2, upper case, with a drawing in CountryFlag. */
  iso: string;
  label: string;
  /** Dial code as shown, e.g. "+55". */
  dial: string;
}

export type CountryPickerTone = "dark" | "light";

const TONES: Record<CountryPickerTone, { popup: string; item: string; active: string; muted: string; check: string }> = {
  dark: {
    popup: "border border-white/15 bg-[#10151e] text-white",
    item: "text-white",
    active: "bg-white/10",
    muted: "text-white/50",
    check: "text-blue-300",
  },
  light: {
    popup: "border border-border bg-popover text-popover-foreground",
    item: "text-foreground",
    active: "bg-accent",
    muted: "text-muted-foreground",
    check: "text-primary",
  },
};

const POPUP_GAP = 6;
const VIEWPORT_GAP = 8;
const POPUP_WIDTH = 240;
const POPUP_ID = "country-code-picker-popup";

type PopupPosition = Pick<CSSProperties, "left" | "top" | "width" | "maxHeight">;

/** What is visible of the page, so the list never opens behind the on-screen keyboard. */
function visibleViewport() {
  const vv = window.visualViewport;
  if (!vv) return { top: 0, bottom: window.innerHeight };
  return { top: vv.offsetTop, bottom: vv.offsetTop + vv.height };
}

export function CountryCodePicker({
  options,
  value,
  onChange,
  label,
  tone = "dark",
  className = "",
}: {
  options: readonly CountryOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  tone?: CountryPickerTone;
  /** Size, border and background of the trigger; match the adjacent input. */
  className?: string;
}) {
  const t = TONES[tone];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = options.find((c) => c.id === value) ?? options[0];

  const positionPopup = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const desiredHeight = Math.min(options.length * 44 + 8, 280);
    const view = visibleViewport();
    const spaceBelow = view.bottom - rect.bottom - VIEWPORT_GAP - POPUP_GAP;
    const spaceAbove = rect.top - view.top - VIEWPORT_GAP - POPUP_GAP;
    const placeBelow = spaceBelow >= Math.min(desiredHeight, 176) || spaceBelow >= spaceAbove;
    const availableHeight = placeBelow ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(120, Math.min(desiredHeight, availableHeight));
    const width = Math.min(POPUP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
    const left = Math.max(VIEWPORT_GAP, Math.min(rect.left, window.innerWidth - width - VIEWPORT_GAP));
    const top = placeBelow
      ? rect.bottom + POPUP_GAP
      : Math.max(view.top + VIEWPORT_GAP, rect.top - POPUP_GAP - maxHeight);

    setPopupPosition({ left, top, width, maxHeight });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    positionPopup();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    window.visualViewport?.addEventListener("resize", positionPopup);
    window.visualViewport?.addEventListener("scroll", positionPopup);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
      window.visualViewport?.removeEventListener("resize", positionPopup);
      window.visualViewport?.removeEventListener("scroll", positionPopup);
    };
  }, [open, positionPopup]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`#country-${options[active].id}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, options]);

  // Escape closes the list, not a dialog around it. Radix dialogs listen for Escape in the
  // capture phase on the document, so a window capture listener is needed to run first.
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    };
    window.addEventListener("keydown", onEscape, { capture: true });
    return () => window.removeEventListener("keydown", onEscape, { capture: true });
  }, [open]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((c) => c.id === current.id)));
    positionPopup();
    setOpen(true);
  };

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus();
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      show();
      return;
    }
    if (!open) return;

    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((i) => (i >= last ? 0 : i + 1));
    else if (e.key === "ArrowUp") setActive((i) => (i <= 0 ? last : i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") pick(options[active].id);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onTriggerKey}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={POPUP_ID}
        aria-activedescendant={open ? `country-${options[active].id}` : undefined}
        aria-label={`${label}: ${current.label} ${current.dial}`}
        className={`flex items-center gap-2 transition-colors ${className}`}
        data-testid="select-country-code"
      >
        <CountryFlag iso={current.iso} />
        <span className="tabular-nums">{current.dial}</span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && popupPosition && typeof document !== "undefined" && createPortal(
        <ul
          ref={listRef}
          id={POPUP_ID}
          role="listbox"
          aria-label={label}
          data-country-code-picker-popup
          style={popupPosition}
          className={`pointer-events-auto fixed z-[300] overflow-y-auto rounded-xl p-1 shadow-[0_12px_32px_rgba(0,0,0,0.6)] outline-none ${t.popup}`}
        >
          {options.map((c, i) => (
            <li
              key={c.id}
              id={`country-${c.id}`}
              role="option"
              aria-selected={c.id === current.id}
              onPointerEnter={() => setActive(i)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(c.id)}
              className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${t.item} ${i === active ? t.active : ""}`}
            >
              <CountryFlag iso={c.iso} />
              <span className="flex-1">{c.label}</span>
              <span className={`tabular-nums ${t.muted}`}>{c.dial}</span>
              {c.id === current.id ? <Check className={`h-4 w-4 ${t.check}`} /> : <span className="h-4 w-4" />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
