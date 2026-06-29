import { Feather } from "@expo/vector-icons";
import { useCreateGuestQuote, useCreateQuote, useGetSettings } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Linking,
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

const hapticSelection = () => { if (Platform.OS !== "web") Haptics.selectionAsync(); };
const hapticSuccess = () => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

type PropertyType = "house" | "commercial";
type SystemType = "on-grid" | "hybrid" | "off-grid" | "day-time" | "agri" | "commercial-system";

const PROPERTY_TYPES: { id: PropertyType; label: string; icon: keyof typeof Feather.glyphMap; color: string; desc: string }[] = [
  { id: "house", label: "Residential / House", icon: "home", color: "#1E3A5F", desc: "Single family home, villa, or residential property" },
  { id: "commercial", label: "Commercial Property", icon: "briefcase", color: "#0A5A9C", desc: "Office, factory, shop, or commercial building" },
];

const SYSTEM_TYPES: { id: SystemType; label: string; icon: keyof typeof Feather.glyphMap; color: string; desc: string }[] = [
  { id: "on-grid", label: "On-Grid", icon: "sun", color: "#F59E0B", desc: "Grid-tied, reduces electricity bills" },
  { id: "hybrid", label: "Hybrid", icon: "zap", color: "#8B5CF6", desc: "Grid + battery backup for 24/7 power" },
  { id: "off-grid", label: "Off-Grid", icon: "battery", color: "#10B981", desc: "Fully independent from the grid" },
  { id: "day-time", label: "Day-Time Only", icon: "clock", color: "#0EA5E9", desc: "Daytime power, no battery" },
  { id: "agri", label: "Agri / Tubewell", icon: "droplet", color: "#3B82F6", desc: "Agriculture & tubewell solutions" },
  { id: "commercial-system", label: "Commercial Scale", icon: "layout", color: "#EF4444", desc: "Large-scale commercial setup" },
];

