import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePlaceSearch } from "../usePlaceSearch";
import { parseAddress } from "../utils";
import { useXpotShared } from "./useXpotShared";
import { useXpotQueries } from "./useXpotQueries";
import type { GooglePlaceResult, SalesAccount, SalesAccountPayload } from "./types";

export function useAccounts() {
  const { toast } = useToast();
  const { geoState, loadCurrentLocation, invalidateXpotData } = useXpotShared();
  const { xpotMeQuery, activeTab } = useXpotQueries();

  const [accountLookupSearch, setAccountLookupSearch] = useState("");
  const [selectedAccountPlace, setSelectedAccountPlace] = useState<GooglePlaceResult | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    industry: "",
    addressLine1: "",
    city: "",
    state: "",
  });

  const accountsQuery = useQuery<SalesAccount[]>({ queryKey: ["/api/xpot/accounts"], enabled: xpotMeQuery.isSuccess });
  const accountPlaceQuery = usePlaceSearch(accountLookupSearch, xpotMeQuery.isSuccess && activeTab === "accounts", geoState);

  const filteredAccountsForList = useMemo(() => {
    const search = accountLookupSearch.trim().toLowerCase();
    if (!search) return accountsQuery.data || [];

    return (accountsQuery.data || []).filter((account) => {
      const haystack = [
        account.name,
        account.industry,
        account.phone,
        account.email,
        account.locations?.map((location) => `${location.addressLine1} ${location.city || ""} ${location.state || ""}`).join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    });
  }, [accountsQuery.data, accountLookupSearch]);

  const createAccountMutation = useMutation({
    mutationFn: async (payload: SalesAccountPayload) => {
      const response = await apiRequest("POST", "/api/xpot/accounts", payload);
      return response.json() as Promise<{ account: SalesAccount }>;
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      await apiRequest("DELETE", `/api/xpot/accounts/${accountId}`);
      return accountId;
    },
    onSuccess: async () => {
      toast({ title: "Lead deleted" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete lead", description: error.message, variant: "destructive" });
    },
  });

  const applyPlaceToAccountForm = (place: GooglePlaceResult) => {
    const parsedAddress = parseAddress(place.address);
    setSelectedAccountPlace(place);
    setAccountLookupSearch(place.name);
    setAccountForm({
      name: place.name,
      phone: place.phone || "",
      email: "",
      website: place.website || "",
      industry: place.primaryType || "",
      addressLine1: parsedAddress.addressLine1,
      city: parsedAddress.city,
      state: parsedAddress.state,
    });
  };

  const createAccountFromForm = async () => {
    const payload: SalesAccountPayload = {
      name: accountForm.name,
      phone: accountForm.phone || undefined,
      email: accountForm.email || undefined,
      website: accountForm.website || undefined,
      industry: accountForm.industry || undefined,
      source: selectedAccountPlace ? "google_places" : "xpot",
      status: "lead",
      notes: selectedAccountPlace ? `Imported from Google Places (${selectedAccountPlace.placeId})` : undefined,
      primaryLocation: accountForm.addressLine1
        ? {
            label: "Main",
            addressLine1: accountForm.addressLine1,
            city: accountForm.city || undefined,
            state: accountForm.state || undefined,
            country: "US",
            lat: selectedAccountPlace?.lat,
            lng: selectedAccountPlace?.lng,
            geofenceRadiusMeters: 150,
            isPrimary: true,
          }
        : undefined,
    };

    const result = await createAccountMutation.mutateAsync(payload);
    toast({ title: selectedAccountPlace ? "Business imported" : "Lead created" });
    setAccountForm({ name: "", phone: "", email: "", website: "", industry: "", addressLine1: "", city: "", state: "" });
    setSelectedAccountPlace(null);
    await invalidateXpotData();
    return result.account;
  };

  return {
    accountsQuery,
    accountLookupSearch,
    setAccountLookupSearch,
    accountForm,
    setAccountForm,
    selectedAccountPlace,
    setSelectedAccountPlace,
    filteredAccountsForList,
    accountPlaceQuery,
    applyPlaceToAccountForm,
    createAccountFromForm,
    createAccountMutation,
    deleteAccountMutation,
  };
}
