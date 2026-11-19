import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { useRequestPriority, useWorkspace } from "@/api/workspaces.api";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError } from "@/components/screen-states";
import { useThemeColors } from "@/lib/theme";

const MAX = 4000;

/**
 * "Request update" — web RequestPrioritySheet: a member asks the workspace
 * owner to review priorities (optionally about one task). The owner gets a
 * notification + email and sees it in their Inbox tab.
 */
export default function RequestPriorityScreen() {
  const { wid, taskId, taskTitle } = useLocalSearchParams<{ wid: string; taskId?: string; taskTitle?: string }>();
  const c = useThemeColors();
  const workspace = useWorkspace(wid);
  const request = useRequestPriority(wid);
  const [message, setMessage] = React.useState("");
  const trimmed = message.trim();

  const send = () => {
    if (!trimmed || request.isPending) return;
    request.mutate({ message: trimmed, ...(taskId ? { taskId } : {}) }, { onSuccess: () => router.back() });
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Request update" subtitle={workspace.data?.name} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text className="text-muted-foreground font-sans text-[14.5px] leading-[21px]">
            Ask the workspace owner to review the queue. They&apos;ll get a notification and an email.
          </Text>
          {taskTitle ? (
            <View className="bg-card border-border rounded-xl border px-3.5 py-2.5">
              <Text className="text-muted-foreground font-sans text-xs">About</Text>
              <Text className="font-sans-semibold text-foreground text-[14.5px]" numberOfLines={2}>
                {taskTitle}
              </Text>
            </View>
          ) : null}
          <TextInput
            value={message}
            onChangeText={(t) => {
              if (request.isError) request.reset();
              setMessage(t);
            }}
            placeholder="e.g. Can we move the launch work up? The client meeting is Friday."
            placeholderTextColor={c.subtle}
            multiline
            autoFocus
            maxLength={MAX}
            textAlignVertical="top"
            className="bg-card border-border font-sans text-foreground min-h-[140px] rounded-2xl border px-4 py-3 text-[15px] leading-[21px]"
          />
          {request.isError ? <ErrorNote message={describeLoadError(request.error)} /> : null}
          <AuthButton
            label={request.isPending ? "Sending…" : "Send request"}
            loading={request.isPending}
            disabled={!trimmed}
            onPress={send}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
