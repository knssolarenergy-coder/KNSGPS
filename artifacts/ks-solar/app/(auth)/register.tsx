import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(type);
};
const hapticSelection = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

const INVERTER_BRANDS = [
  { id: "livoltek", name: "Livoltek", icon: "zap" as const, color: "#F59E0B" },
  { id: "solarman", name: "Solarman Smart", icon: "sun" as const, color: "#EF4444" },
  { id: "goodwe", name: "GoodWe (SEMS+)", icon: "cpu" as const, color: "#3B82F6" },
  { id: "solarmax", name: "Solar Max", icon: "cloud" as const, color: "#0EA5E9" },
  { id: "solarmax-hybrid", name: "Solarmax Hybrid", icon: "battery-charging" as const, color: "#10B981" },
  { id: "auxol", name: "Auxol", icon: "shield" as const, color: "#8B5CF6" },
  { id: "sigenergy", name: "Sigenergy", icon: "radio" as const, color: "#F97316" },
  { id: "huawei", name: "Huawei FusionSolar", icon: "globe" as const, color: "#EF4444" },
  { id: "growatt", name: "Growatt", icon: "trending-up" as const, color: "#10B981" },
  { id: "solaredge", name: "SolarEdge", icon: "bar-chart-2" as const, color: "#6366F1" },
  { id: "fronius", name: "Fronius", icon: "monitor" as const, color: "#EC4899" },
  { id: "itel", name: "iTeL Energy Hybrid", icon: "zap-off" as const, color: "#06B6D4" },
  { id: "inverex", name: "Inverex", icon: "activity" as const, color: "#14B8A6" },
];

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [accountType, setAccountType] = useState<"customer" | "master">("customer");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [confirmPassErr, setConfirmPassErr] = useState("");
  const [brandErr, setBrandErr] = useState("");

  const isMaster = accountType === "master";
  const selectedBrandObj = INVERTER_BRANDS.find((b) => b.id === selectedBrand);

  async function handleRegister() {
    setNameErr(""); setEmailErr(""); setPhoneErr("");
    setPasswordErr(""); setConfirmPassErr(""); setBrandErr("");
    let hasErr = false;
    if (!name.trim()) { setNameErr("Full name is required"); hasErr = true; }
    if (!email.trim()) { setEmailErr("Email address is required"); hasErr = true; }
    if (!phone.trim()) { setPhoneErr("Phone number is required"); hasErr = true; }
    if (!isMaster && !selectedBrand) { setBrandErr("Please select your inverter brand"); hasErr = true; }
    if (!password) { setPasswordErr("Password is required"); hasErr = true; }
    else if (password.length < 6) { setPasswordErr("Password must be at least 6 characters"); hasErr = true; }
    if (password && password !== confirmPassword) { setConfirmPassErr("Passwords do not match"); hasErr = true; }
    if (hasErr) { hapticNotify(Haptics.NotificationFeedbackType.Warning); return; }
    setLoading(true);
    try {
      const isPending = await register(
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        password,
        isMaster,
        isMaster ? null : selectedBrand,
        referralCode.trim() || null
      );
      hapticNotify(Haptics.NotificationFeedbackType.Success);
      if (isPending) {
        setSubmitted(true);
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      hapticNotify(Haptics.NotificationFeedbackType.Error);
      const msg: string = err.message ?? "";
      if (msg.toLowerCase().includes("email")) {
        setEmailErr(msg);
      } else {
        Alert.alert("Registration Failed", msg || "Could not create account");
      }
    } finally {
      setLoading(false);
    }
  }

  // Pending approval success screen
  if (submitted) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: "#FFFFFF" }]}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 20 }]}
      >
        <View style={[styles.successContainer, { backgroundColor: "#FFFFFF" }]}>
          <View style={[styles.successIconCircle, { backgroundColor: "#10B981" + "20" }]}>
            <Feather name="clock" size={48} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Request Submitted!
          </Text>
          <Text style={[styles.successSubtitle, { color: "#000000CC" }]}>
            Your account is awaiting admin approval
          </Text>

          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.successRow}>
              <Feather name="user" size={16} color={colors.primary} />
              <Text style={[styles.successLabel, { color: colors.mutedForeground }]}>Name</Text>
              <Text style={[styles.successValue, { color: colors.foreground }]}>{name.trim()}</Text>
            </View>
            <View style={[styles.successDivider, { backgroundColor: colors.border }]} />
            <View style={styles.successRow}>
              <Feather name="mail" size={16} color={colors.primary} />
              <Text style={[styles.successLabel, { color: colors.mutedForeground }]}>Email</Text>
              <Text style={[styles.successValue, { color: colors.foreground }]}>{email.trim().toLowerCase()}</Text>
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              K&S Solar Energy will review your account and approve it within 24 hours. You will be able to sign in once approved.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Feather name="log-in" size={18} color="#FFFFFF" />
            <Text style={styles.btnText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: "#FFFFFF" }]}
      contentContainerStyle={styles.scrollContent}
      bottomOffset={20}
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
        <Text style={styles.headerSub}>Create an account to book our services</Text>
      </View>

      <View style={styles.form}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Create Account</Text>

          {/* Account Type Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Account Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: accountType === "customer" ? colors.primary : colors.muted,
                    borderColor: accountType === "customer" ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setAccountType("customer"); hapticSelection(); }}
                activeOpacity={0.8}
              >
                <Feather name="user" size={16} color={accountType === "customer" ? "#FFF" : colors.mutedForeground} />
                <Text style={[styles.typeBtnText, { color: accountType === "customer" ? "#FFF" : colors.mutedForeground }]}>
                  Customer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: accountType === "master" ? "#1B6FA8" : colors.muted,
                    borderColor: accountType === "master" ? "#1B6FA8" : colors.border,
                  },
                ]}
                onPress={() => { setAccountType("master"); hapticSelection(); }}
                activeOpacity={0.8}
              >
                <Feather name="star" size={16} color={accountType === "master" ? "#FFD700" : colors.mutedForeground} />
                <Text style={[styles.typeBtnText, { color: accountType === "master" ? "#FFD700" : colors.mutedForeground }]}>
                  Master
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.typeHint, { backgroundColor: isMaster ? "#1B6FA818" : colors.primary + "12", borderColor: isMaster ? "#1B6FA844" : colors.primary + "33" }]}>
              <Feather name="info" size={13} color={isMaster ? "#1B6FA8" : colors.primary} />
              <Text style={[styles.typeHintText, { color: isMaster ? "#1B6FA8" : colors.primary }]}>
                {isMaster
                  ? "Master account can view all inverter brands in the monitoring portal."
                  : "Customer account shows only your selected inverter brand."}
              </Text>
            </View>
          </View>

          {/* Inverter Brand Picker — only for customer */}
          {!isMaster && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Your Inverter Brand</Text>
              <TouchableOpacity
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.muted,
                    borderColor: brandErr ? "#EF4444" : selectedBrand ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setShowBrandPicker((v) => !v); hapticSelection(); }}
                activeOpacity={0.8}
              >
                {selectedBrandObj ? (
                  <View style={[styles.brandDot, { backgroundColor: selectedBrandObj.color }]} />
                ) : (
                  <Feather name="zap" size={16} color={colors.mutedForeground} />
                )}
                <Text style={[styles.input, { color: selectedBrand ? colors.foreground : colors.mutedForeground }]}>
                  {selectedBrandObj ? selectedBrandObj.name : "Select inverter brand…"}
                </Text>
                <Feather name={showBrandPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>

              {showBrandPicker && (
                <View style={[styles.brandDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {INVERTER_BRANDS.map((brand) => (
                    <TouchableOpacity
                      key={brand.id}
                      style={[
                        styles.brandOption,
                        selectedBrand === brand.id && { backgroundColor: colors.primary + "18" },
                      ]}
                      onPress={() => {
                        setSelectedBrand(brand.id);
                        setShowBrandPicker(false);
                        setBrandErr("");
                        hapticSelection();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.brandDot, { backgroundColor: brand.color }]} />
                      <Text style={[styles.brandOptionText, { color: colors.foreground }]}>{brand.name}</Text>
                      {selectedBrand === brand.id && (
                        <Feather name="check" size={16} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {brandErr ? <Text style={styles.fieldErr}>{brandErr}</Text> : null}
            </View>
          )}

          {/* Basic fields */}
          {([
            { label: "Full Name", value: name, onChange: setName, icon: "user" as const, placeholder: "Muhammad Ali", keyboard: "default" as const, err: nameErr, clearErr: () => setNameErr("") },
            { label: "Email Address", value: email, onChange: setEmail, icon: "mail" as const, placeholder: "your@email.com", keyboard: "email-address" as const, err: emailErr, clearErr: () => setEmailErr("") },
            { label: "Phone Number", value: phone, onChange: setPhone, icon: "phone" as const, placeholder: "0300-1234567", keyboard: "phone-pad" as const, err: phoneErr, clearErr: () => setPhoneErr("") },
          ]).map((f) => (
            <View key={f.label} style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>{f.label}</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: f.err ? "#EF4444" : colors.border }]}>
                <Feather name={f.icon} size={16} color={f.err ? "#EF4444" : colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={f.value}
                  onChangeText={(v) => { f.onChange(v); f.clearErr(); }}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={f.keyboard}
                  autoCapitalize={f.keyboard === "email-address" ? "none" : "words"}
                  autoCorrect={false}
                />
              </View>
              {f.err ? <Text style={styles.fieldErr}>{f.err}</Text> : null}
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: passwordErr ? "#EF4444" : colors.border }]}>
              <Feather name="lock" size={16} color={passwordErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={password}
                onChangeText={(v) => { setPassword(v); setPasswordErr(""); }}
                placeholder="Min. 6 characters"
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

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Confirm Password</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: confirmPassErr ? "#EF4444" : colors.border }]}>
              <Feather name="lock" size={16} color={confirmPassErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setConfirmPassErr(""); }}
                placeholder="Repeat password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
            </View>
            {confirmPassErr ? <Text style={styles.fieldErr}>{confirmPassErr}</Text> : null}
          </View>

          {/* Referral Code — optional */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Referral Code <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>(optional)</Text></Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: referralCode.trim() ? "#10B981" : colors.border }]}>
              <Feather name="gift" size={16} color={referralCode.trim() ? "#10B981" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={referralCode}
                onChangeText={(v) => setReferralCode(v.toUpperCase())}
                placeholder="Enter referral code e.g. AB3X7Q"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
              {referralCode.trim().length > 0 && (
                <TouchableOpacity onPress={() => setReferralCode("")} activeOpacity={0.7}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.typeHintText, { color: colors.mutedForeground, marginTop: 2 }]}>
              Got a referral code from a friend? Enter it here to give them bonus points.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: loading ? colors.mutedForeground : colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Feather name="user-plus" size={18} color="#FFFFFF" />
            <Text style={styles.btnText}>{loading ? "Submitting request..." : "Create Account"}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>Already have an account?</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.outlineBtn, { borderColor: colors.secondary }]}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Feather name="log-in" size={18} color={colors.secondary} />
            <Text style={[styles.outlineBtnText, { color: colors.secondary }]}>Sign In Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareScrollView>
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
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandName: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  form: { flex: 1, padding: 20, paddingBottom: 40 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  formTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  typeHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  typeHintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
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
  brandDot: { width: 12, height: 12, borderRadius: 6 },
  brandDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 2,
  },
  brandOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  brandOptionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
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
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
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
  // Success / pending screen
  successContainer: {
    flex: 1,
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  successCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  successRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  successLabel: { fontSize: 13, fontFamily: "Inter_500Medium", width: 50 },
  successValue: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  successDivider: { height: 1, marginVertical: 4 },
  infoBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fieldErr: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 2 },
});
