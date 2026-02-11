
import { useEffect, useState } from "react";
import Uppy from "@uppy/core";
import { Dashboard } from "@uppy/react";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Upload, X } from "lucide-react";

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
          fields: {},
          headers: {
            "Content-Type": file.type,
          },
        };
      },
    });
    
    return uppyInstance;
  });

  useEffect(() => {
    const onUploadSuccess = (file: any, response: any) => {
        const objectPath = file.meta.objectPath;
        if (objectPath) {
            onUploadComplete(objectPath);
            setOpen(false);
        }
    };
    
    uppy.on('upload-success', onUploadSuccess);
    
    return () => {
        uppy.off('upload-success', onUploadSuccess);
    };
  }, [uppy, onUploadComplete]);

  return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <div className={`cursor-pointer group relative w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors ${className}`}>
            {defaultImage ? (
                <img src={defaultImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
                <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <p className="text-white text-xs font-medium">Change</p>
             </div>
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
           <div className="h-[400px] w-full">
             <Dashboard uppy={uppy} hideUploadButton={false} width="100%" height="100%" showProgressDetails={true} />
           </div>
        </DialogContent>
      </Dialog>
  );
}
