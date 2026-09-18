import { useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { AlertTriangle, ArrowDown, ArrowUp, Briefcase, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getImageUrl } from '../shared/utils';
import { AdminCard } from '../shared/AdminCard';
import { catalogLimitIssues } from '../catalog/CatalogFields';
import { OurServicesCardEditor } from './OurServicesCardEditor';
import type { HomepageContent, OurServicesCard, OurServicesSection } from '@shared/schema';

interface OurServicesTabProps {
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
}

const SECTION_DEFAULTS: OurServicesSection = { enabled: false, title: 'Our Services', subtitle: '', cards: [] };

export function OurServicesTab({ homepageContent, updateHomepageContent }: OurServicesTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  const addCard = () => {
    mutateCards(cs => [...cs, { order: cs.length, enabled: true, title: 'New Service', subtitle: '', description: '', features: [], imageUrl: '' }]);
    setEditingIndex(cards.length); // open the newly appended card
  };
  const deleteCard = (idx: number) => mutateCards(cs => cs.filter((_, i) => i !== idx));
  const moveCard = (idx: number, dir: -1 | 1) =>
    mutateCards(cs => {
      const target = idx + dir;
      if (target < 0 || target >= cs.length) return cs;
      return arrayMove(cs, idx, target);
    });
  const patchCard = (idx: number, patch: Partial<OurServicesCard>) =>
    mutateCards(cs => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const editing = editingIndex != null ? cards[editingIndex] : null;

  return (
    <div className="space-y-6">
      {/* Section header + toggle + title/subtitle */}
      <AdminCard className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Our Services
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Dark section on the homepage (between About and the map). Cards reuse the portfolio layout, without the logo icon.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={section.enabled ?? false} onCheckedChange={(checked) => updateSection({ enabled: checked })} />
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${section.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {section.enabled ? 'Visible' : 'Hidden'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="our-services-title">Section Title</Label>
            <Input id="our-services-title" value={section.title ?? ''} onChange={(e) => updateSection({ title: e.target.value })} placeholder="Our Services" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="our-services-subtitle">Section Subtitle</Label>
            <Input id="our-services-subtitle" value={section.subtitle ?? ''} onChange={(e) => updateSection({ subtitle: e.target.value })} placeholder="Short tagline under the title" />
          </div>
        </div>
      </AdminCard>

      {/* Compact card rows */}
      <div className="flex flex-col gap-2">
        {cards.map((card, idx) => {
          const overLimits = catalogLimitIssues(card).length > 0;
          return (
          <div key={idx} className="flex items-center gap-3 rounded-lg bg-card border px-3 py-2">
            {/* Reorder */}
            <div className="flex flex-col -my-1 shrink-0 text-muted-foreground">
              <button type="button" disabled={idx === 0} onClick={() => moveCard(idx, -1)} className="p-0.5 disabled:opacity-30 hover:text-foreground" aria-label="Move up">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" disabled={idx === cards.length - 1} onClick={() => moveCard(idx, 1)} className="p-0.5 disabled:opacity-30 hover:text-foreground" aria-label="Move down">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Thumbnail */}
            <div className="h-10 w-16 shrink-0 rounded-md overflow-hidden border bg-muted flex items-center justify-center">
              {card.imageUrl ? (
                <img src={getImageUrl(card.imageUrl, { width: 160, quality: 70 })} alt={card.title} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
              )}
            </div>

            {/* Info — click to edit */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingIndex(idx)}>
              <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                {overLimits && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" aria-label="Over the card limits" />}
                {card.title || 'Untitled service'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {card.subtitle || `${(card.features || []).length} bubble${(card.features || []).length === 1 ? '' : 's'}`}
              </p>
            </div>

            {/* Actions */}
            <Switch
              checked={card.enabled !== false}
              onCheckedChange={(checked) => patchCard(idx, { enabled: checked })}
              aria-label={card.enabled !== false ? 'Hide card' : 'Show card'}
              className="mr-1 shrink-0"
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIndex(idx)} aria-label="Edit card">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteCard(idx)} aria-label="Delete card">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          );
        })}

        <Button type="button" variant="outline" onClick={addCard} className="w-full">
          <Plus className="w-4 h-4 mr-2" /> Add Service Card
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editingIndex != null} onOpenChange={(open) => { if (!open) setEditingIndex(null); }}>
        <DialogContent className="max-w-2xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Edit Service Card</DialogTitle>
          {editing && editingIndex != null && (
            <OurServicesCardEditor card={editing} onPatch={(patch) => patchCard(editingIndex, patch)} onDone={() => setEditingIndex(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
