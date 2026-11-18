import { Tabs, type BottomTabBarButtonProps } from "expo-router/js-tabs";
import * as React from "react";
import { Pressable, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMe } from "@/api/dashboard.api";
import { Bell, Inbox, LayoutDashboard, Settings, type IconComponent } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

function TabIcon({ icon: Icon, color, focused }: { icon: IconComponent; color: ColorValue; focused: boolean }) {
  return <Icon size={22} color={String(color)} strokeWidth={focused ? 2.4 : 1.9} />;
}

/**
 * Tab button without the Android "big bubble" ripple (borderless ripple isn't
 * clipped to the button — CMS mobile fix). Pressed state is tracked by hand:
 * NativeWind drops Pressable's function `style`.
 */
function TabButton({
  children,
  style,
  onPressIn,
  onPressOut,
  ref: _ref,
  android_ripple: _ripple,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  href: _href,
  ...rest
}: BottomTabBarButtonProps) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, { paddingVertical: 2, opacity: pressed ? 0.55 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

/** Badge text for a count: hidden at 0, capped at 99+. */
const badge = (n: number | undefined) => (n ? (n > 99 ? "99+" : n) : undefined);

/**
 * Bottom tabs — web nav (lib/nav-config.ts): Dashboard · Alerts · Inbox, plus Settings.
 * JS tabs (`expo-router/js-tabs`) like CMS mobile: they take lucide icons and any
 * tint directly. Alerts / Inbox badges come from GET /me counts.
 * Each screen renders its own AppHeader (headerShown: false).
 */
export default function TabsLayout() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.subtle,
        tabBarLabelStyle: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11, lineHeight: 15 },
        tabBarBadgeStyle: { backgroundColor: c.destructive, fontFamily: "PlusJakartaSans_700Bold", fontSize: 10 },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          height: 62 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 2,
        },
        // Same as bg-background, so switching tabs never flashes.
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => <TabIcon icon={LayoutDashboard} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: badge(me?.counts.unreadNotifications),
          tabBarIcon: ({ color, focused }) => <TabIcon icon={Bell} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: badge(me?.counts.openIncomingRequests),
          tabBarIcon: ({ color, focused }) => <TabIcon icon={Inbox} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => <TabIcon icon={Settings} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
