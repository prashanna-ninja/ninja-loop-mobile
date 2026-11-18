# Implementation log (newest first)

## 2026-11-18 — Fix: "Unmatched route" after Google / GitHub sign-in (iOS)

The OAuth return link `ninjaloop:///?cookie=…` was also handed to Expo Router. At that moment
the session hasn't flipped yet, so `/` (signed-in group) is guarded off → Unmatched route.
- `src/app/+native-intent.tsx`: links carrying `cookie=` are rewritten to `/sign-in`; the
  session refetch then moves the user to the dashboard via `Stack.Protected`.
- `src/app/+not-found.tsx`: safety net — any unmatched link redirects to `/` (signed in) or
  `/sign-in` (signed out) instead of showing the Unmatched page.

## 2026-11-18 — Signed-in shell: tabs, Dashboard, Alerts, Inbox, Settings

**Decision: no subscriptions or paywall in the app (for now).** Every signed-in user gets the
full app; no plan or billing UI. Backend prompt updated: `GET /me` no longer returns
subscription data, and §3.4 says not to gate mobile routes on plan. The web's Stripe setup stays.

**Built against the spec'd API** (`docs/01-BACKEND-PROMPT.md` §2.3, types in
`src/types/api.types.ts`). Until the backend ships, these screens show their error state
("This isn't available on the server yet").
- **Tabs** (`(app)/(tabs)`): Dashboard · Alerts · Inbox · Settings (web nav + Settings).
  JS tabs as in CMS mobile; Alerts / Inbox badges come from `GET /me` counts.
- **Dashboard**: greeting, "This week at a glance" (open / overdue / done), Urgent (urgency
  strip, queue number, the teal #1 "next up" node from the sign-in hero), Workspaces
  (urgency signal + "Next up"). Pull to refresh also refreshes the badges.
- **Alerts**: infinite list; tap marks read (optimistic, badge drops right away); Mark all read.
- **Inbox**: open priority requests with Mark done (optimistic, rolls back on error), then addressed.
- **Settings**: profile, open the web app, version, privacy / terms, sign out (confirm),
  delete account via `DELETE /me` (confirm; a 409 shows the server's reason).
- `apiFetch` now sends `X-Timezone` (device IANA zone), so the server's "today / this week"
  match the user's day.
- Due-date urgency is ported 1:1 from the web (`src/lib/due-urgency.ts`, `date-fns`, the same
  labels). Raw colours for icons / the tab bar live in `src/lib/theme.ts` and mirror `global.css`.

**Not pressable yet (on purpose):** urgent tasks, workspace cards and notification targets.
They'll open the board / task sheet once those screens exist. No dead-end placeholder routes.

**Verified.** tsc ✅ · lint ✅ · expo-doctor 20/20 ✅ · iOS + Android bundles ✅ ·
all four tabs screenshotted (light + dark, 390×844) against a throwaway mock of the spec'd API.
Fixed from the screenshots: a truncated stat label, and "Mark all read" overlapping the
Alerts subtitle. **New dependency:** `date-fns` (pure JS, no native rebuild needed).

## 2026-11-18 — Scaffold + sign-in screens

**Scaffold.** `create-expo-app --template default@sdk-58` (SDK 58 = `latest` on npm today;
RN 0.88, React 19.3, TS 6). Demo template removed. Conventions copied from Ninja CMS mobile
(the newest sibling): `src/` layout, `apiFetch`, plain-state `SessionProvider`,
query-key factory, icon subpath imports, `.easignore` that never uploads `.env`.

**Design tokens.** The web defines its theme in OKLCH (`ref/ninja-loop/app/globals.css`);
converted 1:1 to the HSL triples RNR/NativeWind expect (`src/global.css`, light + dark).
Primary `#005189`, accent teal `#007F88`.

**Auth decisions.**
- The web only has Google + GitHub. Mobile keeps both (existing users) and adds **email
  one-time code** — no deep link from email needed (works in Expo Go), and gives App Review a
  way in via a fixed review OTP. Magic link (CRM) was rejected: email→app deep links are
  unreliable in Expo Go and need cookie capture from the URL.
- better-auth **1.7.25 exact** on client and server: `@better-auth/expo@1.4.x` (server's
  current line) has a peer dep on `expo-network ^8`, incompatible with SDK 58.
- 1.7 change: `authClient.getCookie()` is **async** (sync in 1.6) — `apiFetch` awaits it.
- Sign in with Apple will be required for App Store (guideline 4.8) — backend Phase 3.

**Sign-in UI.** Same family as CRM/CMS (gradient hero + overlapping white sheet + staggered
fade-in). Ninja Loop signature: the hero carries the web board's *snake path* — a dashed queue
that flows toward a teal, pulsing **#1 (next up)** — built with RN `Animated` + react-native-svg,
honours Reduce Motion. OTP entry is one hidden `TextInput` behind 6 cells so paste and iOS /
Android one-time-code autofill keep working.

**Gotchas hit.**
- RN 0.88 ref types: `useRef<TextInputInstance>` / `ScrollViewInstance`, not the component types.
- `web.output: "static"` pre-renders on the server and better-auth's client touches `window`
  at import → switched to `"single"` (SPA). Web is preview-only for this app.

**Verified.** `tsc --noEmit` ✅ · `expo lint` ✅ · `expo-doctor` 20/20 ✅ · `expo export`
iOS + Android bundles ✅ · web build screenshotted at 390×844 (sign-in + verify-code).
Not yet verified on a device or against a real backend (waiting on Phase 1).

**Native modules added** (rebuild dev clients): expo-secure-store, expo-network,
expo-linear-gradient, expo-dev-client, react-native-svg, expo-haptics, expo-web-browser plugin.
