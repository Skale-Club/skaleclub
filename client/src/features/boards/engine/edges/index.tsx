import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import type { BoardFlowEdge } from '../toFlow';
import { CTA_BLUE, EDGE_NEUTRAL } from '../palette';

// `tree`: the mind-map branch, a smooth horizontal bezier. Phase 1 thins it by
// depth and colors it by branch.
export const TreeEdge = memo(function TreeEdge(props: EdgeProps<BoardFlowEdge>) {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.35,
  });
  return (
    <BaseEdge
      id={props.id}
      path={path}
      interactionWidth={16}
      style={{
        stroke: props.selected ? CTA_BLUE : (props.data?.color ?? EDGE_NEUTRAL),
        strokeWidth: 2.5,
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
