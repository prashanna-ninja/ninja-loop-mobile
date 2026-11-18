import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { useSession } from "@/providers/session-provider";
import type { SocialProvider } from "@/types/auth.types";

/** A better-auth error turned into something the sign-in screens can show. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

type BetterAuthError = { message?: string; status?: number; code?: string } | null | undefined;

function throwIfError(error: BetterAuthError) {
  if (error) throw new AuthError(error.message ?? "", error.status, error.code);
}

/**
 * Turn a thrown/returned failure into copy a human can act on. Real-world cases:
 *  - no network / wrong EXPO_PUBLIC_API_BASE_URL → fetch rejects with a TypeError
 *  - INVALID_OTP / OTP_EXPIRED / TOO_MANY_ATTEMPTS (emailOTP plugin)
 *  - 403 banned (admin plugin) or origin not trusted (server missing `ninjaloop://`)
 *  - 429 better-auth rate limit
 */
export function describeAuthError(err: unknown): string {
  if (err instanceof AuthError) {
    const { status, code, message } = err;
    if (code === "INVALID_OTP") return "That code isn't right. Check the email and try again.";
    if (code === "OTP_EXPIRED") return "That code has expired. Send yourself a new one.";
    if (code === "TOO_MANY_ATTEMPTS") return "Too many wrong codes. Send yourself a new one.";
    if (code === "BANNED_USER" || /banned/i.test(message)) {
      return "This account has been suspended. Contact your workspace owner.";
    }
    if (status === 429 || /too many/i.test(message)) {
      return "Too many attempts. Wait a moment, then try again.";
    }
    if (/origin/i.test(message) || code === "INVALID_ORIGIN") {
      return "Sign-in isn't configured for this app yet. Please contact support.";
    }
    return message || "Something went wrong. Please try again.";
  }

  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return "Can't reach Ninja Loop. Check your connection and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

/**
 * Google / GitHub via the system browser. expoClient opens an auth session,
 * the server redirects back to `ninjaloop://` with the cookie, and the plugin
 * stores it. A relative callbackURL is turned into the app deep link by expoClient.
 * Cancelling the browser sheet resolves without a session — refetch() then just
 * leaves the user on sign-in, no error shown.
 */
export function useSocialSignIn() {
  const { refetch } = useSession();

  return useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const { error } = await authClient.signIn.social({ provider, callbackURL: "/" });
      throwIfError(error);
    },
    // Flipping the session makes Stack.Protected move to (app) — no manual navigation.
    onSuccess: () => refetch(),
  });
}

/** POST /api/auth/email-otp/send-verification-otp (type "sign-in"). */
export function useSendEmailCode() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
      throwIfError(error);
    },
  });
}

/** POST /api/auth/sign-in/email-otp → cookie stored in SecureStore → session refetched. */
export function useVerifyEmailCode() {
  const { refetch } = useSession();

  return useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const { error } = await authClient.signIn.emailOtp({ email, otp });
      throwIfError(error);
    },
    onSuccess: () => refetch(),
  });
}
