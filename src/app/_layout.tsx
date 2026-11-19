import "../global.css";

import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";

import { appFonts } from "@/lib/fonts";
import { loadThemePreference } from "@/lib/theme-preference";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider, useSession } from "@/providers/session-provider";

SplashScreen.preventAutoHideAsync();
// Closes the OAuth browser popup on web after the provider redirects back.
WebBrowser.maybeCompleteAuthSession();

/** Matches the splash background (app.json) so the hand-over is invisible. */
const BOOT_BACKGROUND = "#002549";

function RootNavigator() {
  const colorScheme = useColorScheme();
  // `fontError` lets us fail open (system font) instead of hanging on a bad asset.
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const { data: session, isPending } = useSession();
  const isSignedIn = !!session?.user;
  // Saved Light / Dark / System choice (Settings → Appearance), applied before the
  // splash hides so a forced theme never flashes the system one first.
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    void loadThemePreference().finally(() => setThemeReady(true));
  }, []);

  // Hold until the stored session has resolved, fonts are ready and the theme is applied —
  // otherwise sign-in flashes before the guard redirects a signed-in user.
  const isBooting = isPending || (!fontsLoaded && !fontError) || !themeReady;

  useEffect(() => {
    if (!isBooting) SplashScreen.hideAsync();
  }, [isBooting]);

  if (isBooting) return <View style={{ flex: 1, backgroundColor: BOOT_BACKGROUND }} />;

  // Guarded stacks: only ONE group is reachable at a time. When the session
  // appears/disappears, Expo Router redirects automatically — no manual <Redirect>.
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryProvider>
  );
}
