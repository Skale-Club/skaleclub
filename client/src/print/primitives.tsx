import { getImageUrl } from "@/components/admin/shared/utils";

/**
 * Print palette. Hex rather than CSS tokens on purpose: these values are
 * converted to CMYK downstream, so they must be literal and stable regardless
 * of the screen theme the preview happens to render under.
 */
export const INK = {
  navy: "#0A162E",
  navyDeep: "#060E1D",
  cta: "#5173D6",
  ctaDeep: "#3B5BBE",
  paper: "#FFFFFF",
  paperTint: "#F4F7FC",
  rule: "#DCE4F2",
  body: "#4A5568",
  muted: "#8A94A6",
} as const;

/** Relative luminance below 0.5 — used to pick crop-mark and fallback colours. */
export function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** Images destined for paper: generous width, high quality, no upscaling games. */
export const printImage = (url: string | null | undefined, width = 1200) =>
  getImageUrl(url, { width, quality: 92 });

/**
 * Free-text blocks are contentEditable so copy can be tweaked before printing.
 * Edits live only until the page reloads.
 */
export function Editable({
  as: Tag = "div",
  className,
  style,
  children,
}: {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const T = Tag as any;
  return (
    <T
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`outline-none focus:ring-1 focus:ring-blue-400/60 rounded-sm ${className ?? ""}`}
      style={style}
    >
      {children}
    </T>
  );
}

/**
 * Standard prepress trim marks at the 4 corners of the trim box.
 *
 * `onDark` flips them to white. They were black regardless of the sheet, and
 * every template now prints on navy — black on #060E1D is invisible to the
 * person trimming the sheet, which defeats the only reason the marks exist.
 * They also carry `z-index` so a positioned panel rendered after them cannot
 * paint over them.
 */
export function CropMarks({ bleed, onDark = false }: { bleed: number; onDark?: boolean }) {
  if (bleed <= 0) return null;
  // Never longer than the bleed: at 1mm the old floor of 2mm put the mark 1mm
  // inside the trim line, i.e. on the finished piece.
  const len = Math.min(Math.max(bleed - 1, 2), bleed);
  const mm = (v: number) => `${v}mm`;
  const mark = (style: React.CSSProperties, key: string) => (
    <div
      key={key}
      className="absolute z-20"
      style={{ ...style, backgroundColor: onDark ? "#FFFFFF" : "#000000" }}
    />
  );
  return (
    <>
      {mark({ top: 0, left: mm(bleed), width: "0.3mm", height: mm(len) }, "tl-v")}
      {mark({ top: mm(bleed), left: 0, height: "0.3mm", width: mm(len) }, "tl-h")}
      {mark({ top: 0, right: mm(bleed), width: "0.3mm", height: mm(len) }, "tr-v")}
      {mark({ top: mm(bleed), right: 0, height: "0.3mm", width: mm(len) }, "tr-h")}
      {mark({ bottom: 0, left: mm(bleed), width: "0.3mm", height: mm(len) }, "bl-v")}
      {mark({ bottom: mm(bleed), left: 0, height: "0.3mm", width: mm(len) }, "bl-h")}
      {mark({ bottom: 0, right: mm(bleed), width: "0.3mm", height: mm(len) }, "br-v")}
      {mark({ bottom: mm(bleed), right: 0, height: "0.3mm", width: mm(len) }, "br-h")}
    </>
  );
}

/** Fold line and trim box — screen only, hidden by the print stylesheet. */
export function Guides({ bleed, show }: { bleed: number; show: boolean }) {
  if (!show) return null;
  return (
    <>
      <div className="screen-guide absolute inset-y-0 left-1/2 w-0 border-l border-dashed border-slate-400/70 pointer-events-none z-10">
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-400 whitespace-nowrap">
          fold
        </span>
      </div>
      {bleed > 0 && (
        <div
          className="screen-guide absolute border border-dashed border-red-400/60 pointer-events-none z-10"
          style={{ inset: `${bleed}mm` }}
        />
      )}
    </>
  );
}

/**
 * A cropped image box with a fixed aspect ratio.
 *
 * `tone` lays a brand-coloured wash over the image so photography from mixed
 * sources still reads as one family on paper — the single biggest cause of a
 * "stock photo collage" look in printed collateral.
 */
export function ImageFrame({
  src,
  alt = "",
  ratio = "4 / 3",
  radius = "2mm",
  tone = "none",
  fill = false,
  onDark = true,
  className,
  style,
}: {
  src: string | null | undefined;
  alt?: string;
  ratio?: string;
  radius?: string;
  tone?: "none" | "navy" | "cta";
  /** Grow to consume the flex parent's free height instead of holding `ratio`. */
  fill?: boolean;
  /** Which surface the frame sits on; decides the colour of the no-image fallback. */
  onDark?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // `flex: 1` with `minHeight: 0` lets the frame absorb leftover panel height;
  // otherwise a short spread leaves a dead band under the last card.
  const box: React.CSSProperties = fill
    ? { flex: "1 1 0", minHeight: "28mm", borderRadius: radius, ...style }
    : { aspectRatio: ratio, borderRadius: radius, ...style };
  if (!src) {
    // No image: a flat block keeps the layout intact instead of collapsing. It
    // was always paper-tint, which on the dark folder printed as a bright white
    // square — exactly what a service with no artwork yet (3D Printing before
    // its image is generated) would have gone to the printer with.
    return (
      <div
        className={className}
        style={{
          ...box,
          background: onDark
            ? "linear-gradient(135deg, #16233E 0%, #0B1526 100%)"
            : INK.paperTint,
        }}
      />
    );
  }

  const wash =
    tone === "navy"
      ? "linear-gradient(180deg, rgba(10,22,46,0.15), rgba(10,22,46,0.55))"
      : tone === "cta"
        ? "linear-gradient(180deg, rgba(81,115,214,0.10), rgba(10,22,46,0.45))"
        : null;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={box}>
      <img
        src={printImage(src)}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {wash && <div className="absolute inset-0" style={{ background: wash }} />}
    </div>
  );
}

/** Short brand rule used to anchor headings. */
export function Rule({
  color = INK.cta,
  width = "24mm",
  className,
}: {
  color?: string;
  width?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-full ${className ?? ""}`}
      style={{ height: "1.4mm", width, backgroundColor: color }}
    />
  );
}

/** Small pill for a feature or tag. */
export function Chip({
  children,
  onDark = false,
}: {
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <span
      className="inline-block rounded-full px-[2.2mm] py-[0.8mm] text-[7.5pt] font-semibold leading-none"
      style={
        onDark
          ? { backgroundColor: "rgba(255,255,255,0.12)", color: "#DCE4F2" }
          : { backgroundColor: INK.paperTint, color: INK.navy }
      }
    >
      {children}
    </span>
  );
}

/**
 * Price with its label kept together. The previous card printed "$49" and threw
 * away "/month", so a monthly plan sat next to a one-time fee with nothing to
 * tell them apart.
 */
export function Price({
  price,
  label,
  color = INK.cta,
  align = "right",
}: {
  price: string;
  label?: string | null;
  color?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <Editable className="text-[13pt] font-extrabold leading-none" style={{ color }}>
        {price}
      </Editable>
      {label && (
        <Editable
          className="text-[6.5pt] font-semibold uppercase tracking-wider leading-none mt-[0.8mm]"
          style={{ color: INK.muted }}
        >
          {label}
        </Editable>
      )}
    </div>
  );
}
