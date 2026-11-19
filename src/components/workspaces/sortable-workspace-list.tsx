import * as Haptics from "expo-haptics";
import * as React from "react";
import { Platform, Text, View } from "react-native";
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { ROLE_LABEL, urgencySignal } from "@/components/dashboard/workspace-card";
import { ChevronRight, GripVertical } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { DashboardWorkspace } from "@/types/api.types";

/**
 * Drag-to-reorder list of workspaces (web: dnd-kit sortable on the dashboard).
 *
 * Hold a row (~0.2 s) → it lifts (scale + shadow + haptic) → drag → the others
 * spring out of the way, with a tick each time the order changes → release → it
 * springs into its slot and `onReorder(ids)` fires once if the order changed.
 * Quick tap → `onOpen(id)`. Swipes before the hold completes scroll the page.
 *
 * Rows have a FIXED height so slot maths is just `index * SLOT` (no measuring).
 * Everything during a drag runs on the UI thread (Reanimated shared values;
 * Gesture Handler v3 runs worklet callbacks there). JS is only called for
 * haptics, open and the final drop (`scheduleOnRN`).
 */
export const ROW_HEIGHT = 88;
const GAP = 10;
const SLOT = ROW_HEIGHT + GAP;
const HOLD_MS = 200;
const SPRING = { damping: 24, stiffness: 280, mass: 0.9 };

type Positions = Record<string, number>;

const toPositions = (ids: string[]): Positions => Object.fromEntries(ids.map((id, i) => [id, i]));

