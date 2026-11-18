import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Dashboard, Me } from "@/types/api.types";

/** GET /me — profile + the counts behind the Alerts / Inbox tab badges. */
export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: () => apiFetch<Me>("/api/mobile/v1/me"),
  });
}

/** GET /dashboard — one round trip for the home tab. */
export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard(),
    queryFn: () => apiFetch<Dashboard>("/api/mobile/v1/dashboard"),
  });
}
