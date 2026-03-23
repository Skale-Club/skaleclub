import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Activity,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  DollarSign,
  ExternalLink,
  Loader2,
  LogOut,
  MapPinned,
  RefreshCw,
  Search,
  Target,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FieldUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
};

type SalesRep = {
  id: number;
  displayName: string;
  role: string;
  team?: string | null;
};

type SalesVisitNote = {
  summary?: string | null;
  outcome?: string | null;
  nextStep?: string | null;
  followUpRequired?: boolean | null;
};

type SalesAccountLocation = {
  id: number;
  label: string;
  addressLine1: string;
  city?: string | null;
  state?: string | null;
};

type SalesAccount = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  industry?: string | null;
  source?: string | null;
  status: string;
  ghlContactId?: string | null;
  locations?: SalesAccountLocation[];
  openOpportunities?: number;
};

type SalesVisit = {
  id: number;
  accountId: number;
  repId: number;
  status: string;
  validationStatus: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  durationSeconds?: number | null;
  distanceFromTargetMeters?: number | null;
  account?: SalesAccount | null;
  note?: SalesVisitNote | null;
};

type SalesOpportunity = {
  id: number;
  accountId: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  syncStatus: string;
  account?: SalesAccount | null;
};

type SalesTask = {
  id: number;
  title: string;
  dueAt?: string | null;
  status: string;
};

type DashboardResponse = {
  metrics: {
    visitsToday: number;
    completedVisits: number;
    activeVisit: SalesVisit | null;
    openOpportunities: number;
    pipelineValue: number;
    pendingTasks: number;
    assignedAccounts: number;
  };
  recentVisits: SalesVisit[];
  openOpportunities: SalesOpportunity[];
  pendingTasks: SalesTask[];
};

type FieldMeResponse = {
  user: FieldUser;
  rep: SalesRep;
  activeVisit: SalesVisit | null;
};

type GooglePlaceResult = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  primaryType?: string;
  lat?: number;
  lng?: number;
};

type PlaceSearchResponse = {
  results: GooglePlaceResult[];
};

type SalesAccountPayload = {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  source?: string;
  status?: string;
  notes?: string;
  primaryLocation?: {
    label?: string;
    addressLine1: string;
    city?: string;
    state?: string;
    country?: string;
    lat?: number;
    lng?: number;
    geofenceRadiusMeters?: number;
    isPrimary?: boolean;
  };
};

