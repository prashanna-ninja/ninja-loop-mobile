import * as Haptics from "expo-haptics";
import * as React from "react";
import { Platform, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useThemeColors } from "@/lib/theme";

/**
 * Hold-and-drag reorderable list (web: dnd-kit sortable) — used by the Workspaces
 * tab and the board's task queue.
 *
 * Hold a row (HOLD_MS) → it lifts (scale, shadow, primary outline, haptic) → drag →
 * the others spring out of the way, with a tick each time the order changes → release
 * → it springs into its slot and `onReorder` fires ONCE if the order changed.
 * Swipes before the hold completes scroll the page as usual.
 *
 * - Rows can be any height: each row is measured (onLayout), slots are summed heights.
 * - Pass `scroll` (the parent Animated.ScrollView) to auto-scroll when a lifted row
 *   is dragged near the top / bottom edge.
 * - Rows keep their own Pressables. Wrap their handlers with `ctx.guard(fn)` so the
 *   release at the end of a drag never also counts as a tap.
 * - Everything during a drag runs on the UI thread (Reanimated shared values; Gesture
 *   Handler v3 runs worklet callbacks there); JS is only called to lift / tick / drop.
 *   Shared values use .get()/.set() (React Compiler lint rejects `.value =`).
 */

const HOLD_MS = 200;
const SPRING = { damping: 24, stiffness: 280, mass: 0.9 };
const ESTIMATED_HEIGHT = 80;
/** Auto-scroll: starts within EDGE px of the viewport edge, up to MAX_SPEED px / frame. */
const EDGE = 90;
const MAX_SPEED = 14;

export type SortableScroll = {
  /** `useAnimatedRef<Animated.ScrollView>()` on the parent scroll view. */
  ref: AnimatedRef<Animated.ScrollView>;
  /** `useScrollOffset(ref)` */
  offset: SharedValue<number>;
  /** Content height (from the ScrollView's `onContentSizeChange`). */
  contentHeight: SharedValue<number>;
};

type Guard = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void;

export type SortableListProps<T> = {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, ctx: { index: number; guard: Guard }) => React.ReactNode;
  /** New full order (top → bottom) + what moved. Only called when the order changed. */
  onReorder: (orderedIds: string[], move: { id: string; from: number; to: number }) => void;
  /** true while a row is lifted — e.g. lock the parent ScrollView. */
  onDragChange?: (dragging: boolean) => void;
  scroll?: SortableScroll;
  gap?: number;
  /** Must match the rows' corner radius (lift outline + shadow). */
  radius?: number;
  /** Screen-reader name for a row ("Move <label> up"). */
  labelOf?: (item: T) => string;
};

type Heights = Record<string, number>;

/** Slot tops for `order`, from measured heights. */
function topsOf(order: string[], heights: Heights, gap: number) {
  "worklet";
  const tops: Record<string, number> = {};
  let y = 0;
  for (const id of order) {
    tops[id] = y;
    y += (heights[id] ?? ESTIMATED_HEIGHT) + gap;
  }
  return { tops, total: Math.max(0, y - gap) };
}

