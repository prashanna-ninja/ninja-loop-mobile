/**
 * The app's icon set — import icons from HERE, never from "lucide-react-native".
 *
 * ⚠️ The package barrel isn't tree-shaken by Metro (~1600 icons, ~3MB on Android).
 * The `lucide-react-native/icons/<kebab-name>` subpath bundles only what we use.
 * Adding an icon: find its kebab-case name at lucide.dev, add a line below.
 * (Brand logos — Google, GitHub — are hand-drawn SVGs in components/brand/.)
 */

import type * as React from "react";

export type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/* auth */
export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as ArrowRight } from "lucide-react-native/icons/arrow-right";
export { default as LogOut } from "lucide-react-native/icons/log-out";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as MailCheck } from "lucide-react-native/icons/mail-check";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";

/* tabs (web lib/nav-config.ts: Dashboard · Alerts · Inbox) */
export { default as Bell } from "lucide-react-native/icons/bell";
export { default as Inbox } from "lucide-react-native/icons/inbox";
export { default as LayoutDashboard } from "lucide-react-native/icons/layout-dashboard";
export { default as Settings } from "lucide-react-native/icons/settings";

/* dashboard / due dates (web due-date-urgency-badge.tsx) */
export { default as Calendar } from "lucide-react-native/icons/calendar";
export { default as CalendarClock } from "lucide-react-native/icons/calendar-clock";
export { default as CalendarDays } from "lucide-react-native/icons/calendar-days";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as Layers } from "lucide-react-native/icons/layers";
export { default as ListTodo } from "lucide-react-native/icons/list-todo";
export { default as Sun } from "lucide-react-native/icons/sun";
export { default as Sunrise } from "lucide-react-native/icons/sunrise";
export { default as TrendingUp } from "lucide-react-native/icons/trending-up";
export { default as TriangleAlert } from "lucide-react-native/icons/triangle-alert";

/* alerts / inbox */
export { default as BellRing } from "lucide-react-native/icons/bell-ring";
export { default as Check } from "lucide-react-native/icons/check";
export { default as CheckCheck } from "lucide-react-native/icons/check-check";
export { default as CircleCheck } from "lucide-react-native/icons/circle-check";
export { default as MessageSquare } from "lucide-react-native/icons/message-square";
export { default as UserPlus } from "lucide-react-native/icons/user-plus";

/* settings → appearance */
export { default as Moon } from "lucide-react-native/icons/moon";
export { default as Smartphone } from "lucide-react-native/icons/smartphone";
export { default as SunMedium } from "lucide-react-native/icons/sun-medium";

/* states / settings */
export { default as CloudOff } from "lucide-react-native/icons/cloud-off";
export { default as ExternalLink } from "lucide-react-native/icons/external-link";
export { default as Info } from "lucide-react-native/icons/info";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as UserX } from "lucide-react-native/icons/user-x";

/* workspace create / settings / reorder */
export { default as ArrowUpDown } from "lucide-react-native/icons/arrow-up-down";

/* board / task detail */
export { default as AlarmClock } from "lucide-react-native/icons/alarm-clock";
export { default as ArrowUpToLine } from "lucide-react-native/icons/arrow-up-to-line";
export { default as Ban } from "lucide-react-native/icons/ban";
export { default as ChevronDown } from "lucide-react-native/icons/chevron-down";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronUp } from "lucide-react-native/icons/chevron-up";
export { default as Circle } from "lucide-react-native/icons/circle";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as EyeOff } from "lucide-react-native/icons/eye-off";
export { default as Link } from "lucide-react-native/icons/link";
export { default as ListChecks } from "lucide-react-native/icons/list-checks";
export { default as Megaphone } from "lucide-react-native/icons/megaphone";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as Send } from "lucide-react-native/icons/send";
export { default as Square } from "lucide-react-native/icons/square";
export { default as SquareCheckBig } from "lucide-react-native/icons/square-check-big";
export { default as Trash2 } from "lucide-react-native/icons/trash-2";
export { default as Users } from "lucide-react-native/icons/users";
export { default as X } from "lucide-react-native/icons/x";
