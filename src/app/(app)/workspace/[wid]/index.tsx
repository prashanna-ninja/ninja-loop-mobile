import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, RefreshControl, Text, View } from "react-native";

import { describeLoadError, EmptyState, ErrorState } from "@/components/screen-states";
import { AddTaskBar } from "@/components/board/add-task-bar";
import { QueueRow } from "@/components/board/queue-row";
import { PressableSurface } from "@/components/pressable-surface";
import { HeaderIconButton, ScreenHeader } from "@/components/screen-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTask, useUpdateTask, useWorkspace, useWorkspaceTasks } from "@/api/workspaces.api";
import { Eye, EyeOff, ListTodo, Megaphone, Users } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" } as const;

/**
 * Workspace board — web /b/[slug]/board as one vertical priority queue:
 * the top task is what to do next. Add tasks (they go to the top), tap the
 * node to complete, tap a task to open it (reorder, dates, checklist, comments).
 * Non-owners can ask the owner to review priorities ("Request update").
 */
export default function BoardScreen() {
  const { wid } = useLocalSearchParams<{ wid: string }>();
  const c = useThemeColors();
  const [showDone, setShowDone] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const workspace = useWorkspace(wid);
  const tasks = useWorkspaceTasks(wid, showDone);
  const createTask = useCreateTask(wid);
  const updateTask = useUpdateTask(wid);

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

  const subtitle = ws
    ? `${ROLE_LABEL[ws.role]} · ${ws.memberCount} ${ws.memberCount === 1 ? "member" : "members"}`
    : undefined;

  // One list: open queue, then (optionally) a "Done" header + completed tasks.
  type Item = { kind: "task"; id: string; index: number } | { kind: "done-header" };
  const items: Item[] = [
    ...open.map((t, i) => ({ kind: "task" as const, id: t.id, index: i })),
    ...(showDone && done.length ? [{ kind: "done-header" as const }] : []),
    ...(showDone ? done.map((t) => ({ kind: "task" as const, id: t.id, index: -1 })) : []),
  ];
  const byId = new Map(rows.map((t) => [t.id, t]));

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
          </>
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={tasks.isPending || tasks.isError ? [] : items}
          keyExtractor={(it) => (it.kind === "task" ? it.id : "done-header")}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={
            <View className="mb-1.5 gap-3">
              <AddTaskBar onAdd={addTask} pending={createTask.isPending} />
              <View className="flex-row items-center justify-between px-1">
                <Text className="text-muted-foreground font-sans text-[12.5px]">
                  {open.length > 0 ? `${open.length} in the queue · top is next` : " "}
                </Text>
                {canRequest ? (
                  <PressableSurface
                    onPress={() => router.push({ pathname: "/workspace/[wid]/request", params: { wid } })}
                    accessibilityLabel="Ask the owner to review priorities"
                    className="flex-row items-center gap-1.5 py-1"
                  >
                    <Megaphone size={14} color={c.primary} strokeWidth={2.2} />
                    <Text className="font-sans-semibold text-primary text-[13px]">Request update</Text>
                  </PressableSurface>
                ) : null}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "done-header") {
              return (
                <Text className="text-muted-foreground font-sans-semibold mt-3 px-1 text-xs uppercase tracking-wider">
                  Done · {done.length}
                </Text>
              );
            }
            const task = byId.get(item.id);
            if (!task) return null;
            return (
              <QueueRow
                task={task}
                index={item.index}
                onToggleDone={() => toggleDone(task.id, !task.completedAt)}
                onOpen={() =>
                  router.push({ pathname: "/workspace/[wid]/task/[tid]", params: { wid, tid: task.id } })
                }
              />
            );
          }}
          ListEmptyComponent={
            tasks.isPending ? (
              <View className="gap-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[78px] rounded-2xl" />
                ))}
              </View>
            ) : tasks.isError ? (
              <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} />
            ) : (
              <EmptyState
                icon={ListTodo}
                title="The queue is empty"
                body="Add a task above. Whatever sits at the top is what to do next."
              />
            )
          }
        />
      </KeyboardAvoidingView>
    </View>
  );
}
