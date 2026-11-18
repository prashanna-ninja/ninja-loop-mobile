import { useColorScheme } from "react-native";

/**
 * Raw colour values for the few places that can't take a className — icon
 * `color` props, the tab bar, RefreshControl, ActivityIndicator.
 * MUST mirror the HSL tokens in src/global.css (same values, as hex).
 * Everything else uses NativeWind classes (`text-primary`, `bg-card`, …).
 */
const light = {
  background: "#F7F8FB",
  card: "#FFFFFF",
  foreground: "#0A0F1A",
  muted: "#EDF0F6",
  mutedForeground: "#424854",
  subtle: "#7A8191",
  border: "#D0D4DE",
  primary: "#005189",
  primarySoft: "#E1F1FF",
  accent: "#007F88",
  destructive: "#C21725",
  success: "#1C882D",
  /* Due-date urgency (web lib/due-date-urgency.ts: amber / orange / sky). */
  today: "#B45309",
  tomorrow: "#C2410C",
  thisWeek: "#0369A1",
};

const dark: typeof light = {
  background: "#090D16",
  card: "#111620",
  foreground: "#F7F5EE",
  muted: "#1F242E",
  mutedForeground: "#A8A597",
  subtle: "#7D7A6E",
  border: "#2B3342",
  primary: "#4DACF6",
  primarySoft: "#0E2A44",
  accent: "#00AEB5",
  destructive: "#E8575B",
  success: "#4CC35E",
  today: "#FBBF24",
  tomorrow: "#FB923C",
  thisWeek: "#38BDF8",
};

export type ThemeColors = typeof light;

export const PALETTE = { light, dark };

/** Theme colours for the current system appearance. */
export function useThemeColors(): ThemeColors {
  return useColorScheme() === "dark" ? dark : light;
}
