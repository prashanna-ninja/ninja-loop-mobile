import { Text, View } from "react-native";

import { initials } from "@/lib/format";
import type { Person } from "@/types/api.types";

/** Up to three overlapping initials circles, then "+N". */
export function AvatarStack({ people, size = 24 }: { people: Person[]; size?: number }) {
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <View className="flex-row items-center">
      {shown.map((p, i) => (
        <View
          key={p.id}
          className="bg-primary/15 border-card items-center justify-center rounded-full border-2"
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -size / 5, zIndex: shown.length - i }}
        >
          <Text className="font-sans-bold text-primary" style={{ fontSize: size * 0.36 }} numberOfLines={1}>
            {initials(p)}
          </Text>
        </View>
      ))}
      {extra > 0 ? <Text className="text-muted-foreground font-sans-semibold ml-1 text-[11px]">+{extra}</Text> : null}
    </View>
  );
}
