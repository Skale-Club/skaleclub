import { useState } from "react";
import { Loader2, Search, MapPinned, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useXpotShared } from "./hooks/useXpotShared";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useLeads } from "./hooks/useLeads";
import { useCheckIn } from "./hooks/useCheckIn";
import type { FullSalesLead } from "./types";

export function XpotLeads() {
  const { geoState, loadCurrentLocation } = useXpotShared();
  const { setLocation } = useXpotQueries();
  const [leadPendingDelete, setLeadPendingDelete] = useState<FullSalesLead | null>(null);
  const {
    leadLookupSearch,
    setLeadLookupSearch,
    leadForm,
    setLeadForm,
    selectedLeadPlace,
    filteredLeadsForList,
    leadPlaceQuery,
    createLeadMutation,
    deleteLeadMutation,
    applyPlaceToLeadForm,
    createLeadFromForm,
  } = useLeads();
  const { setSelectedLeadId, setCheckInSearch } = useCheckIn();

  const handleDeleteLead = async () => {
    if (!leadPendingDelete) return;

    try {
      await deleteLeadMutation.mutateAsync(leadPendingDelete.id);
      setLeadPendingDelete(null);
    } catch {
    }
  };

  return (
    <>
      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Find Business With Google Places</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={leadLookupSearch}
              onChange={(event) => setLeadLookupSearch(event.target.value)}
              placeholder="Search businesses or addresses"
              className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
            />
          </div>
          <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={loadCurrentLocation}>
            <MapPinned className="mr-2 h-4 w-4" />
            Use Current Location For Nearby Search
          </Button>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            {geoState.error ? geoState.error : geoState.lat && geoState.lng ? `Location bias enabled at ${geoState.lat.toFixed(5)}, ${geoState.lng.toFixed(5)}` : "Search works without GPS, but current location improves nearby matches."}
          </div>
          <div className="space-y-2">
            {leadPlaceQuery.isFetching ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/55">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching Google Places...
              </div>
            ) : null}
            {leadPlaceQuery.error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                {(leadPlaceQuery.error as Error).message}
              </div>
            ) : null}
            {leadPlaceQuery.data?.results.map((place) => (
              <button
                key={place.placeId}
                type="button"
                onClick={() => applyPlaceToLeadForm(place)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-primary/40 hover:bg-black/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{place.name}</div>
                    <div className="mt-1 text-sm text-white/55">{place.address}</div>
                  </div>
                  <Badge className="bg-primary/10 text-primary">{place.primaryType || "Place"}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/45">
                  {place.phone ? <span>{place.phone}</span> : null}
                  {place.website ? (
                    <span className="inline-flex items-center gap-1">
                      Website
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Create Lead</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {selectedLeadPlace ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/75">Selected Place</div>
              <div className="mt-1 font-semibold">{selectedLeadPlace.name}</div>
              <div className="text-sm text-white/60">{selectedLeadPlace.address}</div>
            </div>
          ) : null}
          <Input value={leadForm.name} onChange={(event) => setLeadForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Business name" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={leadForm.phone} onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={leadForm.website} onChange={(event) => setLeadForm((prev) => ({ ...prev, website: event.target.value }))} placeholder="Website" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={leadForm.industry} onChange={(event) => setLeadForm((prev) => ({ ...prev, industry: event.target.value }))} placeholder="Industry" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <Input value={leadForm.addressLine1} onChange={(event) => setLeadForm((prev) => ({ ...prev, addressLine1: event.target.value }))} placeholder="Address" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={leadForm.city} onChange={(event) => setLeadForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="City" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={leadForm.state} onChange={(event) => setLeadForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="State" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <Button disabled={createLeadMutation.isPending || !leadForm.name.trim()} onClick={createLeadFromForm} className="w-full bg-primary text-black hover:bg-primary">
            {createLeadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {selectedLeadPlace ? "Import Business" : "Create Lead"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredLeadsForList.map((lead) => (
          <Card key={lead.id} className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{lead.name}</div>
                  <div className="text-sm text-white/55">{lead.industry || "Uncategorized"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white/10 text-white">{lead.status}</Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    aria-label={`Delete lead ${lead.name}`}
                    data-testid={`delete-lead-${lead.id}`}
                    disabled={deleteLeadMutation.isPending}
                    onClick={() => setLeadPendingDelete(lead)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {lead.locations?.[0] ? <div className="text-sm text-white/55">{lead.locations[0].addressLine1}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">{lead.openOpportunities || 0} open opportunities</Badge>
                <Badge variant="secondary" className="bg-white/10 text-white/70">{lead.source === "google_places" ? "Imported from Places" : lead.ghlContactId ? "GHL linked" : "Local only"}</Badge>
              </div>
              <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => { setSelectedLeadId(lead.id); setCheckInSearch(lead.name); setLocation("/xpot/check-in"); }}>
                Use Lead for Check-In
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        open={Boolean(leadPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteLeadMutation.isPending) {
            setLeadPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#0d1117] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/65">
              {leadPendingDelete
                ? `This will permanently remove ${leadPendingDelete.name} and its related visits, notes, tasks, and opportunities from the system.`
                : "This lead will be permanently removed from the system."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLeadMutation.isPending}>
              Keep lead
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteLeadMutation.isPending}
              data-testid="confirm-delete-lead"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteLead();
              }}
            >
              {deleteLeadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
