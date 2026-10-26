import { useEffect } from 'react';
import { isClipboardText } from '@shared/boards/canvasOps';
import type { BoardStore } from '../store/boardStore';
import {
  addChild,
  addSibling,
  navigate,
  outdent,
  pasteOutlineUnder,
  removeSubtree,
  selectedMindNodeId,
  toggleCollapse,
  type MindNavDirection,
} from './actions';
import { isTypingTarget } from '../canvas/interaction';

// Focus is in a dialog or menu portaled outside the canvas: leave keys alone.
function isInOverlay(container: HTMLElement | null) {
  const active = document.activeElement;
  if (!active || active === document.body || (container && container.contains(active))) return false;
  // Panel buttons keep their own Enter/Space/Tab; text fields are typing targets.
  return !!active.closest('[role="dialog"], [role="menu"], [role="alertdialog"], [role="tablist"], [role="tabpanel"]');
}

const ARROWS: Record<string, MindNavDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * Keyboard for a selected mind node (while not editing its text):
 * Tab child, Enter sibling, Shift+Tab up a level, Delete/Backspace remove the
 * subtree, arrows navigate, Space folds, F2 or typing edits. Read-only (the
 * public viewer): arrows and Space only. Registered on window in the capture
 * phase so it runs before the canvas' generic Delete handler and the browser's
 * focus moves on Tab.
 */
export function useMindmapKeyboard(store: BoardStore, opts: { readOnly: boolean; containerRef: React.RefObject<HTMLElement> }) {
  const { readOnly, containerRef } = opts;
  useEffect(() => {
    // Space folds on key up, unless the space bar was held to pan the board.
    let spaceDown = false;
    let spacePanned = false;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target) || isInOverlay(containerRef.current)) return;
      const state = store.getState();
      if (state.editingNodeId) return;
      const id = selectedMindNodeId(store);
      if (!id) return;
      const mod = event.ctrlKey || event.metaKey;

      if (event.key === ' ' || event.code === 'Space') {
        if (mod || event.altKey) return;
        event.preventDefault();
        if (!event.repeat && !spaceDown) {
          spaceDown = true;
          spacePanned = false;
        }
        return;
      }
      const arrow = ARROWS[event.key];
      if (arrow && !mod && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        navigate(store, id, arrow);
        return;
      }
      if (readOnly || mod || event.altKey) return;

      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) outdent(store, id);
          else addChild(store, id);
          return;
        case 'Enter':
          event.preventDefault();
          addSibling(store, id);
          return;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          removeSubtree(store, id);
          return;
        case 'F2':
          event.preventDefault();
          state.setEditingNode(id);
          return;
        default:
          // A printable character starts editing with that character.
          if (event.key.length === 1 && event.key !== '?' && event.key.trim()) {
            event.preventDefault();
            state.setEditingNode(id, { seed: event.key });
          }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!(event.key === ' ' || event.code === 'Space') || !spaceDown) return;
      spaceDown = false;
      if (spacePanned) return;
      if (isTypingTarget(event.target) || store.getState().editingNodeId) return;
      const id = selectedMindNodeId(store);
      if (id) toggleCollapse(store, id);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (spaceDown && event.buttons) spacePanned = true;
    };

    // Ctrl/Cmd+V with a mind node selected: the text becomes a subtree.
    const onPaste = (event: ClipboardEvent) => {
      if (readOnly || isTypingTarget(event.target) || isInOverlay(containerRef.current) || store.getState().editingNodeId) return;
      const id = selectedMindNodeId(store);
      const text = event.clipboardData?.getData('text/plain');
      // Board content copied with Ctrl/Cmd+C is pasted by the canvas instead.
      if (!id || !text?.trim() || isClipboardText(text)) return;
      event.preventDefault();
      pasteOutlineUnder(store, id, text);
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('paste', onPaste);
    };
  }, [containerRef, readOnly, store]);
}
