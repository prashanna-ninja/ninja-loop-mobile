# Ninja Loop — Mobile

The iOS/Android app for **Ninja Loop**: priority workspaces where the top of the queue is
what's next. Built with **Expo SDK 58 + React Native**, against the existing Ninja Loop
Next.js backend (same database, same Better Auth accounts).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Expo SDK 58 (React Native 0.88, React 19.3, New Architecture, React Compiler) |
| Navigation | Expo Router (`src/app`, file-based) with `Stack.Protected` auth guard |
| Styling | NativeWind 4 (Tailwind 3) + React Native Reusables (`src/components/ui`) |
| Data | TanStack Query v5 → `apiFetch` → `/api/mobile/v1/*` |
| Auth | better-auth 1.7.25 + `@better-auth/expo` — Apple (iOS), Google, GitHub, email one-time code |
| Forms | react-hook-form + zod |
| Font | Plus Jakarta Sans (same as the web) |

## Getting started

```bash
npm install
cp .env.example .env        # production backend: https://www.ninjaloop.com.au (with www)
npx expo start -c
```

- Backend: the Ninja Loop Next.js app, `/api/mobile/v1/*` (reference: `ref/ninja-loop/docs/MOBILE-API.md`).
- **Email-code sign-in works in Expo Go.** Google / GitHub / Apple need a development build
  (`npx expo prebuild --clean && npx expo run:ios`, or `npx eas-cli@latest build --profile development`).
  Apple sign-in needs a real Apple Account signed in on the device / Simulator.
- Checks before committing: `npm run typecheck && npm run lint && npm run doctor`.

## Layout

```
src/
├── app/            routes only — (auth)/sign-in, verify-code · (app)/(tabs)/… ·
│                   (app)/workspace/[wid] (board), …/task/[tid], …/members, …/request
├── api/            <domain>.api.ts — TanStack hooks (screens never fetch directly)
├── components/     ui/ (RNR primitives), login/, brand/, shared shells
├── constants/      env.ts (EXPO_PUBLIC_* only)
├── hooks/          use-keyboard …
├── lib/            auth-client, api-client, query-client, query-keys, icons, fonts, utils
├── providers/      query-provider, session-provider
├── schemas/        zod schemas    └── types/   inferred TS types
docs/
├── 01-BACKEND-PROMPT.md   what we asked the backend for (done — backend PR #3)
├── 02-STATUS.md           what works, what's left, known issues
├── HANDOVER.md            starting prompt for a new session
└── IMPLEMENTATION-LOG.md  decisions, newest first
```
