/**
 * Response shapes for `/api/mobile/v1/*`, checked against the backend's
 * ref/ninja-loop/docs/MOBILE-API.md (merged in backend PR #3). Dates are ISO strings.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

/* ── GET /me ─────────────────────────────────────────────────────────── */

export type Me = {
  /** `name` can be "" (email-code sign-ups); `displayName` is the server's ready-made fallback. */
  user: { id: string; name: string; displayName: string; email: string; image: string | null; role: string | null };
  isAdmin: boolean;
  counts: { unreadNotifications: number; openIncomingRequests: number };
};

/* ── GET /dashboard ──────────────────────────────────────────────────── */

export type DashboardInsights = {
  tasksCompletedThisWeek: number;
  /** Open PRIORITY tasks due before today (not snoozed). */
  overdueOpenCount: number;
  openPriorityTaskCount: number;
};

export type DashboardWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  /** Top task in the PRIORITY lane, if any. */
  nextPriorityTaskTitle: string | null;
};

export type DashboardUrgentTask = {
  id: string;
  title: string;
  dueDate: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
};

export type Dashboard = {
  insights: DashboardInsights;
  workspaces: DashboardWorkspace[];
  urgentTasks: DashboardUrgentTask[];
};

/* ── Notifications ───────────────────────────────────────────────────── */

export type NotificationTarget =
  | { type: "task"; workspaceId: string; taskId: string }
  | { type: "requests" }
  | { type: "url"; href: string };

export type NotificationItem = {
  id: string;
  /** "task_assigned" | "task_comment" | "priority_request" | … */
  kind: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  target: NotificationTarget | null;
};

export type NotificationPage = { items: NotificationItem[]; nextCursor: string | null };

/* ── Priority requests ───────────────────────────────────────────────── */

export type PriorityRequest = {
  id: string;
  businessId: string;
  taskId: string | null;
  message: string;
  createdAt: string;
  status: "OPEN" | "ADDRESSED";
  business: { name: string; slug: string };
  fromUser: { name: string; email: string };
  task: { title: string } | null;
};

/* ── Workspaces ──────────────────────────────────────────────────────── */

/** GET /workspaces/:wid */
export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  activeTaskCount: number;
};

/** A person as embedded in tasks / comments. `name` can be "". */
export type Person = { id: string; name: string; image: string | null };

/** GET /workspaces/:wid/members (sorted by name). */
export type Member = { id: string; name: string; email: string; image: string | null; role: WorkspaceRole };

/* ── Invites ─────────────────────────────────────────────────────────── */

/** GET /workspaces/:wid/invites (admin) — pending, newest first. Never includes the token. */
export type Invite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
  invitedBy: { id: string; name: string; email: string } | null;
};

/** GET /invites/:token — what to show before "Accept". */
export type InvitePreview = {
  workspaceName: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
  expired: boolean;
  accepted: boolean;
  emailMatches: boolean;
};

/* ── Tasks (the priority queue: position ascending, top = next) ─────── */

/** GET /workspaces/:wid/tasks item. */
export type TaskSummary = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  snoozeUntil: string | null;
  createdAt: string;
  createdBy: Person;
  assignees: Person[];
  subTaskCount: number;
  subTaskDoneCount: number;
};

export type SubTask = { id: string; title: string; completedAt: string | null; position: number; createdAt: string };

export type TaskLink = { id: string; label: string; url: string; type: "RESOURCE" | "FILE"; createdAt: string };

/** GET / PATCH /workspaces/:wid/tasks/:tid */
export type TaskDetail = Omit<TaskSummary, "subTaskCount" | "subTaskDoneCount"> & {
  workspaceId: string;
  updatedAt: string;
  subTasks: SubTask[];
  links: TaskLink[];
};

/** PATCH body — send any subset. */
export type TaskPatch = Partial<{
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  blockedReason: string | null;
  snoozeUntil: string | null;
}>;

export type TaskComment = { id: string; body: string; createdAt: string; user: Person };
