# Backend request — open invite links in the app (universal links / app links)

**For:** the Ninja Loop web repo (`ref/ninja-loop`). Two static JSON files.
**Why:** invite emails link to `https://www.ninjaloop.com.au/invite/<token>`. With these files
served, tapping that link on a phone with the app installed opens the **app's** invite screen
instead of the browser. Without the app, the link keeps opening the web page as today; nothing
else changes on the web.

The app side is done (app.json `ios.associatedDomains` = `applinks:www.ninjaloop.com.au`,
Android `intentFilters` for `https://www.ninjaloop.com.au/invite/*` with `autoVerify`).

## 1. iOS — `/.well-known/apple-app-site-association`

`app/.well-known/apple-app-site-association/route.ts`:

```ts
export const dynamic = "force-static";

// Apple Team ID: developer.apple.com → Account → Membership details (10 chars, e.g. "AB12CD34EF").
const APP_ID = "<TEAM_ID>.com.adviceninja.ninjaloop";

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [APP_ID],
          components: [{ "/": "/invite/*", comment: "Workspace invites open in the app" }],
        },
      ],
    },
  });
}
```

Requirements (Apple is strict):
- Served at exactly `https://www.ninjaloop.com.au/.well-known/apple-app-site-association`
  (no `.json`), **HTTP 200, no redirect**, `Content-Type: application/json`.
- Must NOT be behind auth / middleware redirects (check any `middleware.ts` / `proxy.ts` matcher).
- Apple fetches it through its CDN when the app is installed, so changes can take a while to
  show. Check: `https://app-site-association.cdn-apple.com/a/v1/www.ninjaloop.com.au`.

## 2. Android — `/.well-known/assetlinks.json`

`app/.well-known/assetlinks.json/route.ts`:

```ts
export const dynamic = "force-static";

// SHA-256 of the app signing certificate(s): `npx eas-cli credentials -p android`
// (and the Play Console "App signing key" once it's on Play). Add both if they differ.
const FINGERPRINTS = ["<SHA256_FINGERPRINT>"];

export function GET() {
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "com.adviceninja.ninjaloop", sha256_cert_fingerprints: FINGERPRINTS },
    },
  ]);
}
```

Same rules: 200, no redirect, `application/json`, public.

## 3. Nothing else

- The web `/invite/[token]` page stays exactly as it is: it's the fallback without the app.
- The mobile API already has `GET /invites/:token` and `POST /invites/:token/accept`.

## Testing (after deploy)

- `curl -sI https://www.ninjaloop.com.au/.well-known/apple-app-site-association` → `200`, JSON.
- iOS: install a build made **after** the app.json change (`npx expo prebuild --clean`), send
  yourself an invite, tap the link in Mail → the app opens on "Invitation". (Links typed into
  Safari's address bar never open apps; tap them from Mail / Notes / Messages.)
- Android: `adb shell pm get-app-links com.adviceninja.ninjaloop` → `verified` for the domain.
