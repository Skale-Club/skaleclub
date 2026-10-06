import { useEffect, useRef } from "react";
import { AlertTriangle, ImagePlus } from "lucide-react";
import { INK } from "./primitives";

/**
 * Sidebar block that picks the folder's cover photo: the site's hero image by
 * default, or a file / URL chosen for this print run. A brochure must never
 * quietly go to print with whatever happens to be in a settings field, so the
 * current choice is always shown.
 *
 * Owns the object URL of a picked file: object URLs outlive the element that
 * used them, so the previous one is released on every change and on unmount.
 */
export function CoverPhotoPicker({
  coverPhoto,
  isOverride,
  onChange,
}: {
  /** The photo the cover prints now (override or site hero). */
  coverPhoto: string;
  isOverride: boolean;
  /** A URL to print instead of the site's image, or `null` to go back to it. */
  onChange: (url: string | null) => void;
}) {
  const objectUrl = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const release = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };
  const setFile = (file: File) => {
    release();
    objectUrl.current = URL.createObjectURL(file);
    onChange(objectUrl.current);
  };
  const reset = () => {
    release();
    onChange(null);
  };
  useEffect(() => release, []);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <ImagePlus className="w-3.5 h-3.5" />
        Foto da capa
      </label>

      {coverPhoto ? (
        <div className="mt-2 flex items-start gap-3">
          <img
            src={coverPhoto}
            alt="Prévia da foto da capa"
            className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
            data-testid="img-cover-preview"
          />
          <p className="text-[11px] leading-snug text-slate-500">
            {isOverride
              ? "Foto escolhida para esta impressão."
              : "Usando a imagem do hero do site."}
          </p>
        </div>
      ) : (
        <div
          className="mt-2 flex items-start gap-2 rounded-lg border p-2.5"
          style={{ borderColor: "#FDBA74", backgroundColor: "#FFF7ED" }}
          data-testid="warning-no-cover"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <p className="text-[11px] leading-snug text-amber-800">
            Sem foto de capa. O site não tem imagem de hero definida. Escolha
            um arquivo abaixo, senão a capa sai sem foto.
          </p>
        </div>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-slate-50"
        style={{ borderColor: "#E2E8F0", color: INK.navy }}
        data-testid="button-choose-cover"
      >
        Escolher arquivo…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="input-cover-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setFile(file);
          e.target.value = "";
        }}
      />
      <input
        type="url"
        placeholder="ou cole a URL de uma imagem"
        className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400"
        style={{ borderColor: "#E2E8F0", backgroundColor: "#fff", color: INK.navy }}
        data-testid="input-cover-url"
        // Applied on Enter or blur, not per keystroke: a half-typed URL
        // is a broken image on the cover and a request to nowhere.
        // Only a typed value applies. An empty blur must not clear a
        // photo just chosen from disk; the reset link below does that.
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (value) onChange(value);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const value = (e.target as HTMLInputElement).value.trim();
          if (value) onChange(value);
        }}
      />
      {isOverride && (
        <button
          onClick={reset}
          className="mt-1.5 text-[11px] underline text-slate-500 hover:text-slate-700"
          data-testid="button-reset-cover"
        >
          Voltar a usar a imagem do site
        </button>
      )}
    </div>
  );
}
