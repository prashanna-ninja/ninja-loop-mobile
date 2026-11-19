import { Text, View } from "react-native";

import { ROLE_LABEL, urgencySignal } from "@/components/dashboard/workspace-card";
import { PressableSurface } from "@/components/pressable-surface";
import { SortableList, type SortableScroll } from "@/components/sortable/sortable-list";
import { ChevronRight, GripVertical } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { DashboardWorkspace } from "@/types/api.types";

/** Workspaces tab list: hold and drag to reorder (SortableList), tap to open the board. */
export function SortableWorkspaceList({
  workspaces,
  onReorder,
  onOpen,
  onDragChange,
  scroll,
}: {
  workspaces: DashboardWorkspace[];
  onReorder: (orderedIds: string[]) => void;
  onOpen: (id: string) => void;
  onDragChange?: (dragging: boolean) => void;
  scroll?: SortableScroll;
}) {
  return (
    <SortableList
      data={workspaces}
      keyOf={(w) => w.id}
      labelOf={(w) => w.name}
      onReorder={(ids) => onReorder(ids)}
      onDragChange={onDragChange}
      scroll={scroll}
      renderItem={(w, { guard }) => <WorkspaceRow workspace={w} onOpen={guard(() => onOpen(w.id))} />}
    />
  );
}

function WorkspaceRow({ workspace: w, onOpen }: { workspace: DashboardWorkspace; onOpen: () => void }) {
  const c = useThemeColors();
  const signal = urgencySignal(w, c);
  const monogram = w.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <PressableSurface
      onPress={onOpen}
      pressedOpacity={0.85}
      accessibilityLabel={`Open ${w.name}, ${ROLE_LABEL[w.role]}${signal ? `, ${signal.text}` : ""}`}
      className="bg-card border-border flex-row items-center gap-3 rounded-2xl border py-3.5 pl-2 pr-3"
    >
      <GripVertical size={18} color={c.subtle} strokeWidth={2} />
      <View className="bg-primary/10 h-11 w-11 items-center justify-center rounded-xl">
        <Text className="font-display text-primary text-lg">{monogram}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-bold text-foreground text-[15.5px] tracking-tight" numberOfLines={1}>
          {w.name}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-muted-foreground font-sans-medium text-xs">{ROLE_LABEL[w.role]}</Text>
          {signal ? (
            <>
              <Text className="text-muted-foreground text-xs">·</Text>
              <Text className="font-sans-semibold text-xs" style={{ color: signal.color }}>
                {signal.text}
              </Text>
            </>
          ) : null}
        </View>
        <Text className="text-muted-foreground font-sans text-[12.5px]" numberOfLines={1}>
          {w.nextPriorityTaskTitle ? (
            <>
              <Text className="font-sans-semibold text-foreground">Next: </Text>
              {w.nextPriorityTaskTitle}
            </>
          ) : (
            "No tasks in the queue"
          )}
        </Text>
      </View>
      <ChevronRight size={18} color={c.subtle} strokeWidth={2} />
    </PressableSurface>
  );
}
