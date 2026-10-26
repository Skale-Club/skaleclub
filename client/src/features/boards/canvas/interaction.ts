// Tiny external stores for transient canvas UI that must not re-render the
// whole canvas: alignment guides while dragging, whether Shift is held (keep
// aspect ratio while resizing) and the last tool options picked.
import { useEffect, useSyncExternalStore } from 'react';
import type { GuideLine } from '@shared/boards/canvasOps';
import { STICKY_COLORS } from '@shared/boards/canvasDefaults';
import type { ShapeNodeData } from '@shared/schema/boards';

export interface Signal<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useSignal<T>(signal: Signal<T>): T {
  return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

const NO_GUIDES: GuideLine[] = [];
export const guidesSignal = createSignal<GuideLine[]>(NO_GUIDES);
export const clearGuides = () => guidesSignal.set(NO_GUIDES);

export const shiftSignal = createSignal(false);

export interface ToolPrefs {
  stickyColor: string;
  shapeKind: ShapeNodeData['shape'];
}
export const toolPrefsSignal = createSignal<ToolPrefs>({ stickyColor: STICKY_COLORS[0], shapeKind: 'rect' });
export const setToolPrefs = (patch: Partial<ToolPrefs>) => toolPrefsSignal.set({ ...toolPrefsSignal.get(), ...patch });

/** Keeps shiftSignal in sync with the keyboard while mounted. */
export function useShiftTracking() {
  useEffect(() => {
    const update = (event: KeyboardEvent) => shiftSignal.set(event.shiftKey);
    const reset = () => shiftSignal.set(false);
    window.addEventListener('keydown', update, true);
    window.addEventListener('keyup', update, true);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', update, true);
      window.removeEventListener('keyup', update, true);
      window.removeEventListener('blur', reset);
    };
  }, []);
}

/** Re-dispatches a wheel event on React Flow's zoom pane (overlays would swallow it). */
export function forwardWheel(event: WheelEvent | React.WheelEvent, container: HTMLElement | null) {
  const pane = container?.querySelector('.react-flow__renderer');
  if (!pane) return;
  const e = 'nativeEvent' in event ? event.nativeEvent : event;
  pane.dispatchEvent(
    new WheelEvent('wheel', {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}
