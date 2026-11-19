import { router } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { TextField } from "@/components/form/text-field";
import { AuthButton } from "@/components/login/auth-button";
import { ScreenHeader } from "@/components/screen-header";
import { parseInviteToken } from "@/lib/pending-invite";

/**
 * Join with a link — paste the link from an invite email. Works even before universal
 * links are live (tapping the email link on the phone then opens the app directly).
 */
export default function JoinWithLinkScreen() {
  const [value, setValue] = React.useState("");
  const token = parseInviteToken(value);
  const showError = value.trim().length > 8 && !token;

  const submit = () => {
    if (!token) return;
    router.replace({ pathname: "/invite/[token]", params: { token } });
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Join a workspace" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground font-sans text-[14.5px] leading-[21px]">
            Got an invite email? Copy its link (it looks like ninjaloop.com.au/invite/…) and paste it here.
          </Text>
          <View className="gap-1.5">
            <TextField
              label="Invite link"
              value={value}
              onChangeText={setValue}
              placeholder="https://www.ninjaloop.com.au/invite/…"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Invite link"
            />
            {showError ? (
              <Text className="text-destructive font-sans px-1 text-[12.5px]">That doesn&apos;t look like an invite link.</Text>
            ) : null}
          </View>
          <AuthButton label="Continue" disabled={!token} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
