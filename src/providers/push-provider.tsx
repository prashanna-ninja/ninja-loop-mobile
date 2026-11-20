import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as React from "react";
import { AppState, Platform } from "react-native";

import { registerDevice, unregisterDevice, updateDevicePreferences, type PushSyncResult } from "@/api/push.api";
import {
  DEFAULT_PUSH_PREFERENCES,
  normalisePushPreferences,
  type PushCategory,
  type PushPreferences,
} from "@/lib/push-categories";
import { qk } from "@/lib/query-keys";
import { addBeforeSignOut, useSession } from "@/providers/session-provider";

/**
 * Push notifications — permission, Expo push token, server registration, per-category
 * switches. Ported from Ninja CRM mobile (src/providers/push-provider.tsx), trimmed.
 * Backend contract + setup: docs/04-BACKEND-PUSH.md.
 *
 * Lifecycle:
 * - Off until the user turns it on (Settings → Notifications, or the Alerts banner).
 * - While on + permitted + signed in: re-register on every launch (tokens rotate; keeps
 *   `lastSeenAt` fresh). Registration is idempotent on the token.
 * - Turn off → DELETE the device row (that IS the off switch, enforced server-side).
 * - Sign out → DELETE the row first, while the cookie still works (addBeforeSignOut).
 * - Another person signs in on this phone → push is switched off for them until THEY
 *   turn it on (the owner guard) — SecureStore is per install, not per account.
 */

const KEY_ENABLED = "ninjaloop.push.enabled";
const KEY_PREFERENCES = "ninjaloop.push.preferences";
const KEY_OWNER = "ninjaloop.push.owner";
const KEY_PROMPTED = "ninjaloop.push.prompted";

/**
 * `blocked` = refused and the OS won't show the prompt again (only the Settings app can
 * fix it). NOT the same as Android's dismissed-prompt "denied", which can be re-asked —
 * so we key off `canAskAgain`, not `status` (lesson from CRM: Android users were told
 * they were blocked when they weren't).
 */
export type PushPermission = "loading" | "undetermined" | "granted" | "blocked" | "unsupported";

export type EnableOutcome = "enabled" | "denied" | "blocked" | "unsupported" | "failed";

/** Why a token couldn't be fetched although permission was granted. */
export type TokenProblem = "no-project-id" | "failed" | null;

type PushContextValue = {
  permission: PushPermission;
  /** The user's switch for this device — separate from the OS permission. */
  enabled: boolean;
  preferences: PushPreferences;
  token: string | null;
  /** Did the server accept the token? `unavailable` = backend not deployed yet. */
  sync: PushSyncResult | null;
  tokenProblem: TokenProblem;
  /** Has the Alerts banner been dismissed / answered? */
  prompted: boolean;
  busy: boolean;
  enable: () => Promise<EnableOutcome>;
  disable: () => Promise<void>;
  setCategory: (category: PushCategory, value: boolean) => Promise<void>;
  dismissPrompt: () => void;
};

const PushContext = React.createContext<PushContextValue | null>(null);

/* ── Device plumbing ─────────────────────────────────────────────────── */

/**
 * A push arriving while the app is OPEN: show the banner (you may be deep in another
 * board) but no sound — the OS already plays one when backgrounded. SDK 58 fields;
 * `shouldShowAlert` is deprecated.
 */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Android needs a channel or pushes arrive silent with no heads-up. On Android 13+ the
 * permission prompt only appears once a channel exists, and it must exist before
 * getExpoPushTokenAsync. The server sends `channelId: "default"`. iOS ignores this.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Ninja Loop",
    // eslint-disable-next-line import/namespace -- a `declare enum` re-exported via `export *`; tsc resolves it
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#005189",
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => {});
}

/** The EAS project id (`npx eas-cli init` writes it to app.json extra.eas.projectId). */
function easProjectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

async function fetchExpoPushToken(): Promise<{ token: string | null; problem: TokenProblem }> {
  const projectId = easProjectId();
  if (!projectId) return { token: null, problem: "no-project-id" };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ? { token: data, problem: null } : { token: null, problem: "failed" };
  } catch (error) {
    // Android build without FCM credentials (google-services.json) throws here; so does
    // an iOS build without the push entitlement. A build problem, not a user one.
    console.warn("[push] getExpoPushTokenAsync failed:", error);
    return { token: null, problem: "failed" };
  }
}

async function readOsPermission(): Promise<PushPermission> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";
    return canAskAgain ? "undetermined" : "blocked";
  } catch {
    return "unsupported";
  }
}

const deviceName = () => Device.deviceName ?? Device.modelName ?? null;
const platform = () => (Platform.OS === "ios" ? "ios" : "android") as "ios" | "android";
const store = {
  get: (k: string) => SecureStore.getItemAsync(k).catch(() => null),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v).catch(() => {}),
  del: (k: string) => SecureStore.deleteItemAsync(k).catch(() => {}),
};

/* ── Provider ────────────────────────────────────────────────────────── */

