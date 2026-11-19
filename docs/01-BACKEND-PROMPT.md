# Backend changes for Ninja Loop mobile — prompt

> **Status (2026-11-19): DONE.** Implemented in the backend repo (PR #3, "feat/mobile-api") and
> deployed at `https://www.ninjaloop.com.au`. The source of truth for the API is now the
> backend's own `docs/MOBILE-API.md` (`ref/ninja-loop/docs/MOBILE-API.md` after `git pull`).
> Kept for history; push devices (§3.x) are still not built server-side.

Paste everything below the line into Claude Code (or hand it to whoever works on the
Ninja Loop Next.js repo). It is self-contained. Phase 1 unblocks the login screen; Phase 2
unblocks every other screen; Phase 3 is required before App Store submission.

---

You are working in the **Ninja Loop** web app (Next.js 16 App Router, Prisma 7 + Postgres,
Better Auth 1.4.18 with Google + GitHub social login, `admin` and `@better-auth/stripe`
plugins, Resend email, S3 uploads). All data access today goes through **server actions**
in `lib/actions/*.ts`, guarded by `requireUser` / `requireBusinessMember` /
`requireBusinessRole` in `lib/auth-helpers.ts`, which call `redirect()` on failure.

We are building a **React Native (Expo SDK 58) mobile app** for Ninja Loop. A native app
cannot call server actions and cannot follow `redirect()`s, so it needs:

1. Better Auth configured for a native client (Expo plugin, app deep-link scheme, email OTP).
2. A small, versioned **JSON REST API** under `/api/mobile/v1/*` that exposes the same
   behaviour the server actions already implement.

**Hard rules**

- The web app must keep working exactly as it does now. No behaviour change on the web.
- **Do not duplicate business logic.** Extract it from the server actions into plain
  functions (see Phase 2.1); server actions and API routes both call those.
- Every permission check that exists in a server action must exist in the matching route.
  Members-only stays members-only; OWNER/ADMIN-only stays OWNER/ADMIN-only.
- Pin the Better Auth packages to an **exact** version (no `^`). The mobile app pins the
  same version; client/server drift causes cookie-format bugs that are hard to diagnose.
- Commit in small steps (`feat:` / `fix:` / `chore:`); run `pnpm lint` and `pnpm build`
  before each commit.

---

## Phase 1 — Auth for the mobile app (blocks the login screen)

The mobile app signs in three ways:
- **Google** and **GitHub**, using `authClient.signIn.social({ provider, callbackURL: "/" })`
  from `@better-auth/expo/client`. It opens the system browser (ASWebAuthenticationSession /
  Chrome Custom Tabs), runs the normal server-side OAuth flow, and the server redirects back
  to `ninjaloop://…` carrying the session cookie.
- **Email one-time code** (new): `emailOtp.sendVerificationOtp({ email, type: "sign-in" })`
  then `signIn.emailOtp({ email, otp })`. For people without Google/GitHub, and for App Review.

### 1.1 Upgrade and add packages

```bash
pnpm add better-auth@1.7.25 @better-auth/stripe@1.7.25 @better-auth/expo@1.7.25 --save-exact
```

- Why 1.7.25: `@better-auth/expo@1.4.x` declares a peer dependency on `expo-network ^8`,
  which conflicts with Expo SDK 58. 1.7.25 is the current release and is what the app pins.
- After upgrading, run `npx @better-auth/cli@1.7.25 generate --output /tmp/ba-schema.prisma`
  and diff it against `prisma/schema.prisma`. If the user, session, account, verification or
  subscription models need new fields, add them with a Prisma migration. Do not delete existing
  columns.
- Go through the Better Auth changelog from 1.4 to 1.7 for breaking changes to the `admin` and
  `stripe` plugins, and fix any type errors.
- **Regression check (web):** Google sign-in, GitHub sign-in, sign-out, Stripe upgrade with
  the 14-day trial, the billing portal, and admin set-role / ban / unban all still work.

### 1.2 `lib/auth.ts`

```ts
import { expo } from "@better-auth/expo";
import { emailOTP } from "better-auth/plugins";
import { sendSignInCodeEmail } from "@/lib/email/resend";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL, // exact public https URL, no trailing slash
  trustedOrigins: [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL,
    "ninjaloop://",                    // mobile app scheme (app.json "scheme")
    ...(isProd ? [] : ["exp://"]),     // Expo Go during development only
  ].filter(Boolean) as string[],
  // …database, socialProviders unchanged…
  plugins: [
    admin({ adminUserIds: getAdminUserIds() }),
    stripe({ /* unchanged */ }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,         // 5 minutes — the app shows this on screen
      allowedAttempts: 3,     // then the code is invalidated (app shows "send a new one")
      disableSignUp: false,   // same as social: first sign-in creates the account
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        await sendSignInCodeEmail({ toEmail: email, code: otp });
      },
      // App Review: see 3.2. Off unless both env vars are set.
      generateOTP: ({ email }) =>
        process.env.REVIEW_EMAIL && process.env.REVIEW_OTP &&
        email.toLowerCase() === process.env.REVIEW_EMAIL.toLowerCase()
          ? process.env.REVIEW_OTP
          : undefined, // undefined → Better Auth's normal random code
    }),
    expo(), // lets native clients send `expo-origin` and get deep-link redirects
  ],
  rateLimit: {
    enabled: true,
    storage: "database", // memory storage isn't shared between serverless instances
    customRules: {
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
});
```

- Check the `generateOTP` signature against the installed 1.7.25 types. If it can't fall back
  by returning `undefined`, generate a random 6-digit code yourself with `crypto.randomInt`.
- `storage: "database"` needs Better Auth's `rateLimit` table. Add it with the CLI generate
  step in 1.1 and a migration.
- If a `nextCookies()` plugin is ever added, it must stay last.

### 1.3 Email template

In `lib/email/resend.ts`, add `sendSignInCodeEmail({ toEmail, code })`. Follow the same layout
as the existing transactional emails. Subject: `Your Ninja Loop sign-in code: 123456`. The
body shows the code large and in monospace, says it expires in 5 minutes, and says to ignore
the email if you didn't request it. Don't include a link. The user types the code into the app.

### 1.4 Environment (every deployed environment)

| Var | Value |
| --- | --- |
| `BETTER_AUTH_URL` | The exact public HTTPS origin (e.g. `https://app.ninjaloop.com.au`). The mobile `EXPO_PUBLIC_API_BASE_URL` must be **identical**, including `www` or no `www`, because a redirect drops the auth cookie. |
| `NEXT_PUBLIC_APP_URL` | Same origin as above. |
| `RESEND_API_KEY` + a verified sender | Without these, OTP emails don't send. |
| `REVIEW_EMAIL`, `REVIEW_OTP` | Only set these on the environment App Review uses (see 3.2). |

### 1.5 OAuth provider consoles

The mobile flow reuses the **existing web OAuth clients**: the browser hits the same
`/api/auth/callback/{google|github}` URL. No new redirect URIs are needed. Confirm that the
Google consent screen is **in production** and not in testing mode, otherwise only test users
can sign in.

### 1.6 Done when

- `curl -X POST $URL/api/auth/email-otp/send-verification-otp -H 'content-type: application/json' -d '{"email":"you@x.com","type":"sign-in"}'` sends an email.
- `POST /api/auth/sign-in/email-otp {email, otp}` responds with a `Set-Cookie` session.
- A request with header `expo-origin: ninjaloop://` is not rejected as an untrusted origin.
- The web login still works.

---

## Phase 2 — Mobile REST API `/api/mobile/v1/*`

### 2.1 Refactor: actions → services (no behaviour change)

Create `lib/services/{workspace,task,subtask,task-link,comment,invite,priority-request,notification,insights}.ts`.
Move the body of each server action into a function that takes an explicit `actor: { id, name, email }`
as its first argument and **throws typed errors** instead of calling `redirect()`:

```ts
// lib/services/errors.ts
export class ServiceError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT",
    message: string,
  ) { super(message); }
}
```

- Add `requireMembership(actorId, businessId, roles?)` in the service layer. It throws
  `NOT_FOUND` if the user isn't a member (don't reveal that the workspace exists) and
  `FORBIDDEN` if their role is wrong.
