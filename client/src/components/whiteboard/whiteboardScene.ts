import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import type { WhiteboardScene } from '@shared/schema';

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
