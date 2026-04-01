import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, StatusPicker } from "./VisitStatus";
import type { VisitStatus } from "./VisitStatus";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecorder } from "./VoiceRecorder";
import { InlineField } from "./InlineField";
import { formatDateTime, formatDuration } from "../utils";
import type { SalesLead, SalesVisitNote } from "../types";

type VisitLike = {
  id: number;
  leadId: number;
  lead?: SalesLead;
  status: string;
  checkedInAt?: string | Date | null;
  checkedOutAt?: string | Date | null;
  durationSeconds?: number | null;
  note?: SalesVisitNote | null;
};

function VisitDetail({ visit }: { visit: VisitLike }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(visit.status);
  const [fields, setFields] = useState({
    name: visit.lead?.name || "",
    phone: visit.lead?.phone || "",
    email: visit.lead?.email || "",
    website: visit.lead?.website || "",
    industry: visit.lead?.industry || "",
  });

  async function handleStatusChange(newStatus: VisitStatus) {
    setStatus(newStatus);
    try {
      await apiRequest("PATCH", `/api/xpot/visits/${visit.id}`, { status: newStatus });
      toast({ title: "Status updated", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/dashboard"] });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  }

  function saveField(key: keyof typeof fields, value: string) {
    if (!visit.lead) return;
    setFields((prev) => ({ ...prev, [key]: value }));
    apiRequest("PATCH", `/api/xpot/leads/${visit.lead!.id}`, { [key]: value || undefined })
      .then(() => {
        toast({ title: "Saved", variant: "success" });
        queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
        queryClient.invalidateQueries({ queryKey: ["/api/xpot/dashboard"] });
      })
      .catch((err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }));
  }

  async function handleAudioUpload({ audioBlob, durationSeconds }: { audioBlob: Blob; durationSeconds: number }) {
    const reader = new FileReader();
    const audioData = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
    const response = await apiRequest("POST", `/api/xpot/visits/${visit.id}/audio`, { audioData, durationSeconds });
    const result = await response.json() as { note: SalesVisitNote; transcriptionAvailable: boolean; analysisApplied: boolean };
    toast({
      variant: "success",
      title: result.analysisApplied ? "Audio analyzed" : "Audio note saved",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
  }

  return (
    <div className="space-y-4">
      {visit.lead && (
        <div className="space-y-2.5">
          <InlineField label="" large value={fields.name} onSave={(v) => saveField("name", v)} />
          <InlineField label="Phone" value={fields.phone} onSave={(v) => saveField("phone", v)} />
          <InlineField label="Email" value={fields.email} onSave={(v) => saveField("email", v)} />
          <InlineField label="Website" value={fields.website} onSave={(v) => saveField("website", v)} />
          <InlineField label="Industry" value={fields.industry} onSave={(v) => saveField("industry", v)} />
        </div>
      )}

      <StatusPicker value={status} onChange={handleStatusChange} />

      <div className="grid grid-cols-2 gap-3 text-sm border-t border-border pt-3">
        <div><div className="text-muted-foreground/70 text-xs uppercase tracking-wide mb-1">Check-in</div><div className="text-foreground">{formatDateTime(visit.checkedInAt)}</div></div>
        <div><div className="text-muted-foreground/70 text-xs uppercase tracking-wide mb-1">Check-out</div><div className="text-foreground">{formatDateTime(visit.checkedOutAt)}</div></div>
        <div><div className="text-muted-foreground/70 text-xs uppercase tracking-wide mb-1">Duration</div><div className="text-foreground">{formatDuration(visit.durationSeconds)}</div></div>
      </div>

      {visit.note?.summary ? (
        <div className="rounded-xl border border-border bg-secondary/50 p-3 text-sm text-foreground/80">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">Summary</div>
          {visit.note.summary}
        </div>
      ) : null}

      <div className="border-t border-border pt-3">
        <VoiceRecorder
          onUpload={handleAudioUpload}
          existingAudio={visit.note?.audioUrl}
          existingDuration={visit.note?.audioDurationSeconds}
          existingTranscription={visit.note?.audioTranscription}
        />
      </div>
    </div>
  );
}

export function VisitRow({ visit }: { visit: VisitLike }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-secondary/30"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-foreground truncate">{visit.lead?.name || `Lead #${visit.leadId}`}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(visit.checkedInAt)}</div>
          </div>
          <StatusBadge status={visit.status} />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="leading-snug sr-only">{visit.lead?.name || `Lead #${visit.leadId}`}</DialogTitle>
          </DialogHeader>
          <VisitDetail visit={visit} />
        </DialogContent>
      </Dialog>
    </>
  );
}
