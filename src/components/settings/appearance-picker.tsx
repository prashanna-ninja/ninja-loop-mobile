import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { Moon, Smartphone, SunMedium, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme-preference";

const OPTIONS: { value: ThemePreference; label: string; icon: IconComponent }[] = [
  { value: "system", label: "System", icon: Smartphone },
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Settings → Appearance: System · Light · Dark segmented control.
 * Switching applies app-wide instantly (see lib/theme-preference.ts) and is remembered.
 */
export function AppearancePicker() {
  const c = useThemeColors();
  const pref = useThemePreference();

  return (
    <View className="gap-2">
      <Text className="text-muted-foreground font-sans-semibold px-1 text-xs uppercase tracking-wider">Appearance</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Appearance"
        className="bg-card border-border flex-row gap-1 rounded-2xl border p-1.5"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = pref === value;
          return (
            <PressableSurface
              key={value}
              onPress={() => setThemePreference(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={value === "system" ? "Match the phone's setting" : `${label} mode`}
              className={`flex-1 items-center gap-1.5 rounded-xl py-3 ${selected ? "bg-primary/10 border-primary/40 border" : "border border-transparent"}`}
            >
              <Icon size={20} color={selected ? c.primary : c.mutedForeground} strokeWidth={selected ? 2.2 : 1.9} />
              <Text className={`text-[13px] ${selected ? "font-sans-semibold text-primary" : "font-sans-medium text-muted-foreground"}`}>
                {label}
              </Text>
            </PressableSurface>
          );
        })}
      </View>
      <Text className="text-muted-foreground font-sans px-1 text-[12.5px]">
        {pref === "system" ? "Follows your phone's light / dark setting." : `Always ${pref}, whatever your phone uses.`}
      </Text>
    </View>
  );
}
