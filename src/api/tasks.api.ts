import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { invalidateWorkspace } from "@/api/workspaces.api";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { SubTask, TaskComment, TaskDetail, TaskLink } from "@/types/api.types";

const taskPath = (wid: string, tid: string) => `/api/mobile/v1/workspaces/${wid}/tasks/${tid}`;

/** GET …/tasks/:tid — the task with its subtasks and links. */
export function useTask(wid: string, tid: string) {
  return useQuery({
    queryKey: qk.task(wid, tid),
    queryFn: () => apiFetch<TaskDetail>(taskPath(wid, tid)),
  });
}

/** Optimistically edit the cached TaskDetail; returns the previous value for rollback. */
async function editTask(qc: QueryClient, wid: string, tid: string, fn: (t: TaskDetail) => TaskDetail) {
  await qc.cancelQueries({ queryKey: qk.task(wid, tid) });
  const previous = qc.getQueryData<TaskDetail>(qk.task(wid, tid));
  if (previous) qc.setQueryData(qk.task(wid, tid), fn(previous));
  return { previous };
}

/**
 * Shared wiring for task sub-resource mutations: optimistic edit of the detail,
 * rollback on error, then refresh the workspace (subtask counts show on the board).
 */
function useTaskMutation<V, R>(
  wid: string,
  tid: string,
  request: (v: V) => Promise<R>,
  optimistic?: (t: TaskDetail, v: V) => TaskDetail,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onMutate: (v: V) => (optimistic ? editTask(qc, wid, tid, (t) => optimistic(t, v)) : Promise.resolve({ previous: undefined })),
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.task(wid, tid), ctx.previous);
    },
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/* ── Subtasks ────────────────────────────────────────────────────────── */

export function useAddSubtask(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    (title: string) =>
      apiFetch<SubTask>(`${taskPath(wid, tid)}/subtasks`, { method: "POST", body: JSON.stringify({ title }) }),
    (t, title) => ({
      ...t,
      subTasks: [
        ...t.subTasks,
        { id: `temp-${Date.now()}`, title, completedAt: null, position: t.subTasks.length, createdAt: new Date().toISOString() },
      ],
    }),
  );
}

export function useToggleSubtask(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    ({ sid, completed }: { sid: string; completed: boolean }) =>
      apiFetch<SubTask>(`${taskPath(wid, tid)}/subtasks/${sid}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      }),
    (t, { sid, completed }) => ({
      ...t,
      subTasks: t.subTasks.map((s) => (s.id === sid ? { ...s, completedAt: completed ? new Date().toISOString() : null } : s)),
    }),
  );
}

export function useDeleteSubtask(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    (sid: string) => apiFetch<void>(`${taskPath(wid, tid)}/subtasks/${sid}`, { method: "DELETE" }),
    (t, sid) => ({ ...t, subTasks: t.subTasks.filter((s) => s.id !== sid) }),
  );
}

/* ── Links ───────────────────────────────────────────────────────────── */

export function useAddLink(wid: string, tid: string) {
  return useTaskMutation(wid, tid, (body: { label: string; url: string }) =>
    apiFetch<TaskLink>(`${taskPath(wid, tid)}/links`, {
      method: "POST",
      body: JSON.stringify({ ...body, type: "RESOURCE" }),
    }),
  );
}

export function useDeleteLink(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    (lid: string) => apiFetch<void>(`${taskPath(wid, tid)}/links/${lid}`, { method: "DELETE" }),
    (t, lid) => ({ ...t, links: t.links.filter((l) => l.id !== lid) }),
  );
}

/* ── Assignees ───────────────────────────────────────────────────────── */

/** PUT …/assignees — replaces the list (at least one id, all members). */
export function useSetAssignees(wid: string, tid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch<TaskDetail>(`${taskPath(wid, tid)}/assignees`, { method: "PUT", body: JSON.stringify({ userIds }) }),
    onSuccess: (task) => qc.setQueryData(qk.task(wid, tid), task),
    onSettled: () => invalidateWorkspace(qc, wid),
  });
}

/* ── Comments ────────────────────────────────────────────────────────── */

/** GET …/comments — oldest first. */
export function useComments(wid: string, tid: string) {
  return useQuery({
    queryKey: qk.comments(wid, tid),
    queryFn: () => apiFetch<TaskComment[]>(`${taskPath(wid, tid)}/comments`),
  });
}

export function useAddComment(wid: string, tid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<TaskComment>(`${taskPath(wid, tid)}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: (comment) =>
      qc.setQueryData<TaskComment[]>(qk.comments(wid, tid), (rows) => (rows ? [...rows, comment] : [comment])),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.comments(wid, tid) }),
  });
}