export function PushProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const [loaded, setLoaded] = React.useState(false);
  const [permission, setPermission] = React.useState<PushPermission>("loading");
  const [enabled, setEnabled] = React.useState(false);
  const [preferences, setPreferences] = React.useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [token, setToken] = React.useState<string | null>(null);
  const [sync, setSync] = React.useState<PushSyncResult | null>(null);
  const [tokenProblem, setTokenProblem] = React.useState<TokenProblem>(null);
  const [prompted, setPrompted] = React.useState(true); // assume answered until loaded
  const [busy, setBusy] = React.useState(false);

  // Read by the sign-out hook without re-registering it on every change.
  const tokenRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  /** The user asked for push but the OS said no → finish the job when they come back from Settings. */
  const awaitingPermission = React.useRef(false);

  /* Load saved state once. */
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedEnabled, savedPrefs, savedPrompted] = await Promise.all([
        store.get(KEY_ENABLED),
        store.get(KEY_PREFERENCES),
        store.get(KEY_PROMPTED),
      ]);
      await ensureAndroidChannel();
      const os = await readOsPermission();
      if (cancelled) return;
      setEnabled(savedEnabled === "true");
      setPrompted(savedPrompted === "true");
      if (savedPrefs) {
        try {
          setPreferences(normalisePushPreferences(JSON.parse(savedPrefs)));
        } catch {
          // keep defaults
        }
      }
      setPermission(os);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Owner guard: a different person signed in on this phone → off until they opt in. */
  React.useEffect(() => {
    if (!userId || !loaded) return;
    let cancelled = false;
    void (async () => {
      const owner = await store.get(KEY_OWNER);
      if (cancelled || !owner || owner === userId) return;
      setEnabled(false);
      setToken(null);
      awaitingPermission.current = false;
      await Promise.all([store.set(KEY_ENABLED, "false"), store.del(KEY_OWNER)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loaded]);

  /* Register on launch / sign-in while on + permitted. */
  React.useEffect(() => {
    if (!loaded || !userId || !enabled || permission !== "granted") return;
    let cancelled = false;
    void (async () => {
      const owner = await store.get(KEY_OWNER);
      if (owner && owner !== userId) return; // the guard above is switching it off
      const { token: t, problem } = await fetchExpoPushToken();
      if (cancelled) return;
      setTokenProblem(problem);
      if (!t) return;
      setToken(t);
      const result = await registerDevice({ token: t, platform: platform(), deviceName: deviceName(), preferences });
      if (!cancelled) setSync(result);
    })();
    return () => {
      cancelled = true;
    };
    // `preferences` deliberately left out: a switch PATCHes (setCategory), it doesn't re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, userId, enabled, permission]);

  /* A push landing while the app is open → refresh Alerts + the tab badge now. */
  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: qk.notifications() });
      void qc.invalidateQueries({ queryKey: qk.me() });
    });
    return () => sub.remove();
  }, [qc]);

  /* Sign-out: drop this device's row before the cookie goes. */
  React.useEffect(
    () =>
      addBeforeSignOut(async () => {
        const t = tokenRef.current;
        tokenRef.current = null;
        setToken(null);
        setSync(null);
        awaitingPermission.current = false;
        if (t) await unregisterDevice(t);
        // The switch itself is kept: signing out usually means signing back in.
        // A different person is handled by the owner guard.
      }),
    [],
  );

  /* ── Actions ── */

  const markPrompted = React.useCallback(() => {
    setPrompted(true);
    void store.set(KEY_PROMPTED, "true");
  }, []);

  const enable = React.useCallback(async (): Promise<EnableOutcome> => {
    if (Platform.OS === "web") {
      setPermission("unsupported");
      return "unsupported";
    }
    setBusy(true);
    try {
      markPrompted();
      await ensureAndroidChannel();
      const current = await Notifications.getPermissionsAsync();
      let granted = current.status === "granted";
      if (!granted) {
        if (!current.canAskAgain) {
          awaitingPermission.current = true;
          setPermission("blocked");
          return "blocked";
        }
        const asked = await Notifications.requestPermissionsAsync();
        granted = asked.status === "granted";
        if (!granted) {
          awaitingPermission.current = true;
          // Android: a dismissed prompt can be asked again — that's not "blocked".
          setPermission(asked.canAskAgain ? "undetermined" : "blocked");
          return asked.canAskAgain ? "denied" : "blocked";
        }
      }
      awaitingPermission.current = false;
      setPermission("granted");

      const { token: t, problem } = await fetchExpoPushToken();
      setTokenProblem(problem);
      if (!t) return "failed";
      setToken(t);
      setSync(await registerDevice({ token: t, platform: platform(), deviceName: deviceName(), preferences }));
      setEnabled(true);
      await Promise.all([store.set(KEY_ENABLED, "true"), userId ? store.set(KEY_OWNER, userId) : null]);
      return "enabled";
    } finally {
      setBusy(false);
    }
  }, [preferences, userId, markPrompted]);

  const disable = React.useCallback(async () => {
    // Local first: the switch responds instantly and the intent is saved even offline.
    setEnabled(false);
    awaitingPermission.current = false;
    await store.set(KEY_ENABLED, "false");
    if (token) setSync(await unregisterDevice(token));
  }, [token]);

  const setCategory = React.useCallback(
    async (category: PushCategory, value: boolean) => {
      const next = { ...preferences, [category]: value };
      setPreferences(next);
      await store.set(KEY_PREFERENCES, JSON.stringify(next));
      if (token && enabled) setSync(await updateDevicePreferences(token, next));
    },
    [preferences, token, enabled],
  );

  /* Back from the Settings app: re-read the permission and finish an interrupted enable. */
  const enableRef = React.useRef(enable);
  React.useEffect(() => {
    enableRef.current = enable;
  }, [enable]);
  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void readOsPermission().then((next) => {
        setPermission(next);
        if (next === "granted" && awaitingPermission.current) {
          awaitingPermission.current = false;
          void enableRef.current();
        }
      });
    });
    return () => sub.remove();
  }, []);

  const value = React.useMemo<PushContextValue>(
    () => ({
      permission,
      enabled,
      preferences,
      token,
      sync,
      tokenProblem,
      prompted,
      busy,
      enable,
      disable,
      setCategory,
      dismissPrompt: markPrompted,
    }),
    [permission, enabled, preferences, token, sync, tokenProblem, prompted, busy, enable, disable, setCategory, markPrompted],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const ctx = React.useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used within <PushProvider>");
  return ctx;
}
