import { router } from "expo-router";
import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";

import { useThemeColors, type ThemeColors } from "@/lib/theme";
import type { DashboardWorkspace, WorkspaceRole } from "@/types/api.types";

const ROLE_LABEL: Record<WorkspaceRole, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member" };

/** The single most pressing signal for a workspace (web: UrgencyBar). */
function urgencySignal(w: DashboardWorkspace, c: ThemeColors) {
  if (w.overdueCount > 0) return { text: `${w.overdueCount} overdue`, color: c.destructive };
  if (w.dueTodayCount > 0) return { text: `${w.dueTodayCount} due today`, color: c.today };
  if (w.dueSoonCount > 0) return { text: `${w.dueSoonCount} this week`, color: c.thisWeek };
  return null;
}

/**
 * Workspace card (web: DashboardWorkspaces card): monogram, name, role,
 * urgency signal, and the "Next up" task. Tap → the board. Reordering is web-only for now.
 */
export function WorkspaceCard({ workspace: w }: { workspace: DashboardWorkspace }) {
  const c = useThemeColors();
  const signal = urgencySignal(w, c);
  const monogram = w.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <PressableSurface
      onPress={() => router.push({ pathname: "/workspace/[wid]", params: { wid: w.id } })}
      accessibilityLabel={`Open ${w.name}`}
      className="bg-card border-border gap-3 rounded-2xl border p-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-xl">
          <Text className="font-display text-primary text-lg">{monogram}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-sans-bold text-foreground text-base tracking-tight" numberOfLines={1}>
            {w.name}
          </Text>
          <Text className="text-muted-foreground font-sans-medium text-xs">{ROLE_LABEL[w.role]}</Text>
        </View>
        {signal ? (
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${signal.color}1F` }}>
            <Text className="font-sans-semibold text-xs" style={{ color: signal.color }}>
              {signal.text}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="border-border border-t pt-3">
        {w.nextPriorityTaskTitle ? (
          <Text className="text-muted-foreground font-sans text-[13.5px] leading-5" numberOfLines={2}>
            <Text className="font-sans-semibold text-foreground">Next up: </Text>
            {w.nextPriorityTaskTitle}
          </Text>
        ) : (
          <Text className="text-muted-foreground font-sans text-[13.5px]">No tasks in the queue</Text>
        )}
      </View>
    </PressableSurface>
  );
}
