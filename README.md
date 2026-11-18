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
| Auth | better-auth 1.7.25 + `@better-auth/expo` — Google, GitHub, email one-time code |
| Forms | react-hook-form + zod |
| Font | Plus Jakarta Sans (same as the web) |

## Getting started

```bash
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_BASE_URL (LAN IP / tunnel, not localhost)
npx expo start -c
```

- **Email-code sign-in works in Expo Go.** Google/GitHub need the server's Phase 1 changes and,
  for the `ninjaloop://` redirect, a development build: `npx expo run:ios` / `run:android`
  (or `npx eas-cli@latest build --profile development`).
- Checks before committing: `npm run typecheck && npm run lint && npm run doctor`.

## Layout

```
src/
├── app/            routes only — (auth)/sign-in, (auth)/verify-code, (app)/…
├── api/            <domain>.api.ts — TanStack hooks (screens never fetch directly)
├── components/     ui/ (RNR primitives), login/, brand/, shared shells
├── constants/      env.ts (EXPO_PUBLIC_* only)
├── hooks/          use-keyboard …
├── lib/            auth-client, api-client, query-client, query-keys, icons, fonts, utils
├── providers/      query-provider, session-provider
├── schemas/        zod schemas    └── types/   inferred TS types
docs/
├── 01-BACKEND-PROMPT.md   what the backend must add (auth + /api/mobile/v1)
└── IMPLEMENTATION-LOG.md  decisions, newest first
```
