import type * as React from "react";
import { Text, View } from "react-native";

import { PressableSurface } from "@/components/pressable-surface";
import { ApiError } from "@/lib/api-client";
import { CloudOff, RefreshCw, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/** Copy for a failed query that a person can act on. */
export function describeLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    // A mobile-API 404 carries a code + a safe message ("Workspace not found." — also what
    // non-members get). No code = the route itself is missing (e.g. an older server).
    if (error.status === 404) return error.code ? error.message : "This isn't available on the server yet.";
    if (error.status >= 500) return "Ninja Loop had a problem. Try again in a moment.";
    return error.message;
  }
  const message = error instanceof Error ? error.message : "";
  if (/network request failed|failed to fetch/i.test(message)) return "You're offline, or Ninja Loop can't be reached.";
  return message || "Something went wrong.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const c = useThemeColors();
  return (
    <View className="items-center gap-3 px-8 py-14">
      <View className="bg-muted h-14 w-14 items-center justify-center rounded-2xl">
        <CloudOff size={26} color={c.mutedForeground} strokeWidth={1.7} />
      </View>
      <Text className="font-sans-semibold text-foreground text-base">Couldn&apos;t load this</Text>
      <Text className="text-muted-foreground font-sans text-center text-sm leading-5">{describeLoadError(error)}</Text>
      {onRetry ? (
        <PressableSurface
          onPress={onRetry}
          className="border-border bg-card mt-2 flex-row items-center gap-2 rounded-full border px-4 py-2.5"
        >
          <RefreshCw size={15} color={c.foreground} strokeWidth={2} />
          <Text className="font-sans-semibold text-foreground text-sm">Try again</Text>
        </PressableSurface>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: IconComponent; title: string; body: string }) {
  const c = useThemeColors();
  return (
    <View className="items-center gap-3 px-8 py-14">
      <View className="bg-muted h-14 w-14 items-center justify-center rounded-2xl">
        <Icon size={26} color={c.mutedForeground} strokeWidth={1.6} />
      </View>
      <Text className="font-sans-semibold text-foreground text-base">{title}</Text>
      <Text className="text-muted-foreground font-sans text-center text-sm leading-5">{body}</Text>
    </View>
  );
}

/** Title row above a list section: "Urgent tasks · 4", optional actions on the right. */
export function SectionHeader({
  title,
  count,
  caption,
  right,
}: {
  title: string;
  count?: number;
  caption?: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-baseline gap-2">
          <Text className="font-sans-bold text-foreground text-lg tracking-tight">{title}</Text>
          {count != null ? <Text className="font-sans-semibold text-muted-foreground text-sm">{count}</Text> : null}
        </View>
        {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
      </View>
      {caption ? <Text className="text-muted-foreground font-sans text-[13px] leading-5">{caption}</Text> : null}
    </View>
  );
}
