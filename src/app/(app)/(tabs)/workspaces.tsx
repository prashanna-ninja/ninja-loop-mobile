import { router } from "expo-router";
import * as React from "react";
import { Alert, RefreshControl, Text, View } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset, useSharedValue } from "react-native-reanimated";

import { useReorderWorkspaces, useWorkspaces } from "@/api/workspaces.api";
import { AppHeader } from "@/components/app-header";
import { FadeIn } from "@/components/login/fade-in";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError, EmptyState, ErrorState } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableWorkspaceList } from "@/components/workspaces/sortable-workspace-list";
import { Layers, Plus } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/**
 * Workspaces tab — every workspace you're in, in YOUR order (web: the dashboard's
 * sortable grid). Hold and drag to reorder (saved with PUT /workspaces/order,
 * optimistic, also reorders the Dashboard); tap to open the board; + New to create.
 */
export default function WorkspacesScreen() {
  const c = useThemeColors();
  const workspaces = useWorkspaces();
  const reorder = useReorderWorkspaces();
  const [dragging, setDragging] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  // Lets a lifted row auto-scroll the page near the top / bottom edge.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const contentHeight = useSharedValue(0);

  const list = workspaces.data ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await workspaces.refetch();
    setRefreshing(false);
  };

  const onReorder = React.useCallback(
    (orderedIds: string[]) =>
      reorder.mutate(orderedIds, {
        onError: (err) => Alert.alert("Couldn't save the new order", describeLoadError(err)),
      }),
    [reorder],
  );

  const onOpen = React.useCallback(
    (wid: string) => router.push({ pathname: "/workspace/[wid]", params: { wid } }),
    [],
  );

  return (
    <View className="bg-background flex-1">
      <AppHeader />
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={!dragging}
        onContentSizeChange={(_w, h) => contentHeight.set(h)}
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        <FadeIn>
          <View className="flex-row items-end justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="font-display text-foreground text-[26px] tracking-tight">Workspaces</Text>
              <Text className="text-muted-foreground font-sans text-[13px] leading-5">
                {list.length > 1 ? "Hold and drag to reorder. Your order, only you see it." : "Each one is a priority queue."}
              </Text>
            </View>
            <PressableSurface
              onPress={() => router.push("/workspace/new")}
              accessibilityLabel="New workspace"
              hitSlop={6}
              className="bg-primary flex-row items-center gap-1 rounded-full px-3.5 py-2"
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text className="font-sans-semibold text-primary-foreground text-[13.5px]">New</Text>
            </PressableSurface>
          </View>
        </FadeIn>

        {workspaces.isPending ? (
          <View className="gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
          </View>
        ) : workspaces.isError ? (
          <ErrorState error={workspaces.error} onRetry={() => void workspaces.refetch()} />
        ) : list.length === 0 ? (
          <View className="bg-card border-border rounded-2xl border">
            <EmptyState
              icon={Layers}
              title="No workspaces yet"
              body="Create one with + New, or accept an invite on the web."
            />
          </View>
        ) : (
          <FadeIn delay={60}>
            <SortableWorkspaceList
              workspaces={list}
              onReorder={onReorder}
              onOpen={onOpen}
              onDragChange={setDragging}
              scroll={{ ref: scrollRef, offset: scrollOffset, contentHeight }}
            />
          </FadeIn>
        )}
      </Animated.ScrollView>
    </View>
  );
}
