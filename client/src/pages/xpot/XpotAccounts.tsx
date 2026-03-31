import { Loader2, Search, MapPinned, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useXpotShared } from "./hooks/useXpotShared";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useAccounts } from "./hooks/useAccounts";
import { useCheckIn } from "./hooks/useCheckIn";

export function XpotAccounts() {
  const { geoState, loadCurrentLocation } = useXpotShared();
  const { setLocation } = useXpotQueries();
  const {
    accountLookupSearch,
    setAccountLookupSearch,
    accountForm,
    setAccountForm,
    selectedAccountPlace,
    filteredAccountsForList,
    accountPlaceQuery,
    createAccountMutation,
    applyPlaceToAccountForm,
    createAccountFromForm,
  } = useAccounts();
  const { setSelectedAccountId, setCheckInSearch } = useCheckIn();

  return (
    <>
      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Find Business With Google Places</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              value={accountLookupSearch}
              onChange={(event) => setAccountLookupSearch(event.target.value)}
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
            {accountPlaceQuery.isFetching ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/55">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching Google Places...
              </div>
            ) : null}
            {accountPlaceQuery.error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                {(accountPlaceQuery.error as Error).message}
              </div>
            ) : null}
            {accountPlaceQuery.data?.results.map((place) => (
              <button
                key={place.placeId}
                type="button"
                onClick={() => applyPlaceToAccountForm(place)}
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
        <CardHeader><CardTitle className="text-base">Create Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {selectedAccountPlace ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/75">Selected Place</div>
              <div className="mt-1 font-semibold">{selectedAccountPlace.name}</div>
              <div className="text-sm text-white/60">{selectedAccountPlace.address}</div>
            </div>
          ) : null}
          <Input value={accountForm.name} onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Business name" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={accountForm.phone} onChange={(event) => setAccountForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={accountForm.email} onChange={(event) => setAccountForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input value={accountForm.website} onChange={(event) => setAccountForm((prev) => ({ ...prev, website: event.target.value }))} placeholder="Website" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={accountForm.industry} onChange={(event) => setAccountForm((prev) => ({ ...prev, industry: event.target.value }))} placeholder="Industry" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <Input value={accountForm.addressLine1} onChange={(event) => setAccountForm((prev) => ({ ...prev, addressLine1: event.target.value }))} placeholder="Address" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={accountForm.city} onChange={(event) => setAccountForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="City" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={accountForm.state} onChange={(event) => setAccountForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="State" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <Button disabled={createAccountMutation.isPending || !accountForm.name.trim()} onClick={createAccountFromForm} className="w-full bg-primary text-black hover:bg-primary">
            {createAccountMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {selectedAccountPlace ? "Import Business" : "Create Account"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredAccountsForList.map((account) => (
          <Card key={account.id} className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{account.name}</div>
                  <div className="text-sm text-white/55">{account.industry || "Uncategorized"}</div>
                </div>
                <Badge variant="secondary" className="bg-white/10 text-white">{account.status}</Badge>
              </div>
              {account.locations?.[0] ? <div className="text-sm text-white/55">{account.locations[0].addressLine1}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">{account.openOpportunities || 0} open opportunities</Badge>
                <Badge variant="secondary" className="bg-white/10 text-white/70">{account.source === "google_places" ? "Imported from Places" : account.ghlContactId ? "GHL linked" : "Local only"}</Badge>
              </div>
              <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => { setSelectedAccountId(account.id); setCheckInSearch(account.name); setLocation("/xpot/check-in"); }}>
                Use for Check-In
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