const tabs = [
  { id: "check-in", label: "Check-In", icon: MapPinned },
  { id: "accounts", label: "Accounts", icon: Building2 },
  { id: "visits", label: "Visits", icon: Clock3 },
  { id: "sales", label: "Sales", icon: DollarSign },
  { id: "dashboard", label: "Dashboard", icon: Activity },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "0m";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function normalizeSearchValue(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAddress(address?: string) {
  if (!address) {
    return { addressLine1: "", city: "", state: "" };
  }

  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    addressLine1: parts[0] || address,
    city: parts[1] || "",
    state: parts[2]?.split(" ")[0] || "",
  };
}

function findMatchingAccount(place: GooglePlaceResult, accounts: SalesAccount[]) {
  const placeName = normalizeSearchValue(place.name);
  const placeAddress = normalizeSearchValue(place.address);

  return accounts.find((account) => {
    const accountName = normalizeSearchValue(account.name);
    const locationAddress = normalizeSearchValue(
      account.locations?.map((location) => `${location.addressLine1} ${location.city || ""} ${location.state || ""}`).join(" ") || "",
    );

    return (
      accountName === placeName ||
      (placeAddress.length > 10 && locationAddress.includes(placeAddress)) ||
      (locationAddress.length > 10 && placeAddress.includes(locationAddress))
    );
  });
}

function usePlaceSearch(
  search: string,
  enabled: boolean,
  geoState: { lat?: number; lng?: number },
) {
  const deferredSearch = useDeferredValue(search.trim());

  return useQuery<PlaceSearchResponse>({
    queryKey: ["/api/field/place-search", deferredSearch, geoState.lat ?? "", geoState.lng ?? ""],
    enabled: enabled && deferredSearch.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({ q: deferredSearch });
      if (typeof geoState.lat === "number" && typeof geoState.lng === "number") {
        params.set("lat", String(geoState.lat));
        params.set("lng", String(geoState.lng));
      }

      const response = await fetch(`/api/field/place-search?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(text);
      }

      return response.json();
    },
  });
}

function ConfirmSlider({
  label,
  helperText,
  loading,
  disabled,
  onConfirm,
  accentClassName,
}: {
  label: string;
  helperText: string;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  accentClassName?: string;
}) {
  const [value, setValue] = useState([0]);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      hasTriggeredRef.current = false;
      setValue([0]);
    }
  }, [loading, label]);

  const progress = value[0] || 0;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#08120f]">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-[28px] bg-primary/18 transition-[width] duration-200", accentClassName)}
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center px-16 text-center text-sm font-semibold tracking-[0.16em] text-primary">
          {loading ? "PROCESSING..." : label}
        </div>
        <SliderPrimitive.Root
          value={value}
          max={100}
          step={1}
          disabled={disabled || loading}
          onValueChange={(next) => {
            setValue(next);
            if (next[0] >= 96 && !hasTriggeredRef.current && !disabled && !loading) {
              hasTriggeredRef.current = true;
              onConfirm();
            }
          }}
          onValueCommit={(next) => {
            if (next[0] < 96) {
              setValue([0]);
            }
          }}
          className="relative flex h-16 w-full touch-none select-none items-center px-2"
        >
          <SliderPrimitive.Track className="relative h-12 w-full rounded-[24px] bg-transparent">
            <SliderPrimitive.Range className="absolute h-full rounded-[24px] bg-transparent" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-primary text-black shadow-[0_12px_35px_rgba(16,185,129,0.35)] outline-none ring-0 transition-transform focus-visible:scale-105 disabled:opacity-60">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
          </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
      </div>
      <div className="text-center text-xs text-white/45">{helperText}</div>
    </div>
  );
}

export default function FieldApp() {
  const [pathname, setLocation] = useLocation();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [geoState, setGeoState] = useState<{ lat?: number; lng?: number; accuracy?: number; error?: string }>({});
  const [visitNoteForm, setVisitNoteForm] = useState({ summary: "", outcome: "", nextStep: "", followUpRequired: false });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
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
    if (!section) return "dashboard";
    return tabs.some((tab) => tab.id === section) ? section : "dashboard";
  }, [pathname]);

  const fieldMeQuery = useQuery<FieldMeResponse>({
    queryKey: ["/api/field/me"],
    retry: false,
  });

  useEffect(() => {
    if (fieldMeQuery.error) {
      const message = (fieldMeQuery.error as Error).message || "";
      if (message.startsWith("401")) {
setLocation("/checkin/login");
      }
    }
  }, [fieldMeQuery.error, setLocation]);

  const dashboardQuery = useQuery<DashboardResponse>({ queryKey: ["/api/field/dashboard"], enabled: fieldMeQuery.isSuccess });
  const accountsQuery = useQuery<SalesAccount[]>({ queryKey: ["/api/field/accounts"], enabled: fieldMeQuery.isSuccess });
  const visitsQuery = useQuery<SalesVisit[]>({ queryKey: ["/api/field/visits"], enabled: fieldMeQuery.isSuccess });
  const opportunitiesQuery = useQuery<SalesOpportunity[]>({ queryKey: ["/api/field/opportunities"], enabled: fieldMeQuery.isSuccess });
  const tasksQuery = useQuery<SalesTask[]>({ queryKey: ["/api/field/tasks"], enabled: fieldMeQuery.isSuccess });

  const checkInPlaceQuery = usePlaceSearch(checkInSearch, fieldMeQuery.isSuccess && activeTab === "check-in", geoState);
  const accountPlaceQuery = usePlaceSearch(accountLookupSearch, fieldMeQuery.isSuccess && activeTab === "accounts", geoState);

  const activeVisit = useMemo(() => {
    const currentId = fieldMeQuery.data?.activeVisit?.id;
    if (!currentId) return null;
    return visitsQuery.data?.find((visit) => visit.id === currentId) || fieldMeQuery.data?.activeVisit || null;
  }, [fieldMeQuery.data, visitsQuery.data]);

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

  const invalidateFieldData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/field/me"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/visits"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/opportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/field/admin/overview"] }),
    ]);
  };

  const createAccountMutation = useMutation({
    mutationFn: async (payload: SalesAccountPayload) => {
      const response = await apiRequest("POST", "/api/field/accounts", payload);
      return response.json() as Promise<{ account: SalesAccount }>;
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create account", description: error.message, variant: "destructive" });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field/visits/check-in", {
        accountId: Number(selectedAccountId),
        lat: geoState.lat,
        lng: geoState.lng,
        gpsAccuracyMeters: geoState.accuracy,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Checked in successfully" });
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/field/visits/${activeVisit?.id}/check-out`, {
        lat: geoState.lat,
        lng: geoState.lng,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Visit completed" });
      await invalidateFieldData();
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

      const response = await apiRequest("POST", `/api/field/visits/${activeVisit.id}/audio`, {
        audioData,
        durationSeconds: recordingTime,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Audio uploaded successfully" });
      setAudioBlob(null);
      setRecordingTime(0);
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to upload audio", description: error.message, variant: "destructive" });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/field/visits/${activeVisit?.id}/note`, visitNoteForm);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Visit note saved" });
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
    },
  });

  const createOpportunityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field/opportunities", {
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
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create opportunity", description: error.message, variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field/tasks", {
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
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field/sync/flush");
      return response.json();
    },
    onSuccess: async (data) => {
      toast({ title: "Sync completed", description: `${data.accountsSynced} accounts and ${data.opportunitiesSynced} opportunities synced.` });
      await invalidateFieldData();
    },
    onError: (error: Error) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskStatus = async (taskId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/field/tasks/${taskId}`, { status });
      await invalidateFieldData();
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
    setLocation("/checkin/login");
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
      source: selectedAccountPlace ? "google_places" : "field",
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
    await invalidateFieldData();
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
    await invalidateFieldData();
  };

  if (fieldMeQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06090f] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!fieldMeQuery.data) {
    return null;
  }

  const me = fieldMeQuery.data;
  const repName = me.rep.displayName || me.user.email || "Field Rep";

  return (
    <div className="min-h-screen bg-[#06090f] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-primary/75">{isOnline ? "Online" : "Offline"}</div>
            <div className="mt-1 text-lg font-semibold">{repName}</div>
            <div className="text-sm text-white/45">{me.rep.role}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => syncMutation.mutate()}>
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 to-cyan-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Live Status</div>
              <div className="mt-2 text-lg font-semibold">
                {activeVisit ? `Checked in at ${activeVisit.account?.name || `Account #${activeVisit.accountId}`}` : "Ready for next visit"}
              </div>
            </div>
            <Badge className={activeVisit ? "bg-primary text-black" : "bg-white/10 text-white"}>
              {activeVisit ? "Active" : "Idle"}
            </Badge>
          </div>
        </div>

        <main className="flex-1 space-y-4">
          {activeTab === "dashboard" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Visits Today", value: dashboardQuery.data?.metrics.visitsToday ?? 0, icon: MapPinned },
                  { label: "Pipeline Value", value: formatCurrency(dashboardQuery.data?.metrics.pipelineValue ?? 0, "USD"), icon: DollarSign },
                  { label: "Open Opportunities", value: dashboardQuery.data?.metrics.openOpportunities ?? 0, icon: Target },
                  { label: "Pending Tasks", value: dashboardQuery.data?.metrics.pendingTasks ?? 0, icon: Clock3 },
                ].map(({ label, value, icon: Icon }) => (
                  <Card key={label} className="border-white/10 bg-white/5 text-white">
                    <CardContent className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</div>
                        <div className="mt-2 text-2xl font-semibold">{value}</div>
                      </div>
                      <div className="rounded-xl bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader><CardTitle className="text-base">Recent Visits</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {dashboardQuery.data?.recentVisits?.length ? dashboardQuery.data.recentVisits.map((visit) => (
                    <div key={visit.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{visit.account?.name || `Account #${visit.accountId}`}</div>
                        <Badge variant="secondary" className="bg-white/10 text-white">{visit.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-white/55">{formatDateTime(visit.checkedInAt)}</div>
                    </div>
                  )) : <div className="text-sm text-white/50">No visits yet.</div>}
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab === "accounts" ? (
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
                      <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => { setSelectedAccountId(account.id); setCheckInSearch(account.name); setLocation("/checkin/check-in"); }}>
                        Use for Check-In
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "check-in" ? (
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader><CardTitle className="text-base">Field Check-In</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <Input
                    value={checkInSearch}
                    onChange={(event) => setCheckInSearch(event.target.value)}
                    placeholder="Search local accounts or Google Places"
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
                  />
                </div>
                <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={loadCurrentLocation}>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Use Current Location
                </Button>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                  {geoState.error ? geoState.error : geoState.lat && geoState.lng ? `GPS locked at ${geoState.lat.toFixed(5)}, ${geoState.lng.toFixed(5)} (accuracy ${geoState.accuracy || "?"}m)` : "No GPS fix yet. Location improves nearby business search and check-in validation."}
                </div>
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

                    <div className="space-y-2">
                      {filteredAccountsForCheckIn.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => pickLocalAccountForCheckIn(account)}
                          className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-primary/40 hover:bg-black/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{account.name}</div>
                              <div className="mt-1 text-sm text-white/55">{account.locations?.[0]?.addressLine1 || account.industry || "Local account"}</div>
                            </div>
                            <Badge variant="secondary" className="bg-white/10 text-white">Local</Badge>
                          </div>
                        </button>
                      ))}

                      {checkInPlaceQuery.isFetching ? (
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/55">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching Google Places...
                        </div>
                      ) : null}

                      {checkInPlaceQuery.error ? (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                          {(checkInPlaceQuery.error as Error).message}
                        </div>
                      ) : null}

                      {checkInPlaceQuery.data?.results.map((place) => {
                        const existingAccount = findMatchingAccount(place, accountsQuery.data || []);
                        return (
                          <button
                            key={place.placeId}
                            type="button"
                            onClick={() => pickGooglePlaceForCheckIn(place)}
                            className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-cyan-400/40 hover:bg-black/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold">{place.name}</div>
                                <div className="mt-1 text-sm text-white/55">{place.address}</div>
                              </div>
                              <Badge className={existingAccount ? "bg-white/10 text-white" : "bg-cyan-400/15 text-cyan-200"}>
                                {existingAccount ? "Use local" : "Google Places"}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/45">
                              {place.primaryType ? <span>{place.primaryType}</span> : null}
                              {place.phone ? <span>{place.phone}</span> : null}
                            </div>
                          </button>
                        );
                      })}

                      {!filteredAccountsForCheckIn.length && !checkInPlaceQuery.data?.results?.length && checkInSearch.trim().length < 2 ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/50">
                          Start typing to search local accounts and Google Places.
                        </div>
                      ) : null}
                    </div>

                    <ConfirmSlider
                      label={selectedAccount ? "SLIDE TO CHECK IN" : "SELECT AN ACCOUNT FIRST"}
                      helperText={selectedAccount ? `Confirm visit start for ${selectedAccount.name}` : "Choose a local account or Google Place to enable check-in."}
                      loading={checkInMutation.isPending || createAccountMutation.isPending}
                      disabled={!selectedAccountId || createAccountMutation.isPending}
                      onConfirm={() => checkInMutation.mutate()}
                    />
                  </>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-primary/70">Active Visit</div>
                        <div className="mt-1 text-xl font-semibold">{activeVisit.account?.name || `Account #${activeVisit.accountId}`}</div>
                      </div>
                      <Badge className="bg-primary text-black">{activeVisit.validationStatus}</Badge>
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
                        <Button size="sm" variant="outline" className="border-white/10 bg-primary text-black" onClick={() => uploadAudioMutation.mutate()} disabled={uploadAudioMutation.isPending}>
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
                      <Button variant="outline" className="flex-1 border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => saveNoteMutation.mutate()}>
                        {saveNoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Note
                      </Button>
                    </div>
                    <ConfirmSlider
                      label="SLIDE TO CHECK OUT"
                      helperText="Complete the visit and close the timer."
                      loading={checkOutMutation.isPending}
                      onConfirm={() => checkOutMutation.mutate()}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "visits" ? (
            <div className="space-y-3">
              {visitsQuery.data?.length ? visitsQuery.data.map((visit) => (
                <Card key={visit.id} className="border-white/10 bg-white/5 text-white">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{visit.account?.name || `Account #${visit.accountId}`}</div>
                      <Badge variant="secondary" className="bg-white/10 text-white">{visit.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
                      <div><div className="text-white/35">Check-in</div><div>{formatDateTime(visit.checkedInAt)}</div></div>
                      <div><div className="text-white/35">Duration</div><div>{formatDuration(visit.durationSeconds)}</div></div>
                    </div>
                    {visit.note?.summary ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">{visit.note.summary}</div> : null}
                  </CardContent>
                </Card>
              )) : <Card className="border-white/10 bg-white/5 text-white"><CardContent className="p-6 text-sm text-white/50">No visits recorded yet.</CardContent></Card>}
            </div>
          ) : null}

          {activeTab === "sales" ? (
            <>
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader><CardTitle className="text-base">Create Opportunity</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <select value={opportunityForm.accountId} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, accountId: event.target.value }))} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
                    <option value="">Choose an account</option>
                    {accountsQuery.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <Input value={opportunityForm.title} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Opportunity title" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  <div className="grid grid-cols-3 gap-3">
                    <Input value={opportunityForm.value} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, value: event.target.value }))} placeholder="Value" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                    <Input value={opportunityForm.pipelineKey} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, pipelineKey: event.target.value }))} placeholder="Pipeline ID" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                    <Input value={opportunityForm.stageKey} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, stageKey: event.target.value }))} placeholder="Stage ID" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  </div>
                  <Button disabled={createOpportunityMutation.isPending || !opportunityForm.accountId || !opportunityForm.title.trim()} onClick={() => createOpportunityMutation.mutate()} className="w-full bg-primary text-black hover:bg-primary">
                    {createOpportunityMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Opportunity
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader><CardTitle className="text-base">Create Follow-Up Task</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Task title" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  <Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((prev) => ({ ...prev, dueAt: event.target.value }))} className="border-white/10 bg-white/5 text-white" />
                  <Button disabled={createTaskMutation.isPending || !taskForm.title.trim()} onClick={() => createTaskMutation.mutate()} className="w-full bg-white text-slate-900 hover:bg-slate-100">
                    {createTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Task
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {opportunitiesQuery.data?.map((opportunity) => (
                  <Card key={opportunity.id} className="border-white/10 bg-white/5 text-white">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{opportunity.title}</div>
                          <div className="text-sm text-white/55">{opportunity.account?.name || `Account #${opportunity.accountId}`}</div>
                        </div>
                        <Badge variant="secondary" className="bg-white/10 text-white">{opportunity.syncStatus}</Badge>
                      </div>
                      <div className="text-lg font-semibold">{formatCurrency(opportunity.value, opportunity.currency)}</div>
                    </CardContent>
                  </Card>
                ))}

                {tasksQuery.data?.map((task) => (
                  <Card key={task.id} className="border-white/10 bg-white/5 text-white">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-white/55">{task.dueAt ? formatDateTime(task.dueAt) : "No due date"}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="bg-white/10 text-white">{task.status}</Badge>
                        {task.status !== "completed" ? (
                          <Button size="icon" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => updateTaskStatus(task.id, "completed")}>
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </main>

        <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0a0e15]/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLocation(id === "dashboard" ? "/checkin" : `/checkin/${id}`)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-white/45 hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
