import { memo, useLayoutEffect, useRef, useState } from 'react';
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
import { useBoardStore, useBoardStoreApi } from '../../store/boardStore';
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

// Inline label editor for a connector (double-click the edge). Enter or blur
// saves, Escape cancels; an empty label removes it.
function EdgeLabelEditor({ id, initial }: { id: string; initial: string }) {
  const store = useBoardStoreApi();
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const state = store.getState();
    if (save) {
      const label = value.trim().slice(0, 500);
      const edge = state.document.edges.find((e) => e.id === id);
      if (edge && (edge.data?.label ?? '') !== label) {
        if (label) state.updateEdgeData(id, { label });
        else {
          const { label: _l, ...rest } = edge.data ?? {};
          state.setDocument({ ...state.document, edges: state.document.edges.map((e) => (e.id === id ? { ...e, data: rest } : e)) });
        }
      }
    }
    if (store.getState().editingEdgeId === id) store.getState().setEditingEdge(null);
  };
  return (
    <input
      ref={ref}
      value={value}
      maxLength={500}
      placeholder="Label"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      className="nodrag nopan w-40 border border-[#5173D6] bg-[var(--board-node-bg)] px-2 py-0.5 text-center text-xs font-medium text-[var(--board-node-fg)] shadow-md outline-none"
      style={{ borderRadius: 6 }}
      aria-label="Connector label"
      data-testid="edge-label-editor"
    />
  );
}

// `connector`: a free Miro-style link with optional arrows (markers come from
// toFlow), a curve/straight/step style and a label in the middle.
export const ConnectorEdge = memo(function ConnectorEdge(props: EdgeProps<BoardFlowEdge>) {
  const store = useBoardStoreApi();
  const editing = useBoardStore((s) => s.editingEdgeId === props.id);
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
        interactionWidth={18}
        style={{ stroke: color, strokeWidth: props.selected ? 2.5 : 2, strokeDasharray: props.data?.dashed ? '6 6' : undefined }}
      />
      {(label || editing) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            data-testid="edge-label"
            data-edge-id={props.id}
          >
            {editing ? (
              <EdgeLabelEditor id={props.id} initial={props.data?.label ?? ''} />
            ) : (
              <div
                className="max-w-[220px] truncate border border-[var(--board-node-border)] bg-[var(--board-node-bg)] px-2 py-0.5 text-xs font-medium text-[var(--board-node-fg)] shadow-sm"
                style={{ borderRadius: 6, ...(props.selected ? { borderColor: CTA_BLUE } : {}) }}
                onDoubleClick={(e) => {
                  if (store.getState().readOnly) return;
                  e.stopPropagation();
                  store.getState().select({ nodeIds: [], edgeIds: [props.id] });
                  store.getState().setEditingEdge(props.id);
                }}
              >
                {label}
              </div>
            )}
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
