import { Feather } from "@expo/vector-icons";
import { useGetBookings, useGetComplaints, useGetQuotes } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookingCard } from "@/components/BookingCard";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const BOOKING_FILTERS = ["all", "pending", "confirmed", "completed", "cancelled"] as const;
type BookingFilter = (typeof BOOKING_FILTERS)[number];

const COMPLAINT_FILTERS = ["all", "submitted", "in_progress", "resolved", "closed"] as const;
type ComplaintFilter = (typeof COMPLAINT_FILTERS)[number];

const QUOTE_FILTERS = ["all", "submitted", "under_review", "quote_sent", "accepted", "rejected"] as const;
type QuoteFilter = (typeof QUOTE_FILTERS)[number];

type MainTab = "bookings" | "complaints" | "quotes";

const COMPLAINT_STATUS_COLORS: Record<string, string> = {
  submitted:   "#3B82F6",
  in_progress: "#F59E0B",
  resolved:    "#10B981",
  closed:      "#64748B",
  open:        "#3B82F6",
  in_review:   "#F59E0B",
};

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  submitted:   "Submitted",
  in_progress: "In Progress",
  resolved:    "Resolved",
  closed:      "Closed",
  open:        "Submitted",
  in_review:   "In Progress",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  submitted:    "#3B82F6",
  under_review: "#F59E0B",
  quote_sent:   "#8B5CF6",
  accepted:     "#10B981",
  rejected:     "#EF4444",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  submitted:    "Submitted",
  under_review: "Under Review",
  quote_sent:   "Quote Sent",
  accepted:     "Accepted",
  rejected:     "Rejected",
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  "on-grid": "On-Grid",
  "hybrid": "Hybrid",
  "off-grid": "Off-Grid",
  "day-time": "Day-Time",
  "agri": "Agri / Tubewell",
  "commercial-system": "Commercial",
};

function getComplaintStatusColor(status: string) {
  return COMPLAINT_STATUS_COLORS[status] ?? "#64748B";
}

function getComplaintStatusLabel(status: string) {
  return COMPLAINT_STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
}

function getQuoteStatusColor(status: string) {
  return QUOTE_STATUS_COLORS[status] ?? "#64748B";
}

function getQuoteStatusLabel(status: string) {
  return QUOTE_STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
}

