// Native CMYK conversion for print-ready PDFs, done fully in the browser via
// Ghostscript compiled to WebAssembly (ghostscript-wasm-esm, AGPL-3.0).
// The ~16MB wasm binary is lazy-loaded on first use; nothing is added to the
// main bundle and no server round-trip is involved.

interface GhostscriptModule {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
  };
}

let assetsPromise: Promise<{ createModule: any; wasmUrl: string }> | null = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      import("ghostscript-wasm-esm"),
      import("ghostscript-wasm-esm/gs.wasm?url"),
    ]).then(([glue, wasm]) => ({
      createModule: glue.default,
      wasmUrl: wasm.default,
    }));
  }
  return assetsPromise;
}

// Ghostscript's runtime exits after a -dBATCH run, so each conversion gets a
// fresh module instance; the wasm fetch itself is served from the HTTP cache.
async function createGhostscript(onLog?: (line: string) => void): Promise<GhostscriptModule> {
  const { createModule, wasmUrl } = await loadAssets();
  return createModule({
    noInitialRun: true,
    locateFile: (path: string) => (path.endsWith(".wasm") ? wasmUrl : path),
    print: (text: string) => onLog?.(text),
    printErr: (text: string) => onLog?.(text),
  });
}

/**
 * Converts a PDF to native CMYK (DeviceCMYK process color, /prepress quality),
 * the color model commercial print shops expect. Returns the converted bytes.
 */
export async function convertPdfToCmyk(
  input: Uint8Array,
  onLog?: (line: string) => void,
): Promise<Uint8Array> {
  const gs = await createGhostscript(onLog);
  gs.FS.writeFile("/input.pdf", input);
  const exitCode = gs.callMain([
    "-dNOPAUSE",
    "-dBATCH",
    "-dSAFER",
    "-dQUIET",
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.7",
    "-dPDFSETTINGS=/prepress",
    "-sColorConversionStrategy=CMYK",
    "-dProcessColorModel=/DeviceCMYK",
    "-dAutoRotatePages=/None",
    "-o",
    "/output.pdf",
    "/input.pdf",
  ]);
  if (exitCode !== 0) {
    throw new Error(`Ghostscript falhou com código ${exitCode}`);
  }
  return gs.FS.readFile("/output.pdf");
}
