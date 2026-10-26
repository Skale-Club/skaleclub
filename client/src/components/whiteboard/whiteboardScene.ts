import { exportToCanvas, getSceneVersion } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import type { WhiteboardScene } from '@shared/schema';

// A pasted or dropped image is on the canvas before its file has loaded; saving
// in that window would store the image without its picture. Even once the file
// is in, Excalidraw still decodes it and then resizes the element, so this also
// waits for the scene to stop changing (one quiet poll). Resolves then, or
// rejects after `timeoutMs`.
export async function waitForImageFiles(api: ExcalidrawImperativeAPI, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let settledVersion: number | null = null;
  for (;;) {
    const files = api.getFiles();
    const elements = api.getSceneElements();
    const images = elements.filter((element) => element.type === 'image');
    if (images.length === 0) return;
    // A placeholder has no fileId yet; a failed image is marked "error" and is
    // not waited for.
    const loading = images.some(
      (element) => element.status !== 'error' && (!element.fileId || !files[element.fileId]),
    );
    const version = getSceneVersion(elements);
    if (!loading && version === settledVersion) return;
    settledVersion = loading ? null : version;
    if (Date.now() > deadline) throw new Error('An image is still loading. Try saving again in a moment.');
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

// Only the parts of the editor state that change how the board looks are
// stored; selection, zoom and open menus stay per-session.
export function serializeWhiteboardScene(api: ExcalidrawImperativeAPI): WhiteboardScene {
  const elements = api.getSceneElements();
  const appState = api.getAppState();
  const allFiles = api.getFiles();
  const usedFileIds = new Set<string>(
    elements.flatMap((element) => (element.type === 'image' && element.fileId ? [element.fileId] : [])),
  );
  const files = Object.fromEntries(Object.entries(allFiles).filter(([id]) => usedFileIds.has(id)));
  return {
    elements: elements as unknown as WhiteboardScene['elements'],
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      theme: appState.theme,
      gridModeEnabled: appState.gridModeEnabled,
      gridSize: appState.gridSize,
    },
    files: files as unknown as WhiteboardScene['files'],
  };
}

export function toInitialData(scene: WhiteboardScene | null | undefined): ExcalidrawInitialDataState {
  return {
    elements: (scene?.elements ?? []) as unknown as ExcalidrawInitialDataState['elements'],
    appState: (scene?.appState ?? {}) as ExcalidrawInitialDataState['appState'],
    files: (scene?.files ?? {}) as unknown as ExcalidrawInitialDataState['files'],
    scrollToContent: true,
  };
}

export function whiteboardPublicUrl(slug: string): string {
  return `${window.location.origin}/w/${slug}`;
}

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 360;

// 16:9 card thumbnail of the saved scene: the drawing is fitted inside and the
// rest is filled with the board's own (theme-adjusted) background. null for an
// empty board.
export async function createWhiteboardThumbnail(scene: WhiteboardScene): Promise<string | null> {
  const initial = toInitialData(scene);
  if (!initial.elements?.length) return null;
  const dark = scene.appState?.theme === 'dark';
  const drawing = await exportToCanvas({
    elements: initial.elements,
    files: initial.files ?? null,
    appState: {
      viewBackgroundColor: scene.appState?.viewBackgroundColor ?? '#ffffff',
      exportBackground: true,
      exportWithDarkMode: dark,
    },
    exportPadding: 24,
    // Render at the size it is drawn at, so small boards stay sharp.
    getDimensions: (width: number, height: number) => {
      const scale = Math.min(THUMBNAIL_WIDTH / width, THUMBNAIL_HEIGHT / height, 4);
      return { width: width * scale, height: height * scale, scale };
    },
  });

  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // The exported corner pixel is the background as rendered (dark mode inverts it).
  const [r, g, b] = drawing.getContext('2d')?.getImageData(0, 0, 1, 1).data ?? [255, 255, 255];
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  ctx.drawImage(
    drawing,
    Math.round((THUMBNAIL_WIDTH - drawing.width) / 2),
    Math.round((THUMBNAIL_HEIGHT - drawing.height) / 2),
  );
  // Safari cannot encode WebP and silently returns PNG; the server takes both.
  return canvas.toDataURL('image/webp', 0.85);
}
