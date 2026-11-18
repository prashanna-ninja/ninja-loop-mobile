import { z } from "zod";

/**
 * Sign-in form shapes. Types are inferred in src/types/auth.types.ts — never declared twice.
 * A plain regex instead of Zod 4's deprecated `.email()` (same as CRM/CMS mobile).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .refine((value) => EMAIL_REGEX.test(value), "That doesn't look like an email address")
    // better-auth lowercases on the server anyway; doing it here keeps the copy honest.
    .transform((value) => value.toLowerCase()),
});

/** Must match the server's `emailOTP({ otpLength })` — 6 is better-auth's default. */
export const OTP_LENGTH = 6;

/** Server `expiresIn` for the code, in minutes (better-auth default: 300s). Shown on screen. */
export const OTP_TTL_MINUTES = 5;
