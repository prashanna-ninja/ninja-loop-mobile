import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { useAddLink, useDeleteLink } from "@/api/tasks.api";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError } from "@/components/screen-states";
import { TaskSection, TextAction } from "@/components/task/section";
import { ExternalLink, Link, X } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";
import type { TaskLink } from "@/types/api.types";

/** Accepts "example.com/x" too — the server only takes http(s). */
function normaliseUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Links & files. Opens in the in-app browser. Adding = a web link (RESOURCE);
 * uploading files from the phone isn't built yet (3-step presigned upload, MOBILE-API.md).
 */
export function Links({ wid, tid, items }: { wid: string; tid: string; items: TaskLink[] }) {
  const c = useThemeColors();
  const add = useAddLink(wid, tid);
  const remove = useDeleteLink(wid, tid);
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const parsed = normaliseUrl(url);

  const submit = () => {
    if (!parsed || add.isPending) return;
    add.mutate(
      { url: parsed, label: label.trim() || hostOf(parsed) },
      {
        onSuccess: () => {
          setUrl("");
          setLabel("");
        },
        onError: (err) => Alert.alert("Couldn't add the link", describeLoadError(err)),
      },
    );
  };

  const confirmDelete = (l: TaskLink) =>
    Alert.alert("Remove this link?", l.label, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          remove.mutate(l.id, { onError: (err) => Alert.alert("Couldn't remove the link", describeLoadError(err)) }),
      },
    ]);

  return (
    <TaskSection title="Links & files" icon={Link}>
      {items.map((l) => (
        <View key={l.id} className="flex-row items-center gap-3">
          <PressableSurface
            onPress={() => void WebBrowser.openBrowserAsync(l.url)}
            accessibilityLabel={`Open ${l.label}`}
            className="flex-1 flex-row items-center gap-2.5 py-1"
          >
            <ExternalLink size={16} color={c.primary} strokeWidth={2} />
            <View className="flex-1">
              <Text className="font-sans-semibold text-foreground text-[14.5px]" numberOfLines={1}>
                {l.label}
              </Text>
              <Text className="text-muted-foreground font-sans text-xs" numberOfLines={1}>
                {l.type === "FILE" ? "File" : l.url.replace(/^https?:\/\//, "")}
              </Text>
            </View>
          </PressableSurface>
          <PressableSurface accessibilityLabel={`Remove ${l.label}`} hitSlop={8} onPress={() => confirmDelete(l)}>
            <X size={17} color={c.subtle} strokeWidth={2} />
          </PressableSurface>
        </View>
      ))}
      <View className={`gap-1 ${items.length ? "border-border border-t pt-2.5" : ""}`}>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="Paste a link (https://…)"
          placeholderTextColor={c.subtle}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          className="font-sans text-foreground py-1.5 text-[14.5px]"
        />
        {url.trim() ? (
          <View className="flex-row items-center gap-3">
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Label (optional)"
              placeholderTextColor={c.subtle}
              returnKeyType="done"
              onSubmitEditing={submit}
              className="font-sans text-foreground flex-1 py-1.5 text-[14.5px]"
            />
            <TextAction label={add.isPending ? "Adding…" : "Add"} onPress={submit} disabled={!parsed || add.isPending} />
          </View>
        ) : null}
      </View>
    </TaskSection>
  );
}
