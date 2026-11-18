import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, APP_SCHEME } from "@/constants/env";

/**
 * Better Auth client for the app.
 *
 * ⚠️ These must agree with the server or sign-in silently breaks:
 *   1. `baseURL` = the server's BETTER_AUTH_URL exactly (no redirects — a redirected
 *      auth call loses its cookie; mind `www` vs the bare host).
 *   2. `scheme` = app.json `scheme` = a server trusted origin (`ninjaloop://`).
 *      The client sends it as the `expo-origin` header; the server's `expo()` plugin
 *      maps it to Origin.
 *   3. `storagePrefix` sets the SecureStore key (`ninjaloop_cookie`).
 *
 * Versions are pinned EXACTLY to the server (better-auth, @better-auth/expo,
 * @better-auth/core). Client/server drift shows up as cookie-format bugs — bump
 * them together with the backend.
 *
 * ⚠️ Imported from `better-auth/client`, NOT `better-auth/react`: the React entry's
 * `useSession` store tears under React 19 concurrent rendering (found on Ninja
 * PRM / CMS mobile). The session is read via providers/session-provider.tsx instead.
 *
 * Sign-in methods (docs/01-BACKEND-PROMPT.md):
 *   - Google / GitHub: `signIn.social` → system browser → `ninjaloop://` → the
 *     cookie is captured automatically by expoClient.
 *   - Email one-time code: `emailOtp.sendVerificationOtp` + `signIn.emailOtp`.
 *     No deep link involved — works in Expo Go, and gives App Review a way in.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  // Without a timeout a wrong / unreachable baseURL leaves sign-in buttons spinning forever.
  // (Only the HTTP calls — the browser sheet for Google / GitHub isn't covered by this.)
  fetchOptions: { timeout: 20_000 },
  plugins: [
    emailOTPClient(),
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage: SecureStore,
    }),
  ],
});
