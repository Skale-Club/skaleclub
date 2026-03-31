import { useEffect, useState } from "react";
import { Building2, Loader2, MapPinned, Plus, Search, Timer, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useXpotShared } from "./hooks/useXpotShared";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useLeads } from "./hooks/useLeads";
import { useCheckIn } from "./hooks/useCheckIn";
import { useVisits } from "./hooks/useVisits";
import { ConfirmSlider } from "./ConfirmSlider";
import { findMatchingLead, formatDateTime } from "./utils";

export function XpotCheckIn() {
  const { geoState, loadCurrentLocation } = useXpotShared();
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
  const { activeVisit, checkOutMutation, cancelVisitMutation } = useVisits();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader><CardTitle className="text-base text-card-foreground">Xpot Check-In</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            value={checkInSearch}
            onChange={(event) => { setCheckInSearch(event.target.value); setCheckInDropdownOpen(true); }}
            onFocus={() => setCheckInDropdownOpen(true)}
            onBlur={() => setTimeout(() => setCheckInDropdownOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") { setCheckInDropdownOpen(false); (e.target as HTMLInputElement).blur(); } }}
            placeholder="Search local leads or Google Places"
            className="bg-background pl-10 pr-9"
          />
          {checkInSearch && (
            <button
              type="button"
              onClick={() => { setCheckInSearch(""); setSelectedLeadId(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {checkInDropdownOpen && !activeVisit && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {checkInSearch.trim().length >= 3 && (
                <button
                  type="button"
                  onClick={createNewCompanyFromSearch}
                  disabled={createLeadMutation.isPending}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/50 disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Create "{checkInSearch.trim()}"</div>
                    <div className="text-xs text-muted-foreground">Add as a new company</div>
                  </div>
                </button>
              )}

              {filteredLeadsForCheckIn.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => { pickLocalLeadForCheckIn(lead); setCheckInDropdownOpen(false); }}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{lead.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{lead.locations?.[0]?.addressLine1 || lead.industry || "Local lead"}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">Local</Badge>
                </button>
              ))}

              {checkInPlaceQuery.isFetching ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
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
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{place.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{place.address}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground/70">
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
                <div className="px-4 py-3 text-sm text-muted-foreground">Type at least 3 characters to search</div>
              ) : null}
            </div>
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={loadCurrentLocation}>
          <MapPinned className="mr-2 h-4 w-4" />
          Use Current Location
        </Button>
        {geoState.error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">  
            GPS unavailable: {geoState.error}. You can still check in — the visit will be flagged for review.       
          </div>
        ) : geoState.lat && geoState.lng ? (
          <div className="rounded-xl border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
            GPS locked · {geoState.accuracy ? `accuracy ${geoState.accuracy}m` : "accuracy unknown"}
          </div>
        ) : null}
        {!activeVisit ? (
          <>
            {selectedLead ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-primary/70">Selected Lead</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{selectedLead.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{selectedLead.locations?.[0]?.addressLine1 || "No address saved yet"}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="default">{selectedLead.status}</Badge>
                  <Badge variant="secondary">{selectedLead.source === "google_places" ? "Imported from Places" : "Local lead"}</Badge>
                </div>
              </div>
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
          </>
        ) : (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2 text-primary/70">
                <Timer className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Visit Timer</span>
              </div>
              <div className="text-4xl font-mono font-bold tracking-wider text-foreground tabular-nums">{elapsedDisplay}</div>
              <div className="text-base font-semibold text-foreground">{activeVisit.lead?.name || `Lead #${activeVisit.leadId}`}</div>
              <Badge variant="default" className="text-[10px]">{activeVisit.validationStatus}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div><div className="text-muted-foreground/70">Check-in</div><div>{formatDateTime(activeVisit.checkedInAt)}</div></div>
              <div><div className="text-muted-foreground/70">Distance</div><div>{activeVisit.distanceFromTargetMeters ? `${activeVisit.distanceFromTargetMeters} m` : "Unknown"}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                className={isRecording ? "h-12 w-12 rounded-full" : "h-12 w-12 rounded-full bg-secondary/50 hover:bg-secondary"}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <div className="h-4 w-4 rounded-sm bg-destructive-foreground animate-pulse" /> : <div className="h-4 w-4 rounded-full bg-foreground/80" />}
              </Button>
              <div className="flex-1">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm text-foreground/80">Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}</span>
                  </div>
                ) : audioBlob ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary">Audio recorded ({recordingTime}s)</span>
                    <Button size="sm" variant="ghost" className="h-6 text-muted-foreground hover:text-foreground" onClick={() => { setAudioBlob(null); setRecordingTime(0); }}>Clear</Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/70">Tap to record voice notes</span>
                )}
              </div>
              {audioBlob && !isRecording && (
                <Button size="sm" variant="default" onClick={() => uploadAudioMutation.mutate(undefined as any)} disabled={uploadAudioMutation.isPending}>
                  {uploadAudioMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              After upload, Xpot can transcribe the audio and generate an AI visit analysis.
            </div>
            <Textarea value={visitNoteForm.summary} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, summary: event.target.value }))} placeholder="Visit summary" className="min-h-[96px] bg-background" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={visitNoteForm.outcome} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, outcome: event.target.value }))} placeholder="Outcome" className="bg-background" />
              <Input value={visitNoteForm.nextStep} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, nextStep: event.target.value }))} placeholder="Next step" className="bg-background" />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-3">
              <Checkbox
                id="visit-follow-up-required"
                checked={visitNoteForm.followUpRequired}
                onCheckedChange={(checked) => setVisitNoteForm((prev) => ({ ...prev, followUpRequired: checked === true }))}
              />
              <Label htmlFor="visit-follow-up-required" className="text-sm text-foreground">
                Follow-up required
              </Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => saveNoteMutation.mutate(undefined as any)}>
                {saveNoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Note
              </Button>
            </div>
            <ConfirmSlider
              label={uploadAudioMutation.isPending ? "UPLOAD IN PROGRESS..." : "SLIDE TO CHECK OUT"}
              helperText={uploadAudioMutation.isPending ? "Wait for audio upload to finish before checking out." : "Slide all the way left to check out"}
              loading={checkOutMutation.isPending || cancelVisitMutation.isPending || uploadAudioMutation.isPending}
              disabled={uploadAudioMutation.isPending}
              onConfirm={() => checkOutMutation.mutate(undefined as any)}
              onCancel={() => cancelVisitMutation.mutate(undefined as any)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
