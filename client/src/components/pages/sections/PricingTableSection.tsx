// Quick 260906-fu3 — `pricingTable` section type.
// A bordered price card: one row per line (label + optional note on the left,
// price on the right, plus a small "kind" badge). All copy is prop-driven with
// English defaults (the t() source language) so a bare `props: {}` still
// renders the confirmed NFC-keychain pricing; PT is served via t() when the
// page language is 'pt'.

import { z } from "zod";
import { useTranslation } from "@/hooks/useTranslation";

const priceLineSchema = z.object({
  label: z.string(),
  price: z.string(),
  note:  z.string().optional(),
  kind:  z.enum(["one-time", "per-unit", "minimum"]),
});

export const pricingTablePropsSchema = z.object({
  eyebrow:    z.string().optional(),
  heading:    z.string().optional(),
  subheading: z.string().optional(),
  lines:      z.array(priceLineSchema).min(1).optional(),
  footnote:   z.string().optional(),
});
export type PricingTableProps = z.infer<typeof pricingTablePropsSchema>;

type PriceLine     = z.infer<typeof priceLineSchema>;
type PriceLineKind = PriceLine["kind"];

const KIND_LABELS: Record<PriceLineKind, string> = {
  "one-time": "One-time",
  "per-unit": "Per unit",
  "minimum":  "Minimum order",
};

// Typed against the schema (not `as const`) so every entry carries the
// optional `note` slot and `line.note` type-checks across the union.
const DEFAULT_LINES: PriceLine[] = [
  { label: "Per keychain",     price: "$10",  kind: "per-unit" },
  { label: "Minimum order",    price: "$200", note: "20 pieces × $10", kind: "minimum" },
  { label: "Art / design fee", price: "$50",  note: "First order only — waived from your second order onward", kind: "one-time" },
];

const DEFAULTS = {
  eyebrow:    "Pricing",
  heading:    "Simple, upfront pricing",
  subheading: "No hidden fees. You know the total before we start.",
  lines:      DEFAULT_LINES,
  footnote:   "100% payment upfront. Production starts after payment clears.",
} as const;

export function PricingTableSection({ props }: { props: PricingTableProps }) {
  const { t } = useTranslation();
  const eyebrow    = props.eyebrow    ?? DEFAULTS.eyebrow;
  const heading    = props.heading    ?? DEFAULTS.heading;
  const subheading = props.subheading ?? DEFAULTS.subheading;
  const lines      = props.lines      ?? DEFAULTS.lines;
  const footnote   = props.footnote   ?? DEFAULTS.footnote;

  return (
    <section
      className="bg-zinc-50 py-20 sm:py-24"
      data-testid="section-pricing-table"
    >
      <div className="container-custom mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#1C53A3] mb-3">
            {t(eyebrow)}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-zinc-900 leading-tight mb-4">
            {t(heading)}
          </h2>
          <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
            {t(subheading)}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-200">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-6 px-6 py-5 sm:px-8 sm:py-6"
                data-testid={`pricing-line-${idx + 1}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-base sm:text-lg font-semibold text-zinc-900">
                      {t(line.label)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[#1C53A3]/10 px-2.5 py-0.5 text-xs font-medium text-[#1C53A3]">
                      {t(KIND_LABELS[line.kind])}
                    </span>
                  </div>
                  {line.note && (
                    <p className="text-sm text-zinc-500">
                      {t(line.note)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-2xl font-bold text-zinc-900">
                  {line.price}
                </span>
              </div>
            ))}
          </div>

          {footnote && (
            <p className="mt-6 text-center text-sm text-zinc-600">
              {t(footnote)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
