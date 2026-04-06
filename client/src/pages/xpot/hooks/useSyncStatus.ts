import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SalesSyncEvent } from "../types";

export type SyncStatusResponse = {
  events: SalesSyncEvent[];
  failedCount: number;
};

export function useSyncStatus() {
  const queryClient = useQueryClient();

  const query = useQuery<SyncStatusResponse>({
    queryKey: ["/api/xpot/sync/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/xpot/sync/status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: string; entityId: string }) => {
      const res = await apiRequest("POST", "/api/xpot/sync/retry", { entityType, entityId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xpot/sync/status"] });
    },
  });

  const failedEvents = query.data?.events.filter((e) => e.status === "failed") ?? [];

  return {
    query,
    failedEvents,
    failedCount: query.data?.failedCount ?? 0,
    retryMutation,
  };
}