export function SortableList<T>({
  data,
  keyOf,
  renderItem,
  onReorder,
  onDragChange,
  scroll,
  gap = 10,
  radius = 16,
  labelOf,
}: SortableListProps<T>) {
  const ids = data.map(keyOf);
  const idsKey = ids.join("|");

  const order = useSharedValue<string[]>(ids);
  const heights = useSharedValue<Heights>({});
  const activeId = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0); // the lifted row's top (list coords)
  const startTop = useSharedValue(0);
  const translation = useSharedValue(0); // finger translation since lift
  const fingerY = useSharedValue(0); // finger, screen coords
  const viewport = useSharedValue({ top: 0, height: 0 });
  const startOffset = useSharedValue(0);
  const autoOffset = useSharedValue(0); // scroll offset we drive while dragging
  const ready = useSharedValue(0); // fades the list in once rows are measured (no first-frame jump)

  const layout = useDerivedValue(() => topsOf(order.get(), heights.get(), gap));

  // Data changed (refetch, optimistic save, rollback, add / remove) → re-slot, unless mid-drag.
  React.useEffect(() => {
    if (activeId.get() === null) order.set(idsKey ? idsKey.split("|") : []);
  }, [idsKey, activeId, order]);

  /* ── JS side: tap guard, lift, drop ────────────────────────────────── */

  const draggingRef = React.useRef(false);
  const lastDropAt = React.useRef(0);
  const guard = React.useCallback<Guard>(
    (fn) =>
      (...args) => {
        if (draggingRef.current || Date.now() - lastDropAt.current < 350) return;
        fn(...args);
      },
    [],
  );

  const lift = React.useCallback(() => {
    draggingRef.current = true;
    onDragChange?.(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [onDragChange]);

  const tick = React.useCallback(() => void Haptics.selectionAsync(), []);

  const drop = React.useCallback(
    (finalOrder: string[], id: string) => {
      draggingRef.current = false;
      lastDropAt.current = Date.now();
      onDragChange?.(false);
      const from = idsKey.split("|").indexOf(id);
      const to = finalOrder.indexOf(id);
      if (from !== to && from >= 0) onReorder(finalOrder, { id, from, to });
    },
    [idsKey, onReorder, onDragChange],
  );

  /** Screen-reader path: one step up / down without dragging. */
  const step = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, id);
    onReorder(next, { id, from, to });
  };

  /* ── UI thread: follow the finger, re-slot, auto-scroll ────────────── */

  const reposition = () => {
    "worklet";
    const id = activeId.get();
    if (id === null) return;
    const h = heights.get();
    const { total } = layout.get();
    const myH = h[id] ?? ESTIMATED_HEIGHT;
    const y = Math.min(
      Math.max(startTop.get() + translation.get() + (autoOffset.get() - startOffset.get()), -myH * 0.25),
      total - myH * 0.75,
    );
    dragTop.set(y);

    // Insertion index: where the lifted row's centre falls among the others' midpoints.
    const others = order.get().filter((k) => k !== id);
    const centre = y + myH / 2;
    let acc = 0;
    let at = others.length;
    for (let i = 0; i < others.length; i++) {
      const oh = h[others[i]] ?? ESTIMATED_HEIGHT;
      if (centre < acc + oh / 2) {
        at = i;
        break;
      }
      acc += oh + gap;
    }
    if (order.get().indexOf(id) !== at) {
      const next = [...others];
      next.splice(at, 0, id);
      order.set(next);
      scheduleOnRN(tick);
    }
  };

  useFrameCallback(() => {
    if (!scroll || activeId.get() === null) return;
    const { top, height } = viewport.get();
    if (height <= 0) return;
    const y = fingerY.get() - top;
    let speed = 0;
    if (y < EDGE) speed = -MAX_SPEED * Math.min(1, (EDGE - y) / EDGE);
    else if (y > height - EDGE) speed = MAX_SPEED * Math.min(1, (y - (height - EDGE)) / EDGE);
    if (speed === 0) return;
    const max = Math.max(0, scroll.contentHeight.get() - height);
    const next = Math.min(Math.max(autoOffset.get() + speed, 0), max);
    if (next === autoOffset.get()) return;
    autoOffset.set(next);
    scrollTo(scroll.ref, 0, next, false);
    reposition();
  });

  const containerStyle = useAnimatedStyle(() => ({
    height: layout.get().total,
    opacity: ready.get(),
  }));

  // ⚠️ Heights are tracked in a JS ref and pushed whole. On the JS thread a shared value's
  // `.set()` is ASYNC and `.get()` returns a cached copy — rows measured in the same frame
  // would each read `{}` and overwrite each other, so the list never became "ready" and
  // stayed invisible (opacity 0). Never read-modify-write a shared value from JS.
  const heightsRef = React.useRef<Heights>({});
  const readyRef = React.useRef(false);
  const reveal = React.useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    ready.set(withTiming(1, { duration: 180 }));
  }, [ready]);

  const onMeasured = (id: string, height: number) => {
    if (heightsRef.current[id] === height) return;
    heightsRef.current = { ...heightsRef.current, [id]: height };
    heights.set(heightsRef.current);
    if (ids.every((k) => heightsRef.current[k] !== undefined)) reveal();
  };

  // Safety net: never leave the list hidden if a row somehow doesn't report its layout.
  React.useEffect(() => {
    const t = setTimeout(reveal, 400);
    return () => clearTimeout(t);
  }, [reveal]);

  const shared = {
    order,
    layout,
    activeId,
    dragTop,
    startTop,
    translation,
    fingerY,
    viewport,
    startOffset,
    autoOffset,
    scroll,
    reposition,
    lift,
    drop,
  };

  return (
    <Animated.View style={containerStyle}>
      {data.map((item, index) => {
        const id = ids[index];
        return (
          <SortableRow
            key={id}
            id={id}
            shared={shared}
            radius={radius}
            label={labelOf?.(item)}
            onMeasured={onMeasured}
            onStep={step}
          >
            {renderItem(item, { index, guard })}
          </SortableRow>
        );
      })}
    </Animated.View>
  );
}

