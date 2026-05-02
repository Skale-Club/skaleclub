import type { EstimateWithStats, PresentationWithStats, SlideBlock } from '@shared/schema';

const WIDTH = 352;
const HEIGHT = 216;
const PADDING = 32;
const VERSION = 'webp-thumb-v1';

type EstimateThumbSource = Pick<
  EstimateWithStats,
  'clientName' | 'companyName' | 'contactName'
>;

type PresentationThumbSource = Pick<PresentationWithStats, 'title' | 'slides'>;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',')}}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function getEstimateThumbnailSignature(estimate: EstimateThumbSource): string {
  return `estimate:${VERSION}:${hashString(
    stableStringify({
      clientName: estimate.clientName,
      companyName: estimate.companyName ?? '',
      contactName: estimate.contactName ?? '',
    }),
  )}`;
}

export function getPresentationThumbnailSignature(presentation: PresentationThumbSource): string {
  const cover = presentation.slides?.[0] ?? null;
  return `presentation:${VERSION}:${hashString(
    stableStringify({
      cover: cover ?? { title: presentation.title },
    }),
  )}`;
}

function getCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  return [canvas, ctx];
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, 'rgba(39, 39, 42, 0.75)');
  gradient.addColorStop(0.46, 'rgba(9, 9, 11, 0.98)');
  gradient.addColorStop(1, 'rgba(24, 24, 27, 0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, 0, WIDTH, 1);
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px Outfit, Inter, Arial, sans-serif`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(text).width > maxWidth * maxLines) {
      lines[maxLines - 1] = `${last.replace(/[.,;:!?-]+$/, '')}...`;
    }
  }

  return lines;
}

function drawTextBlock({
  ctx,
  eyebrow,
  title,
  subtitle,
  footer = 'Skale Club',
}: {
  ctx: CanvasRenderingContext2D;
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  footer?: string;
}) {
  const maxWidth = WIDTH - PADDING * 2;

  setFont(ctx, 10, 700);
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(eyebrow.toUpperCase(), PADDING, 48);

  setFont(ctx, title.length > 32 ? 25 : 29, 700);
  ctx.fillStyle = '#fafafa';
  const titleLines = wrapLines(ctx, title || 'Untitled', maxWidth, 3);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, PADDING, 84 + index * 32);
  });

  if (subtitle) {
    setFont(ctx, 14, 500);
    ctx.fillStyle = '#d4d4d8';
    wrapLines(ctx, subtitle, maxWidth, 1).forEach((line) => {
      ctx.fillText(line, PADDING, 84 + titleLines.length * 32 + 12);
    });
  }

  setFont(ctx, 10, 700);
  ctx.fillStyle = '#71717a';
  ctx.fillText(footer.toUpperCase(), PADDING, HEIGHT - 28);
}

function slideText(slide?: SlideBlock | null, fallbackTitle = 'Presentation') {
  if (!slide) return { eyebrow: 'Skale Club', title: fallbackTitle, subtitle: 'Presentation preview' };

  const title = slide.heading || slide.headingPt || fallbackTitle;
  const subtitle = slide.body || slide.bodyPt || slide.bullets?.[0] || slide.bulletsPt?.[0] || null;
  const eyebrow = slide.layout === 'cover' ? 'Skale Club' : slide.layout.replace(/-/g, ' ');
  return { eyebrow, title, subtitle };
}

export async function createEstimateThumbnailDataUrl(estimate: EstimateThumbSource): Promise<string> {
  const [canvas, ctx] = getCanvas();
  drawBackground(ctx);
  const company = estimate.companyName?.trim();
  const contact = estimate.contactName?.trim();
  drawTextBlock({
    ctx,
    eyebrow: 'Proposal for',
    title: company || contact || estimate.clientName || 'Client proposal',
    subtitle: company && contact ? contact : null,
  });
  return canvas.toDataURL('image/webp', 0.86);
}

export async function createPresentationThumbnailDataUrl(
  presentation: PresentationThumbSource,
): Promise<string> {
  const [canvas, ctx] = getCanvas();
  drawBackground(ctx);
  const cover = slideText(presentation.slides?.[0], presentation.title);
  drawTextBlock({ ctx, ...cover });
  return canvas.toDataURL('image/webp', 0.86);
}
