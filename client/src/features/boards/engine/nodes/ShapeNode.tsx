import { memo } from 'react';
import { MultilineText, cn, type BoardNodeProps } from './nodeUtils';
import { NodeHandles } from './NodeHandles';

export const ShapeNode = memo(function ShapeNode({ data, selected, width, height }: BoardNodeProps<'shape'>) {
  const w = width || 160;
  const h = height || 100;
  const fill = data.fill ?? 'var(--board-node-bg)';
  const stroke = data.stroke ?? '#5173D6';
  const outline = (() => {
    switch (data.shape) {
      case 'ellipse':
        return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} />;
      case 'diamond':
        return <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} />;
      case 'triangle':
        return <polygon points={`${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`} />;
      case 'rounded':
        return <rect x={1} y={1} width={w - 2} height={h - 2} rx={16} />;
      default:
        return <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} />;
    }
  })();
  return (
    <div className={cn('group relative', selected && 'is-selected')} style={{ width: w, height: h }} data-testid="board-node-shape">
      <svg width={w} height={h} className="absolute inset-0 overflow-visible" fill={fill} stroke={selected ? '#5173D6' : stroke} strokeWidth={selected ? 3 : 2}>
        {outline}
      </svg>
      <div className="relative flex h-full w-full items-center justify-center p-3 text-center text-sm text-[var(--board-node-fg)]">
        <MultilineText text={data.text} fallback="" />
      </div>
      <NodeHandles hidden={data.meta.readOnly} />
    </div>
  );
});
