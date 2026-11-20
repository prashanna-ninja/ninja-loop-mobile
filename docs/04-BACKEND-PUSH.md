# Backend request — push notifications (Expo + Upstash QStash)

**For:** the Ninja Loop web repo (`ninja_loop_web`, Next 16 / Prisma 7 / Postgres / Vercel).
**Ported from:** Ninja CRM (`ninja_crm` branch `fix/pushNotifications` — `lib/push/*`,
`app/api/push/*`), which is live and verified on devices. Most files copy over **unchanged**;
the Ninja-Loop-specific parts (schema, categories, the outbox hook, target resolution) are
written out in full below.

**The app side is built** (`src/providers/push-provider.tsx`, `src/api/push.api.ts`,
`src/components/notifications/push-bridge.tsx`). Until this ships the app's calls get 404 and it
says "On — the server isn't sending pushes yet" (it fails quietly by design).

> ⚠️ Shapes marked **contract** are what the shipped app sends / reads. Change one and push
> silently stops working with no error anywhere.

---

## How it works

```
createNotificationInternal()           (task assigned / comment / priority request / due tomorrow)
  ├─ INSERT notification      ┐ one transaction — a push can never exist for a
  └─ INSERT push_delivery     ┘ notification that rolled back (the "outbox")
  └─ after(): qstash.publish ──► POST /api/push/worker      (QStash, signed)
                                  ├─ claim rows (FOR UPDATE SKIP LOCKED)
                                  ├─ devices of each user, filtered by category switch
                                  ├─ POST exp.host/--/api/v2/push/send  (Expo → APNs / FCM)
                                  └─ qstash.publish(delay 15 min) ──► POST /api/push/receipts
                                                                       └─ DeviceNotRegistered → delete device
```

Why QStash: Vercel can't run a long-lived worker, and cron is too coarse (≥1 min). QStash calls
an ordinary route with retries. Why keep the outbox row: if QStash is down the row survives and
the next drain sends it. Without `QSTASH_TOKEN` (local dev) it drains inline instead.

---

## Step 0 — What you need (new accounts / keys)

| Need | Where | Used for |
| --- | --- | --- |
| **Upstash QStash** | console.upstash.com → QStash (free tier: 500 msgs/day) | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` |
| **Expo access token** | expo.dev → Account settings → Access tokens | `EXPO_ACCESS_TOKEN` — without it anyone with a device token can push to it |
| **EAS project for the app** | mobile repo: `npx eas-cli init` | writes `extra.eas.projectId` to app.json — the app can't get a push token without it |
| **APNs key (iOS)** | mobile repo: `npx eas-cli credentials -p ios` → Push Notifications → let EAS create it | Expo → Apple delivery. Same Apple team you already pay for |
| **Firebase project (Android only)** | console.firebase.google.com | `google-services.json` in the app + FCM V1 service-account key uploaded to EAS |

Reuse from Ninja CRM: the **same Upstash account** (a second QStash token isn't needed — the
token is per account; one project can serve both apps) and the **same Expo account** (one
access token works for every project in it — or create a separate one to revoke independently).
Same Apple team → EAS can reuse the existing APNs key for a second bundle id.

---

## Step 1 — Install

```bash
pnpm add @upstash/qstash
```

## Step 2 — Environment (Vercel → Project → Settings → Environment Variables, + `.env.local`)

```bash
QSTASH_TOKEN=...                 # publish
QSTASH_CURRENT_SIGNING_KEY=...   # verify QStash → our routes
QSTASH_NEXT_SIGNING_KEY=...      # key rotation
EXPO_ACCESS_TOKEN=...            # authenticate sends to Expo
# NEXT_PUBLIC_APP_URL already exists — MUST be https://www.ninjaloop.com.au (with www: the bare
# domain 307s, and QStash does not follow redirects on POST).
```

---

## Step 3 — Schema (`prisma/schema.prisma`)

```prisma
/// A phone registered for push. The token is the identity, not the user: one row per
/// device. Deleting the row IS the off switch — no row, no push.
model PushDevice {
  id         String   @id @default(cuid())
  userId     String
  /// Expo token, "ExponentPushToken[…]".
  token      String   @unique
  platform   String   // "ios" | "android"
  deviceName String?

  /// Per-category switches — columns (not JSON) so the sender filters in SQL.
  /// ⚠️ Defaults MUST match DEFAULT_PUSH_PREFERENCES in the app (src/lib/push-categories.ts).
  prefAssigned Boolean @default(true)
  prefComments Boolean @default(true)
  prefRequests Boolean @default(true)
  prefDue      Boolean @default(true)

  createdAt  DateTime @default(now())
  lastSeenAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_device")
}

