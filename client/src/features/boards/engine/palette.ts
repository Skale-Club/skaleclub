import { STICKY_COLORS } from '@shared/boards/canvasDefaults';

// Brand-aligned colors for board content. Brand navy is the mind-map root, the
// CTA blue is the accent (selection, links); everything else stays neutral.
export const BRAND_NAVY = '#0A162E';
export const CTA_BLUE = '#5173D6';

export const DEFAULT_STICKY_COLOR = STICKY_COLORS[0];

// First-level mind-map branch colors (phase 1 assigns them round-robin).
export const BRANCH_COLORS = ['#5173D6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'] as const;

export const EDGE_NEUTRAL = '#94A3B8';

// Branch colors per board palette (theme.palette). First-level branches take
// them in order; descendants inherit their branch's color.
export const PASTEL_BRANCH_COLORS = ['#7C9CF0', '#4FC3E8', '#5FD3A2', '#F6B95C', '#F08A8A', '#B39DF5', '#F28BC4', '#56D0C4'] as const;
export const MONO_BRANCH_COLORS = ['#475569', '#64748B', '#94A3B8', '#334155'] as const;

export function branchPalette(palette: 'brand' | 'pastel' | 'mono' = 'brand'): readonly string[] {
  if (palette === 'pastel') return PASTEL_BRANCH_COLORS;
  if (palette === 'mono') return MONO_BRANCH_COLORS;
  return BRANCH_COLORS;
}
