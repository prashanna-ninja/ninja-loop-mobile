import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { useMembers, useWorkspace } from "@/api/workspaces.api";
import { ScreenHeader } from "@/components/screen-header";
import { EmptyState, ErrorState } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { initials, personName } from "@/lib/format";
import { Users } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import { useSession } from "@/providers/session-provider";
import type { WorkspaceRole } from "@/types/api.types";

const ROLE_LABEL: Record<WorkspaceRole, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

/**
 * Members — web /b/[slug]/settings/members (read-only for now).
 * Inviting / removing people stays on the web until those screens are built.
 */
export default function MembersScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const c = useThemeColors();
  const { data: session } = useSession();
  const workspace = useWorkspace(wid);
  const members = useMembers(wid);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await members.refetch();
    setRefreshing(false);
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Members" subtitle={workspace.data?.name} />
      <FlatList
        data={members.data ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        renderItem={({ item: m }) => (
          <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border px-4 py-3">
            <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-full">
              <Text className="font-sans-bold text-primary text-sm">{initials(m)}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-foreground text-[15px]" numberOfLines={1}>
                {personName(m)}
                {m.id === session?.user?.id ? <Text className="text-muted-foreground font-sans"> (you)</Text> : null}
              </Text>
              <Text className="text-muted-foreground font-sans text-[13px]" numberOfLines={1}>
                {m.email}
              </Text>
            </View>
            <Text className="text-muted-foreground font-sans-semibold text-xs">{ROLE_LABEL[m.role]}</Text>
          </View>
        )}
        ListEmptyComponent={
          members.isPending ? (
            <View className="gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[64px] rounded-2xl" />
              ))}
            </View>
          ) : members.isError ? (
            <ErrorState error={members.error} onRetry={() => void members.refetch()} />
          ) : (
            <EmptyState icon={Users} title="No members" body="Invite people from Ninja Loop on the web." />
          )
        }
        ListFooterComponent={
          members.data?.length ? (
            <Text className="text-muted-foreground font-sans mt-2 px-1 text-center text-[12.5px]">
              Invite or remove people from Ninja Loop on the web.
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}
