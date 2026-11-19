import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  Dashboard,
  DashboardWorkspace,
  Member,
  TaskDetail,
  TaskPatch,
  TaskSummary,
  Workspace,
} from "@/types/api.types";

const base = (wid: string) => `/api/mobile/v1/workspaces/${wid}`;

/** After anything that changes a workspace's tasks: the whole workspace subtree + the dashboard. */
export function invalidateWorkspace(qc: QueryClient, wid: string) {
  void qc.invalidateQueries({ queryKey: qk.workspace(wid) });
  void qc.invalidateQueries({ queryKey: qk.dashboard() });
}

/* ── Reads ───────────────────────────────────────────────────────────── */

/** GET /workspaces/:wid — name, your role, member / active-task counts. */
export function useWorkspace(wid: string) {
  return useQuery({
    queryKey: qk.workspace(wid),
    queryFn: () => apiFetch<Workspace>(base(wid)),
  });
}

/** GET /workspaces/:wid/members — sorted by name. */
export function useMembers(wid: string) {
  return useQuery({
    queryKey: qk.members(wid),
    queryFn: () => apiFetch<Member[]>(`${base(wid)}/members`),
  });
}

/** GET /workspaces/:wid/tasks — open tasks by position; with showDone, completed follow. */
export function useWorkspaceTasks(wid: string, showDone: boolean) {
  return useQuery({
    queryKey: qk.tasks(wid, showDone),
    queryFn: () => apiFetch<TaskSummary[]>(`${base(wid)}/tasks?showDone=${showDone ? 1 : 0}`),
    // Toggling "show done" keeps the current list on screen instead of flashing skeletons
    // (only within the same workspace — never show another workspace's tasks).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === wid ? prev : undefined),
  });
}

/* ── Queue mutations ─────────────────────────────────────────────────── */

/** POST /workspaces/:wid/tasks — new task goes to the TOP and is assigned to you. */
export function useCreateTask(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; dueDate?: string | null }) =>
      apiFetch<TaskDetail>(`${base(wid)}/tasks`, { method: "POST", body: JSON.stringify(body) }),
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/** Snapshot every cached variant of the queue so an optimistic edit can roll back. */
async function snapshotQueues(qc: QueryClient, wid: string) {
  await qc.cancelQueries({ queryKey: qk.tasksAll(wid) });
  return qc.getQueriesData<TaskSummary[]>({ queryKey: qk.tasksAll(wid) });
}

function restoreQueues(qc: QueryClient, snapshot: ReturnType<QueryClient["getQueriesData"]> | undefined) {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
}

/** Apply a PATCH body to a cached task (queue row or detail). */
function applyPatch<T extends { completedAt: string | null }>(t: T, patch: TaskPatch): T {
  const { completed, ...rest } = patch;
  return {
    ...t,
    ...rest,
    ...(completed === undefined ? {} : { completedAt: completed ? new Date().toISOString() : null }),
  };
}

/**
 * PATCH /workspaces/:wid/tasks/:tid — any subset of fields.
 * Optimistic on the queue AND the task detail (complete / dates / block show
 * instantly); the detail is replaced with the server's TaskDetail on success.
 */
