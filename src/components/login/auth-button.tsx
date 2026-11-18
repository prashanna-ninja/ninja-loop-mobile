import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";

import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";

type Variant = "primary" | "social" | "quiet";

type AuthButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  /** "primary" = the one brand fill. "social" = white, outlined (provider logo). "quiet" = text action. */
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Rendered after the label (e.g. a forward arrow on a "next step" CTA). */
  trailing?: React.ReactNode;
};

const HEIGHT: Record<Variant, number> = { primary: 56, social: 54, quiet: 44 };

/**
 * ⚠️ Do NOT give the Pressable a FUNCTION style (`style={({pressed}) => …}`).
 * NativeWind 4 wraps RN components for `className`, and that wrapper drops the
 * function form — the button renders with no background (real device bug in
 * Ninja PRM). Track `pressed` ourselves and pass a plain style OBJECT.
 */
export function AuthButton({
  label,
  variant = "primary",
  loading = false,
  icon,
  trailing,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: AuthButtonProps) {
  const [pressed, setPressed] = React.useState(false);
  const isDisabled = disabled || loading;
  const isPressed = pressed && !isDisabled;

  const surface =
    variant === "primary"
      ? { backgroundColor: isPressed ? AUTH.brandPressed : AUTH.brand }
      : variant === "social"
        ? {
            backgroundColor: isPressed ? AUTH.fieldBg : AUTH.white,
            borderWidth: 1.5,
            borderColor: isPressed ? AUTH.lineStrong : AUTH.line,
          }
        : { backgroundColor: "transparent" };

  const textColor = variant === "primary" ? AUTH.white : variant === "social" ? AUTH.ink : AUTH.brand;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={{
        height: HEIGHT[variant],
        borderRadius: 999,
        ...surface,
        // Dim rather than grey out: reads as "not yet", not "broken".
        opacity: isDisabled && !loading ? 0.5 : variant === "quiet" && isPressed ? 0.6 : 1,
        transform: [{ scale: isPressed && variant !== "quiet" ? 0.985 : 1 }],
      }}
      {...props}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
        {loading ? <ActivityIndicator size="small" color={variant === "primary" ? AUTH.white : AUTH.muted} /> : icon}
        <Text
          style={{
            fontFamily: AUTH_FONT.semibold,
            fontSize: variant === "quiet" ? 14.5 : 16,
            color: textColor,
            letterSpacing: 0.1,
          }}
        >
          {label}
        </Text>
        {loading ? null : trailing}
      </View>
    </Pressable>
  );
}
