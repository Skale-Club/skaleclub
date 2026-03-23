import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Activity,
  Building2,
  Check,
  Clock3,
  DollarSign,
  Loader2,
  LogOut,
  MapPinned,
  RefreshCw,
  Target,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
  industry?: string | null;
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

export default function FieldApp() {
  const [, setLocation] = useLocation();
  const [pathname] = useLocation();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [geoState, setGeoState] = useState<{ lat?: number; lng?: number; accuracy?: number; error?: string }>({});
  const [visitNoteForm, setVisitNoteForm] = useState({ summary: "", outcome: "", nextStep: "", followUpRequired: false });
  const [accountForm, setAccountForm] = useState({ name: "", phone: "", email: "", industry: "", addressLine1: "", city: "", state: "" });
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
        setLocation("/field/login");
      }
    }
  }, [fieldMeQuery.error, setLocation]);

  const dashboardQuery = useQuery<DashboardResponse>({ queryKey: ["/api/field/dashboard"], enabled: fieldMeQuery.isSuccess });
  const accountsQuery = useQuery<SalesAccount[]>({ queryKey: ["/api/field/accounts"], enabled: fieldMeQuery.isSuccess });
  const visitsQuery = useQuery<SalesVisit[]>({ queryKey: ["/api/field/visits"], enabled: fieldMeQuery.isSuccess });
  const opportunitiesQuery = useQuery<SalesOpportunity[]>({ queryKey: ["/api/field/opportunities"], enabled: fieldMeQuery.isSuccess });
  const tasksQuery = useQuery<SalesTask[]>({ queryKey: ["/api/field/tasks"], enabled: fieldMeQuery.isSuccess });

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
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/field/accounts", {
        name: accountForm.name,
        phone: accountForm.phone || undefined,
        email: accountForm.email || undefined,
        industry: accountForm.industry || undefined,
        primaryLocation: accountForm.addressLine1 ? {
          label: "Main",
          addressLine1: accountForm.addressLine1,
          city: accountForm.city || undefined,
          state: accountForm.state || undefined,
          country: "US",
        } : undefined,
      });
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: "Account created" });
      setAccountForm({ name: "", phone: "", email: "", industry: "", addressLine1: "", city: "", state: "" });
      await invalidateFieldData();
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
    setLocation("/field/login");
  };

  if (fieldMeQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06090f] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
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
            <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/75">{isOnline ? "Online" : "Offline"}</div>
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

        <div className="mb-4 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Live Status</div>
              <div className="mt-2 text-lg font-semibold">
                {activeVisit ? `Checked in at ${activeVisit.account?.name || `Account #${activeVisit.accountId}`}` : "Ready for next visit"}
              </div>
            </div>
            <Badge className={activeVisit ? "bg-emerald-500 text-black" : "bg-white/10 text-white"}>
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
                      <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
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
                <CardHeader><CardTitle className="text-base">Create Account</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input value={accountForm.name} onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Business name" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={accountForm.phone} onChange={(event) => setAccountForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Phone" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                    <Input value={accountForm.email} onChange={(event) => setAccountForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  </div>
                  <Input value={accountForm.industry} onChange={(event) => setAccountForm((prev) => ({ ...prev, industry: event.target.value }))} placeholder="Industry" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  <Input value={accountForm.addressLine1} onChange={(event) => setAccountForm((prev) => ({ ...prev, addressLine1: event.target.value }))} placeholder="Address" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={accountForm.city} onChange={(event) => setAccountForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="City" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                    <Input value={accountForm.state} onChange={(event) => setAccountForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="State" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
                  </div>
                  <Button disabled={createAccountMutation.isPending || !accountForm.name.trim()} onClick={() => createAccountMutation.mutate()} className="w-full bg-emerald-500 text-black hover:bg-emerald-400">
                    {createAccountMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Account
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {accountsQuery.data?.map((account) => (
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
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300">{account.openOpportunities || 0} open opportunities</Badge>
                        <Badge variant="secondary" className="bg-white/10 text-white/70">{account.ghlContactId ? "GHL linked" : "Local only"}</Badge>
                      </div>
                      <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => { setSelectedAccountId(account.id); setLocation("/field/check-in"); }}>
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
                <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value ? Number(event.target.value) : "")} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
                  <option value="">Choose an account</option>
                  {accountsQuery.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <Button variant="outline" className="w-full border-white/10 bg-transparent text-white hover:bg-white/10" onClick={loadCurrentLocation}>
                  <MapPinned className="mr-2 h-4 w-4" />
                  Use Current Location
                </Button>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                  {geoState.error ? geoState.error : geoState.lat && geoState.lng ? `GPS locked at ${geoState.lat.toFixed(5)}, ${geoState.lng.toFixed(5)} (accuracy ${geoState.accuracy || "?"}m)` : "No GPS fix yet."}
                </div>
                {activeVisit ? (
                  <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Active Visit</div>
                        <div className="mt-1 text-xl font-semibold">{activeVisit.account?.name || `Account #${activeVisit.accountId}`}</div>
                      </div>
                      <Badge className="bg-emerald-500 text-black">{activeVisit.validationStatus}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-white/65">
                      <div><div className="text-white/40">Check-in</div><div>{formatDateTime(activeVisit.checkedInAt)}</div></div>
                      <div><div className="text-white/40">Distance</div><div>{activeVisit.distanceFromTargetMeters ? `${activeVisit.distanceFromTargetMeters} m` : "Unknown"}</div></div>
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
                      <Button className="flex-1 bg-emerald-500 text-black hover:bg-emerald-400" onClick={() => checkOutMutation.mutate()}>
                        {checkOutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Check Out
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button disabled={checkInMutation.isPending || !selectedAccountId} onClick={() => checkInMutation.mutate()} className="h-12 w-full bg-emerald-500 text-black hover:bg-emerald-400">
                    {checkInMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Start Visit
                  </Button>
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
                  <Button disabled={createOpportunityMutation.isPending || !opportunityForm.accountId || !opportunityForm.title.trim()} onClick={() => createOpportunityMutation.mutate()} className="w-full bg-emerald-500 text-black hover:bg-emerald-400">
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
                  onClick={() => setLocation(id === "dashboard" ? "/field" : `/field/${id}`)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-colors ${isActive ? "bg-emerald-500/15 text-emerald-300" : "text-white/45 hover:text-white"}`}
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
