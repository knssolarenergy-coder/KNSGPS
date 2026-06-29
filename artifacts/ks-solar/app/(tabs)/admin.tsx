import { Feather, FontAwesome5 } from "@expo/vector-icons";
import {
  getGetAdminUsersQueryKey,
  getGetAdminPaymentRequestsQueryKey,
  useAdminAddManualAttendance,
  useAdminUpdateAttendance,
  useAdminResetUserPassword,
  useAssignBookingTechnicians,
  useAssignComplaintTechnicians,
  useAssignSiteVisitTechnicians,
  useAssignSiteTechnicians,
  useCreateSite,
  useCreateTechnician,
  useCreateWarranty,
  useDeleteSite,
  useDeleteWarranty,
  useUpdateWarranty,
  useDeleteAdminUser,
  useGetAdminUsers,
  useGetAdminPaymentRequests,
  useGetAbsentToday,
  useGetAttendance,
  useGetBookings,
  useGetComplaints,
  useGetQuotes,
  useGetSettings,
  useGetSiteVisits,
  useCreateSiteVisit,
  useUpdateSiteVisit,
  useDeleteSiteVisit,
  useGetSites,
  useGetTechnicians,
  useGetTechnicianReport,
  useGetWarranties,
  useUpdateAdminUserStatus,
  useUpdateBookingStatus,
  useUpdateComplaint,
  useUpdateComplaintStatus,
  useUpdatePaymentRequest,
  useUpdateQuote,
  useUpdateSetting,
  useUpdateSite,
  useUpdateTechnician,
  useGetCustomerReport,
  getDownloadCustomerReportPdfUrl,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { LiveMapSection } from "@/components/LiveMapSection";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { LoginPrompt } from "@/components/LoginPrompt";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/utils/confirm";

const hapticNotify = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(type);
};
const hapticSelection = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

function photoUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  const relative = objectPath.replace(/^\/objects/, "");
  const base = Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  return `${base}/api/storage/objects${relative}`;
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const COMPLAINT_STATUS_COLORS: Record<string, string> = {
  submitted:   "#3B82F6",
  in_progress: "#F59E0B",
  resolved:    "#10B981",
  closed:      "#64748B",
  open:        "#3B82F6",
  in_review:   "#F59E0B",
};

function getComplaintStatusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Submitted", in_progress: "In Progress",
    resolved: "Resolved", closed: "Closed",
    open: "Submitted", in_review: "In Progress",
  };
  return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

const USER_STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
};

const BOOKING_STATUSES = ["all", "pending", "confirmed", "in_progress", "completed", "cancelled"] as const;
const COMPLAINT_STATUSES = ["all", "submitted", "in_progress", "resolved", "closed"] as const;
const USER_STATUSES = ["all", "pending", "approved", "rejected"] as const;

type BookingFilter = (typeof BOOKING_STATUSES)[number];
type ComplaintFilter = (typeof COMPLAINT_STATUSES)[number];
type UserFilter = (typeof USER_STATUSES)[number];
type Tab = "bookings" | "complaints" | "quotes" | "technicians" | "users" | "payments" | "sites" | "siteVisits" | "settings" | "attendance" | "reports" | "liveMap";

const SITE_STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  in_progress: "#8B5CF6",
  completed: "#3B82F6",
  closed: "#64748B",
  cancelled: "#EF4444",
};

const SITE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  submitted:    "#3B82F6",
  under_review: "#F59E0B",
  quote_sent:   "#8B5CF6",
  accepted:     "#10B981",
  rejected:     "#EF4444",
};

const QUOTE_SYSTEM_TYPE_LABELS: Record<string, string> = {
  "on-grid": "On-Grid",
  "hybrid": "Hybrid",
  "off-grid": "Off-Grid",
  "day-time": "Day-Time",
  "agri": "Agri / Tubewell",
  "commercial-system": "Commercial",
};

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

function InfoRow({ icon, label, value, colors }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={[infoStyles.iconWrap, { backgroundColor: colors.secondary + "18" }]}>
        <Feather name={icon} size={13} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[infoStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[infoStyles.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  iconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 1 },
  label: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 1 },
  value: { fontSize: 13, fontFamily: "Inter_500Medium", flexShrink: 1 },
});

const WARRANTY_TYPES = ["inverter", "panels", "battery", "installation"] as const;
const WARRANTY_TYPE_LABELS: Record<string, string> = {
  inverter: "Inverter", panels: "Panels", battery: "Battery", installation: "Installation",
};
const WARRANTY_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  inverter: "zap", panels: "sun", battery: "battery", installation: "tool",
};
const W_STATUS_COLORS: Record<string, string> = {
  active: "#10B981", expiring_soon: "#F59E0B", expired: "#EF4444",
};
const W_STATUS_LABELS: Record<string, string> = {
  active: "Active", expiring_soon: "Expiring Soon", expired: "Expired",
};

