# Handover — starting prompt for a new session

Copy everything inside the block into a new Claude Code session opened in this folder.

```text
You're continuing work on Ninja Loop Mobile (this repo): an Expo SDK 58 / React Native 0.88 app
for the Ninja Loop web app. Read these first, in order:

1. AGENTS.md — stack, rules and conventions (ref/ is READ-ONLY; screens never fetch directly;
   hooks in src/api/*.api.ts → apiFetch; query keys only in src/lib/query-keys.ts; icons only via
   src/lib/icons.ts; never give a Pressable a function `style`; RN 0.88 ref types).
2. docs/02-STATUS.md — what works, what's left (prioritised), known issues.
3. docs/IMPLEMENTATION-LOG.md — newest entries first; decisions and gotchas.
4. The API: ref/ninja-loop/docs/MOBILE-API.md (run `git -C ref/ninja-loop pull` first if it's
   missing — the local checkout may be behind origin). Types live in src/types/api.types.ts.

State: the production backend (https://www.ninjaloop.com.au, WITH www) has /api/mobile/v1 and
Better Auth 1.7.25 (Apple, Google, GitHub, email OTP). Sign-in is verified on the iOS Simulator.
Built screens: tabs (Dashboard, Alerts, Inbox, Settings), workspace board (workspace/[wid]),
task screen (workspace/[wid]/task/[tid]), members, request update. These were checked visually
against a mock of the API but NOT yet click-tested against production.

Your first task: help me click-test every screen against production on the iOS Simulator and fix
anything that breaks (shape mismatches, errors, layout). Then continue with docs/02-STATUS.md
"Not built yet", starting with Create workspace and Workspace settings.

Working rules:
- Before declaring anything done: npx tsc --noEmit, npx expo lint, and npx expo-doctor.
- Log every meaningful change at the top of docs/IMPLEMENTATION-LOG.md and keep
  docs/02-STATUS.md current.
- If you add a package with native code or change app.json plugins, say so and give me
  `npx expo prebuild --clean && npx expo run:ios`.
- Don't commit unless I ask.
```

## Notes for the human

- Run the app: `npx expo start -c` (after any `.env` change), or a dev build:
  `npx expo prebuild --clean && npx expo run:ios`.
- `.env` → `EXPO_PUBLIC_API_BASE_URL=https://www.ninjaloop.com.au` (eas.json has the same for builds).
- Nothing is committed yet — the first commit is still to be made.
