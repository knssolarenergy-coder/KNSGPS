import { Feather } from "@expo/vector-icons";
import { useCreateBooking, useCreateGuestBooking, useGetSettings } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
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
import { useColors } from "@/hooks/useColors";

const hapticSelection = () => { if (Platform.OS !== "web") Haptics.selectionAsync(); };
const hapticNotify = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== "web") Haptics.notificationAsync(type); };

const PANEL_TYPES = [
  { value: "residential" as const, label: "Residential", icon: "home" as const },
  { value: "commercial" as const, label: "Commercial", icon: "briefcase" as const },
];

const TIME_SLOTS = [
  { value: "morning" as const, label: "Morning", sub: "8am - 12pm", icon: "sunrise" as const },
  { value: "afternoon" as const, label: "Afternoon", sub: "12pm - 4pm", icon: "sun" as const },
  { value: "evening" as const, label: "Evening", sub: "4pm - 7pm", icon: "sunset" as const },
];

interface FormData {
  customerName: string;
  phone: string;
  address: string;
  city: string;
  panelCount: string;
  panelType: "residential" | "commercial";
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening";
  notes: string;
}

interface FieldErrors {
  customerName?: string;
  phone?: string;
  address?: string;
  city?: string;
  panelCount?: string;
  preferredDate?: string;
}

