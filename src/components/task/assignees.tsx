import { Alert, Text, View } from "react-native";

import { useSetAssignees } from "@/api/tasks.api";
import { useMembers } from "@/api/workspaces.api";
import { describeLoadError } from "@/components/screen-states";
import { Chip, TaskSection } from "@/components/task/section";
import { personName } from "@/lib/format";
import { Users } from "@/lib/icons";
import type { Person } from "@/types/api.types";

/** Assignees: tap members to toggle. At least one must stay (server rule). */
export function Assignees({ wid, tid, assignees }: { wid: string; tid: string; assignees: Person[] }) {
  const members = useMembers(wid);
  const set = useSetAssignees(wid, tid);
  const selected = new Set(assignees.map((a) => a.id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) {
      Alert.alert("Someone has to own it", "A task needs at least one assignee.");
      return;
    }
    set.mutate([...next], { onError: (err) => Alert.alert("Couldn't change assignees", describeLoadError(err)) });
  };

  return (
    <TaskSection title="Assigned to" icon={Users}>
      {members.isError ? (
        <Text className="text-muted-foreground font-sans text-[13px]">{describeLoadError(members.error)}</Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {(members.data ?? assignees).map((m) => (
            <Chip
              key={m.id}
              label={personName(m)}
              selected={selected.has(m.id)}
              disabled={set.isPending}
              onPress={() => toggle(m.id)}
            />
          ))}
        </View>
      )}
    </TaskSection>
  );
}
