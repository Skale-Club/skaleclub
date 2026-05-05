import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Rss, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminCard } from "@/components/admin/shared/AdminCard";
import { EmptyState } from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import type { BlogRssSource } from "#shared/schema.js";

const QUERY_KEY = ["/api/blog/rss-sources"] as const;

function statusBadgeVariant(
  status: string | null,
): "default" | "destructive" | "secondary" {
  if (!status) return "secondary";
  if (status === "ok") return "default";
  return "destructive";
}

interface SourceFormState {
  name: string;
  url: string;
  enabled: boolean;
}

export function RssSourcesPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [editing, setEditing] = useState<BlogRssSource | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BlogRssSource | null>(null);
  const [form, setForm] = useState<SourceFormState>({
    name: "",
    url: "",
    enabled: true,
  });

  const { data: sources, isLoading } = useQuery<BlogRssSource[]>({
    queryKey: QUERY_KEY,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: SourceFormState) =>
      apiRequest("POST", "/api/blog/rss-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setEditing(null);
      toast({ title: t("Save") });
    },
    onError: (err: Error) =>
      toast({
        title: t("Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<SourceFormState> }) =>
      apiRequest("PATCH", `/api/blog/rss-sources/${id}`, patch),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (err: Error) =>
      toast({
        title: t("Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/blog/rss-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setPendingDelete(null);
    },
    onError: (err: Error) =>
      toast({
        title: t("Error"),
        description: err.message,
        variant: "destructive",
      }),
  });

  function openNew() {
    setForm({ name: "", url: "", enabled: true });
    setEditing("new");
  }

  function openEdit(source: BlogRssSource) {
    setForm({ name: source.name, url: source.url, enabled: source.enabled });
    setEditing(source);
  }

  function submit() {
    if (editing === "new") {
      createMutation.mutate(form);
    } else if (editing && typeof editing === "object") {
      updateMutation.mutate({ id: editing.id, patch: form });
      setEditing(null);
    }
  }

  return (
    <AdminCard className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Rss className="w-4 h-4 text-primary" />
          {t("RSS Sources")}
        </h3>
        <Button size="sm" onClick={openNew} data-testid="button-add-rss-source">
          <Plus className="w-4 h-4 mr-2" />
          {t("Add Source")}
        </Button>
      </div>

      {!isLoading && sources && sources.length === 0 ? (
        <EmptyState
          icon={<Rss />}
          title={t("No RSS sources yet")}
          description={t("Add your first RSS feed to start gathering topics.")}
        />
      ) : (
        <div className="space-y-2">
          {(sources ?? []).map((source) => (
            <div
              key={source.id}
              className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
              data-testid={`row-rss-source-${source.id}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="font-medium truncate">{source.name}</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs text-muted-foreground truncate">
                        {source.url}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{source.url}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={statusBadgeVariant(source.lastFetchedStatus)}>
                    {source.lastFetchedAt
                      ? `${t("Last fetched")}: ${formatDistanceToNow(
                          new Date(source.lastFetchedAt),
                          { addSuffix: true },
                        )}`
                      : t("Never fetched")}
                  </Badge>
                  {source.errorMessage && (
                    <details className="text-red-500/80">
                      <summary className="cursor-pointer flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t("Fetch error")}
                      </summary>
                      <p className="mt-1 max-w-md break-words">
                        {source.errorMessage}
                      </p>
                    </details>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={source.enabled}
                  onCheckedChange={(checked) =>
                    updateMutation.mutate({
                      id: source.id,
                      patch: { enabled: checked },
                    })
                  }
                  data-testid={`switch-rss-source-${source.id}`}
                />
                <Button size="sm" variant="ghost" onClick={() => openEdit(source)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingDelete(source)}
                  data-testid={`button-delete-source-${source.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? t("Add Source") : t("Edit Source")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Source name")}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                data-testid="input-source-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Feed URL")}</Label>
              <Input
                value={form.url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url: e.target.value }))
                }
                placeholder="https://example.com/feed.xml"
                data-testid="input-source-url"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("Enabled")}</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, enabled: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("Cancel")}
            </Button>
            <Button onClick={submit} disabled={!form.name || !form.url}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete source?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Deleting this source removes all queued items for it.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingDelete && deleteMutation.mutate(pendingDelete.id)
              }
              className="bg-destructive text-destructive-foreground"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}
