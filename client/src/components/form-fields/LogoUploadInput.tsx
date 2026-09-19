import { useRef, useState } from "react";
import { AlertCircle, FileText, Trash2, UploadCloud } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "@/hooks/useTranslation";
import { Loader2 } from "@/components/ui/loader";
import type { FormUploadConfig } from "@shared/schema";

const FALLBACK_UPLOAD: FormUploadConfig = { extensions: ["png", "jpg", "jpeg", "webp", "pdf"], maxSizeMb: 5 };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Logo upload for an order form. The answer stored is the public URL returned
 * by the server; the file name rides along in `<id>__filename` so the order
 * summary and the admin lead view can show something human.
 *
 * Limits are declared on the question and re-checked by the upload route — the
 * copy here is a courtesy, not the enforcement.
 */
export function LogoUploadInput({
  formSlug,
  questionId,
  value,
  filename,
  upload,
  onUploaded,
  onCleared,
}: {
  formSlug: string;
  questionId: string;
  value: string;
  filename?: string;
  upload?: FormUploadConfig;
  onUploaded: (url: string, filename: string) => void;
  onCleared: () => void;
}) {
  const { t } = useTranslation();
  const config = upload ?? FALLBACK_UPLOAD;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = config.extensions.map((ext) => `.${ext}`).join(",");
  const extensionList = config.extensions.map((ext) => ext.toUpperCase()).join(", ");

  const handleFile = async (file: File) => {
    setError(null);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!config.extensions.includes(ext)) {
      setError(`${t("Accepted formats")}: ${extensionList}`);
      return;
    }
    if (file.size > config.maxSizeMb * 1024 * 1024) {
      setError(`${t("Maximum file size")}: ${config.maxSizeMb} MB`);
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch(`/api/forms/slug/${encodeURIComponent(formSlug)}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, filename: file.name, data: dataUrl }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.url) {
        throw new Error(json?.message || "Upload failed");
      }
      onUploaded(json.url as string, file.name);
    } catch (err: any) {
      setError(err?.message || t("Could not upload the file. Please try again."));
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (value) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-cta/30 bg-cta/5 px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-cta" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
            {filename || t("File uploaded")}
          </span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              onCleared();
            }}
            aria-label={t("Remove file")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-red-600"
            data-testid="button-upload-remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 transition-colors",
          error ? "border-red-300 bg-red-50" : "border-slate-300 hover:border-cta hover:bg-cta/5",
          isUploading && "cursor-wait opacity-70",
        )}
        data-testid="button-upload-file"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-cta" />
            <span className="text-sm font-medium text-slate-600">{t("Uploading...")}</span>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-cta" />
            <span className="text-base font-semibold text-slate-800">{t("Choose a file")}</span>
            <span className="text-xs text-slate-500">
              {extensionList} · {t("up to")} {config.maxSizeMb} MB
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
        data-testid="input-upload-file"
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
