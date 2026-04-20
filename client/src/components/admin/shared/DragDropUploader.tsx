import { useRef, useState } from 'react';
import { Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface DragDropUploaderProps {
  /** Current image URL (if previously uploaded). Renders as thumbnail. */
  value?: string;
  /** Which asset bucket on the server to target. */
  assetType: 'avatar' | 'background' | 'linkIcon';
  /** Called with the public URL from the server after successful upload. */
  onChange: (url: string) => void;
  /** Human-readable label for the uploader (e.g. "Avatar", "Background Image"). */
  label: string;
  /** Optional helper text below the drop zone (e.g. "PNG, JPG, WebP up to 2 MB"). */
  helperText?: string;
  /** Thumbnail aspect. Default: 'square' (64x64). Use 'wide' for background (120x64). */
  thumbnailShape?: 'square' | 'wide';
  /** Optional className on the outer wrapper. */
  className?: string;
}

type UploaderState = 'idle' | 'uploading' | 'success' | 'error';

const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
];
const MAX_BYTES = 2 * 1024 * 1024;

export function DragDropUploader({
  value,
  assetType,
  onChange,
  label,
  helperText,
  thumbnailShape = 'square',
  className,
}: DragDropUploaderProps) {
  const { toast } = useToast();
  const [state, setState] = useState<UploaderState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setErrorMsg('');
    if (!ALLOWED_MIME.includes(file.type)) {
      setState('error');
      setErrorMsg('Unsupported file type');
      toast({
        title: 'Upload failed',
        description: 'Please choose a PNG, JPEG, WebP, GIF, SVG, or AVIF image.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState('error');
      setErrorMsg('File too large (max 2 MB)');
      toast({
        title: 'Upload failed',
        description: 'Max file size is 2 MB.',
        variant: 'destructive',
      });
      return;
    }
    setState('uploading');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('Read failed'));
        r.readAsDataURL(file);
      });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',', 2)[1] : dataUrl;
      const res = await fetch('/api/uploads/links-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: file.name, data: base64, assetType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      onChange(url);
      setState('success');
      setTimeout(() => setState('idle'), 2000);
    } catch (err: any) {
      setState('error');
      setErrorMsg(err?.message ?? 'Upload failed');
      toast({
        title: 'Upload failed',
        description: err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={label}
        className={cn(
          'relative flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border cursor-pointer transition-colors',
          isDragOver && 'bg-primary/5 border-primary',
          state === 'error' && 'border-destructive',
          state === 'success' && 'border-green-500',
        )}
      >
        {/* Thumbnail */}
        <div
          className={cn(
            'shrink-0 flex items-center justify-center rounded-md bg-muted overflow-hidden',
            thumbnailShape === 'wide' ? 'w-[120px] h-16' : 'w-16 h-16',
          )}
        >
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {/* State messaging */}
        <div className="flex-1 min-w-0">
          {state === 'idle' && (
            <>
              <p className="text-sm font-medium">
                {value ? 'Replace image' : 'Drop image here or click to browse'}
              </p>
              {helperText && (
                <p className="text-xs text-muted-foreground mt-0.5">{helperText}</p>
              )}
            </>
          )}
          {state === 'uploading' && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
            </div>
          )}
          {state === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" /> Uploaded ✓
            </div>
          )}
          {state === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" /> {errorMsg || 'Upload failed'}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}
