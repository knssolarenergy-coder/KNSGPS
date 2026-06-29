import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
import { useAuth, UserProfile } from "@/context/AuthContext";

const BASE =
  Platform.OS === "web" && typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const { token } = useLocalSearchParams<{ token: string }>();
  const { loginWithToken } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Required", "Please fill in both password fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Too Short", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match");
      return;
    }
    if (!token) {
      Alert.alert("Invalid Link", "No reset token found. Please request a new reset link.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      try {
        res = await fetch(`${BASE}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
        });
      } catch {
        throw new Error("Cannot reach the server. Please check your internet connection and try again.");
      }
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
      if (!res.ok) throw new Error(data?.error ?? "Could not reset password");
      if (!data?.token || !data?.user) throw new Error("The server returned an unexpected response. Please try again.");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auto-login with the token returned from the API, then go home
      await loginWithToken(data.token as string, data.user as UserProfile);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err.message ?? "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="alert-circle" size={40} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Invalid Link</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            This password reset link is missing required information. Please request a new reset link.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#1E3A5F" }]}
            onPress={() => router.replace("/(auth)/forgot-password")}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Request New Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View style={[styles.iconCircle, { backgroundColor: "#FFFFFF22" }]}>
          <Feather name="lock" size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle}>Set New Password</Text>
        <Text style={styles.headerSub}>Choose a strong new password for your account</Text>
      </View>

      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>New Password</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                <Feather name={showNew ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirm Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                onSubmitEditing={handleReset}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                <Feather name={showConfirm ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <View style={[styles.warnRow, { backgroundColor: "#EF444412", borderColor: "#EF444433" }]}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.warnText, { color: "#EF4444" }]}>Passwords do not match</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: loading ? colors.mutedForeground : "#1E3A5F" }]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Feather name={loading ? "loader" : "check"} size={17} color="#FFFFFF" />
            <Text style={styles.btnText}>{loading ? "Logging you in..." : "Reset Password"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  centeredContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 400,
  },
  errorTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  errorSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  header: {
    backgroundColor: "#1E3A5F",
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
    gap: 10,
  },
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
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warnText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  successIcon: { alignSelf: "center", padding: 16, borderRadius: 50 },
});
