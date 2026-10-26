import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import type { BoardFlowEdge } from '../toFlow';
import { CTA_BLUE, EDGE_NEUTRAL } from '../palette';

// `tree`: a mind-map branch. A smooth bezier from the parent's outer side to
// the child, colored by branch and thinning with depth (3px -> 1.5px).
export function treeStrokeWidth(depth: number | undefined) {
  if (!depth || depth <= 1) return 3;
  if (depth === 2) return 2.25;
  return 1.5;
}

export const TreeEdge = memo(function TreeEdge(props: EdgeProps<BoardFlowEdge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition } = props;
  const horizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  // Control points pulled along the growth axis: a soft S that leaves the
  // parent level and arrives at the child level.
  let path: string;
  if (horizontal) {
    const dx = (targetX - sourceX) * 0.5;
    path = `M ${sourceX},${sourceY} C ${sourceX + dx},${sourceY} ${targetX - dx},${targetY} ${targetX},${targetY}`;
  } else {
    const dy = (targetY - sourceY) * 0.5;
    path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + dy} ${targetX},${targetY - dy} ${targetX},${targetY}`;
  }
  const color = props.selected ? CTA_BLUE : (props.data?.color ?? props.data?.branchColor ?? EDGE_NEUTRAL);
  return (
    <BaseEdge
      id={props.id}
      path={path}
      interactionWidth={16}
      style={{
        stroke: color,
        strokeWidth: treeStrokeWidth(props.data?.treeDepth),
        strokeLinecap: 'round',
        strokeDasharray: props.data?.dashed ? '6 6' : undefined,
      }}
    />
  );
});

// `connector`: a free Miro-style link with optional arrows (markers come from
// toFlow), a curve/straight/step style and a label in the middle.
export const ConnectorEdge = memo(function ConnectorEdge(props: EdgeProps<BoardFlowEdge>) {
  const params = {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  };
  const style = props.data?.style ?? 'curve';
  const [path, labelX, labelY] =
    style === 'straight' ? getStraightPath(params) : style === 'step' ? getSmoothStepPath({ ...params, borderRadius: 8 }) : getBezierPath(params);
  const color = props.selected ? CTA_BLUE : (props.data?.color ?? EDGE_NEUTRAL);
  const label = props.data?.label?.trim();
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={16}
        style={{ stroke: color, strokeWidth: 2, strokeDasharray: props.data?.dashed ? '6 6' : undefined }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute max-w-[220px] truncate rounded-md border border-[var(--board-node-border)] bg-[var(--board-node-bg)] px-2 py-0.5 text-xs font-medium text-[var(--board-node-fg)] shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const boardEdgeTypes = {
  tree: TreeEdge,
  connector: ConnectorEdge,
} as unknown as EdgeTypes;
