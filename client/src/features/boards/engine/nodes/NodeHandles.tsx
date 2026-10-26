import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

// One handle per side. The canvas runs in loose connection mode, so each one is
// both a start and an end; edges pick their sides in engine/toFlow.ts. Handles
// only show on hover/selection while editing.
export const NodeHandles = memo(function NodeHandles({ hidden, sides = SIDES }: { hidden?: boolean; sides?: readonly (typeof SIDES)[number][] }) {
  return (
    <>
      {sides.map((side) => (
        <Handle
          key={side.id}
          id={side.id}
          type="source"
          position={side.position}
          isConnectable={!hidden}
          className={cn(
            '!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-[#5173D6] transition-opacity',
            hidden ? '!opacity-0 !pointer-events-none' : 'opacity-0 group-hover:opacity-100 group-[.is-selected]:opacity-100',
          )}
        />
      ))}
    </>
  );
});

export const HORIZONTAL_SIDES = [SIDES[1], SIDES[3]] as const;
