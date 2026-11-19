import * as React from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { useThemeColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Single-line themed input for in-app forms (create / rename workspace…).
 * Sign-in has its own `AuthField` (fixed light palette, floating label).
 */
export function TextField({
  label,
  hint,
  className,
  ...props
}: TextInputProps & { label?: string; hint?: string; className?: string }) {
  const c = useThemeColors();
  const [focused, setFocused] = React.useState(false);
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-foreground font-sans-semibold px-1 text-[13.5px]">{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.subtle}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={cn(
          "bg-card font-sans text-foreground h-[52px] rounded-2xl border px-4 text-[15.5px]",
          focused ? "border-primary" : "border-border",
          className,
        )}
      />
      {hint ? <Text className="text-muted-foreground font-sans px-1 text-[12.5px]">{hint}</Text> : null}
    </View>
  );
}
