# Implementation log (newest first)

## 2026-11-19 — Invites: send / revoke, accept, invite links

**⚠️ Native change — rebuild needed:** app.json `ios.associatedDomains`
(`applinks:www.ninjaloop.com.au`) + Android `intentFilters` (https `/invite/*`, autoVerify).
`npx expo prebuild --clean && npx expo run:ios`. Universal links also need the two server files in
`docs/03-BACKEND-UNIVERSAL-LINKS.md` (AASA + assetlinks; needs the Apple Team ID / Android SHA-256).

- **Members** (`workspace/[wid]/members`) is now a ScrollView. Owners / admins get **Invite someone**
  (email + Member / Admin / Owner, like the web; `POST …/invites`, "Invite sent to …") and
  **Pending invites** (`GET …/invites`: role · expires in / Expired · by whom; revoke with confirm,
  optimistic `DELETE …/invites/:id`). Members just see the list. `api/invites.api.ts`.
- **Accept** (`invite/[token]`): `GET /invites/:token` → "X invited you to join <workspace> as
  <role>" + what the role can do → **Join** (`POST …/accept`) → replaces itself with the board,
  workspace lists refreshed. States: already used, expired, **wrong account** ("sent to x — Sign
  out and use x": keeps the invite pending, so it reopens after signing in with that email).
- **Getting there**: `+native-intent` catches `…/invite/<token>` (universal link,
  `ninjaloop://invite/<token>`, with or without a leading slash), parks the token
  (`lib/pending-invite.ts`) and goes to `/`; the signed-in layout pushes the invite screen as soon
  as there's a session, so a link tapped while signed out opens right after sign-in.
  **Join with a link** (`invite/index`, Workspaces tab → Join): paste the email link or the token,
  which works before the universal-link files are live.

## 2026-11-19 — Task: file upload (R2), checklist polish, native date / time picker

**⚠️ Native change — rebuild needed:** added `expo-image-picker`, `@react-native-community/datetimepicker`
and `expo-file-system` (now a direct dependency); app.json plugins: `@react-native-community/datetimepicker`,
`expo-image-picker` (photo + camera usage strings, microphone off).
`npx expo prebuild --clean && npx expo run:ios`.

- **File upload** (Links & files → Photo / Camera / File): `useUploadTaskFile` in `api/tasks.api.ts`
  runs the 3-step flow from MOBILE-API.md: `POST /api/upload/presigned` (old non-mobile route; its
  `{ error: "msg" }` errors already handled by `apiFetch`) → native binary `PUT` to the presigned R2
  URL via expo-file-system `File.upload` (streamed from disk, progress bar) → `POST …/links`
  `{ type: "FILE" }`. The PUT's `Content-Type` must equal the signed one. 100 MB client cap.
  ⚠️ `onProgress` gives `bytesSent` / `totalBytes` as **BigInt on iOS** (typed as number) — convert
  with `Number()` before dividing, or `Math.min` throws "Cannot convert BigInt to number".
  Pickers in `lib/pick-file.ts`: photo library (JPEG/H.264 on iOS, not HEIC), camera (permission →
  Settings prompt if refused), any document (expo-file-system's built-in `File.pickFileAsync`, so no
  expo-document-picker). FILE links show an image / file icon.
- **Checklist**: hold and drag to reorder (shared `SortableList`, auto-scrolls the task screen;
  `PUT …/subtasks/order` with the full order, optimistic), tap the text to rename (`PATCH {title}`),
  "Clear done" (`DELETE …/subtasks?completed=1`, confirm). Ticking moved to the checkbox only.
  Task screen ScrollView → always-mounted `Animated.ScrollView` (scroll locked while dragging).
- **Due / snooze**: "Pick a date…" (native calendar, end of local day like the web; a custom day
  shows as its own selected chip) and "Pick a time…" for snooze (date + time, future only).
  `components/task/date-time-picker.tsx`: iOS bottom sheet with the inline picker; Android system
  date → time dialogs.

## 2026-11-19 — Fix: Workspaces tab and board lists were invisible

**Cause:** `SortableList` fades in once every row has reported its height. Rows wrote their
height with a read-modify-write on a shared value **from the JS thread** (`heights.get()` →
`heights.set({...})`). In Reanimated 4, JS-side `.set()` is async and `.get()` returns a cached
copy, so rows measured in the same frame each read `{}` and overwrote each other → never "all
measured" → opacity stayed 0. Data loaded fine; nothing was visible.

**Fix:** heights live in a JS ref and the whole object is pushed to the shared value; plus a
400 ms safety reveal so the list can never stay hidden. **Rule: never read-modify-write a shared
value on the JS thread** — keep JS-side state in a ref/state, or do the update in a worklet.

## 2026-11-19 — Drag to reorder the task queue; shared SortableList

- **`components/sortable/sortable-list.tsx`** — one generic hold-and-drag list for the board
  and the Workspaces tab (replaces the fixed-height workspace-only version from earlier today):
  - **Variable row heights**: each row is measured (onLayout); slots = summed heights. Rows
    spring when anything above changes (drag, add, complete, a "Next up" label appearing).
    The list fades in once every row is measured, so there's no first-frame jump.
  - **Auto-scroll** near the viewport edges (`scroll` prop: `useAnimatedRef` + `useScrollOffset`
    + content height; `useFrameCallback` + `scrollTo`, offset compensated in the drag maths).
  - Insertion point = the lifted row's centre against the others' midpoints.
  - Rows keep their own Pressables; `ctx.guard(fn)` swallows taps during and ~350 ms after a
    drag, so the release never also opens / completes. VoiceOver: Move up / down actions.
- **Board** (`workspace/[wid]/index.tsx`): FlatList → `Animated.ScrollView`; open queue is a
  `SortableList`, completed tasks stay a plain list under "Done". Drop → existing optimistic
  `useMoveTask` with neighbours `afterId = order[to-1]`, `beforeId = order[to+1]` (position
  order, per MOBILE-API.md). Hint text: "N in the queue · hold and drag to reorder".
  The task screen's To top / Up / Down stay.
- Trade-off: the queue is no longer virtualised (ScrollView renders every open task). Fine for
  a priority queue (tens of tasks); revisit if a workspace ever holds hundreds.

**Verified.** tsc ✅ · lint ✅ · expo-doctor 20/20 ✅ · iOS + Android bundles ✅. Not yet tried on
a device. No new packages, no native changes.

## 2026-11-19 — Workspaces tab with drag-to-reorder

- **New tab** `(tabs)/workspaces.tsx` (2nd, Layers icon): `GET /workspaces` in your personal
  order, + New, pull to refresh, empty / error / skeleton states.
- **Drag to reorder** (`components/workspaces/sortable-workspace-list.tsx`), built on what was
  already installed — Reanimated 4.7 + Gesture Handler 3.3 + Worklets (in package.json since the
  first commit, so **no rebuild**). Hold 200 ms (`activateAfterLongPress`) → row lifts (scale
  1.035, shadow, primary border, medium haptic) → others spring out of the way with a selection
  tick per slot → release springs into place → one `PUT /workspaces/order` (existing optimistic
  `useReorderWorkspaces`, also reorders the Dashboard; error → Alert + rollback re-slots rows).
  Quick tap → board (`useExclusiveGestures(pan, tap)`); swipes before the hold scroll; the
  ScrollView is locked while a row is lifted. Fixed row height (88) → slot maths, no measuring.
  VoiceOver: Open / Move up / Move down accessibility actions.
- **Gotchas (GH v3 is hook-based — not v2's `Gesture.Pan()`, now "Legacy*"):**
  `usePanGesture({ onBegin, onActivate, onUpdate, onFinalize })` + `<GestureDetector gesture>`;
  callbacks run on the UI thread only if they're worklets (`"worklet"` directive); call JS with
  `scheduleOnRN` from `react-native-worklets`. `GestureDetector` **throws in dev without
  `GestureHandlerRootView`** → added at the root (`app/_layout.tsx`). React Compiler lint rejects
  `sv.value = x` in hook callbacks → use `sv.get()` / `sv.set()`. Don't put `className` on an
  `Animated.View` that also has animated styles — nest a plain `View`.
- Replaced the earlier up/down `reorder-workspaces` screen (deleted) and the Dashboard ⇅ button.
  `ROLE_LABEL` / `urgencySignal` are now exported from `dashboard/workspace-card.tsx`.

**Verified.** tsc ✅ · lint ✅ · expo-doctor 20/20 ✅ · iOS + Android bundles ✅. **Drag feel not
yet tried on a device** (Windows session) — tune `HOLD_MS` / `SPRING` in the list file if needed.
No new packages, no native changes. Not yet: auto-scroll when dragging near the screen edge
(only matters with more workspaces than fit on screen). → done in the next entry.

## 2026-11-19 — Appearance: System / Light / Dark switcher

- **Settings → Appearance**: segmented System · Light · Dark (`components/settings/appearance-picker.tsx`).
  Applies instantly, app-wide, and is remembered.
- **How:** `lib/theme-preference.ts` calls NativeWind's `colorScheme.set()`, which calls RN
  `Appearance.setColorScheme()` ("unspecified" for System on RN ≥0.82). That one override drives
  NativeWind `dark:` tokens, RN `useColorScheme()` → `useThemeColors()`, the navigation theme,
  status bars and native alerts / keyboard. **Screens don't read the preference** — keep using
  `useThemeColors()` and token classes and new screens follow the switch for free.
- Saved in SecureStore (`ninjaloop.theme`; already installed — no new native module). Loaded in
  `app/_layout.tsx` before the splash hides, so a forced theme never flashes the system one.
- Audit: no hard-coded colours outside sign-in except white icons on filled primary / destructive
  buttons (fine in both). Sign-in keeps its fixed light palette by design.
- Web preview doesn't apply the override (darkMode is "media" there).

**Verified.** tsc ✅ · lint ✅ · expo-doctor 20/20 ✅ · iOS bundle ✅. Not yet tried on the Simulator.
No new packages, no native changes.

## 2026-11-19 — Production contract audit; Create workspace, Workspace settings, Reorder

**Audit against the backend source** (`ref/ninja-loop` pulled; routes, `lib/mobile-api.ts`,
`lib/mobile-serializers.ts`, services). Every app call matches method / path / body / response,
except:
- **Crash fixed:** `PUT …/tasks/:tid/assignees` returns TaskDetail *without* `links`. The app wrote
  it straight into the task cache → `links.map` on undefined the moment you changed an assignee.
  `useSetAssignees` now keeps the cached links (`src/api/tasks.api.ts`). Backend bug noted in STATUS.
- **`.env` fixed:** `EXPO_PUBLIC_API_BASE_URL` was still the `your-ninja-loop-url.example.com`
  placeholder → now `https://www.ninjaloop.com.au`. Restart with `npx expo start -c`.
- **404 copy:** `describeLoadError` said "This isn't available on the server yet." for every 404.
  Now a mobile-API 404 (has `code`) shows the server's message ("Workspace not found.", also what
  non-members get); only a code-less 404 (route missing) keeps the old copy.
- Checked OK: no middleware / Origin check on `/api/mobile/*` (session read directly), 204 bodies,
  error shape, `X-Timezone`, `URL.hostname` exists in RN 0.88's polyfill (links form is fine).
- Backend (not fixable here): dashboard `nextPriorityTaskTitle` can be a completed task.

**New screens**
- `workspace/new` — name (1–100) → `POST /workspaces` → `router.replace` to the new board (Back =
  dashboard). Entry: **+ New** on the dashboard "Workspaces" header and under its empty state.
- `workspace/[wid]/settings` — board header ⚙ for OWNER / ADMIN. Rename (`PATCH`, admin; save
  button appears only when changed, "Saved" tick after); Members row; owner-only Danger zone:
  type the exact name (web's DeleteWorkspaceDialog rule) → `DELETE` → `router.dismissTo("/")`.
  The deleted workspace's cache is removed ~1 s later so mounted screens don't flash a 404.
- `reorder-workspaces` — dashboard ⇅ (2+ workspaces). Up / down on a local order, one
  `PUT /workspaces/order` on Save, optimistic on the dashboard + `GET /workspaces` cache.
- Shared: `components/form/text-field.tsx` (themed single-line input), `SectionHeader` gained a
  `right` slot, `qk.workspaces()`, hooks `useWorkspaces`, `useRenameWorkspace`,
  `useDeleteWorkspace`, `useReorderWorkspaces`. Icon added: `ArrowUpDown`.

**Verified.** tsc ✅ · lint ✅ · expo-doctor 20/20 ✅ · iOS bundle ✅. **Not click-tested on a
Simulator** (this session ran on Windows) — test plan in `docs/02-STATUS.md`. No new packages,
no native changes.

## 2026-11-19 — Workspace board, task screen, members, request update; loose ends

**Backend is live.** PR #3 merged and deployed at `https://www.ninjaloop.com.au` (the bare domain
307-redirects to `www`, so the app must use `www`). Types in `src/types/api.types.ts` were
checked against the backend's `docs/MOBILE-API.md` (added `Me.user.displayName`, Workspace,
Member, Person, TaskSummary, TaskDetail, SubTask, TaskLink, TaskComment, TaskPatch).

