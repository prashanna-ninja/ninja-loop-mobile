import { Text, View } from "react-native";

import { DueBadge } from "@/components/due-badge";
import { getDueUrgency, urgencyColor } from "@/lib/due-urgency";
import { Layers } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { DashboardUrgentTask } from "@/types/api.types";

/**
 * One urgent task (web: DashboardUrgentTasks row): urgency strip on the left,
 * queue position, title, workspace, due badge. #1 wears the teal "next up" node
 * from the sign-in hero — the same queue, now with your real work in it.
 *
 * Not pressable yet: the task sheet arrives with the board screen.
 */
export function UrgentTaskRow({ task, index }: { task: DashboardUrgentTask; index: number }) {
  const c = useThemeColors();
  const u = getDueUrgency(task.dueDate);
  const isNext = index === 0;

  return (
    <View className="bg-card border-border flex-row overflow-hidden rounded-2xl border">
      <View style={{ width: 4, backgroundColor: urgencyColor(u.level, c) }} />
      <View className="flex-1 flex-row gap-3.5 px-4 py-3.5">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${isNext ? "bg-accent" : "border-border bg-muted border"}`}
        >
          <Text className={`font-sans-bold text-xs ${isNext ? "text-accent-foreground" : "text-muted-foreground"}`}>
            {index + 1}
          </Text>
        </View>
        <View className="flex-1 gap-2">
          <Text className="font-sans-semibold text-foreground text-[15.5px] leading-[21px]" numberOfLines={2}>
            {task.title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
            <DueBadge due={task.dueDate} />
            <View className="min-w-0 flex-shrink flex-row items-center gap-1.5">
              <Layers size={13} color={c.subtle} strokeWidth={2} />
              <Text className="text-muted-foreground font-sans-medium flex-shrink text-[13px]" numberOfLines={1}>
                {task.businessName}
              </Text>
            </View>
            {u.hint && (u.level === "overdue" || u.level === "this_week") ? (
              <Text className="font-sans text-[12.5px]" style={{ color: urgencyColor(u.level, c) }}>
                {u.hint}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
