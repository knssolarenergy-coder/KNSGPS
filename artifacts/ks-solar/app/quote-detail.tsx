import { Feather } from "@expo/vector-icons";
import {
  getGetQuoteByIdQueryKey,
  useGetQuoteById,
  useUpdateQuote,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(type);
};

const QUOTE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  submitted:    { label: "Submitted",    color: "#3B82F6", icon: "send" },
  under_review: { label: "Under Review", color: "#F59E0B", icon: "eye" },
  quote_sent:   { label: "Quote Sent",   color: "#8B5CF6", icon: "package" },
  accepted:     { label: "Accepted",     color: "#10B981", icon: "check-circle" },
  rejected:     { label: "Rejected",     color: "#EF4444", icon: "x-circle" },
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: "Residential / House",
  commercial: "Commercial Property",
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  "on-grid": "On-Grid Solar System",
  "hybrid": "Hybrid Solar System",
  "off-grid": "Off-Grid Solar System",
  "day-time": "Day-Time Solar System",
  "agri": "Agri / Tubewell Solar",
  "commercial-system": "Commercial Solar System",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function InfoRow({ icon, label, value, colors }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: "#7C3AED18" }]}>
        <Feather name={icon} size={13} color="#7C3AED" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  label: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  value: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
});

export default function QuoteDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const queryClient = useQueryClient();

  const { data: quote, isLoading } = useGetQuoteById(id ?? "", {
    query: {
      queryKey: getGetQuoteByIdQueryKey(id ?? ""),
      enabled: !!id,
    },
  });

  const { mutate: updateQuote, isPending: updating } = useUpdateQuote({
    mutation: {
      onSuccess: (data) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        queryClient.setQueryData(getGetQuoteByIdQueryKey(id ?? ""), data);
      },
      onError: () => Alert.alert("Error", "Could not update quote status"),
    },
  });

  if (isLoading || !id) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Quote not found</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: colors.foreground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sc = QUOTE_STATUS_CONFIG[quote.status] ?? { label: quote.status, color: "#64748B", icon: "circle" as const };

  const canRespond = quote.status === "quote_sent";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: "#0F172A" }]}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quotation Request</Text>
          <Text style={styles.headerSub}>Solar Installation</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.color + "33", borderColor: sc.color + "66" }]}>
          <Feather name={sc.icon} size={12} color={sc.color} />
          <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      {/* Status info */}
      <View style={[styles.card, { backgroundColor: sc.color + "10", borderColor: sc.color + "44" }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusIconCircle, { backgroundColor: sc.color + "22" }]}>
            <Feather name={sc.icon} size={22} color={sc.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: sc.color }]}>{sc.label}</Text>
            <Text style={[styles.statusDesc, { color: colors.mutedForeground }]}>
              {quote.status === "submitted" && "Your request has been received. We will review it shortly."}
              {quote.status === "under_review" && "Our team is reviewing your requirements."}
              {quote.status === "quote_sent" && "We have prepared a quote for you. Please review and respond below."}
              {quote.status === "accepted" && "You have accepted this quote. Our team will be in touch soon."}
              {quote.status === "rejected" && "You have declined this quote."}
            </Text>
          </View>
        </View>
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
          Submitted: {formatDate(quote.createdAt)}
        </Text>
      </View>

      {/* Admin Response */}
      {(quote.systemSize || quote.priceEstimate || quote.adminNote) && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            <Feather name="package" size={15} color="#7C3AED" /> Our Quote
          </Text>
          {quote.systemSize && (
            <InfoRow icon="zap" label="Recommended System Size" value={quote.systemSize} colors={colors} />
          )}
          {quote.priceEstimate && (
            <InfoRow icon="dollar-sign" label="Estimated Price" value={quote.priceEstimate} colors={colors} />
          )}
          {quote.adminNote && (
            <InfoRow icon="message-square" label="Additional Note" value={quote.adminNote} colors={colors} />
          )}
          {quote.respondedAt && (
            <Text style={[styles.respondedDate, { color: colors.mutedForeground }]}>
              Responded: {formatDate(quote.respondedAt)}
            </Text>
          )}
        </View>
      )}

      {/* Accept / Reject */}
      {canRespond && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Respond to Quote</Text>
          <Text style={[styles.respondHint, { color: colors.mutedForeground }]}>
            Do you wish to accept or decline this quotation?
          </Text>
          <View style={styles.respondBtns}>
            <TouchableOpacity
              style={[styles.acceptBtn, { opacity: updating ? 0.6 : 1 }]}
              onPress={() =>
                Alert.alert("Accept Quote", "Confirm acceptance of this quote?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Accept", onPress: () => updateQuote({ id: id!, data: { status: "accepted" } }) },
                ])
              }
              disabled={updating}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <Text style={styles.respondBtnText}>Accept Quote</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { opacity: updating ? 0.6 : 1 }]}
              onPress={() =>
                Alert.alert("Decline Quote", "Are you sure you want to decline?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Decline", style: "destructive", onPress: () => updateQuote({ id: id!, data: { status: "rejected" } }) },
                ])
              }
              disabled={updating}
              activeOpacity={0.85}
            >
              <Feather name="x-circle" size={16} color="#EF4444" />
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Submitted Requirements */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          <Feather name="clipboard" size={15} color="#7C3AED" /> Requirements
        </Text>
        <InfoRow icon="home" label="Property Type" value={PROPERTY_TYPE_LABELS[quote.propertyType] ?? quote.propertyType} colors={colors} />
        <InfoRow icon="zap" label="Preferred System" value={SYSTEM_TYPE_LABELS[quote.systemType] ?? quote.systemType} colors={colors} />
        <InfoRow icon="dollar-sign" label="Monthly Electricity Bill" value={quote.monthlyBill} colors={colors} />
        {quote.roofArea && (
          <InfoRow icon="maximize" label="Roof Area" value={quote.roofArea} colors={colors} />
        )}
        {quote.notes && (
          <InfoRow icon="file-text" label="Additional Notes" value={quote.notes} colors={colors} />
        )}
      </View>

      {/* Contact Info */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          <Feather name="user" size={15} color="#7C3AED" /> Contact Information
        </Text>
        <InfoRow icon="user" label="Name" value={quote.customerName} colors={colors} />
        <InfoRow icon="phone" label="Phone" value={quote.phone} colors={colors} />
        <InfoRow icon="map-pin" label="City" value={quote.city} colors={colors} />
        <InfoRow icon="navigation" label="Address" value={quote.address} colors={colors} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  header: {
    paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  headerBack: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFAA", fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  card: {
    margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, padding: 16,
    gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  statusIconCircle: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 3 },
  statusDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 10 },
  respondHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 12 },
  respondBtns: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: "#10B981",
  },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#EF444415", borderWidth: 1.5, borderColor: "#EF4444",
  },
  respondBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  rejectBtnText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_700Bold" },
  respondedDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
});
