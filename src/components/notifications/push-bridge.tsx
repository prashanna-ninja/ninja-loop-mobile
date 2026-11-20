import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as React from "react";
import { Platform } from "react-native";

import { useMe } from "@/api/dashboard.api";
import { useMarkNotificationRead } from "@/api/notifications.api";
import { openNotificationTarget, parseNotificationTarget } from "@/lib/notification-target";
import { usePush } from "@/providers/push-provider";

/**
 * OS notifications → the app: a tap opens the same place as tapping the row in Alerts,
 * and the app-icon badge follows the real unread count.
 *
 * Mounted in (app)/_layout.tsx (signed in, navigator mounted) so a cold-start tap has a
 * stack to push onto and can't land behind the auth guard. A tap while signed OUT waits
 * here until sign-in.
 *
 * ⚠️ Payload contract (docs/04-BACKEND-PUSH.md §7) — the server's Expo message `data`:
 *   { notificationId: string, kind: string, target: NotificationTarget | null }
 * `target` is computed exactly like GET /notifications, so a push and its Alerts row agree.
 */
export function PushBridge() {
  const { permission } = usePush();
  const markRead = useMarkNotificationRead();
  const { data: me } = useMe();
  const unread = me?.counts.unreadNotifications;

  // Latest handler in a ref so the listener below subscribes once — re-subscribing
  // mid-flight can drop a tap.
  const handle = React.useRef<(r: Notifications.NotificationResponse) => void>(() => {});
  React.useEffect(() => {
    handle.current = (response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const id = typeof data.notificationId === "string" ? data.notificationId : null;
      if (id) markRead.mutate(id);
      const target = parseNotificationTarget(data.target);
      // Let the stack settle first (cold start / just signed in) — same as invite links.
      setTimeout(() => (target ? openNotificationTarget(target) : router.navigate("/alerts")), 250);
    };
  });

  /* Taps while the app is running (foreground or background). */
  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handle.current(r);
      Notifications.clearLastNotificationResponse();
    });
    return () => sub.remove();
  }, []);

  /* The tap that launched the app (or happened while signed out). Cleared so it can't re-fire. */
  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const last = Notifications.getLastNotificationResponse();
    if (!last) return;
    Notifications.clearLastNotificationResponse();
    handle.current(last);
  }, []);

  /* Icon badge = unread Alerts. Nothing else clears it when you read things in the app. */
  React.useEffect(() => {
    if (Platform.OS === "web" || permission !== "granted" || unread == null) return;
    void Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [permission, unread]);

  return null;
}
