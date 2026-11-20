import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { explainEnableOutcome } from "@/components/settings/notification-settings";
import { BellRing, X } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import { usePush } from "@/providers/push-provider";

/**
 * The soft ask, on top of Alerts. iOS shows its own permission dialog ONCE — if someone
 * taps "Don't Allow" out of context it's gone for good — so we explain first and only
 * trigger the system prompt from "Turn on". Shown until answered or dismissed; the
 * Settings switch is always there afterwards.
 */
export function PushPrompt() {
  const c = useThemeColors();
  const push = usePush();
  if (push.prompted || push.enabled || push.permission === "loading" || push.permission === "unsupported") return null;

  return (
    <View className="bg-primary/10 border-primary/25 mt-3 flex-row items-start gap-3 rounded-2xl border p-4">
      <BellRing size={20} color={c.primary} strokeWidth={2} />
      <View className="flex-1 gap-2.5">
        <View className="gap-0.5">
          <Text className="font-sans-semibold text-foreground text-[14.5px]">Get these on your phone</Text>
          <Text className="text-muted-foreground font-sans text-[13px] leading-5">
            {"A notification when you're assigned, someone comments, or a teammate asks for an update."}
          </Text>
        </View>
        <PressableSurface
          onPress={async () => explainEnableOutcome(await push.enable())}
          disabled={push.busy}
          accessibilityLabel="Turn on push notifications"
          className="bg-primary self-start rounded-full px-4 py-2"
        >
          <Text className="font-sans-semibold text-primary-foreground text-[13.5px]">
            {push.busy ? "Turning on…" : "Turn on"}
          </Text>
        </PressableSurface>
      </View>
      <PressableSurface onPress={push.dismissPrompt} hitSlop={10} accessibilityLabel="Not now">
        <X size={18} color={c.subtle} strokeWidth={2} />
      </PressableSurface>
    </View>
  );
}