function UserWarrantyPanel({ userId, colors }: { userId: string; colors: ReturnType<typeof useColors> }) {
  const [formMode, setFormMode] = useState<"hidden" | "add" | "edit">("hidden");
  const [editingWarrantyId, setEditingWarrantyId] = useState<string | null>(null);
  const [wType, setWType] = useState("inverter");
  const [wInvoiceNumber, setWInvoiceNumber] = useState("");
  const [wBrand, setWBrand] = useState("");
  const [wModel, setWModel] = useState("");
  const [wPurchaseDate, setWPurchaseDate] = useState("");
  const [wDuration, setWDuration] = useState("12");
  const [wNotes, setWNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: userWarranties, refetch } = useGetWarranties(
    { userId },
    { query: { queryKey: ["warranties", userId] } },
  );

  function resetForm() {
    setWType("inverter"); setWInvoiceNumber(""); setWBrand(""); setWModel("");
    setWPurchaseDate(""); setWDuration("12"); setWNotes("");
    setEditingWarrantyId(null);
    setSaving(false);
  }

  function openEdit(w: NonNullable<typeof userWarranties>[number]) {
    setWType(w.warrantyType);
    setWInvoiceNumber(w.invoiceNumber ?? "");
    setWBrand(w.brand);
    setWModel(w.model ?? "");
    setWPurchaseDate(w.purchaseDate);
    setWDuration(String(w.durationMonths));
    setWNotes(w.notes ?? "");
    setEditingWarrantyId(w.id);
    setFormMode("edit");
  }

  function closeForm() { resetForm(); setFormMode("hidden"); }

  const { mutate: createWarranty } = useCreateWarranty({
    mutation: {
      onSuccess: () => {
        refetch(); resetForm(); setFormMode("hidden");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: any) => {
        setSaving(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Could not add warranty");
      },
    },
  });

  const { mutate: updateWarranty } = useUpdateWarranty({
    mutation: {
      onSuccess: () => {
        refetch(); resetForm(); setFormMode("hidden");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err: any) => {
        setSaving(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Could not update warranty");
      },
    },
  });

  const { mutate: deleteWarranty } = useDeleteWarranty({
    mutation: {
      onSuccess: () => {
        refetch();
        if (editingWarrantyId) closeForm();
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: () => Alert.alert("Error", "Could not delete warranty"),
    },
  });

  function handleSubmit() {
    if (!wBrand.trim() || !wPurchaseDate.trim()) {
      Alert.alert("Required", "Brand and purchase date are required");
      return;
    }
    const dur = parseInt(wDuration, 10);
    if (isNaN(dur) || dur < 1) {
      Alert.alert("Invalid", "Duration must be at least 1 month");
      return;
    }
    setSaving(true);
    if (formMode === "edit" && editingWarrantyId) {
      updateWarranty({
        id: editingWarrantyId,
        data: {
          invoiceNumber: wInvoiceNumber.trim() || null,
          warrantyType: wType as "inverter" | "panels" | "battery" | "installation",
          brand: wBrand.trim(),
          model: wModel.trim() || null,
          purchaseDate: wPurchaseDate.trim(),
          durationMonths: dur,
          notes: wNotes.trim() || null,
        },
      });
    } else {
      createWarranty({
        data: {
          userId,
          invoiceNumber: wInvoiceNumber.trim() || undefined,
          warrantyType: wType as "inverter" | "panels" | "battery" | "installation",
          brand: wBrand.trim(),
          model: wModel.trim() || undefined,
          purchaseDate: wPurchaseDate.trim(),
          durationMonths: dur,
          notes: wNotes.trim() || undefined,
        },
      });
    }
  }

  const ws = userWarranties ?? [];
  const showForm = formMode !== "hidden";

  return (
    <View style={[wStyles.container, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
      <View style={wStyles.headerRow}>
        <Feather name="shield" size={14} color={colors.secondary} />
        <Text style={[wStyles.title, { color: colors.secondary }]}>
          Warranties{ws.length > 0 ? ` (${ws.length})` : ""}
        </Text>
        <TouchableOpacity
          style={[wStyles.addBtn, { backgroundColor: showForm ? colors.mutedForeground : colors.secondary }]}
          onPress={() => showForm ? closeForm() : (resetForm(), setFormMode("add"))}
          activeOpacity={0.85}
        >
          <Feather name={showForm ? "x" : "plus"} size={13} color="#FFFFFF" />
          <Text style={wStyles.addBtnText}>{showForm ? "Cancel" : "Add"}</Text>
        </TouchableOpacity>
      </View>

      {ws.length === 0 && !showForm && (
        <Text style={[wStyles.emptyText, { color: colors.mutedForeground }]}>No warranties registered</Text>
      )}

      {ws.map((w) => {
        const sc = W_STATUS_COLORS[w.warrantyStatus] ?? "#64748B";
        const sl = W_STATUS_LABELS[w.warrantyStatus] ?? w.warrantyStatus;
        const icon = WARRANTY_TYPE_ICONS[w.warrantyType] ?? "shield";
        const label = WARRANTY_TYPE_LABELS[w.warrantyType] ?? w.warrantyType;
        const isEditing = editingWarrantyId === w.id && formMode === "edit";
        return (
          <View key={w.id} style={[wStyles.wCard, {
            backgroundColor: colors.card, borderColor: isEditing ? colors.secondary : colors.border,
          }]}>
            <View style={[wStyles.wIcon, { backgroundColor: sc + "18" }]}>
              <Feather name={icon} size={14} color={sc} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[wStyles.wLabel, { color: colors.foreground }]}>
                {label} — {w.brand}{w.model ? ` ${w.model}` : ""}
              </Text>
              <Text style={[wStyles.wDates, { color: colors.mutedForeground }]}>
                {w.purchaseDate} → {w.expiryDate} · {w.durationMonths}mo
              </Text>
            </View>
            <View style={[wStyles.wBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
              <Text style={[wStyles.wBadgeText, { color: sc }]}>{sl}</Text>
            </View>
            <TouchableOpacity
              style={[wStyles.deleteBtn, { marginLeft: 2 }]}
              onPress={() => isEditing ? closeForm() : openEdit(w)}
              activeOpacity={0.7}
            >
              <Feather name={isEditing ? "x" : "edit-2"} size={14} color={colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={wStyles.deleteBtn}
              onPress={() =>
                confirmAction("Delete Warranty", `Delete ${label} warranty for ${w.brand}?`,
                  () => deleteWarranty({ id: w.id }), "Delete", true)
              }
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        );
      })}

      {showForm && (
        <View style={[wStyles.addForm, { backgroundColor: colors.card, borderColor: colors.secondary + "44" }]}>
          <Text style={[wStyles.formLabel, { color: colors.secondary }]}>
            {formMode === "edit" ? "Edit Warranty" : "New Warranty"} — Type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={wStyles.typePillRow}>
            {WARRANTY_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[wStyles.typePill, {
                  backgroundColor: wType === t ? colors.secondary : colors.muted,
                  borderColor: wType === t ? colors.secondary : colors.border,
                }]}
                onPress={() => setWType(t)}
                activeOpacity={0.85}
              >
                <Feather name={WARRANTY_TYPE_ICONS[t]} size={12} color={wType === t ? "#FFFFFF" : colors.mutedForeground} />
                <Text style={[wStyles.typePillText, { color: wType === t ? "#FFFFFF" : colors.foreground }]}>
                  {WARRANTY_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Invoice Number — rendered first and separately to ensure visibility */}
          <View style={{ marginBottom: 8 }}>
            <Text style={[wStyles.formLabel, { color: colors.foreground }]}>Invoice Number (optional)</Text>
            <View style={[wStyles.input, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TextInput
                style={[wStyles.inputText, { color: colors.foreground }]}
                value={wInvoiceNumber}
                onChangeText={(t) => setWInvoiceNumber(t.toUpperCase())}
                placeholder="e.g. KS-2024-00123"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
              />
            </View>
          </View>
          {([
            { label: "Brand *", value: wBrand, set: setWBrand, placeholder: "e.g. Huawei, Tesla", kbd: "default" as const },
            { label: "Model (optional)", value: wModel, set: setWModel, placeholder: "e.g. SUN2000-10KTL", kbd: "default" as const },
            { label: "Purchase Date * (YYYY-MM-DD)", value: wPurchaseDate, set: setWPurchaseDate, placeholder: "e.g. 2024-01-15", kbd: "default" as const },
            { label: "Duration (months) *", value: wDuration, set: setWDuration, placeholder: "e.g. 60", kbd: "numeric" as const },
            { label: "Notes (optional)", value: wNotes, set: setWNotes, placeholder: "Any additional notes", kbd: "default" as const },
          ] as const).map(({ label, value, set, placeholder, kbd }) => (
            <View key={label} style={{ marginBottom: 8 }}>
              <Text style={[wStyles.formLabel, { color: colors.foreground }]}>{label}</Text>
              <View style={[wStyles.input, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <TextInput
                  style={[wStyles.inputText, { color: colors.foreground }]}
                  value={value}
                  onChangeText={set}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={kbd}
                  autoCapitalize="none"
                />
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[wStyles.saveBtn, { backgroundColor: saving ? colors.mutedForeground : colors.secondary }]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <>
                  <Feather name={formMode === "edit" ? "check" : "plus"} size={14} color="#FFFFFF" />
                  <Text style={wStyles.saveBtnText}>{formMode === "edit" ? "Save Changes" : "Add Warranty"}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const wStyles = StyleSheet.create({
  container: { borderTopWidth: 1, padding: 14, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  wCard: {
    flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  wIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  wLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  wDates: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  wBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  wBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 4 },
  addForm: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  typePillRow: { gap: 8, paddingVertical: 4 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typePillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  formLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  input: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  inputText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10 },
  saveBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

const dashStyles = StyleSheet.create({
  scrollContent: { padding: 16, gap: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%", borderRadius: 20, padding: 18, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
    position: "relative",
  },
  cardIconWrap: {
    width: 52, height: 52, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF20", marginBottom: 6,
  },
  cardTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  cardSub: { color: "#FFFFFFBB", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  badge: {
    position: "absolute", top: 10, right: 10,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  backBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  backSection: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold" },
});

function AdminContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { user, token, changePassword } = useAuth();

  const [tab, setTab] = useState<Tab | null>(null);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [complaintFilter, setComplaintFilter] = useState<ComplaintFilter>("all");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [techEdits, setTechEdits] = useState<Record<string, {name: string; phone: string; saving: boolean}>>({});
  const [bookingTechAssigning, setBookingTechAssigning] = useState<Record<string, boolean>>({});
  const [complaintTechPick, setComplaintTechPick] = useState<Record<string, string | null>>({});
  const [quoteFormEdits, setQuoteFormEdits] = useState<Record<string, { systemSize: string; priceEstimate: string; adminNote: string; saving: boolean }>>({});

  // New technician form
  const [newTechName, setNewTechName] = useState("");
  const [newTechEmail, setNewTechEmail] = useState("");
  const [newTechPhone, setNewTechPhone] = useState("");
  const [newTechPassword, setNewTechPassword] = useState("");
  const [newTechSpecialty, setNewTechSpecialty] = useState("");
  const [showNewTechPass, setShowNewTechPass] = useState(false);
  const [savingNewTech, setSavingNewTech] = useState(false);
  const [showAddTechForm, setShowAddTechForm] = useState(false);
  const [newTechNameErr, setNewTechNameErr] = useState("");
  const [newTechEmailErr, setNewTechEmailErr] = useState("");
  const [newTechPhoneErr, setNewTechPhoneErr] = useState("");
  const [newTechPasswordErr, setNewTechPasswordErr] = useState("");

  // Edit technician state
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [editTechName, setEditTechName] = useState("");
  const [editTechEmail, setEditTechEmail] = useState("");
  const [editTechPhone, setEditTechPhone] = useState("");
  const [editTechSpecialty, setEditTechSpecialty] = useState("");
  const [savingEditTech, setSavingEditTech] = useState(false);

  // Settings state — WhatsApp
  const [bookingWA, setBookingWA] = useState("");
  const [complaintWA, setComplaintWA] = useState("");
  const [installationWA, setInstallationWA] = useState("");
  const [supportWA, setSupportWA] = useState("");
  const [savingBookingWA, setSavingBookingWA] = useState(false);
  const [savingComplaintWA, setSavingComplaintWA] = useState(false);
  const [savingInstallationWA, setSavingInstallationWA] = useState(false);
  const [savingSupportWA, setSavingSupportWA] = useState(false);

  // Settings state — AI Support Chat
  const [aiSupportEnabled, setAiSupportEnabled] = useState(true);
  const [aiSupportNumber, setAiSupportNumber] = useState("");
  const [savingAiSupportEnabled, setSavingAiSupportEnabled] = useState(false);
  const [savingAiSupportNumber, setSavingAiSupportNumber] = useState(false);

  // Settings state — Social Links
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");
  const [savingSocialInstagram, setSavingSocialInstagram] = useState(false);
  const [savingSocialFacebook, setSavingSocialFacebook] = useState(false);
  const [savingSocialTiktok, setSavingSocialTiktok] = useState(false);
  const [savingSocialLinkedin, setSavingSocialLinkedin] = useState(false);
  const [savingSocialYoutube, setSavingSocialYoutube] = useState(false);
  const [savingSocialWebsite, setSavingSocialWebsite] = useState(false);

  // Settings state — Contact Info
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactHours, setContactHours] = useState("");
  const [savingContactPhone, setSavingContactPhone] = useState(false);
  const [savingContactEmail, setSavingContactEmail] = useState(false);
  const [savingContactAddress, setSavingContactAddress] = useState(false);
  const [savingContactHours, setSavingContactHours] = useState(false);

  // Customer report
  const [reportCustomerId, setReportCustomerId] = useState<string | null>(null);

  // Settings state — Referral System
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [referralPointsPerRef, setReferralPointsPerRef] = useState("10");
  const [referralMoneyPerPoint, setReferralMoneyPerPoint] = useState("100");
  const [savingReferralEnabled, setSavingReferralEnabled] = useState(false);
  const [savingReferralPoints, setSavingReferralPoints] = useState(false);
  const [savingReferralMoney, setSavingReferralMoney] = useState(false);

  // Admin password change
  const [adminCurrentPass, setAdminCurrentPass] = useState("");
  const [adminNewPass, setAdminNewPass] = useState("");
  const [adminConfirmPass, setAdminConfirmPass] = useState("");
  const [showAdminCurrent, setShowAdminCurrent] = useState(false);
  const [showAdminNew, setShowAdminNew] = useState(false);
  const [savingAdminPass, setSavingAdminPass] = useState(false);

  // Payment requests state
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);

  // Attendance filter state
  const [attendanceDateFilter, setAttendanceDateFilter] = useState("");
  const [attendanceTechFilter, setAttendanceTechFilter] = useState("");
  const [editRecord, setEditRecord] = useState<{ id: string; checkInAt: string; checkOutAt: string | null } | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTechId, setManualTechId] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualCheckIn, setManualCheckIn] = useState("09:00");
  const [manualCheckOut, setManualCheckOut] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  // Settings state — Attendance Timing
  const [checkinDeadline, setCheckinDeadline] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [absentAlertTime, setAbsentAlertTime] = useState("09:00");
  const [savingCheckinDeadline, setSavingCheckinDeadline] = useState(false);
  const [savingShiftEnd, setSavingShiftEnd] = useState(false);
  const [savingAbsentAlertTime, setSavingAbsentAlertTime] = useState(false);

  // Reports state
  const [reportTechId, setReportTechId] = useState("");
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportDownloading, setReportDownloading] = useState(false);

  // Multi-tech assignment state
  const [complaintMultiPick, setComplaintMultiPick] = useState<Record<string, string[]>>({});
  const [complaintMultiAssigning, setComplaintMultiAssigning] = useState<Record<string, boolean>>({});
  const [svMultiPick, setSvMultiPick] = useState<Record<string, string[]>>({});
  const [svMultiAssigning, setSvMultiAssigning] = useState<Record<string, boolean>>({});

  // Settings state — App Update
  const [appUpdateVersion, setAppUpdateVersion] = useState("");
  const [appUpdateUrl, setAppUpdateUrl] = useState("");
  const [savingAppUpdateVersion, setSavingAppUpdateVersion] = useState(false);
  const [savingAppUpdateUrl, setSavingAppUpdateUrl] = useState(false);

  // Settings state — Timezone
  const [appTimezoneOffset, setAppTimezoneOffset] = useState("5");
  const [savingTimezone, setSavingTimezone] = useState(false);

  // Site Visits state
  const [showAddSvForm, setShowAddSvForm] = useState(false);
  const [svCustomerName, setSvCustomerName] = useState("");
  const [svPhone, setSvPhone] = useState("");
  const [svAddress, setSvAddress] = useState("");
  const [svCity, setSvCity] = useState("");
  const [svPurpose, setSvPurpose] = useState("");
  const [svNotes, setSvNotes] = useState("");
  const [svAssignedTo, setSvAssignedTo] = useState("");
  const [svScheduledDate, setSvScheduledDate] = useState("");
  const [svScheduledTime, setSvScheduledTime] = useState("");
  const [savingNewSv, setSavingNewSv] = useState(false);
  const [svEditId, setSvEditId] = useState<string | null>(null);
  const [svEditStatus, setSvEditStatus] = useState("");
  const [svEditTechNotes, setSvEditTechNotes] = useState("");
  const [savingSvEdit, setSavingSvEdit] = useState(false);

  // Sites state
  const [siteExpandedId, setSiteExpandedId] = useState<string | null>(null);
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteClientName, setSiteClientName] = useState("");
  const [siteClientPhone, setSiteClientPhone] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [savingNewSite, setSavingNewSite] = useState(false);
  const [siteTechPick, setSiteTechPick] = useState<Record<string, string[]>>({});
  const [siteAssigning, setSiteAssigning] = useState<Record<string, boolean>>({});
  const [siteStatusSaving, setSiteStatusSaving] = useState<Record<string, boolean>>({});

  // Warranty panel
  const [warrantyExpandedId, setWarrantyExpandedId] = useState<string | null>(null);

  // Reset user password dialog
  const [resetPassUserId, setResetPassUserId] = useState<string | null>(null);
  const [resetPassUserName, setResetPassUserName] = useState("");
  const [resetPassValue, setResetPassValue] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  // Data hooks
  const {
    data: bookings,
    refetch: refetchBookings,
    isRefetching: refetchingBookings,
  } = useGetBookings();

  const {
    data: complaints,
    refetch: refetchComplaints,
    isRefetching: refetchingComplaints,
  } = useGetComplaints();

  const {
    data: adminUsers,
    refetch: refetchUsers,
    isRefetching: refetchingUsers,
  } = useGetAdminUsers({
    query: {
      queryKey: getGetAdminUsersQueryKey(),
      enabled: tab === "users",
    },
  });

  const { data: settingsData, refetch: refetchSettings } = useGetSettings();

  const {
    data: technicians,
    refetch: refetchTechnicians,
    isRefetching: refetchingTechnicians,
  } = useGetTechnicians();

  const {
    data: adminQuotes,
    refetch: refetchQuotes,
    isRefetching: refetchingQuotes,
  } = useGetQuotes({
    query: { queryKey: ["admin-quotes"], enabled: tab === "quotes" },
  });

  const {
    data: adminPayments,
    refetch: refetchPayments,
    isRefetching: refetchingPayments,
  } = useGetAdminPaymentRequests(undefined, {
    query: { queryKey: getGetAdminPaymentRequestsQueryKey(), enabled: tab === "payments" },
  });

  const {
    data: sites,
    refetch: refetchSites,
    isRefetching: refetchingSites,
  } = useGetSites({
    query: { queryKey: ["admin-sites"], enabled: tab === "sites" },
  });

  const {
    data: adminSiteVisits,
    refetch: refetchSiteVisits,
    isRefetching: refetchingSiteVisits,
  } = useGetSiteVisits({
    query: { queryKey: ["admin-site-visits"], enabled: tab === "siteVisits" },
  });

  const {
    data: attendanceRecords,
    refetch: refetchAttendance,
    isRefetching: refetchingAttendance,
  } = useGetAttendance(
    { date: attendanceDateFilter || undefined, technicianId: attendanceTechFilter || undefined },
    { query: { queryKey: ["admin-attendance", attendanceDateFilter, attendanceTechFilter], enabled: tab === "attendance" } }
  );

  const { data: absentToday, refetch: refetchAbsentToday } = useGetAbsentToday({
    query: { queryKey: ["absent-today"], enabled: tab === "attendance" },
  });


  const {
    data: techReport,
    refetch: refetchReport,
    isRefetching: refetchingReport,
    isFetched: reportFetched,
  } = useGetTechnicianReport(
    { technicianId: reportTechId, from: reportFrom, to: reportTo },
    { query: { queryKey: ["technician-report", reportTechId, reportFrom, reportTo], enabled: tab === "reports" && !!reportTechId } }
  );

  const fmtForEdit = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };
  const parseEditDT = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed.replace(" ", "T") + ":00");
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const { mutate: adminUpdateAttendanceMutate } = useAdminUpdateAttendance({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setEditRecord(null); setEditSaving(false);
        refetchAttendance();
        Alert.alert("Saved", "Attendance record updated.");
      },
      onError: () => { setEditSaving(false); Alert.alert("Error", "Failed to update attendance record."); },
    },
  });
  const { mutate: adminAddManualMutate } = useAdminAddManualAttendance({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setShowAddManual(false); setManualSaving(false);
        setManualTechId(""); setManualDate(new Date().toISOString().split("T")[0]);
        setManualCheckIn("09:00"); setManualCheckOut(""); setManualNotes("");
        refetchAttendance();
        Alert.alert("Added", "Manual attendance entry created.");
      },
      onError: () => { setManualSaving(false); Alert.alert("Error", "Failed to add manual attendance entry."); },
    },
  });

  // Mutations
  const { mutate: updateBookingStatus } = useUpdateBookingStatus({
    mutation: {
      onSuccess: () => { hapticNotify(Haptics.NotificationFeedbackType.Success); refetchBookings(); },
      onError: () => Alert.alert("Error", "Could not update booking status"),
    },
  });

  const { mutate: updateComplaintStatus } = useUpdateComplaintStatus({
    mutation: {
      onSuccess: () => { hapticNotify(Haptics.NotificationFeedbackType.Success); refetchComplaints(); },
      onError: () => Alert.alert("Error", "Could not update complaint status"),
    },
  });

  const { mutate: updatePaymentRequest } = useUpdatePaymentRequest({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setUpdatingPaymentId(null);
        setPaymentNotes(prev => { const n = { ...prev }; delete n[vars.id]; return n; });
        refetchPayments();
      },
      onError: () => {
        setUpdatingPaymentId(null);
        Alert.alert("Error", "Could not update payment request");
      },
    },
  });

  const { mutate: respondToQuote } = useUpdateQuote({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setQuoteFormEdits(prev => {
          const n = { ...prev };
          if (n[vars.id]) n[vars.id] = { ...n[vars.id], saving: false };
          return n;
        });
        refetchQuotes();
      },
      onError: (_err, vars) => {
        setQuoteFormEdits(prev => {
          const n = { ...prev };
          if (n[vars.id]) n[vars.id] = { ...n[vars.id], saving: false };
          return n;
        });
        Alert.alert("Error", "Could not update quote");
      },
    },
  });

  const { mutate: updateComplaint } = useUpdateComplaint({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setTechEdits(prev => { const n = { ...prev }; if (n[vars.id]) n[vars.id] = { ...n[vars.id], saving: false }; return n; });
        refetchComplaints();
      },
      onError: (_err, vars) => {
        setTechEdits(prev => { const n = { ...prev }; if (n[vars.id]) n[vars.id] = { ...n[vars.id], saving: false }; return n; });
        Alert.alert("Error", "Could not update complaint");
      },
    },
  });

  const { mutate: updateUserStatus } = useUpdateAdminUserStatus({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        refetchUsers();
      },
      onError: () => Alert.alert("Error", "Could not update user status"),
    },
  });

  const { data: customerReport, isLoading: customerReportLoading } = useGetCustomerReport(
    reportCustomerId ?? "",
    { query: { queryKey: ["customer-report", reportCustomerId], enabled: !!reportCustomerId } }
  );

  const { mutate: deleteUser } = useDeleteAdminUser({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        refetchUsers();
      },
      onError: () => Alert.alert("Error", "Could not delete user account."),
    },
  });

  const { mutate: updateSetting } = useUpdateSetting({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSavingBookingWA(false); setSavingComplaintWA(false);
        setSavingInstallationWA(false); setSavingSupportWA(false);
        setSavingContactPhone(false); setSavingContactEmail(false);
        setSavingContactAddress(false); setSavingContactHours(false);
        setSavingSocialInstagram(false); setSavingSocialFacebook(false);
        setSavingSocialTiktok(false); setSavingSocialLinkedin(false);
        setSavingSocialYoutube(false); setSavingSocialWebsite(false);
        setSavingReferralEnabled(false); setSavingReferralPoints(false); setSavingReferralMoney(false);
        setSavingCheckinDeadline(false); setSavingShiftEnd(false); setSavingAbsentAlertTime(false);
        setSavingAppUpdateVersion(false); setSavingAppUpdateUrl(false);
        setSavingTimezone(false);
        refetchSettings();
        Alert.alert("Saved", "Setting updated successfully.");
      },
      onError: () => {
        setSavingBookingWA(false); setSavingComplaintWA(false);
        setSavingInstallationWA(false); setSavingSupportWA(false);
        setSavingContactPhone(false); setSavingContactEmail(false);
        setSavingContactAddress(false); setSavingContactHours(false);
        setSavingSocialInstagram(false); setSavingSocialFacebook(false);
        setSavingSocialTiktok(false); setSavingSocialLinkedin(false);
        setSavingSocialYoutube(false); setSavingSocialWebsite(false);
        setSavingReferralEnabled(false); setSavingReferralPoints(false); setSavingReferralMoney(false);
        setSavingCheckinDeadline(false); setSavingShiftEnd(false); setSavingAbsentAlertTime(false);
        setSavingAppUpdateVersion(false); setSavingAppUpdateUrl(false);
        setSavingTimezone(false);
        Alert.alert("Error", "Could not update setting");
      },
    },
  });

  const { mutate: resetUserPassword } = useAdminResetUserPassword({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setResetPassUserId(null);
        setResetPassValue("");
        Alert.alert("Done", "Password has been reset successfully");
      },
      onError: () => Alert.alert("Error", "Could not reset password"),
    },
  });

  const { mutateAsync: createSiteVisitAsync } = useCreateSiteVisit();

  const { mutateAsync: updateSiteVisitAsync } = useUpdateSiteVisit();

  const { mutateAsync: deleteSiteVisitAsync } = useDeleteSiteVisit();

  const { mutate: assignBookingTechnicians } = useAssignBookingTechnicians({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        refetchBookings();
      },
      onError: () => Alert.alert("Error", "Could not update technician assignment"),
      onSettled: (_data, _err, vars) => {
        setBookingTechAssigning(prev => ({ ...prev, [vars.id]: false }));
      },
    },
  });

  const { mutate: createSite } = useCreateSite({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSiteName(""); setSiteAddress(""); setSiteCity("");
        setSiteClientName(""); setSiteClientPhone(""); setSiteNotes("");
        setShowAddSiteForm(false); setSavingNewSite(false);
        refetchSites();
      },
      onError: (err: any) => {
        setSavingNewSite(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Could not create site");
      },
    },
  });

  const { mutate: updateSiteStatus } = useUpdateSite({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSiteStatusSaving(prev => ({ ...prev, [vars.id]: false }));
        refetchSites();
      },
      onError: (_err, vars) => {
        setSiteStatusSaving(prev => ({ ...prev, [vars.id]: false }));
        Alert.alert("Error", "Could not update site status");
      },
    },
  });

  const { mutate: deleteSiteById } = useDeleteSite({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSiteExpandedId(null);
        refetchSites();
      },
      onError: () => Alert.alert("Error", "Could not delete site"),
    },
  });

  const { mutate: assignComplaintTechs } = useAssignComplaintTechnicians({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setComplaintMultiAssigning(prev => ({ ...prev, [vars.id]: false }));
        refetchComplaints();
      },
      onError: (_err, vars) => {
        setComplaintMultiAssigning(prev => ({ ...prev, [vars.id]: false }));
        Alert.alert("Error", "Could not assign technicians");
      },
    },
  });

  const { mutate: assignSvTechs } = useAssignSiteVisitTechnicians({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSvMultiAssigning(prev => ({ ...prev, [vars.id]: false }));
        refetchSiteVisits();
      },
      onError: (_err, vars) => {
        setSvMultiAssigning(prev => ({ ...prev, [vars.id]: false }));
        Alert.alert("Error", "Could not assign technicians");
      },
    },
  });

  const { mutate: assignSiteTechs } = useAssignSiteTechnicians({
    mutation: {
      onSuccess: (_data, vars) => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setSiteAssigning(prev => ({ ...prev, [vars.id]: false }));
        refetchSites();
      },
      onError: (_err, vars) => {
        setSiteAssigning(prev => ({ ...prev, [vars.id]: false }));
        Alert.alert("Error", "Could not assign technicians");
      },
    },
  });

  const { mutate: createTechnician } = useCreateTechnician({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setNewTechName(""); setNewTechEmail(""); setNewTechPhone("");
        setNewTechPassword(""); setNewTechSpecialty(""); setShowAddTechForm(false);
        refetchTechnicians();
        setSavingNewTech(false);
        Alert.alert("Success", "Technician account created successfully");
      },
      onError: (err: any) => {
        setSavingNewTech(false);
        const msg: string = err?.data?.error ?? err?.message ?? "";
        if (msg.toLowerCase().includes("email")) {
          setNewTechEmailErr(msg);
        } else {
          Alert.alert("Error", msg || "Could not create technician");
        }
      },
    },
  });

  const { mutate: updateTechnicianStatus } = useUpdateTechnician({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        refetchTechnicians();
      },
      onError: () => Alert.alert("Error", "Could not update technician"),
    },
  });

  const { mutate: updateTechnicianProfile } = useUpdateTechnician({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setEditingTechId(null);
        setSavingEditTech(false);
        refetchTechnicians();
      },
      onError: (err: any) => {
        setSavingEditTech(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Could not save changes");
      },
    },
  });

  // Sync settings into local state once loaded
  useEffect(() => {
    if (settingsData) {
      setBookingWA(settingsData.find((s) => s.key === "whatsapp_booking")?.value ?? "");
      setComplaintWA(settingsData.find((s) => s.key === "whatsapp_complaint")?.value ?? "");
      setInstallationWA(settingsData.find((s) => s.key === "whatsapp_installation")?.value ?? "");
      setSupportWA(settingsData.find((s) => s.key === "whatsapp_support")?.value ?? "");
      setAiSupportEnabled(settingsData.find((s) => s.key === "ai_support_enabled")?.value === "true");
      setAiSupportNumber(settingsData.find((s) => s.key === "whatsapp_ai_support")?.value ?? "");
      setContactPhone(settingsData.find((s) => s.key === "contact_phone")?.value ?? "");
      setContactEmail(settingsData.find((s) => s.key === "contact_email")?.value ?? "");
      setContactAddress(settingsData.find((s) => s.key === "contact_address")?.value ?? "");
      setContactHours(settingsData.find((s) => s.key === "contact_hours")?.value ?? "");
      setSocialInstagram(settingsData.find((s) => s.key === "social_instagram")?.value ?? "");
      setSocialFacebook(settingsData.find((s) => s.key === "social_facebook")?.value ?? "");
      setSocialTiktok(settingsData.find((s) => s.key === "social_tiktok")?.value ?? "");
      setSocialLinkedin(settingsData.find((s) => s.key === "social_linkedin")?.value ?? "");
      setSocialYoutube(settingsData.find((s) => s.key === "social_youtube")?.value ?? "");
      setSocialWebsite(settingsData.find((s) => s.key === "social_website")?.value ?? "");
      setReferralEnabled(settingsData.find((s) => s.key === "referral_enabled")?.value === "true");
      setReferralPointsPerRef(settingsData.find((s) => s.key === "referral_points_per_referral")?.value ?? "10");
      setReferralMoneyPerPoint(settingsData.find((s) => s.key === "referral_money_per_point")?.value ?? "100");
      setCheckinDeadline(settingsData.find((s) => s.key === "attendance_checkin_deadline")?.value ?? "08:00");
      setShiftEnd(settingsData.find((s) => s.key === "attendance_shift_end")?.value ?? "18:00");
      setAbsentAlertTime(settingsData.find((s) => s.key === "attendance_absent_alert_time")?.value ?? "09:00");
      setAppUpdateVersion(settingsData.find((s) => s.key === "app_update_version")?.value ?? "");
      setAppUpdateUrl(settingsData.find((s) => s.key === "app_update_url")?.value ?? "");
      setAppTimezoneOffset(settingsData.find((s) => s.key === "app_timezone_offset")?.value ?? "5");
    }
  }, [settingsData]);

  const filteredBookings = (bookings ?? []).filter(
    (b) => bookingFilter === "all" || b.status === bookingFilter,
  );

  const filteredComplaints = (complaints ?? []).filter(
    (c) => complaintFilter === "all" || c.status === complaintFilter,
  );

  const filteredUsers = (adminUsers ?? []).filter(
    (u) => userFilter === "all" || u.status === userFilter,
  );

  function toggleExpand(id: string) {
    hapticSelection();
    setExpandedId((prev) => {
      if (prev !== id) {
        // Initialize tech edits from complaint data when expanding
        const complaint = (complaints ?? []).find(c => c.id === id);
        if (complaint) {
          setTechEdits(te => ({
            ...te,
            [id]: te[id] ?? { name: complaint.technicianName ?? "", phone: complaint.technicianPhone ?? "", saving: false },
          }));
        }
      }
      return prev === id ? null : id;
    });
  }

  function confirmBookingStatus(id: string, status: string) {
    confirmAction("Change Status", `Set to "${status}"?`, () =>
      updateBookingStatus({ id, data: { status } })
    );
  }

  function confirmComplaintStatus(id: string, status: string) {
    confirmAction("Change Status", `Set to "${getComplaintStatusLabel(status)}"?`, () =>
      updateComplaint({ id, data: { status: status as "submitted" | "in_progress" | "resolved" | "closed" } })
    );
  }

  function saveTechnicianInfo(id: string) {
    const edits = techEdits[id];
    if (!edits) return;
    setTechEdits(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    const pickedTechId = complaintTechPick[id];
    updateComplaint({
      id,
      data: {
        technicianName: edits.name || null,
        technicianPhone: edits.phone || null,
        ...(pickedTechId !== undefined ? { technicianId: pickedTechId } : {}),
      },
    });
  }

  function pickComplaintTechnician(complaintId: string, techId: string | null) {
    hapticSelection();
    setComplaintTechPick(prev => ({ ...prev, [complaintId]: techId }));
    const tech = (technicians ?? []).find(t => t.id === techId);
    if (tech) {
      setTechEdits(prev => ({
        ...prev,
        [complaintId]: { ...(prev[complaintId] ?? { saving: false }), name: tech.name, phone: tech.phone },
      }));
    }
  }

  function toggleTechForBooking(bookingId: string, techId: string, currentIds: string[]) {
    hapticSelection();
    const newIds = currentIds.includes(techId)
      ? currentIds.filter((id) => id !== techId)
      : [...currentIds, techId];
    setBookingTechAssigning(prev => ({ ...prev, [bookingId]: true }));
    assignBookingTechnicians({ id: bookingId, data: { technicianIds: newIds } });
  }

  function clearBookingTechnicians(bookingId: string) {
    hapticSelection();
    setBookingTechAssigning(prev => ({ ...prev, [bookingId]: true }));
    assignBookingTechnicians({ id: bookingId, data: { technicianIds: [] } });
  }

  function handleCreateTechnician() {
    setNewTechNameErr(""); setNewTechEmailErr(""); setNewTechPhoneErr(""); setNewTechPasswordErr("");
    let hasErr = false;
    if (!newTechName.trim()) { setNewTechNameErr("Name is required"); hasErr = true; }
    if (!newTechEmail.trim()) { setNewTechEmailErr("Email is required"); hasErr = true; }
    if (!newTechPhone.trim()) { setNewTechPhoneErr("Phone is required"); hasErr = true; }
    if (!newTechPassword) { setNewTechPasswordErr("Password is required"); hasErr = true; }
    else if (newTechPassword.length < 6) { setNewTechPasswordErr("Minimum 6 characters"); hasErr = true; }
    if (hasErr) return;
    setSavingNewTech(true);
    createTechnician({ data: { name: newTechName.trim(), email: newTechEmail.trim().toLowerCase(), phone: newTechPhone.trim(), password: newTechPassword, specialty: newTechSpecialty.trim() || undefined } });
  }

  function openResetPassword(id: string, name: string) {
    setResetPassUserId(id);
    setResetPassUserName(name);
    setResetPassValue("");
    setShowResetPass(false);
  }

  function submitResetPassword() {
    if (!resetPassUserId) return;
    if (!resetPassValue || resetPassValue.length < 6) {
      Alert.alert("Too Short", "Password must be at least 6 characters");
      return;
    }
    confirmAction("Reset Password", `Reset password for ${resetPassUserName}?`, () =>
      resetUserPassword({ id: resetPassUserId!, data: { newPassword: resetPassValue } }),
      "Reset", true
    );
  }

  async function handleAdminPasswordChange() {
    if (!adminCurrentPass || !adminNewPass || !adminConfirmPass) {
      Alert.alert("Required", "Please fill in all password fields");
      return;
    }
    if (adminNewPass.length < 6) {
      Alert.alert("Too Short", "New password must be at least 6 characters");
      return;
    }
    if (adminNewPass !== adminConfirmPass) {
      Alert.alert("Mismatch", "New password and confirmation do not match");
      return;
    }
    setSavingAdminPass(true);
    try {
      await changePassword(adminCurrentPass, adminNewPass);
      hapticNotify(Haptics.NotificationFeedbackType.Success);
      setAdminCurrentPass(""); setAdminNewPass(""); setAdminConfirmPass("");
      Alert.alert("Done", "Admin password changed successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not change password");
    } finally {
      setSavingAdminPass(false);
    }
  }

  function confirmUserStatus(id: string, name: string, status: "approved" | "rejected") {
    const label = status === "approved" ? "Approve" : "Reject";
    confirmAction(
      `${label} Account`,
      `${label} account for "${name}"?`,
      () => updateUserStatus({ id, data: { status } }),
      label,
      status === "rejected"
    );
  }

  function confirmDeleteUser(id: string, name: string) {
    confirmAction(
      "Delete Account",
      `Permanently delete "${name}"? All their data will be lost and this cannot be undone.`,
      () => deleteUser({ id }),
      "Delete",
      true
    );
  }

  if (!user?.isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }]}>
        <Feather name="shield-off" size={48} color={colors.mutedForeground} />
        <Text style={[styles.noAccessText, { color: colors.foreground }]}>Admin access only</Text>
      </View>
    );
  }

  const totalPending = (bookings ?? []).filter((b) => b.status === "pending").length;
  const totalOpenComplaints = (complaints ?? []).filter((c) => c.status === "submitted" || c.status === "in_progress").length;
  const pendingUsers = (adminUsers ?? []).filter((u) => u.status === "pending").length;

  const pendingQuotes = (adminQuotes ?? []).filter(q => q.status === "submitted" || q.status === "under_review").length;
  const pendingPayments = (adminPayments ?? []).filter(p => p.status === "pending").length;

  const TAB_CONFIG: { id: Tab; icon: keyof typeof Feather.glyphMap; label: string; badge?: number }[] = [
    { id: "bookings", icon: "list", label: `Bookings${bookings ? ` (${bookings.length})` : ""}` },
    { id: "complaints", icon: "alert-circle", label: `Complaints${complaints ? ` (${complaints.length})` : ""}` },
    { id: "quotes", icon: "package", label: `Quotes${adminQuotes ? ` (${adminQuotes.length})` : ""}`, badge: pendingQuotes },
    { id: "technicians", icon: "tool", label: `Technicians${technicians ? ` (${technicians.length})` : ""}` },
    { id: "users", icon: "users", label: "Users", badge: pendingUsers },
    { id: "payments", icon: "credit-card", label: `Payments${adminPayments ? ` (${adminPayments.length})` : ""}`, badge: pendingPayments },
    { id: "siteVisits", icon: "navigation", label: `Site Visits${adminSiteVisits ? ` (${adminSiteVisits.length})` : ""}` },
    { id: "settings", icon: "settings", label: "Settings" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: "#FFFFFF" }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.secondary }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSub}>Full control · K&S Solar Energy</Text>
          </View>
          <View style={[styles.adminBadge, { backgroundColor: "#FFFFFF22" }]}>
            <Feather name="shield" size={14} color="#FFFFFF" />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: "#FFFFFF18" }]}>
            <Text style={styles.statNum}>{bookings?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#F59E0B33" }]}>
            <Text style={styles.statNum}>{totalPending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#FFFFFF18" }]}>
            <Text style={styles.statNum}>{complaints?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Complaints</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#EF444433" }]}>
            <Text style={styles.statNum}>{totalOpenComplaints}</Text>
            <Text style={styles.statLabel}>Open</Text>
          </View>
        </View>
      </View>

      {/* ── Dashboard Grid or Section Back Bar ── */}
      {tab === null ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={[dashStyles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        >
          <View style={dashStyles.grid}>
            {([
              { id: "bookings" as Tab,    icon: "droplet"      as const, label: "Bookings",    sub: `${bookings?.length ?? 0} total`,       bg: "#1B6FA8", badge: totalPending },
              { id: "complaints" as Tab,  icon: "alert-circle" as const, label: "Complaints",  sub: `${totalOpenComplaints} open`,           bg: "#DC2626", badge: totalOpenComplaints },
              { id: "sites" as Tab,       icon: "map-pin"      as const, label: "Sites",       sub: `${sites?.length ?? 0} working sites`,   bg: "#0F766E" },
              { id: "quotes" as Tab,      icon: "package"      as const, label: "Quotes",      sub: `${adminQuotes?.length ?? 0} requests`,  bg: "#0A5A9C", badge: pendingQuotes },
              { id: "technicians" as Tab, icon: "tool"         as const, label: "Technicians", sub: `${technicians?.length ?? 0} registered`, bg: colors.primary },
              { id: "users" as Tab,       icon: "users"        as const, label: "Users",       sub: `${pendingUsers} pending approval`,       bg: "#0EA5E9", badge: pendingUsers },
              { id: "payments" as Tab,    icon: "credit-card"  as const, label: "Payments",    sub: `${pendingPayments} pending`,              bg: "#10B981", badge: pendingPayments },
              { id: "attendance" as Tab,  icon: "clock"        as const, label: "Attendance",  sub: "GPS check-in records",                  bg: "#0891B2" },
              { id: "liveMap" as Tab,     icon: "map-pin"      as const, label: "Live Map",    sub: "Real-time technician tracking",           bg: "#0E7490" },
              { id: "siteVisits" as Tab,  icon: "navigation"   as const, label: "Site Visits", sub: `${adminSiteVisits?.length ?? 0} requests`, bg: "#7C3AED" },
              { id: "reports" as Tab,     icon: "bar-chart-2"  as const, label: "Reports",     sub: "Download Excel reports",                bg: "#0A5A9C" },
              { id: "settings" as Tab,    icon: "settings"     as const, label: "Settings",    sub: "Configure app",                         bg: "#64748B" },
            ] as const).map((section) => (
              <TouchableOpacity
                key={section.id}
                style={[dashStyles.card, { backgroundColor: section.bg }]}
                onPress={() => { hapticSelection(); setTab(section.id); setExpandedId(null); }}
                activeOpacity={0.85}
              >
                {(section as any).badge > 0 ? (
                  <View style={dashStyles.badge}>
                    <Text style={dashStyles.badgeText}>{(section as any).badge > 9 ? "9+" : (section as any).badge}</Text>
                  </View>
                ) : null}
                <View style={dashStyles.cardIconWrap}>
                  <Feather name={section.icon} size={28} color="#FFFFFF" />
                </View>
                <Text style={dashStyles.cardTitle}>{section.label}</Text>
                <Text style={dashStyles.cardSub}>{section.sub}</Text>
                <Feather name="chevron-right" size={13} color="#FFFFFF66" style={{ alignSelf: "flex-end", marginTop: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={[dashStyles.backBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={dashStyles.backBtn}
            onPress={() => { hapticSelection(); setTab(null); setExpandedId(null); }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={16} color={colors.secondary} />
            <Text style={[dashStyles.backBtnText, { color: colors.secondary }]}>Dashboard</Text>
          </TouchableOpacity>
          <Text style={[dashStyles.backSection, { color: colors.foreground }]}>
            {tab === "bookings" ? "Bookings" : tab === "complaints" ? "Complaints" : tab === "quotes" ? "Quotes" : tab === "technicians" ? "Technicians" : tab === "users" ? "Users" : tab === "payments" ? "Payments" : tab === "sites" ? "Working Sites" : tab === "siteVisits" ? "Site Visits" : tab === "attendance" ? "Attendance" : tab === "reports" ? "Reports" : tab === "liveMap" ? "Live Map" : "Settings"}
          </Text>
          {TAB_CONFIG.find(t => t.id === tab)?.badge ? (
            <View style={[dashStyles.badge, { position: "relative", top: 0, right: 0, marginLeft: 4 }]}>
              <Text style={dashStyles.badgeText}>{TAB_CONFIG.find(t => t.id === tab)!.badge}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Booking Filter + List ── */}
      {tab === "bookings" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ maxHeight: 48 }}>
            {BOOKING_STATUSES.map((s) => {
              const active = bookingFilter === s;
              const color = s === "all" ? colors.secondary : BOOKING_STATUS_COLORS[s];
              const count = s === "all" ? (bookings?.length ?? 0) : (bookings ?? []).filter((b) => b.status === s).length;
              const label = s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: active ? color : color + "18", borderColor: active ? color : color + "44" }]} onPress={() => { hapticSelection(); setBookingFilter(s); }}>
                  <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : color }]}>
                    {label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <FlatList
            data={filteredBookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingBookings} onRefresh={refetchBookings} tintColor={colors.secondary} />}
            ListEmptyComponent={<View style={styles.emptyState}><Feather name="inbox" size={40} color={colors.mutedForeground} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No bookings found</Text></View>}
            renderItem={({ item }) => {
              const sc = BOOKING_STATUS_COLORS[item.status] ?? "#64748B";
              const isExpanded = expandedId === item.id;
              return (
                <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
                    <View style={[styles.cardIconWrap, { backgroundColor: sc + "18" }]}>
                      <Feather name="droplet" size={18} color={sc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customerName}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                        {item.city} · {item.panelCount} panels · {item.preferredDate}
                        {item.technicianIds.length > 0 ? ` · ${item.technicianIds.length} tech${item.technicianIds.length > 1 ? "s" : ""}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                        <View style={[styles.statusDot, { backgroundColor: sc }]} />
                        <Text style={[styles.statusBadgeText, { color: sc }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
                      </View>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>Customer Details</Text>
                      <InfoRow icon="user" label="Full Name" value={item.customerName} colors={colors} />
                      <InfoRow icon="phone" label="Phone" value={item.phone} colors={colors} />
                      <InfoRow icon="map-pin" label="Address" value={item.address} colors={colors} />
                      <InfoRow icon="map" label="City" value={item.city} colors={colors} />
                      <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 8 }]}>Service Details</Text>
                      <InfoRow icon="grid" label="Panel Count" value={`${item.panelCount} panels`} colors={colors} />
                      <InfoRow icon="home" label="Panel Type" value={item.panelType.charAt(0).toUpperCase() + item.panelType.slice(1)} colors={colors} />
                      <InfoRow icon="calendar" label="Preferred Date" value={item.preferredDate} colors={colors} />
                      <InfoRow icon="clock" label="Preferred Time" value={item.preferredTime.charAt(0).toUpperCase() + item.preferredTime.slice(1)} colors={colors} />
                      {item.notes ? <InfoRow icon="file-text" label="Notes" value={item.notes} colors={colors} /> : null}
                      <InfoRow icon="calendar" label="Booked On" value={formatDate(item.createdAt)} colors={colors} />
                      <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 8 }]}>
                        Assign Technicians{item.technicianIds.length > 0 ? ` (${item.technicianIds.length} assigned)` : ""}
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={styles.techPickerRow}>
                        {bookingTechAssigning[item.id]
                          ? <ActivityIndicator size="small" color={colors.secondary} style={{ marginRight: 8 }} />
                          : null}
                        <TouchableOpacity
                          style={[styles.techPill, { backgroundColor: item.technicianIds.length === 0 ? "#EF444418" : colors.muted, borderColor: item.technicianIds.length === 0 ? "#EF4444" : colors.border }]}
                          onPress={() => clearBookingTechnicians(item.id)}
                          disabled={bookingTechAssigning[item.id]}
                        >
                          <Feather name="x" size={11} color={item.technicianIds.length === 0 ? "#EF4444" : colors.mutedForeground} />
                          <Text style={[styles.techPillText, { color: item.technicianIds.length === 0 ? "#EF4444" : colors.mutedForeground }]}>Clear All</Text>
                        </TouchableOpacity>
                        {(technicians ?? []).filter(t => t.status === "active").map((t) => {
                          const isAssigned = item.technicianIds.includes(t.id);
                          return (
                            <TouchableOpacity
                              key={t.id}
                              style={[styles.techPill, { backgroundColor: isAssigned ? colors.secondary : colors.muted, borderColor: isAssigned ? colors.secondary : colors.border }]}
                              onPress={() => toggleTechForBooking(item.id, t.id, item.technicianIds)}
                              disabled={bookingTechAssigning[item.id]}
                            >
                              <Feather name={isAssigned ? "check" : "user"} size={11} color={isAssigned ? "#FFFFFF" : colors.mutedForeground} />
                              <Text style={[styles.techPillText, { color: isAssigned ? "#FFFFFF" : colors.foreground }]}>{t.name}{t.specialty ? ` · ${t.specialty}` : ""}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        {(technicians ?? []).filter(t => t.status === "active").length === 0 && !bookingTechAssigning[item.id] && (
                          <Text style={[styles.techPillText, { color: colors.mutedForeground, paddingHorizontal: 4 }]}>No active technicians</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                    {(["pending", "confirmed", "in_progress", "completed", "cancelled"] as const).map((s) => {
                      const c = BOOKING_STATUS_COLORS[s];
                      const label = s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1);
                      const isCurrent = item.status === s;
                      return (
                        <TouchableOpacity key={s} style={[styles.actionBtn, { backgroundColor: isCurrent ? c : c + "18", borderColor: isCurrent ? c : c + "44" }]} onPress={() => { if (!isCurrent) confirmBookingStatus(item.id, s); }} disabled={isCurrent}>
                          <Text style={[styles.actionBtnText, { color: isCurrent ? "#FFFFFF" : c }]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* ── Complaint Filter + List ── */}
      {tab === "complaints" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ maxHeight: 48 }}>
            {COMPLAINT_STATUSES.map((s) => {
              const active = complaintFilter === s;
              const color = s === "all" ? colors.secondary : COMPLAINT_STATUS_COLORS[s];
              const count = s === "all" ? (complaints?.length ?? 0) : (complaints ?? []).filter((c) => c.status === s).length;
              const label = s === "all" ? "All" : getComplaintStatusLabel(s);
              return (
                <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: active ? color : color + "18", borderColor: active ? color : color + "44" }]} onPress={() => { hapticSelection(); setComplaintFilter(s); }}>
                  <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : color }]}>{label} ({count})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <FlatList
            data={filteredComplaints}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingComplaints} onRefresh={refetchComplaints} tintColor={colors.secondary} />}
            ListEmptyComponent={<View style={styles.emptyState}><Feather name="check-circle" size={40} color={colors.mutedForeground} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No complaints found</Text></View>}
            renderItem={({ item }) => {
              const sc = COMPLAINT_STATUS_COLORS[item.status] ?? "#64748B";
              const isExpanded = expandedId === item.id;
              const statusLabel = getComplaintStatusLabel(item.status);
              const tech = techEdits[item.id];
              return (
                <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
                    <View style={[styles.cardIconWrap, { backgroundColor: sc + "18" }]}>
                      <Feather name="alert-circle" size={18} color={sc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.subject}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.customerName} · {formatDate(item.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                        <View style={[styles.statusDot, { backgroundColor: sc }]} />
                        <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                      </View>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>Customer Details</Text>
                      <InfoRow icon="user" label="Full Name" value={item.customerName} colors={colors} />
                      <InfoRow icon="phone" label="Phone" value={item.phone} colors={colors} />
                      <InfoRow icon="map-pin" label="Address" value={item.address} colors={colors} />
                      <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 8 }]}>Complaint Details</Text>
                      <InfoRow icon="zap" label="System Type" value={item.subject} colors={colors} />
                      <InfoRow icon="calendar" label="Submitted On" value={formatDate(item.createdAt)} colors={colors} />
                      <View style={[styles.messageBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Text style={[styles.messageLabel, { color: colors.mutedForeground }]}>Complaint Message</Text>
                        <Text style={[styles.messageText, { color: colors.foreground }]}>{item.message}</Text>
                      </View>
                      <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 12 }]}>Assign Technician</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={styles.techPickerRow}>
                        <TouchableOpacity
                          style={[styles.techPill, { backgroundColor: (complaintTechPick[item.id] === null || (!complaintTechPick[item.id] && !item.technicianId)) ? colors.secondary : colors.muted, borderColor: (complaintTechPick[item.id] === null || (!complaintTechPick[item.id] && !item.technicianId)) ? colors.secondary : colors.border }]}
                          onPress={() => { pickComplaintTechnician(item.id, null); setTechEdits(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { saving: false }), name: "", phone: "" } })); }}
                        >
                          <Text style={[styles.techPillText, { color: (complaintTechPick[item.id] === null || (!complaintTechPick[item.id] && !item.technicianId)) ? "#FFFFFF" : colors.mutedForeground }]}>None</Text>
                        </TouchableOpacity>
                        {(technicians ?? []).filter(t => t.status === "active").map((t) => {
                          const currentId = complaintTechPick[item.id] !== undefined ? complaintTechPick[item.id] : item.technicianId;
                          const isSelected = currentId === t.id;
                          return (
                            <TouchableOpacity key={t.id} style={[styles.techPill, { backgroundColor: isSelected ? colors.secondary : colors.muted, borderColor: isSelected ? colors.secondary : colors.border }]} onPress={() => pickComplaintTechnician(item.id, t.id)}>
                              <Feather name="user" size={11} color={isSelected ? "#FFFFFF" : colors.mutedForeground} />
                              <Text style={[styles.techPillText, { color: isSelected ? "#FFFFFF" : colors.foreground }]}>{t.name}{t.specialty ? ` · ${t.specialty}` : ""}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <View style={[styles.techRow, { borderColor: colors.border }]}>
                        <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                          <Feather name="user" size={13} color={colors.mutedForeground} />
                          <TextInput
                            style={[styles.techInput, { color: colors.foreground }]}
                            value={tech?.name ?? item.technicianName ?? ""}
                            onChangeText={(t) => setTechEdits(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { name: "", phone: "", saving: false }), name: t } }))}
                            placeholder="Technician name"
                            placeholderTextColor={colors.mutedForeground}
                          />
                        </View>
                        <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                          <Feather name="phone" size={13} color={colors.mutedForeground} />
                          <TextInput
                            style={[styles.techInput, { color: colors.foreground }]}
                            value={tech?.phone ?? item.technicianPhone ?? ""}
                            onChangeText={(t) => setTechEdits(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { name: "", phone: "", saving: false }), phone: t } }))}
                            placeholder="Technician phone"
                            placeholderTextColor={colors.mutedForeground}
                            keyboardType="phone-pad"
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.techSaveBtn, { backgroundColor: colors.secondary }]}
                          onPress={() => saveTechnicianInfo(item.id)}
                          disabled={tech?.saving}
                          activeOpacity={0.85}
                        >
                          {tech?.saving
                            ? <ActivityIndicator size="small" color="#FFFFFF" />
                            : <><Feather name="save" size={13} color="#FFFFFF" /><Text style={styles.techSaveBtnText}>Save</Text></>
                          }
                        </TouchableOpacity>
                      </View>

                      {/* Multi-Technician Assignment (junction table) */}
                      {(() => {
                        const currentIds = complaintMultiPick[item.id] !== undefined ? complaintMultiPick[item.id] : (item.technicianIds ?? []);
                        const isSaving = complaintMultiAssigning[item.id] ?? false;
                        return (
                          <View style={{ marginTop: 8, gap: 6 }}>
                            <Text style={[styles.sectionLabel, { color: colors.secondary }]}>Assign Multiple Technicians</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techPickerRow}>
                              {(technicians ?? []).filter(t => t.status === "active").map((t) => {
                                const sel = currentIds.includes(t.id);
                                return (
                                  <TouchableOpacity
                                    key={t.id}
                                    style={[styles.techPill, { backgroundColor: sel ? "#7C3AED" : colors.muted, borderColor: sel ? "#7C3AED" : colors.border }]}
                                    onPress={() => {
                                      hapticSelection();
                                      const next = sel ? currentIds.filter(id => id !== t.id) : [...currentIds, t.id];
                                      setComplaintMultiPick(prev => ({ ...prev, [item.id]: next }));
                                    }}
                                  >
                                    <Feather name={sel ? "check" : "user"} size={11} color={sel ? "#FFFFFF" : colors.mutedForeground} />
                                    <Text style={[styles.techPillText, { color: sel ? "#FFFFFF" : colors.foreground }]}>{t.name}{t.specialty ? ` · ${t.specialty}` : ""}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                            <TouchableOpacity
                              style={[styles.techSaveBtn, { backgroundColor: isSaving ? colors.mutedForeground : "#7C3AED", alignSelf: "flex-start" }]}
                              disabled={isSaving}
                              onPress={() => {
                                setComplaintMultiAssigning(prev => ({ ...prev, [item.id]: true }));
                                assignComplaintTechs({ id: item.id, data: { technicianIds: currentIds } });
                              }}
                              activeOpacity={0.85}
                            >
                              {isSaving
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <><Feather name="users" size={13} color="#FFFFFF" /><Text style={styles.techSaveBtnText}>Save ({currentIds.length})</Text></>
                              }
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  )}
                  <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                    {([{ v: "submitted", l: "Submitted" }, { v: "in_progress", l: "In Progress" }, { v: "resolved", l: "Resolved" }, { v: "closed", l: "Closed" }] as const).map((s) => {
                      const c = COMPLAINT_STATUS_COLORS[s.v];
                      const isCurrent = item.status === s.v || (s.v === "submitted" && item.status === "open") || (s.v === "in_progress" && item.status === "in_review");
                      return (
                        <TouchableOpacity key={s.v} style={[styles.actionBtn, { backgroundColor: isCurrent ? c : c + "18", borderColor: isCurrent ? c : c + "44" }]} onPress={() => { if (!isCurrent) confirmComplaintStatus(item.id, s.v); }} disabled={isCurrent}>
                          <Text style={[styles.actionBtnText, { color: isCurrent ? "#FFFFFF" : c }]}>{s.l}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* ── Quotes Tab ── */}
      {tab === "quotes" && (
        <FlatList
          data={adminQuotes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refetchingQuotes} onRefresh={refetchQuotes} tintColor={colors.secondary} />}
          ListEmptyComponent={<View style={styles.emptyState}><Feather name="package" size={40} color={colors.mutedForeground} /><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No quotation requests yet</Text></View>}
          renderItem={({ item }) => {
            const sc = QUOTE_STATUS_COLORS[item.status] ?? "#64748B";
            const isExpanded = expandedId === item.id;
            const form = quoteFormEdits[item.id] ?? { systemSize: item.systemSize ?? "", priceEstimate: item.priceEstimate ?? "", adminNote: item.adminNote ?? "", saving: false };
            const sysLabel = QUOTE_SYSTEM_TYPE_LABELS[item.systemType] ?? item.systemType;
            const statusLabel = (item.status.charAt(0).toUpperCase() + item.status.slice(1)).replace("_", " ");

            function saveQuoteResponse(newStatus?: string) {
              setQuoteFormEdits(prev => ({ ...prev, [item.id]: { ...form, saving: true } }));
              respondToQuote({
                id: item.id,
                data: {
                  systemSize: form.systemSize.trim() || undefined,
                  priceEstimate: form.priceEstimate.trim() || undefined,
                  adminNote: form.adminNote.trim() || undefined,
                  ...(newStatus ? { status: newStatus as any } : {}),
                },
              });
            }

            return (
              <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
                  <View style={[styles.cardIconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="package" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customerName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{sysLabel} · {item.city} · {formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.sectionLabel, { color: colors.secondary }]}>Customer</Text>
                    <InfoRow icon="user" label="Name" value={item.customerName} colors={colors} />
                    <InfoRow icon="phone" label="Phone" value={item.phone} colors={colors} />
                    <InfoRow icon="map-pin" label="City" value={item.city} colors={colors} />
                    <InfoRow icon="navigation" label="Address" value={item.address} colors={colors} />

                    <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 8 }]}>Requirements</Text>
                    <InfoRow icon="home" label="Property Type" value={item.propertyType === "house" ? "Residential / House" : "Commercial"} colors={colors} />
                    <InfoRow icon="zap" label="System Type" value={sysLabel} colors={colors} />
                    <InfoRow icon="dollar-sign" label="Monthly Bill" value={item.monthlyBill} colors={colors} />
                    {item.roofArea ? <InfoRow icon="maximize" label="Roof Area" value={item.roofArea} colors={colors} /> : null}
                    {item.notes ? <InfoRow icon="file-text" label="Notes" value={item.notes} colors={colors} /> : null}

                    <Text style={[styles.sectionLabel, { color: colors.secondary, marginTop: 8 }]}>Admin Response</Text>

                    <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: colors.border, marginBottom: 8 }]}>
                      <Feather name="zap" size={13} color={colors.mutedForeground} />
                      <TextInput
                        style={[styles.techInput, { color: colors.foreground }]}
                        value={quoteFormEdits[item.id]?.systemSize ?? item.systemSize ?? ""}
                        onChangeText={(v) => setQuoteFormEdits(prev => ({ ...prev, [item.id]: { ...form, systemSize: v } }))}
                        placeholder="Recommended system size (e.g. 10 kW)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: colors.border, marginBottom: 8 }]}>
                      <Feather name="tag" size={13} color={colors.mutedForeground} />
                      <TextInput
                        style={[styles.techInput, { color: colors.foreground }]}
                        value={quoteFormEdits[item.id]?.priceEstimate ?? item.priceEstimate ?? ""}
                        onChangeText={(v) => setQuoteFormEdits(prev => ({ ...prev, [item.id]: { ...form, priceEstimate: v } }))}
                        placeholder="Price estimate (e.g. Rs. 950,000)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                    <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: colors.border, marginBottom: 8 }]}>
                      <Feather name="message-square" size={13} color={colors.mutedForeground} />
                      <TextInput
                        style={[styles.techInput, { color: colors.foreground }]}
                        value={quoteFormEdits[item.id]?.adminNote ?? item.adminNote ?? ""}
                        onChangeText={(v) => setQuoteFormEdits(prev => ({ ...prev, [item.id]: { ...form, adminNote: v } }))}
                        placeholder="Admin note (optional)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.techSaveBtn, { backgroundColor: colors.secondary, alignSelf: "flex-start", marginBottom: 4, opacity: form.saving ? 0.6 : 1 }]}
                      onPress={() => saveQuoteResponse()}
                      disabled={form.saving}
                      activeOpacity={0.85}
                    >
                      {form.saving
                        ? <ActivityIndicator size="small" color="#FFFFFF" />
                        : <><Feather name="save" size={13} color="#FFFFFF" /><Text style={styles.techSaveBtnText}>Save Response</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  {(["submitted", "under_review", "quote_sent", "accepted", "rejected"] as const).map((s) => {
                    const c = QUOTE_STATUS_COLORS[s] ?? "#64748B";
                    const isCurrent = item.status === s;
                    const slabel = s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1);
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.actionBtn, { backgroundColor: isCurrent ? c : c + "18", borderColor: isCurrent ? c : c + "44" }]}
                        onPress={() => { if (!isCurrent) respondToQuote({ id: item.id, data: { status: s } }); }}
                        disabled={isCurrent}
                      >
                        <Text style={[styles.actionBtnText, { color: isCurrent ? "#FFFFFF" : c }]}>{slabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── Technicians Tab ── */}
      {tab === "technicians" && (
        <FlatList
          data={technicians ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refetchingTechnicians} onRefresh={refetchTechnicians} tintColor={colors.secondary} />}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={[styles.addTechBtn, { backgroundColor: colors.secondary }]}
                onPress={() => { hapticSelection(); setShowAddTechForm(v => !v); }}
                activeOpacity={0.85}
              >
                <Feather name={showAddTechForm ? "x" : "user-plus"} size={16} color="#FFFFFF" />
                <Text style={styles.addTechBtnText}>{showAddTechForm ? "Cancel" : "Add New Technician"}</Text>
              </TouchableOpacity>
              {showAddTechForm && (
                <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.secondary + "44", padding: 14 }]}>
                  <Text style={[styles.sectionLabel, { color: colors.secondary, marginBottom: 12 }]}>New Technician</Text>
                  {([
                    { label: "Full Name *", value: newTechName, set: setNewTechName, placeholder: "e.g. Ali Raza", kbd: "default" as const, icon: "user" as const, err: newTechNameErr, clearErr: () => setNewTechNameErr("") },
                    { label: "Email *", value: newTechEmail, set: setNewTechEmail, placeholder: "ali@example.com", kbd: "email-address" as const, icon: "mail" as const, err: newTechEmailErr, clearErr: () => setNewTechEmailErr("") },
                    { label: "Phone *", value: newTechPhone, set: setNewTechPhone, placeholder: "03001234567", kbd: "phone-pad" as const, icon: "phone" as const, err: newTechPhoneErr, clearErr: () => setNewTechPhoneErr("") },
                    { label: "Specialty (optional)", value: newTechSpecialty, set: setNewTechSpecialty, placeholder: "e.g. Inverter Repair", kbd: "default" as const, icon: "tool" as const, err: "", clearErr: () => {} },
                  ] as Array<{ label: string; value: string; set: (v: string) => void; placeholder: string; kbd: "default" | "email-address" | "phone-pad"; icon: "user" | "mail" | "phone" | "tool"; err: string; clearErr: () => void }>).map(({ label, value, set, placeholder, kbd, icon, err, clearErr }) => (
                    <View key={label} style={{ marginBottom: 10 }}>
                      <Text style={[styles.settingLabel, { color: colors.foreground, fontSize: 12, marginBottom: 4 }]}>{label}</Text>
                      <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: err ? "#EF4444" : colors.border }]}>
                        <Feather name={icon} size={13} color={err ? "#EF4444" : colors.mutedForeground} />
                        <TextInput style={[styles.techInput, { color: colors.foreground }]} value={value} onChangeText={(v) => { set(v); clearErr(); }} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={kbd} autoCapitalize={kbd === "email-address" ? "none" : "words"} />
                      </View>
                      {err ? <Text style={styles.techFieldErr}>{err}</Text> : null}
                    </View>
                  ))}
                  <View style={{ marginBottom: 10 }}>
                    <Text style={[styles.settingLabel, { color: colors.foreground, fontSize: 12, marginBottom: 4 }]}>Password *</Text>
                    <View style={[styles.techInputWrap, { backgroundColor: colors.muted, borderColor: newTechPasswordErr ? "#EF4444" : colors.border }]}>
                      <Feather name="lock" size={13} color={newTechPasswordErr ? "#EF4444" : colors.mutedForeground} />
                      <TextInput style={[styles.techInput, { color: colors.foreground }]} value={newTechPassword} onChangeText={(v) => { setNewTechPassword(v); setNewTechPasswordErr(""); }} placeholder="Min 6 characters" placeholderTextColor={colors.mutedForeground} secureTextEntry={!showNewTechPass} autoCapitalize="none" />
                      <TouchableOpacity onPress={() => setShowNewTechPass(v => !v)}>
                        <Feather name={showNewTechPass ? "eye-off" : "eye"} size={13} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    {newTechPasswordErr ? <Text style={styles.techFieldErr}>{newTechPasswordErr}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: savingNewTech ? colors.mutedForeground : colors.secondary }]}
                    onPress={handleCreateTechnician}
                    disabled={savingNewTech}
                    activeOpacity={0.85}
                  >
                    {savingNewTech ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Feather name="user-plus" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Create Technician</Text></>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="tool" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No technicians yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontSize: 13 }]}>Tap "Add New Technician" to create one</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isActive = item.status === "active";
            const sc = isActive ? "#10B981" : "#EF4444";
            return (
              <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="tool" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.email}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {item.specialty ? `${item.specialty} · ` : ""}{item.phone}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusBadgeText, { color: sc }]}>{isActive ? "Active" : "Inactive"}</Text>
                  </View>
                </View>
                <View style={[styles.userActionRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.userActionBtn, { backgroundColor: "#6366F118", borderColor: "#6366F144" }]}
                    onPress={() => {
                      hapticSelection();
                      if (editingTechId === item.id) {
                        setEditingTechId(null);
                      } else {
                        setEditingTechId(item.id);
                        setEditTechName(item.name);
                        setEditTechEmail(item.email);
                        setEditTechPhone(item.phone);
                        setEditTechSpecialty(item.specialty ?? "");
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name={editingTechId === item.id ? "x" : "edit-2"} size={14} color="#6366F1" />
                    <Text style={[styles.userActionBtnText, { color: "#6366F1" }]}>{editingTechId === item.id ? "Cancel" : "Edit"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.userActionBtn, { backgroundColor: isActive ? "#EF444418" : "#10B98118", borderColor: isActive ? "#EF444444" : "#10B98144" }]}
                    onPress={() => confirmAction(
                      isActive ? "Deactivate" : "Activate",
                      `${isActive ? "Deactivate" : "Activate"} ${item.name}?`,
                      () => updateTechnicianStatus({ id: item.id, data: { status: isActive ? "inactive" : "active" } }),
                      "Confirm",
                      isActive
                    )}
                    activeOpacity={0.85}
                  >
                    <Feather name={isActive ? "user-x" : "user-check"} size={14} color={isActive ? "#EF4444" : "#10B981"} />
                    <Text style={[styles.userActionBtnText, { color: isActive ? "#EF4444" : "#10B981" }]}>{isActive ? "Deactivate" : "Activate"}</Text>
                  </TouchableOpacity>
                </View>
                {editingTechId === item.id && (
                  <View style={[styles.resetPassBox, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                    <Text style={[styles.resetPassLabel, { color: colors.foreground }]}>Edit — {item.name}</Text>
                    {[
                      { label: "Full Name", value: editTechName, set: setEditTechName, icon: "user" as const, kbd: "default" as const },
                      { label: "Email", value: editTechEmail, set: setEditTechEmail, icon: "mail" as const, kbd: "email-address" as const },
                      { label: "Phone", value: editTechPhone, set: setEditTechPhone, icon: "phone" as const, kbd: "phone-pad" as const },
                      { label: "Specialty", value: editTechSpecialty, set: setEditTechSpecialty, icon: "tool" as const, kbd: "default" as const },
                    ].map(({ label, value, set, icon, kbd }) => (
                      <View key={label} style={[styles.resetPassRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Feather name={icon} size={14} color={colors.mutedForeground} />
                        <TextInput
                          style={[styles.resetPassInput, { color: colors.foreground }]}
                          value={value}
                          onChangeText={set}
                          placeholder={label}
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType={kbd}
                          autoCapitalize={kbd === "email-address" ? "none" : "words"}
                        />
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.userActionBtn, { flex: 1, backgroundColor: "#6366F1", borderColor: "#6366F1" }]}
                        onPress={() => {
                          if (!editTechName || !editTechEmail || !editTechPhone) {
                            Alert.alert("Required", "Name, email and phone are required");
                            return;
                          }
                          setSavingEditTech(true);
                          updateTechnicianProfile({ id: item.id, data: { name: editTechName.trim(), email: editTechEmail.trim(), phone: editTechPhone.trim(), specialty: editTechSpecialty.trim() || undefined } });
                        }}
                        disabled={savingEditTech}
                        activeOpacity={0.85}
                      >
                        {savingEditTech
                          ? <ActivityIndicator size="small" color="#FFFFFF" />
                          : <><Feather name="save" size={14} color="#FFFFFF" /><Text style={[styles.userActionBtnText, { color: "#FFFFFF" }]}>Save Changes</Text></>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.userActionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                        onPress={() => setEditingTechId(null)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.userActionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Users Tab ── */}
      {tab === "users" && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ maxHeight: 48 }}>
            {USER_STATUSES.map((s) => {
              const active = userFilter === s;
              const color = s === "all" ? colors.secondary : USER_STATUS_COLORS[s];
              const count = s === "all" ? (adminUsers?.length ?? 0) : (adminUsers ?? []).filter((u) => u.status === s).length;
              const label = s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: active ? color : color + "18", borderColor: active ? color : color + "44" }]} onPress={() => { hapticSelection(); setUserFilter(s); }}>
                  <Text style={[styles.filterChipText, { color: active ? "#FFFFFF" : color }]}>{label} ({count})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad + 100 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingUsers} onRefresh={refetchUsers} tintColor={colors.secondary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="users" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const sc = USER_STATUS_COLORS[item.status] ?? "#64748B";
              const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
              return (
                <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIconWrap, { backgroundColor: sc + "18" }]}>
                      <Feather name={item.isMaster ? "star" : "user"} size={18} color={sc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.email}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                        {item.isMaster ? "Master" : `Customer${item.inverterBrand ? ` · ${item.inverterBrand}` : ""}`} · Joined {formatDate(item.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                      <View style={[styles.statusDot, { backgroundColor: sc }]} />
                      <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View style={[styles.userInfoRow, { borderTopColor: colors.border }]}>
                    <View style={styles.userInfoItem}>
                      <Feather name="phone" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.userInfoText, { color: colors.mutedForeground }]}>{item.phone}</Text>
                    </View>
                  </View>
                  <View style={[styles.userActionRow, { borderTopColor: colors.border }]}>
                    {item.status !== "approved" && (
                      <TouchableOpacity
                        style={[styles.userActionBtn, { backgroundColor: "#10B981", borderColor: "#10B981" }]}
                        onPress={() => confirmUserStatus(item.id, item.name, "approved")}
                        activeOpacity={0.85}
                      >
                        <Feather name="check" size={14} color="#FFFFFF" />
                        <Text style={[styles.userActionBtnText, { color: "#FFFFFF" }]}>Approve</Text>
                      </TouchableOpacity>
                    )}
                    {item.status !== "rejected" && (
                      <TouchableOpacity
                        style={[styles.userActionBtn, { backgroundColor: "#EF444418", borderColor: "#EF444444" }]}
                        onPress={() => confirmUserStatus(item.id, item.name, "rejected")}
                        activeOpacity={0.85}
                      >
                        <Feather name="x" size={14} color="#EF4444" />
                        <Text style={[styles.userActionBtnText, { color: "#EF4444" }]}>Reject</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.userActionBtn, { backgroundColor: "#6366F118", borderColor: "#6366F144" }]}
                      onPress={() => openResetPassword(item.id, item.name)}
                      activeOpacity={0.85}
                    >
                      <Feather name="key" size={14} color="#6366F1" />
                      <Text style={[styles.userActionBtnText, { color: "#6366F1" }]}>Reset Pass</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.userActionBtn, {
                        backgroundColor: warrantyExpandedId === item.id ? "#1B6FA8" : "#1B6FA818",
                        borderColor: "#1B6FA844",
                      }]}
                      onPress={() => {
                        hapticSelection();
                        setWarrantyExpandedId((prev) => prev === item.id ? null : item.id);
                        setResetPassUserId(null);
                      }}
                      activeOpacity={0.85}
                    >
                      <Feather name="shield" size={14} color={warrantyExpandedId === item.id ? "#FFFFFF" : "#1B6FA8"} />
                      <Text style={[styles.userActionBtnText, { color: warrantyExpandedId === item.id ? "#FFFFFF" : "#1B6FA8" }]}>Warranties</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.userActionBtn, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED44" }]}
                      onPress={() => { hapticSelection(); setReportCustomerId(item.id); }}
                      activeOpacity={0.85}
                    >
                      <Feather name="bar-chart-2" size={14} color="#7C3AED" />
                      <Text style={[styles.userActionBtnText, { color: "#7C3AED" }]}>Report</Text>
                    </TouchableOpacity>
                    {!item.isAdmin && (
                      <TouchableOpacity
                        style={[styles.userActionBtn, { backgroundColor: "#EF444418", borderColor: "#EF444444" }]}
                        onPress={() => confirmDeleteUser(item.id, item.name)}
                        activeOpacity={0.85}
                      >
                        <Feather name="trash-2" size={14} color="#EF4444" />
                        <Text style={[styles.userActionBtnText, { color: "#EF4444" }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {resetPassUserId === item.id && (
                    <View style={[styles.resetPassBox, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                      <Text style={[styles.resetPassLabel, { color: colors.foreground }]}>New password for {item.name}</Text>
                      <View style={[styles.resetPassRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Feather name="key" size={14} color={colors.mutedForeground} />
                        <TextInput
                          style={[styles.resetPassInput, { color: colors.foreground }]}
                          value={resetPassValue}
                          onChangeText={setResetPassValue}
                          placeholder="Min 6 characters"
                          placeholderTextColor={colors.mutedForeground}
                          secureTextEntry={!showResetPass}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowResetPass(v => !v)}>
                          <Feather name={showResetPass ? "eye-off" : "eye"} size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.userActionBtn, { flex: 1, backgroundColor: "#6366F1", borderColor: "#6366F1" }]}
                          onPress={submitResetPassword}
                          activeOpacity={0.85}
                        >
                          <Feather name="check" size={14} color="#FFFFFF" />
                          <Text style={[styles.userActionBtnText, { color: "#FFFFFF" }]}>Confirm Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.userActionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                          onPress={() => setResetPassUserId(null)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.userActionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  {warrantyExpandedId === item.id && (
                    <UserWarrantyPanel userId={item.id} colors={colors} />
                  )}
                </View>
              );
            }}
          />
        </>
      )}

      {/* ── Payments Tab ── */}
      {tab === "payments" && (
        <FlatList
          data={adminPayments ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refetchingPayments} onRefresh={refetchPayments} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 40, gap: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Feather name="credit-card" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontFamily: "Inter_400Regular" }}>No payment requests yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor = item.status === "pending" ? "#F59E0B" : item.status === "paid" ? "#10B981" : "#EF4444";
            const isPending = item.status === "pending";
            const isUpdating = updatingPaymentId === item.id;
            return (
              <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 }}>
                {/* Status badge */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                    #{item.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <View style={{ backgroundColor: statusColor + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                    <Text style={{ color: statusColor, fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" }}>{item.status}</Text>
                  </View>
                </View>

                {/* Amount */}
                <View style={{ backgroundColor: "#10B98112", borderRadius: 10, padding: 12, alignItems: "center" }}>
                  <Text style={{ color: "#10B981", fontSize: 22, fontFamily: "Inter_700Bold" }}>PKR {item.amountPkr}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>{item.pointsUsed} points redeemed</Text>
                </View>

                {/* User info */}
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", marginBottom: 2 }}>Customer</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{item.userName}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>{item.userEmail}</Text>
                  {item.userPhone ? <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>{item.userPhone}</Text> : null}
                </View>

                {/* Bank details */}
                <View style={{ backgroundColor: colors.muted, borderRadius: 10, padding: 12, gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", marginBottom: 2 }}>Bank Details</Text>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{item.bankName || "—"}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>{item.bankAccountNumber || "—"}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>{item.bankAccountTitle || "—"}</Text>
                </View>

                {/* Date */}
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                  Requested: {new Date(item.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                </Text>

                {/* Admin note if exists */}
                {item.adminNote ? (
                  <View style={{ backgroundColor: "#EF444418", borderRadius: 8, padding: 10 }}>
                    <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular" }}>Note: {item.adminNote}</Text>
                  </View>
                ) : null}

                {/* Actions — only for pending */}
                {isPending && (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, borderWidth: 1, borderRadius: 10 }]}
                      value={paymentNotes[item.id] ?? ""}
                      onChangeText={(v) => setPaymentNotes(prev => ({ ...prev, [item.id]: v }))}
                      placeholder="Admin note (optional)"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 11 }}
                        onPress={() => {
                          hapticSelection();
                          setUpdatingPaymentId(item.id);
                          updatePaymentRequest({ id: item.id, data: { status: "paid", adminNote: paymentNotes[item.id] || undefined } });
                        }}
                        disabled={isUpdating}
                        activeOpacity={0.85}
                      >
                        {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                          <><Feather name="check" size={14} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" }}>Mark as Paid</Text></>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#EF444418", borderColor: "#EF444444", borderWidth: 1, borderRadius: 10, paddingVertical: 11 }}
                        onPress={() => confirmAction(
                          "Reject Request",
                          "Reject this payment request? Points will be returned to the user.",
                          () => {
                            hapticSelection();
                            setUpdatingPaymentId(item.id);
                            updatePaymentRequest({ id: item.id, data: { status: "rejected", adminNote: paymentNotes[item.id] || undefined } });
                          }
                        )}
                        disabled={isUpdating}
                        activeOpacity={0.85}
                      >
                        <Feather name="x" size={14} color="#EF4444" />
                        <Text style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_700Bold" }}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Working Sites Tab ── */}
      {tab === "sites" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={sites ?? []}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + 100, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingSites} onRefresh={refetchSites} tintColor="#0F766E" />}
            ListHeaderComponent={
              <View style={{ paddingTop: 12, paddingBottom: 4 }}>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: "#0F766E18", borderColor: "#0F766E44" }]}
                  onPress={() => { hapticSelection(); setShowAddSiteForm(v => !v); }}
                  activeOpacity={0.85}
                >
                  <Feather name={showAddSiteForm ? "minus" : "plus"} size={15} color="#0F766E" />
                  <Text style={[styles.addBtnText, { color: "#0F766E" }]}>{showAddSiteForm ? "Cancel" : "Add Working Site"}</Text>
                </TouchableOpacity>

                {showAddSiteForm && (
                  <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.foreground }]}>New Working Site</Text>
                    {[
                      { label: "Site Name *", value: siteName, setter: setSiteName, placeholder: "e.g. Gulberg Commercial" },
                      { label: "Address *", value: siteAddress, setter: setSiteAddress, placeholder: "Full address" },
                      { label: "City *", value: siteCity, setter: setSiteCity, placeholder: "e.g. Lahore" },
                      { label: "Client Name *", value: siteClientName, setter: setSiteClientName, placeholder: "Client / company name" },
                      { label: "Client Phone *", value: siteClientPhone, setter: setSiteClientPhone, placeholder: "03001234567", keyboardType: "phone-pad" as const },
                      { label: "Notes", value: siteNotes, setter: setSiteNotes, placeholder: "Optional notes" },
                    ].map(f => (
                      <View key={f.label} style={{ marginBottom: 10 }}>
                        <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                          value={f.value}
                          onChangeText={f.setter}
                          placeholder={f.placeholder}
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType={f.keyboardType}
                        />
                      </View>
                    ))}
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Assign Technicians</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4 }}>
                        {(technicians ?? []).filter(t => t.status === "active").map(tech => {
                          const picked = (siteTechPick["__new__"] ?? []).includes(tech.id);
                          return (
                            <TouchableOpacity
                              key={tech.id}
                              style={[styles.techPill, picked && styles.techPillActive, { borderColor: picked ? colors.secondary : colors.border }]}
                              onPress={() => {
                                hapticSelection();
                                setSiteTechPick(prev => {
                                  const cur = prev["__new__"] ?? [];
                                  return { ...prev, "__new__": picked ? cur.filter(id => id !== tech.id) : [...cur, tech.id] };
                                });
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.techPillDot, { backgroundColor: picked ? colors.secondary : colors.mutedForeground }]} />
                              <Text style={[styles.techPillText, { color: picked ? colors.secondary : colors.foreground }]}>{tech.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: "#0F766E", opacity: savingNewSite ? 0.7 : 1 }]}
                      onPress={() => {
                        if (!siteName || !siteAddress || !siteCity || !siteClientName || !siteClientPhone) {
                          Alert.alert("Missing fields", "Please fill all required fields"); return;
                        }
                        setSavingNewSite(true);
                        createSite({ data: { name: siteName, address: siteAddress, city: siteCity, clientName: siteClientName, clientPhone: siteClientPhone, notes: siteNotes || undefined, technicianIds: siteTechPick["__new__"] ?? [] } });
                      }}
                      disabled={savingNewSite}
                      activeOpacity={0.85}
                    >
                      {savingNewSite ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="check" size={15} color="#fff" />}
                      <Text style={styles.saveBtnText}>{savingNewSite ? "Creating…" : "Create Site"}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="map-pin" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No working sites yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const sc = SITE_STATUS_COLORS[item.status] ?? "#64748B";
              const statusLabel = SITE_STATUS_LABELS[item.status] ?? item.status;
              const expanded = siteExpandedId === item.id;
              const assignedTechs = (technicians ?? []).filter(t => item.technicianIds.includes(t.id));
              const pickedIds: string[] = siteTechPick[item.id] ?? item.technicianIds;
              return (
                <TouchableOpacity
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => { hapticSelection(); setSiteExpandedId(prev => prev === item.id ? null : item.id); setSiteTechPick(prev => ({ ...prev, [item.id]: prev[item.id] ?? [...item.technicianIds] })); }}
                  activeOpacity={0.9}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                      <Feather name="map-pin" size={18} color={sc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.clientName} · {item.clientPhone}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.address}, {item.city}</Text>
                      {assignedTechs.length > 0 && (
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                          Techs: {assignedTechs.map(t => t.name).join(", ")}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                        <View style={[styles.statusDot, { backgroundColor: sc }]} />
                        <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                      </View>
                      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                    </View>
                  </View>

                  {expanded && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                      {item.notes ? (
                        <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 10, lineHeight: 18 }]}>{item.notes}</Text>
                      ) : null}

                      {/* Technician assignment */}
                      <Text style={[styles.formLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Assign Technicians</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: "row", gap: 6, paddingVertical: 2 }}>
                          {(technicians ?? []).filter(t => t.status === "active").map(tech => {
                            const picked = pickedIds.includes(tech.id);
                            return (
                              <TouchableOpacity
                                key={tech.id}
                                style={[styles.techPill, picked && styles.techPillActive, { borderColor: picked ? colors.secondary : colors.border }]}
                                onPress={e => { e.stopPropagation?.(); hapticSelection(); setSiteTechPick(prev => { const cur = prev[item.id] ?? [...item.technicianIds]; return { ...prev, [item.id]: picked ? cur.filter(id => id !== tech.id) : [...cur, tech.id] }; }); }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.techPillDot, { backgroundColor: picked ? colors.secondary : colors.mutedForeground }]} />
                                <Text style={[styles.techPillText, { color: picked ? colors.secondary : colors.foreground }]}>{tech.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                      <TouchableOpacity
                        style={[styles.actionBtn, { flexDirection: "row", justifyContent: "center", backgroundColor: colors.secondary + "18", borderColor: colors.secondary + "44", borderWidth: 1, marginBottom: 10 }]}
                        onPress={e => { e.stopPropagation?.(); setSiteAssigning(prev => ({ ...prev, [item.id]: true })); assignSiteTechs({ id: item.id, data: { technicianIds: pickedIds } }); }}
                        disabled={siteAssigning[item.id]}
                        activeOpacity={0.85}
                      >
                        {siteAssigning[item.id] ? <ActivityIndicator size="small" color={colors.secondary} /> : <Feather name="users" size={13} color={colors.secondary} />}
                        <Text style={[styles.actionBtnText, { color: colors.secondary }]}>Save Technicians</Text>
                      </TouchableOpacity>

                      {/* Status change */}
                      <Text style={[styles.formLabel, { color: colors.mutedForeground, marginBottom: 6 }]}>Change Status</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {(["active", "in_progress", "completed", "closed", "cancelled"] as const).filter(s => s !== item.status).map(s => {
                          const c = SITE_STATUS_COLORS[s] ?? "#64748B";
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[styles.actionBtn, { flexDirection: "row", backgroundColor: c + "18", borderColor: c + "44", borderWidth: 1 }]}
                              onPress={e => { e.stopPropagation?.(); setSiteStatusSaving(prev => ({ ...prev, [item.id]: true })); updateSiteStatus({ id: item.id, data: { status: s } }); }}
                              disabled={siteStatusSaving[item.id]}
                              activeOpacity={0.85}
                            >
                              <View style={[styles.statusDot, { backgroundColor: c }]} />
                              <Text style={[styles.actionBtnText, { color: c }]}>{SITE_STATUS_LABELS[s]}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Delete */}
                      <TouchableOpacity
                        style={[styles.actionBtn, { flexDirection: "row", justifyContent: "center", backgroundColor: "#EF444418", borderColor: "#EF444444", borderWidth: 1 }]}
                        onPress={e => { e.stopPropagation?.(); confirmAction("Delete Site", `Delete "${item.name}"? This cannot be undone.`, () => deleteSiteById({ id: item.id })); }}
                        activeOpacity={0.85}
                      >
                        <Feather name="trash-2" size={13} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete Site</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* ── Site Visits Tab ── */}
      {tab === "siteVisits" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={adminSiteVisits ?? []}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + 100, gap: 12 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingSiteVisits} onRefresh={refetchSiteVisits} tintColor="#7C3AED" />}
            ListHeaderComponent={
              <View style={{ paddingTop: 12, paddingBottom: 4 }}>
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED44" }]}
                  onPress={() => { hapticSelection(); setShowAddSvForm(v => !v); }}
                  activeOpacity={0.85}
                >
                  <Feather name={showAddSvForm ? "minus" : "plus"} size={15} color="#7C3AED" />
                  <Text style={[styles.addBtnText, { color: "#7C3AED" }]}>{showAddSvForm ? "Cancel" : "New Site Visit"}</Text>
                </TouchableOpacity>

                {showAddSvForm && (
                  <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.formTitle, { color: colors.foreground }]}>New Site Visit Request</Text>
                    {([
                      { label: "Customer Name *", value: svCustomerName, setter: setSvCustomerName, placeholder: "Full name" },
                      { label: "Phone *", value: svPhone, setter: setSvPhone, placeholder: "03001234567", keyboardType: "phone-pad" as const },
                      { label: "Address *", value: svAddress, setter: setSvAddress, placeholder: "Street address" },
                      { label: "City", value: svCity, setter: setSvCity, placeholder: "e.g. Lahore" },
                      { label: "Purpose *", value: svPurpose, setter: setSvPurpose, placeholder: "e.g. Site survey, inspection" },
                      { label: "Notes", value: svNotes, setter: setSvNotes, placeholder: "Optional notes" },
                      { label: "Scheduled Date", value: svScheduledDate, setter: setSvScheduledDate, placeholder: "YYYY-MM-DD" },
                      { label: "Scheduled Time", value: svScheduledTime, setter: setSvScheduledTime, placeholder: "e.g. 10:00 AM" },
                    ] as { label: string; value: string; setter: (v: string) => void; placeholder: string; keyboardType?: "default" | "phone-pad" }[]).map(f => (
                      <View key={f.label} style={{ marginBottom: 10 }}>
                        <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                          value={f.value} onChangeText={f.setter}
                          placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground}
                          keyboardType={f.keyboardType ?? "default"}
                        />
                      </View>
                    ))}
                    <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Assign Technician</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => setSvAssignedTo("")}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: svAssignedTo === "" ? "#7C3AED" : colors.background, borderWidth: 1, borderColor: svAssignedTo === "" ? "#7C3AED" : colors.border }}
                        >
                          <Text style={{ color: svAssignedTo === "" ? "#fff" : colors.foreground, fontSize: 12 }}>Unassigned</Text>
                        </TouchableOpacity>
                        {(technicians ?? []).map(t => (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setSvAssignedTo(t.id)}
                            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: svAssignedTo === t.id ? "#7C3AED" : colors.background, borderWidth: 1, borderColor: svAssignedTo === t.id ? "#7C3AED" : colors.border }}
                          >
                            <Text style={{ color: svAssignedTo === t.id ? "#fff" : colors.foreground, fontSize: 12 }}>{t.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: "#7C3AED", opacity: savingNewSv ? 0.7 : 1 }]}
                      disabled={savingNewSv}
                      onPress={async () => {
                        if (!svCustomerName.trim() || !svPhone.trim() || !svAddress.trim() || !svPurpose.trim()) {
                          Alert.alert("Required", "Fill in Customer Name, Phone, Address, and Purpose"); return;
                        }
                        setSavingNewSv(true);
                        try {
                          await createSiteVisitAsync({ data: { customerName: svCustomerName.trim(), phone: svPhone.trim(), address: svAddress.trim(), city: svCity.trim() || undefined, purpose: svPurpose.trim(), notes: svNotes.trim() || undefined, assignedTo: svAssignedTo || undefined, scheduledDate: svScheduledDate.trim() || undefined, scheduledTime: svScheduledTime.trim() || undefined } });
                          hapticNotify(Haptics.NotificationFeedbackType.Success);
                          setSvCustomerName(""); setSvPhone(""); setSvAddress(""); setSvCity("");
                          setSvPurpose(""); setSvNotes(""); setSvAssignedTo("");
                          setSvScheduledDate(""); setSvScheduledTime("");
                          setShowAddSvForm(false);
                          refetchSiteVisits();
                        } catch (err: any) {
                          Alert.alert("Error", err?.data?.error ?? err?.message ?? "Could not create visit");
                        } finally {
                          setSavingNewSv(false);
                        }
                      }}
                    >
                      {savingNewSv ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Create Site Visit</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="navigation" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No site visits yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const VISIT_STATUS_COLORS: Record<string, string> = { pending: "#F59E0B", in_progress: "#8B5CF6", completed: "#10B981", cancelled: "#EF4444" };
              const VISIT_STATUS_LABELS: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
              const sc = VISIT_STATUS_COLORS[item.status] ?? "#64748B";
              const isEditing = svEditId === item.id;
              return (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.cardTop}
                    onPress={() => {
                      hapticSelection();
                      if (isEditing) { setSvEditId(null); } else {
                        setSvEditId(item.id);
                        setSvEditStatus(item.status);
                        setSvEditTechNotes(item.technicianNotes ?? "");
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                      <Feather name="navigation" size={18} color={sc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customerName}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.phone} · {item.city ?? item.address}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Purpose: {item.purpose}</Text>
                      {item.technicianName ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Technician: {item.technicianName}</Text> : null}
                      {item.scheduledDate ? <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.scheduledDate}{item.scheduledTime ? ` · ${item.scheduledTime}` : ""}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={[styles.statusBadge, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
                        <View style={[styles.statusDot, { backgroundColor: sc }]} />
                        <Text style={[styles.statusBadgeText, { color: sc }]}>{VISIT_STATUS_LABELS[item.status] ?? item.status}</Text>
                      </View>
                      <Feather name={isEditing ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>

                  {isEditing && (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Status</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {(["pending", "in_progress", "completed", "cancelled"] as const).map(s => (
                            <TouchableOpacity
                              key={s}
                              onPress={() => setSvEditStatus(s)}
                              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: svEditStatus === s ? (VISIT_STATUS_COLORS[s] ?? "#64748B") : colors.background, borderWidth: 1, borderColor: svEditStatus === s ? (VISIT_STATUS_COLORS[s] ?? "#64748B") : colors.border }}
                            >
                              <Text style={{ color: svEditStatus === s ? "#fff" : colors.foreground, fontSize: 11 }}>{VISIT_STATUS_LABELS[s]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                      <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Technician Notes</Text>
                      <TextInput
                        style={[styles.formInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, minHeight: 60 }]}
                        value={svEditTechNotes} onChangeText={setSvEditTechNotes}
                        placeholder="Optional notes from technician" placeholderTextColor={colors.mutedForeground}
                        multiline
                      />
                      {/* Multi-Technician Assignment for Site Visit */}
                      {(() => {
                        const currentIds = svMultiPick[item.id] !== undefined ? svMultiPick[item.id] : (item.technicianIds ?? []);
                        const isSaving = svMultiAssigning[item.id] ?? false;
                        return (
                          <View style={{ gap: 6 }}>
                            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Assign Technicians</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techPickerRow}>
                              {(technicians ?? []).filter(t => t.status === "active").map((t) => {
                                const sel = currentIds.includes(t.id);
                                return (
                                  <TouchableOpacity
                                    key={t.id}
                                    style={[styles.techPill, { backgroundColor: sel ? "#7C3AED" : colors.muted, borderColor: sel ? "#7C3AED" : colors.border }]}
                                    onPress={() => {
                                      hapticSelection();
                                      const next = sel ? currentIds.filter(id => id !== t.id) : [...currentIds, t.id];
                                      setSvMultiPick(prev => ({ ...prev, [item.id]: next }));
                                    }}
                                  >
                                    <Feather name={sel ? "check" : "user"} size={11} color={sel ? "#FFFFFF" : colors.mutedForeground} />
                                    <Text style={[styles.techPillText, { color: sel ? "#FFFFFF" : colors.foreground }]}>{t.name}{t.specialty ? ` · ${t.specialty}` : ""}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                            <TouchableOpacity
                              style={[styles.techSaveBtn, { backgroundColor: isSaving ? colors.mutedForeground : "#7C3AED", alignSelf: "flex-start", marginBottom: 4 }]}
                              disabled={isSaving}
                              onPress={() => {
                                setSvMultiAssigning(prev => ({ ...prev, [item.id]: true }));
                                assignSvTechs({ id: item.id, data: { technicianIds: currentIds } });
                              }}
                              activeOpacity={0.85}
                            >
                              {isSaving
                                ? <ActivityIndicator size="small" color="#FFFFFF" />
                                : <><Feather name="users" size={13} color="#FFFFFF" /><Text style={styles.techSaveBtnText}>Save Technicians ({currentIds.length})</Text></>
                              }
                            </TouchableOpacity>
                          </View>
                        );
                      })()}

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.saveBtn, { flex: 1, backgroundColor: "#7C3AED", opacity: savingSvEdit ? 0.7 : 1 }]}
                          disabled={savingSvEdit}
                          onPress={async () => {
                            setSavingSvEdit(true);
                            try {
                              await updateSiteVisitAsync({ id: item.id, data: { status: svEditStatus, technicianNotes: svEditTechNotes || undefined } });
                              hapticNotify(Haptics.NotificationFeedbackType.Success);
                              setSvEditId(null);
                              refetchSiteVisits();
                            } catch (err: any) {
                              Alert.alert("Error", err?.data?.error ?? err?.message ?? "Could not update visit");
                            } finally {
                              setSavingSvEdit(false);
                            }
                          }}
                        >
                          {savingSvEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#EF444418", borderColor: "#EF444444" }]}
                          onPress={() => confirmAction("Delete Site Visit", "This cannot be undone.", async () => {
                            try { await deleteSiteVisitAsync({ id: item.id }); hapticNotify(Haptics.NotificationFeedbackType.Success); refetchSiteVisits(); }
                            catch { Alert.alert("Error", "Could not delete visit"); }
                          }, "Delete", true)}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Attendance Tab ── */}
      {tab === "attendance" && (
        <View style={{ flex: 1 }}>
          {/* Filters */}
          <View style={[{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 12, gap: 8 }]}>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={[{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 8 }]}>
                <Text style={[styles.formLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, paddingVertical: 2 }]}
                  value={attendanceDateFilter}
                  onChangeText={setAttendanceDateFilter}
                  placeholder={new Date().toISOString().split("T")[0]}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <TouchableOpacity
                style={[{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary, justifyContent: "center" }]}
                onPress={() => refetchAttendance()}
                activeOpacity={0.85}
              >
                <Feather name="search" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              {attendanceDateFilter ? (
                <TouchableOpacity
                  style={[{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: "center" }]}
                  onPress={() => { setAttendanceDateFilter(""); setAttendanceTechFilter(""); }}
                  activeOpacity={0.85}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[{ label: "Today", val: new Date().toISOString().split("T")[0] }, {
                  label: "Yesterday", val: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })()
                }].map(opt => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: attendanceDateFilter === opt.val ? colors.secondary : colors.border, backgroundColor: attendanceDateFilter === opt.val ? colors.secondary + "18" : "transparent" }]}
                    onPress={() => { hapticSelection(); setAttendanceDateFilter(opt.val); }}
                  >
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_500Medium", color: attendanceDateFilter === opt.val ? colors.secondary : colors.mutedForeground }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          {/* Add Manual Entry button */}
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#10B98118", borderWidth: 1, borderColor: "#10B98144" }}
              onPress={() => { hapticSelection(); setShowAddManual(true); }}
              activeOpacity={0.85}
            >
              <Feather name="plus-circle" size={14} color="#10B981" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#10B981" }}>Add Manual Entry</Text>
            </TouchableOpacity>
          </View>
          {/* Absent Today Banner */}
          {absentToday && absentToday.length > 0 && (
            <View style={{ backgroundColor: "#FEF2F2", borderBottomWidth: 1, borderBottomColor: "#FECACA", paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Feather name="user-x" size={14} color="#DC2626" />
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#DC2626" }}>
                  Absent Today ({absentToday.length})
                </Text>
              </View>
              {absentToday.map(t => (
                <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#DC2626" }} />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#7F1D1D" }}>{t.name}</Text>
                  {t.phone ? (
                    <TouchableOpacity
                      onPress={() => {
                        const phone = t.phone!.replace(/\D/g, "");
                        const msg = encodeURIComponent("Reminder: You have not checked in today. Please check in or contact your supervisor.");
                        Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#25D36618", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}
                      activeOpacity={0.8}
                    >
                      <Feather name="message-circle" size={11} color="#25D366" />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#25D366" }}>WhatsApp</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          <FlatList
            data={attendanceRecords ?? []}
            keyExtractor={item => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingAttendance} onRefresh={() => { refetchAttendance(); refetchAbsentToday(); }} tintColor={colors.secondary} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Feather name="clock" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No attendance records found</Text>
              </View>
            }
            renderItem={({ item }) => {
              const lateColor = item.isLate ? "#F59E0B" : "#10B981";
              const lateLabel = item.isLate ? "Late" : "On Time";
              const checkInTime = new Date(item.checkInAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
              const checkOutTime = item.checkOutAt ? new Date(item.checkOutAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true }) : null;
              const dateLabel = new Date(item.checkInAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardTop}>
                    <View style={[styles.iconWrap, { backgroundColor: lateColor + "18" }]}>
                      <Feather name="clock" size={18} color={lateColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 2 }]}>{item.technicianName}</Text>
                      <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 1 }]}>{dateLabel}</Text>
                      <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 1 }]}>
                        In: {checkInTime}{checkOutTime ? `  ·  Out: ${checkOutTime}` : "  ·  Not checked out"}
                      </Text>
                      {item.totalHours != null ? (
                        <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>
                          {item.totalHours.toFixed(1)} hrs{item.overtimeHours && item.overtimeHours > 0 ? `  ·  OT: ${item.overtimeHours.toFixed(1)} hrs` : ""}
                        </Text>
                      ) : null}
                      {item.locationAddress ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            const lat = item.latitude;
                            const lng = item.longitude;
                            const url = lat && lng
                              ? `https://maps.google.com/?q=${lat},${lng}`
                              : `https://maps.google.com/?q=${encodeURIComponent(item.locationAddress ?? "")}`;
                            Linking.openURL(url);
                          }}
                        >
                          <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#0891B2", textDecorationLine: "underline" }]} numberOfLines={2}>📍 {item.locationAddress}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View style={[{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: lateColor + "44", backgroundColor: lateColor + "18" }]}>
                      <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: lateColor }]} />
                      <Text style={[{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: lateColor }]}>{lateLabel}</Text>
                    </View>
                  </View>
                  {(item.selfieUrl || item.sitePhotoUrl) && (
                    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 12 }}>
                      {item.selfieUrl ? (
                        <View style={{ alignItems: "center", gap: 4 }}>
                          <Image source={{ uri: photoUrl(item.selfieUrl) ?? undefined }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                          <Text style={[{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }]}>Selfie</Text>
                        </View>
                      ) : null}
                      {item.sitePhotoUrl ? (
                        <View style={{ alignItems: "center", gap: 4 }}>
                          <Image source={{ uri: photoUrl(item.sitePhotoUrl) ?? undefined }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                          <Text style={[{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }]}>Site</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Edit button */}
                  <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#0891B218", borderColor: "#0891B244" }]}
                      onPress={() => {
                        hapticSelection();
                        setEditRecord({ id: item.id, checkInAt: item.checkInAt, checkOutAt: item.checkOutAt ?? null });
                        setEditCheckIn(fmtForEdit(item.checkInAt));
                        setEditCheckOut(fmtForEdit(item.checkOutAt ?? null));
                      }}
                      activeOpacity={0.85}
                    >
                      <Feather name="edit-2" size={13} color="#0891B2" />
                      <Text style={[styles.actionBtnText, { color: "#0891B2" }]}>Edit Times</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Edit Attendance Modal ── */}
      <Modal visible={!!editRecord} animationType="slide" transparent onRequestClose={() => setEditRecord(null)}>
        <View style={{ flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Edit Attendance Times</Text>
              <TouchableOpacity onPress={() => setEditRecord(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Format: YYYY-MM-DD HH:MM (24-hour, e.g. 2025-06-10 08:30)
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>Check-In Time *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={editCheckIn}
                onChangeText={setEditCheckIn}
                placeholder="2025-06-10 08:30"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[styles.formLabel, { color: colors.foreground }]}>Check-Out Time (leave blank to clear)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={editCheckOut}
                onChangeText={setEditCheckOut}
                placeholder="2025-06-10 17:00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: colors.secondary, borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
              activeOpacity={0.85}
              disabled={editSaving}
              onPress={() => {
                const ciISO = parseEditDT(editCheckIn);
                if (!ciISO) { Alert.alert("Invalid", "Check-in time is required and must be in format YYYY-MM-DD HH:MM"); return; }
                const coISO = editCheckOut.trim() ? parseEditDT(editCheckOut) : null;
                if (editCheckOut.trim() && !coISO) { Alert.alert("Invalid", "Check-out time format is invalid (use YYYY-MM-DD HH:MM)"); return; }
                setEditSaving(true);
                adminUpdateAttendanceMutate({ id: editRecord!.id, data: { checkInAt: ciISO, checkOutAt: coISO } });
              }}
            >
              {editSaving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="save" size={16} color="#fff" />}
              <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add Manual Attendance Modal ── */}
      <Modal visible={showAddManual} animationType="slide" transparent onRequestClose={() => setShowAddManual(false)}>
        <View style={{ flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ justifyContent: "flex-end", flexGrow: 1 }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Add Manual Entry</Text>
                <TouchableOpacity onPress={() => setShowAddManual(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Technician picker */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Technician *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(technicians ?? []).map(t => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => { hapticSelection(); setManualTechId(t.id); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: manualTechId === t.id ? colors.secondary : colors.border, backgroundColor: manualTechId === t.id ? colors.secondary + "18" : "transparent" }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: manualTechId === t.id ? colors.secondary : colors.mutedForeground }}>{t.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: -8 }}>
                Date: YYYY-MM-DD · Times: HH:MM (24-hour)
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Date *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={manualDate}
                    onChangeText={setManualDate}
                    placeholder="2025-06-10"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Check-In *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={manualCheckIn}
                    onChangeText={setManualCheckIn}
                    placeholder="09:00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Check-Out</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={manualCheckOut}
                    onChangeText={setManualCheckOut}
                    placeholder="17:00 (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={manualNotes}
                  onChangeText={setManualNotes}
                  placeholder="e.g. Manual entry — technician forgot to check in"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <TouchableOpacity
                style={{ backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: manualSaving ? 0.7 : 1 }}
                activeOpacity={0.85}
                disabled={manualSaving}
                onPress={() => {
                  if (!manualTechId) { Alert.alert("Required", "Please select a technician."); return; }
                  if (!manualDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert("Invalid", "Date must be YYYY-MM-DD (e.g. 2025-06-10)"); return; }
                  if (!manualCheckIn.match(/^\d{2}:\d{2}$/)) { Alert.alert("Invalid", "Check-in time must be HH:MM (e.g. 09:00)"); return; }
                  if (manualCheckOut && !manualCheckOut.match(/^\d{2}:\d{2}$/)) { Alert.alert("Invalid", "Check-out time must be HH:MM (e.g. 17:00)"); return; }
                  const ciISO = parseEditDT(`${manualDate} ${manualCheckIn}`);
                  if (!ciISO) { Alert.alert("Invalid", "Invalid check-in date/time."); return; }
                  const coISO = manualCheckOut ? parseEditDT(`${manualDate} ${manualCheckOut}`) : null;
                  if (manualCheckOut && !coISO) { Alert.alert("Invalid", "Invalid check-out date/time."); return; }
                  setManualSaving(true);
                  adminAddManualMutate({ data: { technicianId: manualTechId, checkInAt: ciISO, checkOutAt: coISO, notes: manualNotes || null } });
                }}
              >
                {manualSaving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={16} color="#fff" />}
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Add Entry</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Reports Tab ── */}
      {tab === "reports" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.settingsContent, { paddingBottom: bottomPad + 40 }]}
          refreshControl={<RefreshControl refreshing={refetchingReport} onRefresh={refetchReport} tintColor={colors.secondary} />}
        >
          <Text style={[styles.settingsSection, { color: colors.secondary }]}>Technician Performance Report</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Select a technician and date range, then view stats or download the Excel report.
          </Text>

          {/* Technician picker */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: colors.secondary + "18" }]}>
              <Feather name="user" size={18} color={colors.secondary} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Technician</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(technicians ?? []).map(tech => (
                    <TouchableOpacity
                      key={tech.id}
                      style={[styles.techPill, {
                        borderColor: reportTechId === tech.id ? colors.secondary : colors.border,
                        backgroundColor: reportTechId === tech.id ? colors.secondary + "18" : colors.muted,
                      }]}
                      onPress={() => { hapticSelection(); setReportTechId(tech.id); }}
                    >
                      <Text style={[styles.techPillText, { color: reportTechId === tech.id ? colors.secondary : colors.foreground }]}>{tech.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {(technicians ?? []).length === 0 && (
                <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>No technicians registered</Text>
              )}
            </View>
          </View>

          {/* Date range */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#0A5A9C18" }]}>
              <Feather name="calendar" size={18} color="#0A5A9C" />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Date Range</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>From</Text>
                  <TextInput
                    style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={reportFrom}
                    onChangeText={setReportFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>To</Text>
                  <TextInput
                    style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={reportTo}
                    onChangeText={setReportTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              {/* Quick range buttons */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  { label: "This Month", fn: () => {
                    const d = new Date();
                    setReportFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`);
                    setReportTo(d.toISOString().split("T")[0]);
                  }},
                  { label: "Last Month", fn: () => {
                    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
                    const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0);
                    setReportFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`);
                    setReportTo(lastDay.toISOString().split("T")[0]);
                  }},
                ].map(btn => (
                  <TouchableOpacity
                    key={btn.label}
                    style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => { hapticSelection(); btn.fn(); }}
                  >
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Load report button */}
          {reportTechId ? (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.secondary }]}
              onPress={() => refetchReport()}
              disabled={refetchingReport}
              activeOpacity={0.85}
            >
              {refetchingReport
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <><Feather name="bar-chart-2" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Load Report</Text></>
              }
            </TouchableOpacity>
          ) : null}

          {/* Report stats */}
          {techReport && reportFetched && (
            <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column", gap: 12 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.secondary + "18" }]}>
                  <Feather name="user" size={18} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }]}>{techReport.technicianName}</Text>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }]}>{techReport.from} → {techReport.to}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Working Days", value: techReport.totalDays, color: colors.secondary },
                  { label: "Present", value: techReport.presentDays, color: "#10B981" },
                  { label: "Absent", value: techReport.absentDays ?? (techReport.totalDays - techReport.presentDays), color: "#EF4444" },
                  { label: "Late", value: techReport.lateDays, color: "#F59E0B" },
                  { label: "Total Hours", value: `${techReport.totalHours.toFixed(1)}h`, color: "#8B5CF6" },
                  { label: "Overtime", value: `${techReport.overtimeHours.toFixed(1)}h`, color: "#F59E0B" },
                  { label: "Bookings Done", value: techReport.bookingsCompleted, color: "#10B981" },
                  { label: "Sites Done", value: techReport.sitesCompleted, color: "#0891B2" },
                  { label: "Complaints", value: techReport.complaintsHandled, color: "#DC2626" },
                ].map(stat => (
                  <View key={stat.label} style={[{ flex: 1, minWidth: 90, borderRadius: 12, padding: 10, backgroundColor: stat.color + "12", borderWidth: 1, borderColor: stat.color + "30", alignItems: "center" }]}>
                    <Text style={[{ fontSize: 20, fontFamily: "Inter_700Bold", color: stat.color }]}>{stat.value}</Text>
                    <Text style={[{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Download buttons row */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                {/* Download Excel */}
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: "#10B981", opacity: reportDownloading ? 0.7 : 1 }]}
                  onPress={async () => {
                    try {
                      setReportDownloading(true);
                      const apiBase = Platform.OS === "web"
                        ? `${window.location.origin}/api`
                        : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}/api`;
                      const url = `${apiBase}/reports/technician/download?technicianId=${encodeURIComponent(reportTechId)}&from=${encodeURIComponent(reportFrom)}&to=${encodeURIComponent(reportTo)}`;
                      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
                      if (!resp.ok) throw new Error("Download failed");
                      const blob = await resp.blob();
                      if (Platform.OS === "web") {
                        const anchor = document.createElement("a");
                        anchor.href = URL.createObjectURL(blob);
                        anchor.download = `report-${techReport.technicianName.replace(/\s+/g,"-")}-${reportFrom}.xlsx`;
                        anchor.click();
                      } else {
                        Alert.alert("Downloaded", "Excel report downloaded successfully.");
                      }
                    } catch {
                      Alert.alert("Error", "Could not download report.");
                    } finally {
                      setReportDownloading(false);
                    }
                  }}
                  disabled={reportDownloading}
                  activeOpacity={0.85}
                >
                  {reportDownloading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <><Feather name="file-text" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Excel</Text></>
                  }
                </TouchableOpacity>

                {/* Download PDF */}
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: "#DC2626", opacity: reportDownloading ? 0.7 : 1 }]}
                  onPress={async () => {
                    try {
                      setReportDownloading(true);
                      const apiBase = Platform.OS === "web"
                        ? `${window.location.origin}/api`
                        : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}/api`;
                      const params = new URLSearchParams({
                        technicianId: reportTechId,
                        from: reportFrom,
                        to: reportTo,
                      });
                      if (Platform.OS === "web") {
                        const url = `${apiBase}/reports/technician/download-pdf?${params}`;
                        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
                        if (!resp.ok) throw new Error("Download failed");
                        const blob = await resp.blob();
                        const anchor = document.createElement("a");
                        anchor.href = URL.createObjectURL(blob);
                        anchor.download = `report-${techReport.technicianName.replace(/\s+/g,"-")}-${reportFrom}.pdf`;
                        anchor.click();
                      } else {
                        params.set("token", token ?? "");
                        const url = `${apiBase}/reports/technician/download-pdf?${params}`;
                        await Linking.openURL(url);
                      }
                    } catch {
                      Alert.alert("Error", "Could not open PDF report.");
                    } finally {
                      setReportDownloading(false);
                    }
                  }}
                  disabled={reportDownloading}
                  activeOpacity={0.85}
                >
                  {reportDownloading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <><Feather name="file" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>PDF</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!reportTechId && (
            <View style={styles.emptyState}>
              <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Select a technician to view report</Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === "settings" && (
        <ScrollView contentContainerStyle={[styles.settingsContent, { paddingBottom: bottomPad + 40 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.settingsSection, { color: colors.secondary }]}>WhatsApp Contact Numbers</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            These numbers open in WhatsApp when customers tap the relevant buttons.
            Use international format without + (e.g. 923001234567).
          </Text>

          {/* Booking WhatsApp */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#25D36622" }]}>
              <Feather name="calendar" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Booking WhatsApp Number</Text>
              <TextInput
                style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={bookingWA}
                onChangeText={setBookingWA}
                placeholder="e.g. 923001234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#25D366" }]}
                onPress={() => { setSavingBookingWA(true); updateSetting({ key: "whatsapp_booking", data: { value: bookingWA.trim() } }); }}
                disabled={savingBookingWA}
                activeOpacity={0.85}
              >
                {savingBookingWA ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save Booking Number</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Complaint WhatsApp */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#25D36622" }]}>
              <Feather name="alert-circle" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Complaint WhatsApp Number</Text>
              <TextInput
                style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={complaintWA}
                onChangeText={setComplaintWA}
                placeholder="e.g. 923001234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#25D366" }]}
                onPress={() => { setSavingComplaintWA(true); updateSetting({ key: "whatsapp_complaint", data: { value: complaintWA.trim() } }); }}
                disabled={savingComplaintWA}
                activeOpacity={0.85}
              >
                {savingComplaintWA ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save Complaint Number</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Installation WhatsApp */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#25D36622" }]}>
              <Feather name="tool" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Installation WhatsApp Number</Text>
              <TextInput
                style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={installationWA}
                onChangeText={setInstallationWA}
                placeholder="e.g. 923001234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#25D366" }]}
                onPress={() => { setSavingInstallationWA(true); updateSetting({ key: "whatsapp_installation", data: { value: installationWA.trim() } }); }}
                disabled={savingInstallationWA}
                activeOpacity={0.85}
              >
                {savingInstallationWA ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save Installation Number</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Support WhatsApp */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#25D36622" }]}>
              <Feather name="message-circle" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Support WhatsApp Number</Text>
              <TextInput
                style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={supportWA}
                onChangeText={setSupportWA}
                placeholder="e.g. 923001234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#25D366" }]}
                onPress={() => { setSavingSupportWA(true); updateSetting({ key: "whatsapp_support", data: { value: supportWA.trim() } }); }}
                disabled={savingSupportWA}
                activeOpacity={0.85}
              >
                {savingSupportWA ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save Support Number</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {/* AI Support Chat */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#25D36622" }]}>
              <Feather name="cpu" size={18} color="#25D366" />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>AI Support Chat Button</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  Show floating button on Home
                </Text>
                <Switch
                  value={aiSupportEnabled}
                  onValueChange={(val) => {
                    setAiSupportEnabled(val);
                    setSavingAiSupportEnabled(true);
                    updateSetting({ key: "ai_support_enabled", data: { value: val ? "true" : "false" } });
                  }}
                  disabled={savingAiSupportEnabled}
                  trackColor={{ false: "#E2E8F0", true: "#25D366" }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TextInput
                style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={aiSupportNumber}
                onChangeText={setAiSupportNumber}
                placeholder="e.g. 923001234567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#25D366" }]}
                onPress={() => { setSavingAiSupportNumber(true); updateSetting({ key: "whatsapp_ai_support", data: { value: aiSupportNumber.trim() } }); }}
                disabled={savingAiSupportNumber}
                activeOpacity={0.85}
              >
                {savingAiSupportNumber ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save AI Support Number</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Social Links */}
          <Text style={[styles.settingsSection, { color: colors.secondary, marginTop: 8 }]}>Social Media Links</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Paste full URLs (e.g. https://instagram.com/yourpage). Leave blank to hide that link.
          </Text>

          {[
            { key: "social_instagram", label: "Instagram", icon: "instagram" as const, color: "#E1306C", val: socialInstagram, setVal: setSocialInstagram, saving: savingSocialInstagram, setSaving: setSavingSocialInstagram },
            { key: "social_facebook", label: "Facebook", icon: "facebook-f" as const, color: "#1877F2", val: socialFacebook, setVal: setSocialFacebook, saving: savingSocialFacebook, setSaving: setSavingSocialFacebook },
            { key: "social_tiktok", label: "TikTok", icon: "tiktok" as const, color: "#010101", val: socialTiktok, setVal: setSocialTiktok, saving: savingSocialTiktok, setSaving: setSavingSocialTiktok },
            { key: "social_linkedin", label: "LinkedIn", icon: "linkedin-in" as const, color: "#0A66C2", val: socialLinkedin, setVal: setSocialLinkedin, saving: savingSocialLinkedin, setSaving: setSavingSocialLinkedin },
            { key: "social_youtube", label: "YouTube", icon: "youtube" as const, color: "#FF0000", val: socialYoutube, setVal: setSocialYoutube, saving: savingSocialYoutube, setSaving: setSavingSocialYoutube },
            { key: "social_website", label: "Website", icon: "globe" as const, color: "#6366F1", val: socialWebsite, setVal: setSocialWebsite, saving: savingSocialWebsite, setSaving: setSavingSocialWebsite },
          ].map(({ key, label, icon, color, val, setVal, saving, setSaving }) => (
            <View key={key} style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.settingIconWrap, { backgroundColor: color + "22" }]}>
                <FontAwesome5 name={icon} size={18} color={color} />
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label} URL</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={val}
                  onChangeText={setVal}
                  placeholder={`https://${label.toLowerCase()}.com/yourpage`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: color }]}
                  onPress={() => { setSaving(true); updateSetting({ key, data: { value: val.trim() } }); }}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <><FontAwesome5 name="save" size={13} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save {label}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Contact Info */}
          <Text style={[styles.settingsSection, { color: colors.secondary, marginTop: 8 }]}>Contact Us Information</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Displayed on the app's Contact Us section for customers.
          </Text>

          {[
            { key: "contact_phone", label: "Phone Number", icon: "phone" as const, val: contactPhone, setVal: setContactPhone, saving: savingContactPhone, setSaving: setSavingContactPhone, kbd: "phone-pad" as const },
            { key: "contact_email", label: "Email Address", icon: "mail" as const, val: contactEmail, setVal: setContactEmail, saving: savingContactEmail, setSaving: setSavingContactEmail, kbd: "email-address" as const },
            { key: "contact_address", label: "Office Address", icon: "map-pin" as const, val: contactAddress, setVal: setContactAddress, saving: savingContactAddress, setSaving: setSavingContactAddress, kbd: "default" as const },
            { key: "contact_hours", label: "Business Hours", icon: "clock" as const, val: contactHours, setVal: setContactHours, saving: savingContactHours, setSaving: setSavingContactHours, kbd: "default" as const },
          ].map(({ key, label, icon, val, setVal, saving, setSaving, kbd }) => (
            <View key={key} style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "18" }]}>
                <Feather name={icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={val}
                  onChangeText={setVal}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType={kbd}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { setSaving(true); updateSetting({ key, data: { value: val.trim() } }); }}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save {label}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Referral System */}
          <Text style={[styles.settingsSection, { color: "#10B981", marginTop: 8 }]}>Referral System</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Customers earn points when friends register using their code. Set the value per point to define cashback.
          </Text>

          {/* Toggle ON/OFF */}
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center" }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#10B98118" }]}>
              <Feather name="gift" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Referral System</Text>
              <Text style={[styles.settingsHint, { color: colors.mutedForeground, marginBottom: 0 }]}>
                {referralEnabled ? "System is ON — customers can earn points" : "System is OFF — no points awarded"}
              </Text>
            </View>
            {savingReferralEnabled ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Switch
                value={referralEnabled}
                onValueChange={(val) => {
                  setReferralEnabled(val);
                  setSavingReferralEnabled(true);
                  updateSetting({ key: "referral_enabled", data: { value: val ? "true" : "false" } });
                }}
                trackColor={{ false: colors.border, true: "#10B981" }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>

          {/* Points per referral + Money per point */}
          {[
            {
              key: "referral_points_per_referral",
              label: "Points Per Referral",
              icon: "star" as const,
              val: referralPointsPerRef,
              setVal: setReferralPointsPerRef,
              saving: savingReferralPoints,
              setSaving: setSavingReferralPoints,
              hint: "Points awarded to referrer when someone registers with their code",
              kbd: "number-pad" as const,
            },
            {
              key: "referral_money_per_point",
              label: "PKR Per Point",
              icon: "dollar-sign" as const,
              val: referralMoneyPerPoint,
              setVal: setReferralMoneyPerPoint,
              saving: savingReferralMoney,
              setSaving: setSavingReferralMoney,
              hint: "How many PKR each point is worth (shown to customers as their balance)",
              kbd: "number-pad" as const,
            },
          ].map(({ key, label, icon, val, setVal, saving, setSaving, hint, kbd }) => (
            <View key={key} style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.settingIconWrap, { backgroundColor: "#10B98118" }]}>
                <Feather name={icon} size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.settingsHint, { color: colors.mutedForeground, marginBottom: 0 }]}>{hint}</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={val}
                  onChangeText={setVal}
                  keyboardType={kbd}
                  placeholder="e.g. 10"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#10B981" }]}
                  onPress={() => { setSaving(true); updateSetting({ key, data: { value: val.trim() || "0" } }); }}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save {label}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Attendance Timing */}
          <Text style={[styles.settingsSection, { color: "#0891B2", marginTop: 8 }]}>Attendance Timing</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Controls check-in deadline (late threshold), shift end time (overtime threshold), and when the daily absent-technician alert email is sent.
          </Text>

          {[
            {
              key: "attendance_checkin_deadline",
              label: "Check-in Deadline",
              icon: "log-in" as const,
              hint: "Technicians checking in after this time are marked Late",
              val: checkinDeadline,
              setVal: setCheckinDeadline,
              saving: savingCheckinDeadline,
              setSaving: setSavingCheckinDeadline,
            },
            {
              key: "attendance_shift_end",
              label: "Shift End Time",
              icon: "log-out" as const,
              hint: "Check-outs after this time count as Overtime",
              val: shiftEnd,
              setVal: setShiftEnd,
              saving: savingShiftEnd,
              setSaving: setSavingShiftEnd,
            },
            {
              key: "attendance_absent_alert_time",
              label: "Absent Alert Time",
              icon: "bell" as const,
              hint: "Time of day (HH:MM) when the daily absent-technician email is sent to admin",
              val: absentAlertTime,
              setVal: setAbsentAlertTime,
              saving: savingAbsentAlertTime,
              setSaving: setSavingAbsentAlertTime,
            },
          ].map(({ key, label, icon, hint, val, setVal, saving, setSaving }) => (
            <View key={key} style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.settingIconWrap, { backgroundColor: "#0891B218" }]}>
                <Feather name={icon} size={18} color="#0891B2" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.settingsHint, { color: colors.mutedForeground, marginBottom: 0 }]}>{hint}</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={val}
                  onChangeText={setVal}
                  placeholder="HH:MM (e.g. 08:00)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#0891B2" }]}
                  onPress={() => {
                    const trimmed = val.trim();
                    if (!/^\d{2}:\d{2}$/.test(trimmed)) {
                      Alert.alert("Invalid Time", "Please enter a valid time in HH:MM format (e.g. 08:00)");
                      return;
                    }
                    setSaving(true);
                    updateSetting({ key, data: { value: trimmed } });
                  }}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save {label}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Timezone */}
          <Text style={[styles.settingsSection, { color: "#0891B2", marginTop: 8 }]}>Timezone</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Server timezone offset (UTC+X). Pakistan = 5, India = 5.5, Bangladesh = 6. Used for attendance day boundaries and absent alerts.
          </Text>
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#0891B218" }]}>
              <Feather name="globe" size={18} color="#0891B2" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>UTC Offset (Hours)</Text>
              <Text style={[styles.settingsHint, { color: colors.mutedForeground, marginBottom: 0 }]}>
                Enter decimal hours: 5 = UTC+5 (Pakistan), 5.5 = UTC+5:30 (India), 6 = UTC+6
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {[
                    { label: "+4", val: "4" },
                    { label: "+4:30", val: "4.5" },
                    { label: "+5 (PK)", val: "5" },
                    { label: "+5:30 (IN)", val: "5.5" },
                    { label: "+5:45 (NP)", val: "5.75" },
                    { label: "+6", val: "6" },
                  ].map(opt => (
                    <TouchableOpacity
                      key={opt.val}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
                        backgroundColor: appTimezoneOffset === opt.val ? "#0891B2" : colors.muted,
                        borderColor: appTimezoneOffset === opt.val ? "#0891B2" : colors.border,
                      }}
                      onPress={() => { hapticSelection(); setAppTimezoneOffset(opt.val); }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: appTimezoneOffset === opt.val ? "#FFFFFF" : colors.foreground }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={[styles.settingInput, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginRight: 6 }}>UTC+</Text>
                <TextInput
                  style={[{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground }]}
                  value={appTimezoneOffset}
                  onChangeText={setAppTimezoneOffset}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#0891B2" }]}
                onPress={() => {
                  const v = parseFloat(appTimezoneOffset);
                  if (isNaN(v) || v < -12 || v > 14) {
                    Alert.alert("Invalid", "Please enter a valid UTC offset between -12 and +14");
                    return;
                  }
                  setSavingTimezone(true);
                  updateSetting({ key: "app_timezone_offset", data: { value: String(v) } });
                }}
                disabled={savingTimezone}
                activeOpacity={0.85}
              >
                {savingTimezone ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save Timezone</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* App Update Settings */}
          <Text style={[styles.settingsSection, { color: "#F59E0B", marginTop: 8 }]}>App Update</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Set the latest version and download URL. Users on older versions will see an update prompt on app launch.
          </Text>
          {[
            {
              key: "app_update_version",
              label: "Latest Version",
              icon: "tag" as const,
              val: appUpdateVersion,
              setVal: setAppUpdateVersion,
              saving: savingAppUpdateVersion,
              setSaving: setSavingAppUpdateVersion,
              hint: "e.g. 1.2.0 — must match the version string exactly",
              kbd: "default" as const,
            },
            {
              key: "app_update_url",
              label: "Download URL",
              icon: "download" as const,
              val: appUpdateUrl,
              setVal: setAppUpdateUrl,
              saving: savingAppUpdateUrl,
              setSaving: setSavingAppUpdateUrl,
              hint: "Direct link to APK or Play Store page",
              kbd: "url" as const,
            },
          ].map(({ key, label, icon, val, setVal, saving, setSaving, hint, kbd }) => (
            <View key={key} style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.settingIconWrap, { backgroundColor: "#F59E0B18" }]}>
                <Feather name={icon} size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.settingsHint, { color: colors.mutedForeground, marginBottom: 0 }]}>{hint}</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  value={val}
                  onChangeText={setVal}
                  keyboardType={kbd}
                  placeholder={key === "app_update_version" ? "e.g. 1.2.0" : "https://..."}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#F59E0B" }]}
                  onPress={() => { setSaving(true); updateSetting({ key, data: { value: val.trim() } }); }}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                    <><Feather name="save" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Save {label}</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Admin Password Change */}
          <Text style={[styles.settingsSection, { color: "#EF4444", marginTop: 8 }]}>Admin Password</Text>
          <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
            Change the admin account password. You'll need your current password.
          </Text>
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column" }]}>
            {[
              { label: "Current Password", val: adminCurrentPass, setVal: setAdminCurrentPass, show: showAdminCurrent, setShow: setShowAdminCurrent },
              { label: "New Password", val: adminNewPass, setVal: setAdminNewPass, show: showAdminNew, setShow: setShowAdminNew },
              { label: "Confirm New Password", val: adminConfirmPass, setVal: setAdminConfirmPass, show: showAdminNew, setShow: setShowAdminNew },
            ].map(({ label, val, setVal, show, setShow }) => (
              <View key={label} style={{ gap: 6, marginBottom: 10 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <View style={[styles.adminPassRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="lock" size={15} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.adminPassInput, { color: colors.foreground }]}
                    value={val}
                    onChangeText={setVal}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShow((v: boolean) => !v)}>
                    <Feather name={show ? "eye-off" : "eye"} size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: savingAdminPass ? colors.mutedForeground : "#EF4444" }]}
              onPress={handleAdminPasswordChange}
              disabled={savingAdminPass}
              activeOpacity={0.85}
            >
              {savingAdminPass ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <><Feather name="shield" size={15} color="#FFFFFF" /><Text style={styles.saveBtnText}>Change Admin Password</Text></>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Customer Report Modal */}
      <Modal
        visible={!!reportCustomerId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReportCustomerId(null)}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[dashStyles.backBar, { borderBottomColor: colors.border, paddingTop: 16 }]}>
            <TouchableOpacity style={dashStyles.backBtn} onPress={() => setReportCustomerId(null)} activeOpacity={0.7}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[dashStyles.backSection, { color: colors.foreground }]}>Customer Report</Text>
            {reportCustomerId && (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#7C3AED" }}
                onPress={async () => {
                  const apiBase = Platform.OS === "web"
                    ? "/api"
                    : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}/api`;
                  const url = `${apiBase}/admin/users/${reportCustomerId}/report/pdf?token=${encodeURIComponent(token ?? "")}`;
                  if (Platform.OS === "web") {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `customer-report.pdf`;
                    a.click();
                  } else {
                    await Linking.openURL(url);
                  }
                }}
                activeOpacity={0.85}
              >
                <Feather name="download" size={14} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>PDF</Text>
              </TouchableOpacity>
            )}
          </View>

          {customerReportLoading && (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={colors.secondary} />
            </View>
          )}

          {!customerReportLoading && customerReport && (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {/* User Info Card */}
              <View style={[{ borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 }, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#7C3AED22", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="user" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>{customerReport.user.name}</Text>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{customerReport.user.email}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: customerReport.user.status === "approved" ? "#10B98122" : customerReport.user.status === "pending" ? "#F5952522" : "#EF444422" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: customerReport.user.status === "approved" ? "#10B981" : customerReport.user.status === "pending" ? "#F59525" : "#EF4444", textTransform: "capitalize" }}>{customerReport.user.status}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                  {customerReport.user.phone && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Feather name="phone" size={12} color={colors.mutedForeground} /><Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{customerReport.user.phone}</Text></View>}
                  {customerReport.user.city && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Feather name="map-pin" size={12} color={colors.mutedForeground} /><Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{customerReport.user.city}</Text></View>}
                  {customerReport.user.inverterBrand && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Feather name="zap" size={12} color={colors.mutedForeground} /><Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{customerReport.user.inverterBrand}</Text></View>}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Member since {new Date(customerReport.user.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>

              {/* Stats Row */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  { label: "Bookings", value: customerReport.bookings.length, icon: "calendar", color: "#0891B2" },
                  { label: "Complaints", value: customerReport.complaints.length, icon: "alert-circle", color: "#EF4444" },
                  { label: "Warranties", value: customerReport.warranties.length, icon: "shield", color: "#1B6FA8" },
                  { label: "Quotes", value: customerReport.quotes.length, icon: "file-text", color: "#10B981" },
                  { label: "Referrals", value: customerReport.referralCount, icon: "users", color: "#7C3AED" },
                  { label: "Points", value: customerReport.user.referralPoints, icon: "star", color: "#F59525" },
                ].map((stat) => (
                  <View key={stat.label} style={{ width: "30%", minWidth: 90, flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4, backgroundColor: colors.card, borderColor: colors.border }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: stat.color + "22" }}>
                      <Feather name={stat.icon as any} size={16} color={stat.color} />
                    </View>
                    <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground }}>{stat.value}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Bookings */}
              {customerReport.bookings.length > 0 && (
                <View style={[{ borderRadius: 14, borderWidth: 1, overflow: "hidden" }, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Feather name="calendar" size={15} color="#0891B2" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>Bookings</Text>
                  </View>
                  {customerReport.bookings.map((b, idx) => (
                    <View key={b.id} style={[{ padding: 12, gap: 4 }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{b.customerName}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: b.status === "completed" ? "#10B98122" : b.status === "confirmed" ? "#0891B222" : b.status === "cancelled" ? "#EF444422" : "#F5952522" }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: b.status === "completed" ? "#10B981" : b.status === "confirmed" ? "#0891B2" : b.status === "cancelled" ? "#EF4444" : "#F59525", textTransform: "capitalize" }}>{b.status}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{b.city} · {new Date(b.preferredDate).toLocaleDateString()}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Complaints */}
              {customerReport.complaints.length > 0 && (
                <View style={[{ borderRadius: 14, borderWidth: 1, overflow: "hidden" }, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Feather name="alert-circle" size={15} color="#EF4444" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>Complaints</Text>
                  </View>
                  {customerReport.complaints.map((c, idx) => (
                    <View key={c.id} style={[{ padding: 12, gap: 4 }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1, marginRight: 8 }}>{c.subject}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: c.status === "resolved" ? "#10B98122" : c.status === "in_progress" ? "#0891B222" : "#F5952522" }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: c.status === "resolved" ? "#10B981" : c.status === "in_progress" ? "#0891B2" : "#F59525", textTransform: "capitalize" }}>{c.status.replace("_", " ")}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{new Date(c.createdAt).toLocaleDateString()}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Warranties */}
              {customerReport.warranties.length > 0 && (
                <View style={[{ borderRadius: 14, borderWidth: 1, overflow: "hidden" }, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Feather name="shield" size={15} color="#1B6FA8" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>Warranties</Text>
                  </View>
                  {customerReport.warranties.map((w, idx) => (
                    <View key={w.id} style={[{ padding: 12, gap: 4 }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{w.brand}{w.model ? ` · ${w.model}` : ""}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: w.warrantyStatus === "active" ? "#10B98122" : w.warrantyStatus === "expired" ? "#EF444422" : "#F5952522" }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: w.warrantyStatus === "active" ? "#10B981" : w.warrantyStatus === "expired" ? "#EF4444" : "#F59525", textTransform: "capitalize" }}>{w.warrantyStatus}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{w.warrantyType} · Expires {new Date(w.expiryDate).toLocaleDateString()}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Quotes */}
              {customerReport.quotes.length > 0 && (
                <View style={[{ borderRadius: 14, borderWidth: 1, overflow: "hidden" }, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Feather name="file-text" size={15} color="#10B981" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>Quotes</Text>
                  </View>
                  {customerReport.quotes.map((q, idx) => (
                    <View key={q.id} style={[{ padding: 12, gap: 4 }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{q.systemType}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: q.status === "approved" ? "#10B98122" : q.status === "rejected" ? "#EF444422" : "#F5952522" }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: q.status === "approved" ? "#10B981" : q.status === "rejected" ? "#EF4444" : "#F59525", textTransform: "capitalize" }}>{q.status}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{new Date(q.createdAt).toLocaleDateString()}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Empty state */}
              {customerReport.bookings.length === 0 && customerReport.complaints.length === 0 && customerReport.warranties.length === 0 && customerReport.quotes.length === 0 && (
                <View style={{ alignItems: "center", paddingTop: 24, gap: 8 }}>
                  <Feather name="inbox" size={36} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>No activity found for this customer</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {tab === "liveMap" && <LiveMapSection />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 12,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 2 },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular" },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  adminBadgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center", minWidth: 60 },
  statNum: { color: "#FFFFFF", fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#FFFFFFBB", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  tabScrollWrap: { borderBottomWidth: 1, maxHeight: 52 },
  tabScrollContent: { paddingHorizontal: 4, alignItems: "center", gap: 0 },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabBadge: {
    position: "absolute", top: -5, right: -8,
    minWidth: 15, height: 15, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
  },
  tabBadgeText: { color: "#FFFFFF", fontSize: 9, fontFamily: "Inter_700Bold" },
  filterRow: { paddingHorizontal: 12, gap: 8, alignItems: "center", paddingVertical: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  listContent: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  itemCard: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  cardIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  expandedSection: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, borderTopWidth: 1 },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },
  messageBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12, gap: 6 },
  messageLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  messageText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  techPickerRow: { gap: 8, paddingVertical: 4, alignItems: "center" },
  techPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  techPillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addTechBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12, marginBottom: 4,
  },
  addTechBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  techRow: { gap: 8, borderRadius: 10, borderWidth: 0, marginBottom: 8 },
  techInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
  },
  techInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  techFieldErr: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 2 },
  techSaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  techSaveBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", gap: 6, padding: 10, borderTopWidth: 1, flexWrap: "wrap" },
  actionBtn: { alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  noAccessText: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  // Users tab
  userInfoRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, gap: 12 },
  userInfoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  userInfoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userActionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, flexWrap: "wrap" },
  userActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
  },
  userActionBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  resetPassBox: { padding: 14, gap: 10, borderTopWidth: 1 },
  resetPassLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resetPassRow: {
    flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  resetPassInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  adminPassRow: {
    flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  adminPassInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  // Settings
  settingsContent: { padding: 16, gap: 12 },
  settingsSection: {
    fontSize: 12, fontFamily: "Inter_700Bold",
    letterSpacing: 1, textTransform: "uppercase", marginTop: 8,
  },
  settingsHint: {
    fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 4,
  },
  settingCard: {
    flexDirection: "row", gap: 14, borderRadius: 16, borderWidth: 1,
    padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  settingIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  settingLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  settingInput: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  // Sites tab shared
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 12 },
  formTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 14 },
  formLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  formInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontFamily: "Inter_400Regular" },
  techPillActive: { },
  techPillDot: { width: 6, height: 6, borderRadius: 3 },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center" as const, paddingTop: 60, gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const },
});

export default function AdminScreen() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return (
      <LoginPrompt
        icon="shield"
        title="Admin Panel"
        message="You need admin access to view this page."
      />
    );
  }
  return <AdminContent />;
}
