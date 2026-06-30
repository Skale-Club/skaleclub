import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, Briefcase, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer, getOriginalImageUrl } from '../shared/utils';
import type { HomepageContent, OurServicesCard, OurServicesSection } from '@shared/schema';

interface OurServicesTabProps {
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
}

const SECTION_DEFAULTS: OurServicesSection = { enabled: false, title: 'Our Services', subtitle: '', cards: [] };

export function OurServicesTab({ homepageContent, updateHomepageContent }: OurServicesTabProps) {
  const { toast } = useToast();

  const section: OurServicesSection = { ...SECTION_DEFAULTS, ...(homepageContent.ourServicesSection || {}) };
  const cards: OurServicesCard[] = [...(section.cards || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  const updateSection = (patch: Partial<OurServicesSection>) => {
    updateHomepageContent(prev => ({
      ...prev,
      ourServicesSection: { ...SECTION_DEFAULTS, ...(prev.ourServicesSection || {}), ...patch },
    }));
  };

  const mutateCards = (fn: (cards: OurServicesCard[]) => OurServicesCard[]) => {
    updateHomepageContent(prev => {
      const prevSection: OurServicesSection = { ...SECTION_DEFAULTS, ...(prev.ourServicesSection || {}) };
      const sorted = [...(prevSection.cards || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      const next = fn(sorted).map((c, i) => ({ ...c, order: i }));
      return { ...prev, ourServicesSection: { ...prevSection, cards: next } };
    });
  };

  const addCard = () =>
    mutateCards(cs => [...cs, { order: cs.length, title: 'New Service', subtitle: '', description: '', features: [], imageUrl: '' }]);
  const deleteCard = (idx: number) => mutateCards(cs => cs.filter((_, i) => i !== idx));
  const moveCard = (idx: number, dir: -1 | 1) =>
    mutateCards(cs => {
      const target = idx + dir;
      if (target < 0 || target >= cs.length) return cs;
      return arrayMove(cs, idx, target);
    });
  const patchCard = (idx: number, patch: Partial<OurServicesCard>) =>
    mutateCards(cs => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const addBubble = (idx: number) =>
    mutateCards(cs => cs.map((c, i) => (i === idx ? { ...c, features: [...(c.features || []), ''] } : c)));
  const editBubble = (idx: number, bidx: number, value: string) =>
    mutateCards(cs => cs.map((c, i) => (i === idx ? { ...c, features: (c.features || []).map((f, j) => (j === bidx ? value : f)) } : c)));
  const deleteBubble = (idx: number, bidx: number) =>
    mutateCards(cs => cs.map((c, i) => (i === idx ? { ...c, features: (c.features || []).filter((_, j) => j !== bidx) } : c)));

  const handleUpload = async (idx: number, file: File) => {
    try {
      const path = await uploadFileToServer(file);
      patchCard(idx, { imageUrl: path });
      toast({ title: 'Image uploaded successfully' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section header + toggle + title/subtitle */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Our Services
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dark section on the homepage (between About and the map). Cards reuse the portfolio layout, without the logo icon.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={section.enabled ?? false}
              onCheckedChange={(checked) => updateSection({ enabled: checked })}
            />
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${section.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {section.enabled ? 'Visible' : 'Hidden'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="our-services-title">Section Title</Label>
            <Input
              id="our-services-title"
              value={section.title ?? ''}
              onChange={(e) => updateSection({ title: e.target.value })}
              placeholder="Our Services"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="our-services-subtitle">Section Subtitle</Label>
            <Input
              id="our-services-subtitle"
              value={section.subtitle ?? ''}
              onChange={(e) => updateSection({ subtitle: e.target.value })}
              placeholder="Short tagline under the title"
            />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-card rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card {idx + 1}</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveCard(idx, -1)} aria-label="Move up">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === cards.length - 1} onClick={() => moveCard(idx, 1)} aria-label="Move down">
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteCard(idx)} aria-label="Delete card">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
              {/* Image */}
              <div className="space-y-1.5">
                <Label>Image</Label>
                {card.imageUrl ? (
                  <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden border bg-muted">
                    <img src={getOriginalImageUrl(card.imageUrl)} alt="Service" className="w-full h-full object-cover" />
                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/50 opacity-0 hover:opacity-100 transition-opacity" title="Click to replace">
                      <span className="text-white text-xs font-medium">Replace</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(idx, f); }} />
                    </label>
                    <button type="button" onClick={() => patchCard(idx, { imageUrl: '' })} className="absolute top-1 right-1 z-10 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors" title="Remove image">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-[16/10] border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Upload image</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(idx, f); }} />
                  </label>
                )}
              </div>

              {/* Text fields */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={card.title} onChange={(e) => patchCard(idx, { title: e.target.value })} placeholder="Service title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subtitle</Label>
                    <Input value={card.subtitle ?? ''} onChange={(e) => patchCard(idx, { subtitle: e.target.value })} placeholder="Short subtitle" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={card.description ?? ''} onChange={(e) => patchCard(idx, { description: e.target.value })} placeholder="Shown in the popup when the card is clicked" rows={3} />
                </div>

                {/* Feature bubbles */}
                <div className="space-y-2">
                  <Label>Feature Bubbles</Label>
                  {(card.features || []).map((feature, bidx) => (
                    <div key={bidx} className="flex items-center gap-2">
                      <Input value={feature} onChange={(e) => editBubble(idx, bidx, e.target.value)} placeholder="Bubble text" />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-500" onClick={() => deleteBubble(idx, bidx)} aria-label="Delete bubble">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => addBubble(idx)}>
                    <Plus className="w-4 h-4 mr-1" /> Add bubble
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addCard} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Add Service Card
        </Button>
      </div>
    </div>
  );
}
