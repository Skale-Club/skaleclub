import { useState } from "react";
import { Loader2, Plus, Search, Trash2, LogIn } from "lucide-react";
import { EditLeadDialog } from "./components/EditLeadDialog";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useLeads } from "./hooks/useLeads";
import { useCheckIn } from "./hooks/useCheckIn";
import { useToast } from "@/hooks/use-toast";
import type { FullSalesLead } from "./types";

const GLASS = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
} as const;

function leadInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// Deterministic gradient per lead name
const GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #ec4899, #8b5cf6)",
];
function leadGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { createLeadMutation } = useCheckIn();
  const [form, setForm] = useState({ name: "", phone: "", email: "", website: "", industry: "", address: "", city: "", state: "" });
  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      await createLeadMutation.mutateAsync({
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        industry: form.industry || undefined,
        source: "manual",
        status: "lead",
        primaryLocation: form.address ? {
          label: "Main",
          addressLine1: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          isPrimary: true,
        } : undefined,
      } as any);
      toast({ title: "Lead created", variant: "success" });
      setForm({ name: "", phone: "", email: "", website: "", industry: "", address: "", city: "", state: "" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    }
  }

  const inputCls = "w-full h-10 rounded-xl px-3 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors";
  const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm rounded-2xl border-0 p-6"
        style={{ background: "#0e1117", boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 mt-1">
          {[
            { key: "name" as const, placeholder: "Business name *" },
            { key: "phone" as const, placeholder: "Phone" },
            { key: "email" as const, placeholder: "Email" },
            { key: "website" as const, placeholder: "Website" },
            { key: "industry" as const, placeholder: "Industry" },
            { key: "address" as const, placeholder: "Street address" },
          ].map(({ key, placeholder }) => (
            <input
              key={key}
              value={form[key]}
              onChange={f(key)}
              placeholder={placeholder}
              className={inputCls}
              style={inputStyle}
            />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <input value={form.city} onChange={f("city")} placeholder="City" className={inputCls} style={inputStyle} />
            <input value={form.state} onChange={f("state")} placeholder="State" className={inputCls} style={inputStyle} />
          </div>
          <button
            disabled={createLeadMutation.isPending || !form.name.trim()}
            onClick={handleCreate}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-40 mt-1"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            {createLeadMutation.isPending ? <Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> : null}
            Create Lead
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function XpotLeads() {
  const { setLocation } = useXpotQueries();
  const [leadPendingDelete, setLeadPendingDelete] = useState<FullSalesLead | null>(null);
  const [editLead, setEditLead] = useState<FullSalesLead | null>(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const { filteredLeadsForList, deleteLeadMutation, leadLookupSearch, setLeadLookupSearch } = useLeads();

  const handleDeleteLead = async () => {
    if (!leadPendingDelete) return;
    try {
      await deleteLeadMutation.mutateAsync(leadPendingDelete.id);
      setLeadPendingDelete(null);
    } catch {}
  };

  return (
    <>
      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={leadLookupSearch}
            onChange={(e) => setLeadLookupSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full h-11 rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-white/25 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
          />
        </div>
        <button
          onClick={() => setAddLeadOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-all hover:opacity-80"
          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Lead list */}
      <div className="space-y-2">
        {filteredLeadsForList.length === 0 && (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl py-10 text-center"
            style={GLASS}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(99,102,241,0.15)" }}>
              <Search className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white/60">No leads found</div>
              <div className="mt-0.5 text-xs text-white/30">Tap + to add your first lead</div>
            </div>
          </div>
        )}
        {filteredLeadsForList.map((lead) => (
          <button
            key={lead.id}
            type="button"
            className="group w-full rounded-2xl p-4 text-left transition-all"
            style={{ ...GLASS, boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
            onClick={() => setEditLead(lead)}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ background: leadGradient(lead.name) }}
              >
                {leadInitials(lead.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{lead.name}</div>
                <div className="truncate text-xs text-white/40">{lead.industry || "Uncategorized"}</div>
                {lead.locations?.[0]?.addressLine1 ? (
                  <div className="mt-0.5 truncate text-[11px] text-white/25">{lead.locations[0].addressLine1}</div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-blue-500/20 hover:text-blue-400"
                  onClick={(e) => { e.stopPropagation(); setLocation(`/xpot/check-in?leadId=${lead.id}`); }}
                >
                  <LogIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                  disabled={deleteLeadMutation.isPending}
                  onClick={(e) => { e.stopPropagation(); setLeadPendingDelete(lead); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </button>
        ))}
      </div>

      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} />

      {editLead && (
        <EditLeadDialog
          lead={editLead}
          open={Boolean(editLead)}
          onOpenChange={(v) => { if (!v) setEditLead(null); }}
          onSaved={() => setEditLead(null)}
        />
      )}

      <AlertDialog
        open={Boolean(leadPendingDelete)}
        onOpenChange={(open) => { if (!open && !deleteLeadMutation.isPending) setLeadPendingDelete(null); }}
      >
        <AlertDialogContent
          className="max-w-xs rounded-2xl border-0 p-6"
          style={{ background: "#0e1117", boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)" }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-white">Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-white/45">
              {leadPendingDelete
                ? `Permanently removes ${leadPendingDelete.name} and all related visits, notes, and opportunities.`
                : "This lead will be permanently removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-row gap-2 sm:space-x-0">
            <AlertDialogCancel
              disabled={deleteLeadMutation.isPending}
              className="flex-1 rounded-xl border-0 text-sm font-medium text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteLeadMutation.isPending}
              onClick={(e) => { e.preventDefault(); void handleDeleteLead(); }}
              className="flex-1 rounded-xl border-0 text-sm font-medium text-white"
              style={{ background: "rgba(239,68,68,0.85)" }}
            >
              {deleteLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
