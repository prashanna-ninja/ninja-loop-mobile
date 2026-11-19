import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type * as React from "react";
import { Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "@/components/pressable-surface";
import { ChevronLeft } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/**
 * App bar for pushed screens (board, task): back chevron, title + optional
 * subtitle, optional right-hand actions. Owns the top safe-area inset, like AppHeader.
 * Back falls through to the dashboard when there's no history (opened from a link).
 */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const c = useThemeColors();

  return (
    <View
      className="bg-card border-border flex-row items-center gap-2 border-b pb-2.5 pl-2 pr-4"
      style={{ paddingTop: insets.top + 6 }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <PressableSurface
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        className="h-10 w-10 items-center justify-center rounded-full"
      >
        <ChevronLeft size={26} color={c.foreground} strokeWidth={2} />
      </PressableSurface>
      <View className="flex-1">
        <Text className="font-sans-bold text-foreground text-[17px] tracking-tight" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground font-sans text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
    </View>
  );
}

/** Round icon button for ScreenHeader's `right` slot. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  color,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  const Icon = icon;
  return (
    <PressableSurface
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-full"
    >
      <Icon size={21} color={disabled ? c.subtle : (color ?? c.foreground)} strokeWidth={2} />
    </PressableSurface>
  );
}
