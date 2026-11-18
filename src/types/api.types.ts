/**
 * Response shapes for `/api/mobile/v1/*`, exactly as specified in
 * docs/01-BACKEND-PROMPT.md §2.3. Dates arrive as ISO strings.
 * When the backend lands, check these against its docs/MOBILE-API.md.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

/* ── GET /me ─────────────────────────────────────────────────────────── */

export type Me = {
  user: { id: string; name: string; email: string; image: string | null; role: string | null };
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
