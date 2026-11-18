import * as React from "react";
import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { ChevronRight, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/** A titled card of rows (iOS-settings style). */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View className="gap-2">
      {title ? (
        <Text className="text-muted-foreground font-sans-semibold px-1 text-xs uppercase tracking-wider">{title}</Text>
      ) : null}
      <View className="bg-card border-border overflow-hidden rounded-2xl border">
        {rows.map((row, i) => (
          <View key={i} className={i > 0 ? "border-border border-t" : ""}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A row: icon, label, optional value on the right, chevron when pressable. */
export function SettingsRow({
  icon: Icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  icon: IconComponent;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const c = useThemeColors();
  const content = (
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
      <Icon size={19} color={destructive ? c.destructive : c.mutedForeground} strokeWidth={1.9} />
      <Text
        className={`font-sans-medium flex-1 text-[15px] ${destructive ? "text-destructive" : "text-foreground"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text className="text-muted-foreground font-sans max-w-[55%] text-sm" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !destructive ? <ChevronRight size={17} color={c.subtle} strokeWidth={2} /> : null}
    </View>
  );

  return onPress ? (
    <PressableSurface onPress={onPress} accessibilityLabel={label}>
      {content}
    </PressableSurface>
  ) : (
    content
  );
}
