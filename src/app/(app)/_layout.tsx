import { router, Stack } from "expo-router";
import * as React from "react";

import { PushBridge } from "@/components/notifications/push-bridge";
import { takePendingInvite, usePendingInvite } from "@/lib/pending-invite";

/**
 * Signed-IN area. Reachable only with a session (see app/_layout.tsx).
 * (tabs) = Dashboard · Workspaces · Alerts · Inbox · Settings. Pushed beside it:
 * workspace/[wid] (board), workspace/[wid]/task/[tid], …/members, …/request, invite/…
 */
export default function AppLayout() {
  // An invite link arrived (maybe before sign-in) → open it now that there's a session.
  const pendingInvite = usePendingInvite();
  React.useEffect(() => {
    if (!pendingInvite) return;
    // Let the stack mount first (cold start / just signed in), then push.
    const t = setTimeout(() => {
      const token = takePendingInvite();
      if (token) router.push({ pathname: "/invite/[token]", params: { token } });
    }, 250);
    return () => clearTimeout(t);
  }, [pendingInvite]);

  return (
    <>
      {/* Push taps → task / Inbox / Alerts; icon badge = unread. */}
      <PushBridge />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      </Stack>
    </>
  );
}
