import { useEffect, useState } from "react";
import { Building2, Loader2, MapPinned, Plus, Search, Timer, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useXpotApp } from "./XpotContext";
import { ConfirmSlider } from "./ConfirmSlider";
import { findMatchingAccount, formatDateTime } from "./utils";

export function XpotCheckIn() {
  const {
    selectedAccountId,
    setSelectedAccountId,
    selectedAccount,
    checkInSearch,
    setCheckInSearch,
    checkInDropdownOpen,
    setCheckInDropdownOpen,
    filteredAccountsForCheckIn,
    checkInPlaceQuery,
    accountsQuery,
    checkInMutation,
    createAccountMutation,
    pickLocalAccountForCheckIn,
    pickGooglePlaceForCheckIn,
    createNewCompanyFromSearch,
    activeVisit,
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
    checkOutMutation,
    cancelVisitMutation,
    geoState,
    loadCurrentLocation,
  } = useXpotApp();

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
    <Card className="border-white/10 bg-white/5 text-white">
      <CardHeader><CardTitle className="text-base">Xpot Check-In</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35 z-10" />
          <Input
            value={checkInSearch}
            onChange={(event) => { setCheckInSearch(event.target.value); setCheckInDropdownOpen(true); }}
            onFocus={() => setCheckInDropdownOpen(true)}
            placeholder="Search local accounts or Google Places"
            className="border-white/10 bg-white/5 pl-10 pr-9 text-white placeholder:text-white/35"
          />
          {checkInSearch && (
            <button
              type="button"
              onClick={() => { setCheckInSearch(""); setSelectedAccountId(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {checkInDropdownOpen && !activeVisit && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {checkInSearch.trim().length >= 3 && (
                <button
                  type="button"
                  onClick={createNewCompanyFromSearch}
                  disabled={createAccountMutation.isPending}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Create "{checkInSearch.trim()}"</div>
                    <div className="text-xs text-white/45">Add as a new company</div>
                  </div>
                </button>
              )}

              {filteredAccountsForCheckIn.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => { pickLocalAccountForCheckIn(account); setCheckInDropdownOpen(false); }}
                  className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">{account.name}</div>
                    <div className="truncate text-xs text-white/45">{account.locations?.[0]?.addressLine1 || account.industry || "Local account"}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 bg-white/10 text-white/60 text-[10px]">Local</Badge>
                </button>
              ))}

              {checkInPlaceQuery.isFetching ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/45">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching Google Places...
                </div>
              ) : null}

              {checkInPlaceQuery.error ? (
                <div className="px-4 py-2 text-sm text-red-300/70">
                  {(checkInPlaceQuery.error as Error).message}
                </div>
              ) : null}

              {checkInPlaceQuery.data?.results.map((place) => {
                const existingAccount = findMatchingAccount(place, accountsQuery.data || []);
                return (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => { pickGooglePlaceForCheckIn(place); setCheckInDropdownOpen(false); }}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-white">{place.name}</div>
                      <div className="truncate text-xs text-white/45">{place.address}</div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-white/30">
                        {place.primaryType ? <span>{place.primaryType}</span> : null}
                        {place.phone ? <span>{place.phone}</span> : null}
                      </div>
                    </div>
                    <Badge className={existingAccount ? "shrink-0 bg-white/10 text-white/60 text-[10px]" : "shrink-0 bg-cyan-400/10 text-cyan-200 text-[10px]"}>
                      {existingAccount ? "Match" : "Google"}
                    </Badge>
                  </button>
                );
              })}

              {!filteredAccountsForCheckIn.length && !checkInPlaceQuery.isFetching && !checkInPlaceQuery.data?.results?.length && checkInSearch.trim().length < 3 ? (
                <div className="px-4 py-3 text-sm text-white/40">Type at least 3 characters to search</div>
              ) : null}
            </div>
          )}
        </div>
        <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={loadCurrentLocation}>
          <MapPinned className="mr-2 h-4 w-4" />
          Use Current Location
        </Button>
        {geoState.error ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-200/80">
            GPS unavailable: {geoState.error}. You can still check in — the visit will be flagged for review.
          </div>
        ) : geoState.lat && geoState.lng ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            GPS locked · {geoState.accuracy ? `accuracy ${geoState.accuracy}m` : "accuracy unknown"}
          </div>
        ) : null}
        {!activeVisit ? (
          <>
            {selectedAccount ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-primary/70">Selected Account</div>
                <div className="mt-1 text-xl font-semibold">{selectedAccount.name}</div>
                <div className="mt-1 text-sm text-white/60">{selectedAccount.locations?.[0]?.addressLine1 || "No address saved yet"}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-primary text-black">{selectedAccount.status}</Badge>
                  <Badge variant="secondary" className="bg-white/10 text-white/70">{selectedAccount.source === "google_places" ? "Imported from Places" : "Local account"}</Badge>
                </div>
              </div>
            ) : null}

            <div className={checkInDropdownOpen ? "pointer-events-none" : ""}>
              <ConfirmSlider
                label={selectedAccount ? "SLIDE TO CHECK IN" : "SELECT AN ACCOUNT FIRST"}
                helperText={selectedAccount ? `Confirm visit start for ${selectedAccount.name}` : "Choose a local account or Google Place to enable check-in."}
                loading={checkInMutation.isPending || createAccountMutation.isPending}
                disabled={!selectedAccountId || createAccountMutation.isPending}
                onConfirm={() => checkInMutation.mutate({ accountId: Number(selectedAccountId), lat: geoState.lat, lng: geoState.lng, gpsAccuracyMeters: geoState.accuracy })}
              />
            </div>
          </>
        ) : (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2 text-primary/70">
                <Timer className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Visit Timer</span>
              </div>
              <div className="text-4xl font-mono font-bold tracking-wider text-white tabular-nums">{elapsedDisplay}</div>
              <div className="text-base font-semibold text-white">{activeVisit.account?.name || `Account #${activeVisit.accountId}`}</div>
              <Badge className="bg-primary text-black text-[10px]">{activeVisit.validationStatus}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-white/65">
              <div><div className="text-white/40">Check-in</div><div>{formatDateTime(activeVisit.checkedInAt)}</div></div>
              <div><div className="text-white/40">Distance</div><div>{activeVisit.distanceFromTargetMeters ? `${activeVisit.distanceFromTargetMeters} m` : "Unknown"}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                className={isRecording ? "h-12 w-12 rounded-full bg-red-500 hover:bg-red-600" : "h-12 w-12 rounded-full border-white/10 bg-white/5 hover:bg-white/10"}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? <div className="h-4 w-4 rounded-sm bg-white animate-pulse" /> : <div className="h-4 w-4 rounded-full bg-white/80" />}
              </Button>
              <div className="flex-1">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-white/80">Recording... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, "0")}</span>
                  </div>
                ) : audioBlob ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary">Audio recorded ({recordingTime}s)</span>
                    <Button size="sm" variant="ghost" className="h-6 text-white/60 hover:text-white" onClick={() => { setAudioBlob(null); setRecordingTime(0); }}>Clear</Button>
                  </div>
                ) : (
                  <span className="text-sm text-white/40">Tap to record voice notes</span>
                )}
              </div>
              {audioBlob && !isRecording && (
                <Button size="sm" variant="outline" className="border-white/10 bg-primary text-black" onClick={() => uploadAudioMutation.mutate(undefined as any)} disabled={uploadAudioMutation.isPending}>
                  {uploadAudioMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                </Button>
              )}
            </div>
            <Textarea value={visitNoteForm.summary} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, summary: event.target.value }))} placeholder="Visit summary" className="min-h-[96px] border-white/10 bg-black/20 text-white placeholder:text-white/35" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={visitNoteForm.outcome} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, outcome: event.target.value }))} placeholder="Outcome" className="border-white/10 bg-black/20 text-white placeholder:text-white/35" />
              <Input value={visitNoteForm.nextStep} onChange={(event) => setVisitNoteForm((prev) => ({ ...prev, nextStep: event.target.value }))} placeholder="Next step" className="border-white/10 bg-black/20 text-white placeholder:text-white/35" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => saveNoteMutation.mutate(undefined as any)}>
                {saveNoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Note
              </Button>
            </div>
            <ConfirmSlider
              label={uploadAudioMutation.isPending ? "UPLOAD IN PROGRESS..." : "SLIDE TO CHECK OUT"}
              helperText={uploadAudioMutation.isPending ? "Wait for audio upload to finish before checking out." : "Slide right to complete · Slide left to cancel visit"}
              loading={checkOutMutation.isPending || cancelVisitMutation.isPending || uploadAudioMutation.isPending}
              disabled={uploadAudioMutation.isPending}
              onConfirm={() => checkOutMutation.mutate(undefined as any)}
              onCancel={() => cancelVisitMutation.mutate(undefined as any)}
              cancelAccentClassName="bg-red-500/30"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
