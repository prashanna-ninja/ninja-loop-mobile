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
| Request update | `workspace/[wid]/request` (non-owners; optional task) | ⚠️ |
| Settings | Profile, open web, version, privacy / terms, sign out, delete account | ⚠️ |

**First thing next session:** click through every ⚠️ row against production on a device /
Simulator and fix what breaks (shapes were matched to MOBILE-API.md, but nothing beyond
sign-in has been exercised against the live server yet).

## Not built yet (in rough priority order)

1. **Create workspace** — hook exists (`useCreateWorkspace`), no UI. Natural place: a "+" on the
   Dashboard "Workspaces" header → a small form screen → navigate to the new board.
2. **Workspace settings** — rename (`PATCH /workspaces/:wid`, admin), delete (owner), workspace
   reorder (`PUT /workspaces/order`).
3. **Invites** — list / send / revoke (`/workspaces/:wid/invites`, admin) and **accepting** an
   invite: `GET /invites/:token` + `POST /invites/:token/accept`. Needs universal links for
   `https://www.ninjaloop.com.au/invite/<token>` (app.json `ios.associatedDomains` +
   `android.intentFilters`, plus `apple-app-site-association` / `assetlinks.json` on the server).
4. **Drag to reorder** the queue (today: To top / Up / Down on the task screen). Would need
   `react-native-draggable-flatlist` or a Reanimated gesture list (native → rebuild).
5. **File upload** from the phone (3-step presigned flow in MOBILE-API.md; needs
   `expo-document-picker` / `expo-image-picker` → rebuild). Links work today.
6. **Custom due date / time** — today quick picks only (Today, Tomorrow, Friday, Next Monday,
   In 2 weeks; snooze: Tomorrow 9am, Monday 9am, In a week). A real picker needs
   `@react-native-community/datetimepicker` (native → rebuild).
7. **Push notifications** — backend not built (no `PushDevice` / `POST /devices` yet).
8. Edit / delete comments, subtask rename / reorder, "clear completed" subtasks — API exists.

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

- The bare domain `ninjaloop.com.au` 307-redirects to `www` — the app MUST use `https://www.ninjaloop.com.au`.
- Production auth 500'd on every `/api/auth/*` call until the `rateLimit` table existed in the
  production DB (Better Auth 1.7 rate-limit storage = "database"). If auth 500s again, check that first.
- Apple sign-in on the Simulator fails with `AuthorizationError 1000` unless an Apple Account is
  signed in AND the build is signed with the team. Real device (EAS dev build) is reliable.
- `ref/ninja-loop` (local checkout) is behind `origin` — `git pull` it to read the merged
  backend code and MOBILE-API.md on disk.
- Web build (`npx expo export -p web`) is preview-only (used for screenshots against a mock API).
