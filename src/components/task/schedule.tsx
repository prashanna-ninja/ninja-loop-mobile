import { addDays, endOfDay, setHours, startOfDay } from "date-fns";
import * as React from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { DueBadge } from "@/components/due-badge";
import { useDateTimePicker } from "@/components/task/date-time-picker";
import { Chip, TaskSection, TextAction } from "@/components/task/section";
import { duePresets, formatDateTime, isSnoozed, snoozePresets } from "@/lib/date-presets";
import { getDueUrgency } from "@/lib/due-urgency";
import { AlarmClock, Ban, CalendarClock } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { TaskDetail, TaskPatch } from "@/types/api.types";

type Props = { task: TaskDetail; onPatch: (patch: TaskPatch) => void; disabled?: boolean };

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** Due date — quick picks or any day from the calendar (end of local day, like the web), or clear. */
export function DueSection({ task, onPatch, disabled }: Props) {
  const presets = duePresets();
  const picker = useDateTimePicker();
  const u = getDueUrgency(task.dueDate);
  // A preset is "selected" when it lands on the same calendar day as the current due date.
  const sameDay = (iso: string) =>
    !!task.dueDate && new Date(iso).toDateString() === new Date(task.dueDate).toDateString();

  return (
    <TaskSection title="Due" icon={CalendarClock} aside={task.dueDate ? <DueBadge due={task.dueDate} /> : null}>
      {task.dueDate ? (
        <Text className="text-muted-foreground font-sans text-[13px]">
          {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          {u.hint ? ` · ${u.hint}` : ""}
        </Text>
      ) : (
        <Text className="text-muted-foreground font-sans text-[13px]">No due date.</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {presets.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            selected={sameDay(p.iso)}
            disabled={disabled}
            onPress={() => onPatch({ dueDate: p.iso })}
          />
        ))}
        {/* A custom day shows as its own selected chip ("Wed 3 Dec"); tap to change it. */}
        <Chip
          label={task.dueDate && !presets.some((p) => sameDay(p.iso)) ? shortDay(task.dueDate) : "Pick a date…"}
          selected={!!task.dueDate && !presets.some((p) => sameDay(p.iso))}
          disabled={disabled}
          onPress={() =>
            picker.open({
              mode: "date",
              title: "Due date",
              value: task.dueDate ? new Date(task.dueDate) : new Date(),
              onPick: (d) => onPatch({ dueDate: endOfDay(d).toISOString() }),
            })
          }
        />
        {task.dueDate ? (
          <Chip label="Clear" tone="danger" disabled={disabled} onPress={() => onPatch({ dueDate: null })} />
        ) : null}
      </View>
      {picker.sheet}
    </TaskSection>
  );
}

/** Snooze — hides the task from dashboard urgency until then. */
export function SnoozeSection({ task, onPatch, disabled }: Props) {
  const snoozed = isSnoozed(task.snoozeUntil);
  const picker = useDateTimePicker();
  const pickCustom = () =>
    picker.open({
      mode: "datetime",
      title: "Snooze until",
      value: snoozed && task.snoozeUntil ? new Date(task.snoozeUntil) : setHours(startOfDay(addDays(new Date(), 1)), 9),
      minimumDate: new Date(),
      onPick: (d) => {
        if (d.getTime() <= Date.now()) return Alert.alert("Pick a time in the future");
        onPatch({ snoozeUntil: d.toISOString() });
      },
    });
  return (
    <TaskSection title="Snooze" icon={AlarmClock}>
      <Text className="text-muted-foreground font-sans text-[13px]">
        {snoozed && task.snoozeUntil
          ? `Snoozed until ${formatDateTime(task.snoozeUntil)}.`
          : "Hide it from your urgent list until later."}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {snoozePresets().map((p) => (
          <Chip key={p.key} label={p.label} disabled={disabled} onPress={() => onPatch({ snoozeUntil: p.iso })} />
        ))}
        <Chip label="Pick a time…" disabled={disabled} onPress={pickCustom} />
        {snoozed ? (
          <Chip label="Wake now" tone="danger" disabled={disabled} onPress={() => onPatch({ snoozeUntil: null })} />
        ) : null}
      </View>
      {picker.sheet}
    </TaskSection>
  );
}

/** Blocked — a reason shows a red "Blocked" tag on the board. Empty = unblocked. */
export function BlockedSection({ task, onPatch, disabled }: Props) {
  const c = useThemeColors();
  const [draft, setDraft] = React.useState(task.blockedReason ?? "");
  const [editing, setEditing] = React.useState(false);
  // Re-sync the draft when the server value changes (render-time, not an effect).
  const [seen, setSeen] = React.useState(task.blockedReason);
  if (seen !== task.blockedReason) {
    setSeen(task.blockedReason);
    setDraft(task.blockedReason ?? "");
  }

  const blocked = !!task.blockedReason;
  const save = () => {
    onPatch({ blockedReason: draft.trim() || null });
    setEditing(false);
  };

  return (
    <TaskSection
      title={blocked ? "Blocked" : "Blocker"}
      icon={Ban}
      aside={
        blocked && !editing ? (
          <TextAction label="Unblock" disabled={disabled} onPress={() => onPatch({ blockedReason: null })} />
        ) : null
      }
    >
      {blocked && !editing ? (
        <View className="border-destructive/50 border-l-2 pl-3">
          <Text className="text-foreground font-sans text-[14.5px] leading-[21px]" onPress={() => setEditing(true)}>
            {task.blockedReason}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-3">
          <TextInput
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setEditing(true);
            }}
            placeholder="What's it waiting on?"
            placeholderTextColor={c.subtle}
            returnKeyType="done"
            onSubmitEditing={save}
            editable={!disabled}
            className="font-sans text-foreground flex-1 py-1.5 text-[14.5px]"
          />
          <TextAction
            label="Save"
            onPress={save}
            disabled={disabled || draft.trim() === (task.blockedReason ?? "")}
          />
        </View>
      )}
    </TaskSection>
  );
}
