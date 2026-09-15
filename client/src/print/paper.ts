// Paper geometry for the print folder generator.
//
// Everything here is in real millimetres — the browser is told the exact sheet
// size via `@page`, so 1mm on screen is 1mm on paper. Pixels only appear when
// fitting the preview into the viewport (see MM_TO_PX).

export const PAPER_PRESETS = {
  a4: { label: "A4 open · 29.7 × 21 cm", w: 297, h: 210 },
  letter: { label: "Letter open · 27.9 × 21.6 cm", w: 279.4, h: 215.9 },
} as const;

export type PaperKey = keyof typeof PAPER_PRESETS;

/** CSS reference pixels per millimetre (96dpi). Preview zoom only. */
export const MM_TO_PX = 96 / 25.4;

/** Safe margin between the trim edge and any content. */
export const CONTENT_PAD_MM = 10;

/**
 * Panel padding. Outer edges also absorb the bleed so nothing important is lost
 * when the sheet is trimmed; the fold-side edge only needs the safe margin.
 */
export function panelPadding(bleed: number, side: "left" | "right") {
  const outer = `${CONTENT_PAD_MM + bleed}mm`;
  const fold = `${CONTENT_PAD_MM}mm`;
  return {
    paddingTop: outer,
    paddingBottom: outer,
    paddingLeft: side === "left" ? outer : fold,
    paddingRight: side === "left" ? fold : outer,
  } as const;
}

/**
 * Split services across the two inside panels by estimated visual weight rather
 * than by count.
 *
 * The old `floor(n / 2)` split ignored that the left panel also carries the
 * intro block and the CTA, so a 6-service folder put 3 cards in a full-looking
 * left panel and 3 in a half-empty right one. Weight is approximated from what
 * actually drives a card's height: its feature rows, plus a constant for the
 * title/subtitle block.
 *
 * @param reservedLeft Weight already spoken for on the left panel (intro + CTA),
 *                     expressed in the same units as a card's weight.
 */
export function balanceByWeight<T>(
  items: T[],
  weightOf: (item: T) => number,
  reservedLeft = 0,
): { left: T[]; right: T[] } {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0) + reservedLeft;
  const target = total / 2;

  let running = reservedLeft;
  let cut = 0;
  for (let i = 0; i < items.length; i++) {
    const next = running + weightOf(items[i]);
    // Stop before the card that would push the left panel past the midpoint,
    // unless including it lands closer to balanced than excluding it.
    if (next > target) {
      cut = Math.abs(next - target) < Math.abs(running - target) ? i + 1 : i;
      break;
    }
    running = next;
    cut = i + 1;
  }

  // Never strand a panel: with 2+ items each side gets at least one.
  if (items.length >= 2) cut = Math.min(Math.max(cut, 1), items.length - 1);

  return { left: items.slice(0, cut), right: items.slice(cut) };
}

/** Visual weight of a service card, in "rows": title/subtitle block + features. */
export function serviceWeight(featureCount: number, isAnchor = false): number {
  const base = 2.4; // title + subtitle + padding
  const withFeatures = base + featureCount * 0.9;
  return isAnchor ? withFeatures + 4.5 : withFeatures; // anchor carries an image
}
