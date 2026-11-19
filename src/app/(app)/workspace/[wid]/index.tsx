import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, Text, View } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset, useSharedValue } from "react-native-reanimated";

import { describeLoadError, EmptyState, ErrorState } from "@/components/screen-states";
import { AddTaskBar } from "@/components/board/add-task-bar";
import { QueueRow } from "@/components/board/queue-row";
import { PressableSurface } from "@/components/pressable-surface";
import { HeaderIconButton, ScreenHeader } from "@/components/screen-header";
import { SortableList } from "@/components/sortable/sortable-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTask, useMoveTask, useUpdateTask, useWorkspace, useWorkspaceTasks } from "@/api/workspaces.api";
import { Eye, EyeOff, ListTodo, Megaphone, Settings, Users } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { TaskSummary } from "@/types/api.types";

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" } as const;

/**
 * Workspace board — web /b/[slug]/board as one vertical priority queue:
 * the top task is what to do next. Add tasks (they go to the top), hold and drag
 * to reprioritise (PUT …/position with the new neighbours), tap the node to
 * complete, tap a task to open it. Non-owners can "Request update".
 */
export default function BoardScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const c = useThemeColors();
  const [showDone, setShowDone] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  // Lets a lifted task auto-scroll the queue near the top / bottom edge.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const contentHeight = useSharedValue(0);

  const workspace = useWorkspace(wid);
  const tasks = useWorkspaceTasks(wid, showDone);
  const createTask = useCreateTask(wid);
  const updateTask = useUpdateTask(wid);
  const moveTask = useMoveTask(wid);

  const rows = tasks.data ?? [];
  const open = rows.filter((t) => !t.completedAt);
  const done = rows.filter((t) => t.completedAt);
  const ws = workspace.data;
  const canRequest = ws && ws.role !== "OWNER";

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([tasks.refetch(), workspace.refetch()]);
    setRefreshing(false);
  };

  const toggleDone = (tid: string, completed: boolean) =>
    updateTask.mutate(
      { tid, patch: { completed } },
      { onError: (err) => Alert.alert("Couldn't update the task", describeLoadError(err)) },
    );

  const addTask = (title: string) =>
    createTask.mutate(
      { title },
      { onError: (err) => Alert.alert("Couldn't add the task", describeLoadError(err)) },
    );

  // Neighbours in position order (top → bottom); omit afterId = top, omit beforeId = bottom.
  const onReorder = (orderedIds: string[], { id, to }: { id: string; to: number }) =>
    moveTask.mutate(
      { tid: id, toIndex: to, afterId: orderedIds[to - 1], beforeId: orderedIds[to + 1] },
      { onError: (err) => Alert.alert("Couldn't move the task", describeLoadError(err)) },
    );

  const openTask = (tid: string) => router.push({ pathname: "/workspace/[wid]/task/[tid]", params: { wid, tid } });

  const subtitle = ws
    ? `${ROLE_LABEL[ws.role]} · ${ws.memberCount} ${ws.memberCount === 1 ? "member" : "members"}`
    : undefined;

  return (
    <View className="bg-background flex-1">
      <ScreenHeader
        title={ws?.name ?? "Workspace"}
        subtitle={subtitle}
        right={
          <>
            <HeaderIconButton
              icon={Users}
              label="Members"
              onPress={() => router.push({ pathname: "/workspace/[wid]/members", params: { wid } })}
            />
            <HeaderIconButton
              icon={showDone ? EyeOff : Eye}
              label={showDone ? "Hide completed tasks" : "Show completed tasks"}
              onPress={() => setShowDone((v) => !v)}
              color={showDone ? c.primary : undefined}
            />
            {ws && ws.role !== "MEMBER" ? (
              <HeaderIconButton
                icon={Settings}
                label="Workspace settings"
                onPress={() => router.push({ pathname: "/workspace/[wid]/settings", params: { wid } })}
              />
            ) : null}
          </>
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.ScrollView
          ref={scrollRef}
          scrollEnabled={!dragging}
          onContentSizeChange={(_w, h) => contentHeight.set(h)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
        >
          <View className="mb-1.5 gap-3">
            <AddTaskBar onAdd={addTask} pending={createTask.isPending} />
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-muted-foreground font-sans flex-1 text-[12.5px]" numberOfLines={1}>
                {open.length > 1
                  ? `${open.length} in the queue · hold and drag to reorder`
                  : open.length === 1
                    ? "1 in the queue · top is next"
                    : " "}
              </Text>
              {canRequest ? (
                <PressableSurface
                  onPress={() => router.push({ pathname: "/workspace/[wid]/request", params: { wid } })}
                  accessibilityLabel="Ask the owner to review priorities"
                  className="flex-row items-center gap-1.5 py-1 pl-2"
                >
                  <Megaphone size={14} color={c.primary} strokeWidth={2.2} />
                  <Text className="font-sans-semibold text-primary text-[13px]">Request update</Text>
                </PressableSurface>
              ) : null}
            </View>
          </View>

          {tasks.isPending ? (
            <View className="gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[78px] rounded-2xl" />
              ))}
            </View>
          ) : tasks.isError ? (
            <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
          ) : open.length === 0 && !(showDone && done.length) ? (
            <EmptyState
              icon={ListTodo}
              title="The queue is empty"
              body="Add a task above. Whatever sits at the top is what to do next."
            />
          ) : (
            <>
              <SortableList<TaskSummary>
                data={open}
                keyOf={(t) => t.id}
                labelOf={(t) => t.title}
                onReorder={onReorder}
                onDragChange={setDragging}
                scroll={{ ref: scrollRef, offset: scrollOffset, contentHeight }}
                renderItem={(task, { index, guard }) => (
                  <QueueRow
                    task={task}
                    index={index}
                    onToggleDone={guard(() => toggleDone(task.id, true))}
                    onOpen={guard(() => openTask(task.id))}
                  />
                )}
              />

              {showDone && done.length ? (
                <>
                  <Text className="text-muted-foreground font-sans-semibold mt-3 px-1 text-xs uppercase tracking-wider">
                    Done · {done.length}
                  </Text>
                  {done.map((task) => (
                    <QueueRow
                      key={task.id}
                      task={task}
                      index={-1}
                      onToggleDone={() => toggleDone(task.id, false)}
                      onOpen={() => openTask(task.id)}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
