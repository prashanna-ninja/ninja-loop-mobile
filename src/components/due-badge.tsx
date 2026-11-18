import { Text, View } from "react-native";

import { getDueUrgency, urgencyColor, type DueUrgencyLevel } from "@/lib/due-urgency";
import { Calendar, CalendarDays, Sun, Sunrise, TriangleAlert, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

const ICON: Record<DueUrgencyLevel, IconComponent> = {
  overdue: TriangleAlert,
  today: Sun,
  tomorrow: Sunrise,
  this_week: CalendarDays,
  later: Calendar,
  none: Calendar,
};

/** Due-date pill (web: DueDateUrgencyBadge) — tinted by urgency, icon + label. */
export function DueBadge({ due }: { due: string | null | undefined }) {
  const c = useThemeColors();
  const u = getDueUrgency(due);
  const color = urgencyColor(u.level, c);
  const Icon = ICON[u.level];

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      // 8-digit hex = colour at ~12% for the fill: one hue per level, no extra tokens.
      style={{ backgroundColor: `${color}1F` }}
    >
      <Icon size={13} color={color} strokeWidth={2.2} />
      <Text className="font-sans-semibold text-xs" style={{ color }}>
        {u.label}
      </Text>
    </View>
  );
}
