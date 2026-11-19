import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { FlatList, RefreshControl, Text, View } from "react-native";
import * as React from "react";

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/api/notifications.api";
import { AppHeader } from "@/components/app-header";
import { NotificationRow } from "@/components/notifications/notification-row";
import { PressableSurface } from "@/components/pressable-surface";
import { EmptyState, ErrorState } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { NotificationTarget } from "@/types/api.types";

/** Deep-link a notification (MOBILE-API.md: use `target`, ignore the web `href`). */
function openTarget(target: NotificationTarget | null) {
  if (!target) return;
  if (target.type === "task") {
    router.push({ pathname: "/workspace/[wid]/task/[tid]", params: { wid: target.workspaceId, tid: target.taskId } });
  } else if (target.type === "requests") {
    router.navigate("/inbox");
  } else if (target.type === "url" && /^https?:\/\//i.test(target.href)) {
    void WebBrowser.openBrowserAsync(target.href);
  }
}

/**
 * Alerts — web /dashboard/notifications: assignments, comments and priority
 * requests, newest first, paginated as you scroll. "Mark all read" clears the badge.
 */
export default function AlertsScreen() {
  const c = useThemeColors();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [refreshing, setRefreshing] = React.useState(false);

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  return (
    <View className="bg-background flex-1">
      <AppHeader />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          <View className="mb-2 gap-0.5">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="font-display text-foreground text-[26px] tracking-tight">Alerts</Text>
              {hasUnread ? (
                <PressableSurface
                  onPress={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  accessibilityLabel="Mark all read"
                  className="border-border bg-card flex-row items-center gap-1.5 rounded-full border px-3 py-2"
                >
                  <CheckCheck size={15} color={c.primary} strokeWidth={2.2} />
                  <Text className="font-sans-semibold text-primary text-[13px]">Mark all read</Text>
                </PressableSurface>
              ) : null}
            </View>
            <Text className="text-muted-foreground font-sans text-[13px]">Assignments, comments and requests.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={() => {
              if (!item.readAt) markRead.mutate(item.id);
              openTarget(item.target);
            }}
          />
        )}
        ListEmptyComponent={
          query.isPending ? (
            <View className="gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[76px] rounded-2xl" />
              ))}
            </View>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState icon={Bell} title="You're all caught up" body="Assignments, comments and requests will show up here." />
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <Skeleton className="h-[76px] rounded-2xl" /> : undefined}
      />
    </View>
  );
}
