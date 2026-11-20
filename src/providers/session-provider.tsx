import * as React from "react";

import { setUnauthorizedHandler } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import type { SessionUser } from "@/types/auth.types";

type SessionData = { user: SessionUser } | null;

type SessionState = {
  data: SessionData;
  isPending: boolean;
  error: unknown;
  /** Re-read the session from the server (after sign-in). */
  refetch: () => Promise<void>;
  /** Sign out and clear local session state + cached data. */
  signOut: () => Promise<void>;
};

const SessionContext = React.createContext<SessionState | null>(null);

/**
 * Work that must run BEFORE the server session goes, while the cookie still works —
 * e.g. the push provider deleting this phone's device row so it stops receiving the
 * previous user's notifications. Each hook gets at most 3 s; sign-out never waits longer.
 */
const beforeSignOut = new Set<() => Promise<void>>();
export function addBeforeSignOut(hook: () => Promise<void>): () => void {
  beforeSignOut.add(hook);
  return () => {
    beforeSignOut.delete(hook);
  };
}
function runBeforeSignOut(): Promise<unknown> {
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  return Promise.race([Promise.allSettled([...beforeSignOut].map((hook) => hook())), timeout]);
}

/**
 * The app's session, held in plain React state.
 *
 * ⚠️ DO NOT replace this with better-auth's `useSession()` (from `better-auth/react`).
 * Its store backs `useSyncExternalStore` with a snapshot its own `subscribe`
 * mutates, which React 19 reports as tearing and re-renders the whole root
 * (found on Ninja PRM mobile; same fix as CMS mobile).
 *
 * Trade-off: the session doesn't update itself — we own every transition:
 * sign-in calls `refetch()`, sign-out and 401s go through `signOut()`.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<SessionData>(null);
  const [isPending, setIsPending] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  // Stops a late response from a superseded request overwriting a newer one.
  const requestIdRef = React.useRef(0);

  const load = React.useCallback(() => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;

    return authClient
      .getSession()
      .then((result) => {
        if (!isCurrent()) return;
        setData((result?.data as SessionData) ?? null);
        setError(result?.error ?? null);
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        // Network failure = "we don't know". Keep them out of the app, keep the error.
        setData(null);
        setError(err);
      })
      .finally(() => {
        if (isCurrent()) setIsPending(false);
      });
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // A before-sign-out hook's request can 401 → apiFetch calls signOut again. Run once.
  const signingOutRef = React.useRef(false);

  const signOut = React.useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    // Optimistic: the guard moves immediately; a failed server sign-out still
    // means the session is gone as far as this device cares.
    requestIdRef.current++;
    setData(null);
    setError(null);
    try {
      // The cookie is still stored until authClient.signOut() below.
      await runBeforeSignOut();
      await authClient.signOut();
    } catch {
      // Already cleared locally.
    } finally {
      // Drop every cached query so the next person on this device never sees
      // the previous user's data.
      queryClient.clear();
      signingOutRef.current = false;
    }
  }, []);

  // apiFetch reports 401s here.
  React.useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = React.useMemo<SessionState>(
    () => ({ data, isPending, error, refetch: load, signOut }),
    [data, isPending, error, load, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The app-wide session. Must be used under <SessionProvider>. */
export function useSession(): SessionState {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
