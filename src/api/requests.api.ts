import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Me, PriorityRequest } from "@/types/api.types";

/** GET /requests — priority requests sent TO me (open + addressed, newest first). */
export function useIncomingRequests() {
  return useQuery({
    queryKey: qk.requests(),
    queryFn: () => apiFetch<PriorityRequest[]>("/api/mobile/v1/requests"),
  });
}

/** POST /requests/:id/address — "Mark done". Optimistic; rolls back on failure. */
export function useAddressRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/mobile/v1/requests/${id}/address`, { method: "POST" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.requests() });
      const previous = qc.getQueryData<PriorityRequest[]>(qk.requests());
      qc.setQueryData<PriorityRequest[]>(qk.requests(), (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, status: "ADDRESSED" } : r)),
      );
      qc.setQueryData<Me>(qk.me(), (me) =>
        me
          ? { ...me, counts: { ...me.counts, openIncomingRequests: Math.max(0, me.counts.openIncomingRequests - 1) } }
          : me,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.requests(), ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.requests() });
      void qc.invalidateQueries({ queryKey: qk.me() });
    },
  });
}
