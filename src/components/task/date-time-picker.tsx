import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as React from "react";
import { Modal, Platform, Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableSurface } from "@/components/pressable-surface";
import { useThemeColors } from "@/lib/theme";

export type PickRequest = {
  /** "date" = a calendar day (due dates); "datetime" = day + time (snooze). */
  mode: "date" | "datetime";
  title: string;
  value: Date;
  minimumDate?: Date;
  onPick: (date: Date) => void;
};

/**
 * A native date / date-time picker (@react-native-community/datetimepicker).
 * - iOS: a bottom sheet with the inline calendar (and time row), Cancel / Done.
 * - Android: the system dialogs — date, then time for "datetime".
 * Usage: `const picker = useDateTimePicker(); … picker.open({...}); … {picker.sheet}`.
 */
export function useDateTimePicker() {
  const [request, setRequest] = React.useState<PickRequest | null>(null);

  const open = (r: PickRequest) => {
    if (Platform.OS === "android") return openAndroid(r);
    setRequest(r);
  };

  const sheet = Platform.OS === "ios" ? <IOSSheet request={request} onClose={() => setRequest(null)} /> : null;
  return { open, sheet };
}

function openAndroid(r: PickRequest) {
  DateTimePickerAndroid.open({
    mode: "date",
    value: r.value,
    minimumDate: r.minimumDate,
    onValueChange: (_e, day) => {
      if (r.mode === "date") return r.onPick(day);
      DateTimePickerAndroid.open({
        mode: "time",
        value: r.value,
        onValueChange: (_e2, time) => {
          const combined = new Date(day);
          combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
          r.onPick(combined);
        },
      });
    },
  });
}

function IOSSheet({ request, onClose }: { request: PickRequest | null; onClose: () => void }) {
  const c = useThemeColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = React.useState<Date | null>(null);
  // New request → start from its value (render-time sync, not an effect).
  const [seen, setSeen] = React.useState<PickRequest | null>(null);
  if (request !== seen) {
    setSeen(request);
    setValue(request?.value ?? null);
  }

  const done = () => {
    if (request && value) request.onPick(value);
    onClose();
  };

  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
        <View className="bg-card border-border rounded-t-3xl border-t px-3 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="flex-row items-center justify-between px-2 py-2">
            <PressableSurface onPress={onClose} hitSlop={10}>
              <Text className="font-sans-medium text-muted-foreground text-[15px]">Cancel</Text>
            </PressableSurface>
            <Text className="font-sans-bold text-foreground text-[15px]">{request?.title}</Text>
            <PressableSurface onPress={done} hitSlop={10}>
              <Text className="font-sans-bold text-primary text-[15px]">Done</Text>
            </PressableSurface>
          </View>
          {request && value ? (
            <DateTimePicker
              value={value}
              mode={request.mode}
              display="inline"
              minimumDate={request.minimumDate}
              minuteInterval={5}
              accentColor={c.primary}
              themeVariant={scheme === "dark" ? "dark" : "light"}
              onValueChange={(_e, d) => setValue(d)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
