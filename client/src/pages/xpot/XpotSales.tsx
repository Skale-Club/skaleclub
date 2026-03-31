import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeads } from "./hooks/useLeads";
import { useSales } from "./hooks/useSales";
import { formatCurrency, formatDateTime } from "./utils";
import type { EnrichedSalesOpportunity } from "./types";

export function XpotSales() {
  const { leadsQuery } = useLeads();
  const {
    opportunitiesQuery,
    tasksQuery,
    opportunityForm,
    setOpportunityForm,
    taskForm,
    setTaskForm,
    createOpportunityMutation,
    createTaskMutation,
    updateTaskStatus,
  } = useSales();

  return (
    <>
      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader><CardTitle className="text-base">Create Opportunity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select value={opportunityForm.leadId} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, leadId: event.target.value }))} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
            <option value="">Choose a lead</option>
            {leadsQuery.data?.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
          </select>
          <Input value={opportunityForm.title} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Opportunity title" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          <div className="grid grid-cols-3 gap-3">
            <Input value={opportunityForm.value} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, value: event.target.value }))} placeholder="Value" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={opportunityForm.pipelineKey} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, pipelineKey: event.target.value }))} placeholder="Pipeline ID" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
            <Input value={opportunityForm.stageKey} onChange={(event) => setOpportunityForm((prev) => ({ ...prev, stageKey: event.target.value }))} placeholder="Stage ID" className="border-white/10 bg-white/5 text-white placeholder:text-white/35" />
          </div>
          <Button disabled={createOpportunityMutation.isPending || !opportunityForm.leadId || !opportunityForm.title.trim()} onClick={() => createOpportunityMutation.mutate(undefined as any)} className="w-full bg-primary text-black hover:bg-primary">
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
          <Button disabled={createTaskMutation.isPending || !taskForm.title.trim()} onClick={() => createTaskMutation.mutate(undefined as any)} className="w-full bg-white text-slate-900 hover:bg-slate-100">
            {createTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Task
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {opportunitiesQuery.data?.map((opportunity: EnrichedSalesOpportunity) => (
          <Card key={opportunity.id} className="border-white/10 bg-white/5 text-white">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{opportunity.title}</div>
                  <div className="text-sm text-white/55">{opportunity.lead?.name || `Lead #${opportunity.leadId}`}</div>
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
  );
}