/// Outbox: one row per pushable notification, written in the SAME transaction.
model PushDelivery {
  id             String    @id @default(cuid())
  notificationId String
  userId         String
  status         String    @default("queued") // queued | sending | sent | skipped
  attempts       Int       @default(0)
  error          String?
  createdAt      DateTime  @default(now())
  sentAt         DateTime?

  @@index([status, createdAt])
  @@map("push_delivery")
}

/// One Expo ticket awaiting its receipt (one delivery → N devices → N tickets).
model PushTicket {
  id         String   @id @default(cuid())
  ticketId   String   @unique
  token      String
  deliveryId String
  createdAt  DateTime @default(now())

  @@index([deliveryId])
  @@map("push_ticket")
}
```

On `model User` add: `pushDevices PushDevice[]`.

This repo uses migrations (since `0_init`):

```bash
npx prisma migrate dev --name push_notifications   # local: creates + applies the migration
npx prisma migrate deploy                          # production (additive only: 3 new tables)
```

---

## Step 4 — `lib/push/categories.ts` (**contract**)

```ts
/** Mirrors src/lib/push-categories.ts in the app. Keep the two in step. */
export type PushCategory = "assigned" | "comments" | "requests" | "due";

const KIND_TO_CATEGORY: Record<string, PushCategory> = {
  task_assigned: "assigned",
  task_comment: "comments",
  priority_request: "requests",
  task_due: "due",
};

/** null = in-app only, never pushed. */
export function pushCategoryForKind(kind: string): PushCategory | null {
  return KIND_TO_CATEGORY[kind] ?? null;
}

export const CATEGORY_COLUMN = {
  assigned: "prefAssigned",
  comments: "prefComments",
  requests: "prefRequests",
  due: "prefDue",
} as const satisfies Record<PushCategory, string>;

/** App body → columns. ⚠️ Fallbacks = the column defaults = the app's defaults (all true). */
export function preferenceColumns(p: Partial<Record<PushCategory, boolean>> = {}) {
  return {
    prefAssigned: p.assigned ?? true,
    prefComments: p.comments ?? true,
    prefRequests: p.requests ?? true,
    prefDue: p.due ?? true,
  };
}
```

---

## Step 5 — Device endpoints (**contract**, under the mobile API)

`app/api/mobile/v1/devices/route.ts`:

```ts
import { z } from "zod";
import prisma from "@/lib/prisma";
import { mobileRoute } from "@/lib/mobile-api";
import { preferenceColumns } from "@/lib/push/categories";

export const dynamic = "force-dynamic";

const prefs = z.object({
  assigned: z.boolean(), comments: z.boolean(), requests: z.boolean(), due: z.boolean(),
}).partial();

const body = z.object({
  token: z.string().min(1).max(255),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().max(120).nullish(),
  preferences: prefs.default({}),
});

/** POST /devices — register or refresh this phone. Called on every app launch while push is on. */
export const POST = mobileRoute(async ({ req, user }) => {
  const d = body.parse(await req.json());
  // ⚠️ Overwrite userId on conflict: the token follows the PHONE. Sign out, someone else
  // signs in on it → same token, new user. Keeping the old owner would send them the new
  // user's notifications. (The app also deletes the row on sign-out — never rely on that.)
  const data = {
    userId: user.id,
    platform: d.platform,
    deviceName: d.deviceName ?? null,
    lastSeenAt: new Date(),
    ...preferenceColumns(d.preferences),
  };
  await prisma.pushDevice.upsert({ where: { token: d.token }, create: { token: d.token, ...data }, update: data });
  // undefined → 204
});
```

`app/api/mobile/v1/devices/[token]/route.ts`:

```ts
import { z } from "zod";
import prisma from "@/lib/prisma";
import { mobileRoute } from "@/lib/mobile-api";
import { preferenceColumns } from "@/lib/push/categories";

