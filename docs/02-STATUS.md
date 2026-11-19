# Status — what works, what's left (updated 2026-11-19)

Backend: `https://www.ninjaloop.com.au` (Vercel). API reference: `ref/ninja-loop/docs/MOBILE-API.md`.

## Works (built + typechecked; screens checked visually against a mock of the API)

| Area | Screens / behaviour | Verified against the real server? |
| --- | --- | --- |
| Sign-in | Apple (iOS, native), Google, GitHub (browser → `ninjaloop://`), email 6-digit code | ✅ user signed in on the iOS Simulator |
| Shell | Tabs: Dashboard · Alerts · Inbox · Settings, badges from `GET /me` | ⚠️ not explicitly |
| Dashboard | Insights strip, urgent tasks (→ task), workspaces (→ board) | ⚠️ |
| Alerts | Infinite list, mark read / all read, tap opens the target (task / Inbox / web URL) | ⚠️ |
| Inbox | Incoming priority requests, Mark done | ⚠️ |
| Board | `workspace/[wid]`: queue, add task (top), complete / reopen from the node, show done | ⚠️ |
| Task | `workspace/[wid]/task/[tid]`: title / notes, complete, move (top / up / down), due, blocked, snooze, assignees, checklist, links, comments, delete, request update | ⚠️ |
| Members | `workspace/[wid]/members` (read-only) | ⚠️ |
| Create workspace | Dashboard "Workspaces" → **+ New** (also under the empty state) → `workspace/new` → opens the new board | ⚠️ new |
| Workspace settings | Board ⚙ (owner / admin) → `workspace/[wid]/settings`: rename (admin), delete after typing the name (owner) | ⚠️ new |
| Reorder workspaces | Dashboard "Workspaces" ⇅ (2+ workspaces) → `reorder-workspaces`: up / down, Save order | ⚠️ new |
| Request update | `workspace/[wid]/request` (non-owners; optional task) | ⚠️ |
| Settings | Profile, open web, version, privacy / terms, sign out, delete account | ⚠️ |

**First thing next session — click-test on the iOS Simulator against production.** All API
calls were checked against the backend *source* on 2026-11-19 (one crash fixed, see log); nothing
beyond sign-in has been exercised live yet. Run `npx expo start -c` (the `.env` URL changed), then:

1. Dashboard: counts, urgent rows → task, workspace cards → board, pull to refresh.
2. **+ New** → create "Test WS" → lands on its empty board → Back → it's on the dashboard.
3. Board: add 3 tasks (newest on top), complete via the node, show / hide done, pull to refresh.
4. Task: edit title / notes (blur saves), To top / Up / Down, due + snooze picks, block / unblock,
   **change assignees** (was the crash), checklist add / tick / delete, add / open / remove link,
   comment, delete task.
5. Board ⚙ → rename (dashboard + board title update) → Members row → delete "Test WS" (type the
   name) → back on the dashboard, workspace gone.
6. ⇅ Reorder with 2+ workspaces → Save → dashboard order matches the web.
7. Alerts: open a task / Inbox notification, mark all read (badge drops). Inbox: Mark done.
8. As a non-owner (second account): Request update from board and task → owner's Inbox.
9. Settings: open web, privacy / terms, sign out → sign back in.

## Not built yet (in rough priority order)

1. **Invites** — list / send / revoke (`/workspaces/:wid/invites`, admin) and **accepting** an
   invite: `GET /invites/:token` + `POST /invites/:token/accept`. Needs universal links for
   `https://www.ninjaloop.com.au/invite/<token>` (app.json `ios.associatedDomains` +
   `android.intentFilters`, plus `apple-app-site-association` / `assetlinks.json` on the server).
2. **Drag to reorder** the queue (today: To top / Up / Down on the task screen). Would need
   `react-native-draggable-flatlist` or a Reanimated gesture list (native → rebuild).
3. **File upload** from the phone (3-step presigned flow in MOBILE-API.md; needs
   `expo-document-picker` / `expo-image-picker` → rebuild). Links work today.
4. **Custom due date / time** — today quick picks only (Today, Tomorrow, Friday, Next Monday,
   In 2 weeks; snooze: Tomorrow 9am, Monday 9am, In a week). A real picker needs
   `@react-native-community/datetimepicker` (native → rebuild).
5. **Push notifications** — backend not built (no `PushDevice` / `POST /devices` yet).
6. Edit / delete comments, subtask rename / reorder, "clear completed" subtasks — API exists.

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
