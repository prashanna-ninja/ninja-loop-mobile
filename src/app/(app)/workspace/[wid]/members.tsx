import { formatDistanceToNowStrict } from "date-fns";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from "react-native";

import { useInvites, useRevokeInvite, useSendInvite } from "@/api/invites.api";
import { useMembers, useWorkspace } from "@/api/workspaces.api";
import { TextField } from "@/components/form/text-field";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { PressableSurface } from "@/components/pressable-surface";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError, EmptyState, ErrorState, SectionHeader } from "@/components/screen-states";
import { Chip } from "@/components/task/section";
import { Skeleton } from "@/components/ui/skeleton";
import { initials, personName } from "@/lib/format";
import { CircleCheck, Mail, Users, X } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import { useSession } from "@/providers/session-provider";
import type { Invite, Member, WorkspaceRole } from "@/types/api.types";

const ROLE_LABEL: Record<WorkspaceRole, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };
const ROLES: WorkspaceRole[] = ["MEMBER", "ADMIN", "OWNER"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Members — web /b/[slug]/settings/members. Everyone sees the member list; owners and
 * admins also invite by email (Member / Admin / Owner, like the web) and see / revoke
 * pending invites. Removing people / changing roles isn't in the web or the API.
 */
export default function MembersScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const c = useThemeColors();
  const { data: session } = useSession();
  const workspace = useWorkspace(wid);
  const members = useMembers(wid);
  const canInvite = !!workspace.data && workspace.data.role !== "MEMBER";
  const invites = useInvites(wid, canInvite);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([members.refetch(), canInvite ? invites.refetch() : null]);
    setRefreshing(false);
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Members" subtitle={workspace.data?.name} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        >
          {canInvite ? <InviteForm wid={wid} /> : null}

          {canInvite && invites.data?.length ? (
            <View className="gap-2.5">
              <SectionHeader title="Pending invites" count={invites.data.length} />
              {invites.data.map((inv) => (
                <InviteRow key={inv.id} wid={wid} invite={inv} />
              ))}
            </View>
          ) : null}

          <View className="gap-2.5">
            {canInvite ? <SectionHeader title="Members" count={members.data?.length} /> : null}
            {members.isPending ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-[64px] rounded-2xl" />)
            ) : members.isError ? (
              <ErrorState error={members.error} onRetry={() => void members.refetch()} />
            ) : !members.data?.length ? (
              <EmptyState icon={Users} title="No members" body="Invite someone to share this queue." />
            ) : (
              members.data.map((m) => <MemberRow key={m.id} member={m} isYou={m.id === session?.user?.id} />)
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InviteForm({ wid }: { wid: string }) {
  const c = useThemeColors();
  const send = useSendInvite(wid);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("MEMBER");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const trimmed = email.trim().toLowerCase();
  const valid = EMAIL.test(trimmed);

  const submit = () => {
    if (!valid || send.isPending) return;
    send.mutate(
      { email: trimmed, role },
      {
        onSuccess: () => {
          setSentTo(trimmed);
          setEmail("");
          setRole("MEMBER");
        },
      },
    );
  };

  return (
    <View className="bg-card border-border gap-3.5 rounded-2xl border p-4">
      <View className="gap-0.5">
        <Text className="font-sans-bold text-foreground text-[15.5px] tracking-tight">Invite someone</Text>
        <Text className="text-muted-foreground font-sans text-[13px] leading-5">
          They get an email with a link to join. It expires in 7 days.
        </Text>
      </View>
      <TextField
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (send.isError) send.reset();
          if (sentTo) setSentTo(null);
        }}
        placeholder="name@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        accessibilityLabel="Email to invite"
      />
      <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel="Role">
        {ROLES.map((r) => (
          <Chip key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </View>
      {send.isError ? <ErrorNote message={describeLoadError(send.error)} /> : null}
      {sentTo ? (
        <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
          <CircleCheck size={16} color={c.success} strokeWidth={2.2} />
          <Text className="text-foreground font-sans flex-1 text-[13.5px]">Invite sent to {sentTo}.</Text>
        </View>
      ) : null}
      <AuthButton
        label={send.isPending ? "Sending…" : "Send invite"}
        loading={send.isPending}
        disabled={!valid}
        icon={<Mail size={17} color="#FFFFFF" strokeWidth={2.2} />}
        onPress={submit}
      />
    </View>
  );
}

function InviteRow({ wid, invite: inv }: { wid: string; invite: Invite }) {
  const c = useThemeColors();
  const revoke = useRevokeInvite(wid);
  const when = inv.expired
    ? "Expired"
    : `Expires in ${formatDistanceToNowStrict(new Date(inv.expiresAt))}`;

  const confirmRevoke = () =>
    Alert.alert("Revoke this invite?", `${inv.email} won't be able to use the link.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () =>
          revoke.mutate(inv.id, { onError: (err) => Alert.alert("Couldn't revoke the invite", describeLoadError(err)) }),
      },
    ]);

  return (
    <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-4 py-3">
      <View className="bg-muted h-10 w-10 items-center justify-center rounded-full">
        <Mail size={17} color={c.mutedForeground} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-semibold text-foreground text-[15px]" numberOfLines={1}>
          {inv.email}
        </Text>
        <Text className="text-muted-foreground font-sans text-[12.5px]" numberOfLines={1}>
          {ROLE_LABEL[inv.role]} ·{" "}
          <Text className={inv.expired ? "text-destructive font-sans-semibold" : ""}>{when}</Text>
          {inv.invitedBy ? ` · by ${inv.invitedBy.name || inv.invitedBy.email}` : ""}
        </Text>
      </View>
      <PressableSurface accessibilityLabel={`Revoke invite for ${inv.email}`} hitSlop={8} onPress={confirmRevoke}>
        <X size={18} color={c.subtle} strokeWidth={2} />
      </PressableSurface>
    </View>
  );
}

function MemberRow({ member: m, isYou }: { member: Member; isYou: boolean }) {
  return (
    <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-4 py-3">
      <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
        <Text className="font-sans-bold text-primary text-sm">{initials(m)}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-foreground text-[15px]" numberOfLines={1}>
          {personName(m)}
          {isYou ? <Text className="text-muted-foreground font-sans"> (you)</Text> : null}
        </Text>
        <Text className="text-muted-foreground font-sans text-[13px]" numberOfLines={1}>
          {m.email}
        </Text>
      </View>
      <Text className="text-muted-foreground font-sans-semibold text-xs">{ROLE_LABEL[m.role]}</Text>
    </View>
  );
}
