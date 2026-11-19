import { parseInviteToken, setPendingInvite } from "@/lib/pending-invite";

/**
 * Rewrites incoming system links before Expo Router tries to match them.
 *
 * 1. OAuth return: after Google / GitHub sign-in the server sends the browser back to
 *    `ninjaloop:///?cookie=…`. expoClient (better-auth) reads the cookie from the
 *    auth session itself, but iOS / Android can ALSO hand that link to the router.
 *    At that instant the session hasn't flipped yet, so `/` (inside the signed-in
 *    group) is guarded off → "Unmatched route". We keep the user on sign-in; the
 *    session refetch then moves them to the dashboard via Stack.Protected.
 * 2. Invite links (`https://www.ninjaloop.com.au/invite/<token>` universal link, or
 *    `ninjaloop://invite/<token>`): park the token and go to `/`. The signed-in layout
 *    opens the invite screen — immediately, or right after sign-in if signed out
 *    (the invite route itself is guarded off while signed out). See lib/pending-invite.ts.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (path.includes("cookie=")) return "/sign-in";
  if (/(^|\/)invite\//.test(path)) {
    const token = parseInviteToken(path);
    if (token) {
      setPendingInvite(token);
      return "/";
    }
  }
  return path;
}
