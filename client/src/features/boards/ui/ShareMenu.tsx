import { useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Lock, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardVisibility } from '@shared/schema';

export function boardPublicUrl(slug: string): string {
  return `${window.location.origin}/b/${slug}`;
}

interface ShareMenuProps {
  slug: string;
  visibility: BoardVisibility;
  onVisibilityChange: (visibility: BoardVisibility) => void;
  pending?: boolean;
  disabled?: boolean;
}

export function ShareMenu({ slug, visibility, onVisibilityChange, pending, disabled }: ShareMenuProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const isPublic = visibility === 'link';
  const url = boardPublicUrl(slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('Could not copy link'), variant: 'destructive' });
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" className="gap-2" disabled={disabled} data-testid="board-share">
          {isPublic ? <Globe className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          <span className="hidden md:inline">{t('Share')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-4" data-testid="board-share-menu">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">{t('Share this board')}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('Only admins can edit. Viewers see a read-only board.')}</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border p-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                isPublic ? 'bg-[#5173D6]/10 text-[#5173D6]' : 'bg-muted text-muted-foreground',
              )}
            >
              {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{isPublic ? t('Anyone with the link') : t('Private')}</p>
              <p className="text-xs text-muted-foreground">{isPublic ? t('Can view at the link below') : t('Only admins can open it')}</p>
            </div>
            <Switch
              checked={isPublic}
              disabled={pending}
              onCheckedChange={(checked) => onVisibilityChange(checked ? 'link' : 'private')}
              aria-label={t('Anyone with the link can view')}
              data-testid="board-visibility-switch"
            />
          </div>

          <div className="flex gap-2">
            <Input readOnly value={url} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={t('Public link')} />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copyLink} aria-label={t('Copy link')} data-testid="board-copy-link">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2" asChild={isPublic} disabled={!isPublic}>
            {isPublic ? (
              <a href={`/b/${slug}`} target="_blank" rel="noopener noreferrer" data-testid="board-open-public">
                <ExternalLink className="h-4 w-4" />
                {t('Open public page')}
              </a>
            ) : (
              <span className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                {t('Turn on link sharing to open the public page')}
              </span>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
