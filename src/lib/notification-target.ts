import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import type { NotificationTarget } from "@/types/api.types";

/**
 * Open what a notification points at (MOBILE-API.md: use `target`, ignore the web `href`).
 * Shared by the Alerts list and push taps (components/notifications/push-bridge.tsx), so a
 * row and its push can never lead to different places.
 */
export function openNotificationTarget(target: NotificationTarget | null | undefined) {
  if (!target) return;
  if (target.type === "task") {
    router.push({ pathname: "/workspace/[wid]/task/[tid]", params: { wid: target.workspaceId, tid: target.taskId } });
  } else if (target.type === "requests") {
    router.navigate("/inbox");
  } else if (target.type === "url" && /^https?:\/\//i.test(target.href)) {
    void WebBrowser.openBrowserAsync(target.href);
  }
}

/** A `target` from untrusted JSON (a push payload) → a valid NotificationTarget or null. */
export function parseNotificationTarget(value: unknown): NotificationTarget | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Record<string, unknown>;
  if (t.type === "task" && typeof t.workspaceId === "string" && typeof t.taskId === "string") {
    return { type: "task", workspaceId: t.workspaceId, taskId: t.taskId };
  }
  if (t.type === "requests") return { type: "requests" };
  if (t.type === "url" && typeof t.href === "string") return { type: "url", href: t.href };
  return null;
}
