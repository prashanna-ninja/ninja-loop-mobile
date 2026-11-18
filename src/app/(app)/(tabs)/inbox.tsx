import * as React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { useAddressRequest, useIncomingRequests } from "@/api/requests.api";
import { AppHeader } from "@/components/app-header";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyState, ErrorState, SectionHeader } from "@/components/screen-states";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/**
 * Inbox — web /dashboard/requests: when a teammate asks you (the workspace owner)
 * to refresh priorities, it lands here. Open first, then addressed.
 */
export default function InboxScreen() {
  const c = useThemeColors();
  const query = useIncomingRequests();
  const address = useAddressRequest();
  const [refreshing, setRefreshing] = React.useState(false);

  const rows = query.data ?? [];
  const open = rows.filter((r) => r.status === "OPEN");
  const done = rows.filter((r) => r.status === "ADDRESSED");

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  return (
    <View className="bg-background flex-1">
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        <View className="gap-0.5">
          <Text className="font-display text-foreground text-[26px] tracking-tight">Inbox</Text>
          <Text className="text-muted-foreground font-sans text-[13px]">
            Teammates asking you to refresh priorities.
          </Text>
        </View>

        {query.isPending ? (
          <View className="gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[150px] rounded-2xl" />
            ))}
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : open.length === 0 && done.length === 0 ? (
          <EmptyState icon={Inbox} title="You're all caught up" body="No priority requests right now." />
        ) : (
          <>
            {open.length > 0 ? (
              <View className="gap-3">
                <SectionHeader title="Open" count={open.length} />
                {open.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    pending={address.isPending && address.variables === r.id}
                    onMarkDone={() => address.mutate(r.id)}
                  />
                ))}
              </View>
            ) : (
              <EmptyState icon={Inbox} title="No open requests" body="Everything sent to you has been handled." />
            )}

            {done.length > 0 ? (
              <View className="gap-3">
                <SectionHeader title="Addressed" count={done.length} />
                {done.map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