export const dynamic = "force-dynamic";
type P = { token: string };

const prefs = z.object({
  assigned: z.boolean(), comments: z.boolean(), requests: z.boolean(), due: z.boolean(),
}).partial();

/** PATCH /devices/:token { preferences } — the category switches. Own devices only. */
export const PATCH = mobileRoute<P>(async ({ req, user, params }) => {
  const { preferences } = z.object({ preferences: prefs }).parse(await req.json());
  await prisma.pushDevice.updateMany({
    where: { token: decodeURIComponent(params.token), userId: user.id },
    data: preferenceColumns(preferences),
  });
});

/** DELETE /devices/:token — push off / sign-out. A missing row is not an error. */
export const DELETE = mobileRoute<P>(async ({ user, params }) => {
  await prisma.pushDevice.deleteMany({ where: { token: decodeURIComponent(params.token), userId: user.id } });
});
```

> The app URL-encodes the token (`ExponentPushToken%5B…%5D`). Next already decodes `params`
> once; `decodeURIComponent` on an already-decoded token is harmless (no `%` in Expo tokens).

**Ship Steps 1–5 alone if you like:** the app stops 404ing, Settings says "On for this phone",
and devices start registering before anything sends.

---

## Step 6 — Copy from Ninja CRM unchanged

| Copy | From `ninja_crm/` | Notes |
| --- | --- | --- |
| `lib/push/expo.ts` | `lib/push/expo.ts` | Expo HTTP send (≤100 / request) + receipts. No SDK |
| `lib/push/queue.ts` | `lib/push/queue.ts` | QStash publish + signature verify. Uses `NEXT_PUBLIC_BASE_URL` **or** `NEXT_PUBLIC_APP_URL` — fine as is |
| `app/api/push/worker/route.ts` | same path | Verifies the QStash signature, calls `drainPushOutbox()` |
| `app/api/push/receipts/route.ts` | same path | Change `prisma.pushToken` → **`prisma.pushDevice`** (the dead-token `deleteMany`) |

There's no `middleware.ts` / `proxy.ts` in this repo, so `/api/push/*` is already public (it must
be: QStash calls it; the signature check is the auth).

---

## Step 7 — `lib/push/worker-core.ts` (adapted) + the payload **contract**

First, move the slug → workspace-id resolution out of `listNotificationsPage`
(`lib/services/notification.ts`) so pushes and the Alerts list compute `target` identically:

```ts
/** Same `target` as GET /notifications — for the list AND push payloads. */
export async function resolveNotificationTargets(
  userId: string,
  rows: { href: string | null }[],
): Promise<(NotificationTarget | null)[]> {
  const parsed = rows.map((r) => (r.href ? parseNotificationHref(r.href) : null));
  const slugs = [...new Set(parsed.flatMap((p) => (p?.kind === "board" ? [p.slug] : [])))];
  const memberships = slugs.length
    ? await prisma.membership.findMany({
        where: { userId, business: { slug: { in: slugs } } },
        select: { business: { select: { id: true, slug: true } } },
      })
    : [];
  const idBySlug = new Map(memberships.map((m) => [m.business.slug, m.business.id]));
  return rows.map((r, i) => {
    const p = parsed[i];
    if (p?.kind === "requests") return { type: "requests" };
    if (p?.kind === "board" && idBySlug.has(p.slug)) {
      return { type: "task", workspaceId: idBySlug.get(p.slug)!, taskId: p.taskId };
    }
    return r.href ? { type: "url", href: r.href } : null;
  });
}
```

…and in `listNotificationsPage` replace the block from `// Resolve board slugs` to the end with:

