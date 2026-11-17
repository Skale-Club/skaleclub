import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveRequestError, liveRequest, readController, storeController } from '@/lib/liveSharing';
import type { LiveCommand, LiveSessionView, LiveSnapshot, LiveState } from '@shared/liveSharing';

export function useLiveSession(id: string, presenter: boolean) {
  const base = `/${encodeURIComponent(id)}`;
  const [state, setState] = useState<LiveState | null>(null);
  const stateRef = useRef<LiveState | null>(null);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [requiresCode, setRequiresCode] = useState(false);
  const [codeRequired, setCodeRequired] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<'failed' | 'link' | 'code' | 'controller' | 'stale' | ''>('');
  const [connected, setConnected] = useState(false);
  const [controller, setController] = useState(() => presenter ? readController(id) : null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  // Audience secrets only live in the URL fragment and this tab's memory.
  const joinToken = useRef(new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const alive = useRef(true);

  const applyState = useCallback((next: LiveState) => {
    if (!alive.current || (stateRef.current && next.revision < stateRef.current.revision)) return;
    if (stateRef.current && ['ended', 'expired'].includes(stateRef.current.status)) return;
    stateRef.current = next;
    setState(next);
    if (next.status === 'ended' || next.status === 'expired') {
      setTerminal(true);
      setSnapshot(null);
      setShareUrl('');
      storeController(id, null);
    }
  }, [id]);

  const loseController = useCallback(() => {
    setController(null);
    storeController(id, null);
    setShareUrl('');
    setError('controller');
  }, [id]);

  const applyView = useCallback((view: LiveSessionView) => {
    if (!alive.current) return;
    applyState(view.state);
    if (!['ended', 'expired'].includes(view.state.status) && !['ended', 'expired'].includes(stateRef.current?.status || '')) setSnapshot(view.snapshot);
    setRequiresCode(view.requiresAccessCode);
    setCodeRequired(false);
    setAuthorized(true);
    setError('');
    setConnected(true);
  }, [applyState]);

  const handleError = useCallback((err: unknown) => {
    if (!alive.current) return;
    if (err instanceof LiveRequestError) {
      if (err.state) applyState(err.state);
      if (err.status === 410 || err.status === 404) {
        setTerminal(true); setSnapshot(null); setShareUrl(''); return;
      }
      if (err.code === 'access_code_required' || err.code === 'incorrect_code') {
        setCodeRequired(true);
        setError(err.code === 'incorrect_code' ? 'code' : '');
        return;
      }
      if (err.status === 401 || err.status === 403) {
        setAuthorized(false); setSnapshot(null); setError('link'); return;
      }
    }
    setError('failed');
    setConnected(false);
  }, [applyState]);

  const refresh = useCallback(async () => {
    try {
      const view = await liveRequest<LiveSessionView>(`${base}/${presenter ? 'presenter' : 'view'}`);
      applyView(view);
    } catch (err) { handleError(err); }
    finally { if (alive.current) setLoading(false); }
  }, [base, presenter, applyView, handleError]);

  const join = useCallback(async (code?: string) => {
    if (!joinToken.current || pendingRef.current) return;
    pendingRef.current = true; setPending(true); setError('');
    try {
      const view = await liveRequest<LiveSessionView>(`${base}/join`, { token: joinToken.current, ...(code ? { code } : {}) });
      applyView(view);
      if (alive.current) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        joinToken.current = null;
      }
    } catch (err) { handleError(err); }
    finally {
      pendingRef.current = false;
      if (alive.current) { setPending(false); setLoading(false); }
    }
  }, [base, applyView, handleError]);

  useEffect(() => {
    alive.current = true;
    if (!presenter && joinToken.current) void join();
    else void refresh();
    return () => { alive.current = false; };
  }, [presenter, join, refresh]);

  useEffect(() => {
    if (!authorized || terminal) return;
    const events = new EventSource(`/api/live-sessions${base}/events${presenter ? '?role=presenter' : ''}`);
    events.onopen = () => setConnected(true);
    events.onerror = () => {
      setConnected(false);
      // EventSource hides HTTP status. Recheck access so a missed revoke/end
      // cannot leave stale private content visible throughout reconnects.
      void refresh().finally(() => {
        if (alive.current && events.readyState !== EventSource.OPEN) setConnected(false);
      });
    };
    events.addEventListener('state', (event) => {
      try {
        const next = JSON.parse((event as MessageEvent).data) as LiveState;
        if (next.id !== id || !Number.isInteger(next.revision)) return;
        applyState(next);
        setConnected(true);
        if (next.status === 'ended' || next.status === 'expired') events.close();
      } catch { setConnected(false); }
    });
    const visibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { events.close(); document.removeEventListener('visibilitychange', visibility); };
  }, [authorized, terminal, base, id, presenter, applyState, refresh]);

  useEffect(() => {
    if (!presenter || !authorized || !controller || terminal) return;
    let active = true;
    let inFlight = false;
    async function heartbeat() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await liveRequest<{ state: LiveState; audienceCount: number }>(`${base}/heartbeat`, { controllerToken: controller });
        if (active) { applyState(result.state); setAudienceCount(result.audienceCount); }
      } catch (err) {
        if (!active) return;
        if (err instanceof LiveRequestError && err.status === 403) loseController();
        else if (err instanceof LiveRequestError && err.status === 410) handleError(err);
        else setConnected(false);
      } finally { inFlight = false; }
    }
    void heartbeat();
    const timer = window.setInterval(heartbeat, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [presenter, authorized, controller, terminal, base, applyState, loseController, handleError]);

  async function action(run: () => Promise<void>) {
    if (pendingRef.current || terminal) return;
    pendingRef.current = true; setPending(true); setError('');
    try { await run(); }
    catch (err) {
      if (err instanceof LiveRequestError && err.status === 403) loseController();
      else if (err instanceof LiveRequestError && err.status === 409) {
        if (err.state) applyState(err.state);
        setError('stale');
      } else handleError(err);
    } finally { pendingRef.current = false; if (alive.current) setPending(false); }
  }

  const command = (command: LiveCommand['command']) => action(async () => {
    if (!controller || !stateRef.current) return;
    const result = await liveRequest<{ state: LiveState }>(`${base}/command`, {
      controllerToken: controller, expectedRevision: stateRef.current.revision,
      commandId: crypto.randomUUID(), command,
    });
    applyState(result.state);
  });

  const takeover = () => action(async () => {
    const result = await liveRequest<LiveSessionView & { controllerToken: string }>(`${base}/takeover`, {});
    if (!alive.current) return;
    storeController(id, result.controllerToken); setController(result.controllerToken);
    applyView(result);
  });

  const share = () => action(async () => {
    if (!controller) return;
    const result = await liveRequest<{ audienceToken: string }>(`${base}/share`, { controllerToken: controller });
    if (alive.current) setShareUrl(`${window.location.origin}/live/${encodeURIComponent(id)}#token=${encodeURIComponent(result.audienceToken)}`);
  });

  const revoke = () => action(async () => {
    if (!controller) return;
    const result = await liveRequest<{ state: LiveState }>(`${base}/revoke`, { controllerToken: controller });
    applyState(result.state); setShareUrl('');
  });

  const retry = () => !presenter && joinToken.current ? join() : refresh();

  return { state, snapshot, requiresCode, codeRequired, authorized, terminal, loading, pending, error, connected,
    controller: !!controller, audienceCount, shareUrl, join, refresh, retry, command, takeover, share, revoke };
}
