import { useState } from 'react';
import { LayoutPanelLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/admin/shared';
import { PagesList } from './PagesList';
import { PageEditor } from './PageEditor';
import { CreatePageDialog } from './CreatePageDialog';

export function PagesSection() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (editingId) {
    return <PageEditor pageId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Pages"
        description="Managed pages — addressable at any /slug, composed from a section registry."
        icon={<LayoutPanelLeft className="w-5 h-5" />}
        action={
          <Button
            size="sm"
            data-testid="button-create-page"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New page
          </Button>
        }
      />

      <PagesList onEdit={setEditingId} />

      <CreatePageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          setEditingId(id);
        }}
      />
    </div>
  );
}
