import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, Text, View } from "react-native";

import { useDeleteAccount } from "@/api/account.api";
import { useMe } from "@/api/dashboard.api";
import { AppHeader } from "@/components/app-header";
import { FadeIn } from "@/components/login/fade-in";
import { describeLoadError } from "@/components/screen-states";
import { AppearancePicker } from "@/components/settings/appearance-picker";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SettingsGroup, SettingsRow } from "@/components/settings/settings-group";
import { API_BASE_URL, PRIVACY_URL, TERMS_URL } from "@/constants/env";
import { initials } from "@/lib/format";
import { ExternalLink, Info, LogOut, Mail, ShieldCheck, UserX } from "@/lib/icons";
import { useSession } from "@/providers/session-provider";

/**
 * Settings — who you are, the app, sign out, delete account.
 * No billing or plans here: the app has no subscription / paywall (see
 * docs/01-BACKEND-PROMPT.md §3.4).
 */
export default function SettingsScreen() {
  const { data: session, signOut } = useSession();
  const { data: me } = useMe();
  const deleteAccount = useDeleteAccount();
  const user = me?.user ?? session?.user;
  const version = Constants.expoConfig?.version ?? "—";

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You can sign back in any time with Google, GitHub or an email code.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your Ninja Loop account. Workspaces where you're the only member are deleted too. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () =>
            deleteAccount.mutate(undefined, {
              onError: (err) => Alert.alert("Couldn't delete your account", describeLoadError(err)),
            }),
        },
      ],
    );

  return (
    <View className="bg-background flex-1">
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}>
        <FadeIn>
          <Text className="font-display text-foreground text-[26px] tracking-tight">Settings</Text>
        </FadeIn>

        <FadeIn delay={60}>
          <View className="bg-card border-border flex-row items-center gap-4 rounded-2xl border p-4">
            <View className="bg-primary h-14 w-14 items-center justify-center rounded-full">
              <Text className="font-sans-bold text-primary-foreground text-lg">{initials(user)}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-sans-bold text-foreground text-[17px]" numberOfLines={1}>
                {user?.name || "Your account"}
              </Text>
              <Text className="text-muted-foreground font-sans text-sm" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={120}>
          <SettingsGroup title="Account">
            <SettingsRow icon={Mail} label="Email" value={user?.email ?? ""} />
            <SettingsRow
              icon={ExternalLink}
              label="Open Ninja Loop on the web"
              onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/dashboard`)}
            />
          </SettingsGroup>
        </FadeIn>

        <FadeIn delay={140}>
          <NotificationSettings />
        </FadeIn>

        <FadeIn delay={160}>
          <AppearancePicker />
        </FadeIn>

        <FadeIn delay={180}>
          <SettingsGroup title="About">
            <SettingsRow icon={Info} label="Version" value={version} />
            <SettingsRow icon={ShieldCheck} label="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
            <SettingsRow icon={Info} label="Terms of Service" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} />
          </SettingsGroup>
        </FadeIn>

        <FadeIn delay={240}>
          <SettingsGroup>
            <SettingsRow icon={LogOut} label="Sign out" onPress={confirmSignOut} />
            <SettingsRow
              icon={UserX}
              label={deleteAccount.isPending ? "Deleting account…" : "Delete account"}
              destructive
              onPress={deleteAccount.isPending ? undefined : confirmDelete}
            />
          </SettingsGroup>
        </FadeIn>
      </ScrollView>
    </View>
  );
}
