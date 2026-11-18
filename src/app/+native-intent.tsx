/**
 * Rewrites incoming system links before Expo Router tries to match them.
 *
 * Why: after Google / GitHub sign-in the server sends the browser back to
 * `ninjaloop:///?cookie=…`. expoClient (better-auth) reads the cookie from the
 * auth session itself, but iOS / Android can ALSO hand that link to the router.
 * At that instant the session hasn't flipped yet, so `/` (inside the signed-in
 * group) is guarded off → "Unmatched route". We keep the user on sign-in; the
 * session refetch then moves them to the dashboard via Stack.Protected.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes("cookie=") ? "/sign-in" : path;
}
