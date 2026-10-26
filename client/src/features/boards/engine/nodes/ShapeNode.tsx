import { memo } from 'react';
import { useBoardStoreApi } from '../../store/boardStore';
import { commitNodeText } from '../../canvas/actions';
import { CanvasNodeShell, NodeTextEditor, useNodeEditing, type BoardNodeProps } from './nodeUtils';
import { CTA_BLUE } from '../palette';

export function shapeOutline(shape: string, w: number, h: number) {
  switch (shape) {
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, w / 2 - 1)} ry={Math.max(1, h / 2 - 1)} />;
    case 'diamond':
      return <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} />;
    case 'triangle':
      return <polygon points={`${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`} />;
    case 'rounded':
      return <rect x={1} y={1} width={Math.max(1, w - 2)} height={Math.max(1, h - 2)} rx={Math.min(16, w / 4, h / 4)} />;
    default:
      return <rect x={1} y={1} width={Math.max(1, w - 2)} height={Math.max(1, h - 2)} rx={2} />;
  }
}

// Rectangle, rounded rectangle, ellipse, diamond or triangle with optional
// centred text. Resizable (Shift keeps the ratio).
export const ShapeNode = memo(function ShapeNode({ id, data, selected, width, height }: BoardNodeProps<'shape'>) {
  const store = useBoardStoreApi();
  const { editing, seed } = useNodeEditing(id);
  const w = width || 160;
  const h = height || 100;
  const fill = data.fill ?? 'var(--board-node-bg)';
  const stroke = data.stroke ?? CTA_BLUE;
  // Text stays inside the visual shape (diamonds/triangles have less room).
  const inset = data.shape === 'diamond' ? 'px-[22%] py-[18%]' : data.shape === 'triangle' ? 'px-[20%] pb-[6%] pt-[34%]' : data.shape === 'ellipse' ? 'px-[14%] py-[10%]' : 'p-3';
  return (
    <CanvasNodeShell
      id={id}
      selected={selected}
      data={data}
      testId="board-node-shape"
      style={{ width: w, height: h }}
      resize={{ minWidth: 40, minHeight: 40 }}
    >
      <svg width={w} height={h} className="absolute inset-0 overflow-visible" fill={fill} stroke={selected ? CTA_BLUE : stroke} strokeWidth={selected ? 3 : 2} data-shape={data.shape}>
        {shapeOutline(data.shape, w, h)}
      </svg>
      <div className={`relative flex h-full w-full items-center justify-center overflow-hidden text-center text-sm font-medium leading-snug text-[var(--board-node-fg)] ${inset}`}>
        {editing && !data.meta.readOnly ? (
          <NodeTextEditor
            initial={data.text ?? ''}
            seed={seed}
            placeholder="Text"
            ariaLabel="Shape text"
            testId="shape-editor"
            onCommit={(text) => commitNodeText(store, id, { text })}
            className="w-full"
          />
        ) : (
          data.text?.trim() && <span className="whitespace-pre-wrap break-words">{data.text}</span>
        )}
      </div>
    </CanvasNodeShell>
  );
});
