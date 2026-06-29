import { Feather } from "@expo/vector-icons";
import { getGetComplaintsQueryKey, useCreateComplaint, useCreateGuestComplaint, useGetComplaints, useGetSettings } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const STATUS_COLORS: Record<string, string> = {
  open: "#F59E0B",
  in_review: "#3B82F6",
  resolved: "#10B981",
  closed: "#64748B",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  resolved: "Resolved",
  closed: "Closed",
};

type SystemType = "Hybrid System" | "OnGrid System" | "Off-Grid System" | "Tubewell System";

export default function ComplaintScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [view, setView] = useState<"form" | "list" | "success">("form");
  const [systemType, setSystemType] = useState<SystemType | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  const { data: settingsData } = useGetSettings();
  const complaintWA = settingsData?.find((s) => s.key === "whatsapp_complaint")?.value ?? "";
  const complaintWARef = useRef("");
  complaintWARef.current = complaintWA;
  const complaintFieldsRef = useRef({ customerName, phone, systemType });
  complaintFieldsRef.current = { customerName, phone, systemType };

  function openComplaintWhatsApp() {
    const waNum = complaintWARef.current;
    if (!waNum) return;
    const f = complaintFieldsRef.current;
    const clean = waNum.replace(/\D/g, "");
    const msg = `Hello K&S Solar Energy!\n\nNew Complaint Submitted:\n• Name: ${f.customerName}\n• Phone: ${f.phone}\n• System: ${f.systemType}\n\nPlease address this complaint urgently. Thank you!`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() => {});
  }

  function autoSendComplaintWA() {
    const waNum = complaintWARef.current;
    if (!waNum) return;
    const f = complaintFieldsRef.current;
    const clean = waNum.replace(/\D/g, "");
    const msg = `Hello K&S Solar Energy!\n\nNew Complaint Submitted:\n• Name: ${f.customerName}\n• Phone: ${f.phone}\n• System: ${f.systemType}\n\nPlease address this complaint urgently. Thank you!`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() => {});
  }

  const { user } = useAuth();
  const { data: complaints, isLoading, refetch, isRefetching } = useGetComplaints({ query: { queryKey: getGetComplaintsQueryKey(), enabled: !!user } });

  const { mutate: submitComplaint, isPending } = useCreateComplaint({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setView("success");
        refetch();
        autoSendComplaintWA();
      },
      onError: (err: any) => {
        hapticNotify(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", err?.message ?? "Could not submit complaint");
      },
    },
  });
  const { mutate: submitGuestComplaint, isPending: isGuestPending } = useCreateGuestComplaint({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setView("success");
        autoSendComplaintWA();
      },
      onError: (err: any) => {
        hapticNotify(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", err?.message ?? "Could not submit complaint");
      },
    },
  });
  const isSubmitting = isPending || isGuestPending;

  function handleSubmit() {
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
    const data = {
      subject: systemType,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      message: message.trim(),
    };
    if (user) {
      submitComplaint({ data });
    } else {
      submitGuestComplaint({ data });
    }
  }

  if (view === "success") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.destructive }]}>
          <Text style={styles.headerTitle}>Complaints</Text>
          <Text style={styles.headerSub}>Submit or track your complaints</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: "#10B98120" }]}>
            <Feather name="check-circle" size={52} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Complaint Submitted!</Text>
          <Text style={[styles.successSub, { color: "#191818CC" }]}>
            Our team will contact you at{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: "#191818" }}>{phone}</Text>{" "}
            within 24 hours.
          </Text>
          {complaintWA ? (
            <TouchableOpacity
              style={[styles.waBtn, { backgroundColor: "#25D366" }]}
              onPress={openComplaintWhatsApp}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
              <Text style={styles.waBtnText}>Follow up on WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          {user && (
            <TouchableOpacity
              style={[styles.successListBtn, { backgroundColor: colors.destructive }]}
              onPress={() => {
                setSystemType(null);
                setCustomerName("");
                setPhone("");
                setAddress("");
                setMessage("");
                setView("list");
              }}
            >
              <Feather name="list" size={16} color="#FFFFFF" />
              <Text style={styles.successListBtnText}>View My Complaints</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setSystemType(null);
              setCustomerName("");
              setPhone("");
              setAddress("");
              setMessage("");
              setView("form");
            }}
          >
            <Text style={[styles.newComplaintLink, { color: colors.mutedForeground }]}>
              Submit another complaint
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.destructive }]}>
        <Text style={styles.headerTitle}>Complaints</Text>
        <Text style={styles.headerSub}>Submit or track your complaints</Text>
      </View>

      {user && (
        <View style={[styles.segmentRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["form", "list"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.segBtn, view === tab && { backgroundColor: colors.destructive }]}
              onPress={() => setView(tab)}
            >
              <Feather
                name={tab === "form" ? "edit-3" : "list"}
                size={15}
                color={view === tab ? "#FFFFFF" : colors.mutedForeground}
              />
              <Text style={[styles.segBtnText, { color: view === tab ? "#FFFFFF" : colors.mutedForeground }]}>
                {tab === "form" ? "New Complaint" : "My Complaints"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {view === "form" ? (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.formContent, { paddingBottom: bottomPad + 100 }]}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.warningBox, { backgroundColor: colors.destructive + "12" }]}>
              <Feather name="alert-triangle" size={16} color={colors.destructive} />
              <Text style={[styles.warningText, { color: colors.destructive }]}>
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
                        style={[
                          styles.systemTypeBtnText,
                          { color: selected ? st.color : colors.mutedForeground },
                        ]}
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
              <Text style={[styles.label, { color: colors.foreground }]}>Customer Name *</Text>
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
              style={[
                styles.submitBtn,
                { backgroundColor: isSubmitting ? colors.mutedForeground : colors.destructive },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Feather name="send" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>{isSubmitting ? "Submitting..." : "Submit Complaint"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      ) : (
        <FlatList
          data={complaints ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.destructive} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="check-circle" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isLoading ? "Loading..." : "No complaints yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                All good! No complaints submitted.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] ?? "#64748B";
            const systemObj = SYSTEM_TYPES.find((s) => s.id === item.subject);
            return (
              <View style={[styles.complaintCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.complaintHeader}>
                  <View style={styles.complaintTitleRow}>
                    {systemObj && (
                      <View style={[styles.systemDot, { backgroundColor: systemObj.color + "22" }]}>
                        <Feather name={systemObj.icon} size={14} color={systemObj.color} />
                      </View>
                    )}
                    <Text style={[styles.complaintSubject, { color: colors.foreground }]} numberOfLines={1}>
                      {item.subject}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusColor + "18" }]}>
                    <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.badgeText, { color: statusColor }]}>
                      {STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>

                {(item.customerName || item.phone) && (
                  <View style={styles.metaRow}>
                    {item.customerName && (
                      <View style={styles.metaItem}>
                        <Feather name="user" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.customerName}</Text>
                      </View>
                    )}
                    {item.phone && (
                      <View style={styles.metaItem}>
                        <Feather name="phone" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.phone}</Text>
                      </View>
                    )}
                  </View>
                )}

                {item.address && (
                  <View style={styles.metaItem}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
                  </View>
                )}

                <Text style={[styles.complaintMsg, { color: colors.mutedForeground }]} numberOfLines={3}>
                  {item.message}
                </Text>
                <Text style={[styles.complaintDate, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString("en-PK", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 4 },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular" },
  segmentRow: {
    flexDirection: "row", margin: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  successContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 14, paddingHorizontal: 32,
    backgroundColor: "#FFFFFF",
  },
  successIcon: {
    width: 96, height: 96, borderRadius: 28,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  successTitle: {
    fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center",
  },
  successSub: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 22,
  },
  waBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  waBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  successListBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  successListBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  newComplaintLink: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  segBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
  },
  segBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  formContent: { padding: 16, paddingTop: 0 },
  card: {
    borderRadius: 18, borderWidth: 1, padding: 20, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  warningBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, padding: 12,
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
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  textArea: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 110,
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16, paddingTop: 0, gap: 10 },
  complaintCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  complaintHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8,
  },
  complaintTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  systemDot: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  complaintSubject: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  complaintMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  complaintDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
