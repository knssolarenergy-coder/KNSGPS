import { Feather } from "@expo/vector-icons";
import {
  getGetChatMessagesQueryKey,
  useGetChatMessages,
  useSendChatMessage,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const hapticSelection = () => { if (Platform.OS !== "web") Haptics.selectionAsync(); };

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function formatDay(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
  } catch { return ""; }
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [text, setText] = useState("");

  const { data: messages = [], isLoading, refetch } = useGetChatMessages({
    query: { queryKey: getGetChatMessagesQueryKey(), refetchInterval: 5000 },
  });

  const { mutate: sendMessage, isPending } = useSendChatMessage({
    mutation: {
      onSuccess: () => {
        setText("");
        hapticSelection();
        refetch();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
      },
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  function handleSend() {
    if (!text.trim()) return;
    sendMessage({ data: { message: text.trim() } });
  }

  let lastDay = "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.secondary }]}>
        <View style={styles.headerAvatar}>
          <Feather name="sun" size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>K&S Support</Text>
          <Text style={styles.headerSub}>Solar Energy Help Desk</Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: "#10B981" }]} />
        <Text style={styles.onlineText}>Online</Text>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.secondary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary + "18" }]}>
                <Feather name="message-circle" size={36} color={colors.secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start a Conversation</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Send us a message and our team will get back to you shortly.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isAdmin = item.isAdminSender;
            const day = formatDay(item.createdAt);
            const showDay = day !== lastDay;
            if (showDay) lastDay = day;

            return (
              <>
                {showDay && (
                  <View style={styles.dayRow}>
                    <View style={[styles.dayLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dayLabel, { color: colors.mutedForeground, backgroundColor: colors.background }]}>
                      {day}
                    </Text>
                    <View style={[styles.dayLine, { backgroundColor: colors.border }]} />
                  </View>
                )}
                <View style={[styles.bubbleRow, isAdmin ? styles.bubbleLeft : styles.bubbleRight]}>
                  {isAdmin && (
                    <View style={[styles.avatarSmall, { backgroundColor: colors.secondary + "22" }]}>
                      <Feather name="headphones" size={13} color={colors.secondary} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isAdmin
                        ? [styles.bubbleAdminShape, { backgroundColor: colors.card, borderColor: colors.border }]
                        : [styles.bubbleUserShape, { backgroundColor: colors.secondary }],
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: isAdmin ? colors.foreground : "#FFFFFF" }]}>
                      {item.message}
                    </Text>
                    <Text style={[styles.bubbleTime, { color: isAdmin ? colors.mutedForeground : "#FFFFFFAA" }]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </>
            );
          }}
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputBar, {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: bottomPad + 8,
        }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={text}
            onChangeText={setText}
            placeholder="Type your message..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.secondary : colors.muted }]}
            onPress={handleSend}
            disabled={!text.trim() || isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={18} color={text.trim() ? "#FFFFFF" : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF22",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFAA", fontSize: 11, fontFamily: "Inter_400Regular" },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_400Regular" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 4 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  dayRow: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dayLine: { flex: 1, height: 1 },
  dayLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", paddingHorizontal: 8 },
  bubbleRow: { flexDirection: "row", marginBottom: 4, gap: 8 },
  bubbleLeft: { justifyContent: "flex-start" },
  bubbleRight: { justifyContent: "flex-end" },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  bubble: { maxWidth: "75%", padding: 10, gap: 3 },
  bubbleAdminShape: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleUserShape: {
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
