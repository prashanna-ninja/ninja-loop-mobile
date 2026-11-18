import { ActivityIndicator, Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { timeAgo } from "@/lib/format";
import { Check, Layers } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { PriorityRequest } from "@/types/api.types";

/**
 * A priority request sent to you (web: RequestsInbox). Open requests show the
 * full message and a "Mark done" action; addressed ones are a dimmed summary.
 */
export function RequestCard({
  request: r,
  onMarkDone,
  pending,
}: {
  request: PriorityRequest;
  onMarkDone?: () => void;
  pending?: boolean;
}) {
  const c = useThemeColors();
  const open = r.status === "OPEN";
  const from = r.fromUser.name || r.fromUser.email;

  return (
    <View className={`bg-card border-border gap-3 rounded-2xl border p-4 ${open ? "" : "opacity-70"}`}>
      <View className="flex-row items-center gap-2">
        <Layers size={14} color={c.subtle} strokeWidth={2} />
        <Text className="font-sans-semibold text-foreground flex-1 text-[13.5px]" numberOfLines={1}>
          {r.business.name}
        </Text>
        <Text className="text-muted-foreground font-sans text-xs">{timeAgo(r.createdAt)}</Text>
      </View>

      <Text className="text-muted-foreground font-sans text-[13px]">
        From <Text className="font-sans-semibold text-foreground">{from}</Text>
        {r.task ? (
          <>
            {" · "}Task: <Text className="font-sans-semibold text-foreground">{r.task.title}</Text>
          </>
        ) : null}
      </Text>

      <View className="border-primary/40 border-l-2 pl-3">
        <Text className="text-foreground font-sans text-[14.5px] leading-[21px]" numberOfLines={open ? undefined : 2}>
          {r.message}
        </Text>
      </View>

      {open && onMarkDone ? (
        <PressableSurface
          onPress={onMarkDone}
          disabled={pending}
          accessibilityLabel="Mark request done"
          className="border-border flex-row items-center gap-2 self-start rounded-full border px-3.5 py-2"
        >
          {pending ? <ActivityIndicator size="small" color={c.mutedForeground} /> : <Check size={15} color={c.success} strokeWidth={2.4} />}
          <Text className="font-sans-semibold text-foreground text-[13.5px]">Mark done</Text>
        </PressableSurface>
      ) : null}
    </View>
  );
}
