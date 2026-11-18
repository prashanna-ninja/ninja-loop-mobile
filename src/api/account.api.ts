import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/providers/session-provider";

/**
 * DELETE /me — permanently delete the account (Apple 5.1.1(v); backend §3.1).
 * 409 = they own a workspace that has other members; the server's message
 * names the workspaces, and the screen shows it as-is.
 * On success, sign out locally (the session no longer exists server-side).
 */
export function useDeleteAccount() {
  const { signOut } = useSession();
  return useMutation({
    mutationFn: () => apiFetch<void>("/api/mobile/v1/me", { method: "DELETE" }),
    onSuccess: () => signOut(),
  });
}
