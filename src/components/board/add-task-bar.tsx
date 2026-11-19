import * as React from "react";
import { ActivityIndicator, TextInput, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { Plus } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/**
 * "Add a task" — new tasks go to the TOP of the queue (server rule), so the
 * input sits above the list. Keeps focus after adding for rapid entry.
 */
export function AddTaskBar({ onAdd, pending }: { onAdd: (title: string) => void; pending: boolean }) {
  const c = useThemeColors();
  const [title, setTitle] = React.useState("");
  const trimmed = title.trim();

  const submit = () => {
    if (!trimmed || pending) return;
    onAdd(trimmed);
    setTitle("");
  };

  return (
    <View className="bg-card border-border flex-row items-center gap-2 rounded-2xl border py-1.5 pl-4 pr-1.5">
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Add a task to the top…"
        placeholderTextColor={c.subtle}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        maxLength={500}
        className="font-sans text-foreground flex-1 py-2 text-[15px]"
      />
      <PressableSurface
        onPress={submit}
        disabled={!trimmed || pending}
        accessibilityLabel="Add task"
        className={`h-10 w-10 items-center justify-center rounded-xl ${trimmed ? "bg-primary" : "bg-muted"}`}
      >
        {pending ? (
          <ActivityIndicator size="small" color={c.card} />
        ) : (
          <Plus size={20} color={trimmed ? "#FFFFFF" : c.subtle} strokeWidth={2.4} />
        )}
      </PressableSurface>
    </View>
  );
}
