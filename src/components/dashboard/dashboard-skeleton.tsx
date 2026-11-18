import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";

/** The dashboard's shape while it loads: stat strip, urgent rows, workspace cards. */
export function DashboardSkeleton() {
  return (
    <View className="gap-6">
      <Skeleton className="h-[78px] rounded-2xl" />
      <View className="gap-3">
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[84px] rounded-2xl" />
        ))}
      </View>
      <View className="gap-3">
        <Skeleton className="h-5 w-28" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[112px] rounded-2xl" />
        ))}
      </View>
    </View>
  );
}