export function useUpdateTask(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid, patch }: { tid: string; patch: TaskPatch }) =>
      apiFetch<TaskDetail>(`${base(wid)}/tasks/${tid}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: async ({ tid, patch }) => {
      const snapshot = await snapshotQueues(qc, wid);
      await qc.cancelQueries({ queryKey: qk.task(wid, tid) });
      const previousDetail = qc.getQueryData<TaskDetail>(qk.task(wid, tid));
      qc.setQueriesData<TaskSummary[]>({ queryKey: qk.tasksAll(wid) }, (rows) =>
        rows?.map((t) => (t.id === tid ? applyPatch(t, patch) : t)),
      );
      if (previousDetail) qc.setQueryData(qk.task(wid, tid), applyPatch(previousDetail, patch));
      return { snapshot, previousDetail };
    },
    onError: (_e, { tid }, ctx) => {
      restoreQueues(qc, ctx?.snapshot);
      if (ctx?.previousDetail) qc.setQueryData(qk.task(wid, tid), ctx.previousDetail);
    },
    onSuccess: (task) => qc.setQueryData(qk.task(wid, task.id), task),
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/** DELETE /workspaces/:wid/tasks/:tid */
export function useDeleteTask(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tid: string) => apiFetch<void>(`${base(wid)}/tasks/${tid}`, { method: "DELETE" }),
    onMutate: async (tid) => {
      const snapshot = await snapshotQueues(qc, wid);
      qc.setQueriesData<TaskSummary[]>({ queryKey: qk.tasksAll(wid) }, (rows) => rows?.filter((t) => t.id !== tid));
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restoreQueues(qc, ctx?.snapshot),
    onSuccess: (_d, tid) => qc.removeQueries({ queryKey: qk.task(wid, tid) }),
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/**
 * PUT /workspaces/:wid/tasks/:tid/position — move an OPEN task to a new index
 * in the open queue (0 = top / next up). Neighbours are in position order.
 */
export function useMoveTask(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tid, afterId, beforeId }: { tid: string; toIndex: number; afterId?: string; beforeId?: string }) =>
      apiFetch<void>(`${base(wid)}/tasks/${tid}/position`, {
        method: "PUT",
        body: JSON.stringify({ afterId, beforeId }),
      }),
    onMutate: async ({ tid, toIndex }) => {
      const snapshot = await snapshotQueues(qc, wid);
      qc.setQueriesData<TaskSummary[]>({ queryKey: qk.tasksAll(wid) }, (rows) => {
        if (!rows) return rows;
        const open = rows.filter((t) => !t.completedAt);
        const done = rows.filter((t) => t.completedAt);
        const from = open.findIndex((t) => t.id === tid);
        if (from < 0) return rows;
        const [moved] = open.splice(from, 1);
        open.splice(toIndex, 0, moved);
        return [...open, ...done];
      });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restoreQueues(qc, ctx?.snapshot),
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/** Neighbour ids for moving `tid` to `toIndex` within `openIds` (top → bottom). */
export function neighboursFor(openIds: string[], tid: string, toIndex: number) {
  const rest = openIds.filter((id) => id !== tid);
  const clamped = Math.max(0, Math.min(toIndex, rest.length));
  return { afterId: rest[clamped - 1], beforeId: rest[clamped], toIndex: clamped };
}

/* ── Workspace-level ─────────────────────────────────────────────────── */

/** POST /workspaces/:wid/requests — ask the owner to review priorities (not for owners). */
export function useRequestPriority(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { message: string; taskId?: string }) =>
      apiFetch<void>(`${base(wid)}/requests`, { method: "POST", body: JSON.stringify(body) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.me() }),
  });
}

/** After a workspace is created / renamed / deleted / reordered: every list that shows workspaces. */
export function invalidateWorkspaceLists(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.dashboard() });
  void qc.invalidateQueries({ queryKey: qk.workspaces() });
}

/** GET /workspaces — the same items as `dashboard.workspaces`, in your personal order. */
export function useWorkspaces() {
  return useQuery({
    queryKey: qk.workspaces(),
    queryFn: () => apiFetch<DashboardWorkspace[]>("/api/mobile/v1/workspaces"),
  });
}

/** POST /workspaces — you become OWNER. `name` 1–100 chars. Returns `{ id, slug }`. */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ id: string; slug: string }>("/api/mobile/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSettled: () => invalidateWorkspaceLists(qc),
  });
}

/** PATCH /workspaces/:wid `{ name }` (OWNER / ADMIN) → the updated Workspace. */
export function useRenameWorkspace(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<Workspace>(base(wid), { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: (ws) => qc.setQueryData(qk.workspace(wid), ws),
    onSettled: () => invalidateWorkspaceLists(qc),
  });
}

/** DELETE /workspaces/:wid (OWNER only) — the workspace and all its tasks. */
export function useDeleteWorkspace(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(base(wid), { method: "DELETE" }),
    onSuccess: () => {
      // The caller navigates away (dismissTo "/"). Drop this workspace's cache only
      // AFTER its screens unmount — removing it under mounted observers makes them
      // refetch and flash "Workspace not found." first.
      void qc.cancelQueries({ queryKey: qk.workspace(wid) });
      setTimeout(() => qc.removeQueries({ queryKey: qk.workspace(wid) }), 1000);
      invalidateWorkspaceLists(qc);
      void qc.invalidateQueries({ queryKey: qk.notifications() });
    },
  });
}

/**
 * PUT /workspaces/order `{ orderedIds }` — your personal order (every id must be
 * a workspace you're in). Optimistic on the dashboard and the workspaces list.
 */
export function useReorderWorkspaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch<void>("/api/mobile/v1/workspaces/order", { method: "PUT", body: JSON.stringify({ orderedIds }) }),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: qk.dashboard() });
      await qc.cancelQueries({ queryKey: qk.workspaces() });
      const prevDashboard = qc.getQueryData<Dashboard>(qk.dashboard());
      const prevList = qc.getQueryData<DashboardWorkspace[]>(qk.workspaces());
      const sort = (list: DashboardWorkspace[]) =>
        [...list].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
      if (prevDashboard) qc.setQueryData(qk.dashboard(), { ...prevDashboard, workspaces: sort(prevDashboard.workspaces) });
      if (prevList) qc.setQueryData(qk.workspaces(), sort(prevList));
      return { prevDashboard, prevList };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevDashboard) qc.setQueryData(qk.dashboard(), ctx.prevDashboard);
      if (ctx?.prevList) qc.setQueryData(qk.workspaces(), ctx.prevList);
    },
    onSettled: () => invalidateWorkspaceLists(qc),
  });
}
