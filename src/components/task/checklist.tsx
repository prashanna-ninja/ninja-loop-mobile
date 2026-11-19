import * as React from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { useAddSubtask, useDeleteSubtask, useToggleSubtask } from "@/api/tasks.api";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError } from "@/components/screen-states";
import { TaskSection, TextAction } from "@/components/task/section";
import { ListChecks, Square, SquareCheckBig, X } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { SubTask } from "@/types/api.types";

/** Checklist (subtasks): toggle, delete, add at the end. All optimistic. */
export function Checklist({ wid, tid, items }: { wid: string; tid: string; items: SubTask[] }) {
  const c = useThemeColors();
  const add = useAddSubtask(wid, tid);
  const toggle = useToggleSubtask(wid, tid);
  const remove = useDeleteSubtask(wid, tid);
  const [draft, setDraft] = React.useState("");
  const doneCount = items.filter((s) => s.completedAt).length;
  const onError = (err: unknown) => Alert.alert("Couldn't update the checklist", describeLoadError(err));

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    add.mutate(title, { onError });
    setDraft("");
  };

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
      {items.map((s) => {
        const done = !!s.completedAt;
        // Optimistic rows have a temp id until the server answers — not editable yet.
        const temp = s.id.startsWith("temp-");
        return (
          <View key={s.id} className="flex-row items-center gap-3">
            <PressableSurface
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              accessibilityLabel={s.title}
              disabled={temp}
              onPress={() => toggle.mutate({ sid: s.id, completed: !done }, { onError })}
              className="flex-1 flex-row items-center gap-3 py-1"
            >
              {done ? (
                <SquareCheckBig size={20} color={c.success} strokeWidth={2} />
              ) : (
                <Square size={20} color={c.subtle} strokeWidth={2} />
              )}
              <Text
                className={`font-sans flex-1 text-[14.5px] leading-5 ${
                  done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {s.title}
              </Text>
            </PressableSurface>
            <PressableSurface
              accessibilityLabel={`Delete ${s.title}`}
              hitSlop={8}
              disabled={temp}
              onPress={() => remove.mutate(s.id, { onError })}
            >
              <X size={17} color={c.subtle} strokeWidth={2} />
            </PressableSurface>
          </View>
        );
      })}
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
    </TaskSection>
  );
}
