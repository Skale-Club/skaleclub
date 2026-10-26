import { getViewportForBounds, type ReactFlowInstance, type ReactFlowState } from '@xyflow/react';
import type { Box } from '@shared/boards/canvasOps';
import { MAX_ZOOM, MIN_ZOOM } from '../ui/ZoomBar';

/**
 * Moves the camera so `box` (board coordinates) fills the canvas with a
 * relative `padding`, never zooming in past `maxZoom` (React Flow's own
 * fitBounds has no such cap, so a small box would be blown up).
 */
export function frameBox(
  reactFlow: Pick<ReactFlowInstance, 'setViewport'>,
  pane: Pick<ReactFlowState, 'width' | 'height'>,
  box: Box,
  opts: { padding: number; maxZoom: number; duration: number },
) {
  if (!pane.width || !pane.height || !(box.w > 0) || !(box.h > 0)) return;
  const viewport = getViewportForBounds({ x: box.x, y: box.y, width: box.w, height: box.h }, pane.width, pane.height, MIN_ZOOM, Math.min(opts.maxZoom, MAX_ZOOM), opts.padding);
  void reactFlow.setViewport(viewport, { duration: opts.duration });
}
