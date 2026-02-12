
import { useEffect, useState } from "react";
import Uppy from "@uppy/core";
import type { UploadResult } from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import { Upload } from "lucide-react";

interface ObjectUploaderProps {
  onUploadComplete: (url: string) => void;
  defaultImage?: string;
  className?: string;
}

export function ObjectUploader({ onUploadComplete, defaultImage, className }: ObjectUploaderProps) {
  const [open, setOpen] = useState(false);

  const [uppy] = useState(() => {
    const uppyInstance = new Uppy({
      restrictions: {
        maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE_BYTES || "1048576", 10), // Default 1MB
        allowedFileTypes: ["image/jpeg", "image/png"],
        maxNumberOfFiles: 1,
      },
      autoProceed: false,
    });

    uppyInstance.use(AwsS3, {
      shouldUseMultipart: false,
      getUploadParameters: async (file) => {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name, 
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get upload parameters");
        }

        const data = await response.json();
        
        // Store objectPath in file meta
        uppyInstance.setFileMeta(file.id, { objectPath: data.objectPath });
        
        return {
          method: "PUT",
          url: data.uploadURL,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        };
      },
    });
    
    return uppyInstance;
  });

  useEffect(() => {
    const onComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      const uploaded = (result.successful || [])[0];
      const objectPath = uploaded?.meta?.objectPath;
      if (typeof objectPath === "string" && objectPath.length > 0) {
        onUploadComplete(objectPath);
        setOpen(false);
      }
    };

    uppy.on("complete", onComplete);

    return () => {
      uppy.off("complete", onComplete);
    };
  }, [uppy, onUploadComplete]);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`cursor-pointer group relative w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors ${className || ""}`}
      >
        {defaultImage ? (
          <img src={defaultImage} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs font-medium">Change</p>
        </div>
      </button>

      <DashboardModal
        uppy={uppy}
        open={open}
        onRequestClose={() => setOpen(false)}
        proudlyDisplayPoweredByUppy={false}
        closeAfterFinish
      />
    </>
  );
}
