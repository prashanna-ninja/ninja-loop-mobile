/**
 * Push categories — the per-device switches in Settings → Notifications.
 *
 * ⚠️ Contract with the backend (docs/04-BACKEND-PUSH.md §4, `lib/push/categories.ts`):
 * the server stores one boolean column per category on `PushDevice` and skips a
 * device whose category is off. Names and defaults must match on both sides —
 * a mismatch silently re-enables (or mutes) a category.
 *
 * Notification `kind` → category:
 *   task_assigned    → assigned
 *   task_comment     → comments
 *   priority_request → requests
 *   task_due         → due        (the "due tomorrow" cron)
 * All four are aimed at one person about their own work, so all default ON.
 */
export type PushCategory = "assigned" | "comments" | "requests" | "due";

export type PushPreferences = Record<PushCategory, boolean>;

export const PUSH_CATEGORIES: { key: PushCategory; label: string; hint: string }[] = [
  { key: "assigned", label: "Assigned to me", hint: "Someone adds you to a task." },
  { key: "comments", label: "Comments", hint: "New comments on tasks you're assigned to." },
  { key: "requests", label: "Priority requests", hint: "A teammate asks you to review priorities." },
  { key: "due", label: "Due tomorrow", hint: "A reminder the day before your task is due." },
];

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  assigned: true,
  comments: true,
  requests: true,
  due: true,
};

/** Stored / server JSON → a complete preferences object (missing keys = default). */
export function normalisePushPreferences(value: unknown): PushPreferences {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<PushCategory, unknown>>;
  const out = { ...DEFAULT_PUSH_PREFERENCES };
  for (const { key } of PUSH_CATEGORIES) {
    if (typeof v[key] === "boolean") out[key] = v[key] as boolean;
  }
  return out;
}
