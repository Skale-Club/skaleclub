import { useState } from 'react';
import { LayoutPanelLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/admin/shared';
import { LandingsList } from './LandingsList';
import { LandingEditor } from './LandingEditor';
import { CreateLandingDialog } from './CreateLandingDialog';

export function LandingsSection() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (editingId) {
    return <LandingEditor landingId={editingId} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Landings"
        description="Managed landing pages — addressable at any /slug, composed from a section registry."
        icon={<LayoutPanelLeft className="w-5 h-5" />}
        action={
          <Button
            size="sm"
            data-testid="button-create-landing"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New landing
          </Button>
        }
      />

      <LandingsList onEdit={setEditingId} />

      <CreateLandingDialog
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
