import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [accountStatus, setAccountStatus] = useState<"pending" | "rejected" | null>(null);

  async function handleLogin() {
    setEmailErr(""); setPasswordErr("");
    let hasErr = false;
    if (!email.trim()) { setEmailErr("Please enter your email address"); hasErr = true; }
    if (!password) { setPasswordErr("Please enter your password"); hasErr = true; }
    if (hasErr) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setAccountStatus(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err.code === "pending") {
        setAccountStatus("pending");
      } else if (err.code === "rejected") {
        setAccountStatus("rejected");
      } else {
        setPasswordErr(err.message ?? "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === "web" ? 60 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: "#FFFFFF" }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 4 }}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ width: 170, height: 66 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.headerSub}>Sign in to manage your solar services</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome Back</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: emailErr ? "#EF4444" : colors.border }]}>
              <Feather name="mail" size={16} color={emailErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailErr(""); }}
                placeholder="your@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {emailErr ? <Text style={styles.fieldErr}>{emailErr}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: passwordErr ? "#EF4444" : colors.border }]}>
              <Feather name="lock" size={16} color={passwordErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={(v) => { setPassword(v); setPasswordErr(""); }}
                placeholder="Enter password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {passwordErr ? <Text style={styles.fieldErr}>{passwordErr}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: loading ? colors.mutedForeground : colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Feather name="log-in" size={18} color="#FFFFFF" />
            <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
          </TouchableOpacity>

          {accountStatus === "pending" && (
            <View style={[styles.statusBox, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B55" }]}>
              <Feather name="clock" size={16} color="#F59E0B" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.statusTitle, { color: "#F59E0B" }]}>Account Awaiting Approval</Text>
                <Text style={[styles.statusMsg, { color: colors.mutedForeground }]}>
                  Your account is pending admin review. Please contact K&S Solar Energy to get approved.
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://wa.me/?text=Hi%2C%20please%20approve%20my%20K%26S%20Solar%20account")}
                  style={[styles.waBtn, { backgroundColor: "#25D36620" }]}
                  activeOpacity={0.8}
                >
                  <Feather name="message-circle" size={14} color="#25D366" />
                  <Text style={[styles.waBtnText, { color: "#25D366" }]}>Contact on WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {accountStatus === "rejected" && (
            <View style={[styles.statusBox, { backgroundColor: "#EF444418", borderColor: "#EF444455" }]}>
              <Feather name="x-circle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: "#EF4444" }]}>Account Not Approved</Text>
                <Text style={[styles.statusMsg, { color: colors.mutedForeground }]}>
                  Your account request was not approved. Please contact K&S Solar Energy for assistance.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push("/(auth)/forgot-password")}
            activeOpacity={0.75}
          >
            <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>
              Forgot your password?{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Reset it</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: colors.primary }]}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.85}
          >
            <Feather name="user-plus" size={18} color={colors.primary} />
            <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Create Account</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: "center",
    gap: 8,
  },
  logoRow: { marginBottom: 8 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { color: "#FFFFFF", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  form: { flex: 1, padding: 20, gap: 14 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  formTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
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
    marginTop: 4,
  },
  btnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
  adminHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  adminHintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  guestBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  forgotBtn: { alignItems: "center", paddingVertical: 2 },
  forgotText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statusMsg: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  waBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  fieldErr: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 2 },
});
