import { Feather } from "@expo/vector-icons";
import { useGetWarranties } from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useAuth } from "@/context/AuthContext";

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

const WARRANTY_STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  expiring_soon: "#F59E0B",
  expired: "#EF4444",
};

const WARRANTY_STATUS_LABELS: Record<string, string> = {
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

function WarrantiesContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: warranties, refetch, isRefetching } = useGetWarranties();

  const topPad = insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: "#0F172A" }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Warranties</Text>
          <Text style={styles.headerSub}>Track your equipment coverage</Text>
        </View>
        <View style={[styles.shieldBadge, { backgroundColor: "#FFFFFF18" }]}>
          <Feather name="shield" size={18} color="#FFFFFF" />
        </View>
      </View>

      {/* Summary row */}
      {warranties && warranties.length > 0 && (
        <View style={[styles.summaryRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {[
            { label: "Active", count: warranties.filter(w => w.warrantyStatus === "active").length, color: "#10B981" },
            { label: "Expiring", count: warranties.filter(w => w.warrantyStatus === "expiring_soon").length, color: "#F59E0B" },
            { label: "Expired", count: warranties.filter(w => w.warrantyStatus === "expired").length, color: "#EF4444" },
          ].map(({ label, count, color }) => (
            <View key={label} style={styles.summaryPill}>
              <Text style={[styles.summaryNum, { color }]}>{count}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.secondary} />}
      >
        {!warranties || warranties.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="shield" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Warranties Yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Contact K&S Solar Energy to register your equipment warranties. Once registered, you can track expiry dates here.
            </Text>
          </View>
        ) : (
          warranties.map((w) => {
            const statusColor = WARRANTY_STATUS_COLORS[w.warrantyStatus] ?? "#64748B";
            const statusLabel = WARRANTY_STATUS_LABELS[w.warrantyStatus] ?? w.warrantyStatus;
            const typeIcon = WARRANTY_TYPE_ICONS[w.warrantyType] ?? "shield";
            const typeLabel = WARRANTY_TYPE_LABELS[w.warrantyType] ?? w.warrantyType;
            const days = daysUntilExpiry(w.expiryDate);
            const daysLabel = days > 0
              ? `${days} day${days === 1 ? "" : "s"} remaining`
              : `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;

            return (
              <View key={w.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Status accent bar */}
                <View style={[styles.accentBar, { backgroundColor: statusColor }]} />
                <View style={styles.cardBody}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={[styles.typeIcon, { backgroundColor: statusColor + "18" }]}>
                      <Feather name={typeIcon} size={22} color={statusColor} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.typeLabel, { color: colors.foreground }]}>{typeLabel}</Text>
                      <Text style={[styles.brandLabel, { color: colors.mutedForeground }]}>
                        {w.brand}{w.model ? ` · ${w.model}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "18", borderColor: statusColor + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  {/* Dates row */}
                  <View style={[styles.datesRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateItemLabel, { color: colors.mutedForeground }]}>Purchase Date</Text>
                      <Text style={[styles.dateItemValue, { color: colors.foreground }]}>{formatDate(w.purchaseDate)}</Text>
                    </View>
                    <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateItemLabel, { color: colors.mutedForeground }]}>Expiry Date</Text>
                      <Text style={[styles.dateItemValue, { color: colors.foreground }]}>{formatDate(w.expiryDate)}</Text>
                    </View>
                    <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateItemLabel, { color: colors.mutedForeground }]}>Duration</Text>
                      <Text style={[styles.dateItemValue, { color: colors.foreground }]}>{w.durationMonths} months</Text>
                    </View>
                  </View>

                  {/* Days remaining */}
                  <View style={[styles.daysRow, { borderColor: statusColor + "44", backgroundColor: statusColor + "0D" }]}>
                    <Feather name={days > 0 ? "clock" : "alert-triangle"} size={13} color={statusColor} />
                    <Text style={[styles.daysText, { color: statusColor }]}>{daysLabel}</Text>
                  </View>

                  {w.notes ? (
                    <View style={[styles.notesBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Feather name="file-text" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{w.notes}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingBottom: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#FFFFFF18", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "#FFFFFFAA", fontSize: 12, fontFamily: "Inter_400Regular" },
  shieldBadge: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 12 },
  summaryPill: { flex: 1, alignItems: "center", gap: 2 },
  summaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  listContent: { padding: 16, gap: 14 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  card: {
    borderRadius: 18, borderWidth: 1, overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  accentBar: { width: 5 },
  cardBody: { flex: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  typeIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  brandLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  datesRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  dateItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
  dateDivider: { width: 1 },
  dateItemLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dateItemValue: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  daysRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  daysText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  notesBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  notesText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

export default function WarrantiesScreen() {
  const { user } = useAuth();
  if (!user) {
    return <LoginPrompt icon="shield" title="My Warranties" message="Sign in to view your warranty information." />;
  }
  return <WarrantiesContent />;
}