- Server actions become thin wrappers: `requireUser()` → call service → on `ServiceError`, keep
  today's web behaviour (redirect or throw) so the web is unchanged.
- Keep the side effects (notifications, assignment emails, priority-request emails) inside the
  services so both web and mobile trigger them.

### 2.2 Route helper

`lib/mobile-api.ts`:

```ts
export function mobileRoute<P>(
  handler: (ctx: { req: Request; user: SessionUser; params: P; tz: string }) => Promise<unknown>,
) { /* … */ }
```

- Session: `auth.api.getSession({ headers: req.headers })`. If there's no session, return **401**.
  Never redirect.
- Errors: map `ServiceError` to 401, 403, 404, 400 or 409. Map Zod errors to 400 with the
  field issues. Anything else returns 500 and is logged.
- **Error body (always):** `{ "error": { "code": "NOT_FOUND", "message": "Workspace not found." } }`
- **Success body:** the resource as JSON. Dates are ISO-8601 strings. Return `204` with no body
  for deletes and fire-and-forget actions.
- **Time zone:** read the `X-Timezone` header (an IANA name like `Australia/Sydney`, validated,
  default `UTC`). Use it for every "today / end of day / end of week / start of week" calculation
  (`getDashboardWorkspaces`, `getDashboardUrgentTasks`, `getDashboardInsights`). Today those use
  the server's local time, which is UTC on Vercel, so "due today" is wrong for Australian users
  on the web too. Use `@date-fns/tz` (`TZDate`). It's fine to fix the web the same way.
