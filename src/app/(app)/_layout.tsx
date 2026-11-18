import { Stack } from "expo-router";

/**
 * Signed-IN area. Reachable only with a session (see app/_layout.tsx).
 * (tabs) = Dashboard · Alerts · Inbox · Settings. Pushed screens (workspace
 * board, task detail) will sit beside it in this stack.
 */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
