import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { FormRow } from './formsTypes';

export function EditableFormHeader({
  form,
  onSave,
  action,
}: {
  form: FormRow;
  onSave: (updates: { name?: string; description?: string | null }) => void;
  action?: React.ReactNode;
}) {
  const [editingField, setEditingField] = useState<'name' | 'description' | null>(null);
  const [nameDraft, setNameDraft] = useState(form.name);
  const [descDraft, setDescDraft] = useState(form.description ?? '');

  useEffect(() => {
    setNameDraft(form.name);
    setDescDraft(form.description ?? '');
  }, [form.name, form.description]);

  const commitName = () => {
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(form.name);
    } else if (next !== form.name) {
      onSave({ name: next });
    }
    setEditingField(null);
  };

  const commitDesc = () => {
    const next = descDraft.trim();
    const current = form.description ?? '';
    if (next !== current) onSave({ description: next || null });
    setEditingField(null);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          {editingField === 'name' ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                if (e.key === 'Escape') { setNameDraft(form.name); setEditingField(null); }
              }}
              className="text-2xl font-bold tracking-tight bg-transparent border-0 outline-none w-full px-1 -mx-1 rounded focus:ring-1 focus:ring-ring"
              maxLength={120}
            />
          ) : (
            <h1
              className="text-2xl font-bold tracking-tight truncate cursor-text rounded px-1 -mx-1 hover:bg-muted/60"
              title="Click to edit name"
              onClick={() => setEditingField('name')}
            >
              {form.name}
            </h1>
          )}
          {editingField === 'description' ? (
            <input
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitDesc(); }
                if (e.key === 'Escape') { setDescDraft(form.description ?? ''); setEditingField(null); }
              }}
              placeholder={`Editing /f/${form.slug}`}
              className="text-sm text-muted-foreground bg-transparent border-0 outline-none w-full px-1 -mx-1 rounded focus:ring-1 focus:ring-ring"
              maxLength={500}
            />
          ) : (
            <p
              className="text-sm text-muted-foreground cursor-text rounded px-1 -mx-1 hover:bg-muted/60"
              title="Click to edit description"
              onClick={() => setEditingField('description')}
            >
              {form.description || `Editing /f/${form.slug}`}
            </p>
          )}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
