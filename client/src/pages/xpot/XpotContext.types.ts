import { type Dispatch, type SetStateAction } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePlaceSearch } from "./usePlaceSearch";
import type {
  DashboardResponse,
  GooglePlaceResult,
  SalesAccount,
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
  cancelVisitMutation: AnyMutation;

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
