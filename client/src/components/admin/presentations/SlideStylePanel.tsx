import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { SlideBlock } from '@shared/schema';

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border p-0.5 bg-transparent shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="text-xs font-mono h-7 flex-1"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// Fully controlled — parent owns the full style object.
// Calls onChange with the merged, cleaned style on every field update.
export function SlideStylePanel({
  style,
  onChange,
}: {
  style: SlideBlock['style'];
  onChange: (s: SlideBlock['style']) => void;
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(key: string, value: string) {
    const raw = { ...(style ?? {}), [key]: value };
    const clean = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    );
    onChange(Object.keys(clean).length ? (clean as SlideBlock['style']) : undefined);
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest('POST', '/api/presentations/upload-image', {
        base64,
        filename: file.name,
        mimeType: file.type,
      });
      const data = await res.json() as { url: string };
      patch('bgImageUrl', data.url);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }

  const bgColor = style?.bgColor ?? '';
  const textColor = style?.textColor ?? '';
  const headingColor = style?.headingColor ?? '';
  const bgImageUrl = style?.bgImageUrl ?? '';

  return (
    <div className="space-y-3 pt-3 border-t">
      <p className="text-sm font-medium">Estilo do slide</p>
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Fundo" value={bgColor} onChange={(v) => patch('bgColor', v)} />
        <ColorField label="Texto" value={textColor} onChange={(v) => patch('textColor', v)} />
        <ColorField label="Destaque" value={headingColor} onChange={(v) => patch('headingColor', v)} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Imagem de fundo</Label>
        <div className="flex gap-2">
          <Input
            value={bgImageUrl}
            onChange={(e) => patch('bgImageUrl', e.target.value)}
            placeholder="URL ou clique em upload"
            className="text-xs flex-1 h-8"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            title="Upload image"
          >
            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          </Button>
          {bgImageUrl && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => patch('bgImageUrl', '')}
              title="Remove image"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
