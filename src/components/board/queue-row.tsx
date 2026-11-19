import { Text, View } from "react-native";

import { AvatarStack } from "@/components/avatar-stack";
import { DueBadge } from "@/components/due-badge";
import { PressableSurface } from "@/components/pressable-surface";
import { isSnoozed } from "@/lib/date-presets";
import { AlarmClock, Ban, Check, ListChecks } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { TaskSummary } from "@/types/api.types";

/**
 * One task in the priority queue (web: snake-board node + card).
 * Left: the queue node — #1 is the teal "next up" node from the sign-in hero.
 * The node doubles as the complete toggle (tap the circle → done).
 * Body opens the task. Completed tasks render dimmed with a check node.
 */
export function QueueRow({
  task,
  index,
  onOpen,
  onToggleDone,
}: {
  task: TaskSummary;
  /** Position in the OPEN queue (0 = next up); ignored for completed tasks. */
  index: number;
  onOpen: () => void;
  onToggleDone: () => void;
}) {
  const c = useThemeColors();
  const done = !!task.completedAt;
  const isNext = !done && index === 0;
  const blocked = !!task.blockedReason;
  const snoozed = isSnoozed(task.snoozeUntil);

  return (
    <View className={`bg-card flex-row items-start gap-3 rounded-2xl border px-3.5 py-3 ${isNext ? "border-accent/50" : "border-border"} ${done ? "opacity-60" : ""}`}>
      <PressableSurface
        onPress={onToggleDone}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-0.5 h-8 w-8 items-center justify-center rounded-full ${
          done ? "bg-success" : isNext ? "bg-accent" : "border-border bg-muted border"
        }`}
      >
        {done ? (
          <Check size={16} color="#FFFFFF" strokeWidth={3} />
        ) : (
          <Text className={`font-sans-bold text-xs ${isNext ? "text-accent-foreground" : "text-muted-foreground"}`}>
            {index + 1}
          </Text>
        )}
      </PressableSurface>

      <PressableSurface onPress={onOpen} accessibilityLabel={`Open ${task.title}`} className="flex-1 gap-2">
        <View className="gap-0.5">
          {isNext ? (
            <Text className="font-sans-bold text-accent text-[10.5px] uppercase tracking-wider">Next up</Text>
          ) : null}
          <Text
            className={`font-sans-semibold text-foreground text-[15px] leading-[21px] ${done ? "line-through" : ""}`}
            numberOfLines={3}
          >
            {task.title}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {task.dueDate && !done ? <DueBadge due={task.dueDate} /> : null}
          {blocked && !done ? (
            <View className="bg-destructive/10 flex-row items-center gap-1 rounded-full px-2 py-1">
              <Ban size={12} color={c.destructive} strokeWidth={2.4} />
              <Text className="font-sans-semibold text-destructive text-xs">Blocked</Text>
            </View>
          ) : null}
          {snoozed && !done ? (
            <View className="bg-muted flex-row items-center gap-1 rounded-full px-2 py-1">
              <AlarmClock size={12} color={c.mutedForeground} strokeWidth={2.2} />
              <Text className="font-sans-semibold text-muted-foreground text-xs">Snoozed</Text>
            </View>
          ) : null}
          {task.subTaskCount > 0 ? (
            <View className="flex-row items-center gap-1">
              <ListChecks size={13} color={c.subtle} strokeWidth={2} />
              <Text className="text-muted-foreground font-sans-medium text-xs" style={{ fontVariant: ["tabular-nums"] }}>
                {task.subTaskDoneCount}/{task.subTaskCount}
              </Text>
            </View>
          ) : null}
          <View className="ml-auto">
            <AvatarStack people={task.assignees} size={22} />
          </View>
        </View>
      </PressableSurface>
    </View>
  );
}
