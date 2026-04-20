import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  AtSign,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AdminCard, DragDropUploader, EmptyState, FormGrid, SectionHeader } from './shared';
import { IconPicker } from './links/IconPicker';
import { ThemeEditor } from './links/ThemeEditor';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { usePagePaths } from '@/lib/pagePaths';
import type { CompanySettingsData } from './shared/types';
import type { LinksPageConfig, LinksPageLink, LinksPageSocial } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';

const LINKS_PAGE_DEFAULTS: LinksPageConfig = {
  avatarUrl: '/ghl-logo.webp',
  title: 'Skale Club',
  description: 'Data-Driven Marketing & Scalable Growth Solutions',
  links: [],
  socialLinks: []
};

function SortableLinkRow({
  link,
  index,
  onUpdate,
  onRemove,
  t,
}: {
  link: LinksPageLink;
  index: number;
  onUpdate: (i: number, updates: Partial<LinksPageLink>) => void;
  onRemove: (i: number) => void;
  t: (s: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (link.visible === false ? 0.5 : 1),
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 border rounded-lg bg-muted/30 group relative transition-opacity"
      data-testid={`link-row-${index}`}
    >
      <div className="flex gap-4 items-start">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label={t('Drag to reorder')}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <IconPicker
              iconType={link.iconType}
              iconValue={link.iconValue}
              onChange={(updates) => onUpdate(index, updates)}
            />
            <Badge variant="secondary" className="text-xs">{link.clickCount ?? 0} clicks</Badge>
            <div className="flex items-center gap-2 ml-auto">
              <Label htmlFor={`visible-${index}`} className="text-xs text-muted-foreground cursor-pointer">Visible</Label>
              <Switch
                id={`visible-${index}`}
                checked={link.visible !== false}
                onCheckedChange={(checked) => onUpdate(index, { visible: checked })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Link Title</Label>
            <Input
              value={link.title}
              onChange={(e) => onUpdate(index, { title: e.target.value })}
              placeholder="My Portfolio"
            />
          </div>
          <div className="space-y-2">
            <Label>Destination URL</Label>
            <Input
              value={link.url}
              onChange={(e) => onUpdate(index, { url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRemove(index)}
          className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function LinksSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const pagePaths = usePagePaths();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const [config, setConfig] = useState<LinksPageConfig>(LINKS_PAGE_DEFAULTS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.links.findIndex((l) => l.id === active.id);
    const newIndex = config.links.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(config.links, oldIndex, newIndex).map((l, i) => ({ ...l, order: i }));
    updateConfig({ links: reordered }, 'links');
  };

  useEffect(() => {
    if (settings?.linksPageConfig) {
      setConfig(settings.linksPageConfig);
    }
  }, [settings]);

  const saveSettings = useCallback(async (newConfig: LinksPageConfig, fieldKey: string) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', { linksPageConfig: newConfig });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });

      setSavedFields(prev => ({ ...prev, [fieldKey]: true }));
      setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      }, 3000);
    } catch (error: any) {
      toast({
        title: 'Error saving links configuration',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateConfig = (updates: Partial<LinksPageConfig>, fieldKey: string) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveSettings(newConfig, fieldKey);
  };

  const addLink = () => {
    const newLinks = [
      ...config.links,
      { title: 'New Link', url: 'https://', order: config.links.length }
    ];
    updateConfig({ links: newLinks }, 'links');
  };

  const removeLink = (index: number) => {
    const newLinks = config.links.filter((_, i) => i !== index);
    updateConfig({ links: newLinks }, 'links');
  };

  const updateLink = (index: number, updates: Partial<LinksPageLink>) => {
    const newLinks = [...config.links];
    newLinks[index] = { ...newLinks[index], ...updates };
    updateConfig({ links: newLinks }, 'links');
  };

  const addSocial = () => {
    const newSocials = [
      ...config.socialLinks,
      { platform: 'instagram', url: 'https://instagram.com/', order: config.socialLinks.length }
    ];
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  const removeSocial = (index: number) => {
    const newSocials = config.socialLinks.filter((_, i) => i !== index);
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  const updateSocial = (index: number, updates: Partial<LinksPageSocial>) => {
    const newSocials = [...config.socialLinks];
    newSocials[index] = { ...newSocials[index], ...updates };
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <div className="flex items-center gap-1 text-green-600 text-xs animate-in fade-in duration-300">
        <Check className="w-3 h-3" />
        <span>Saved</span>
      </div>
    ) : null
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Links Page"
        description="Manage your public links page profile and links"
        icon={<LinkIcon className="w-5 h-5" />}
        action={
          <Button variant="outline" size="sm" asChild>
            <a href={pagePaths.links} target="_blank" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Page
            </a>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Zone 1: Profile — Avatar + Title + Bio + Background Image + Social */}
        <div className="md:col-span-2 lg:col-span-4 space-y-6">
          <AdminCard>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Profile Information</h3>
              <p className="text-sm text-muted-foreground">How you appear on the links page</p>
            </div>
            <FormGrid cols={1}>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-medium">Avatar</div>
                  <SavedIndicator field="avatarUrl" />
                </div>
                <DragDropUploader
                  label="Avatar"
                  assetType="avatar"
                  value={config.avatarUrl || undefined}
                  helperText="PNG, JPG, WebP, SVG, or AVIF up to 2 MB"
                  thumbnailShape="square"
                  onChange={(url) => {
                    const newConfig = { ...config, avatarUrl: url };
                    setConfig(newConfig);
                    saveSettings(newConfig, 'avatarUrl');
                  }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="title">Page Title</Label>
                  <SavedIndicator field="title" />
                </div>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  onBlur={() => saveSettings(config, 'title')}
                  placeholder="Skale Club"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="description">Short Bio</Label>
                  <SavedIndicator field="description" />
                </div>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  onBlur={() => saveSettings(config, 'description')}
                  placeholder="Marketing agency specializing in growth..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-medium">Background Image</div>
                  <SavedIndicator field="theme" />
                </div>
                <DragDropUploader
                  label="Background Image"
                  assetType="background"
                  value={config.theme?.backgroundImageUrl || undefined}
                  helperText="Optional. Appears behind the /links page."
                  thumbnailShape="wide"
                  onChange={(url) => {
                    const newTheme = { ...(config.theme ?? {}), backgroundImageUrl: url };
                    const newConfig = { ...config, theme: newTheme };
                    setConfig(newConfig);
                    saveSettings(newConfig, 'backgroundImageUrl');
                  }}
                />
              </div>
            </FormGrid>
          </AdminCard>

          <ThemeEditor
            theme={config.theme ?? {}}
            onChange={(patch) =>
              updateConfig({ theme: { ...(config.theme ?? {}), ...patch } }, 'theme')
            }
          />

          <AdminCard>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Social Links</h3>
                <p className="text-sm text-muted-foreground">Icons at the bottom</p>
              </div>
              <Button size="icon" variant="outline" onClick={addSocial} className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              {config.socialLinks.map((social, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Input
                      value={social.platform}
                      onChange={(e) => updateSocial(index, { platform: e.target.value })}
                      placeholder="instagram, linkedin..."
                    />
                    <Input
                      value={social.url}
                      onChange={(e) => updateSocial(index, { url: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeSocial(index)}
                    className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {config.socialLinks.length === 0 && (
                <EmptyState
                  icon={<AtSign />}
                  title="No social links"
                  description="Add platforms like Instagram, LinkedIn, Twitter"
                  action={<Button size="sm" variant="outline" onClick={addSocial}><Plus className="h-4 w-4 mr-2" /> Add social</Button>}
                  className="p-6"
                />
              )}
            </div>
          </AdminCard>
        </div>

        {/* Zone 2: Live Preview placeholder */}
        <div className="md:col-span-2 lg:col-span-4">
          <AdminCard
            tone="muted"
            padding="hero"
            className="h-full flex flex-col items-center justify-center text-center gap-3 min-h-[400px]"
          >
            <Eye className="w-10 h-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Live Preview</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Live preview coming in Phase 13</p>
          </AdminCard>
        </div>

        {/* Zone 3: Main Links */}
        <div className="md:col-span-2 lg:col-span-4">
          <AdminCard>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Main Links</h3>
                <p className="text-sm text-muted-foreground">The primary action buttons on your page</p>
              </div>
              <Button onClick={addLink} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Link
              </Button>
            </div>
            {config.links.length === 0 ? (
              <EmptyState
                icon={<LinkIcon />}
                title="No links yet"
                description="Add your first link to show on the bio page"
                action={<Button onClick={addLink}><Plus className="h-4 w-4 mr-2" /> Add first link</Button>}
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={config.links.map((l) => l.id!)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {config.links.map((link, index) => (
                      <SortableLinkRow
                        key={link.id}
                        link={link}
                        index={index}
                        onUpdate={updateLink}
                        onRemove={removeLink}
                        t={t}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
