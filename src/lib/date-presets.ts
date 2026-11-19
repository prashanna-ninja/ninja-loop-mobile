import { addDays, addWeeks, endOfDay, isFriday, nextFriday, nextMonday, setHours, startOfDay } from "date-fns";

/**
 * Quick picks (the task screen also has a native picker for any day / time).
 * Due dates are END of the local day — the same convention the web uses
 * (e.g. "2026-11-20T06:59:59.999Z" = 23:59:59.999 in Sydney).
 * Snoozes wake at 9am local, like the web's default snooze time.
 */
export type DatePreset = { key: string; label: string; iso: string };

export function duePresets(now = new Date()): DatePreset[] {
  const friday = isFriday(now) ? now : nextFriday(now);
  const presets: DatePreset[] = [
    { key: "today", label: "Today", iso: endOfDay(now).toISOString() },
    { key: "tomorrow", label: "Tomorrow", iso: endOfDay(addDays(now, 1)).toISOString() },
  ];
  // "Friday" only when it's not already today / tomorrow.
  if (startOfDay(friday).getTime() > startOfDay(addDays(now, 1)).getTime()) {
    presets.push({ key: "friday", label: "Friday", iso: endOfDay(friday).toISOString() });
  }
  presets.push(
    { key: "next-week", label: "Next Monday", iso: endOfDay(nextMonday(now)).toISOString() },
    { key: "two-weeks", label: "In 2 weeks", iso: endOfDay(addWeeks(now, 2)).toISOString() },
  );
  return presets;
}

const at9 = (d: Date) => setHours(startOfDay(d), 9);

export function snoozePresets(now = new Date()): DatePreset[] {
  return [
    { key: "tomorrow", label: "Tomorrow 9am", iso: at9(addDays(now, 1)).toISOString() },
    { key: "monday", label: "Monday 9am", iso: at9(nextMonday(now)).toISOString() },
    { key: "week", label: "In a week", iso: at9(addWeeks(now, 1)).toISOString() },
  ];
}

/** "Tue 25 Nov, 9:00 am" — for showing a snooze-until time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** True while a snooze is still in the future. */
export function isSnoozed(snoozeUntil: string | null | undefined, now = Date.now()): boolean {
  return !!snoozeUntil && new Date(snoozeUntil).getTime() > now;
}
