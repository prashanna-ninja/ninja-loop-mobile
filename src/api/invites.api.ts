import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateWorkspaceLists } from "@/api/workspaces.api";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Invite, InvitePreview, WorkspaceRole } from "@/types/api.types";

const base = (wid: string) => `/api/mobile/v1/workspaces/${wid}/invites`;
const tokenPath = (token: string) => `/api/mobile/v1/invites/${encodeURIComponent(token)}`;

/* ── Admin: pending invites ──────────────────────────────────────────── */

/** GET …/invites — pending (not accepted) invites, newest first. Admin / owner only. */
export function useInvites(wid: string, enabled = true) {
  return useQuery({
    queryKey: qk.invites(wid),
    queryFn: () => apiFetch<Invite[]>(base(wid)),
    enabled,
  });
}

/** POST …/invites — the server emails a link to /invite/<token> (expires in 7 days). */
export function useSendInvite(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: WorkspaceRole }) =>
      apiFetch<{ inviteId: string }>(base(wid), { method: "POST", body: JSON.stringify(body) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.invites(wid) }),
  });
}

/** DELETE …/invites/:id — optimistic; 404 = already accepted or gone (refetch settles it). */
export function useRevokeInvite(wid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => apiFetch<void>(`${base(wid)}/${inviteId}`, { method: "DELETE" }),
    onMutate: async (inviteId) => {
      await qc.cancelQueries({ queryKey: qk.invites(wid) });
      const previous = qc.getQueryData<Invite[]>(qk.invites(wid));
      qc.setQueryData<Invite[]>(qk.invites(wid), (rows) => rows?.filter((i) => i.id !== inviteId));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.invites(wid), ctx.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.invites(wid) }),
  });
}

/* ── Invitee: preview + accept ───────────────────────────────────────── */

/** GET /invites/:token — workspace, inviter, role, and whether it's for this account. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: qk.invite(token),
    queryFn: () => apiFetch<InvitePreview>(tokenPath(token)),
    retry: false,
  });
}

/** POST /invites/:token/accept → the workspace you joined. */
export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ workspaceId: string; slug: string }>(`${tokenPath(token)}/accept`, { method: "POST" }),
    onSuccess: () => {
      invalidateWorkspaceLists(qc);
      void qc.invalidateQueries({ queryKey: qk.invite(token) });
    },
  });
}
