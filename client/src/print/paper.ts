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
