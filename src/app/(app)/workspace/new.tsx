import { router } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { useCreateWorkspace } from "@/api/workspaces.api";
import { TextField } from "@/components/form/text-field";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError } from "@/components/screen-states";

const MAX = 100;

/**
 * New workspace — web CreateBusinessForm. You become its OWNER; on success the
 * new (empty) board replaces this screen, so Back returns to the dashboard.
 */
export default function NewWorkspaceScreen() {
  const create = useCreateWorkspace();
  const [name, setName] = React.useState("");
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, {
      onSuccess: ({ id }) => router.replace({ pathname: "/workspace/[wid]", params: { wid: id } }),
    });
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="New workspace" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground font-sans text-[14.5px] leading-[21px]">
            A workspace is one priority queue — a client, a team or a project. You&apos;ll be its owner and can
            invite people from Members.
          </Text>
          <TextField
            label="Name"
            value={name}
            onChangeText={(t) => {
              if (create.isError) create.reset();
              setName(t);
            }}
            placeholder="e.g. Acme Co"
            autoFocus
            autoCapitalize="words"
            maxLength={MAX}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel="Workspace name"
          />
          {create.isError ? <ErrorNote message={describeLoadError(create.error)} /> : null}
          <AuthButton
            label={create.isPending ? "Creating…" : "Create workspace"}
            loading={create.isPending}
            disabled={!trimmed}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
