import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePlaceSearch } from "./usePlaceSearch";
import { findMatchingAccount, parseAddress, tabs } from "./utils";
import type {
  DashboardResponse,
  GooglePlaceResult,
  SalesAccount,
  SalesAccountPayload,
  SalesOpportunity,
  SalesTask,
  SalesVisit,
  XpotMeResponse,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = ReturnType<typeof useMutation<any, any, any, any>>;

export interface XpotAppContextValue {
  // Auth & user
  xpotMeQuery: ReturnType<typeof useQuery<XpotMeResponse>>;
  me: XpotMeResponse | null;
  repName: string;
  signOut: () => Promise<void>;
  syncMutation: AnyMutation;

  // Navigation
  activeTab: string;
  pathname: string;
  setLocation: (path: string) => void;

  // Online status
  isOnline: boolean;

  // Active visit
  activeVisit: SalesVisit | null;

  // Queries
  accountsQuery: ReturnType<typeof useQuery<SalesAccount[]>>;

  // Check-in tab
  selectedAccountId: number | "";
  setSelectedAccountId: Dispatch<SetStateAction<number | "">>;
  selectedAccount: SalesAccount | null;
  checkInSearch: string;
  setCheckInSearch: Dispatch<SetStateAction<string>>;
  checkInDropdownOpen: boolean;
  setCheckInDropdownOpen: Dispatch<SetStateAction<boolean>>;
  filteredAccountsForCheckIn: SalesAccount[];
  checkInPlaceQuery: ReturnType<typeof usePlaceSearch>;
  checkInMutation: AnyMutation;
  createAccountMutation: AnyMutation;
  pickLocalAccountForCheckIn: (account: SalesAccount) => void;
  pickGooglePlaceForCheckIn: (place: GooglePlaceResult) => Promise<void>;
  createNewCompanyFromSearch: () => Promise<void>;

  // Active visit actions (check-in tab)
  visitNoteForm: { summary: string; outcome: string; nextStep: string; followUpRequired: boolean };
  setVisitNoteForm: Dispatch<SetStateAction<{ summary: string; outcome: string; nextStep: string; followUpRequired: boolean }>>;
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  setAudioBlob: Dispatch<SetStateAction<Blob | null>>;
  setRecordingTime: Dispatch<SetStateAction<number>>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  uploadAudioMutation: AnyMutation;
  saveNoteMutation: AnyMutation;
  checkOutMutation: AnyMutation;

  // Accounts tab
  accountLookupSearch: string;
  setAccountLookupSearch: Dispatch<SetStateAction<string>>;
  accountForm: {
    name: string;
    phone: string;
    email: string;
    website: string;
    industry: string;
    addressLine1: string;
    city: string;
    state: string;
  };
  setAccountForm: Dispatch<SetStateAction<{
    name: string;
    phone: string;
    email: string;
    website: string;
    industry: string;
    addressLine1: string;
    city: string;
    state: string;
  }>>;
  selectedAccountPlace: GooglePlaceResult | null;
  setSelectedAccountPlace: Dispatch<SetStateAction<GooglePlaceResult | null>>;
  filteredAccountsForList: SalesAccount[];
  accountPlaceQuery: ReturnType<typeof usePlaceSearch>;
  applyPlaceToAccountForm: (place: GooglePlaceResult) => void;
  createAccountFromForm: () => Promise<SalesAccount>;

  // Visits tab
  visitsQuery: ReturnType<typeof useQuery<SalesVisit[]>>;

  // Sales tab
  opportunitiesQuery: ReturnType<typeof useQuery<SalesOpportunity[]>>;
  tasksQuery: ReturnType<typeof useQuery<SalesTask[]>>;
  opportunityForm: { accountId: string; title: string; value: string; pipelineKey: string; stageKey: string };
  setOpportunityForm: Dispatch<SetStateAction<{ accountId: string; title: string; value: string; pipelineKey: string; stageKey: string }>>;
  taskForm: { title: string; dueAt: string };
  setTaskForm: Dispatch<SetStateAction<{ title: string; dueAt: string }>>;
  createOpportunityMutation: AnyMutation;
  createTaskMutation: AnyMutation;
  updateTaskStatus: (taskId: number, status: string) => Promise<void>;

  // Dashboard tab
  dashboardQuery: ReturnType<typeof useQuery<DashboardResponse>>;

  // Shared
  geoState: { lat?: number; lng?: number; accuracy?: number; error?: string };
  loadCurrentLocation: () => Promise<void>;
  invalidateXpotData: () => Promise<void>;
}

const XpotAppContext = createContext<XpotAppContextValue | null>(null);

export function useXpotApp() {
  const ctx = useContext(XpotAppContext);
  if (!ctx) throw new Error("useXpotApp must be used within XpotAppProvider");
  return ctx;
}

export function XpotAppProvider({ children }: { children: ReactNode }) {
  const [pathname, setLocation] = useLocation();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [geoState, setGeoState] = useState<{ lat?: number; lng?: number; accuracy?: number; error?: string }>({});
  const [visitNoteForm, setVisitNoteForm] = useState({ summary: "", outcome: "", nextStep: "", followUpRequired: false });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
  const [selectedAccountPlace, setSelectedAccountPlace] = useState<GooglePlaceResult | null>(null);
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkInDropdownOpen, setCheckInDropdownOpen] = useState(false);
  const [accountLookupSearch, setAccountLookupSearch] = useState("");
  const [opportunityForm, setOpportunityForm] = useState({ accountId: "", title: "", value: "", pipelineKey: "", stageKey: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueAt: "" });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const activeTab = useMemo(() => {
    const section = pathname.split("/")[2];
    if (!section) return "check-in";
    return tabs.some((tab) => tab.id === section) ? section : "check-in";
  }, [pathname]);

  const xpotMeQuery = useQuery<XpotMeResponse>({
    queryKey: ["/api/xpot/me"],
    retry: false,
  });

  useEffect(() => {
    if (xpotMeQuery.error) {
      const message = (xpotMeQuery.error as Error).message || "";
      if (message.startsWith("401")) {
        setLocation("/xpot/login");
      }
    }
  }, [xpotMeQuery.error, setLocation]);

  const dashboardQuery = useQuery<DashboardResponse>({ queryKey: ["/api/xpot/dashboard"], enabled: xpotMeQuery.isSuccess });
  const accountsQuery = useQuery<SalesAccount[]>({ queryKey: ["/api/xpot/accounts"], enabled: xpotMeQuery.isSuccess });
  const visitsQuery = useQuery<SalesVisit[]>({ queryKey: ["/api/xpot/visits"], enabled: xpotMeQuery.isSuccess });
  const opportunitiesQuery = useQuery<SalesOpportunity[]>({ queryKey: ["/api/xpot/opportunities"], enabled: xpotMeQuery.isSuccess });
  const tasksQuery = useQuery<SalesTask[]>({ queryKey: ["/api/xpot/tasks"], enabled: xpotMeQuery.isSuccess });

  const checkInPlaceQuery = usePlaceSearch(checkInSearch, xpotMeQuery.isSuccess && activeTab === "check-in", geoState);
  const accountPlaceQuery = usePlaceSearch(accountLookupSearch, xpotMeQuery.isSuccess && activeTab === "accounts", geoState);

  const activeVisit = useMemo(() => {
    const currentId = xpotMeQuery.data?.activeVisit?.id;
    if (!currentId) return null;
    return visitsQuery.data?.find((visit) => visit.id === currentId) || xpotMeQuery.data?.activeVisit || null;
  }, [xpotMeQuery.data, visitsQuery.data]);

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

  const filteredAccountsForCheckIn = useMemo(() => {
    const search = checkInSearch.trim().toLowerCase();
    if (!search) {
      return (accountsQuery.data || []).slice(0, 6);
    }

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

  const filteredAccountsForList = useMemo(() => {
    const search = accountLookupSearch.trim().toLowerCase();
    if (!search) {
      return accountsQuery.data || [];
    }

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

  const selectedAccount = useMemo(
    () => (typeof selectedAccountId === "number" ? accountsQuery.data?.find((account) => account.id === selectedAccountId) || null : null),
    [accountsQuery.data, selectedAccountId],
  );

  const invalidateXpotData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/visits"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/admin/overview"] }),
    ]);
  };

  const createAccountMutation = useMutation({
    mutationFn: async (payload: SalesAccountPayload) => {
      const response = await apiRequest("POST", "/api/xpot/accounts", payload);
      return response.json() as Promise<{ account: SalesAccount }>;
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create account", description: error.message, variant: "destructive" });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/xpot/visits/check-in", {
        accountId: Number(selectedAccountId),
        lat: geoState.lat,
        lng: geoState.lng,
        gpsAccuracyMeters: geoState.accuracy,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Checked in successfully" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xpot/visits/${activeVisit?.id}/check-out`, {
        lat: geoState.lat,
        lng: geoState.lng,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Visit completed" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Check-out failed", description: error.message, variant: "destructive" });
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
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
          if (prev >= 300) {
            stopRecording();
            return prev;
          }
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
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Audio uploaded successfully" });
      setAudioBlob(null);
      setRecordingTime(0);
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to upload audio", description: error.message, variant: "destructive" });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/xpot/visits/${activeVisit?.id}/note`, visitNoteForm);
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

  const createOpportunityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/xpot/opportunities", {
        accountId: Number(opportunityForm.accountId),
        visitId: activeVisit?.id,
        title: opportunityForm.title,
        value: Number(opportunityForm.value || 0),
        currency: "USD",
        pipelineKey: opportunityForm.pipelineKey || undefined,
        stageKey: opportunityForm.stageKey || undefined,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Opportunity created" });
      setOpportunityForm({ accountId: "", title: "", value: "", pipelineKey: "", stageKey: "" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create opportunity", description: error.message, variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/xpot/tasks", {
        accountId: selectedAccountId ? Number(selectedAccountId) : undefined,
        visitId: activeVisit?.id,
        title: taskForm.title,
        dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : undefined,
        type: "follow_up",
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Task created" });
      setTaskForm({ title: "", dueAt: "" });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/xpot/sync/flush");
      return response.json();
    },
    onSuccess: async (data) => {
      toast({ title: "Sync completed", description: `${data.accountsSynced} accounts and ${data.opportunitiesSynced} opportunities synced.` });
      await invalidateXpotData();
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskStatus = async (taskId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/xpot/tasks/${taskId}`, { status });
      await invalidateXpotData();
      toast({ title: "Task updated" });
    } catch (error: any) {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    }
  };

  const loadCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGeoState({ error: "Geolocation is not supported on this device." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
      },
      (error) => {
        setGeoState({ error: error.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/xpot/login");
  };

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
    toast({ title: selectedAccountPlace ? "Business imported" : "Account created" });
    setAccountForm({
      name: "",
      phone: "",
      email: "",
      website: "",
      industry: "",
      addressLine1: "",
      city: "",
      state: "",
    });
    setSelectedAccountPlace(null);
    await invalidateXpotData();
    return result.account;
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
      toast({ title: "Local account selected", description: existingAccount.name });
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

  const me = xpotMeQuery.data ?? null;
  const repName = me ? me.rep.displayName || me.user.email || "Xpot Rep" : "Xpot Rep";

  const value: XpotAppContextValue = {
    xpotMeQuery,
    me,
    repName,
    signOut,
    syncMutation,
    activeTab,
    pathname,
    setLocation,
    isOnline,
    activeVisit,
    accountsQuery,
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
    checkOutMutation,
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
    visitsQuery,
    opportunitiesQuery,
    tasksQuery,
    opportunityForm,
    setOpportunityForm,
    taskForm,
    setTaskForm,
    createOpportunityMutation,
    createTaskMutation,
    updateTaskStatus,
    dashboardQuery,
    geoState,
    loadCurrentLocation,
    invalidateXpotData,
  };

  return <XpotAppContext.Provider value={value}>{children}</XpotAppContext.Provider>;
}
