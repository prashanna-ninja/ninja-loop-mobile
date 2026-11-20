import { ApiError, apiFetch } from "@/lib/api-client";
import type { PushPreferences } from "@/lib/push-categories";

/**
 * Device registration for push (docs/04-BACKEND-PUSH.md §5 — the contract).
 *
 *   POST   /api/mobile/v1/devices          { token, platform, deviceName, preferences }  → 204
 *   PATCH  /api/mobile/v1/devices/:token   { preferences }                               → 204
 *   DELETE /api/mobile/v1/devices/:token                                                 → 204
 *
 * Plain functions, not React Query hooks: they're driven by the push provider (app
 * launch, a switch, sign-out), never by a screen. Everything fails QUIETLY — a 404
 * means "the backend hasn't shipped push yet", which must not throw an alert while
 * someone flips a switch, and must not stop the local preference being saved.
 * Settings shows the sync state instead.
 */

export type PushSyncResult = { status: "ok" } | { status: "unavailable" } | { status: "error"; message: string };

async function attempt(run: () => Promise<unknown>): Promise<PushSyncResult> {
  try {
    await run();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501)) return { status: "unavailable" };
    return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** `ExponentPushToken[…]` has brackets — always encode it in a path. */
const devicePath = (token: string) => `/api/mobile/v1/devices/${encodeURIComponent(token)}`;

/** Register or refresh this device (idempotent on `token`; also re-owns it for the signed-in user). */
export function registerDevice(input: {
  token: string;
  platform: "ios" | "android";
  deviceName: string | null;
  preferences: PushPreferences;
}): Promise<PushSyncResult> {
  return attempt(() => apiFetch<void>("/api/mobile/v1/devices", { method: "POST", body: JSON.stringify(input) }));
}

export function updateDevicePreferences(token: string, preferences: PushPreferences): Promise<PushSyncResult> {
  return attempt(() => apiFetch<void>(devicePath(token), { method: "PATCH", body: JSON.stringify({ preferences }) }));
}

/** Deleting the row IS the off switch: no device row, no push. */
export function unregisterDevice(token: string): Promise<PushSyncResult> {
  return attempt(() => apiFetch<void>(devicePath(token), { method: "DELETE" }));
}
