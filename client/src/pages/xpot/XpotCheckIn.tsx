import { useEffect, useState } from "react";
import { Building2, Loader2, MapPinned, Plus, Search, Timer, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useXpotShared } from "./hooks/useXpotShared";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useLeads } from "./hooks/useLeads";
import { useCheckIn } from "./hooks/useCheckIn";
import { useVisits } from "./hooks/useVisits";
import { ConfirmSlider } from "./ConfirmSlider";
import { findMatchingLead, formatDateTime } from "./utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditLeadDialog } from "./components/EditLeadDialog";
import { VoiceRecorder } from "./components/VoiceRecorder";
import { VisitRow } from "./components/VisitRow";
import { InlineField } from "./components/InlineField";
import { StatusPicker } from "./components/VisitStatus";
import type { VisitStatus } from "./components/VisitStatus";
import type { FullSalesLead, SalesLead } from "./types";


function ActiveLeadInfo({ lead, onSaved }: { lead: SalesLead; onSaved: () => void }) {
  const { toast } = useToast();
  const [fields, setFields] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    website: lead.website || "",
    industry: lead.industry || "",
  });

  function saveField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    apiRequest("PATCH", `/api/xpot/leads/${lead.id}`, { [key]: value || undefined })
      .then(() => { toast({ title: "Saved", variant: "success" }); onSaved(); queryClient.invalidateQueries({ queryKey: ["/api/xpot/me"] }); })
      .catch((err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }));
  }

  return (
    <div className="space-y-2.5">
      <InlineField label="" large value={fields.name} onSave={(v) => saveField("name", v)} />
      <InlineField label="Phone" value={fields.phone} onSave={(v) => saveField("phone", v)} />
      <InlineField label="Email" value={fields.email} onSave={(v) => saveField("email", v)} />
      <InlineField label="Website" value={fields.website} onSave={(v) => saveField("website", v)} />
      <InlineField label="Industry" value={fields.industry} onSave={(v) => saveField("industry", v)} />
    </div>
  );
}

