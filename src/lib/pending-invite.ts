import * as React from "react";

/**
 * Invite links: `https://www.ninjaloop.com.au/invite/<token>` (universal / app link),
 * `ninjaloop://invite/<token>`, or a link / token pasted on the "Join with a link" screen.
 *
 * Why a store: an invite can arrive while you're signed OUT. The invite screen lives in
 * the signed-in group, so `+native-intent` parks the token here and sends the router to
 * `/`; the signed-in layout opens the invite as soon as there's a session (right away if
 * there already is one, or after sign-in). In memory only — sign-in (code or browser)
 * happens inside the same app process.
 */

/** The token from an invite URL / path, or a bare token; null if it isn't one. */
export function parseInviteToken(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  const m = v.match(/(?:^|\/)invite\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // A bare token (what's after /invite/ in the email link).
  return /^[A-Za-z0-9_-]{16,}$/.test(v) ? v : null;
}

let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingInvite(token: string | null) {
  pending = token;
  listeners.forEach((l) => l());
}

/** Read and clear. */
export function takePendingInvite(): string | null {
  const t = pending;
  if (t) setPendingInvite(null);
  return t;
}

export function usePendingInvite(): string | null {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
  );
}