```ts
  const targets = await resolveNotificationTargets(actor.id, page);
  return { items: page.map((r, i) => ({ ...r, target: targets[i] })), nextCursor };
```

`lib/push/worker-core.ts`:

```ts
import prisma from "@/lib/prisma";
import { CATEGORY_COLUMN, pushCategoryForKind } from "@/lib/push/categories";
import { sendExpoPush, type ExpoPushMessage } from "@/lib/push/expo";
import { enqueueReceiptCheck } from "@/lib/push/queue";
import { resolveNotificationTargets } from "@/lib/services/notification";

const MAX_ATTEMPTS = 5; // then the claim stops selecting it — dead letter
const CLAIM_LIMIT = 100;

export async function drainPushOutbox() {
  // Atomic claim: concurrent drains take DIFFERENT rows. ⚠️ "createdAt" quoted — Prisma maps the
  // table name to snake_case but columns stay camelCase (CRM hit this).
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE push_delivery SET status = 'sending', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM push_delivery
      WHERE status = 'queued' AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" LIMIT ${CLAIM_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  if (claimed.length === 0) return { claimed: 0, sent: 0, skipped: 0, dead: 0 };

  const deliveries = await prisma.pushDelivery.findMany({ where: { id: { in: claimed.map((r) => r.id) } } });
  const notifications = await prisma.notification.findMany({
    where: { id: { in: deliveries.map((d) => d.notificationId) } },
  });
  const byId = new Map(notifications.map((n) => [n.id, n]));
  const userIds = [...new Set(deliveries.map((d) => d.userId))];

  const devices = await prisma.pushDevice.findMany({ where: { userId: { in: userIds } } });
  const unread = await prisma.notification.groupBy({
    by: ["userId"], where: { userId: { in: userIds }, readAt: null }, _count: { _all: true },
  });
  const unreadBy = new Map(unread.map((u) => [u.userId, u._count._all]));

  // target per notification, resolved per user (membership decides task vs url).
  const targetById = new Map<string, unknown>();
  for (const uid of userIds) {
    const rows = deliveries.filter((d) => d.userId === uid).map((d) => byId.get(d.notificationId))
      .filter((n): n is NonNullable<typeof n> => !!n);
    const targets = await resolveNotificationTargets(uid, rows);
    rows.forEach((n, i) => targetById.set(n.id, targets[i]));
  }

  const messages: ExpoPushMessage[] = [];
  const origin: { deliveryId: string; token: string }[] = []; // parallel to messages
  const skipped: string[] = [];

  for (const d of deliveries) {
    const n = byId.get(d.notificationId);
    const category = n ? pushCategoryForKind(n.kind) : null;
    const column = category ? CATEGORY_COLUMN[category] : null;
    const eligible = column ? devices.filter((dev) => dev.userId === d.userId && dev[column]) : [];
    if (!n || eligible.length === 0) {
      skipped.push(d.id);
      continue;
    }
    for (const dev of eligible) {
      messages.push({
        to: dev.token,
        title: n.title,
        body: n.body ?? "",
        sound: "default",
        badge: unreadBy.get(d.userId) ?? 0,
        channelId: "default", // the app creates this Android channel
        priority: "high",
        // ⚠️ CONTRACT — read by the app's push-bridge.tsx.
        data: { notificationId: n.id, kind: n.kind, target: targetById.get(n.id) ?? null },
      });
      origin.push({ deliveryId: d.id, token: dev.token });
    }
  }

  if (skipped.length) {
    await prisma.pushDelivery.updateMany({ where: { id: { in: skipped } }, data: { status: "skipped", sentAt: new Date() } });
  }
  if (messages.length === 0) return { claimed: claimed.length, sent: 0, skipped: skipped.length, dead: 0 };

  const sendingIds = [...new Set(origin.map((o) => o.deliveryId))];
  let tickets;
  try {
    tickets = await sendExpoPush(messages);
  } catch (error) {
    await prisma.pushDelivery.updateMany({
      where: { id: { in: sendingIds } },
      data: { status: "queued", error: error instanceof Error ? error.message : "send failed" },
    });
    throw error; // worker route → 500 → QStash retries
  }

  const ticketRows: { ticketId: string; token: string; deliveryId: string }[] = [];
  const dead: string[] = [];
  tickets.forEach((t, i) => {
    const o = origin[i];
    if (!o) return;
    if (t.status === "ok") ticketRows.push({ ticketId: t.id, token: o.token, deliveryId: o.deliveryId });
    else if (t.details?.error === "DeviceNotRegistered") dead.push(o.token);
    else console.error("[push] ticket error:", t.message);
  });
  if (ticketRows.length) await prisma.pushTicket.createMany({ data: ticketRows, skipDuplicates: true });
  if (dead.length) await prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
  await prisma.pushDelivery.updateMany({ where: { id: { in: sendingIds } }, data: { status: "sent", sentAt: new Date() } });
  await enqueueReceiptCheck(ticketRows.map((r) => r.ticketId));

  return { claimed: claimed.length, sent: ticketRows.length, skipped: skipped.length, dead: dead.length };
}
```

