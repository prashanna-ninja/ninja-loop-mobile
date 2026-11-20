# Status — what works, what's left (updated 2026-11-19)

Backend: `https://www.ninjaloop.com.au` (Vercel). API reference: `ref/ninja-loop/docs/MOBILE-API.md`.

## Works (built + typechecked; screens checked visually against a mock of the API)

| Area | Screens / behaviour | Verified against the real server? |
| --- | --- | --- |
| Sign-in | Apple (iOS, native), Google, GitHub (browser → `ninjaloop://`), email 6-digit code | ✅ user signed in on the iOS Simulator |
| Shell | Tabs: Dashboard · Workspaces · Alerts · Inbox · Settings, badges from `GET /me` | ⚠️ not explicitly |
| Dashboard | Insights strip, urgent tasks (→ task), workspaces (→ board) | ⚠️ |
| Alerts | Infinite list, mark read / all read, tap opens the target (task / Inbox / web URL) | ⚠️ |
| Inbox | Incoming priority requests, Mark done | ⚠️ |
| Board | `workspace/[wid]`: queue, add task (top), **hold & drag to reprioritise** (auto-scrolls at the edges, `PUT …/position`), complete / reopen from the node, show done | ⚠️ |
| Task | `workspace/[wid]/task/[tid]`: title / notes, complete, move (top / up / down), due (quick picks + **calendar**), blocked, snooze (quick picks + **date & time**), assignees, checklist (**drag to reorder, rename, clear done**), links + **file upload (photo / camera / file → R2)**, comments, delete, request update | ⚠️ new parts need the rebuild |
| Members + invites | `workspace/[wid]/members`: list; owners / admins **invite by email (role), see / revoke pending invites** | ⚠️ new |
| Accept invite | `invite/[token]` from an invite link or **Workspaces → Join** (paste link): join / used / expired / wrong-account; signed-out links open after sign-in | ⚠️ new; tapping links needs the server files (`docs/03-…`) + rebuild |
| Create workspace | Dashboard "Workspaces" → **+ New** (also under the empty state) → `workspace/new` → opens the new board | ⚠️ new |
| Workspace settings | Board ⚙ (owner / admin) → `workspace/[wid]/settings`: rename (admin), delete after typing the name (owner) | ⚠️ new |
| Workspaces tab | 2nd tab: all workspaces in your order; **hold & drag to reorder** (springs + haptics, `PUT /workspaces/order` on drop, optimistic); tap → board; + New. VoiceOver: Move up / down actions | ⚠️ new |
| Request update | `workspace/[wid]/request` (non-owners; optional task) | ⚠️ |
| Settings | Profile, open web, **Notifications**, **Appearance (System / Light / Dark, remembered)**, version, privacy / terms, sign out, delete account | ⚠️ |
| Push notifications | App side: opt-in (Alerts banner / Settings), 4 categories, register / unregister (also on sign-out), tap → task / Inbox, icon badge | ❌ backend not built — `docs/04-BACKEND-PUSH.md`; needs `eas init` + rebuild |

**First thing next session — click-test on the iOS Simulator against production.** All API
calls were checked against the backend *source* on 2026-11-19 (one crash fixed, see log); nothing
beyond sign-in has been exercised live yet. Run `npx expo start -c` (the `.env` URL changed), then:

1. Dashboard: counts, urgent rows → task, workspace cards → board, pull to refresh.
2. **+ New** → create "Test WS" → lands on its empty board → Back → it's on the dashboard.
3. Board: add 3 tasks (newest on top; the others slide down), hold one → drag it to the top →
   "Next up" + numbers update, web agrees; with 10+ tasks drag to the screen edge → auto-scrolls;
   quick taps on the node / body still complete / open (never after a drag); show / hide done.
4. Task: edit title / notes (blur saves), To top / Up / Down, due + snooze picks, block / unblock,
   **change assignees** (was the crash), checklist add / tick / delete, add / open / remove link,
   comment, delete task.
5. Board ⚙ → rename (dashboard + board title update) → Members row → delete "Test WS" (type the
   name) → back on the dashboard, workspace gone.
