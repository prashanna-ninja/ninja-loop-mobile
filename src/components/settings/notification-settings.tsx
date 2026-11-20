import * as React from "react";
import { Alert, Linking, Switch, Text, View } from "react-native";

import { PUSH_CATEGORIES } from "@/lib/push-categories";
import { BellRing } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import { usePush, type EnableOutcome } from "@/providers/push-provider";

/** What the last enable() achieved → a message, or null when it worked. */
export function explainEnableOutcome(outcome: EnableOutcome) {
  if (outcome === "blocked") {
    Alert.alert(
      "Notifications are off for Ninja Loop",
      "Turn them on in your phone's Settings → Ninja Loop → Notifications. We'll finish setting up when you come back.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
  } else if (outcome === "failed") {
    Alert.alert("Couldn't set up notifications", "This phone couldn't get a push token. Try again later.");
  } else if (outcome === "unsupported") {
    Alert.alert("Not available here", "Push notifications need the iOS or Android app.");
  }
}

/**
 * Settings → Notifications: this device's push switch + the four categories.
 * Per DEVICE (stored on the server's device row), so a phone and a tablet can differ.
 */
export function NotificationSettings() {
  const c = useThemeColors();
  const push = usePush();
  const on = push.enabled && push.permission === "granted";

  const status = (() => {
    if (push.permission === "unsupported") return "Not available on this device.";
    if (push.permission === "blocked") return "Blocked in your phone's Settings.";
    if (!push.enabled) return "Get a notification when someone assigns you, comments or asks for an update.";
    if (push.tokenProblem === "no-project-id") return "This build isn't linked to EAS yet (npx eas-cli init), so it can't get a push token.";
    if (push.tokenProblem === "failed") return "This phone couldn't get a push token. Try turning it off and on.";
    if (push.sync?.status === "unavailable") return "On — the server isn't sending pushes yet.";
    if (push.sync?.status === "error") return "On, but this phone couldn't reach the server. It'll retry next launch.";
    return "On for this phone.";
  })();

  const toggle = async (next: boolean) => {
    if (!next) return push.disable();
    if (push.permission === "blocked") return explainEnableOutcome("blocked");
    explainEnableOutcome(await push.enable());
  };

  return (
    <View className="gap-2">
      <Text className="text-muted-foreground font-sans-semibold px-1 text-xs uppercase tracking-wider">Notifications</Text>
      <View className="bg-card border-border overflow-hidden rounded-2xl border">
        <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
          <BellRing size={19} color={c.mutedForeground} strokeWidth={1.9} />
          <Text className="font-sans-medium text-foreground flex-1 text-[15px]">Push notifications</Text>
          <Switch
            value={on}
            disabled={push.busy || push.permission === "loading" || push.permission === "unsupported"}
            onValueChange={(v) => void toggle(v)}
            trackColor={{ true: c.primary, false: c.muted }}
            accessibilityLabel="Push notifications"
          />
        </View>
        {on
          ? PUSH_CATEGORIES.map(({ key, label, hint }) => (
              <View key={key} className="border-border min-h-[52px] flex-row items-center gap-3 border-t px-4 py-3">
                <View className="flex-1 gap-0.5 pl-8">
                  <Text className="font-sans-medium text-foreground text-[14.5px]">{label}</Text>
                  <Text className="text-muted-foreground font-sans text-[12.5px]">{hint}</Text>
                </View>
                <Switch
                  value={push.preferences[key]}
                  onValueChange={(v) => void push.setCategory(key, v)}
                  trackColor={{ true: c.primary, false: c.muted }}
                  accessibilityLabel={label}
                />
              </View>
            ))
          : null}
      </View>
      <Text className="text-muted-foreground font-sans px-1 text-[12.5px]">{status}</Text>
    </View>
  );
}
