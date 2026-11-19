import type * as React from "react";
import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import type { IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/** A titled card on the task screen. */
export function TaskSection({
  title,
  icon: Icon,
  aside,
  children,
}: {
  title: string;
  icon?: IconComponent;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View className="bg-card border-border gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center gap-2">
        {Icon ? <Icon size={16} color={c.mutedForeground} strokeWidth={2} /> : null}
        <Text className="font-sans-bold text-foreground flex-1 text-[14.5px] tracking-tight">{title}</Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** Pill choice (date presets, assignees). `selected` = primary fill. */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** "danger" for destructive chips like "Clear". */
  tone?: "danger";
}) {
  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      className={`rounded-full border px-3.5 py-2 ${selected ? "bg-primary border-primary" : "bg-card border-border"} ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Text
        className={`font-sans-semibold text-[13px] ${
          selected ? "text-primary-foreground" : tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </PressableSurface>
  );
}

/** Small text action ("Add", "Save", "Unblock"). */
export function TextAction({
  label,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <PressableSurface onPress={onPress} disabled={disabled} hitSlop={8} className={disabled ? "opacity-40" : ""}>
      <Text className={`font-sans-semibold text-[13.5px] ${tone === "danger" ? "text-destructive" : "text-primary"}`}>
        {label}
      </Text>
    </PressableSurface>
  );
}
