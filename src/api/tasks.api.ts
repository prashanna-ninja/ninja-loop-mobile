import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { File as DeviceFile, UploadType } from "expo-file-system";
import * as React from "react";

import { invalidateWorkspace } from "@/api/workspaces.api";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { PickedFile } from "@/lib/pick-file";
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

export function useRenameSubtask(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    ({ sid, title }: { sid: string; title: string }) =>
      apiFetch<SubTask>(`${taskPath(wid, tid)}/subtasks/${sid}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    (t, { sid, title }) => ({ ...t, subTasks: t.subTasks.map((s) => (s.id === sid ? { ...s, title } : s)) }),
  );
}

/** PUT …/subtasks/order — the FULL new order (server rejects unknown / temp ids). */
export function useReorderSubtasks(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    (orderedIds: string[]) =>
      apiFetch<void>(`${taskPath(wid, tid)}/subtasks/order`, { method: "PUT", body: JSON.stringify({ orderedIds }) }),
    (t, orderedIds) => {
      const byId = new Map(t.subTasks.map((s) => [s.id, s]));
      const next = orderedIds.flatMap((id, i) => {
        const s = byId.get(id);
        return s ? [{ ...s, position: i * 1000 }] : [];
      });
      return { ...t, subTasks: next };
    },
  );
}

/** DELETE …/subtasks?completed=1 — removes every ticked item. */
export function useClearCompletedSubtasks(wid: string, tid: string) {
  return useTaskMutation(
    wid,
    tid,
    (_: void) => apiFetch<void>(`${taskPath(wid, tid)}/subtasks?completed=1`, { method: "DELETE" }),
    (t) => ({ ...t, subTasks: t.subTasks.filter((s) => !s.completedAt) }),
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

/** Files bigger than this are refused before uploading (phone data + time). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type Presigned = { url: string; publicUrl: string; key: string };

/**
 * Upload a file from the phone and attach it to the task (MOBILE-API.md "Uploading a file"):
 * 1. POST /api/upload/presigned (old route, NOT /mobile/v1; errors are `{ error: "msg" }`,
 *    which apiFetch already handles) → a 1-hour presigned PUT to R2 + the public URL.
 * 2. PUT the bytes straight to R2 — native upload (expo-file-system), streamed from disk.
 *    Content-Type MUST equal the one we signed with, or R2 rejects the signature.
 * 3. POST …/links { type: "FILE", url: publicUrl }.
 * `progress` is 0…1 while uploading, null otherwise.
 */
export function useUploadTaskFile(wid: string, tid: string) {
  const qc = useQueryClient();
  const [progress, setProgress] = React.useState<number | null>(null);

  const upload = useMutation({
    mutationFn: async (file: PickedFile) => {
      if (file.size && file.size > MAX_UPLOAD_BYTES) {
        throw new ApiError(413, "That file is over 100 MB. Share it as a link instead.");
      }
      setProgress(0);
      const signed = await apiFetch<Presigned>("/api/upload/presigned", {
        method: "POST",
        body: JSON.stringify({ businessId: wid, taskId: tid, filename: file.name, contentType: file.mimeType }),
      });
      const res = await new DeviceFile(file.uri).upload(signed.url, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: file.mimeType,
        headers: { "Content-Type": file.mimeType },
        onProgress: ({ bytesSent, totalBytes }) => {
          if (totalBytes > 0) setProgress(Math.min(1, bytesSent / totalBytes));
        },
      });
      if (res.status < 200 || res.status >= 300) {
        throw new ApiError(res.status, `Storage refused the upload (${res.status}). Try again.`);
      }
      return apiFetch<TaskLink>(`${taskPath(wid, tid)}/links`, {
        method: "POST",
        body: JSON.stringify({ label: file.name, url: signed.publicUrl, type: "FILE" }),
      });
    },
    onSuccess: (link) =>
      qc.setQueryData<TaskDetail>(qk.task(wid, tid), (t) => (t ? { ...t, links: [...t.links, link] } : t)),
    onSettled: () => {
      setProgress(null);
      invalidateWorkspace(qc, wid);
    },
  });

  return { upload, progress };
}

/* ── Assignees ───────────────────────────────────────────────────────── */

/**
 * PUT …/assignees — replaces the list (at least one id, all members).
 * ⚠️ Unlike GET / PATCH, the server's response has NO `links` field (it calls
 * serializeTaskDetail without them; MOBILE-API.md says TaskDetail). Keep the cached
 * links, or the task screen crashes on `links.map`.
 */
export function useSetAssignees(wid: string, tid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch<Omit<TaskDetail, "links"> & { links?: TaskDetail["links"] }>(`${taskPath(wid, tid)}/assignees`, {
        method: "PUT",
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: (task) =>
      qc.setQueryData<TaskDetail>(qk.task(wid, tid), (prev) => ({ ...task, links: task.links ?? prev?.links ?? [] })),
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
