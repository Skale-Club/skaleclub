// Brand-aligned colors for board content. Brand navy is the mind-map root, the
// CTA blue is the accent (selection, links); everything else stays neutral.
export const BRAND_NAVY = '#0A162E';
export const CTA_BLUE = '#5173D6';

export const STICKY_COLORS = [
  '#FEF3C7', // butter
  '#FDE2E4', // blush
  '#DCFCE7', // mint
  '#DBEAFE', // sky
  '#EDE9FE', // lavender
  '#FFEDD5', // peach
  '#E0F2FE', // ice
  '#F1F5F9', // cloud
] as const;

export const DEFAULT_STICKY_COLOR = STICKY_COLORS[0];

// First-level mind-map branch colors (phase 1 assigns them round-robin).
export const BRANCH_COLORS = ['#5173D6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'] as const;

export const EDGE_NEUTRAL = '#94A3B8';
