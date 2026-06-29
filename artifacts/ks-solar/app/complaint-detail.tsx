import { Feather } from "@expo/vector-icons";
import { getGetComplaintByIdQueryKey, useGetComplaintById } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  submitted:  { label: "Submitted",  color: "#3B82F6", icon: "send" },
  in_progress:{ label: "In Progress",color: "#F59E0B", icon: "tool" },
  resolved:   { label: "Resolved",   color: "#10B981", icon: "check-circle" },
  closed:     { label: "Closed",     color: "#64748B", icon: "x-circle" },
  open:       { label: "Submitted",  color: "#3B82F6", icon: "send" },
  in_review:  { label: "In Progress",color: "#F59E0B", icon: "tool" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: "#64748B", icon: "circle" as const };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ComplaintDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const { data: complaint, isLoading, isError } = useGetComplaintById(id ?? "", {
    query: { queryKey: getGetComplaintByIdQueryKey(id ?? ""), enabled: !!id },
  });

  const sc = complaint ? getStatusConfig(complaint.status) : getStatusConfig("submitted");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.secondary }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Complaint Detail</Text>
          <Text style={styles.headerSub}>Track your complaint status</Text>
        </View>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      )}

      {isError && (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Could not load complaint</Text>
        </View>
      )}

      {complaint && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: sc.color + "15", borderColor: sc.color + "40" }]}>
            <View style={[styles.statusIconCircle, { backgroundColor: sc.color }]}>
              <Feather name={sc.icon} size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                Submitted on {formatDateShort(complaint.createdAt)}
              </Text>
            </View>
          </View>

          {/* Complaint Info */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>Complaint Details</Text>
            <InfoRow icon="zap" label="System Type" value={complaint.subject} colors={colors} />
            <InfoRow icon="user" label="Customer Name" value={complaint.customerName ?? ""} colors={colors} />
            <InfoRow icon="phone" label="Phone" value={complaint.phone ?? ""} colors={colors} />
            <InfoRow icon="map-pin" label="Address" value={complaint.address ?? ""} colors={colors} />
            <View style={[styles.messageBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.messageLabel, { color: colors.mutedForeground }]}>Message</Text>
              <Text style={[styles.messageText, { color: colors.foreground }]}>{complaint.message}</Text>
            </View>
          </View>

          {/* Technician Info */}
          {(complaint.technicianName || complaint.technicianPhone) && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.secondary }]}>Assigned Technician</Text>
              {complaint.technicianName ? (
                <InfoRow icon="user-check" label="Technician Name" value={complaint.technicianName} colors={colors} />
              ) : null}
              {complaint.technicianPhone ? (
                <InfoRow icon="phone" label="Technician Phone" value={complaint.technicianPhone} colors={colors} />
              ) : null}
            </View>
          )}

          {/* Status Timeline */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>Status Timeline</Text>
            {(() => {
              const history = Array.isArray(complaint.statusHistory) && complaint.statusHistory.length > 0
                ? complaint.statusHistory
                : [{ status: complaint.status, changedAt: complaint.createdAt }];

              return history.map((entry, idx) => {
                const cfg = getStatusConfig(entry.status);
                const isLast = idx === history.length - 1;
                return (
                  <View key={idx} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: cfg.color }]}>
                        <Feather name={cfg.icon} size={10} color="#FFFFFF" />
                      </View>
                      {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>
                        {formatDate(entry.changedAt)}
                      </Text>
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.secondary + "18" }]}>
        <Feather name={icon} size={13} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  label: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 1 },
  value: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF22",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "#FFFFFFCC",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 14,
    marginBottom: 4,
  },
  statusIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  statusSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  messageBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  messageLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
  },
  timelineLeft: {
    alignItems: "center",
    width: 22,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 1,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
  },
  timelineStatus: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  timelineDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
