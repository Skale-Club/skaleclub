import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/admin/shared";
import { AdminCard } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Plus, Trash2, Pencil, Copy, Check, X } from "lucide-react";

interface Redirect {
  id: number;
  slug: string;
  destinationUrl: string;
  isActive: boolean;
  createdAt: string;
}

interface RedirectForm {
  slug: string;
  destinationUrl: string;
  isActive: boolean;
}

const EMPTY_FORM: RedirectForm = { slug: "", destinationUrl: "", isActive: true };

export function RedirectsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<RedirectForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery<Redirect[]>({
    queryKey: ["/api/redirects"],
    queryFn: () => apiRequest("GET", "/api/redirects").then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/redirects"] });

  const createMutation = useMutation({
    mutationFn: (data: RedirectForm) => apiRequest("POST", "/api/redirects", data).then(r => r.json()),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM); toast({ title: "Redirect created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RedirectForm> }) =>
      apiRequest("PUT", `/api/redirects/${id}`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditingId(null); setForm(EMPTY_FORM); toast({ title: "Redirect updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/redirects/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Redirect deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const startEdit = (r: Redirect) => {
    setEditingId(r.id);
    setForm({ slug: r.slug, destinationUrl: r.destinationUrl, isActive: r.isActive });
  };

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const copyLink = (slug: string, id: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Redirects"
        description="Short vanity links — /meet → your Meet URL, /bio → your linktree, etc."
        icon={<Link2 className="w-5 h-5" />}
      />

      <AdminCard>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="redir-slug">Path slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">/</span>
                <Input
                  id="redir-slug"
                  placeholder="meet"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  required
                  disabled={editingId !== null}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="redir-dest">Destination URL</Label>
              <Input
                id="redir-dest"
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.destinationUrl}
                onChange={e => setForm(f => ({ ...f, destinationUrl: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={isPending}>
              {editingId !== null ? <><Pencil className="w-3.5 h-3.5 mr-1.5" />Save changes</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Add redirect</>}
            </Button>
            {editingId !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5 mr-1.5" />Cancel
              </Button>
            )}
          </div>
        </form>
      </AdminCard>

      <AdminCard>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No redirects yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">/{r.slug}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.destinationUrl}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(r.slug, r.id)} title="Copy link">
                    {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(r)} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
