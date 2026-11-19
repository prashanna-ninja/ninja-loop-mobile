import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { useDeleteWorkspace, useRenameWorkspace, useWorkspace } from "@/api/workspaces.api";
import { TextField } from "@/components/form/text-field";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { PressableSurface } from "@/components/pressable-surface";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError, ErrorState } from "@/components/screen-states";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Trash2, Users } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

const MAX = 100;

/**
 * Workspace settings — web /b/[slug]/settings.
 * Rename: OWNER / ADMIN (`PATCH /workspaces/:wid`). Delete: OWNER only, after
 * typing the workspace's name (same guard as the web's DeleteWorkspaceDialog).
 * Plain members see the name read-only.
 */
export default function WorkspaceSettingsScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const workspace = useWorkspace(wid);
  const ws = workspace.data;

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Workspace settings" subtitle={ws?.name} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 26, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {workspace.isPending ? (
            <View className="gap-3">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-[52px] rounded-2xl" />
            </View>
          ) : workspace.isError ? (
            <ErrorState error={workspace.error} onRetry={() => void workspace.refetch()} />
          ) : ws ? (
            <>
              {ws.role === "MEMBER" ? (
                <View className="gap-1.5">
                  <Text className="text-foreground font-sans-semibold px-1 text-[13.5px]">Name</Text>
                  <Text className="font-sans-semibold text-foreground px-1 text-[17px]">{ws.name}</Text>
                  <Text className="text-muted-foreground font-sans px-1 text-[12.5px]">
                    Only the owner or an admin can rename this workspace.
                  </Text>
                </View>
              ) : (
                <RenameForm wid={wid} currentName={ws.name} />
              )}

              <SettingsGroup>
                <SettingsRow
                  icon={Users}
                  label="Members"
                  value={`${ws.memberCount}`}
                  onPress={() => router.push({ pathname: "/workspace/[wid]/members", params: { wid } })}
                />
              </SettingsGroup>

              {ws.role === "OWNER" ? <DangerZone wid={wid} name={ws.name} /> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RenameForm({ wid, currentName }: { wid: string; currentName: string }) {
  const rename = useRenameWorkspace(wid);
  // null = untouched → follow the server's name (e.g. after a refetch).
  const [draft, setDraft] = React.useState<string | null>(null);
  const value = draft ?? currentName;
  const trimmed = value.trim();
  const changed = trimmed !== currentName;

  const save = () => {
    if (!trimmed || !changed || rename.isPending) return;
    rename.mutate(trimmed, { onSuccess: () => setDraft(null) });
  };

  return (
    <View className="gap-3">
      <TextField
        label="Name"
        hint="Shown on the dashboard and in emails."
        value={value}
        onChangeText={(t) => {
          if (rename.isError || rename.isSuccess) rename.reset();
          setDraft(t);
        }}
        autoCapitalize="words"
        maxLength={MAX}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Workspace name"
      />
      {rename.isError ? <ErrorNote message={describeLoadError(rename.error)} /> : null}
      {rename.isSuccess && !changed ? <SavedNote /> : null}
      {changed ? (
        <AuthButton
          label={rename.isPending ? "Saving…" : "Save name"}
          loading={rename.isPending}
          disabled={!trimmed}
          onPress={save}
        />
      ) : null}
    </View>
  );
}

function SavedNote() {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center gap-1.5 px-1" accessibilityLiveRegion="polite">
      <Check size={15} color={c.success} strokeWidth={2.4} />
      <Text className="font-sans-medium text-[13px]" style={{ color: c.success }}>
        Saved
      </Text>
    </View>
  );
}

function DangerZone({ wid, name }: { wid: string; name: string }) {
  const del = useDeleteWorkspace(wid);
  const [confirm, setConfirm] = React.useState("");
  const armed = confirm === name && !del.isPending;

  const onDelete = () => {
    if (!armed) return;
    // Back to the dashboard: pops the settings + board screens (they'd 404 now).
    del.mutate(undefined, { onSuccess: () => router.dismissTo("/") });
  };

  return (
    <View className="gap-2">
      <Text className="text-destructive font-sans-semibold px-1 text-xs uppercase tracking-wider">Danger zone</Text>
      <View className="bg-card border-destructive/40 gap-3.5 rounded-2xl border p-4">
        <View className="gap-1">
          <Text className="font-sans-semibold text-foreground text-[15px]">Delete this workspace</Text>
          <Text className="text-muted-foreground font-sans text-[13.5px] leading-5">
            All of its tasks, members and data are gone forever. This can&apos;t be undone.
          </Text>
        </View>
        <TextField
          label={`Type "${name}" to confirm`}
          value={confirm}
          onChangeText={(t) => {
            if (del.isError) del.reset();
            setConfirm(t);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={name}
          accessibilityLabel={`Type ${name} to confirm`}
        />
        {del.isError ? <ErrorNote message={describeLoadError(del.error)} /> : null}
        <PressableSurface
          onPress={onDelete}
          disabled={!armed}
          accessibilityLabel="Delete this workspace"
          accessibilityState={{ disabled: !armed, busy: del.isPending }}
          className={`bg-destructive h-[50px] flex-row items-center justify-center gap-2 rounded-full ${armed || del.isPending ? "" : "opacity-40"}`}
        >
          {del.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Trash2 size={17} color="#FFFFFF" strokeWidth={2.1} />
          )}
          <Text className="font-sans-semibold text-[15px] text-white">
            {del.isPending ? "Deleting…" : "Delete workspace"}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
}
