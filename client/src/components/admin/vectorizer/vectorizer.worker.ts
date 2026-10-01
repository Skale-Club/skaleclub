/// <reference lib="webworker" />
// Runs the vectorizer off the main thread. Holds the decoded image, the colour
// model and the last vector document so exports never re-trace.

import { fitWithin, type RasterImage } from '@shared/vectorizer/image';
import { analyzeImage, buildColorModel, type ColorModel } from '@shared/vectorizer/palette';
import { vectorize, type VectorDocument } from '@shared/vectorizer/pipeline';
import type { ExportFormat, WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let image: RasterImage | null = null;
let model: ColorModel | null = null;
let doc: VectorDocument | null = null;

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case 'load': {
        image = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.data) };
        model = buildColorModel(fitWithin(image, 1200));
        doc = null;
        post({ type: 'analysis', id: msg.id, analysis: analyzeImage(model) });
        break;
      }
      case 'analyze': {
        if (!model) throw new Error('No image loaded');
        post({ type: 'analysis', id: msg.id, analysis: analyzeImage(model, msg.colorCount ?? undefined) });
        break;
      }
      case 'vectorize': {
        if (!image) throw new Error('No image loaded');
        doc = vectorize(image, msg.options, (stage, fraction) => post({ type: 'progress', id: msg.id, stage, fraction }));
        const result = doc.result;
        const overlay = result.overlay;
        post(
          {
            type: 'result',
            id: msg.id,
            result: { ...result, overlay: overlay ? { width: overlay.width, height: overlay.height, data: overlay.data } : null },
          },
          overlay ? [overlay.data.buffer] : [],
        );
        if (result.overlay) result.overlay = null; // buffer was transferred
        break;
      }
      case 'mesh': {
        if (!doc) throw new Error('Nothing vectorized yet');
        const parts = doc.meshParts().map((p) => ({
          ...p,
          positions: p.positions.slice(),
          indices: p.indices.slice(),
        }));
        post({ type: 'mesh', id: msg.id, parts }, parts.flatMap((p) => [p.positions.buffer, p.indices.buffer]));
        break;
      }
      case 'export': {
        if (!doc) throw new Error('Nothing vectorized yet');
        const out = runExport(doc, msg.format, msg.name);
        const transfer = typeof out.data === 'string' ? [] : [out.data.buffer as ArrayBuffer];
        post({ type: 'export', id: msg.id, ...out }, transfer);
        break;
      }
    }
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};

function runExport(d: VectorDocument, format: ExportFormat, name: string): { data: string | Uint8Array; mime: string; filename: string } {
  switch (format) {
    case 'svg':
      return { data: d.svg(), mime: 'image/svg+xml', filename: `${name}.svg` };
    case 'svg-base':
      return { data: d.svg({ includeBase: true }), mime: 'image/svg+xml', filename: `${name}-with-base.svg` };
    case 'svg-stacked':
      return { data: d.stackedSvg(), mime: 'image/svg+xml', filename: `${name}-stacked.svg` };
    case 'layers-zip':
      return { data: d.exportLayersZip(), mime: 'application/zip', filename: `${name}-layers.zip` };
    case '3mf':
      return { data: d.export3mf(name), mime: 'model/3mf', filename: `${name}.3mf` };
    case 'stl-zip':
      return { data: d.exportStlZip(), mime: 'application/zip', filename: `${name}-stl.zip` };
  }
}
