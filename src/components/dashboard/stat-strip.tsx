import { Text, View } from "react-native";

import type { DashboardInsights } from "@/types/api.types";

/**
 * "This week at a glance" (web: DashboardInsightsStrip) — three numbers in one
 * card, hairline-divided. Overdue turns red only when it's non-zero.
 */
export function StatStrip({ insights }: { insights: DashboardInsights }) {
  const stats = [
    { label: "Open", value: insights.openPriorityTaskCount, tone: "text-foreground" },
    {
      label: "Overdue",
      value: insights.overdueOpenCount,
      tone: insights.overdueOpenCount > 0 ? "text-destructive" : "text-foreground",
    },
    { label: "Done", value: insights.tasksCompletedThisWeek, tone: "text-success" },
  ];

  return (
    <View className="gap-2">
      <Text className="text-muted-foreground font-sans-semibold px-1 text-xs uppercase tracking-wider">
        This week at a glance
      </Text>
      <View className="bg-card border-border flex-row overflow-hidden rounded-2xl border">
        {stats.map((s, i) => (
          <View key={s.label} className={`flex-1 gap-1 px-4 py-3.5 ${i > 0 ? "border-border border-l" : ""}`}>
            <Text className={`font-display text-[26px] leading-8 ${s.tone}`} style={{ fontVariant: ["tabular-nums"] }}>
              {s.value}
            </Text>
            <Text
              className="text-muted-foreground font-sans-medium text-[11.5px] uppercase tracking-wider"
              numberOfLines={1}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