type Shared = {
  order: SharedValue<string[]>;
  layout: SharedValue<{ tops: Record<string, number>; total: number }>;
  activeId: SharedValue<string | null>;
  dragTop: SharedValue<number>;
  startTop: SharedValue<number>;
  translation: SharedValue<number>;
  fingerY: SharedValue<number>;
  viewport: SharedValue<{ top: number; height: number }>;
  startOffset: SharedValue<number>;
  autoOffset: SharedValue<number>;
  scroll?: SortableScroll;
  reposition: () => void;
  lift: () => void;
  drop: (finalOrder: string[], id: string) => void;
};

function SortableRow({
  id,
  shared: s,
  radius,
  label,
  onMeasured,
  onStep,
  children,
}: {
  id: string;
  shared: Shared;
  radius: number;
  label?: string;
  onMeasured: (id: string, height: number) => void;
  onStep: (id: string, delta: number) => void;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  const top = useSharedValue<number | null>(null); // null = not placed yet
  const lifted = useSharedValue(0);

  // My slot moved (someone dragged past me, data reordered, a row above changed height)
  // → spring there. The very first placement snaps (no fly-in from 0).
  useAnimatedReaction(
    () => s.layout.get().tops[id],
    (t) => {
      if (t === undefined || s.activeId.get() === id) return;
      const current = top.get();
      top.set(current === null ? t : withSpring(t, SPRING));
    },
  );

  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onActivate: (e) => {
      "worklet";
      if (s.activeId.get() !== null) return;
      const startAt = s.layout.get().tops[id] ?? 0;
      s.activeId.set(id);
      s.startTop.set(startAt);
      s.dragTop.set(startAt);
      s.translation.set(0);
      s.fingerY.set(e.absoluteY);
      if (s.scroll) {
        const m = measure(s.scroll.ref);
        if (m) s.viewport.set({ top: m.pageY, height: m.height });
        s.startOffset.set(s.scroll.offset.get());
        s.autoOffset.set(s.scroll.offset.get());
      }
      lifted.set(withSpring(1, SPRING));
      scheduleOnRN(s.lift);
    },
    onUpdate: (e) => {
      "worklet";
      if (s.activeId.get() !== id) return;
      s.translation.set(e.translationY);
      s.fingerY.set(e.absoluteY);
      s.reposition();
    },
    onFinalize: () => {
      "worklet";
      if (s.activeId.get() !== id) return;
      // Hand back from the finger to the slot, from where the row is now.
      top.set(s.dragTop.get());
      top.set(withSpring(s.layout.get().tops[id] ?? s.dragTop.get(), SPRING));
      s.activeId.set(null);
      lifted.set(withSpring(0, SPRING));
      scheduleOnRN(s.drop, s.order.get(), id);
    },
  });

  const style = useAnimatedStyle(() => {
    const active = s.activeId.get() === id;
    const l = lifted.get();
    return {
      transform: [{ translateY: active ? s.dragTop.get() : (top.get() ?? 0) }, { scale: interpolate(l, [0, 1], [1, 1.03]) }],
      zIndex: active || l > 0.01 ? 10 : 1,
      shadowOpacity: interpolate(l, [0, 1], [0, 0.22]),
      shadowRadius: interpolate(l, [0, 1], [0, 18]),
      shadowOffset: { width: 0, height: interpolate(l, [0, 1], [0, 10]) },
      elevation: Platform.OS === "android" ? interpolate(l, [0, 1], [0, 10]) : 0,
    };
  });

  const outline = useAnimatedStyle(() => ({ opacity: lifted.get() }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => onMeasured(id, Math.round(e.nativeEvent.layout.height))}
        accessibilityActions={[
          { name: "moveUp", label: "Move up" },
          { name: "moveDown", label: "Move down" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "moveUp") onStep(id, -1);
          if (e.nativeEvent.actionName === "moveDown") onStep(id, 1);
        }}
        accessibilityHint={label ? `Hold and drag, or use the actions, to move ${label}.` : undefined}
        style={[
          { position: "absolute", left: 0, right: 0, top: 0, borderRadius: radius, backgroundColor: c.card, shadowColor: "#000" },
          style,
        ]}
      >
        {/* Rows bring their own NativeWind-styled Views; this Animated.View takes style only. */}
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, borderWidth: 1.5, borderColor: c.primary },
            outline,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}
