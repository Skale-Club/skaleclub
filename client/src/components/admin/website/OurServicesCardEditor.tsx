import { useMemo } from 'react';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CATALOG_LIMITS, fromOurServicesCard } from '@shared/catalog';
import type { OurServicesCard } from '@shared/schema';
import { uploadFileToServer, getOriginalImageUrl } from '../shared/utils';
import { CatalogPreview } from '../catalog/CatalogPreview';
import { CategorySelect, FeatureListEditor, FormNotice, LimitedInput, catalogLimitIssues } from '../catalog/CatalogFields';

/**
 * Body of the "Edit Service Card" dialog: artwork, text, category, features,
 * and a live preview of the real public card. Edits apply immediately to the
 * homepage content; the limits are shown here and flagged in the card list.
 */
export function OurServicesCardEditor({ card, onPatch, onDone }: {
  card: OurServicesCard;
  onPatch: (patch: Partial<OurServicesCard>) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const issues = catalogLimitIssues(card);
  const previewItem = useMemo(() => fromOurServicesCard(card), [card]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const path = await uploadFileToServer(file);
      onPatch({ imageUrl: path });
      toast({ title: 'Image uploaded successfully' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void handleUpload(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <div className="space-y-4 min-w-0">
        {issues.length > 0 && (
          <FormNotice tone="error">
            <p className="font-semibold">Over the card limits:</p>
            {issues.map(issue => <p key={issue}>{issue}</p>)}
          </FormNotice>
        )}

        {/* Image */}
        <div className="space-y-1.5">
          <Label>Image</Label>
          {card.imageUrl ? (
            <div className="relative w-full h-44 rounded-lg overflow-hidden border bg-muted">
              <img src={getOriginalImageUrl(card.imageUrl)} alt="Service" className="w-full h-full object-cover" />
              <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/50 opacity-0 hover:opacity-100 transition-opacity" title="Click to replace">
                <span className="text-white text-xs font-medium">Replace</span>
                <input type="file" className="hidden" accept="image/*" onChange={onFile} />
              </label>
              <button type="button" onClick={() => onPatch({ imageUrl: '' })} className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors" title="Remove image">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground mt-1">Upload image</span>
              <input type="file" className="hidden" accept="image/*" onChange={onFile} />
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LimitedInput id="our-service-title" label="Title" value={card.title ?? ''} max={CATALOG_LIMITS.title}
            onChange={title => onPatch({ title })} placeholder="Service title" />
          <CategorySelect id="our-service-category" value={card.category}
            onChange={category => onPatch({ category: category ?? undefined })} />
        </div>
        <LimitedInput id="our-service-subtitle" label="Subtitle" value={card.subtitle ?? ''} max={CATALOG_LIMITS.subtitle}
          onChange={subtitle => onPatch({ subtitle })} placeholder="Short subtitle" />

        <div className="space-y-1.5">
          <Label htmlFor="our-service-description">Description</Label>
          <Textarea id="our-service-description" value={card.description ?? ''} onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Shown in the popup when the card is clicked" rows={3} />
        </div>

        <FeatureListEditor features={card.features ?? []} onChange={features => onPatch({ features })} />

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onDone}>Done</Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-0 lg:self-start">
        <CatalogPreview item={previewItem} cardWidth={300} />
      </aside>
    </div>
  );
}
