import { createContext, useContext, type ReactNode } from "react";
import { useXpotShared } from "./hooks/useXpotShared";
import { useXpotQueries } from "./hooks/useXpotQueries";
import { useAccounts } from "./hooks/useAccounts";
import { useVisits } from "./hooks/useVisits";
import { useCheckIn } from "./hooks/useCheckIn";
import { useSales } from "./hooks/useSales";
import type { XpotAppContextValue } from "./XpotContext.types";

export type { XpotAppContextValue };

const XpotAppContext = createContext<XpotAppContextValue | null>(null);

export function useXpotApp() {
  const ctx = useContext(XpotAppContext);
  if (!ctx) throw new Error("useXpotApp must be used within XpotAppProvider");
  return ctx;
}

export function XpotAppProvider({ children }: { children: ReactNode }) {
  const shared = useXpotShared();
  const queries = useXpotQueries();
  const accounts = useAccounts();
  const visits = useVisits();
  const checkIn = useCheckIn();
  const sales = useSales();

  const value: XpotAppContextValue = {
    // Auth & user
    xpotMeQuery: queries.xpotMeQuery,
    me: queries.me,
    repName: queries.repName,
    signOut: queries.signOut,
    syncMutation: queries.syncMutation,

    // Navigation
    activeTab: queries.activeTab,
    pathname: queries.pathname,
    setLocation: queries.setLocation,

    // Online status
    isOnline: queries.isOnline,

    // Active visit
    activeVisit: visits.activeVisit,

    // Queries
    accountsQuery: accounts.accountsQuery,

    // Check-in tab
    selectedAccountId: checkIn.selectedAccountId,
    setSelectedAccountId: checkIn.setSelectedAccountId,
    selectedAccount: checkIn.selectedAccount,
    checkInSearch: checkIn.checkInSearch,
    setCheckInSearch: checkIn.setCheckInSearch,
    checkInDropdownOpen: checkIn.checkInDropdownOpen,
    setCheckInDropdownOpen: checkIn.setCheckInDropdownOpen,
    filteredAccountsForCheckIn: checkIn.filteredAccountsForCheckIn,
    checkInPlaceQuery: checkIn.checkInPlaceQuery,
    checkInMutation: checkIn.checkInMutation,
    createAccountMutation: checkIn.createAccountMutation,
    pickLocalAccountForCheckIn: checkIn.pickLocalAccountForCheckIn,
    pickGooglePlaceForCheckIn: checkIn.pickGooglePlaceForCheckIn,
    createNewCompanyFromSearch: checkIn.createNewCompanyFromSearch,

    // Active visit actions
    visitNoteForm: checkIn.visitNoteForm,
    setVisitNoteForm: checkIn.setVisitNoteForm,
    isRecording: checkIn.isRecording,
    recordingTime: checkIn.recordingTime,
    audioBlob: checkIn.audioBlob,
    setAudioBlob: checkIn.setAudioBlob,
    setRecordingTime: checkIn.setRecordingTime,
    startRecording: checkIn.startRecording,
    stopRecording: checkIn.stopRecording,
    uploadAudioMutation: checkIn.uploadAudioMutation,
    saveNoteMutation: checkIn.saveNoteMutation,
    checkOutMutation: visits.checkOutMutation,
    cancelVisitMutation: visits.cancelVisitMutation,

    // Accounts tab
    accountLookupSearch: accounts.accountLookupSearch,
    setAccountLookupSearch: accounts.setAccountLookupSearch,
    accountForm: accounts.accountForm,
    setAccountForm: accounts.setAccountForm,
    selectedAccountPlace: accounts.selectedAccountPlace,
    setSelectedAccountPlace: accounts.setSelectedAccountPlace,
    filteredAccountsForList: accounts.filteredAccountsForList,
    accountPlaceQuery: accounts.accountPlaceQuery,
    applyPlaceToAccountForm: accounts.applyPlaceToAccountForm,
    createAccountFromForm: accounts.createAccountFromForm,

    // Visits tab
    visitsQuery: visits.visitsQuery,

    // Sales tab
    opportunitiesQuery: sales.opportunitiesQuery,
    tasksQuery: sales.tasksQuery,
    opportunityForm: sales.opportunityForm,
    setOpportunityForm: sales.setOpportunityForm,
    taskForm: sales.taskForm,
    setTaskForm: sales.setTaskForm,
    createOpportunityMutation: sales.createOpportunityMutation,
    createTaskMutation: sales.createTaskMutation,
    updateTaskStatus: sales.updateTaskStatus,

    // Dashboard tab
    dashboardQuery: queries.dashboardQuery,

    // Shared
    geoState: shared.geoState,
    loadCurrentLocation: shared.loadCurrentLocation,
    invalidateXpotData: shared.invalidateXpotData,
  };

  return <XpotAppContext.Provider value={value}>{children}</XpotAppContext.Provider>;
}
