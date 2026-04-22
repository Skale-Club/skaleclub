import { useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Link as LinkIcon, Search } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DragDropUploader } from '@/components/admin/shared';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export interface IconPickerProps {
  iconType?: 'lucide' | 'upload' | 'auto';
  iconValue?: string;
  onChange: (updates: { iconType: 'lucide' | 'upload' | 'auto'; iconValue?: string }) => void;
  className?: string;
}

type LucideEntry = [string, any];

function renderCurrentIcon(
  iconType: IconPickerProps['iconType'],
  iconValue: IconPickerProps['iconValue'],
  sizeClass: string,
) {
  if (iconType === 'lucide' && iconValue) {
    const Cmp: any = (LucideIcons as any)[iconValue];
    if (Cmp) return <Cmp className={sizeClass} />;
  }
  if (iconType === 'upload' && iconValue) {
    return <img src={iconValue} alt="" className={cn(sizeClass, 'object-contain')} />;
  }
  return <LinkIcon className={sizeClass} />;
}

export function IconPicker({ iconType, iconValue, onChange, className }: IconPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(h);
  }, [query]);

  // Build the lucide icon list once. lucide-react exports canonical PascalCase icons
  // (e.g. `Mail`, `Globe`) AND `*Icon` aliases (e.g. `MailIcon`). Keep the canonical
  // form only so the grid doesn't show duplicates.
  const lucideEntries = useMemo<LucideEntry[]>(() => {
    return Object.entries(LucideIcons).filter(([name, v]) => {
      if (!/^[A-Z][a-zA-Z0-9]+$/.test(name)) return false;
      if (typeof v !== 'object') return false;
      if (name === 'Icon' || name === 'LucideIcon') return false;
      if (name.endsWith('Icon')) return false;
      return true;
    }) as LucideEntry[];
  }, []);

  const filtered = useMemo<LucideEntry[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return lucideEntries.slice(0, 200);

    // Split PascalCase into words: "ExternalLink" → "external link"
    const toWords = (name: string) =>
      name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();

    const qWords = q.split(/\s+/).filter(Boolean);

    const scored = lucideEntries.flatMap(([name, Cmp]) => {
      const lower = name.toLowerCase();
      const words = toWords(name);

      let score = 0;
      if (lower === q) score = 100;
      else if (lower.startsWith(q)) score = 80;
      else if (words === q) score = 75;
      else if (qWords.every((w) => words.split(' ').includes(w))) score = 60;
      else if (lower.includes(q)) score = 40;
      else if (qWords.every((w) => words.includes(w))) score = 30;
      else return [];

      return [{ name, Cmp, score }];
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 200)
      .map(({ name, Cmp }) => [name, Cmp] as LucideEntry);
  }, [debouncedQuery, lucideEntries]);

  const defaultTab = iconType ?? 'auto';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('Change icon')}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-md border bg-muted/50 hover:bg-muted text-foreground shrink-0',
            className,
          )}
        >
          {renderCurrentIcon(iconType, iconValue, 'w-5 h-5')}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-4">
        {/* Preview */}
        <div className="text-xs text-muted-foreground mb-1">{t('Preview')}</div>
        <div className="flex items-center justify-center w-14 h-14 rounded-md bg-muted mb-4">
          {renderCurrentIcon(iconType, iconValue, 'w-10 h-10')}
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="lucide">{t('Lucide')}</TabsTrigger>
            <TabsTrigger value="upload">{t('Upload')}</TabsTrigger>
            <TabsTrigger value="auto">{t('Auto')}</TabsTrigger>
          </TabsList>

          <TabsContent value="lucide">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search icons...')}
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto">
              {filtered.map(([name, Cmp]) => {
                const Icon: any = Cmp;
                const isSelected = iconType === 'lucide' && iconValue === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => {
                      onChange({ iconType: 'lucide', iconValue: name });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted',
                      isSelected && 'bg-primary/10 ring-1 ring-primary',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-6 text-center text-sm text-muted-foreground py-4">
                  {t('No icons match your search')}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <DragDropUploader
              label={t('Upload icon')}
              assetType="linkIcon"
              value={iconType === 'upload' ? iconValue : undefined}
              helperText={t('PNG, JPG, WebP, SVG, or AVIF up to 2 MB')}
              thumbnailShape="square"
              onChange={(url) => {
                onChange({ iconType: 'upload', iconValue: url });
                setOpen(false);
              }}
            />
          </TabsContent>

          <TabsContent value="auto">
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {t('Automatically picks an icon based on the destination URL.')}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onChange({ iconType: 'auto', iconValue: undefined });
                  setOpen(false);
                }}
              >
                {t('Use automatic icon')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
