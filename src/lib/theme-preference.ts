import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
import * as React from "react";

/**
 * Appearance preference: follow the phone, or force light / dark.
 *
 * How it applies everywhere at once: NativeWind's `colorScheme.set()` calls RN's
 * `Appearance.setColorScheme()`, which overrides the app's appearance. That flips
 * NativeWind's `dark:` tokens (global.css), RN's `useColorScheme()` (→ `useThemeColors`,
 * the navigation theme, status bars) and native UI (alerts, keyboard) together.
 * So screens never read this preference — they keep using `useThemeColors()` / classes.
 *
 * Stored in SecureStore (already in the app; no new native module). Not a secret,
 * just the one small key-value store we have. Web (preview only) keeps the default.
 */
export type ThemePreference = "system" | "light" | "dark";

const KEY = "ninjaloop.theme";
const VALID: readonly ThemePreference[] = ["system", "light", "dark"];

let current: ThemePreference = "system";
const listeners = new Set<() => void>();

function apply(pref: ThemePreference) {
  current = pref;
  try {
    colorScheme.set(pref);
  } catch {
    // Web / tests: no Appearance override — the system scheme stays in charge.
  }
  listeners.forEach((l) => l());
}

/** Read the saved preference and apply it. Call once at boot, before the splash hides. */
export async function loadThemePreference(): Promise<void> {
  try {
    const saved = (await SecureStore.getItemAsync(KEY)) as ThemePreference | null;
    if (saved && VALID.includes(saved) && saved !== "system") apply(saved);
  } catch {
    // No SecureStore (web) or unreadable → keep following the system.
  }
}

/** Apply now, then persist (a failed write just means it resets next launch). */
export function setThemePreference(pref: ThemePreference) {
  if (pref === current) return;
  apply(pref);
  SecureStore.setItemAsync(KEY, pref).catch(() => {});
}

/** The saved preference ("system" | "light" | "dark") — for the Settings picker. */
export function useThemePreference(): ThemePreference {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