function formatDate(iso: string) {
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

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("bookings");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [complaintFilter, setComplaintFilter] = useState<ComplaintFilter>("all");
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>("all");

  const { data: bookings, isLoading: loadingBookings, refetch: refetchBookings, isRefetching: refetchingBookings } = useGetBookings();
  const { data: complaints, isLoading: loadingComplaints, refetch: refetchComplaints, isRefetching: refetchingComplaints } = useGetComplaints();
  const { data: quotes, isLoading: loadingQuotes, refetch: refetchQuotes, isRefetching: refetchingQuotes } = useGetQuotes();

  if (!user) {
    return (
      <LoginPrompt
        icon="list"
        title="My Orders"
        message="Login to view your booking history, complaints and solar installation quotation requests."
      />
    );
  }

  const filteredBookings = (bookings ?? []).filter(
    (b) => bookingFilter === "all" || b.status === bookingFilter
  );

  const filteredComplaints = (complaints ?? []).filter(
    (c) => complaintFilter === "all" || c.status === complaintFilter || (complaintFilter === "submitted" && c.status === "open") || (complaintFilter === "in_progress" && c.status === "in_review")
  );

  const filteredQuotes = (quotes ?? []).filter(
    (q) => quoteFilter === "all" || q.status === quoteFilter
  );

  const pendingQuotes = (quotes ?? []).filter(q => q.status === "quote_sent").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.secondary }]}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>Track your bookings, complaints & quotes</Text>

        {/* Main Tab Switcher */}
        <View style={[styles.mainTabRow, { backgroundColor: "#FFFFFF18" }]}>
          <TouchableOpacity
            style={[styles.mainTabBtn, mainTab === "bookings" && styles.mainTabBtnActive]}
            onPress={() => setMainTab("bookings")}
          >
            <Feather name="droplet" size={13} color={mainTab === "bookings" ? colors.secondary : "#FFFFFFCC"} />
            <Text style={[styles.mainTabText, { color: mainTab === "bookings" ? colors.secondary : "#FFFFFFCC" }]}>
              Bookings {bookings ? `(${bookings.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTabBtn, mainTab === "complaints" && styles.mainTabBtnActive]}
            onPress={() => setMainTab("complaints")}
          >
            <Feather name="alert-circle" size={13} color={mainTab === "complaints" ? colors.secondary : "#FFFFFFCC"} />
            <Text style={[styles.mainTabText, { color: mainTab === "complaints" ? colors.secondary : "#FFFFFFCC" }]}>
              Complaints {complaints ? `(${complaints.length})` : ""}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTabBtn, mainTab === "quotes" && styles.mainTabBtnActive]}
            onPress={() => setMainTab("quotes")}
          >
            <View style={{ position: "relative" }}>
              <Feather name="package" size={13} color={mainTab === "quotes" ? colors.secondary : "#FFFFFFCC"} />
              {pendingQuotes > 0 && (
                <View style={styles.tabDot} />
              )}
            </View>
            <Text style={[styles.mainTabText, { color: mainTab === "quotes" ? colors.secondary : "#FFFFFFCC" }]}>
              Quotes {quotes ? `(${quotes.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bookings Tab */}
      {mainTab === "bookings" && (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refetchingBookings} onRefresh={refetchBookings} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <FlatList
              horizontal
              data={BOOKING_FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: bookingFilter === item ? colors.primary : colors.muted,
                      borderColor: bookingFilter === item ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setBookingFilter(item)}
                >
                  <Text style={[styles.filterChipText, { color: bookingFilter === item ? "#FFFFFF" : colors.foreground }]}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {loadingBookings ? (
                <>
                  <Feather name="loader" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Loading...</Text>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                    <Feather name="calendar" size={36} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookings yet</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    {bookingFilter !== "all" ? `No ${bookingFilter} bookings` : "Book your first solar panels washing service"}
                  </Text>
                  {bookingFilter === "all" && (
                    <TouchableOpacity
                      style={[styles.bookNowBtn, { backgroundColor: colors.primary }]}
                      onPress={() => router.push("/(tabs)/booking")}
                    >
                      <Feather name="plus" size={16} color="#FFFFFF" />
                      <Text style={styles.bookNowText}>Book Now</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => <BookingCard booking={item as any} />}
        />
      )}

      {/* Complaints Tab */}
      {mainTab === "complaints" && (
        <FlatList
          data={filteredComplaints}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refetchingComplaints} onRefresh={refetchComplaints} tintColor={colors.secondary} />
          }
          ListHeaderComponent={
            <FlatList
              horizontal
              data={COMPLAINT_FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => {
                const color = item === "all" ? colors.secondary : getComplaintStatusColor(item);
                const active = complaintFilter === item;
                const label = item === "all" ? "All" : getComplaintStatusLabel(item);
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, { backgroundColor: active ? color : color + "18", borderColor: active ? color : color + "44" }]}
                    onPress={() => setComplaintFilter(item)}
                  >
                    <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : color }]}>{label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {loadingComplaints ? (
                <>
                  <Feather name="loader" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Loading...</Text>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                    <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No complaints</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    {complaintFilter !== "all" ? `No ${getComplaintStatusLabel(complaintFilter)} complaints` : "You have no complaints on record"}
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const sc = getComplaintStatusColor(item.status);
            const label = getComplaintStatusLabel(item.status);
            return (
              <TouchableOpacity
                style={[styles.complaintCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/complaint-detail", params: { id: item.id } })}
                activeOpacity={0.8}
              >
                <View style={styles.complaintCardTop}>
                  <View style={[styles.complaintIcon, { backgroundColor: sc + "18" }]}>
                    <Feather name="alert-circle" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.complaintSubject, { color: colors.foreground }]}>{item.subject}</Text>
                    <Text style={[styles.complaintDate, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusBadgeText, { color: sc }]}>{label}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </View>
                <Text style={[styles.complaintMsg, { color: colors.mutedForeground, borderTopColor: colors.border }]} numberOfLines={2}>
                  {item.message}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Quotes Tab */}
      {mainTab === "quotes" && (
        <FlatList
          data={filteredQuotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refetchingQuotes} onRefresh={refetchQuotes} tintColor="#8B5CF6" />
          }
          ListHeaderComponent={
            <FlatList
              horizontal
              data={QUOTE_FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => {
                const color = item === "all" ? "#8B5CF6" : getQuoteStatusColor(item);
                const active = quoteFilter === item;
                const label = item === "all" ? "All" : getQuoteStatusLabel(item);
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, { backgroundColor: active ? color : color + "18", borderColor: active ? color : color + "44" }]}
                    onPress={() => setQuoteFilter(item)}
                  >
                    <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : color }]}>{label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {loadingQuotes ? (
                <>
                  <Feather name="loader" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Loading...</Text>
                </>
              ) : (
                <>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
                    <Feather name="package" size={36} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No quotes yet</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    {quoteFilter !== "all"
                      ? `No ${getQuoteStatusLabel(quoteFilter)} quotes`
                      : "Request a solar installation quotation from the Installation screen"}
                  </Text>
                  {quoteFilter === "all" && (
                    <TouchableOpacity
                      style={[styles.bookNowBtn, { backgroundColor: "#1B6FA8" }]}
                      onPress={() => router.push("/(tabs)/installation" as never)}
                    >
                      <Feather name="plus" size={16} color="#FFFFFF" />
                      <Text style={styles.bookNowText}>Request a Quote</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const sc = getQuoteStatusColor(item.status);
            const label = getQuoteStatusLabel(item.status);
            const sysLabel = SYSTEM_TYPE_LABELS[item.systemType] ?? item.systemType;
            const propLabel = item.propertyType === "house" ? "Residential" : "Commercial";
            const hasResponse = item.status === "quote_sent" || item.status === "accepted";
            return (
              <TouchableOpacity
                style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/quote-detail", params: { id: item.id } })}
                activeOpacity={0.8}
              >
                <View style={styles.quoteCardTop}>
                  <View style={[styles.quoteIcon, { backgroundColor: sc + "18" }]}>
                    <Feather name="package" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.quoteTitle, { color: colors.foreground }]}>
                      {sysLabel} System
                    </Text>
                    <Text style={[styles.quoteSub, { color: colors.mutedForeground }]}>
                      {propLabel} · {item.city} · {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusBadgeText, { color: sc }]}>{label}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </View>
                <View style={[styles.quoteFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.quoteMeta}>
                    <Feather name="dollar-sign" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.quoteMetaText, { color: colors.mutedForeground }]}>{item.monthlyBill}/mo</Text>
                  </View>
                  {hasResponse && item.priceEstimate && (
                    <View style={styles.quoteMeta}>
                      <Feather name="tag" size={12} color="#8B5CF6" />
                      <Text style={[styles.quoteMetaText, { color: "#8B5CF6", fontFamily: "Inter_700Bold" }]}>
                        Est: {item.priceEstimate}
                      </Text>
                    </View>
                  )}
                  {item.status === "quote_sent" && (
                    <View style={[styles.actionNeeded, { backgroundColor: "#8B5CF618", borderColor: "#8B5CF640" }]}>
                      <Text style={styles.actionNeededText}>Action needed</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 4 },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 14 },
  mainTabRow: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  mainTabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 8, borderRadius: 9,
  },
  mainTabBtnActive: { backgroundColor: "#FFFFFF" },
  mainTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabDot: {
    position: "absolute", top: -2, right: -4,
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444",
  },
  listContent: { padding: 16 },
  filterRow: { gap: 8, paddingBottom: 16, flexDirection: "row" },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 32 },
  bookNowBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  bookNowText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  complaintCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  complaintCardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  complaintIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  complaintSubject: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  complaintDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  complaintMsg: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    paddingHorizontal: 14, paddingBottom: 12, lineHeight: 18,
    borderTopWidth: 1, paddingTop: 10,
  },
  // Quotes
  quoteCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  quoteCardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  quoteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quoteTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  quoteSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  quoteFooter: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10, borderTopWidth: 1, flexWrap: "wrap",
  },
  quoteMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  quoteMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionNeeded: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginLeft: "auto",
  },
  actionNeededText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#8B5CF6" },
});
