import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Platform, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthHero } from "@/components/login/auth-hero";
import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { FadeIn } from "@/components/login/fade-in";
import { PRIVACY_URL, TERMS_URL } from "@/constants/env";
import { useKeyboard } from "@/hooks/use-keyboard";

/** Room kept visible BELOW the focused field when the keyboard is up (next field / CTA). */
const REVEAL_BELOW = 150;
/** Gap kept between the keyboard's top edge and the revealed content. */
const KEYBOARD_GAP = 12;

/** Lets any field inside <AuthScreen> ask to be scrolled into view (on focus). */
const RevealContext = React.createContext<() => void>(() => {});
export const useRevealFocusedField = () => React.useContext(RevealContext);

/**
 * Shared shell for the signed-out screens: brand hero up top, white sheet
 * overlapping its bottom edge, legal footer pinned to the bottom.
 *
 * ── Keyboard avoidance (same approach as CMS mobile — works in Expo Go) ─────
 *  1. `useKeyboard()` measures how much of the window the keyboard covers.
 *  2. The sheet's bottom padding grows by that amount so the ScrollView can
 *     scroll the form above it.
 *  3. When the keyboard opens, the focused input is measured in window
 *     coordinates and the ScrollView scrolls just enough to reveal it (+ CTA).
 * NOT KeyboardAvoidingView (zero padding under Android edge-to-edge).
 */
export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();

  const scrollRef = React.useRef<ScrollViewInstance>(null);
  const scrollY = React.useRef(0);
  const keyboardTop = React.useRef(keyboard.top);
  const keyboardVisible = React.useRef(false);

  // Latest keyboard geometry for the (async) reveal below — written in an effect,
  // not during render (React Compiler rule).
  React.useEffect(() => {
    keyboardTop.current = keyboard.top;
    keyboardVisible.current = keyboard.visible;
  }, [keyboard.top, keyboard.visible]);

  const reveal = React.useCallback(() => {
    // Wait a frame so the keyboard padding has laid out — otherwise scrollTo is
    // clamped to the old (shorter) content height.
    setTimeout(
      () => {
        if (!keyboardVisible.current) return;
        const input = TextInput.State.currentlyFocusedInput();
        if (!input) return;

        input.measureInWindow((_x, y, _w, height) => {
          const wantedBottom = y + height + REVEAL_BELOW;
          const limit = keyboardTop.current - KEYBOARD_GAP;
          let delta = wantedBottom - limit;
          // Never push the field itself up under the status bar.
          delta = Math.min(delta, y - (insets.top + KEYBOARD_GAP));
          if (delta > 0) {
            scrollRef.current?.scrollTo({ y: scrollY.current + delta, animated: true });
          }
        });
      },
      Platform.OS === "ios" ? 50 : 80,
    );
  }, [insets.top]);

  React.useEffect(() => {
    if (keyboard.visible) reveal();
  }, [keyboard.visible, keyboard.overlap, reveal]);

  const bottomPadding = keyboard.visible
    ? keyboard.overlap + KEYBOARD_GAP + (Platform.OS === "android" ? insets.bottom : 0)
    : insets.bottom + 20;

  return (
    <RevealContext.Provider value={reveal}>
      <View style={{ flex: 1, backgroundColor: AUTH.heroTop }}>
        {/* Light glyphs: the hero behind the status bar is saturated blue. */}
        <StatusBar style="light" />

        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ flexGrow: 1, backgroundColor: AUTH.sheet }}
        >
          <AuthHero title={title} subtitle={subtitle} topInset={insets.top} />

          {/* The sheet pulls up over the hero's bottom edge — the overlap ties the two zones together. */}
          <View
            style={{
              flex: 1,
              backgroundColor: AUTH.sheet,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              marginTop: -24,
              paddingHorizontal: 26,
              paddingTop: 30,
              paddingBottom: bottomPadding,
            }}
          >
            {children}

            {/* marginTop:auto pushes the footer to the bottom of whatever space is left. */}
            <FadeIn delay={380} style={{ marginTop: "auto", paddingTop: 28 }}>
              <LegalFooter />
            </FadeIn>
          </View>
        </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}

/** Same promise as the web login card ("By continuing, you agree to…"). */
function LegalFooter() {
  const base = { fontFamily: AUTH_FONT.regular, fontSize: 12.5, lineHeight: 18, color: AUTH.muted };
  const link = { fontFamily: AUTH_FONT.semibold, color: AUTH.inkSoft, textDecorationLine: "underline" } as const;

  return (
    <Text style={[base, { textAlign: "center" }]}>
      By continuing, you agree to our{" "}
      <Text accessibilityRole="link" style={link} onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}>
        Terms of Service
      </Text>{" "}
      and{" "}
      <Text accessibilityRole="link" style={link} onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}
