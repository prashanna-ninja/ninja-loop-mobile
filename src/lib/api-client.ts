import { API_BASE_URL } from "@/constants/env";
import { authClient } from "@/lib/auth-client";

/** Thrown for any non-2xx response, carrying the HTTP status (and server error code, if any). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Called on any 401 so the session provider can drop the user back to sign-in.
 * Registered by providers/session-provider.tsx (it owns session state).
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** The stored session cookie, or "" — never throws (SecureStore has no web implementation). */
async function readCookie(): Promise<string> {
  try {
    // better-auth ≥1.7: getCookie() is async (it was sync in 1.6 — CRM/CMS mobile).
    return (await authClient.getCookie()) || "";
  } catch {
    return "";
  }
}

/** IANA zone, e.g. "Australia/Sydney" (Hermes ships full Intl). */
const DEVICE_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

type ErrorBody = {
  error?: { code?: string; message?: string } | string;
  message?: string;
};

/**
 * The single place all app → server requests go through (`/api/mobile/v1/*`).
 * Screens never call this directly — they use hooks from src/api/*.api.ts.
 *
 * ⚠️ Two non-obvious requirements, learned on Ninja CRM/CMS mobile — keep both:
 * 1. We send the `Cookie` header OURSELVES. The Expo client only attaches the
 *    session cookie to its own `authClient.*` calls; a plain `fetch` gets nothing.
 * 2. `credentials: "omit"` is REQUIRED. On iOS, NSURLSession keeps its own cookie
 *    jar and appends its copy on top of our header → duplicated cookie → 500s.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookie = await readCookie();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // The server buckets "today / this week" in the user's zone, not its own (UTC).
      "X-Timezone": DEVICE_TIME_ZONE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    // 401 = session invalid/expired → back to sign-in.
    // 403 = "not allowed" (workspace role), NOT "not signed in" — keep the session.
    if (res.status === 401) onUnauthorized?.();

    let message = res.statusText || `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      // Mobile API error shape: { error: { code, message } } (docs/01-BACKEND-PROMPT.md).
      const body = (await res.json()) as ErrorBody;
      if (body?.error && typeof body.error === "object") {
        message = body.error.message || message;
        code = body.error.code;
      } else {
        message = body?.message || (typeof body?.error === "string" ? body.error : message);
      }
    } catch {
      // Not JSON — keep the status text.
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
