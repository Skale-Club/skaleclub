import { getImageUrl } from "@/components/admin/shared/utils";

/**
 * Print palette: the site's editorial tokens (tailwind.config.ts `navy`,
 * `fog`, `cta`), as literal hex. Literal on purpose: these values are
 * converted to CMYK downstream, so they must be stable regardless of the
 * screen theme the preview happens to render under.
 *
 * The folder used the older saturated navies (#0A162E / #060E1D) until the
 * 2026-09-28 redesign moved the site to these desaturated ones; keep the two
 * in step, or the folder stops looking like the site it advertises.
 */
export const INK = {
  /** navy-900, the hero surface (cover). */
  navy: "#10151e",
  /** navy-950, the page surface (every other panel). */
  navyDeep: "#0d121a",
  /** navy-850, the closing CTA band. */
  navyBand: "#141b27",
  /** navy-800, cards. */
  card: "#161d28",
  /** Hairline frame on dark surfaces (the site's `border-white/10`). */
  hairline: "rgba(255,255,255,0.10)",
  cta: "#5173D6",
  ctaDeep: "#3B5BBE",
  /** Accent on dark: eyebrows, highlights, prices. */
  ctaSoft: "#8FA9EE",
  fog50: "#f3f5f8",
  fog200: "#e3e7ee",
  fog300: "#cdd3dc",
  fog400: "#a7afbc",
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
      className={`outline-none focus:ring-1 focus:ring-blue-400/60 ${className ?? ""}`}
      style={style}
    >
      {children}
    </T>
  );
}

/**
 * The site's hero background: a plain hairline grid, never a glow. 40px on
 * screen is ~10.6mm; 10mm keeps the squares the same size on paper. The panel
 * that holds it must be `relative`, and its content `relative` above it.
 */
export function GridPattern({ opacity = 0.05 }: { opacity?: number }) {
  const line = `rgba(255,255,255,${opacity})`;
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `linear-gradient(${line} 0.2mm, transparent 0.2mm), linear-gradient(90deg, ${line} 0.2mm, transparent 0.2mm)`,
        backgroundSize: "10mm 10mm",
      }}
    />
  );
}

/**
 * Standard prepress trim marks at the 4 corners of the trim box.
 *
 * `onDark` flips them to white: black marks on a navy bleed are invisible to
 * the person trimming the sheet, which defeats the only reason they exist.
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
 * A cropped image box with a fixed aspect ratio, sharp-cornered like the
 * site's figures.
 *
 * `position` is the object-position: app covers are website screenshots and
 * must be anchored to their top edge, where the headline is.
 */
export function ImageFrame({
  src,
  alt = "",
  ratio = "4 / 3",
  position = "center",
  fill = false,
  className,
  style,
}: {
  src: string | null | undefined;
  alt?: string;
  ratio?: string;
  position?: "center" | "top";
  /** Grow to consume the flex parent's free height instead of holding `ratio`. */
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  // `flex: 1` with `minHeight: 0` lets the frame absorb leftover panel height;
  // otherwise a short spread leaves a dead band under the last card.
  const box: React.CSSProperties = fill
    ? { flex: "1 1 0", minHeight: "28mm", ...style }
    : { aspectRatio: ratio, ...style };
  if (!src) {
    // No image: a flat navy block keeps the layout intact instead of collapsing
    // or printing a bright empty square on the dark folder.
    return <div className={className} style={{ ...box, backgroundColor: INK.navy }} />;
  }
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={box}>
      <img
        src={printImage(src)}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover ${position === "top" ? "object-top" : ""}`}
      />
    </div>
  );
}

/**
 * The editorial eyebrow: small, bold, widely tracked, accent blue. Numbered
 * ("01 · Apps") on the panels, as on /portfolio.
 */
export function Eyebrow({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Editable
      className={`text-[6.5pt] font-bold uppercase tracking-[0.24em] leading-none ${className ?? ""}`}
      style={{ color: INK.ctaSoft, ...style }}
    >
      {children}
    </Editable>
  );
}

/** Small pill for a feature or tag. Pills are the one rounded shape the site keeps. */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-full px-[2.2mm] py-[0.8mm] text-[6.8pt] font-semibold leading-none"
      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: INK.fog200 }}
    >
      {children}
    </span>
  );
}

/**
 * Price with its label kept together, so a monthly plan never sits next to a
 * one-time fee with nothing to tell them apart. Set like the site's price:
 * the number in fog, the qualifiers small and muted.
 */
export function Price({
  price,
  label,
  prefix,
  align = "right",
  size = "md",
  inline = false,
}: {
  price: string;
  label?: string | null;
  /** "From", for an entry price. */
  prefix?: string;
  align?: "left" | "right";
  size?: "md" | "lg";
  /** Number and label on one baseline ("$89 /month"), for tight card rows. */
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-baseline gap-[0.8mm] shrink-0 whitespace-nowrap">
        <Editable className="text-[10.5pt] font-semibold leading-none tracking-[-0.02em]" style={{ color: INK.fog50 }}>
          {price}
        </Editable>
        {label && (
          <Editable className="text-[6pt] leading-none" style={{ color: INK.fog400 }}>
            {label}
          </Editable>
        )}
      </div>
    );
  }
  return (
    <div className={`flex flex-col shrink-0 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <div className="flex items-baseline gap-[1mm] whitespace-nowrap">
        {prefix && (
          <Editable className="text-[6.5pt]" style={{ color: INK.fog400 }}>
            {prefix}
          </Editable>
        )}
        <Editable
          className={`${size === "lg" ? "text-[14pt]" : "text-[11pt]"} font-semibold leading-none tracking-[-0.02em]`}
          style={{ color: INK.fog50 }}
        >
          {price}
        </Editable>
      </div>
      {label && (
        <Editable
          className="text-[6pt] leading-none mt-[0.9mm] whitespace-nowrap"
          style={{ color: INK.fog400 }}
        >
          {label}
        </Editable>
      )}
    </div>
  );
}
