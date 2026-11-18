import { differenceInCalendarDays, startOfDay } from "date-fns";

import type { ThemeColors } from "@/lib/theme";

/**
 * Calendar-day urgency for a task deadline, in the DEVICE's time zone.
 * Ported 1:1 from the web (ref/ninja-loop/lib/due-date-urgency.ts) so labels
 * match: "Overdue · 2 days late", "Due today", "Tomorrow", "Thu", "Mar 4".
 */
export type DueUrgencyLevel = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "none";

export type DueUrgency = {
  level: DueUrgencyLevel;
  label: string;
  hint: string | null;
};

export function getDueUrgency(due: string | Date | null | undefined): DueUrgency {
  const date = due == null ? null : new Date(due);
  if (!date || Number.isNaN(date.getTime())) return { level: "none", label: "No date", hint: null };

  const now = new Date();
  const diff = differenceInCalendarDays(startOfDay(date), startOfDay(now));

  if (diff < 0) {
    const late = Math.abs(diff);
    return { level: "overdue", label: "Overdue", hint: late === 1 ? "1 day late" : `${late} days late` };
  }
  if (diff === 0) return { level: "today", label: "Due today", hint: "By end of day" };
  if (diff === 1) return { level: "tomorrow", label: "Tomorrow", hint: "Next calendar day" };
  if (diff <= 7) {
    return {
      level: "this_week",
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      hint: `In ${diff} days`,
    };
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return {
    level: "later",
    label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    hint: sameYear ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
  };
}

/** The one colour that represents a level (strip, badge text, icon). */
export function urgencyColor(level: DueUrgencyLevel, c: ThemeColors): string {
  switch (level) {
    case "overdue":
      return c.destructive;
    case "today":
      return c.today;
    case "tomorrow":
      return c.tomorrow;
    case "this_week":
      return c.thisWeek;
    default:
      return c.subtle;
  }
}
