import * as React from "react";
import { ActivityIndicator, Alert, Text, TextInput, View } from "react-native";

import { useAddComment, useComments } from "@/api/tasks.api";
import { PressableSurface } from "@/components/pressable-surface";
import { describeLoadError } from "@/components/screen-states";
import { TaskSection } from "@/components/task/section";
import { initials, personName, timeAgo } from "@/lib/format";
import { MessageSquare, Send } from "@/lib/icons";
import { useThemeColors } from "@/lib/theme";

/** Comments, oldest first. Posting notifies the task's other assignees (server). */
export function Comments({ wid, tid }: { wid: string; tid: string }) {
  const c = useThemeColors();
  const comments = useComments(wid, tid);
  const add = useAddComment(wid, tid);
  const [draft, setDraft] = React.useState("");
  const body = draft.trim();

  const submit = () => {
    if (!body || add.isPending) return;
    add.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (err) => Alert.alert("Couldn't post the comment", describeLoadError(err)),
    });
  };

  const rows = comments.data ?? [];

  return (
    <TaskSection
      title="Comments"
      icon={MessageSquare}
      aside={rows.length ? <Text className="text-muted-foreground font-sans-medium text-xs">{rows.length}</Text> : null}
    >
      {comments.isPending ? (
        <ActivityIndicator color={c.primary} />
      ) : comments.isError ? (
        <Text className="text-muted-foreground font-sans text-[13px]">{describeLoadError(comments.error)}</Text>
      ) : rows.length === 0 ? (
        <Text className="text-muted-foreground font-sans text-[13.5px]">No comments yet.</Text>
      ) : (
        rows.map((cm) => (
          <View key={cm.id} className="flex-row gap-2.5">
            <View className="bg-primary/10 h-7 w-7 items-center justify-center rounded-full">
              <Text className="font-sans-bold text-primary text-[10.5px]">{initials(cm.user)}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-muted-foreground font-sans text-xs">
                <Text className="font-sans-semibold text-foreground">{personName(cm.user)}</Text> · {timeAgo(cm.createdAt)}
              </Text>
              <Text className="text-foreground font-sans text-[14.5px] leading-[21px]">{cm.body}</Text>
            </View>
          </View>
        ))
      )}
      <View className="border-border flex-row items-end gap-2 border-t pt-2.5">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment"
          placeholderTextColor={c.subtle}
          multiline
          maxLength={4000}
          className="font-sans text-foreground max-h-32 flex-1 py-1.5 text-[14.5px]"
        />
        <PressableSurface
          onPress={submit}
          disabled={!body || add.isPending}
          accessibilityLabel="Post comment"
          className={`h-9 w-9 items-center justify-center rounded-full ${body ? "bg-primary" : "bg-muted"}`}
        >
          {add.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={16} color={body ? "#FFFFFF" : c.subtle} strokeWidth={2.2} />
          )}
        </PressableSurface>
      </View>
    </TaskSection>
  );
}
