import { formatDistanceToNowStrict } from "date-fns";

/** "Sam Lee" → "SL", "sam@x.com" → "S". */
export function initials(user?: { name?: string | null; email?: string | null } | null): string {
  const name = user?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
  }
  return (user?.email?.[0] ?? "?").toUpperCase();
}

/** First name, else the email's local part (web: `name || email.split("@")[0]`). */
export function firstName(user?: { name?: string | null; email?: string | null } | null): string {
  return user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";
}

/** "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (Date.now() - d.getTime() < 60_000) return "Just now";
  return formatDistanceToNowStrict(d, { addSuffix: true })
    .replace(/ seconds?/, "s")
    .replace(/ minutes?/, "m")
    .replace(/ hours?/, "h")
    .replace(/ days?/, "d")
    .replace(/ months?/, "mo")
    .replace(/ years?/, "y");
}

/** "Good morning" / "Good afternoon" / "Good evening" — device local time. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
