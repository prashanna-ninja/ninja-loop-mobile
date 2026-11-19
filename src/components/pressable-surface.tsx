import * as React from "react";
import { Pressable, type PressableProps } from "react-native";

import { cn } from "@/lib/utils";

/**
 * A Pressable that dims while pressed. Takes `className` like a View.
 *
 * ⚠️ Pressed state is tracked by hand and applied as a plain style — NativeWind 4
 * drops Pressable's function `style` (see components/login/auth-button.tsx).
 */
export function PressableSurface({
  className,
  onPressIn,
  onPressOut,
  disabled,
  pressedOpacity = 0.7,
  ...props
}: Omit<PressableProps, "style"> & { className?: string; pressedOpacity?: number }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      className={cn(className)}
      // Only set opacity WHILE pressed — a constant `opacity: 1` would override an
      // `opacity-40` className (disabled look) on the same element.
      style={pressed && !disabled ? { opacity: pressedOpacity } : undefined}
      {...props}
    />
  );
}
