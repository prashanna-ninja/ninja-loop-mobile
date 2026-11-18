import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { timeAgo } from "@/lib/format";
import { BellRing, MessageSquare, UserPlus, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { NotificationItem } from "@/types/api.types";

/** Server `kind` values (web lib/actions/*: createNotificationInternal calls). */
const KIND_ICON: Record<string, IconComponent> = {
  task_assigned: UserPlus,
  task_comment: MessageSquare,
  priority_request: BellRing,
};

/**
 * One notification. Unread = bold title + a primary dot. Tapping marks it read;
 * opening its target (task / requests) is wired up once the board screen exists.
 */
export function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const c = useThemeColors();
  const unread = !item.readAt;
  const Icon = KIND_ICON[item.kind] ?? BellRing;

  return (
    <PressableSurface
      onPress={onPress}
      accessibilityLabel={`${unread ? "Unread. " : ""}${item.title}`}
      className={`flex-row gap-3.5 rounded-2xl border px-4 py-3.5 ${unread ? "bg-card border-primary/25" : "bg-card border-border"}`}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${unread ? "bg-primary/10" : "bg-muted"}`}>
        <Icon size={17} color={unread ? c.primary : c.mutedForeground} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-1">
        <Text
          className={`text-foreground text-[14.5px] leading-5 ${unread ? "font-sans-bold" : "font-sans-medium"}`}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.body ? (
          <Text className="text-muted-foreground font-sans text-[13px] leading-[18px]" numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text className="text-muted-foreground font-sans text-[11.5px]">{timeAgo(item.createdAt)}</Text>
      </View>
      {unread ? <View className="bg-primary mt-1.5 h-2 w-2 rounded-full" /> : null}
    </PressableSurface>
  );
}
