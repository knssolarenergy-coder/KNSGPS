import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  inverter: "Inverter",
  panels: "Solar Panels",
  battery: "Battery",
  installation: "Installation",
};

const WARRANTY_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  inverter: "zap",
  panels: "sun",
  battery: "battery",
  installation: "tool",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  expiring_soon: "#F59E0B",
  expired: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function daysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type WarrantyResult = {
  id: string;
  invoiceNumber?: string | null;
  warrantyType: string;
  brand: string;
  model?: string | null;
  purchaseDate: string;
  durationMonths: number;
  notes?: string | null;
  expiryDate: string;
  warrantyStatus: string;
};

export default function WarrantySearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const trimmed = invoiceNumber.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setSearched(false);

    try {
      const res = await fetch(`${BASE}/warranties/search?invoiceNumber=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Warranty not found");
      } else {
        setResult(data as WarrantyResult);
      }
    } catch {
      setError("Could not connect. Please check your internet and try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  const statusColor = result ? (STATUS_COLORS[result.warrantyStatus] ?? "#64748B") : "#64748B";
  const statusLabel = result ? (STATUS_LABELS[result.warrantyStatus] ?? result.warrantyStatus) : "";
  const typeIcon = result ? (WARRANTY_TYPE_ICONS[result.warrantyType] ?? "shield") : "shield";
  const typeLabel = result ? (WARRANTY_TYPE_LABELS[result.warrantyType] ?? result.warrantyType) : "";
  const days = result ? daysUntilExpiry(result.expiryDate) : 0;
  const daysLabel = days > 0
    ? `${days} day${days === 1 ? "" : "s"} remaining`
    : `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: "#0F172A" }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Warranty Search</Text>
          <Text style={styles.headerSub}>Check warranty status by invoice number</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: "#FFFFFF18" }]}>
          <Feather name="search" size={20} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.body}>
        {/* Search Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Enter Invoice Number</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            You can find your invoice number on the purchase receipt or installation certificate provided by K&S Solar Energy.
          </Text>

          <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="file-text" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={invoiceNumber}
              onChangeText={(t) => {
                setInvoiceNumber(t.toUpperCase());
                if (searched) { setResult(null); setError(null); setSearched(false); }
              }}
              placeholder="e.g. KS-2024-00123"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {invoiceNumber.length > 0 && (
              <TouchableOpacity onPress={() => { setInvoiceNumber(""); setResult(null); setError(null); setSearched(false); }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: loading || !invoiceNumber.trim() ? colors.mutedForeground : "#0F172A" }]}
            onPress={handleSearch}
            disabled={loading || !invoiceNumber.trim()}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="search" size={17} color="#FFFFFF" />
            )}
            <Text style={styles.btnText}>{loading ? "Searching..." : "Search Warranty"}</Text>
          </TouchableOpacity>
        </View>

        {/* Not found */}
        {searched && error && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: "#EF444433" }]}>
            <View style={styles.errorRow}>
              <View style={[styles.errorIcon, { backgroundColor: "#EF444412" }]}>
                <Feather name="alert-circle" size={28} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.errorTitle, { color: colors.foreground }]}>Not Found</Text>
                <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
                  {error}. Please double-check the invoice number or contact K&S Solar Energy for assistance.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Result Card */}
        {result && (
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Accent bar */}
            <View style={[styles.accentBar, { backgroundColor: statusColor }]} />

            <View style={styles.resultBody}>
              {/* Invoice number badge */}
              {result.invoiceNumber && (
                <View style={[styles.invoiceBadge, { backgroundColor: "#0F172A12", borderColor: "#0F172A33" }]}>
                  <Feather name="file-text" size={13} color="#0F172A" />
                  <Text style={styles.invoiceText}>Invoice #{result.invoiceNumber}</Text>
                </View>
              )}

              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={[styles.typeIcon, { backgroundColor: statusColor + "18" }]}>
                  <Feather name={typeIcon} size={24} color={statusColor} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.typeLabel, { color: colors.foreground }]}>{typeLabel}</Text>
                  <Text style={[styles.brandLabel, { color: colors.mutedForeground }]}>
                    {result.brand}{result.model ? ` · ${result.model}` : ""}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "44" }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {/* Dates */}
              <View style={[styles.datesRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <View style={styles.dateItem}>
                  <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Purchase Date</Text>
                  <Text style={[styles.dateValue, { color: colors.foreground }]}>{formatDate(result.purchaseDate)}</Text>
                </View>
                <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                <View style={styles.dateItem}>
                  <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Expiry Date</Text>
                  <Text style={[styles.dateValue, { color: colors.foreground }]}>{formatDate(result.expiryDate)}</Text>
                </View>
                <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                <View style={styles.dateItem}>
                  <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Duration</Text>
                  <Text style={[styles.dateValue, { color: colors.foreground }]}>{result.durationMonths}mo</Text>
                </View>
              </View>

              {/* Days remaining */}
              <View style={[styles.daysRow, { borderColor: statusColor + "44", backgroundColor: statusColor + "0D" }]}>
                <Feather name={days > 0 ? "clock" : "alert-triangle"} size={13} color={statusColor} />
                <Text style={[styles.daysText, { color: statusColor }]}>{daysLabel}</Text>
              </View>

              {result.notes && (
                <View style={[styles.notesBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="file-text" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{result.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Help tip */}
        <View style={[styles.tipCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
            Invoice number is printed on your purchase receipt and installation certificate. Contact us on WhatsApp if you cannot find it.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#FFFFFF18", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFAA", fontSize: 12, fontFamily: "Inter_400Regular" },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 16 },
  card: { borderRadius: 18, borderWidth: 1, padding: 20, gap: 14 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 50,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 12, height: 50,
  },
  btnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  errorIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  errorSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  resultCard: {
    borderRadius: 18, borderWidth: 1, overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4,
  },
  accentBar: { width: 5 },
  resultBody: { flex: 1, padding: 16, gap: 12 },
  invoiceBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  invoiceText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1E3A5F" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  typeIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  brandLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  datesRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  dateItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
  dateDivider: { width: 1 },
  dateLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dateValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daysRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  daysText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  notesBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 10,
  },
  notesText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