- Validate every body and query with **zod** (add `zod` as a direct dependency).
- Add `export const dynamic = "force-dynamic"` to each route.

### 2.3 Endpoints

All paths below are prefixed `/api/mobile/v1`. `:wid` is the workspace (business) **id**; the
`slug` is also returned for building web links. "Member" means any role; "Admin" means OWNER
or ADMIN; "Owner" means OWNER only. These permissions match the existing server actions.

**Me & dashboard**

| Method & path | Auth | Source today | Response |
| --- | --- | --- | --- |
| `GET /me` | user | session + `dashboard/page.tsx` | `{ user:{id,name,email,image,role}, isAdmin, counts:{unreadNotifications, openIncomingRequests} }`. No subscription data (see 3.4). |
| `GET /dashboard` | user | `getDashboardInsights`, `getDashboardWorkspaces`, `getDashboardUrgentTasks(25)` | `{ insights, workspaces, urgentTasks }`, one round trip for the home screen |
| `DELETE /me` | user | **new**, see 3.1 | 204 |

**Workspaces**

| Method & path | Auth | Source today |
| --- | --- | --- |
| `GET /workspaces` | user | `getDashboardWorkspaces` (same shape) |
| `POST /workspaces` `{name}` | user | `createBusiness` → `{id, slug}` |
| `PUT /workspaces/order` `{orderedIds}` | user | `reorderWorkspaces` |
| `GET /workspaces/:wid` | Member | `{id,name,slug,role,memberCount,activeTaskCount}` |
| `PATCH /workspaces/:wid` `{name}` | Admin | `updateBusiness` |
| `DELETE /workspaces/:wid` | Owner | `deleteBusiness` |
| `GET /workspaces/:wid/members` | Member | `getWorkspaceMembersForPicker` + each member's `role` |
| `GET /workspaces/:wid/invites` | Admin | pending invites (`settings/members/page.tsx` query) |
| `POST /workspaces/:wid/invites` `{email, role}` | Admin | `inviteMember` → `{inviteId}` (**don't** return the token) |
| `DELETE /workspaces/:wid/invites/:inviteId` | Admin | `revokeInvite` |
| `GET /invites/:token` | user | **new** preview: `{workspaceName, inviterName, email, role, expired, accepted, emailMatches}` |
| `POST /invites/:token/accept` | user | `acceptInvite` → `{workspaceId, slug}`, or 404 / 409 / 403 with a clear message |

**Tasks** (the priority queue)

| Method & path | Auth | Source today |
| --- | --- | --- |
| `GET /workspaces/:wid/tasks?showDone=0\|1` | Member | `b/[slug]/board/page.tsx` query: open PRIORITY tasks by `position` asc, plus done tasks by `completedAt` desc when `showDone=1`. Each task: `id,title,description,position,dueDate,completedAt,blockedReason,snoozeUntil,createdAt,createdBy{id,name,image},assignees[{id,name,image}],subTaskCount,subTaskDoneCount`. Apply `resolveTaskAssigneesForDisplay` the same way the board does. |
| `POST /workspaces/:wid/tasks` `{title, dueDate?}` | Member | `createTask` |
| `GET /workspaces/:wid/tasks/:tid` | Member | `getTask` (TaskDetail) + `links` |
| `PATCH /workspaces/:wid/tasks/:tid` | Member | One endpoint for `{title?, description?, dueDate?, completed?, blockedReason?, snoozeUntil?}`, routed to `updateTask` / `setTaskCompletion` / `setTaskBlocked` / `setTaskSnooze`. Returns the updated TaskDetail. |
| `DELETE /workspaces/:wid/tasks/:tid` | Member | `deleteTask` |
| `PUT /workspaces/:wid/tasks/:tid/position` `{beforeId?, afterId?}` | Member | `reorderTask` (ids in **position order**, as now) |
| `PUT /workspaces/:wid/tasks/:tid/assignees` `{userIds}` | Member | `setTaskAssignees` |
| `GET\|POST /workspaces/:wid/tasks/:tid/comments` `{body}` | Member | `listTaskComments` / `addTaskComment` |
| `GET\|POST /workspaces/:wid/tasks/:tid/subtasks` `{title}` | Member | `listSubTasks` / `createSubTask` |
| `PATCH /workspaces/:wid/tasks/:tid/subtasks/:sid` `{title?, completed?}` | Member | `updateSubTaskTitle` / `toggleSubTask` |
| `DELETE /workspaces/:wid/tasks/:tid/subtasks/:sid` | Member | `deleteSubTask` |
| `PUT /workspaces/:wid/tasks/:tid/subtasks/order` `{orderedIds}` | Member | `reorderSubTasks` |
| `DELETE /workspaces/:wid/tasks/:tid/subtasks?completed=1` | Member | `clearCompletedSubTasks` |
| `GET\|POST /workspaces/:wid/tasks/:tid/links` `{label,url,type}` | Member | `getTaskLinks` / `createTaskLink` (validate `url` is http(s)) |
| `DELETE /workspaces/:wid/tasks/:tid/links/:lid` | Member | `deleteTaskLink` |

File uploads: the existing `POST /api/upload/presigned` already reads the session from
request headers, so the app can call it as it is, then `PUT` to S3, then `POST …/links`
with `type: "FILE"`. No change needed. Confirm it doesn't depend on browser-only headers.

**Priority requests**

| Method & path | Auth | Source today |
| --- | --- | --- |
| `GET /requests` | user | `listIncomingPriorityRequests` (add `businessId`, `taskId`) |
| `POST /workspaces/:wid/requests` `{message, taskId?}` | Member (not Owner) | `createPriorityRequest`; its `{ok:false,error}` results become 400/403 errors |
| `POST /requests/:id/address` | recipient | `markPriorityRequestAddressed` |

**Notifications**

| Method & path | Auth | Source today |
| --- | --- | --- |
| `GET /notifications?cursor=&limit=30` | user | `listNotifications`, cursor-paginated by `createdAt,id` → `{items, nextCursor}` |
| `POST /notifications/:id/read` | user | `markNotificationRead` |
| `POST /notifications/read-all` | user | `markAllNotificationsRead` |

Notifications store **web** hrefs (`/b/<slug>/board?task=<id>`, `/dashboard/requests`).
Give each item a structured `target` field derived on the server so the app can deep-link:
`{ type: "task", workspaceId, taskId } | { type: "requests" } | { type: "url", href }`.
Optionally also store `businessId` / `taskId` on `Notification` going forward.

### 2.4 Done when

- Every route has a request test (Vitest or similar, or at least a checked-in `.http` file) that
  covers 401 with no cookie, 404 for a non-member, 403 for the wrong role, and the happy path.
- `docs/MOBILE-API.md` in the web repo lists every endpoint with example request and response
  JSON. The mobile team builds against this.
- The web works unchanged. Board, dashboard, invites, requests and notifications have all been
  clicked through.

---

## Phase 3 — Before App Store submission

### 3.1 In-app account deletion (Apple guideline 5.1.1(v))

Enable Better Auth's `user.deleteUser` with a `beforeDelete` hook, or implement `DELETE /me`.
- If the user is the **only member** of a workspace, delete that workspace.
- If they **own** a workspace that has other members, refuse with 409 and the message
  "Transfer or delete these workspaces first: …". Workspace ownership transfer doesn't exist yet,
  so the person has to delete the workspace on the web, or we add transfer later.
- If they have an active Stripe subscription from the web, cancel it at the end of the current period.
- Then delete the user. Memberships, assignments, comments and notifications cascade per the schema.

### 3.2 App Review sign-in

Set `REVIEW_EMAIL=appreview@<your-domain>` and `REVIEW_OTP=<6 random digits>` on production.
The reviewer then signs in with email-code using that address and code, with no inbox needed.
Seed that account with one workspace and a few tasks so the reviewer sees real screens.

### 3.3 Sign in with Apple (guideline 4.8)

Because the app offers Google and GitHub sign-in, Apple requires an equivalent privacy-focused
option on iOS. Add the `apple` social provider:
- `clientId` = an Apple **Services ID**, `clientSecret` = the generated JWT,
  `appBundleIdentifier: "com.adviceninja.ninjaloop"`.
- Add `"https://appleid.apple.com"` to `trustedOrigins`.
- The app will use native `expo-apple-authentication` and call
  `signIn.social({ provider: "apple", idToken: { token } })`, so the server must accept
  ID-token sign-in for Apple.

### 3.4 No subscriptions or paywall in the app

For now the mobile app has **no subscription feature and no paywall**. Every signed-in user
gets the full app.
- Don't return subscription or plan data from any `/api/mobile/v1/*` route.
- Don't gate any mobile route on subscription status. If the web ever adds plan limits, keep
  them out of the mobile API until we decide otherwise.
- Leave the web's Stripe setup exactly as it is: `@better-auth/stripe`, pricing and the billing
  portal. `createCustomerOnSignUp` will also create a Stripe customer for people who first sign
  up on mobile. That's harmless, so leave it.

### 3.5 Later: push notifications

Add a `PushDevice { id, userId, expoPushToken @unique, platform, createdAt, lastSeenAt }` model,
plus `POST /devices` and `DELETE /devices/:token`. Send through Expo's push API wherever
`createNotificationInternal` runs. The `due-reminders` cron should send a push too.
