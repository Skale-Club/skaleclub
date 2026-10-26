import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { HandleSide } from '../toFlow';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

const ALL: readonly HandleSide[] = ['top', 'right', 'bottom', 'left'];

// One handle per side. The canvas runs in loose connection mode, so each one is
// both a start and an end; edges pick their sides in engine/toFlow.ts. All four
// always exist (edges anchor to them); only `connectable` ones show on hover or
// selection and start a connector drag.
export const NodeHandles = memo(function NodeHandles({ hidden, connectable = ALL }: { hidden?: boolean; connectable?: readonly HandleSide[] }) {
  return (
    <>
      {SIDES.map((side) => {
        const active = !hidden && connectable.includes(side.id);
        return (
          <Handle
            key={side.id}
            id={side.id}
            type="source"
            position={side.position}
            isConnectable={active}
            data-testid={active ? `board-handle-${side.id}` : undefined}
            className={cn(
              'board-handle !h-3 !w-3 !rounded-full !border-2 !border-white !bg-[#5173D6] transition-opacity',
              active ? 'opacity-0 group-hover:opacity-100 group-[.is-selected]:opacity-100' : '!opacity-0 !pointer-events-none',
            )}
          />
        );
      })}
    </>
  );
});

export const HORIZONTAL_SIDES = [SIDES[1], SIDES[3]] as const;
