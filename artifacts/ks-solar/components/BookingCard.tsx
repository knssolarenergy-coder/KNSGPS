import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface BookingData {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  panelCount: number;
  panelType: "residential" | "commercial";
  preferredDate: string;
  preferredTime: "morning" | "afternoon" | "evening";
  notes?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
}

interface BookingCardProps {
  booking: BookingData;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning (8am - 12pm)",
  afternoon: "Afternoon (12pm - 4pm)",
  evening: "Evening (4pm - 7pm)",
};

export function BookingCard({ booking }: BookingCardProps) {
  const colors = useColors();
  const statusColor = STATUS_COLORS[booking.status] ?? "#64748B";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.customerName, { color: colors.foreground }]}>
            {booking.customerName}
          </Text>
          <Text style={[styles.bookingId, { color: colors.mutedForeground }]}>
            #{booking.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[booking.status]}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={14} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {booking.address}, {booking.city}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="sun" size={14} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {booking.panelCount} panels ({booking.panelType})
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {booking.preferredDate}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="clock" size={14} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {TIME_LABELS[booking.preferredTime]}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="phone" size={14} color={colors.primary} />
          <Text style={[styles.detailText, { color: colors.foreground }]}>
            {booking.phone}
          </Text>
        </View>
      </View>

      {booking.notes ? (
        <View style={[styles.notesContainer, { backgroundColor: colors.muted }]}>
          <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>Note:</Text>
          <Text style={[styles.notesText, { color: colors.foreground }]}>{booking.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  bookingId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  notesContainer: {
    marginTop: 12,
    borderRadius: 8,
    padding: 10,
  },
  notesLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  notesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});

export type { BookingData };
