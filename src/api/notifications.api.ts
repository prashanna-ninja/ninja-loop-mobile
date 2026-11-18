import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Me, NotificationPage } from "@/types/api.types";

const PAGE_SIZE = 30;

/** GET /notifications?cursor=&limit= — newest first, cursor-paginated. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: qk.notifications(),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<NotificationPage>(
        `/api/mobile/v1/notifications?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
}

type Pages = InfiniteData<NotificationPage, string | null>;

/** Optimistically mark items read in the list and drop the unread badge. */
function useOptimisticRead() {
  const qc = useQueryClient();
  return (ids: string[] | "all") => {
    const now = new Date().toISOString();
    let marked = 0;
    qc.setQueryData<Pages>(qk.notifications(), (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              items: p.items.map((n) => {
                if (n.readAt || (ids !== "all" && !ids.includes(n.id))) return n;
                marked++;
                return { ...n, readAt: now };
              }),
            })),
          }
        : data,
    );
    qc.setQueryData<Me>(qk.me(), (me) =>
      me
        ? {
            ...me,
            counts: {
              ...me.counts,
              unreadNotifications: ids === "all" ? 0 : Math.max(0, me.counts.unreadNotifications - marked),
            },
          }
        : me,
    );
  };
}

/** POST /notifications/:id/read */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const markLocally = useOptimisticRead();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/mobile/v1/notifications/${id}/read`, { method: "POST" }),
    onMutate: (id) => markLocally([id]),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.me() }),
  });
}

/** POST /notifications/read-all */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const markLocally = useOptimisticRead();
  return useMutation({
    mutationFn: () => apiFetch<void>("/api/mobile/v1/notifications/read-all", { method: "POST" }),
    onMutate: () => markLocally("all"),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.me() });
      void qc.invalidateQueries({ queryKey: qk.notifications() });
    },
  });
}