---

## Step 8 — Hook it into `createNotificationInternal`

`lib/push/trigger.ts`:

```ts
import { after } from "next/server";
import { enqueuePushDrain, isQueueConfigured } from "@/lib/push/queue";
import { drainPushOutbox } from "@/lib/push/worker-core";

async function dispatch() {
  if (isQueueConfigured() && (await enqueuePushDrain())) return;
  // No queue (local dev) or QStash down: drain here. Never throws into the caller.
  await drainPushOutbox().catch((e) => console.error("[push] inline drain failed:", e));
}

/**
 * Publishing costs ~200 ms (measured on CRM) — no web request should wait for someone else's
 * push, so it runs in after() (post-response; Vercel keeps the function alive). after() throws
 * outside a request (cron, scripts) → run inline.
 */
export async function triggerPushDrain() {
  try {
    after(dispatch);
  } catch {
    await dispatch();
  }
}
```

`lib/services/notification.ts` — replace `createNotificationInternal`'s body:

```ts
import { pushCategoryForKind } from "@/lib/push/categories";
import { triggerPushDrain } from "@/lib/push/trigger";

export async function createNotificationInternal({ userId, kind, title, body, href }: { … as today … }) {
  const pushes = pushCategoryForKind(kind) !== null;
  await prisma.$transaction(async (tx) => {
    const n = await tx.notification.create({
      data: { userId, kind, title, body: body ?? null, href: href ?? null },
      select: { id: true },
    });
    if (pushes) await tx.pushDelivery.create({ data: { notificationId: n.id, userId } });
  });
  if (pushes) await triggerPushDrain();
}
```

⚠️ **Await the producers.** All three call sites currently fire-and-forget
(`void createNotificationInternal(…).catch(() => undefined)`): `lib/services/task.ts` (comment
~L300, assignee ~L350) and `lib/services/priority-request.ts` (~L110). `after()` must be
registered while the request is still running, and on Vercel an un-awaited promise can be killed
when the response returns. Change each to:

```ts
await createNotificationInternal({ … }).catch(() => undefined);
```

(≈10 ms each: two inserts in one transaction; the QStash publish itself is deferred by `after()`.)

---

## Step 9 — "Due tomorrow" pushes (`lib/actions/due-reminders.ts`)

Today the cron only emails. Add a `task_due` notification for the same assignee, so it shows in
Alerts **and** pushes:

```ts
// select: assignees → include: { user: { select: { id: true, email: true, name: true } } }
for (const task of candidates) {
  const assignee = task.assignees[0]?.user;
  if (!assignee) { skipped++; continue; }
  const taskUrl = `${base}/b/${task.business.slug}/board?task=${task.id}`;

  await createNotificationInternal({
    userId: assignee.id,
    kind: "task_due",
    title: `Due tomorrow: ${task.title.slice(0, 80)}`,
    body: `In ${task.business.name}.`,
    href: taskUrl,
  }).catch(() => undefined);

  const r = assignee.email ? await sendDueReminderEmail({ … as today … }) : { ok: false };
  // Mark sent either way now — the in-app notification went out even if the email didn't.
  await prisma.task.update({ where: { id: task.id }, data: { dueReminderSentAt: now } });
  if (r.ok) sent++; else skipped++;
}
```

