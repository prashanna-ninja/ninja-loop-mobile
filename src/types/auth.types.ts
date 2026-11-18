import type { z } from "zod";

import type { emailSchema } from "@/schemas/auth.schema";

export type EmailInput = z.input<typeof emailSchema>;
export type EmailValues = z.output<typeof emailSchema>;

export type SocialProvider = "google" | "github";

/** What `GET /api/auth/get-session` gives us about the user (admin plugin adds role/banned). */
export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
};
