import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge, StatusPicker } from "./VisitStatus";
import type { VisitStatus } from "./VisitStatus";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecorder } from "./VoiceRecorder";
import { InlineField } from "./InlineField";
import { formatDateTime, formatDuration } from "../utils";
import type { SalesLead, SalesVisitNote } from "../types";
import { Trash2 } from "lucide-react";

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

function VisitDetail({ visit, onDelete }: { visit: VisitLike; onDelete: () => void }) {
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
    toast({ variant: "success", title: result.analysisApplied ? "Audio analyzed" : "Audio note saved" });
    queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
  }

  return (
    <div className="space-y-5">
      {/* Lead fields */}
      {visit.lead && (
        <div className="space-y-2.5">
          <InlineField label="" large value={fields.name} onSave={(v) => saveField("name", v)} />
          <InlineField label="Phone" value={fields.phone} onSave={(v) => saveField("phone", v)} linkable linkHref={fields.phone ? `tel:${fields.phone}` : undefined} />
          <InlineField label="Email" value={fields.email} onSave={(v) => saveField("email", v)} linkable linkHref={fields.email ? `mailto:${fields.email}` : undefined} />
          <InlineField label="Website" value={fields.website} onSave={(v) => saveField("website", v)} linkable />
          <InlineField label="Industry" value={fields.industry} onSave={(v) => saveField("industry", v)} />
        </div>
      )}

      <StatusPicker value={status} onChange={handleStatusChange} />

      {/* Time metadata */}
      <div
        className="grid grid-cols-3 gap-3 rounded-2xl p-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Check-in</div>
          <div className="text-xs text-white/70">{formatDateTime(visit.checkedInAt)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Check-out</div>
          <div className="text-xs text-white/70">{formatDateTime(visit.checkedOutAt)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Duration</div>
          <div className="text-xs text-white/70">{formatDuration(visit.durationSeconds)}</div>
        </div>
      </div>

      {/* AI Summary */}
      {visit.note?.summary ? (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70">AI Summary</div>
          <p className="text-sm text-white/70 leading-relaxed">{visit.note.summary}</p>
        </div>
      ) : null}

      {/* Voice recorder */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <VoiceRecorder
          onUpload={handleAudioUpload}
          existingAudio={visit.note?.audioUrl}
          existingDuration={visit.note?.audioDurationSeconds}
          existingTranscription={visit.note?.audioTranscription}
        />
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-2 text-xs text-white/25 transition-colors hover:text-red-400"
      >
        <Trash2 size={12} />
        Delete visit
      </button>
    </div>
  );
}

export function VisitRow({ visit }: { visit: VisitLike }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    try {
      await apiRequest("DELETE", `/api/xpot/visits/${visit.id}`);
      toast({ title: "Visit deleted", variant: "success" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/dashboard"] });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl p-4 text-left transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{visit.lead?.name || `Lead #${visit.leadId}`}</div>
            <div className="mt-0.5 text-xs text-white/35">{formatDateTime(visit.checkedInAt)}</div>
          </div>
          <StatusBadge status={visit.status} />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-sm rounded-3xl border-white/10 max-h-[88vh] overflow-y-auto"
          style={{ background: "rgba(10,15,30,0.97)", backdropFilter: "blur(20px)" }}
        >
          <DialogHeader>
            <DialogTitle className="sr-only">{visit.lead?.name || `Lead #${visit.leadId}`}</DialogTitle>
          </DialogHeader>
          <VisitDetail visit={visit} onDelete={() => { setOpen(false); setConfirmDelete(true); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent
          className="max-w-xs rounded-2xl border-0 p-6"
          style={{ background: "#0e1117", boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)" }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-white">Delete visit?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-white/45">
              This will permanently delete this visit record and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-row gap-2 sm:space-x-0">
            <AlertDialogCancel
              className="flex-1 rounded-xl border-0 text-sm font-medium text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="flex-1 rounded-xl border-0 text-sm font-medium text-white"
              style={{ background: "rgba(239,68,68,0.85)" }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
