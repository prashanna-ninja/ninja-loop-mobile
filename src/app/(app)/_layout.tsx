import { Stack } from "expo-router";

/**
 * Signed-IN area. Reachable only with a session (see app/_layout.tsx).
 * (tabs) = Dashboard · Alerts · Inbox · Settings. Pushed beside it:
 * workspace/[wid] (board), workspace/[wid]/task/[tid], …/members, …/request.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
    </Stack>
  );
}
