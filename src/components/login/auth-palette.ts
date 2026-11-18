/**
 * The sign-in screens' palette — deliberately NOT the themed tokens.
 *
 * Auth is always light and brand-forward: it's the first impression, shown before
 * we know anything about the user. Everything behind the session guard uses the
 * themed tokens from src/global.css as normal.
 *
 * Same layout family as Ninja CRM / CMS mobile (brand hero + white sheet). Here the
 * brand is Ninja Loop's ocean blue (web --primary oklch(0.42 0.12 245) = #005189)
 * deepening to navy at the fold, with the web's teal accent (--accent = #007F88)
 * marking "next up" in the queue motif.
 */
export const AUTH = {
  /* Hero — brand blue top-left, deep navy at the fold. */
  heroTop: "#005189",
  heroBottom: "#002549",
  heroText: "#FFFFFF",
  heroMuted: "rgba(255,255,255,0.80)",
  heroLine: "rgba(255,255,255,0.22)",
  heroNode: "rgba(255,255,255,0.14)",
  heroNodeText: "rgba(255,255,255,0.55)",

  /* "Next up" — the teal accent, lifted for contrast on navy. */
  next: "#2EC4CC",
  nextGlow: "rgba(46,196,204,0.28)",

  /* Sheet */
  sheet: "#FFFFFF",
  ink: "#0A0F1A",
  inkSoft: "#424854",
  muted: "#6A7180",
  line: "#E4E8F0",
  lineStrong: "#C9CFDB",
  fieldBg: "#F7F8FB",

  /* Brand — the CTA and focus accents. */
  brand: "#005189",
  brandPressed: "#004072",
  brandSoft: "#E1F1FF",

  danger: "#C21725",
  dangerSoft: "#FDF1F2",
  white: "#FFFFFF",
} as const;

/** Font family names — must match src/lib/fonts.ts keys. */
export const AUTH_FONT = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;