**New screens** (pushed on the `(app)` stack, slide animation; tabs keep "fade"):
- `workspace/[wid]` **Board**: one vertical priority queue (the web's snake board flattened).
  #1 wears the teal "next up" node, and the node is also the complete toggle. Add task bar
  (new tasks go to the top, server rule), show / hide done, Members, "Request update" for
  non-owners. Toggling done keeps the list on screen (`placeholderData`, same workspace only).
- `workspace/[wid]/task/[tid]` **Task**: title + notes (save on blur), complete / reopen,
  queue position (To top / Up / Down → `PUT …/position` with neighbour ids), due-date and
  snooze quick picks (no native picker; end of local day, like the web), blocker, assignees
  (≥1), checklist, links (http(s), add / open / remove), comments, delete, request update about
  this task.
- `workspace/[wid]/members` (read-only) and `workspace/[wid]/request` (message ≤4000).
- **Wired:** dashboard urgent rows → task; workspace cards → board; notifications open their
  `target` (task / Inbox / web URL), never the web `href`.

**Data layer:** `src/api/workspaces.api.ts` (workspace, members, tasks, create / update / delete
/ move task, request priority, create workspace) and `src/api/tasks.api.ts` (task detail,
subtasks, links, assignees, comments). Task PATCH is optimistic on the queue and the detail
(rolls back on error); subtasks and links are optimistic on the detail. Any task change
invalidates `qk.workspace(wid)` (whole subtree) + the dashboard.

**Fixed:**
- `PressableSurface` always set `opacity: 1`, which overrode `opacity-40` disabled styling →
  disabled buttons looked enabled. It now sets opacity only while pressed.
- Overlapping avatar initials were clipped.
- Two `setState`-in-effect lint errors → render-time re-sync.

**Loose ends tightened:** `eas.json` preview / production URL is now `https://www.ninjaloop.com.au`;
`.env.example` documents the `www` requirement; the README / backend prompt are marked done;
added `docs/02-STATUS.md` (what's left) and `docs/HANDOVER.md` (new-session prompt).

**Verified.** tsc ✅ · lint ✅ · iOS bundle ✅ · Board and Task screenshotted light + dark against a
mock of MOBILE-API.md shapes. **Not yet click-tested against production** (next session's first job).
No new packages.

## 2026-11-18 — Sign in with Apple (iOS)

- `useAppleSignIn` (`src/api/auth.api.ts`): native `expo-apple-authentication` sheet with a
  random nonce (`expo-crypto`) → `authClient.signIn.social({ provider: "apple", idToken: { token,
  nonce, user } })`. The server verifies the token (audience = bundle id; better-auth 1.7 accepts
  the raw nonce, "exact-or-sha256"). The name is forwarded on first authorization only (Apple
  sends it once). Cancelling the sheet is silent.
- Login form: Apple's own black "Continue with Apple" button first, iOS only
  (`isAvailableAsync`), pill radius to match Google / GitHub.
- `app.json`: `ios.usesAppleSignIn: true` + `expo-apple-authentication` plugin
  (entitlement `com.apple.developer.applesignin`).
- **Native change** — needs a new dev build: `npx expo prebuild --clean && npx expo run:ios`.
  Not testable in Expo Go's Apple flow against our server (token audience would be Expo Go's id).
- Server side already merged (backend PR #3): enabled only when `APPLE_CLIENT_ID` and
  `APPLE_CLIENT_SECRET` are set.

## 2026-11-18 — Auth requests time out after 20 s

"Continue with Google" spun forever when `EXPO_PUBLIC_API_BASE_URL` was wrong. `authClient` now
sets `fetchOptions.timeout = 20_000`; `describeAuthError` maps abort / timeout to
"Can't reach Ninja Loop". Reminder: `.env` changes need `npx expo start -c`.

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