function CreateLeadDialog({ open, onOpenChange, initialName, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  onCreated: (leadId: number, name: string) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: initialName, phone: "", email: "", website: "", industry: "", address: "", city: "", state: "" });
  const { createLeadMutation } = useCheckIn();

  useEffect(() => { setForm((p) => ({ ...p, name: initialName })); }, [initialName]);

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      const result = await createLeadMutation.mutateAsync({
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
      toast({ title: "Company created", variant: "success" });
      onCreated(result.lead.id, form.name.trim());
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>New Company</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={form.name} onChange={f("name")} placeholder="Business name *" />
          <Input value={form.phone} onChange={f("phone")} placeholder="Phone" />
          <Input value={form.email} onChange={f("email")} placeholder="Email" />
          <Input value={form.website} onChange={f("website")} placeholder="Website" />
          <Input value={form.industry} onChange={f("industry")} placeholder="Industry" />
          <Input value={form.address} onChange={f("address")} placeholder="Street address" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={form.city} onChange={f("city")} placeholder="City" />
            <Input value={form.state} onChange={f("state")} placeholder="State" />
          </div>
          <Button className="w-full" disabled={createLeadMutation.isPending || !form.name.trim()} onClick={handleCreate}>
            {createLeadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Company
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function XpotCheckIn() {
  const { geoState, loadCurrentLocation, invalidateXpotData } = useXpotShared();
  const {
    selectedLeadId,
    setSelectedLeadId,
    selectedLead,
    checkInSearch,
    setCheckInSearch,
    checkInDropdownOpen,
    setCheckInDropdownOpen,
    filteredLeadsForCheckIn,
    checkInPlaceQuery,
    checkInMutation,
    createLeadMutation,
    pickLocalLeadForCheckIn,
    pickGooglePlaceForCheckIn,
    createNewCompanyFromSearch,
    visitNoteForm,
    setVisitNoteForm,
    isRecording,
    recordingTime,
    audioBlob,
    setAudioBlob,
    setRecordingTime,
    startRecording,
    stopRecording,
    uploadAudioMutation,
    saveNoteMutation,
  } = useCheckIn();
  const { leadsQuery } = useLeads();
  const { activeVisit, checkOutMutation, cancelVisitMutation, visitsQuery } = useVisits();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<VisitStatus>("completed");
  const [createLeadDialogOpen, setCreateLeadDialogOpen] = useState(false);

  useEffect(() => {
    if (!activeVisit?.checkedInAt) {
      setElapsedSeconds(0);
      return;
    }
    const checkedInAt = new Date(activeVisit.checkedInAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - checkedInAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeVisit?.checkedInAt]);

  const elapsedHours = Math.floor(elapsedSeconds / 3600);
  const elapsedMins = Math.floor((elapsedSeconds % 3600) / 60);
  const elapsedSecs = elapsedSeconds % 60;
  const elapsedDisplay = elapsedHours > 0
    ? `${elapsedHours}:${String(elapsedMins).padStart(2, "0")}:${String(elapsedSecs).padStart(2, "0")}`
    : `${elapsedMins}:${String(elapsedSecs).padStart(2, "0")}`;

  if (activeVisit) return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        {/* Timer */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <div className="flex items-center gap-2 text-primary/70">
            <Timer className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Visit Timer</span>
          </div>
          <div className="text-4xl font-mono font-bold tracking-wider text-foreground tabular-nums">{elapsedDisplay}</div>
        </div>

        {/* Company info */}
        {activeVisit.lead ? (
          <ActiveLeadInfo lead={activeVisit.lead} onSaved={() => invalidateXpotData()} />
        ) : (
          <div className="text-center text-base font-semibold text-foreground">{`Lead #${activeVisit.leadId}`}</div>
        )}
        {/* Voice recorder */}
        <VoiceRecorder
          onUpload={async ({ audioBlob, durationSeconds }) => {
            const reader = new FileReader();
            const audioData = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(audioBlob);
            });
            await uploadAudioMutation.mutateAsync({ audioData, durationSeconds } as any);
          }}
        />
        <StatusPicker value={checkoutStatus} onChange={setCheckoutStatus} />

        <ConfirmSlider
          label={uploadAudioMutation.isPending ? "UPLOAD IN PROGRESS..." : "SLIDE TO CHECK OUT"}
          helperText=""
          loading={checkOutMutation.isPending || cancelVisitMutation.isPending || uploadAudioMutation.isPending}
          disabled={uploadAudioMutation.isPending}
          onConfirm={() => checkOutMutation.mutate({ status: checkoutStatus } as any)}
          onCancel={() => cancelVisitMutation.mutate(undefined as any)}
        />
        {activeVisit.checkedInAt && (
          <div className="text-center text-[11px] text-muted-foreground/50">
            Check-in · {formatDateTime(activeVisit.checkedInAt)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="space-y-4 pt-6">
        {!activeVisit && <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            value={checkInSearch}
            onChange={(event) => { setCheckInSearch(event.target.value); setCheckInDropdownOpen(true); }}
            onFocus={() => setCheckInDropdownOpen(true)}
            onBlur={() => setTimeout(() => setCheckInDropdownOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") { setCheckInDropdownOpen(false); (e.target as HTMLInputElement).blur(); } }}
            placeholder="Search accounts or places"
            className="bg-white text-gray-900 placeholder:text-gray-400 pl-10 pr-16 h-14 text-base rounded-2xl border-white/20 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {checkInSearch ? (
              <button type="button" onClick={() => { setCheckInSearch(""); setSelectedLeadId(""); }} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-primary transition-colors"
              onClick={async () => { await loadCurrentLocation(); setCheckInSearch("businesses nearby"); setCheckInDropdownOpen(true); }}
            >
              <MapPinned className="h-4 w-4" />
            </button>
          </div>
          {checkInDropdownOpen && !activeVisit && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-2xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {checkInSearch.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => { setCheckInDropdownOpen(false); setCreateLeadDialogOpen(true); }}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create "{checkInSearch.trim()}"</div>
                    <div className="text-xs text-gray-400">Add as a new company</div>
                  </div>
                </button>
              )}

              {filteredLeadsForCheckIn.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => { pickLocalLeadForCheckIn(lead); setCheckInDropdownOpen(false); }}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{lead.name}</div>
                    <div className="truncate text-xs text-gray-400">{lead.locations?.[0]?.addressLine1 || lead.industry || "Local lead"}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">Local</Badge>
                </button>
              ))}

              {checkInPlaceQuery.isFetching ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching Google Places...
                </div>
              ) : null}

              {checkInPlaceQuery.error ? (
                <div className="px-4 py-2 text-sm text-destructive">
                  {(checkInPlaceQuery.error as Error).message}
                </div>
              ) : null}

              {checkInPlaceQuery.data?.results.map((place) => {
                const existingLead = findMatchingLead(place, leadsQuery.data || []);
                return (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => { pickGooglePlaceForCheckIn(place); setCheckInDropdownOpen(false); }}
                    className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">{place.name}</div>
                      <div className="truncate text-xs text-gray-400">{place.address}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-gray-300">
                        {place.primaryType ? <span>{place.primaryType}</span> : null}
                        {place.phone ? <span>{place.phone}</span> : null}
                      </div>
                    </div>
                    <Badge variant={existingLead ? "secondary" : "outline"} className={!existingLead ? "shrink-0 border-primary/20 text-primary text-[10px]" : "shrink-0 text-[10px]"}>
                      {existingLead ? "Match" : "Google"}
                    </Badge>
                  </button>
                );
              })}

              {!filteredLeadsForCheckIn.length && !checkInPlaceQuery.isFetching && !checkInPlaceQuery.data?.results?.length && checkInSearch.trim().length < 3 ? (
                <div className="px-4 py-3 text-sm text-gray-400">Type at least 3 characters to search</div>
              ) : null}
            </div>
          )}
        </div>}
        {!activeVisit && geoState.error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            GPS unavailable: {geoState.error}. You can still check in — the visit will be flagged for review.
          </div>
        ) : null}
        {selectedLead ? (
          <>
            <button
              type="button"
              onClick={() => setEditLeadOpen(true)}
              className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left transition hover:border-primary/40 hover:bg-primary/10"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-primary/70">Selected Lead</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{selectedLead.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{selectedLead.locations?.[0]?.addressLine1 || "No address saved yet"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="default">{selectedLead.status}</Badge>
                <Badge variant="secondary">{selectedLead.source === "google_places" ? "Imported from Places" : "Local lead"}</Badge>
              </div>
            </button>
            <EditLeadDialog
              lead={selectedLead}
              open={editLeadOpen}
              onOpenChange={setEditLeadOpen}
              onSaved={() => invalidateXpotData()}
            />
          </>
        ) : null}

        <div className={checkInDropdownOpen ? "pointer-events-none" : ""}>
          <ConfirmSlider
            label={selectedLead ? "SLIDE TO CHECK IN" : "SELECT A LEAD FIRST"}
            helperText={selectedLead ? `Confirm visit start for ${selectedLead.name}` : "Choose a local lead or Google Place to enable check-in."}
            loading={checkInMutation.isPending || createLeadMutation.isPending}
            disabled={!selectedLeadId || createLeadMutation.isPending}
            onConfirm={() => checkInMutation.mutate({ leadId: Number(selectedLeadId), lat: geoState.lat, lng: geoState.lng, gpsAccuracyMeters: geoState.accuracy })}
          />
        </div>
      </CardContent>
    </Card>

    {(() => {
      const recent = (visitsQuery.data || []).filter((v) => v.checkedOutAt).slice(0, 5);
      if (!recent.length) return null;
      return (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-1">Recent Visits</div>
          {recent.map((visit) => <VisitRow key={visit.id} visit={visit} />)}
        </div>
      );
    })()}

    <CreateLeadDialog
      open={createLeadDialogOpen}
      onOpenChange={setCreateLeadDialogOpen}
      initialName={checkInSearch.trim() === "businesses nearby" ? "" : checkInSearch.trim()}
      onCreated={(leadId, name) => {
        setSelectedLeadId(leadId);
        setCheckInSearch(name);
        invalidateXpotData();
      }}
    />
    </>
  );
}