export default function BookingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  const [form, setForm] = useState<FormData>({
    customerName: "",
    phone: "",
    address: "",
    city: "",
    panelCount: "",
    panelType: "residential",
    preferredDate: "",
    preferredTime: "morning",
    notes: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: settingsData } = useGetSettings();
  const bookingWA = settingsData?.find((s) => s.key === "whatsapp_booking")?.value ?? "";
  const bookingWARef = useRef("");
  bookingWARef.current = bookingWA;
  const formRef = useRef(form);
  formRef.current = form;

  function openWhatsApp() {
    const waNum = bookingWARef.current;
    if (!waNum) return;
    const f = formRef.current;
    const clean = waNum.replace(/\D/g, "");
    const msg =
      `Hello K&S Solar Energy! 🌞\n\nNew Solar Panels Washing Booking:\n• Name: ${f.customerName}\n• Phone: ${f.phone}\n• Address: ${f.address}, ${f.city}\n• Panels: ${f.panelCount} (${f.panelType})\n• Date: ${f.preferredDate} (${f.preferredTime})\n\nPlease confirm my booking. Thank you!`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp"),
    );
  }

  const mutationHandlers = {
    onSuccess: () => {
      hapticNotify(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      // Auto-notify admin on WhatsApp
      const waNum = bookingWARef.current;
      if (waNum) {
        const f = formRef.current;
        const clean = waNum.replace(/\D/g, "");
        const msg = `Hello K&S Solar Energy! 🌞\n\nNew Solar Panels Washing Booking:\n• Name: ${f.customerName}\n• Phone: ${f.phone}\n• Address: ${f.address}, ${f.city}\n• Panels: ${f.panelCount} (${f.panelType})\n• Date: ${f.preferredDate} (${f.preferredTime})\n\nPlease confirm my booking. Thank you!`;
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`).catch(() => {});
      }
    },
    onError: () => {
      hapticNotify(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Could not submit booking. Please try again.");
    },
  };
  const { mutate: createBooking, isPending } = useCreateBooking({ mutation: mutationHandlers });
  const { mutate: createGuestBooking, isPending: isGuestPending } = useCreateGuestBooking({ mutation: mutationHandlers });
  const isSubmitting = isPending || isGuestPending;

  function update(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof FieldErrors]) {
      setErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: FieldErrors = {};
    if (!form.customerName.trim()) newErrors.customerName = "Name is required";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    if (!form.address.trim()) newErrors.address = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.panelCount.trim() || isNaN(Number(form.panelCount)) || Number(form.panelCount) < 1) {
      newErrors.panelCount = "Enter a valid panel count";
    }
    if (!form.preferredDate.trim()) newErrors.preferredDate = "Select a date";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) {
      hapticNotify(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const data = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      panelCount: parseInt(form.panelCount, 10),
      panelType: form.panelType,
      preferredDate: form.preferredDate.trim(),
      preferredTime: form.preferredTime,
      notes: form.notes.trim() || undefined,
    };
    if (user) {
      createBooking({ data });
    } else {
      createGuestBooking({ data });
    }
  }

  function handleReset() {
    setForm({
      customerName: "",
      phone: "",
      address: "",
      city: "",
      panelCount: "",
      panelType: "residential",
      preferredDate: "",
      preferredTime: "morning",
      notes: "",
    });
    setErrors({});
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.successIcon, { backgroundColor: colors.accent + "18" }]}>
            <Feather name="check-circle" size={48} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Booking Submitted!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Your solar panels washing request has been received. Our team will contact you at{" "}
            <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{form.phone}</Text>{" "}
            to confirm.
          </Text>

          {bookingWA ? (
            <TouchableOpacity
              style={[styles.waBtn, { backgroundColor: "#25D366" }]}
              onPress={openWhatsApp}
              activeOpacity={0.85}
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
              <Text style={styles.waBtnText}>Send Details via WhatsApp</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleReset}
          >
            <Text style={styles.primaryBtnText}>Book Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100 }}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Book Solar Panels Washing</Text>
        <Text style={styles.headerSub}>Fill in your details and we'll get back to you</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.secondary }]}>Customer Information</Text>

          <FormField
            label="Full Name"
            value={form.customerName}
            onChangeText={(v) => update("customerName", v)}
            placeholder="e.g. Muhammad Ali"
            error={errors.customerName}
            icon="user"
            colors={colors}
          />
          <FormField
            label="Phone Number"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            placeholder="e.g. 0300-1234567"
            error={errors.phone}
            icon="phone"
            keyboardType="phone-pad"
            colors={colors}
          />
          <FormField
            label="Full Address"
            value={form.address}
            onChangeText={(v) => update("address", v)}
            placeholder="Street, area, locality"
            error={errors.address}
            icon="map-pin"
            multiline
            colors={colors}
          />
          <FormField
            label="City"
            value={form.city}
            onChangeText={(v) => update("city", v)}
            placeholder="e.g. Lahore, Karachi, Islamabad"
            error={errors.city}
            icon="navigation"
            colors={colors}
          />
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.secondary }]}>Solar Panel Details</Text>

          <FormField
            label="Number of Panels"
            value={form.panelCount}
            onChangeText={(v) => update("panelCount", v)}
            placeholder="e.g. 12"
            error={errors.panelCount}
            icon="grid"
            keyboardType="numeric"
            colors={colors}
          />

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Panel Type</Text>
          <View style={styles.selectorRow}>
            {PANEL_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt.value}
                style={[
                  styles.selectorOption,
                  {
                    backgroundColor: form.panelType === pt.value ? colors.primary : colors.muted,
                    borderColor: form.panelType === pt.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setForm((f) => ({ ...f, panelType: pt.value }));
                  hapticSelection();
                }}
              >
                <Feather
                  name={pt.icon}
                  size={18}
                  color={form.panelType === pt.value ? "#FFFFFF" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.selectorLabel,
                    { color: form.panelType === pt.value ? "#FFFFFF" : colors.foreground },
                  ]}
                >
                  {pt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.secondary }]}>Schedule</Text>

          <FormField
            label="Preferred Date"
            value={form.preferredDate}
            onChangeText={(v) => update("preferredDate", v)}
            placeholder="YYYY-MM-DD (e.g. 2026-06-15)"
            error={errors.preferredDate}
            icon="calendar"
            colors={colors}
          />

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Preferred Time Slot</Text>
          <View style={styles.timeSlotContainer}>
            {TIME_SLOTS.map((ts) => (
              <TouchableOpacity
                key={ts.value}
                style={[
                  styles.timeSlot,
                  {
                    backgroundColor: form.preferredTime === ts.value ? colors.primary + "18" : colors.muted,
                    borderColor: form.preferredTime === ts.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setForm((f) => ({ ...f, preferredTime: ts.value }));
                  hapticSelection();
                }}
              >
                <Feather
                  name={ts.icon}
                  size={20}
                  color={form.preferredTime === ts.value ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.timeSlotLabel,
                    { color: form.preferredTime === ts.value ? colors.primary : colors.foreground },
                  ]}
                >
                  {ts.label}
                </Text>
                <Text
                  style={[
                    styles.timeSlotSub,
                    { color: form.preferredTime === ts.value ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {ts.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.secondary }]}>Additional Notes</Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            value={form.notes}
            onChangeText={(v) => update("notes", v)}
            placeholder="Any special instructions or notes (optional)"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: isSubmitting ? colors.mutedForeground : colors.primary },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <Text style={styles.submitBtnText}>Submitting...</Text>
          ) : (
            <>
              <Feather name="send" size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Submit Booking Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  error?: string;
  icon: keyof typeof Feather.glyphMap;
  keyboardType?: "default" | "phone-pad" | "numeric";
  multiline?: boolean;
  colors: ReturnType<typeof useColors>;
}

function FormField({ label, value, onChangeText, placeholder, error, icon, keyboardType = "default", multiline = false, colors }: FormFieldProps) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.muted,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      >
        <Feather name={icon} size={16} color={error ? colors.destructive : colors.mutedForeground} />
        <TextInput
          style={[styles.input, { color: colors.foreground, height: multiline ? 80 : undefined }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          autoCapitalize="words"
        />
      </View>
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  headerSub: {
    color: "#FFFFFFCC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  formContainer: {
    padding: 16,
    gap: 14,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  selectorRow: {
    flexDirection: "row",
    gap: 10,
  },
  selectorOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  selectorLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  timeSlotContainer: {
    gap: 10,
  },
  timeSlot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  timeSlotLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  timeSlotSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#E8700A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  primaryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  waBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
