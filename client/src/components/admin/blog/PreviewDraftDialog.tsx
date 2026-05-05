import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

interface PreviewPayload {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaDescription: string;
  focusKeyword: string;
  tags: string[];
  featureImageUrl: string | null;
  rssItemId: number;
  rssItemTitle: string;
}

type PreviewResponse =
  | { skipped: false; preview: PreviewPayload }
  | { skipped: true; reason: string };

function stripHtmlTo200Words(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const allWords = text.split(" ");
  const words = allWords.slice(0, 200);
  return words.join(" ") + (allWords.length > 200 ? "…" : "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rssItemId?: number; // optional override (retry path)
}

export function PreviewDraftDialog({ open, onOpenChange, rssItemId }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/blog/preview", { rssItemId });
      return (await res.json()) as PreviewResponse;
    },
    onSuccess: (data) => {
      if (data.skipped) {
        setSkipReason(data.reason);
        setPreview(null);
      } else {
        setPreview(data.preview);
        setSkipReason(null);
      }
    },
    onError: (err: Error) => {
      setErrorMessage(err?.message ?? t("Preview failed"));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("no preview");
      const res = await apiRequest("POST", "/api/blog/posts/from-preview", {
        title: preview.title,
        content: preview.content,
        excerpt: preview.excerpt,
        metaDescription: preview.metaDescription,
        focusKeyword: preview.focusKeyword,
        tags: preview.tags,
        featureImageUrl: preview.featureImageUrl,
        rssItemId: preview.rssItemId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/rss-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/jobs", 50] });
      toast({ title: t("Draft saved") });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: t("Error"),
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  // Trigger preview when dialog opens; reset state when closed.
  useEffect(() => {
    if (open) {
      setPreview(null);
      setSkipReason(null);
      setErrorMessage(null);
      previewMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rssItemId]);

  function handleDiscard() {
    // No DB write — RSS item remains pending (D-06)
    onOpenChange(false);
  }

  const bodyPreviewText = preview ? stripHtmlTo200Words(preview.content) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Preview Draft")}</DialogTitle>
          {preview?.rssItemTitle && (
            <DialogDescription>
              {t("Source")}: {preview.rssItemTitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {previewMutation.isPending && (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{t("Generating preview…")}</span>
          </div>
        )}

        {!previewMutation.isPending && skipReason && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <span>
              {t("Preview failed")}: {skipReason}
            </span>
          </div>
        )}

        {!previewMutation.isPending && errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!previewMutation.isPending && preview && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("Title")}
              </div>
              <div className="text-lg font-semibold">{preview.title}</div>
            </div>
            {preview.featureImageUrl && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  {t("Feature image")}
                </div>
                <img
                  src={preview.featureImageUrl}
                  alt={preview.title}
                  className="w-full max-h-64 object-cover rounded-md border"
                />
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("Excerpt")}
              </div>
              <p className="text-sm">{preview.excerpt}</p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                {t("Body preview")}
              </div>
              <p className="text-sm leading-relaxed">{bodyPreviewText}</p>
            </div>
            {preview.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {preview.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleDiscard}
            disabled={saveMutation.isPending}
          >
            {t("Discard")}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!preview || saveMutation.isPending}
            data-testid="button-save-as-draft"
          >
            {saveMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {t("Save as Draft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
