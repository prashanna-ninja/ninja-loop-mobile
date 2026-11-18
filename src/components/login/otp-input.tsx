import * as React from "react";
import { Pressable, Text, TextInput, View, type TextInputInstance } from "react-native";

import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";
import { useRevealFocusedField } from "@/components/login/auth-screen";

/**
 * One-time-code input: N visual cells over ONE real (transparent) TextInput.
 * A single input keeps paste, iOS "From Messages/Mail" autofill
 * (`textContentType="oneTimeCode"`) and Android SMS autofill working —
 * N separate inputs break all three.
 */
export function OtpInput({
  value,
  onChange,
  length,
  error = false,
  editable = true,
  autoFocus = false,
  onComplete,
}: {
  value: string;
  onChange: (code: string) => void;
  length: number;
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}) {
  const inputRef = React.useRef<TextInputInstance>(null);
  const [focused, setFocused] = React.useState(false);
  const revealFocusedField = useRevealFocusedField();

  const cells = Array.from({ length }, (_, i) => value[i] ?? "");
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <Pressable
      accessibilityLabel={`${length}-digit sign-in code`}
      onPress={() => inputRef.current?.focus()}
      style={{ position: "relative" }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {cells.map((digit, i) => {
          const isActive = focused && editable && i === activeIndex;
          const filled = digit !== "";
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 14,
                borderWidth: isActive ? 2 : 1.5,
                borderColor: error ? AUTH.danger : isActive ? AUTH.brand : filled ? AUTH.lineStrong : AUTH.line,
                backgroundColor: error ? AUTH.dangerSoft : filled ? AUTH.white : AUTH.fieldBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: AUTH_FONT.bold,
                  fontSize: 24,
                  lineHeight: 30,
                  color: error ? AUTH.danger : AUTH.ink,
                }}
              >
                {digit}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The real input sits on top, invisible, so taps and long-press paste land on it. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const code = text.replace(/\D/g, "").slice(0, length);
          onChange(code);
          if (code.length === length) onComplete?.(code);
        }}
        onFocus={() => {
          setFocused(true);
          revealFocusedField();
        }}
        onBlur={() => setFocused(false)}
        editable={editable}
        autoFocus={autoFocus}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        caretHidden
        selectionColor="transparent"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          color: "transparent",
          opacity: 0.02, // ~invisible but still hit-testable on Android
        }}
      />
    </Pressable>
  );
}
