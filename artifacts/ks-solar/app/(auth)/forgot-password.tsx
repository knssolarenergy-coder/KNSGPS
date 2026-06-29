import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const BASE =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert("Required", "Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch(`${BASE}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
      } catch {
        throw new Error("Cannot reach the server. Please check your internet connection and try again.");
      }
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
      if (!res.ok) throw new Error(data?.error ?? "Could not send reset email");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (err: any) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err.message ?? "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[styles.iconCircle, { backgroundColor: "#FFFFFF22" }]}>
          <Feather name={sent ? "mail" : "unlock"} size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle}>Forgot Password</Text>
        <Text style={styles.headerSub}>
          {sent ? "Check your inbox" : "Enter your email to receive a reset link"}
        </Text>
      </View>

      <View style={styles.body}>
        {!sent ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Reset Password</Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Enter your registered email address and we'll send you a secure link to reset your password.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={handleSubmit}
                  returnKeyType="send"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: loading ? colors.mutedForeground : "#1E3A5F" }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Feather name={loading ? "loader" : "send"} size={17} color="#FFFFFF" />
              <Text style={styles.btnText}>{loading ? "Sending..." : "Send Reset Link"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.75}>
              <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
                Remember your password?{" "}
                <Text style={{ color: "#1E3A5F", fontFamily: "Inter_600SemiBold" }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.successIcon, { backgroundColor: "#10B98118" }]}>
              <Feather name="check-circle" size={32} color="#10B981" />
            </View>

            <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: "center" }]}>
              Email Sent!
            </Text>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, textAlign: "center" }]}>
              We've sent a password reset link to{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{email}</Text>
            </Text>

            <View style={[styles.infoBox, { backgroundColor: "#3B82F612", borderColor: "#3B82F633" }]}>
              <Feather name="info" size={15} color="#3B82F6" />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Check your inbox and click the reset link. The link expires in{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>1 hour</Text>.
                Check your spam folder if you don't see it.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: "#1E3A5F" }]}
              onPress={() => setSent(false)}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={16} color="#1E3A5F" />
              <Text style={[styles.outlineBtnText, { color: "#1E3A5F" }]}>Send Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#1E3A5F" }]}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.85}
            >
              <Feather name="log-in" size={17} color="#FFFFFF" />
              <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    backgroundColor: "#1E3A5F",
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
    gap: 10,
  },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 4 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: {
    color: "#FFFFFFCC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  body: { flex: 1, padding: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  backLink: { alignItems: "center", paddingVertical: 4 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  successIcon: { alignSelf: "center", padding: 16, borderRadius: 50, marginBottom: 4 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
