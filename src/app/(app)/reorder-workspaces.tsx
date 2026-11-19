import { router } from "expo-router";
import * as React from "react";
import { ScrollView, Text, View } from "react-native";

import { useReorderWorkspaces, useWorkspaces } from "@/api/workspaces.api";
import { AuthButton } from "@/components/login/auth-button";
import { ErrorNote } from "@/components/login/error-note";
import { PressableSurface } from "@/components/pressable-surface";
import { ScreenHeader } from "@/components/screen-header";
import { describeLoadError, ErrorState } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { DashboardWorkspace } from "@/types/api.types";

/**
 * Reorder workspaces — your personal dashboard order (web: drag on the dashboard).
 * Up / down arrows edit a local order; "Save order" sends `PUT /workspaces/order`
 * once (optimistic on the dashboard). Drag-to-reorder would need a native list lib.
 */
export default function ReorderWorkspacesScreen() {
  const workspaces = useWorkspaces();
  const reorder = useReorderWorkspaces();
  // null = untouched → the server's order.
  const [draft, setDraft] = React.useState<string[] | null>(null);

  const list = workspaces.data ?? [];
  const byId = new Map(list.map((w) => [w.id, w]));
  const order = (draft ?? list.map((w) => w.id)).filter((id) => byId.has(id));
  const changed = draft !== null && order.some((id, i) => id !== list[i]?.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    if (reorder.isError) reorder.reset();
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    setDraft(next);
  };

  const save = () => {
    if (!changed || reorder.isPending) return;
    reorder.mutate(order, { onSuccess: () => router.back() });
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Reorder workspaces" subtitle="Your order, only you see it" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }}>
        {workspaces.isPending ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[60px] rounded-2xl" />)
        ) : workspaces.isError ? (
          <ErrorState error={workspaces.error} onRetry={() => void workspaces.refetch()} />
        ) : (
          <>
            {order.map((id, i) => (
              <Row
                key={id}
                workspace={byId.get(id)!}
                index={i}
                isFirst={i === 0}
                isLast={i === order.length - 1}
                onUp={() => move(i, i - 1)}
                onDown={() => move(i, i + 1)}
              />
            ))}
            <View className="mt-3 gap-3">
              {reorder.isError ? <ErrorNote message={describeLoadError(reorder.error)} /> : null}
              <AuthButton
                label={reorder.isPending ? "Saving…" : "Save order"}
                loading={reorder.isPending}
                disabled={!changed}
                onPress={save}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  workspace: w,
  index,
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  workspace: DashboardWorkspace;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const c = useThemeColors();
  return (
    <View className="bg-card border-border flex-row items-center gap-3 rounded-2xl border py-2 pl-4 pr-2">
      <Text className="text-muted-foreground font-sans-semibold w-5 text-center text-[13px]">{index + 1}</Text>
      <Text className="font-sans-semibold text-foreground flex-1 text-[15px]" numberOfLines={1}>
        {w.name}
      </Text>
      <PressableSurface
        onPress={onUp}
        disabled={isFirst}
        accessibilityLabel={`Move ${w.name} up`}
        hitSlop={4}
        className="h-11 w-11 items-center justify-center rounded-full"
      >
        <ChevronUp size={22} color={isFirst ? c.border : c.foreground} strokeWidth={2} />
      </PressableSurface>
      <PressableSurface
        onPress={onDown}
        disabled={isLast}
        accessibilityLabel={`Move ${w.name} down`}
        hitSlop={4}
        className="h-11 w-11 items-center justify-center rounded-full"
      >
        <ChevronDown size={22} color={isLast ? c.border : c.foreground} strokeWidth={2} />
      </PressableSurface>
    </View>
  );
}
