import { Copy, ExternalLink, Eye, Layers, Lock, LockOpen, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageThumbnail } from '@/components/ui/PageThumbnail';
import type { EstimateWithStats } from '@shared/schema';

type EstimateListRowProps = {
  est: EstimateWithStats;
  editingSlugId: number | null;
  slugValue: string;
  isUpdatingSlug: boolean;
  onStartSlugEdit: (est: EstimateWithStats) => void;
  onSlugChange: (value: string) => void;
  onCommitSlug: (est: EstimateWithStats, value: string) => void;
  onCancelSlug: () => void;
  onCopyLink: (slug: string) => void;
  onOpenLink: (slug: string) => void;
  onEditAccessCode: (est: EstimateWithStats) => void;
  onEdit: (est: EstimateWithStats) => void;
  onDelete: (est: EstimateWithStats) => void;
};

export function EstimateListRow({
  est,
  editingSlugId,
  slugValue,
  isUpdatingSlug,
  onStartSlugEdit,
  onSlugChange,
  onCommitSlug,
  onCancelSlug,
  onCopyLink,
  onOpenLink,
  onEditAccessCode,
  onEdit,
  onDelete,
}: EstimateListRowProps) {
  return (
    <div className="flex items-center gap-3 border rounded-lg p-4 bg-card">
      <PageThumbnail
        thumbnailUrl={est.thumbnailUrl}
        title={`${est.companyName?.trim() || est.contactName?.trim() || est.clientName} thumbnail`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <span className="block font-semibold text-sm truncate">
          {est.companyName?.trim() || est.contactName?.trim() || est.clientName}
        </span>
        {editingSlugId === est.id ? (
          <div className="flex h-6 max-w-xs items-center overflow-hidden rounded border bg-background focus-within:ring-1 focus-within:ring-ring">
            <span className="shrink-0 border-r bg-muted/50 px-2 text-[10px] font-mono leading-5 text-muted-foreground">
              /e/
            </span>
            <Input
              autoFocus
              value={slugValue}
              onChange={(e) => onSlugChange(e.target.value)}
              onBlur={(e) => onCommitSlug(est, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  onCancelSlug();
                }
              }}
              disabled={isUpdatingSlug}
              aria-label="Estimate slug"
              className="h-5 min-w-0 border-0 bg-transparent px-2 text-[9px] font-mono leading-5 shadow-none focus-visible:ring-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStartSlugEdit(est)}
            className="inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[10px] font-mono leading-4 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            title="Edit slug"
          >
            <span className="truncate">/e/{est.slug}</span>
          </button>
        )}
      </div>
      <Badge variant="secondary" className="text-xs gap-1 shrink-0">
        <Layers className="w-3 h-3" />
        {est.services.length}
      </Badge>
      <Badge variant="secondary" className="text-xs gap-1 shrink-0">
        <Eye className="w-3 h-3" />
        {est.viewCount ?? 0}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label={est.accessCode ? 'Edit access code' : 'Add access code'}
        title={est.accessCode ? 'Protected with password — click to edit' : 'Click to add password protection'}
        onClick={() => onEditAccessCode(est)}
        className={est.accessCode ? 'text-yellow-600 hover:text-yellow-700' : 'text-muted-foreground hover:text-foreground'}
      >
        {est.accessCode ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
      </Button>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open estimate"
          title="Open estimate"
          onClick={() => onOpenLink(est.slug)}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy estimate link"
          title="Copy estimate link"
          onClick={() => onCopyLink(est.slug)}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit estimate"
          title="Edit estimate"
          onClick={() => onEdit(est)}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete estimate"
          title="Delete estimate"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(est)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