export function SortableWorkspaceList({
  workspaces,
  onReorder,
  onOpen,
  onDragChange,
}: {
  workspaces: DashboardWorkspace[];
  /** New full order (top → bottom). Only called when it actually changed. */
  onReorder: (orderedIds: string[]) => void;
  onOpen: (id: string) => void;
  /** true while a row is lifted — e.g. to lock the parent ScrollView. */
  onDragChange?: (dragging: boolean) => void;
}) {
  const ids = workspaces.map((w) => w.id);
  const idsKey = ids.join("|");
  const positions = useSharedValue<Positions>(toPositions(ids));
  const activeId = useSharedValue<string | null>(null);

  // Server order changed (refetch, optimistic save, rollback) → re-slot, unless mid-drag.
  React.useEffect(() => {
    if (activeId.get() === null) positions.set(toPositions(idsKey ? idsKey.split("|") : []));
  }, [idsKey, activeId, positions]);

  const drop = React.useCallback(
    (final: Positions) => {
      onDragChange?.(false);
      const next = Object.keys(final).sort((a, b) => final[a] - final[b]);
      if (next.join("|") !== idsKey) onReorder(next);
    },
    [idsKey, onReorder, onDragChange],
  );

  const lift = React.useCallback(() => {
    onDragChange?.(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [onDragChange]);

  /** Screen-reader path: move one step without dragging. */
  const step = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    onReorder(next);
  };

  return (
    <View style={{ height: Math.max(0, ids.length * SLOT - GAP) }}>
      {workspaces.map((w, i) => (
        <SortableRow
          key={w.id}
          workspace={w}
          initialIndex={i}
          count={ids.length}
          positions={positions}
          activeId={activeId}
          onLift={lift}
          onDrop={drop}
          onOpen={onOpen}
          onStep={step}
        />
      ))}
    </View>
  );
}

function SortableRow({
  workspace: w,
  initialIndex,
  count,
  positions,
  activeId,
  onLift,
  onDrop,
  onOpen,
  onStep,
}: {
  workspace: DashboardWorkspace;
  initialIndex: number;
  count: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  onLift: () => void;
  onDrop: (final: Positions) => void;
  onOpen: (id: string) => void;
  onStep: (id: string, delta: number) => void;
}) {
  const c = useThemeColors();
  const id = w.id;
  const top = useSharedValue(initialIndex * SLOT);
  const startTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lifted = useSharedValue(0); // 0 → 1: scale / shadow while held
  const pressed = useSharedValue(0); // touch-down feedback before the hold completes

  // Someone else moved into my slot (or the server reordered) → spring to my new slot.
  useAnimatedReaction(
    () => positions.get()[id],
    (pos, prev) => {
      if (pos === undefined || pos === prev || dragging.get()) return;
      top.set(withSpring(pos * SLOT, SPRING));
    },
  );

  const tick = React.useCallback(() => void Haptics.selectionAsync(), []);
  const open = React.useCallback(() => onOpen(id), [onOpen, id]);

  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onBegin: () => {
      "worklet";
      pressed.set(withTiming(1, { duration: 120 }));
    },
    onActivate: () => {
      "worklet";
      dragging.set(true);
      activeId.set(id);
      startTop.set(top.get());
      lifted.set(withSpring(1, SPRING));
      scheduleOnRN(onLift);
    },
    onUpdate: (e) => {
      "worklet";
      if (!dragging.get()) return;
      const max = (count - 1) * SLOT;
      // A little give past the ends, then it stops.
      const y = Math.min(Math.max(startTop.get() + e.translationY, -SLOT * 0.25), max + SLOT * 0.25);
      top.set(y);
      const to = Math.min(Math.max(Math.round(y / SLOT), 0), count - 1);
      const from = positions.get()[id];
      if (to !== from) {
        const next: Positions = { ...positions.get() };
        for (const key in next) {
          // Shift everything between `from` and `to` by one toward the gap.
          if (key === id) continue;
          const p = next[key];
          if (from < to && p > from && p <= to) next[key] = p - 1;
          else if (from > to && p >= to && p < from) next[key] = p + 1;
        }
        next[id] = to;
        positions.set(next);
        scheduleOnRN(tick);
      }
    },
    onFinalize: () => {
      "worklet";
      pressed.set(withTiming(0, { duration: 150 }));
      if (!dragging.get()) return;
      dragging.set(false);
      activeId.set(null);
      lifted.set(withSpring(0, SPRING));
      top.set(withSpring(positions.get()[id] * SLOT, SPRING));
      scheduleOnRN(onDrop, positions.get());
    },
  });

  const tap = useTapGesture({
    maxDuration: 600,
    onActivate: () => {
      "worklet";
      scheduleOnRN(open);
    },
  });

  // Pan first: a hold becomes a drag; a quick release fails the pan and the tap wins.
  const gesture = useExclusiveGestures(pan, tap);

  const style = useAnimatedStyle(() => {
    const isActive = activeId.get() === id;
    return {
      transform: [
        { translateY: top.get() },
        { scale: interpolate(lifted.get(), [0, 1], [1, 1.035]) * interpolate(pressed.get(), [0, 1], [1, 0.985]) },
      ],
      // Lifted row (and one still settling) draws above the rest.
      zIndex: isActive || lifted.get() > 0.01 ? 10 : 1,
      shadowOpacity: interpolate(lifted.get(), [0, 1], [0.04, 0.22]),
      shadowRadius: interpolate(lifted.get(), [0, 1], [3, 18]),
      shadowOffset: { width: 0, height: interpolate(lifted.get(), [0, 1], [1, 10]) },
      elevation: Platform.OS === "android" ? interpolate(lifted.get(), [0, 1], [1, 10]) : 0,
    };
  });

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: lifted.get() > 0.5 ? c.primary : c.border,
  }));

  const signal = urgencySignal(w, c);
  const monogram = w.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${w.name}, ${ROLE_LABEL[w.role]}${signal ? `, ${signal.text}` : ""}`}
        accessibilityHint="Opens the board. Use the actions to reorder."
        accessibilityActions={[
          { name: "activate", label: "Open" },
          { name: "moveUp", label: "Move up" },
          { name: "moveDown", label: "Move down" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "activate") onOpen(id);
          if (e.nativeEvent.actionName === "moveUp") onStep(id, -1);
          if (e.nativeEvent.actionName === "moveDown") onStep(id, 1);
        }}
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: ROW_HEIGHT,
            borderRadius: 18,
            backgroundColor: c.card,
            shadowColor: "#000",
          },
          style,
        ]}
      >
        {/* Animated views take style only; NativeWind classes live on the plain View inside. */}
        <Animated.View style={[{ flex: 1, borderRadius: 18, borderWidth: 1 }, borderStyle]}>
          <View className="flex-1 flex-row items-center gap-3 pl-2 pr-3">
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
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
