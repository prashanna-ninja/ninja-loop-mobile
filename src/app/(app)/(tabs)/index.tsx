import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { useDashboard } from "@/api/dashboard.api";
import { AppHeader } from "@/components/app-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { UrgentTaskRow } from "@/components/dashboard/urgent-task-row";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { FadeIn } from "@/components/login/fade-in";
import { PressableSurface } from "@/components/pressable-surface";
import { EmptyState, ErrorState, SectionHeader } from "@/components/screen-states";
import { firstName, greeting } from "@/lib/format";
import { CircleCheck, Layers, Plus } from "@/lib/icons";
import { qk } from "@/lib/query-keys";
import { useThemeColors } from "@/lib/theme";
import { useSession } from "@/providers/session-provider";

/** "+ New" pill → the create-workspace screen (header size, or larger under the empty state). */
function NewWorkspaceButton({ large = false }: { large?: boolean }) {
  const c = useThemeColors();
  return (
    <PressableSurface
      onPress={() => router.push("/workspace/new")}
      accessibilityLabel="New workspace"
      hitSlop={6}
      className={`bg-primary/10 flex-row items-center gap-1 rounded-full ${large ? "px-4 py-2.5" : "px-3 py-1.5"}`}
    >
      <Plus size={large ? 17 : 15} color={c.primary} strokeWidth={2.4} />
      <Text className={`font-sans-semibold text-primary ${large ? "text-[14.5px]" : "text-[13px]"}`}>
        {large ? "New workspace" : "New"}
      </Text>
    </PressableSurface>
  );
}

/**
 * Home — web /dashboard: greeting, "this week at a glance", urgent tasks
 * (overdue + due this week, most pressing first), then your workspaces in your order.
 * Pull to refresh re-reads the dashboard AND the tab-badge counts.
 */
export default function DashboardScreen() {
  const c = useThemeColors();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const dashboard = useDashboard();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([dashboard.refetch(), qc.invalidateQueries({ queryKey: qk.me() })]);
    setRefreshing(false);
  };

  const data = dashboard.data;

  return (
    <View className="bg-background flex-1">
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 26, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        <FadeIn>
          <Text className="text-muted-foreground font-sans-medium text-sm">{greeting()},</Text>
          <Text className="font-display text-foreground text-[28px] leading-9 tracking-tight">
            {firstName(session?.user)}
          </Text>
        </FadeIn>

        {dashboard.isPending ? (
          <DashboardSkeleton />
        ) : dashboard.isError ? (
          <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        ) : data ? (
          <>
            <FadeIn delay={60}>
              <StatStrip insights={data.insights} />
            </FadeIn>

            <FadeIn delay={120} style={{ gap: 12 }}>
              <SectionHeader
                title="Urgent"
                count={data.urgentTasks.length || undefined}
                caption="Overdue or due this week, most pressing first."
              />
              {data.urgentTasks.length === 0 ? (
                <View className="bg-card border-border rounded-2xl border">
                  <EmptyState
                    icon={CircleCheck}
                    title="You're all caught up"
                    body="Priority tasks due this week, or overdue, will show up here."
                  />
                </View>
              ) : (
                data.urgentTasks.map((t, i) => <UrgentTaskRow key={t.id} task={t} index={i} />)
              )}
            </FadeIn>

            <FadeIn delay={180} style={{ gap: 12 }}>
              <SectionHeader
                title="Workspaces"
                count={data.workspaces.length || undefined}
                right={<NewWorkspaceButton />}
              />
              {data.workspaces.length === 0 ? (
                <View className="bg-card border-border items-center rounded-2xl border pb-6">
                  <EmptyState
                    icon={Layers}
                    title="No workspaces yet"
                    body="Create one, or accept an invite, and its priority queue will appear here."
                  />
                  <NewWorkspaceButton large />
                </View>
              ) : (
                data.workspaces.map((w) => <WorkspaceCard key={w.id} workspace={w} />)
              )}
            </FadeIn>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
