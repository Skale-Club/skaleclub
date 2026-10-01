import type { ImageAnalysis, MeshPart, VectorizeOptions, VectorizeResult } from '@shared/vectorizer/types';

export type ExportFormat = 'svg' | 'svg-base' | 'svg-stacked' | 'layers-zip' | '3mf' | 'stl-zip';

export type WorkerRequest =
  | { type: 'load'; id: number; width: number; height: number; data: ArrayBuffer }
  | { type: 'analyze'; id: number; colorCount: number | null }
  | { type: 'vectorize'; id: number; options: VectorizeOptions }
  | { type: 'mesh'; id: number }
  | { type: 'export'; id: number; format: ExportFormat; name: string };

export type WorkerResponse =
  | { type: 'analysis'; id: number; analysis: ImageAnalysis }
  | { type: 'progress'; id: number; stage: string; fraction: number }
  | { type: 'result'; id: number; result: VectorizeResult; svg: string }
  | { type: 'mesh'; id: number; parts: MeshPart[] }
  | { type: 'export'; id: number; data: string | Uint8Array; mime: string; filename: string }
  | { type: 'error'; id: number; message: string };
