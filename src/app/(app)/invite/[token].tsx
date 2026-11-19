import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { useAcceptInvite, useInvitePreview } from "@/api/invites.api";
import { ROLE_LABEL } from "@/components/dashboard/workspace-card";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { PressableSurface } from "@/components/pressable-surface";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError, ErrorState } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleCheck, TriangleAlert, UserPlus, type IconComponent } from "@/lib/icons";
import { setPendingInvite } from "@/lib/pending-invite";
import { useThemeColors } from "@/lib/theme";
import { useSession } from "@/providers/session-provider";
import type { WorkspaceRole } from "@/types/api.types";

const ROLE_HINT: Record<WorkspaceRole, string> = {
  MEMBER: "You'll be able to add, reorder and complete tasks.",
  ADMIN: "You'll also be able to rename the workspace and invite people.",
  OWNER: "You'll have full control, including deleting the workspace.",
};

/**
 * Accept an invite — web /invite/[token]. Opened from an invite link (universal link,
 * `ninjaloop://invite/<token>`, or pasted on "Join with a link"). Shows who invited you to
 * what, then Accept → the workspace's board. Handles used / expired / wrong-account invites.
 */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data: session, signOut } = useSession();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite(token);
  const inv = preview.data;

  const onAccept = () =>
    accept.mutate(undefined, {
      onSuccess: ({ workspaceId }) => router.replace({ pathname: "/workspace/[wid]", params: { wid: workspaceId } }),
    });

  // Wrong account: keep the invite waiting, sign out; after signing in with the right
  // email the signed-in layout re-opens it (lib/pending-invite.ts).
  const switchAccount = () => {
    setPendingInvite(token);
    void signOut();
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Invitation" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48, flexGrow: 1 }}>
        {preview.isPending ? (
          <View className="gap-3">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </View>
        ) : preview.isError || !inv ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        ) : (
          <>
            <View className="bg-card border-border items-center gap-2 rounded-3xl border px-5 py-7">
              <View className="bg-primary/10 mb-1 h-14 w-14 items-center justify-center rounded-2xl">
                <Text className="font-display text-primary text-2xl">
                  {inv.workspaceName.trim().slice(0, 1).toUpperCase() || "?"}
                </Text>
              </View>
              <Text className="text-muted-foreground font-sans text-center text-[14px]">
                {inv.inviterName || "Someone"} invited you to join
              </Text>
              <Text className="font-display text-foreground text-center text-[24px] tracking-tight">{inv.workspaceName}</Text>
              <View className="bg-primary/10 mt-1 rounded-full px-3 py-1">
                <Text className="font-sans-semibold text-primary text-xs">as {ROLE_LABEL[inv.role]}</Text>
              </View>
              <Text className="text-muted-foreground font-sans mt-1 text-center text-[13px] leading-5">{ROLE_HINT[inv.role]}</Text>
            </View>

            {inv.accepted ? (
              <Notice icon={CircleCheck} tone="ok" text="This invite has already been used." />
            ) : inv.expired ? (
              <Notice
                icon={TriangleAlert}
                tone="warn"
                text={`This invite has expired. Ask ${inv.inviterName || "the person who invited you"} for a new one.`}
              />
            ) : !inv.emailMatches ? (
              <>
                <Notice
                  icon={TriangleAlert}
                  tone="warn"
                  text={`This invite was sent to ${inv.email}. You're signed in as ${session?.user?.email ?? "another account"}. Sign in with ${inv.email} to accept it.`}
                />
                <AuthButton label={`Sign out and use ${inv.email}`} onPress={switchAccount} />
              </>
            ) : (
              <>
                {accept.isError ? <ErrorNote message={describeLoadError(accept.error)} /> : null}
                <AuthButton
                  label={accept.isPending ? "Joining…" : `Join ${inv.workspaceName}`}
                  loading={accept.isPending}
                  icon={<UserPlus size={18} color="#FFFFFF" strokeWidth={2.2} />}
                  onPress={onAccept}
                />
              </>
            )}

            <PressableSurface onPress={() => router.dismissTo("/")} className="items-center py-2">
              <Text className="font-sans-semibold text-muted-foreground text-[14px]">
                {inv.accepted || inv.expired ? "Back to the app" : "Not now"}
              </Text>
            </PressableSurface>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Notice({ icon: Icon, tone, text }: { icon: IconComponent; tone: "ok" | "warn"; text: string }) {
  const c = useThemeColors();
  return (
    <View className="bg-card border-border flex-row items-start gap-3 rounded-2xl border px-4 py-3.5">
      <Icon size={18} color={tone === "ok" ? c.success : c.today} strokeWidth={2.2} />
      <Text className="text-foreground font-sans flex-1 text-[14px] leading-5">{text}</Text>
    </View>
  );
}
