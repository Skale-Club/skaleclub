// Excalidraw loads its hand-drawn fonts at runtime from EXCALIDRAW_ASSET_PATH,
// falling back to esm.sh. Production builds ship the fonts at /excalidraw/
// (see excalidrawFonts in vite.config.ts). Import this before Excalidraw.
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

if (import.meta.env.PROD) {
  window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

export {};
