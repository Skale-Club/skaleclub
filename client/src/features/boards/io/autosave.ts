import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { apiRequest, HttpError } from '@/lib/queryClient';
import { normalizeDocument } from '@shared/boards/document';
import type { Board, BoardDocument, BoardVisibility } from '@shared/schema';
import { effectiveTitle, getDocumentForSave, selectIsDirty, selectViewportDirty, type BoardStore } from '../store/boardStore';

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
// Rendering the card thumbnail walks the whole DOM: it never holds up a save
// and runs at most this often (plus on close and on an explicit Save).
const THUMBNAIL_INTERVAL_MS = 20_000;

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

/**
 * A snapshot worth offering: based on the stored version (nothing saved since
 * it was written, a thumbnail-only save included), or written after the server
 * copy was last saved.
 */
export function isSnapshotNewer(snapshot: BoardSnapshot | null, board: Pick<Board, 'updatedAt' | 'version'>): snapshot is BoardSnapshot {
  if (!snapshot) return false;
  if (snapshot.baseVersion !== null && snapshot.baseVersion === board.version) return true;
  const serverTime = board.updatedAt ? new Date(board.updatedAt).getTime() : 0;
  return snapshot.savedAt > serverTime;
}

// ---------------------------------------------------------------------------

export interface UseBoardAutosaveOptions {
  boardId: string;
  store: BoardStore;
  /** False until the board is loaded (and while a restore prompt is open). */
  enabled: boolean;
  /** Renders the card thumbnail (sent apart from the document, throttled); a rejection keeps the old one. */
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
  // The document changed on the server since the thumbnail was last sent.
  const thumbnailPendingRef = useRef(false);
  const thumbnailSentAtRef = useRef(0);
  const thumbnailTimerRef = useRef<number | null>(null);

  // After a save: the snapshot holds what is still unsaved, on top of the
  // version just stored (or goes away when nothing is).
  const refreshSnapshot = () => {
    const s = store.getState();
    if (!selectIsDirty(s)) clearSnapshot(boardId);
    else writeSnapshot(boardId, { savedAt: Date.now(), baseVersion: baseVersionRef.current, title: s.title, document: getDocumentForSave(s) });
  };

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
      // A cleared title field is not a new title: the saved one is kept.
      title: effectiveTitle(state),
    };
    const document = getDocumentForSave(state);
    setSaving(true);
    try {
      const response = await apiRequest('PUT', `/api/boards/${boardId}`, {
        title: sent.title,
        document,
        ...(extra ?? {}),
        baseVersion: overwrite ? undefined : (baseVersionRef.current ?? undefined),
      });
      const updated = (await response.json()) as Board;
      baseVersionRef.current = updated.version;
      store.getState().markSaved(sent);
      setConflict(false);
      setOffline(false);
      setLastSavedAt(Date.now());
      refreshSnapshot();
      callbacksRef.current.onSaved?.(updated);
      if (documentChanged || overwrite) {
        thumbnailPendingRef.current = true;
        scheduleThumbnail();
      }
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
    // scheduleRetry / scheduleThumbnail are stable (declared below with refs only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, store]);

  const save = useCallback((opts: SaveOptions = {}): Promise<Board | null> => {
    clearTimer();
    const next = chainRef.current.then(() => runSave(opts), () => runSave(opts));
    chainRef.current = next.catch(() => undefined);
    return next;
  }, [runSave]);

  // Renders the thumbnail and sends it on its own ({thumbnailUrl, baseVersion},
  // no document) behind the saves already queued, so it carries the version
  // our last save returned and never conflicts with it.
  const sendThumbnail = useCallback(async (): Promise<void> => {
    if (thumbnailTimerRef.current !== null) window.clearTimeout(thumbnailTimerRef.current);
    thumbnailTimerRef.current = null;
    if (!thumbnailPendingRef.current || !enabledRef.current || conflictRef.current) return;
    const render = callbacksRef.current.getThumbnail;
    thumbnailPendingRef.current = false;
    if (!render) return;
    thumbnailSentAtRef.current = Date.now();
    const thumbnailUrl = await render().catch((err) => {
      console.warn('Failed to render board thumbnail', err);
      return undefined;
    });
    if (thumbnailUrl === undefined) return;
    const run = async () => {
      if (!enabledRef.current || conflictRef.current) return;
      try {
        const response = await apiRequest('PUT', `/api/boards/${boardId}`, {
          thumbnailUrl,
          baseVersion: baseVersionRef.current ?? undefined,
        });
        const updated = (await response.json()) as Board;
        baseVersionRef.current = updated.version;
        // Nothing to clear here, but a pending snapshot must name the new version.
        if (selectIsDirty(store.getState())) refreshSnapshot();
        callbacksRef.current.onSaved?.(updated);
      } catch (err) {
        // Only a card preview: a save from elsewhere is reported by the next
        // document save; anything else is retried after the next one.
        if (conflictCode(err) !== 'version_conflict') thumbnailPendingRef.current = true;
      }
    };
    const next = chainRef.current.then(run, run);
    chainRef.current = next;
    await next;
    // refreshSnapshot only reads refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, store]);

  function scheduleThumbnail() {
    if (!thumbnailPendingRef.current || thumbnailTimerRef.current !== null) return;
    const wait = Math.max(0, THUMBNAIL_INTERVAL_MS - (Date.now() - thumbnailSentAtRef.current));
    thumbnailTimerRef.current = window.setTimeout(() => {
      thumbnailTimerRef.current = null;
      void sendThumbnail();
    }, wait);
  }

  /** Sends a pending thumbnail now (closing, explicit Save) instead of waiting for the throttle. */
  const flushThumbnail = useCallback(() => sendThumbnail(), [sendThumbnail]);

  /** Saves now if anything is pending (thumbnail included); resolves false when changes remain unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    try {
      await save();
    } catch {
      // reported through status / onError
    }
    await sendThumbnail();
    return !selectIsDirty(store.getState());
  }, [save, sendThumbnail, store]);

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
    if (thumbnailTimerRef.current !== null) window.clearTimeout(thumbnailTimerRef.current);
  }, []);

  const status: SaveStatus = conflict ? 'conflict' : saving ? 'saving' : offline && isDirty ? 'offline' : isDirty ? 'dirty' : 'saved';

  /** Seeds/updates the version the next save is based on (on load and after "Load saved version"). */
  const setBaseVersion = useCallback((version: number | null) => {
    baseVersionRef.current = version;
  }, []);
  const getBaseVersion = useCallback(() => baseVersionRef.current, []);
  const dismissConflict = useCallback(() => setConflict(false), []);

  return useMemo(
    () => ({ status, isDirty, lastSavedAt, save, flush, flushThumbnail, setBaseVersion, getBaseVersion, dismissConflict }),
    [status, isDirty, lastSavedAt, save, flush, flushThumbnail, setBaseVersion, getBaseVersion, dismissConflict],
  );
}