export default function InstallationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [systemType, setSystemType] = useState<SystemType | null>(null);
  const [monthlyBill, setMonthlyBill] = useState("");
  const [roofArea, setRoofArea] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: settingsData } = useGetSettings();
  const installationWA = settingsData?.find((s) => s.key === "whatsapp_installation")?.value ?? "";
  const installationWARef = useRef("");
  installationWARef.current = installationWA;
  const installFieldsRef = useRef({ customerName, phone, city, propertyType, systemType, monthlyBill });
  installFieldsRef.current = { customerName, phone, city, propertyType, systemType, monthlyBill };

  function openInstallationWA() {
    const waNum = installationWARef.current;
    if (!waNum) return;
    const f = installFieldsRef.current;
    const propLabel = PROPERTY_TYPES.find(p => p.id === f.propertyType)?.label ?? f.propertyType ?? "";
    const sysLabel = SYSTEM_TYPES.find(s => s.id === f.systemType)?.label ?? f.systemType ?? "";
    const clean = waNum.replace(/\D/g, "");
    const msg = `Hello K&S Solar Energy! ☀️\n\nNew Installation Quote Request:\n• Name: ${f.customerName}\n• Phone: ${f.phone}\n• City: ${f.city}\n• Property: ${propLabel}\n• System: ${sysLabel}\n• Monthly Bill: Rs. ${f.monthlyBill}\n\nPlease send me a quotation. Thank you!`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() => {});
  }

  const quoteHandlers = {
    onSuccess: () => {
      hapticSuccess();
      setSubmitted(true);
      openInstallationWA();
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error ?? "Could not submit request. Please try again.");
    },
  };
  const { mutate: createQuote, isPending: submitting } = useCreateQuote({ mutation: quoteHandlers });
  const { mutate: createGuestQuote, isPending: guestSubmitting } = useCreateGuestQuote({ mutation: quoteHandlers });
  const isSubmitting = submitting || guestSubmitting;

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: "#0F172A" }]}>
          <Text style={styles.headerTitle}>Solar Installation</Text>
          <Text style={styles.headerSub}>Quotation Request</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: bottomPad + 40 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: "#10B98140" }]}>
            <View style={[styles.successIcon, { backgroundColor: "#10B98118" }]}>
              <Feather name="check-circle" size={48} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Request Submitted!</Text>
            <Text style={[styles.successMsg, { color: colors.mutedForeground }]}>
              Your solar installation quotation request has been received. Our team will review your requirements and respond with a tailored quote shortly.
            </Text>
            <View style={[styles.successInfoRow, { backgroundColor: "#0A5A9C10", borderColor: "#0A5A9C30" }]}>
              <Feather name="clock" size={14} color="#0A5A9C" />
              <Text style={[styles.successInfoText, { color: colors.mutedForeground }]}>
                Expected response within <Text style={{ color: "#0A5A9C", fontFamily: "Inter_700Bold" }}>24–48 hours</Text>
              </Text>
            </View>
          </View>
          {installationWA ? (
            <TouchableOpacity
              style={[styles.waBtn, { backgroundColor: "#25D366" }]}
              onPress={openInstallationWA}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
              <Text style={styles.waBtnText}>Follow up on WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.viewQuotesBtn, { backgroundColor: "#0F172A" }]}
            onPress={() => router.push("/(tabs)/bookings" as never)}
            activeOpacity={0.85}
          >
            <Feather name="list" size={16} color="#FFFFFF" />
            <Text style={styles.viewQuotesBtnText}>View My Quotes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newRequestLink}
            onPress={() => {
              setSubmitted(false); setStep(1);
              setPropertyType(null); setSystemType(null);
              setMonthlyBill(""); setRoofArea(""); setNotes("");
              setCity(""); setAddress("");
            }}
          >
            <Text style={[styles.newRequestLinkText, { color: colors.mutedForeground }]}>Submit another request</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  function goBack() {
    hapticSelection();
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function handleStep1Next() {
    if (!propertyType) { Alert.alert("Required", "Please select a property type"); return; }
    if (!systemType) { Alert.alert("Required", "Please select a preferred system type"); return; }
    hapticSelection();
    setStep(2);
  }

  function handleStep2Next() {
    if (!monthlyBill.trim()) { Alert.alert("Required", "Please enter your average monthly electricity bill"); return; }
    hapticSelection();
    setStep(3);
  }

  function handleSubmit() {
    if (!customerName.trim()) { Alert.alert("Required", "Please enter your full name"); return; }
    if (!phone.trim()) { Alert.alert("Required", "Please enter your phone number"); return; }
    if (!city.trim()) { Alert.alert("Required", "Please enter your city"); return; }
    if (!address.trim()) { Alert.alert("Required", "Please enter your address"); return; }

    const data = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
      propertyType: propertyType!,
      monthlyBill: monthlyBill.trim(),
      roofArea: roofArea.trim() || undefined,
      systemType: systemType!,
      notes: notes.trim() || undefined,
    };
    if (user) {
      createQuote({ data });
    } else {
      createGuestQuote({ data });
    }
  }

  const selectedProp = PROPERTY_TYPES.find(p => p.id === propertyType);
  const selectedSys = SYSTEM_TYPES.find(s => s.id === systemType);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: "#0F172A" }]}>
        <View style={styles.headerRow}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Solar Installation</Text>
            <Text style={styles.headerSub}>
              {step === 1 ? "Property & system type" : step === 2 ? "Requirements" : "Contact details"}
            </Text>
          </View>
          <View style={[styles.stepBadge, { backgroundColor: "#FFFFFF22" }]}>
            <Text style={styles.stepBadgeText}>{step}/3</Text>
          </View>
        </View>
        <View style={[styles.progressBar, { backgroundColor: "#FFFFFF22" }]}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` as `${number}%` }]} />
        </View>
      </View>

      {/* Step 1: Property type + System type */}
      {step === 1 && (
        <ScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: bottomPad + 32 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: "#FFFFFF" }]}>What kind of property?</Text>
          <View style={styles.propertyRow}>
            {PROPERTY_TYPES.map((p) => {
              const active = propertyType === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.propertyCard, { backgroundColor: colors.card, borderColor: active ? p.color : colors.border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => { hapticSelection(); setPropertyType(p.id); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.propertyIcon, { backgroundColor: p.color + "18" }]}>
                    <Feather name={p.icon} size={24} color={p.color} />
                  </View>
                  <Text style={[styles.propertyLabel, { color: colors.foreground }]}>{p.label}</Text>
                  <Text style={[styles.propertyDesc, { color: colors.mutedForeground }]}>{p.desc}</Text>
                  {active && (
                    <View style={[styles.propertyCheck, { backgroundColor: p.color }]}>
                      <Feather name="check" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.stepTitle, { color: "#FFFFFF", marginTop: 8 }]}>Preferred system type</Text>
          <View style={styles.systemGrid}>
            {SYSTEM_TYPES.map((s) => {
              const active = systemType === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.systemCard, { backgroundColor: colors.card, borderColor: active ? s.color : colors.border, borderWidth: active ? 2 : 1 }]}
                  onPress={() => { hapticSelection(); setSystemType(s.id); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.systemIcon, { backgroundColor: s.color + "18" }]}>
                    <Feather name={s.icon} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.systemLabel, { color: colors.foreground }]}>{s.label}</Text>
                  <Text style={[styles.systemDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                  {active && (
                    <View style={[styles.systemCheck, { backgroundColor: s.color }]}>
                      <Feather name="check" size={9} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: "#0F172A" }]} onPress={handleStep1Next} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 2: Bill, roof area, notes */}
      {step === 2 && (
        <KeyboardAwareScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: bottomPad + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.recapRow}>
            {selectedProp && (
              <View style={[styles.recapPill, { backgroundColor: selectedProp.color + "15", borderColor: selectedProp.color + "44" }]}>
                <Feather name={selectedProp.icon} size={12} color={selectedProp.color} />
                <Text style={[styles.recapText, { color: selectedProp.color }]}>{selectedProp.label}</Text>
              </View>
            )}
            {selectedSys && (
              <View style={[styles.recapPill, { backgroundColor: selectedSys.color + "15", borderColor: selectedSys.color + "44" }]}>
                <Feather name={selectedSys.icon} size={12} color={selectedSys.color} />
                <Text style={[styles.recapText, { color: selectedSys.color }]}>{selectedSys.label}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.stepTitle, { color: "#FFFFFF" }]}>Your requirements</Text>

          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Monthly Electricity Bill <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="dollar-sign" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={monthlyBill}
                  onChangeText={setMonthlyBill}
                  placeholder="e.g. Rs. 8,000 / month"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Roof / Installation Area <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text>
              </Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="maximize" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={roofArea}
                  onChangeText={setRoofArea}
                  placeholder="e.g. 1000 sq ft"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Additional Notes <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text>
              </Text>
              <View style={[styles.textAreaRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textArea, { color: colors.foreground }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any special requirements, existing system info, etc."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: "#0F172A" }]} onPress={handleStep2Next} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      )}

      {/* Step 3: Contact + Submit */}
      {step === 3 && (
        <KeyboardAwareScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: bottomPad + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.recapRow}>
            {selectedProp && (
              <View style={[styles.recapPill, { backgroundColor: selectedProp.color + "15", borderColor: selectedProp.color + "44" }]}>
                <Feather name={selectedProp.icon} size={12} color={selectedProp.color} />
                <Text style={[styles.recapText, { color: selectedProp.color }]}>{selectedProp.label}</Text>
              </View>
            )}
            {selectedSys && (
              <View style={[styles.recapPill, { backgroundColor: selectedSys.color + "15", borderColor: selectedSys.color + "44" }]}>
                <Feather name={selectedSys.icon} size={12} color={selectedSys.color} />
                <Text style={[styles.recapText, { color: selectedSys.color }]}>{selectedSys.label}</Text>
              </View>
            )}
            {monthlyBill ? (
              <View style={[styles.recapPill, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
                <Feather name="dollar-sign" size={12} color="#10B981" />
                <Text style={[styles.recapText, { color: "#10B981" }]}>{monthlyBill}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.stepTitle, { color: "#FFFFFF" }]}>Contact details</Text>

          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full Name <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="user" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Phone Number <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="phone" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0300-0000000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>City <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="map-pin" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Lahore"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Address <Text style={{ color: "#EF4444" }}>*</Text></Text>
              <View style={[styles.textAreaRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textArea, { color: colors.foreground }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House No, Street, Area"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: "#0A5A9C", opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Feather name="send" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>{isSubmitting ? "Submitting…" : "Submit Quotation Request"}</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFCC", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  stepBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stepBadgeText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: "#FFFFFF" },
  stepContent: { padding: 20, gap: 16 },
  stepTitle: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26 },
  propertyRow: { flexDirection: "row", gap: 12 },
  propertyCard: {
    flex: 1, borderRadius: 16, padding: 14, gap: 8, position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  propertyIcon: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  propertyLabel: { fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 18 },
  propertyDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  propertyCheck: {
    position: "absolute", top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  systemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  systemCard: {
    width: "47%", borderRadius: 14, padding: 12, gap: 6, position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  systemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  systemLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  systemDesc: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 15 },
  systemCheck: {
    position: "absolute", top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  recapRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  recapPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  recapText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  formCard: {
    borderRadius: 18, borderWidth: 1, padding: 16, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  optional: { fontSize: 11, fontFamily: "Inter_400Regular" },
  inputRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, gap: 10,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  textAreaRow: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  textArea: { fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 72, padding: 0 },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  nextBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 14,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  successCard: {
    borderRadius: 20, borderWidth: 1.5, padding: 28, alignItems: "center", gap: 14,
  },
  successIcon: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  successMsg: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  successInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, alignSelf: "stretch",
  },
  successInfoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  viewQuotesBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  viewQuotesBtnText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  newRequestLink: { alignItems: "center", paddingVertical: 8 },
  newRequestLinkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  waBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  waBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
});
