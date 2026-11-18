import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { NinjaLoopMark } from "@/components/brand/ninja-loop-mark";
import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { FadeIn } from "@/components/login/fade-in";
import { QueuePath } from "@/components/login/queue-path";

const HERO_PAD_X = 26;

/** The brand hero above the auth sheet: wordmark, the live queue, title, one line of copy. */
export function AuthHero({
  title,
  subtitle,
  topInset = 0,
}: {
  title: string;
  subtitle: string;
  /**
   * The safe-area top inset, absorbed into the gradient's own padding.
   *
   * ⚠️ The gradient MUST paint this area itself. A padded wrapper <View> would be
   * transparent and show the ScrollView's white content container as a white band
   * above the hero on every notched iPhone (Ninja PRM bug).
   */
  topInset?: number;
}) {
  return (
    <LinearGradient
      colors={[AUTH.heroTop, AUTH.heroBottom]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ paddingTop: topInset + 22, paddingBottom: 48 }}
    >
      <FadeIn delay={40} style={{ paddingHorizontal: HERO_PAD_X }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <NinjaLoopMark size={30} color={AUTH.heroText} />
          <Text
            style={{
              fontFamily: AUTH_FONT.bold,
              fontSize: 18,
              letterSpacing: -0.3,
              color: AUTH.heroText,
            }}
          >
            Ninja Loop
          </Text>
        </View>
      </FadeIn>

      {/* Edge-to-edge: the path runs off both sides of the screen. */}
      <FadeIn delay={90} distance={0} duration={700} style={{ marginTop: 18, marginBottom: 14 }}>
        <QueuePath />
      </FadeIn>

      <FadeIn delay={140} style={{ paddingHorizontal: HERO_PAD_X }}>
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: AUTH_FONT.extrabold,
              fontSize: 31,
              lineHeight: 36,
              letterSpacing: -0.9,
              color: AUTH.heroText,
            }}
          >
            {title}
          </Text>
          <Text style={{ fontFamily: AUTH_FONT.regular, fontSize: 15, lineHeight: 22, color: AUTH.heroMuted }}>
            {subtitle}
          </Text>
        </View>
      </FadeIn>
    </LinearGradient>
  );
}
