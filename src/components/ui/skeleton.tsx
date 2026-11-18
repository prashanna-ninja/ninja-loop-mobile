import { View } from "react-native";

import { cn } from "@/lib/utils";

/**
 * A single grey placeholder block.
 *
 * Compose several of these into the *shape* of a row or card to show what's
 * loading — calmer than a spinner, and it primes the user for the layout that's
 * about to appear. Static (no shimmer) to match the Dashboard's existing
 * placeholders. Uses the themed `muted` token, so it looks right in light and
 * dark automatically. Pass sizes via `className` (e.g. `h-4 w-1/2`).
 */
export function Skeleton({ className }: { className?: string }) {
  return <View className={cn("bg-muted rounded-md", className)} />;
}
