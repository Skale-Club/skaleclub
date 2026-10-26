import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { apiRequest, HttpError } from '@/lib/queryClient';
import { normalizeDocument } from '@shared/boards/document';
import type { Board, BoardDocument, BoardVisibility } from '@shared/schema';
import { getDocumentForSave, selectIsDirty, selectViewportDirty, type BoardStore } from '../store/boardStore';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict';

/** Fields other than the document that a save can carry (share menu, rename). */
export interface SaveExtras {
  visibility?: BoardVisibility;
  slug?: string;
}

export interface SaveOptions {
  /** Save even if another tab or device saved since this one loaded. */
  overwrite?: boolean;
  extra?: SaveExtras;
}

const DOCUMENT_DELAY_MS = 1_500;
// Panning alone is saved quietly and less eagerly.
const VIEWPORT_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 10_000;
const SNAPSHOT_THROTTLE_MS = 1_000;

// The body of a 409 the server sends when the board was saved elsewhere.
export function conflictCode(err: unknown): string | null {
  if (!(err instanceof HttpError) || err.status !== 409) return null;
  try {
    return JSON.parse(err.message.slice(err.message.indexOf(':') + 1)).code ?? null;
  } catch {
    return null;
  }
}

function isNetworkError(err: unknown) {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

// ---------------------------------------------------------------------------
// localStorage safety net: written while there are unsaved changes, cleared on
// a successful save, offered back when the editor reopens.

export interface BoardSnapshot {
  savedAt: number;
  baseVersion: number | null;
  title: string;
  document: BoardDocument;
}

const snapshotKey = (boardId: string) => `skale:board-snapshot:${boardId}`;

export function readSnapshot(boardId: string): BoardSnapshot | null {
  try {
    const raw = window.localStorage.getItem(snapshotKey(boardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoardSnapshot>;
    if (typeof parsed.savedAt !== 'number' || !parsed.document) return null;
    return {
      savedAt: parsed.savedAt,
      baseVersion: typeof parsed.baseVersion === 'number' ? parsed.baseVersion : null,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      document: normalizeDocument(parsed.document),
    };
  } catch {
    return null;
  }
}

export function writeSnapshot(boardId: string, snapshot: BoardSnapshot) {
  try {
    window.localStorage.setItem(snapshotKey(boardId), JSON.stringify(snapshot));
  } catch {
    // Quota exceeded or storage blocked: the snapshot is best effort.
  }
}

export function clearSnapshot(boardId: string) {
  try {
    window.localStorage.removeItem(snapshotKey(boardId));
  } catch {
    // ignore
  }
}

/** A snapshot worth offering: written after the server copy was last saved. */
export function isSnapshotNewer(snapshot: BoardSnapshot | null, board: Pick<Board, 'updatedAt' | 'version'>): snapshot is BoardSnapshot {
  if (!snapshot) return false;
  const serverTime = board.updatedAt ? new Date(board.updatedAt).getTime() : 0;
  return snapshot.savedAt > serverTime;
}

// ---------------------------------------------------------------------------

export interface UseBoardAutosaveOptions {
  boardId: string;
  store: BoardStore;
  /** False until the board is loaded (and while a restore prompt is open). */
  enabled: boolean;
  /** Renders the card thumbnail; a rejection keeps the old one. */
  getThumbnail?: () => Promise<string | null>;
  onSaved?: (board: Board) => void;
  onError?: (err: Error) => void;
}

export function useBoardAutosave({ boardId, store, enabled, getThumbnail, onSaved, onError }: UseBoardAutosaveOptions) {
  const isDirty = useStore(store, selectIsDirty);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // The stored version the editor's content is based on (sent with each save).
  const baseVersionRef = useRef<number | null>(null);
  const conflictRef = useRef(false);
  conflictRef.current = conflict;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const callbacksRef = useRef({ getThumbnail, onSaved, onError });
  callbacksRef.current = { getThumbnail, onSaved, onError };
  const timerRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  // Saves run one after another so each one sends the version the last returned.
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const runSave = useCallback(async ({ overwrite = false, extra }: SaveOptions): Promise<Board | null> => {
    if (!enabledRef.current) return null;
    if (conflictRef.current && !overwrite) return null;
    const state = store.getState();
    const documentChanged = state.documentVersion !== state.savedVersion;
    const hasExtra = !!extra && Object.keys(extra).length > 0;
    if (!documentChanged && !selectIsDirty(state) && !selectViewportDirty(state) && !hasExtra && !overwrite) return null;

    // Snapshot first: anything edited while the request is in flight stays unsaved.
    const sent = {
      documentVersion: state.documentVersion,
      viewportVersion: state.viewportVersion,
      title: state.title.trim() || state.savedTitle,
    };
    const document = getDocumentForSave(state);
    setSaving(true);
    try {
      let thumbnailUrl: string | null | undefined;
      if (documentChanged || overwrite) {
        thumbnailUrl = await (callbacksRef.current.getThumbnail?.() ?? Promise.resolve(undefined)).catch((err) => {
          console.warn('Failed to render board thumbnail', err);
          return undefined;
        });
      }
      const response = await apiRequest('PUT', `/api/boards/${boardId}`, {
        title: sent.title,
        document,
        ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
        ...(extra ?? {}),
        baseVersion: overwrite ? undefined : (baseVersionRef.current ?? undefined),
      });
      const updated = (await response.json()) as Board;
      baseVersionRef.current = updated.version;
      store.getState().markSaved(sent);
      setConflict(false);
      setOffline(false);
      setLastSavedAt(Date.now());
      if (!selectIsDirty(store.getState())) clearSnapshot(boardId);
      callbacksRef.current.onSaved?.(updated);
      return updated;
    } catch (err: any) {
      if (conflictCode(err) === 'version_conflict') {
        setConflict(true);
      } else if (isNetworkError(err)) {
        setOffline(true);
        scheduleRetry();
      } else {
        callbacksRef.current.onError?.(err);
        if (err instanceof HttpError && err.status >= 500) scheduleRetry();
      }
      throw err;
    } finally {
      setSaving(false);
    }
    // scheduleRetry is stable (declared below with refs only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, store]);

  const save = useCallback((opts: SaveOptions = {}): Promise<Board | null> => {
    clearTimer();
    const next = chainRef.current.then(() => runSave(opts), () => runSave(opts));
    chainRef.current = next.catch(() => undefined);
    return next;
  }, [runSave]);

  /** Saves now if anything is pending; resolves false when changes remain unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    try {
      await save();
    } catch {
      // reported through status / onError
    }
    return !selectIsDirty(store.getState());
  }, [save, store]);

  function scheduleRetry() {
    if (retryRef.current !== null) return;
    retryRef.current = window.setTimeout(() => {
      retryRef.current = null;
      void save().catch(() => undefined);
    }, RETRY_DELAY_MS);
  }

  // Debounced autosave + throttled local snapshot, driven by store changes.
  useEffect(() => {
    if (!enabled) return;
    let lastSnapshot = 0;
    let snapshotTimer: number | null = null;
    const snapshotNow = () => {
      snapshotTimer = null;
      lastSnapshot = Date.now();
      const s = store.getState();
      if (!selectIsDirty(s)) return;
      writeSnapshot(boardId, { savedAt: Date.now(), baseVersion: baseVersionRef.current, title: s.title, document: getDocumentForSave(s) });
    };
    const schedule = (delay: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void save().catch(() => undefined);
      }, delay);
    };
    // Changes made before saving was enabled (a restored snapshot) go out too.
    if (!conflictRef.current && selectIsDirty(store.getState())) schedule(DOCUMENT_DELAY_MS);
    const unsubscribe = store.subscribe((s, prev) => {
      const docChanged = s.documentVersion !== prev.documentVersion || s.title !== prev.title;
      const viewChanged = s.viewportVersion !== prev.viewportVersion;
      if (!docChanged && !viewChanged) return;
      if (docChanged && selectIsDirty(s) && snapshotTimer === null) {
        snapshotTimer = window.setTimeout(snapshotNow, Math.max(0, SNAPSHOT_THROTTLE_MS - (Date.now() - lastSnapshot)));
      }
      if (conflictRef.current) return;
      const dirty = selectIsDirty(s);
      if (!dirty && !selectViewportDirty(s)) {
        clearTimer();
        return;
      }
      schedule(dirty ? DOCUMENT_DELAY_MS : VIEWPORT_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (snapshotTimer !== null) {
        window.clearTimeout(snapshotTimer);
        snapshotNow();
      }
      clearTimer();
    };
  }, [boardId, enabled, save, store]);

  // Back online: send what is pending.
  useEffect(() => {
    if (!offline) return;
    const onOnline = () => void save().catch(() => undefined);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [offline, save]);

  useEffect(() => () => {
    if (retryRef.current !== null) window.clearTimeout(retryRef.current);
  }, []);

  const status: SaveStatus = conflict ? 'conflict' : saving ? 'saving' : offline && isDirty ? 'offline' : isDirty ? 'dirty' : 'saved';

  /** Seeds/updates the version the next save is based on (on load and after "Load saved version"). */
  const setBaseVersion = useCallback((version: number | null) => {
    baseVersionRef.current = version;
  }, []);
  const getBaseVersion = useCallback(() => baseVersionRef.current, []);
  const dismissConflict = useCallback(() => setConflict(false), []);

  return useMemo(
    () => ({ status, isDirty, lastSavedAt, save, flush, setBaseVersion, getBaseVersion, dismissConflict }),
    [status, isDirty, lastSavedAt, save, flush, setBaseVersion, getBaseVersion, dismissConflict],
  );
}
