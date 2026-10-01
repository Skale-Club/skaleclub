import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageAnalysis, MeshPart, VectorizeOptions, VectorizeResult } from '@shared/vectorizer/types';
import type { ExportFormat, WorkerRequest, WorkerRequestBody, WorkerResponse } from './protocol';

type Pending = { resolve: (msg: WorkerResponse) => void; reject: (err: Error) => void };

export interface VectorizeState {
  result: VectorizeResult | null;
  busy: boolean;
  stage: string | null;
  progress: number;
  error: string | null;
}

/**
 * Talks to the vectorizer worker. Vectorize requests are coalesced: while one
 * runs, only the newest pending options are kept, so dragging a slider never
 * queues up a backlog of traces.
 */
export function useVectorizerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const running = useRef(false);
  const queued = useRef<VectorizeOptions | null>(null);
  const [state, setState] = useState<VectorizeState>({ result: null, busy: false, stage: null, progress: 0, error: null });

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(new URL('./vectorizer.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          setState((s) => ({ ...s, stage: msg.stage, progress: msg.fraction }));
          return;
        }
        const p = pending.current.get(msg.id);
        if (!p) return;
        pending.current.delete(msg.id);
        if (msg.type === 'error') p.reject(new Error(msg.message));
        else p.resolve(msg);
      };
      worker.onerror = (event) => {
        const err = new Error(event.message || 'Vectorizer worker crashed');
        pending.current.forEach((p) => p.reject(err));
        pending.current.clear();
        running.current = false;
        setState((s) => ({ ...s, busy: false, error: err.message }));
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const request = useCallback(
    <T extends WorkerResponse['type']>(msg: WorkerRequestBody, transfer: Transferable[] = []) => {
      const id = nextId.current++;
      return new Promise<Extract<WorkerResponse, { type: T }>>((resolve, reject) => {
        pending.current.set(id, { resolve: resolve as (m: WorkerResponse) => void, reject });
        getWorker().postMessage({ ...msg, id } as WorkerRequest, transfer);
      });
    },
    [getWorker],
  );

  const load = useCallback(
    async (image: { width: number; height: number; data: Uint8ClampedArray }): Promise<ImageAnalysis> => {
      queued.current = null;
      setState({ result: null, busy: false, stage: null, progress: 0, error: null });
      const buffer = image.data.buffer.slice(0) as ArrayBuffer;
      const res = await request<'analysis'>({ type: 'load', width: image.width, height: image.height, data: buffer }, [buffer]);
      return res.analysis;
    },
    [request],
  );

  const analyze = useCallback(
    async (colorCount: number | null): Promise<ImageAnalysis> => (await request<'analysis'>({ type: 'analyze', colorCount })).analysis,
    [request],
  );

  const run = useCallback(
    async (options: VectorizeOptions) => {
      running.current = true;
      setState((s) => ({ ...s, busy: true, stage: 'start', progress: 0, error: null }));
      try {
        const res = await request<'result'>({ type: 'vectorize', options });
        setState((s) => ({ ...s, result: res.result, error: null }));
      } catch (err) {
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        running.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) void run(next);
        else setState((s) => ({ ...s, busy: false, stage: null }));
      }
    },
    [request],
  );

  const vectorize = useCallback(
    (options: VectorizeOptions) => {
      if (running.current) queued.current = options;
      else void run(options);
    },
    [run],
  );

  const meshes = useCallback(async (): Promise<MeshPart[]> => (await request<'mesh'>({ type: 'mesh' })).parts, [request]);

  const exportFile = useCallback(
    async (format: ExportFormat, name: string) => {
      const res = await request<'export'>({ type: 'export', format, name });
      const blob = new Blob([res.data as BlobPart], { type: res.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return res.filename;
    },
    [request],
  );

  return { state, load, analyze, vectorize, meshes, exportFile };
}
