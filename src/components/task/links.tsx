import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { useAddLink, useDeleteLink, useUploadTaskFile } from "@/api/tasks.api";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError } from "@/components/screen-states";
import { TaskSection, TextAction } from "@/components/task/section";
import { Camera, ExternalLink, FileText, ImageIcon, Link, Paperclip, X, type IconComponent } from "@/lib/icons";
import { pickDocument, pickFromLibrary, takePhoto, type PickedFile } from "@/lib/pick-file";
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

const isImageUrl = (url: string) => /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(url);

/**
 * Links & files. Opens in the in-app browser. Add a web link (RESOURCE), or upload a
 * photo / camera shot / document from the phone (FILE → R2, see useUploadTaskFile).
 */
export function Links({ wid, tid, items }: { wid: string; tid: string; items: TaskLink[] }) {
  const c = useThemeColors();
  const add = useAddLink(wid, tid);
  const remove = useDeleteLink(wid, tid);
  const { upload, progress } = useUploadTaskFile(wid, tid);
  const [uploadingName, setUploadingName] = React.useState<string | null>(null);
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

  const attach = async (pick: () => Promise<PickedFile | null>) => {
    if (upload.isPending) return;
    let file: PickedFile | null = null;
    try {
      file = await pick();
    } catch (err) {
      Alert.alert("Couldn't open the picker", err instanceof Error ? err.message : String(err));
    }
    if (!file) return;
    setUploadingName(file.name);
    upload.mutate(file, {
      onError: (err) => Alert.alert("Couldn't upload the file", describeLoadError(err)),
      onSettled: () => setUploadingName(null),
    });
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
            {l.type === "FILE" ? (
              isImageUrl(l.url) ? (
                <ImageIcon size={16} color={c.primary} strokeWidth={2} />
              ) : (
                <FileText size={16} color={c.primary} strokeWidth={2} />
              )
            ) : (
              <ExternalLink size={16} color={c.primary} strokeWidth={2} />
            )}
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
      {uploadingName ? (
        <View className="gap-1.5 py-1" accessibilityLiveRegion="polite">
          <Text className="text-muted-foreground font-sans text-xs" numberOfLines={1}>
            Uploading {uploadingName}… {progress !== null ? `${Math.round(progress * 100)}%` : ""}
          </Text>
          <View className="bg-muted h-1.5 overflow-hidden rounded-full">
            <View className="bg-primary h-full rounded-full" style={{ width: `${Math.max(4, (progress ?? 0) * 100)}%` }} />
          </View>
        </View>
      ) : null}
      <View className={`flex-row gap-2 ${items.length || uploadingName ? "border-border border-t pt-3" : ""}`}>
        <AttachButton icon={ImageIcon} label="Photo" disabled={upload.isPending} onPress={() => void attach(pickFromLibrary)} />
        <AttachButton icon={Camera} label="Camera" disabled={upload.isPending} onPress={() => void attach(takePhoto)} />
        <AttachButton icon={Paperclip} label="File" disabled={upload.isPending} onPress={() => void attach(pickDocument)} />
      </View>
      <View className="gap-1">
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

function AttachButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <PressableSurface
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`Attach from ${label.toLowerCase()}`}
      className={`border-border flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <Icon size={16} color={c.foreground} strokeWidth={2.1} />
      <Text className="font-sans-semibold text-foreground text-[13px]">{label}</Text>
    </PressableSurface>
  );
}
