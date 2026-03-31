import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePlaceSearch } from "../usePlaceSearch";
import { findMatchingAccount, parseAddress } from "../utils";
import { useXpotShared } from "./useXpotShared";
import { useXpotQueries } from "./useXpotQueries";
import { useAccounts } from "./useAccounts";
import { useVisits } from "./useVisits";
import type { GooglePlaceResult, SalesAccount, SalesAccountPayload, SalesVisitNote } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = ReturnType<typeof useMutation<any, any, any, any>>;

export function useCheckIn() {
  const { toast } = useToast();
  const { geoState, invalidateXpotData } = useXpotShared();
  const { xpotMeQuery, activeTab, isOnline } = useXpotQueries();
  const { accountsQuery, createAccountMutation } = useAccounts();
  const { activeVisit, checkingInRef } = useVisits();

  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkInDropdownOpen, setCheckInDropdownOpen] = useState(false);
  const [visitNoteForm, setVisitNoteForm] = useState({ summary: "", outcome: "", nextStep: "", followUpRequired: false });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const checkInPlaceQuery = usePlaceSearch(checkInSearch, xpotMeQuery.isSuccess && activeTab === "check-in", geoState);

  const selectedAccount = useMemo(
    () => (typeof selectedAccountId === "number" ? accountsQuery.data?.find((account) => account.id === selectedAccountId) || null : null),
    [accountsQuery.data, selectedAccountId],
  );

  const filteredAccountsForCheckIn = useMemo(() => {
    const search = checkInSearch.trim().toLowerCase();
    if (!search) return (accountsQuery.data || []).slice(0, 6);

    return (accountsQuery.data || []).filter((account) => {
      const haystack = [
        account.name,
        account.industry,
        account.phone,
        account.email,
        account.locations?.map((location) => `${location.addressLine1} ${location.city || ""} ${location.state || ""}`).join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    }).slice(0, 6);
  }, [accountsQuery.data, checkInSearch]);

  useEffect(() => {
    if (activeVisit?.note) {
      setVisitNoteForm({
        summary: activeVisit.note.summary || "",
        outcome: activeVisit.note.outcome || "",
        nextStep: activeVisit.note.nextStep || "",
        followUpRequired: Boolean(activeVisit.note.followUpRequired),
      });
    }
  }, [activeVisit?.id, activeVisit?.note]);

  const checkInMutation = useMutation({
    mutationFn: async (input: { accountId: number; lat?: number; lng?: number; gpsAccuracyMeters?: number | null }) => {
      if (!isOnline) throw new Error("You are offline. Please check your connection.");
      checkingInRef.current = true;
      const response = await apiRequest("POST", "/api/xpot/visits/check-in", input);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Checked in successfully" });
      await invalidateXpotData();
      setTimeout(() => { checkingInRef.current = false; }, 2000);
    },
    onError: (error: Error) => {
      checkingInRef.current = false;
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async () => {
      if (!activeVisit?.id) throw new Error("No active visit to save note for.");
      const response = await apiRequest("PATCH", `/api/xpot/visits/${activeVisit.id}/note`, visitNoteForm);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Visit note saved" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
    },
  });

  const uploadAudioMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob || !activeVisit?.id) return;
      const reader = new FileReader();
      const audioData = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });

      const response = await apiRequest("POST", `/api/xpot/visits/${activeVisit.id}/audio`, {
        audioData,
        durationSeconds: recordingTime,
      });
      return response.json() as Promise<{
        note: SalesVisitNote;
        transcriptionAvailable: boolean;
        analysisApplied: boolean;
      }>;
    },
    onSuccess: async (result) => {
      toast({
        title: result?.analysisApplied ? "Audio analyzed successfully" : "Audio uploaded successfully",
        description: result?.analysisApplied
          ? "The transcription was analyzed and the visit note was updated."
          : result?.transcriptionAvailable
            ? "The audio was transcribed and saved."
            : "The audio was saved.",
      });
      setAudioBlob(null);
      setRecordingTime(0);
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to upload audio", description: error.message, variant: "destructive" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 300) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);

      (mediaRecorder as any).intervalId = interval;
    } catch (error) {
      toast({ title: "Failed to start recording", description: "Please grant microphone permission", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      const intervalId = (mediaRecorderRef.current as any).intervalId;
      clearInterval(intervalId);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const pickLocalAccountForCheckIn = (account: SalesAccount) => {
    setSelectedAccountId(account.id);
    setCheckInSearch(account.name);
  };

  const pickGooglePlaceForCheckIn = async (place: GooglePlaceResult) => {
    const existingAccount = findMatchingAccount(place, accountsQuery.data || []);
    if (existingAccount) {
      setSelectedAccountId(existingAccount.id);
      setCheckInSearch(existingAccount.name);
      toast({ title: "Local lead selected", description: existingAccount.name });
      return;
    }

    const parsedAddress = parseAddress(place.address);
    const createdAccount = await createAccountMutation.mutateAsync({
      name: place.name,
      phone: place.phone || undefined,
      website: place.website || undefined,
      industry: place.primaryType || undefined,
      source: "google_places",
      status: "lead",
      notes: `Imported from Google Places (${place.placeId})`,
      primaryLocation: {
        label: "Main",
        addressLine1: parsedAddress.addressLine1 || place.address,
        city: parsedAddress.city || undefined,
        state: parsedAddress.state || undefined,
        country: "US",
        lat: place.lat,
        lng: place.lng,
        geofenceRadiusMeters: 150,
        isPrimary: true,
      },
    });

    setSelectedAccountId(createdAccount.account.id);
    setCheckInSearch(place.name);
    toast({ title: "Business imported for check-in", description: place.name });
    await invalidateXpotData();
  };

  const createNewCompanyFromSearch = async () => {
    const name = checkInSearch.trim();
    if (!name) return;

    const createdAccount = await createAccountMutation.mutateAsync({
      name,
      source: "manual",
      status: "lead",
      notes: "Created manually during check-in",
      primaryLocation: {
        label: "Main",
        addressLine1: "",
        country: "US",
        lat: geoState.lat,
        lng: geoState.lng,
        geofenceRadiusMeters: 150,
        isPrimary: true,
      },
    });

    setSelectedAccountId(createdAccount.account.id);
    setCheckInSearch(createdAccount.account.name);
    setCheckInDropdownOpen(false);
    toast({ title: "Company created", description: createdAccount.account.name });
    await invalidateXpotData();
  };

  return {
    selectedAccountId,
    setSelectedAccountId,
    selectedAccount,
    checkInSearch,
    setCheckInSearch,
    checkInDropdownOpen,
    setCheckInDropdownOpen,
    filteredAccountsForCheckIn,
    checkInPlaceQuery,
    checkInMutation,
    createAccountMutation,
    pickLocalAccountForCheckIn,
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
  };
}
