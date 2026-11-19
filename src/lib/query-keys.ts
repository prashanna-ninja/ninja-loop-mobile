/**
 * Query key factory — the ONLY place query keys are defined.
 * Hooks call e.g. `qk.me()`; invalidation uses the same helpers, so a typo can
 * never leave stale data behind. Add a section per domain as screens are built.
 */
export const qk = {
  /** GET /api/mobile/v1/me — profile + unread / open-request counts (tab badges). */
  me: () => ["me"] as const,
  /** GET /api/mobile/v1/dashboard — insights, workspaces, urgent tasks. */
  dashboard: () => ["dashboard"] as const,
  /** GET /api/mobile/v1/notifications (infinite). */
  notifications: () => ["notifications"] as const,
  /** GET /api/mobile/v1/requests — incoming priority requests. */
  requests: () => ["requests"] as const,

  /** GET /workspaces/:wid (+ members). Prefix `workspace(wid)` invalidates all of a workspace. */
  workspace: (wid: string) => ["workspace", wid] as const,
  members: (wid: string) => ["workspace", wid, "members"] as const,
  /** GET /workspaces/:wid/tasks?showDone= — the queue. */
  tasks: (wid: string, showDone: boolean) => ["workspace", wid, "tasks", { showDone }] as const,
  /** Prefix for both showDone variants (invalidation / optimistic updates). */
  tasksAll: (wid: string) => ["workspace", wid, "tasks"] as const,
  /** GET /workspaces/:wid/tasks/:tid (subtasks + links included). */
  task: (wid: string, tid: string) => ["workspace", wid, "task", tid] as const,
  comments: (wid: string, tid: string) => ["workspace", wid, "task", tid, "comments"] as const,
};
