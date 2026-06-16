import { Copy, ExternalLink, Layers, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageThumbnail } from '@/components/ui/PageThumbnail';
import type { PresentationWithStats } from '@shared/schema';

export type PresentationsListRowProps = {
  p: PresentationWithStats;
  renamingId: string | null;
  renamingTitle: string;
  editingSlugId: string | null;
  slugValue: string;
  isUpdatingSlug: boolean;
  onStartRename: (p: PresentationWithStats) => void;
  onRenameChange: (value: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onStartSlugEdit: (p: PresentationWithStats) => void;
  onSlugChange: (value: string) => void;
  onCommitSlug: (p: PresentationWithStats, value: string) => void;
  onCancelSlug: () => void;
  onOpenLink: (slug: string) => void;
  onCopyLink: (slug: string) => void;
  onDelete: (p: PresentationWithStats) => void;
  onOpenEditor: (id: string) => void;
};

export function PresentationsListRow({
  p,
  renamingId,
  renamingTitle,
  editingSlugId,
  slugValue,
  isUpdatingSlug,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onStartSlugEdit,
  onSlugChange,
  onCommitSlug,
  onCancelSlug,
  onOpenLink,
  onCopyLink,
  onDelete,
  onOpenEditor,
}: PresentationsListRowProps) {
  return (
    <div
      key={p.id}
      className="flex flex-col gap-3 border rounded-lg p-4 bg-card md:flex-row md:items-center"
    >
      <PageThumbnail thumbnailUrl={p.thumbnailUrl} title={`${p.title} thumbnail`} />
      <div className="min-w-0 flex-1 space-y-2">
        {renamingId === p.id ? (
          <Input
            autoFocus
            value={renamingTitle}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => onCommitRename(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename(p.id);
              if (e.key === 'Escape') onCancelRename();
            }}
            className="h-8 text-sm font-semibold"
          />
        ) : (
          <span
            className="block font-semibold text-sm truncate cursor-pointer hover:underline"
            title="Click to rename"
            onClick={() => onStartRename(p)}
          >
            {p.title}
          </span>
        )}
        {editingSlugId === p.id ? (
          <div className="flex h-6 max-w-xs items-center overflow-hidden rounded border bg-background focus-within:ring-1 focus-within:ring-ring">
            <span className="shrink-0 border-r bg-muted/50 px-2 text-[10px] font-mono leading-5 text-muted-foreground">
              /p/
            </span>
            <Input
              autoFocus
              value={slugValue}
              onChange={(e) => onSlugChange(e.target.value)}
              onBlur={(e) => onCommitSlug(p, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  onCancelSlug();
                }
              }}
              disabled={isUpdatingSlug}
              aria-label="Presentation slug"
              className="h-5 min-w-0 border-0 bg-transparent px-2 text-[9px] font-mono leading-5 shadow-none focus-visible:ring-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onStartSlugEdit(p)}
            className="inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[10px] font-mono leading-4 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            title="Edit slug"
          >
            <span className="truncate">/p/{p.slug}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
        <Badge variant="secondary" className="text-xs gap-1">
          <Layers className="w-3 h-3" />
          {p.slideCount}
        </Badge>
      </div>
      <div className="flex gap-1 shrink-0 self-start md:self-auto">
        <Button
          variant="ghost"
          size="icon"
          title="Open presentation"
          onClick={() => onOpenLink(p.slug)}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Copy link"
          onClick={() => onCopyLink(p.slug)}
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(p)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenEditor(p.id)}
        >
          Open Editor
        </Button>
      </div>
    </div>
  );
}
