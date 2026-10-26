import type { NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { BoardFlowNode, BoardFlowNodeData } from '../toFlow';

// Shared bits of the placeholder node renderers. Phase 1 (mind map) and phase 2
// (canvas) replace the renderers with editable versions; the props and the data
// shape stay the same, so the store and the converters do not change.

type DataOf<T extends BoardFlowNodeData['type']> = Extract<BoardFlowNodeData, { type: T }>;
export type BoardNodeProps<T extends BoardFlowNodeData['type']> = NodeProps<BoardFlowNode> & { data: DataOf<T> };

// Selected nodes get the CTA-blue ring.
export function selectionRing(selected: boolean | undefined) {
  return selected ? 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-[var(--board-bg)]' : '';
}

export function MultilineText({ text, fallback }: { text: string | undefined; fallback: string }) {
  const value = text?.trim() ? text : fallback;
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

export { cn };
