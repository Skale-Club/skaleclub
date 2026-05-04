import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  getPhoneCountryFlagUrl,
  type PhoneCountry,
} from "@/lib/phoneCountries";

type PhoneCountrySelectProps = {
  value: PhoneCountry;
  onChange: (country: PhoneCountry) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
};

export function PhoneCountrySelect({
  value,
  onChange,
  ariaLabel = "Phone country",
  className,
  buttonClassName,
}: PhoneCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 224 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const updateDropdownPosition = () => {
    if (!rootRef.current) return;

    const rect = rootRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(224, rect.width),
    });
  };

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            updateDropdownPosition();
          }
          setOpen((current) => !current);
        }}
        className={cn(
          "flex min-h-10 w-[132px] items-center gap-2 bg-slate-50 px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#406EF1]/30",
          buttonClassName,
        )}
      >
        <img
          src={getPhoneCountryFlagUrl(value)}
          alt=""
          className="h-4 w-5 rounded-[2px] object-cover shadow-sm"
        />
        <span className="text-xs font-semibold">{value.code}</span>
        <span>{value.dialCode}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 opacity-50 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label={ariaLabel}
          className="fixed z-[200] max-h-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {PHONE_COUNTRIES.map((country) => {
            const selected = country.code === value.code;
            return (
              <button
                key={country.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(country);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                  selected && "bg-[#EFF3FF] text-[#355CD0]",
                )}
              >
                <img
                  src={getPhoneCountryFlagUrl(country)}
                  alt=""
                  className="h-4 w-5 rounded-[2px] object-cover shadow-sm"
                />
                <span className="flex-1 font-medium text-slate-700">{country.name}</span>
                <span className="text-slate-500">{country.dialCode}</span>
                {selected ? <Check className="h-4 w-4 text-[#406EF1]" /> : null}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
