import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NinjaLoopMark } from "@/components/brand/ninja-loop-mark";
import { PressableSurface } from "@/components/pressable-surface";
import { initials } from "@/lib/format";
import { useThemeColors } from "@/lib/theme";
import { useSession } from "@/providers/session-provider";

/**
 * The signed-in app bar, shared by every tab: the Ninja Loop mark + wordmark and
 * the user's initials (→ Settings, where sign-out lives). Owns the top safe-area
 * inset and the status-bar style.
 */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const c = useThemeColors();
  const { data: session } = useSession();

  return (
    <View
      className="bg-card border-border flex-row items-center justify-between border-b px-5 pb-3"
      style={{ paddingTop: insets.top + 10 }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View className="flex-row items-center gap-2.5">
        <NinjaLoopMark size={26} color={c.primary} />
        <Text className="font-sans-bold text-foreground text-[17px] tracking-tight">Ninja Loop</Text>
      </View>
      <PressableSurface
        accessibilityLabel="Open settings"
        onPress={() => router.navigate("/settings")}
        hitSlop={10}
        className="bg-primary/10 border-primary/20 h-9 w-9 items-center justify-center rounded-full border"
      >
        <Text className="font-sans-bold text-primary text-[13px]">{initials(session?.user)}</Text>
      </PressableSurface>
    </View>
  );
}