Also check the cron is actually **scheduled** — there's no `vercel.json` in the repo. Either add
`{ "crons": [{ "path": "/api/cron/due-reminders", "schedule": "0 22 * * *" }] }` (22:00 UTC ≈
08:00–09:00 Sydney; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically) or create a
**QStash schedule** for that URL with header `Authorization: Bearer <CRON_SECRET>`.

Add `task_due` to MOBILE-API.md's list of `kind` values.

---

## Step 10 — MOBILE-API.md (replace "Push notifications (not built yet)")

```md
### Devices (push)

| Call | Result |
| --- | --- |
| `POST /devices` `{ token, platform: "ios"\|"android", deviceName?, preferences? }` | `204`. Upsert on `token`; re-owns the token for the signed-in user. Call on every launch while push is on. |
| `PATCH /devices/:token` `{ preferences }` | `204`. Own devices only. |
| `DELETE /devices/:token` | `204`. Push off / sign-out. Missing row = no-op. |

`preferences`: `{ assigned, comments, requests, due }` booleans, all default `true`.
`kind` → category: task_assigned → assigned, task_comment → comments, priority_request → requests,
task_due → due. Push `data`: `{ notificationId, kind, target }` (`target` as in GET /notifications).
```

---

## Step 11 — Credentials

**iOS (do first):**
1. Mobile repo: `npx eas-cli init` → commit the `extra.eas.projectId` it adds to app.json.
2. `npx eas-cli credentials -p ios` → bundle `com.adviceninja.ninjaloop` → **Push Notifications:
   Manage your Apple Push Notifications Key** → create / reuse one. (An `eas build` also offers this.)
3. `npx expo prebuild --clean && npx expo run:ios --device` (the build now has the
   `aps-environment` entitlement from the expo-notifications plugin).

**Android (when you ship Android):**
1. Firebase console → Add app → Android → package **exactly** `com.adviceninja.ninjaloop` →
   download `google-services.json` to the mobile repo root, add `"googleServicesFile": "./google-services.json"`
   under `android` in app.json, commit it (it ships inside every APK; not a secret).
2. Firebase → Project settings → Service accounts → **Generate new private key** →
   `npx eas-cli credentials -p android` → Push Notifications (FCM V1) → upload. ⚠️ This one IS a
   secret — never commit it.
3. Rebuild.

---

## Step 12 — Testing

1. **Device first:** Settings → Notifications → on. Get the token (it's logged as
   `ExponentPushToken[…]` if you add a `console.log`, or read it from `push_device`), paste it at
   **expo.dev/notifications** and send. Nothing arrives → APNs / EAS credentials, not the backend.
2. Registration: `select "userId", platform, "deviceName", "lastSeenAt" from push_device;`
3. End to end (needs **two accounts** — you're never notified about your own actions): A assigns
   B to a task → B's phone buzzes → tap → the task opens; badge = B's unread count.
4. Category off: B turns off "Assigned to me" → assign again → Alerts row appears, no push
   (`push_delivery.status = 'skipped'`).
5. Comment (B assigned, A comments), priority request (B → owner A), due tomorrow (task due
   tomorrow assigned to B, hit the cron URL with the bearer secret).
6. Sign out on B → the `push_device` row is gone.
7. Uninstall → send → within ~15 min the receipt pass deletes the row.

Optional (CRM has it): a `scripts/push-test.ts` that sends to a user's devices by email and
`--drain`s the outbox by hand — copy `ninja_crm/scripts/push-test.ts` and swap the model / fields.

## Step 13 — Before the stores

- **App Privacy:** a push token is an identifier linked to the user → Identifiers → **Device ID**,
  App Functionality, linked, **not** tracking.
- Privacy policy: one line — device tokens are stored to deliver notifications.
- Review notes: the reviewer can't practically receive pushes; Alerts shows the same items.
- The app works fully with push declined (Alerts tab).
