import { Feather } from "@expo/vector-icons";
import { useGetSettings } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createGuestComplaint } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(type);
};
const hapticSelection = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

const SYSTEM_TYPES = [
  { id: "Hybrid System", label: "Hybrid System", icon: "battery-charging" as const, color: "#10B981" },
  { id: "OnGrid System", label: "OnGrid System", icon: "zap" as const, color: "#3B82F6" },
  { id: "Off-Grid System", label: "Off-Grid System", icon: "wifi-off" as const, color: "#F59E0B" },
  { id: "Tubewell System", label: "Tubewell System", icon: "droplet" as const, color: "#6366F1" },
];

type SystemType = "Hybrid System" | "OnGrid System" | "Off-Grid System" | "Tubewell System";

export default function GuestComplaintScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [systemType, setSystemType] = useState<SystemType | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: settingsData } = useGetSettings();
  const complaintWA = settingsData?.find((s) => s.key === "whatsapp_complaint")?.value ?? "";

  async function handleSubmit() {
    if (!systemType) {
      Alert.alert("Error", "Please select your system type");
      return;
    }
    if (!customerName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Error", "Please enter your address");
      return;
    }
    if (!message.trim()) {
      Alert.alert("Error", "Please describe your complaint");
      return;
    }

    setIsPending(true);
    try {
      await createGuestComplaint({
        subject: systemType,
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        message: message.trim(),
      });
      hapticNotify(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch (err: any) {
      hapticNotify(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err?.message ?? "Could not submit complaint. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 4, backgroundColor: "#EF4444" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Complaint</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: "#10B98120" }]}>
            <Feather name="check-circle" size={56} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Complaint Submitted!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Your complaint has been received. Our team will contact you at{"\n"}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{phone}</Text>
            {"\n"}within 24 hours.
          </Text>
          {complaintWA ? (
            <TouchableOpacity
              style={[styles.homeBtn, { backgroundColor: "#25D366" }]}
              onPress={() => {
                const clean = complaintWA.replace(/\D/g, "");
                const msg = `Hello K&S Solar Energy!\n\nGuest Complaint Submitted:\n• Name: ${customerName}\n• Phone: ${phone}\n• System: ${systemType}\n\nPlease address my complaint. Thank you!`;
                Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() => {});
              }}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={16} color="#FFFFFF" />
              <Text style={styles.homeBtnText}>Follow up on WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.homeBtn, { backgroundColor: "#EF4444" }]}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Feather name="arrow-left" size={16} color="#FFFFFF" />
            <Text style={styles.homeBtnText}>Back to Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createAccountBtn, { borderColor: colors.secondary }]}
            onPress={() => router.push("/(auth)/register")}
          >
            <Feather name="user-plus" size={16} color={colors.secondary} />
            <Text style={[styles.createAccountBtnText, { color: colors.secondary }]}>
              Create Account to Track Status
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 4, backgroundColor: "#EF4444" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Submit Complaint</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Guest notice */}
        <View style={[styles.guestNotice, { backgroundColor: colors.secondary + "12", borderColor: colors.secondary + "30" }]}>
          <Feather name="user-x" size={15} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.guestNoticeTitle, { color: colors.secondary }]}>Guest Mode</Text>
            <Text style={[styles.guestNoticeSub, { color: colors.mutedForeground }]}>
              You can submit a complaint without an account. Create an account to track your complaint status.
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.warningBox, { backgroundColor: "#EF444412" }]}>
            <Feather name="alert-triangle" size={16} color="#EF4444" />
            <Text style={[styles.warningText, { color: "#EF4444" }]}>
              Please fill all details carefully so we can resolve your issue faster.
            </Text>
          </View>

          {/* System Type */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>System Type *</Text>
            <View style={styles.systemTypeGrid}>
              {SYSTEM_TYPES.map((st) => {
                const selected = systemType === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.systemTypeBtn,
                      {
                        backgroundColor: selected ? st.color + "18" : colors.muted,
                        borderColor: selected ? st.color : colors.border,
                      },
                    ]}
                    onPress={() => { setSystemType(st.id as SystemType); hapticSelection(); }}
                    activeOpacity={0.75}
                  >
                    <Feather name={st.icon} size={18} color={selected ? st.color : colors.mutedForeground} />
                    <Text
                      style={[styles.systemTypeBtnText, { color: selected ? st.color : colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Customer Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Your Name *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Muhammad Ali"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Phone Number *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="phone" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="0300-1234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Address *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={address}
                onChangeText={setAddress}
                placeholder="House #, Street, City"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Complaint Details */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Complaint Details *</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground },
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue in detail..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: isPending ? colors.mutedForeground : "#EF4444" }]}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.85}
          >
            <Feather name="send" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>{isPending ? "Submitting..." : "Submit Complaint"}</Text>
          </TouchableOpacity>
        </View>

        {/* Sign in nudge */}
        <TouchableOpacity
          style={[styles.signInNudge, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="log-in" size={15} color={colors.secondary} />
          <Text style={[styles.signInNudgeText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
            <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold" }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { padding: 8, borderRadius: 10 },
  topBarTitle: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  scrollContent: { padding: 16, gap: 14 },
  guestNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  guestNoticeTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 2 },
  guestNoticeSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 10,
    padding: 12,
  },
  warningText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  systemTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  systemTypeBtn: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  systemTypeBtnText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
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
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 110,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  signInNudge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  signInNudgeText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
  },
  homeBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  createAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  createAccountBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
