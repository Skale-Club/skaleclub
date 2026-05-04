import { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
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

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
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

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl"
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
        </div>
      ) : null}
    </div>
  );
}
