import * as React from "react";
import { Animated, Text, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { useRevealFocusedField } from "@/components/login/auth-screen";

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type AuthFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  icon: IconComponent;
  error?: string;
  ref?: React.Ref<TextInputInstance>;
};

/**
 * Boxed input (CMS/PRM design): icon on the left, a small label stacked above the
 * value inside the box. The border animates to brand blue on focus, red on error.
 */
export function AuthField({ label, icon: Icon, error, onFocus, onBlur, ref, ...props }: AuthFieldProps) {
  const [focused, setFocused] = React.useState(false);
  const revealFocusedField = useRevealFocusedField();
  // useState, not useRef().current — reading refs during render breaks React Compiler rules.
  const [focusAnim] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const animation = Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 160,
      useNativeDriver: false, // border colour can't run on the native driver
    });
    animation.start();
    return () => animation.stop();
  }, [focused, focusAnim]);

  const borderColor = error
    ? AUTH.danger
    : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [AUTH.line, AUTH.brand] });
  const iconColor = error ? AUTH.danger : focused ? AUTH.brand : AUTH.muted;

  return (
    <View style={{ gap: 8 }}>
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1.5,
          borderColor,
          borderRadius: 16,
          backgroundColor: error ? AUTH.dangerSoft : AUTH.fieldBg,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Icon size={20} color={iconColor} strokeWidth={1.9} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: AUTH_FONT.medium,
              fontSize: 12,
              lineHeight: 16,
              color: error ? AUTH.danger : AUTH.muted,
            }}
          >
            {label}
          </Text>
          <TextInput
            ref={ref}
            placeholderTextColor={AUTH.lineStrong}
            selectionColor={AUTH.brand}
            onFocus={(e) => {
              setFocused(true);
              revealFocusedField();
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={{
              fontFamily: AUTH_FONT.regular,
              fontSize: 16,
              // ⚠️ lineHeight + a little vertical padding stops iOS clipping descenders.
              lineHeight: 21,
              color: AUTH.ink,
              paddingVertical: 2,
              paddingHorizontal: 0,
            }}
            {...props}
          />
        </View>
      </Animated.View>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontFamily: AUTH_FONT.regular, fontSize: 13, lineHeight: 18, color: AUTH.danger }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
