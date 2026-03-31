import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useXpotShared } from "./useXpotShared";
import { useXpotQueries } from "./useXpotQueries";
import { useVisits } from "./useVisits";
import type { SalesOpportunity, SalesTask } from "./types";

export function useSales() {
  const { toast } = useToast();
  const { invalidateXpotData } = useXpotShared();
  const { xpotMeQuery } = useXpotQueries();
  const { activeVisit } = useVisits();

  const [opportunityForm, setOpportunityForm] = useState({ accountId: "", title: "", value: "", pipelineKey: "", stageKey: "" });
  const [taskForm, setTaskForm] = useState({ title: "", dueAt: "" });

  const opportunitiesQuery = useQuery<SalesOpportunity[]>({ queryKey: ["/api/xpot/opportunities"], enabled: xpotMeQuery.isSuccess });
  const tasksQuery = useQuery<SalesTask[]>({ queryKey: ["/api/xpot/tasks"], enabled: xpotMeQuery.isSuccess });

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
    mutationFn: async ({ selectedAccountId }: { selectedAccountId?: number | "" }) => {
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

  const updateTaskStatus = async (taskId: number, status: string) => {
    try {
      await apiRequest("PATCH", `/api/xpot/tasks/${taskId}`, { status });
      await invalidateXpotData();
      toast({ title: "Task updated" });
    } catch (error: any) {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    }
  };

  return {
    opportunitiesQuery,
    tasksQuery,
    opportunityForm,
    setOpportunityForm,
    taskForm,
    setTaskForm,
    createOpportunityMutation,
    createTaskMutation,
    updateTaskStatus,
  };
}
