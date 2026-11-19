import * as React from "react";
import { Alert, Text, TextInput, View } from "react-native";

import {
  useAddSubtask,
  useClearCompletedSubtasks,
  useDeleteSubtask,
  useRenameSubtask,
  useReorderSubtasks,
  useToggleSubtask,
} from "@/api/tasks.api";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError } from "@/components/screen-states";
import { SortableList, type SortableScroll } from "@/components/sortable/sortable-list";
import { TaskSection, TextAction } from "@/components/task/section";
import { ListChecks, Square, SquareCheckBig, X } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { SubTask } from "@/types/api.types";

const isTemp = (id: string) => id.startsWith("temp-");

/**
 * Checklist (subtasks), like the web: tick, tap the text to rename, hold and drag to
 * reorder (PUT …/subtasks/order), delete, add at the end, "Clear done". All optimistic.
 */
export function Checklist({
  wid,
  tid,
  items,
  scroll,
  onDragChange,
}: {
  wid: string;
  tid: string;
  items: SubTask[];
  /** The task screen's Animated.ScrollView — auto-scrolls while dragging near an edge. */
  scroll?: SortableScroll;
  onDragChange?: (dragging: boolean) => void;
}) {
  const c = useThemeColors();
  const add = useAddSubtask(wid, tid);
  const toggle = useToggleSubtask(wid, tid);
  const remove = useDeleteSubtask(wid, tid);
  const rename = useRenameSubtask(wid, tid);
  const reorder = useReorderSubtasks(wid, tid);
  const clearDone = useClearCompletedSubtasks(wid, tid);
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const doneCount = items.filter((s) => s.completedAt).length;
  const onError = (err: unknown) => Alert.alert("Couldn't update the checklist", describeLoadError(err));

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    add.mutate(title, { onError });
    setDraft("");
  };

  const onReorder = (orderedIds: string[]) => {
    // A just-added item has no server id yet — the server would reject the whole order.
    if (orderedIds.some(isTemp)) return Alert.alert("Still saving", "Give it a second, then try again.");
    reorder.mutate(orderedIds, { onError });
  };

  const confirmClear = () =>
    Alert.alert(`Clear ${doneCount} done ${doneCount === 1 ? "item" : "items"}?`, "Ticked items are removed for everyone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearDone.mutate(undefined, { onError }) },
    ]);

  return (
    <TaskSection
      title="Checklist"
      icon={ListChecks}
      aside={
        items.length ? (
          <Text className="text-muted-foreground font-sans-medium text-xs" style={{ fontVariant: ["tabular-nums"] }}>
            {doneCount}/{items.length}
          </Text>
        ) : null
      }
    >
      {items.length ? (
        <SortableList<SubTask>
          data={items}
          keyOf={(s) => s.id}
          labelOf={(s) => s.title}
          gap={2}
          radius={10}
          scroll={scroll}
          onDragChange={onDragChange}
          onReorder={onReorder}
          renderItem={(s, { guard }) => (
            <ChecklistRow
              item={s}
              editing={editingId === s.id}
              onToggle={guard(() => toggle.mutate({ sid: s.id, completed: !s.completedAt }, { onError }))}
              onStartEdit={guard(() => setEditingId(s.id))}
              onRename={(title) => {
                setEditingId(null);
                if (title && title !== s.title) rename.mutate({ sid: s.id, title }, { onError });
              }}
              onDelete={guard(() => remove.mutate(s.id, { onError }))}
            />
          )}
        />
      ) : null}

      <View className={`flex-row items-center gap-3 ${items.length ? "border-border border-t pt-2.5" : ""}`}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add an item"
          placeholderTextColor={c.subtle}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={submit}
          maxLength={500}
          className="font-sans text-foreground flex-1 py-1.5 text-[14.5px]"
        />
        <TextAction label="Add" onPress={submit} disabled={!draft.trim()} />
      </View>

      {items.length ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-muted-foreground font-sans flex-1 text-xs">
            {items.length > 1 ? "Hold and drag to reorder · tap text to rename" : "Tap text to rename"}
          </Text>
          {doneCount ? <TextAction label="Clear done" tone="danger" onPress={confirmClear} /> : null}
        </View>
      ) : null}
    </TaskSection>
  );
}

function ChecklistRow({
  item: s,
  editing,
  onToggle,
  onStartEdit,
  onRename,
  onDelete,
}: {
  item: SubTask;
  editing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const c = useThemeColors();
  const done = !!s.completedAt;
  // Optimistic rows have a temp id until the server answers — not editable yet.
  const temp = isTemp(s.id);
  const [value, setValue] = React.useState(s.title);
  const begin = () => {
    setValue(s.title);
    onStartEdit();
  };

  return (
    <View className="bg-card flex-row items-center gap-3 py-1.5">
      <PressableSurface
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={s.title}
        hitSlop={6}
        disabled={temp}
        onPress={onToggle}
      >
        {done ? (
          <SquareCheckBig size={20} color={c.success} strokeWidth={2} />
        ) : (
          <Square size={20} color={c.subtle} strokeWidth={2} />
        )}
      </PressableSurface>

      {editing ? (
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={() => onRename(value.trim())}
          onBlur={() => onRename(value.trim())}
          maxLength={500}
          accessibilityLabel={`Rename ${s.title}`}
          className="font-sans text-foreground border-primary flex-1 border-b py-0.5 text-[14.5px] leading-5"
        />
      ) : (
        <PressableSurface onPress={begin} disabled={temp} accessibilityLabel={`${s.title}. Tap to rename`} className="flex-1">
          <Text className={`font-sans text-[14.5px] leading-5 ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {s.title}
          </Text>
        </PressableSurface>
      )}

      <PressableSurface accessibilityLabel={`Delete ${s.title}`} hitSlop={8} disabled={temp} onPress={onDelete}>
        <X size={17} color={c.subtle} strokeWidth={2} />
      </PressableSurface>
    </View>
  );
}