6. Workspaces tab (2+ workspaces): hold a row ~0.2 s → lifts + haptic → drag past others (they
   slide, tick each slot) → release → Dashboard and web show the new order. Quick tap opens the
   board; normal swipes still scroll; pull to refresh mid-list.
7. Alerts: open a task / Inbox notification, mark all read (badge drops). Inbox: Mark done.
8. As a non-owner (second account): Request update from board and task → owner's Inbox.
9. Task uploads (after `npx expo prebuild --clean && npx expo run:ios`): Photo → pick → progress
   bar → file row appears (web shows it too, opens from the R2 URL); Camera (permission prompt);
   File (Files app, e.g. a PDF). Checklist: hold an item → drag → order sticks after refresh and on
   web; tap text → rename; tick two → Clear done. Due → Pick a date… (custom chip shows the day);
   Snooze → Pick a time… (past times refused).
10. Invites (2 accounts): Board → Members → invite B's email as Member → pending row (revoke one
   to check) → B: Workspaces → Join → paste the email link → Join → lands on the board, workspace
   in B's lists. Wrong account: open A's invite link while signed in as C → "Sign out and use …".
   With the server files live + rebuild: tap the link in Mail → app opens the invite (also
   when signed out: sign in → invite opens).
11. Push (real iPhone, after `eas init` + rebuild + backend): Alerts → Turn on → allow → Settings
   shows "On for this phone"; second account assigns you / comments / sends a request → push →
   tap opens the task / Inbox; turn a category off → no push but the Alerts row appears; sign out
   → device row gone.
12. Settings: Appearance → Light / Dark / System (every screen + tab bar + status bar flip; kill and
   relaunch keeps it); open web, privacy / terms, sign out → sign back in.

## Not built yet (in rough priority order)

1. **Server: universal-link files** — `docs/03-BACKEND-UNIVERSAL-LINKS.md` (AASA + assetlinks).
   Until then invite links open the web page; "Join with a link" works in the app.
2. **Push notifications — backend** — app side done; build `docs/04-BACKEND-PUSH.md` in the web
   repo (Upstash QStash + Expo). Also `npx eas-cli init` (projectId) + APNs key, then rebuild.
3. Not possible: edit / delete comments, remove members / change roles, leave workspace —
   neither the web nor the mobile API has them.
4. Billing / upgrade — web-only (Stripe); keep it off the app (App Store in-app purchase rules).

## Before the App Store

- Real app icon + splash (still Expo placeholders in `assets/images`).
- `ios.appleTeamId` in app.json (stops signing settings being lost on `prebuild --clean`).
- App Review: set `REVIEW_EMAIL` + `REVIEW_OTP` on the server, run `pnpm seed-review`, give the
  reviewer "Sign in with email code". Apple client secret expires every 6 months — calendar it.
- Apple "Sign in with Apple for Email Communication": register the Resend sending domain, or
  mail to `@privaterelay.appleid.com` users bounces.
- Privacy policy / terms URLs (`/privacy`, `/terms` on the web) must exist.
- `eas build --profile production` + `eas submit`.

## Known issues / watch-outs

- **Backend bugs to report** (the app works around / can't fix):
  - `PUT …/tasks/:tid/assignees` returns a TaskDetail **without `links`** (route calls
    `serializeTaskDetail` with no links; MOBILE-API.md says TaskDetail). App keeps cached links.
  - Dashboard / `GET /workspaces` `nextPriorityTaskTitle` can be a **completed** task:
    `getDashboardWorkspaces` (`lib/services/workspace.ts` ~L202) filters `lane` but not `completedAt: null`.

- The bare domain `ninjaloop.com.au` 307-redirects to `www` — the app MUST use `https://www.ninjaloop.com.au`.
- Production auth 500'd on every `/api/auth/*` call until the `rateLimit` table existed in the
  production DB (Better Auth 1.7 rate-limit storage = "database"). If auth 500s again, check that first.
- Apple sign-in on the Simulator fails with `AuthorizationError 1000` unless an Apple Account is
  signed in AND the build is signed with the team. Real device (EAS dev build) is reliable.
- `ref/ninja-loop` (local checkout) is behind `origin` — `git pull` it to read the merged
  backend code and MOBILE-API.md on disk.
- Web build (`npx expo export -p web`) is preview-only (used for screenshots against a mock API).
