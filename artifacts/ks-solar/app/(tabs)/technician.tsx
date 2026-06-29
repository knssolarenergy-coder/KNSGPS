import { Feather } from "@expo/vector-icons";
import {
  requestUploadUrl,
  useCheckIn,
  useCheckOut,
  useGetBookings,
  useGetComplaints,
  useGetMyAttendance,
  useGetSiteVisits,
  useGetSites,
  useGetTodayAttendance,
  useUpsertTechnicianLocation,
  useUpdateBookingStatus,
  useUpdateComplaint,
  useUpdateSiteVisit,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { confirmAction } from "@/utils/confirm";
import { useTrackingReadiness } from "@/hooks/useTrackingReadiness";
import { TrackingSetupGate } from "@/components/TrackingSetupGate";
import { TrackingDiagnostics } from "@/components/TrackingDiagnostics";

const hapticSelection = () => { if (Platform.OS !== "web") Haptics.selectionAsync(); };
const hapticNotify = (t: Haptics.NotificationFeedbackType) => { if (Platform.OS !== "web") Haptics.notificationAsync(t); };

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  in_progress: "#8B5CF6",
  completed: "#10B981",
  cancelled: "#EF4444",
};

const COMPLAINT_STATUS_COLORS: Record<string, string> = {
  submitted: "#3B82F6",
  in_progress: "#F59E0B",
  resolved: "#10B981",
  closed: "#64748B",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

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

type JobTab = "bookings" | "complaints" | "sites" | "siteVisits" | "attendance";

function photoUrl(objectPath: string | null | undefined): string | null {
  if (!objectPath) return null;
  const relative = objectPath.replace(/^\/objects/, "");
  const base = Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  return `${base}/api/storage/objects${relative}`;
}

async function uploadPhoto(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const { uploadURL, objectPath } = await requestUploadUrl({
    name: `photo-${Date.now()}.jpg`,
    size: blob.size,
    contentType: "image/jpeg",
  });
  await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  });
  return objectPath;
}

export default function TechnicianScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useAuth();

  const {
    requirements,
    isGateRequired,
    blockingGate,
    isLoaded: gateLoaded,
    refresh: refreshReadiness,
    confirmGuideOnly,
  } = useTrackingReadiness();

  const [jobTab, setJobTab] = useState<JobTab>("bookings");

  // Attendance state
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [sitePhotoUri, setSitePhotoUri] = useState<string | null>(null);
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: string; lng: string; address: string } | null>(null);

  const { data: bookings, refetch: refetchBookings, isRefetching: refetchingBookings } = useGetBookings();
  const { data: complaints, refetch: refetchComplaints, isRefetching: refetchingComplaints } = useGetComplaints();
  const { data: sites, refetch: refetchSites, isRefetching: refetchingSites } = useGetSites();
  const { data: techSiteVisits, refetch: refetchSiteVisits, isRefetching: refetchingSiteVisits } = useGetSiteVisits({
    query: { queryKey: ["tech-site-visits"], enabled: true },
  });
  const { data: todayData, refetch: refetchToday, isRefetching: refetchingToday } = useGetTodayAttendance({
    query: { queryKey: ["today-attendance"] },
  });
  const { data: myAttendance, refetch: refetchMyAttendance, isRefetching: refetchingMyAttendance } = useGetMyAttendance({
    query: { queryKey: ["my-attendance"], enabled: jobTab === "attendance" },
  });

  const todayRecord = todayData?.record ?? null;

  const { mutate: updateBookingStatus } = useUpdateBookingStatus({
    mutation: {
      onSuccess: () => { hapticNotify(Haptics.NotificationFeedbackType.Success); refetchBookings(); },
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.error ?? "Could not update booking status"),
    },
  });

  const { mutate: updateComplaint } = useUpdateComplaint({
    mutation: {
      onSuccess: () => { hapticNotify(Haptics.NotificationFeedbackType.Success); refetchComplaints(); },
      onError: (err: any) => Alert.alert("Error", err?.response?.data?.error ?? "Could not update complaint status"),
    },
  });

  const { mutateAsync: updateSiteVisitAsync } = useUpdateSiteVisit();

  const { mutate: doCheckIn } = useCheckIn({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setCheckInLoading(false);
        setSelfieUri(null);
        setSitePhotoUri(null);
        setAttendanceNotes("");
        setGpsCoords(null);
        refetchToday();
        refetchMyAttendance();
      },
      onError: (err: any) => {
        setCheckInLoading(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Check-in failed");
      },
    },
  });

  const { mutate: doCheckOut } = useCheckOut({
    mutation: {
      onSuccess: () => {
        hapticNotify(Haptics.NotificationFeedbackType.Success);
        setCheckOutLoading(false);
        refetchToday();
        refetchMyAttendance();
      },
      onError: (err: any) => {
        setCheckOutLoading(false);
        Alert.alert("Error", err?.response?.data?.error ?? "Check-out failed");
      },
    },
  });

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { mutate: upsertLocation } = useUpsertTechnicianLocation();

  useEffect(() => {
    if (!todayRecord || todayRecord.checkOutAt) {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      return;
    }
    async function doLocationPing() {
      try {
        if (Platform.OS === "web") {
          if (typeof navigator !== "undefined" && navigator.geolocation) {
            await new Promise<void>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  upsertLocation({ data: { latitude: pos.coords.latitude.toString(), longitude: pos.coords.longitude.toString(), address: null } });
                  resolve();
                },
                () => resolve(),
                { timeout: 8000, enableHighAccuracy: false }
              );
            });
          }
        } else {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          let address: string | null = null;
          try {
            const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (geo[0]) {
              const g = geo[0];
              address = [g.street, g.district, g.city, g.region].filter(Boolean).join(", ") || null;
            }
          } catch { }
          upsertLocation({ data: { latitude: loc.coords.latitude.toString(), longitude: loc.coords.longitude.toString(), address } });
        }
      } catch { }
    }
    doLocationPing();
    pingIntervalRef.current = setInterval(doLocationPing, 10 * 1000);
    // Resume an immediate ping when app comes back to foreground;
    // interval continues running in background (not paused).
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        doLocationPing();
      }
    });
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      appStateSub.remove();
    };
  }, [todayRecord?.id, todayRecord?.checkOutAt]);

  // Enforce location stays ON while checked in. Polls every 5 s and flips
  // locationBlocked state which shows a full-screen overlay — technician cannot
  // interact with anything until they re-enable location or check out.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!todayRecord || todayRecord.checkOutAt) {
      setLocationBlocked(false);
      return;
    }
    let cancelled = false;
    async function checkLocation() {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setLocationBlocked(!enabled || status !== "granted");
      } catch { }
    }
    checkLocation();
    const watchId = setInterval(checkLocation, 5000);
    return () => {
      cancelled = true;
      clearInterval(watchId);
      setLocationBlocked(false);
    };
  }, [todayRecord?.id, todayRecord?.checkOutAt]);

  function changeBookingStatus(id: string, status: string) {
    const label = status === "in_progress" ? "In Progress" : "Completed";
    confirmAction("Update Status", `Mark as "${label}"?`, () =>
      updateBookingStatus({ id, data: { status } })
    );
  }

  function changeComplaintStatus(id: string, status: "in_progress" | "resolved") {
    const label = status === "in_progress" ? "In Progress" : "Resolved";
    confirmAction("Update Status", `Mark as "${label}"?`, () =>
      updateComplaint({ id, data: { status } })
    );
  }

  async function captureGps() {
    setGpsLoading(true);
    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert("Not supported", "Geolocation is not supported by this browser.");
          setGpsLoading(false);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
              try {
                const geoRes = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                  { headers: { "Accept-Language": "en" } }
                );
                const geoData = await geoRes.json() as { display_name?: string };
                if (geoData.display_name) address = geoData.display_name;
              } catch { }
              setGpsCoords({ lat: latitude.toString(), lng: longitude.toString(), address });
              resolve();
            },
            () => reject(new Error("Location denied")),
            { enableHighAccuracy: false, timeout: 10000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission denied", "Location permission is required for check-in.");
          setGpsLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geo[0]) {
            const g = geo[0];
            address = [g.street, g.district, g.city, g.region].filter(Boolean).join(", ");
          }
        } catch { }
        setGpsCoords({ lat: latitude.toString(), lng: longitude.toString(), address });
      }
    } catch {
      Alert.alert("Location denied", "Please allow location access to check in.");
    }
    setGpsLoading(false);
  }

  async function pickPhoto(type: "selfie" | "site") {
    let result: ImagePicker.ImagePickerResult;
    if (Platform.OS === "web") {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });
    } else {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Camera permission is required to take photos.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });
    }
    if (!result.canceled && result.assets[0]) {
      if (type === "selfie") setSelfieUri(result.assets[0].uri);
      else setSitePhotoUri(result.assets[0].uri);
    }
  }

  async function submitCheckIn() {
    setCheckInLoading(true);
    try {
      let selfieUrl: string | undefined;
      let sitePhotoUrl: string | undefined;

      if (selfieUri) selfieUrl = await uploadPhoto(selfieUri);
      if (sitePhotoUri) sitePhotoUrl = await uploadPhoto(sitePhotoUri);

      doCheckIn({
        data: {
          selfieUrl: selfieUrl ?? null,
          sitePhotoUrl: sitePhotoUrl ?? null,
          latitude: gpsCoords?.lat ?? null,
          longitude: gpsCoords?.lng ?? null,
          locationAddress: gpsCoords?.address ?? null,
          notes: attendanceNotes.trim() || null,
        },
      });
    } catch {
      setCheckInLoading(false);
      Alert.alert("Error", "Check-in failed. Please try again.");
    }
  }

  function handleCheckIn() {
    if (!gpsCoords) {
      Alert.alert("Location required", "Please capture your GPS location before checking in.");
      return;
    }
    if (!selfieUri) {
      Alert.alert("Selfie required", "Please take a selfie before checking in.");
      return;
    }
    confirmAction(
      "Confirm Check-In",
      "Record your attendance for today?",
      () => { submitCheckIn(); },
      "Check In",
    );
  }

  function handleCheckOut() {
    if (!todayRecord) return;
    confirmAction("Check Out", "Confirm check-out for today?", () => {
      setCheckOutLoading(true);
      doCheckOut({ id: todayRecord.id });
    });
  }

  const currentRefreshing =
    jobTab === "bookings" ? refetchingBookings :
    jobTab === "complaints" ? refetchingComplaints :
    jobTab === "sites" ? refetchingSites :
    jobTab === "siteVisits" ? refetchingSiteVisits :
    refetchingToday || refetchingMyAttendance;

  const doRefetch = () => {
    if (jobTab === "bookings") refetchBookings();
    else if (jobTab === "complaints") refetchComplaints();
    else if (jobTab === "sites") refetchSites();
    else if (jobTab === "siteVisits") refetchSiteVisits();
    else { refetchToday(); refetchMyAttendance(); }
  };

  if (Platform.OS !== "web" && gateLoaded && isGateRequired) {
    return (
      <TrackingSetupGate
        requirements={requirements}
        blockingGate={blockingGate}
        onRefresh={refreshReadiness}
        onConfirmGuideOnly={confirmGuideOnly}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero Header */}
      <View style={[styles.header, {
        paddingTop: topPad + 16,
        backgroundColor: "#FFFFFF",
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 16,
        elevation: 5,
      }]}>
        {/* Top accent stripe */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: colors.secondary, borderTopLeftRadius: 0, borderTopRightRadius: 0 }} />

        {/* Top row: TECH badge | centered logo | spacer */}
        <View style={styles.headerTopRow}>
          <View style={[styles.badge, { backgroundColor: colors.secondary + "15", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 4 }]}>
            <Feather name="tool" size={13} color={colors.secondary} />
            <Text style={[styles.badgeText, { color: colors.secondary }]}>TECH</Text>
          </View>
          <View style={{
            backgroundColor: "#FFFFFF", borderRadius: 16,
            paddingHorizontal: 16, paddingVertical: 10,
            shadowColor: "#0C4A6E", shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
            borderWidth: 1.5, borderColor: "#BAE6FD",
          }}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={{ width: 120, height: 44 }}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity
            onPress={() => { hapticSelection(); setShowDiag(true); }}
            style={{
              width: 52, height: 40, borderRadius: 12,
              alignItems: "center", justifyContent: "center",
              backgroundColor: colors.secondary + "15",
            }}
            activeOpacity={0.8}
            accessibilityLabel="Tracking diagnostics"
          >
            <Feather name="activity" size={18} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={{ alignItems: "center", marginTop: 14, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <Feather name="briefcase" size={11} color={colors.secondary} />
            <Text style={{ color: colors.secondary, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.3, textTransform: "uppercase" }}>
              Technician Portal
            </Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>Welcome back,</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>
            {user?.name ?? "Technician"} 🔧
          </Text>
        </View>

        {/* Stats pills */}
        <View style={[styles.statsRow, { marginTop: 16, paddingBottom: 20 }]}>
          <View style={[styles.statPill, { backgroundColor: "#EFF6FF" }]}>
            <Text style={[styles.statNum, { color: colors.secondary }]}>{bookings?.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Bookings</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#FFF1F2" }]}>
            <Text style={[styles.statNum, { color: "#EF4444" }]}>{complaints?.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Complaints</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#ECFDF5" }]}>
            <Text style={[styles.statNum, { color: "#10B981" }]}>{sites?.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sites</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "#F5F3FF" }]}>
            <Text style={[styles.statNum, { color: "#7C3AED" }]}>{techSiteVisits?.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Visits</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        refreshControl={
          <RefreshControl refreshing={currentRefreshing} onRefresh={doRefetch} tintColor={colors.secondary} />
        }
      >
        {/* ── Service Cards Grid ── */}
        <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.svcCard, {
                backgroundColor: jobTab === "bookings" ? "#EFF6FF" : colors.card,
                borderColor: jobTab === "bookings" ? "#3B82F6" : colors.border,
              }]}
              onPress={() => { hapticSelection(); setJobTab("bookings"); }}
              activeOpacity={0.82}
            >
              <View style={[styles.svcIconWrap, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="droplet" size={22} color="#3B82F6" />
              </View>
              <Text style={[styles.svcTitle, { color: colors.foreground }]}>Bookings</Text>
              <Text style={[styles.svcCount, { color: "#3B82F6" }]}>{bookings?.length ?? 0} assigned</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.svcCard, {
                backgroundColor: jobTab === "complaints" ? "#FFF1F2" : colors.card,
                borderColor: jobTab === "complaints" ? "#EF4444" : colors.border,
              }]}
              onPress={() => { hapticSelection(); setJobTab("complaints"); }}
              activeOpacity={0.82}
            >
              <View style={[styles.svcIconWrap, { backgroundColor: "#FFE4E6" }]}>
                <Feather name="alert-circle" size={22} color="#EF4444" />
              </View>
              <Text style={[styles.svcTitle, { color: colors.foreground }]}>Complaints</Text>
              <Text style={[styles.svcCount, { color: "#EF4444" }]}>{complaints?.length ?? 0} assigned</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[styles.svcCard, {
                backgroundColor: jobTab === "sites" ? "#ECFDF5" : colors.card,
                borderColor: jobTab === "sites" ? "#10B981" : colors.border,
              }]}
              onPress={() => { hapticSelection(); setJobTab("sites"); }}
              activeOpacity={0.82}
            >
              <View style={[styles.svcIconWrap, { backgroundColor: "#D1FAE5" }]}>
                <Feather name="map-pin" size={22} color="#10B981" />
              </View>
              <Text style={[styles.svcTitle, { color: colors.foreground }]}>Sites</Text>
              <Text style={[styles.svcCount, { color: "#10B981" }]}>{sites?.length ?? 0} assigned</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.svcCard, {
                backgroundColor: jobTab === "siteVisits" ? "#F5F3FF" : colors.card,
                borderColor: jobTab === "siteVisits" ? "#7C3AED" : colors.border,
              }]}
              onPress={() => { hapticSelection(); setJobTab("siteVisits"); }}
              activeOpacity={0.82}
            >
              <View style={[styles.svcIconWrap, { backgroundColor: "#EDE9FE" }]}>
                <Feather name="navigation" size={22} color="#7C3AED" />
              </View>
              <Text style={[styles.svcTitle, { color: colors.foreground }]}>Site Visits</Text>
              <Text style={[styles.svcCount, { color: "#7C3AED" }]}>{techSiteVisits?.length ?? 0} assigned</Text>
            </TouchableOpacity>
          </View>

          {/* Attendance — full width */}
          <TouchableOpacity
            style={[styles.svcCardWide, {
              backgroundColor: jobTab === "attendance" ? (todayRecord ? "#ECFDF5" : colors.muted) : colors.card,
              borderColor: jobTab === "attendance" ? (todayRecord ? "#10B981" : colors.secondary) : colors.border,
            }]}
            onPress={() => { hapticSelection(); setJobTab("attendance"); }}
            activeOpacity={0.82}
          >
            <View style={[styles.svcIconWrap, { backgroundColor: todayRecord ? "#D1FAE5" : "#E2E8F0" }]}>
              <Feather name="clock" size={22} color={todayRecord ? "#10B981" : colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.svcTitle, { color: colors.foreground }]}>Attendance</Text>
              <Text style={[styles.svcCount, { color: todayRecord ? "#10B981" : colors.mutedForeground }]}>
                {todayRecord
                  ? todayRecord.checkOutAt
                    ? `Checked out · ${formatTime(todayRecord.checkOutAt)}`
                    : `Checked in · ${formatTime(todayRecord.checkInAt)}`
                  : "Not checked in today"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 12 }}>

          {/* Bookings */}
          {jobTab === "bookings" && (bookings ?? []).length === 0 && (
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No assigned bookings yet</Text>
            </View>
          )}
          {jobTab === "bookings" && (bookings ?? []).map(item => {
            const sc = BOOKING_STATUS_COLORS[item.status] ?? "#64748B";
            const statusLabel = item.status === "in_progress" ? "In Progress" : item.status.charAt(0).toUpperCase() + item.status.slice(1);
            const done = item.status === "completed" || item.status === "cancelled";
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ height: 4, backgroundColor: sc, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="droplet" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customerName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.phone}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "15", borderColor: sc + "55" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={[styles.infoChipsRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.city}</Text>
                  </View>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="grid" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.panelCount} panels</Text>
                  </View>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="calendar" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.preferredDate}</Text>
                  </View>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="clock" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.preferredTime}</Text>
                  </View>
                </View>
                <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
                  <Feather name="home" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  {!done && item.status !== "in_progress" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF655" }]}
                      onPress={() => changeBookingStatus(item.id, "in_progress")}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={14} color="#8B5CF6" />
                      <Text style={[styles.actionBtnText, { color: "#8B5CF6" }]}>Start Job</Text>
                    </TouchableOpacity>
                  )}
                  {!done && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#10B98115", borderColor: "#10B98155" }]}
                      onPress={() => changeBookingStatus(item.id, "completed")}
                      activeOpacity={0.85}
                    >
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Mark Done</Text>
                    </TouchableOpacity>
                  )}
                  {done && (
                    <View style={[styles.doneBadge, { backgroundColor: sc + "15" }]}>
                      <Feather name={item.status === "completed" ? "check-circle" : "x-circle"} size={14} color={sc} />
                      <Text style={[styles.actionBtnText, { color: sc }]}>{statusLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Sites */}
          {jobTab === "sites" && (sites ?? []).length === 0 && (
            <View style={styles.empty}>
              <Feather name="map-pin" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No assigned sites yet</Text>
            </View>
          )}
          {jobTab === "sites" && (sites ?? []).map(item => {
            const sc = SITE_STATUS_COLORS[item.status] ?? "#64748B";
            const statusLabel = SITE_STATUS_LABELS[item.status] ?? item.status;
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ height: 4, backgroundColor: sc, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="map-pin" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.clientName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "15", borderColor: sc + "55" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={[styles.infoChipsRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="phone" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.clientPhone}</Text>
                  </View>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.city}</Text>
                  </View>
                </View>
                <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
                  <Feather name="home" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
                </View>
                {item.notes ? (
                  <View style={[styles.notesRow, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                    <Feather name="file-text" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={2}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Site Visits */}
          {jobTab === "siteVisits" && (techSiteVisits ?? []).length === 0 && (
            <View style={styles.empty}>
              <Feather name="navigation" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No assigned site visits yet</Text>
            </View>
          )}
          {jobTab === "siteVisits" && (techSiteVisits ?? []).map(item => {
            const VISIT_COLORS: Record<string, string> = { pending: "#F59E0B", in_progress: "#8B5CF6", completed: "#10B981", cancelled: "#EF4444" };
            const VISIT_LABELS: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
            const sc = VISIT_COLORS[item.status] ?? "#64748B";
            const statusLabel = VISIT_LABELS[item.status] ?? item.status;
            const done = item.status === "completed" || item.status === "cancelled";
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ height: 4, backgroundColor: sc, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="navigation" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.customerName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.phone}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "15", borderColor: sc + "55" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={[styles.infoChipsRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.infoChip, { backgroundColor: "#7C3AED15" }]}>
                    <Feather name="tag" size={11} color="#7C3AED" />
                    <Text style={[styles.infoChipText, { color: "#7C3AED" }]}>{item.purpose}</Text>
                  </View>
                  {item.city ? (
                    <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                      <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.city}</Text>
                    </View>
                  ) : null}
                  {item.scheduledDate ? (
                    <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                      <Feather name="calendar" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{item.scheduledDate}{item.scheduledTime ? ` · ${item.scheduledTime}` : ""}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
                  <Feather name="home" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
                </View>
                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  {!done && item.status !== "in_progress" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#8B5CF615", borderColor: "#8B5CF655" }]}
                      onPress={async () => { try { await updateSiteVisitAsync({ id: item.id, data: { status: "in_progress" } }); hapticNotify(Haptics.NotificationFeedbackType.Success); refetchSiteVisits(); } catch (err: any) { Alert.alert("Error", err?.data?.error ?? err?.message ?? "Could not update"); } }}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={14} color="#8B5CF6" />
                      <Text style={[styles.actionBtnText, { color: "#8B5CF6" }]}>Start Visit</Text>
                    </TouchableOpacity>
                  )}
                  {!done && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#10B98115", borderColor: "#10B98155" }]}
                      onPress={async () => { try { await updateSiteVisitAsync({ id: item.id, data: { status: "completed" } }); hapticNotify(Haptics.NotificationFeedbackType.Success); refetchSiteVisits(); } catch (err: any) { Alert.alert("Error", err?.data?.error ?? err?.message ?? "Could not update"); } }}
                      activeOpacity={0.85}
                    >
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Mark Done</Text>
                    </TouchableOpacity>
                  )}
                  {done && (
                    <View style={[styles.doneBadge, { backgroundColor: sc + "15" }]}>
                      <Feather name={item.status === "completed" ? "check-circle" : "x-circle"} size={14} color={sc} />
                      <Text style={[styles.actionBtnText, { color: sc }]}>{statusLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Complaints */}
          {jobTab === "complaints" && (complaints ?? []).length === 0 && (
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No assigned complaints yet</Text>
            </View>
          )}
          {jobTab === "complaints" && (complaints ?? []).map(item => {
            const sc = COMPLAINT_STATUS_COLORS[item.status] ?? "#64748B";
            const statusLabel = item.status === "in_progress" ? "In Progress" : item.status.charAt(0).toUpperCase() + item.status.slice(1);
            const done = item.status === "resolved" || item.status === "closed";
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ height: 4, backgroundColor: sc, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: sc + "18" }]}>
                    <Feather name="alert-circle" size={18} color={sc} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.subject}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.customerName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "15", borderColor: sc + "55" }]}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.statusBadgeText, { color: sc }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={[styles.infoChipsRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                    <Feather name="calendar" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{formatDate(item.createdAt)}</Text>
                  </View>
                  {item.address ? (
                    <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                      <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.infoChipText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.messageBox, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                  <Text style={[styles.messageText, { color: colors.mutedForeground }]} numberOfLines={3}>{item.message}</Text>
                </View>
                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  {!done && item.status !== "in_progress" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B55" }]}
                      onPress={() => changeComplaintStatus(item.id, "in_progress")}
                      activeOpacity={0.85}
                    >
                      <Feather name="play" size={14} color="#F59E0B" />
                      <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>Start Work</Text>
                    </TouchableOpacity>
                  )}
                  {!done && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#10B98115", borderColor: "#10B98155" }]}
                      onPress={() => changeComplaintStatus(item.id, "resolved")}
                      activeOpacity={0.85}
                    >
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <Text style={[styles.actionBtnText, { color: "#10B981" }]}>Mark Resolved</Text>
                    </TouchableOpacity>
                  )}
                  {done && (
                    <View style={[styles.doneBadge, { backgroundColor: sc + "15" }]}>
                      <Feather name="check-circle" size={14} color={sc} />
                      <Text style={[styles.actionBtnText, { color: sc }]}>{statusLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Attendance */}
          {jobTab === "attendance" && (
          <>
          {/* Today status card */}
          {todayRecord ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardTop, { alignItems: "center" }]}>
                <View style={[styles.iconWrap, { backgroundColor: "#10B98118" }]}>
                  <Feather name="check-circle" size={18} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Attendance</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    Check-in: {formatTime(todayRecord.checkInAt)}
                    {todayRecord.isLate ? "  ⚠️ Late" : "  ✅ On Time"}
                  </Text>
                  {todayRecord.checkOutAt ? (
                    <Text style={[styles.cardSub, { color: "#10B981" }]}>
                      Check-out: {formatTime(todayRecord.checkOutAt)}
                      {todayRecord.totalHours != null ? `  ·  ${todayRecord.totalHours.toFixed(1)} hrs` : ""}
                    </Text>
                  ) : (
                    <Text style={[styles.cardSub, { color: "#F59E0B" }]}>Still checked in</Text>
                  )}
                  {todayRecord.locationAddress ? (
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      📍 {todayRecord.locationAddress}
                    </Text>
                  ) : null}
                  {!todayRecord.checkOutAt && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: "#10B981" }}>Location sharing active</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Photos row */}
              {(todayRecord.selfieUrl || todayRecord.sitePhotoUrl) && (
                <View style={attStyles.photosRow}>
                  {todayRecord.selfieUrl ? (
                    <View style={attStyles.photoWrap}>
                      <Image source={{ uri: photoUrl(todayRecord.selfieUrl) ?? undefined }} style={attStyles.photo} />
                      <Text style={[attStyles.photoLabel, { color: colors.mutedForeground }]}>Selfie</Text>
                    </View>
                  ) : null}
                  {todayRecord.sitePhotoUrl ? (
                    <View style={attStyles.photoWrap}>
                      <Image source={{ uri: photoUrl(todayRecord.sitePhotoUrl) ?? undefined }} style={attStyles.photo} />
                      <Text style={[attStyles.photoLabel, { color: colors.mutedForeground }]}>Site</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Check out button */}
              {!todayRecord.checkOutAt && (
                <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: "#EF444418", borderColor: "#EF444444" }]}
                    onPress={handleCheckOut}
                    disabled={checkOutLoading}
                    activeOpacity={0.85}
                  >
                    {checkOutLoading
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : <>
                        <Feather name="log-out" size={13} color="#EF4444" />
                        <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Check Out</Text>
                      </>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* Check-in form */
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={attStyles.formHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.secondary + "18" }]}>
                  <Feather name="clock" size={18} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Check In Today</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Record your attendance</Text>
                </View>
              </View>

              <View style={attStyles.formBody}>
                {/* GPS */}
                <TouchableOpacity
                  style={[attStyles.gpsBtn, {
                    borderColor: gpsCoords ? "#10B98166" : colors.border,
                    backgroundColor: gpsCoords ? "#10B98110" : colors.muted,
                  }]}
                  onPress={captureGps}
                  disabled={gpsLoading}
                  activeOpacity={0.85}
                >
                  {gpsLoading
                    ? <ActivityIndicator size="small" color={colors.secondary} />
                    : <Feather name="map-pin" size={16} color={gpsCoords ? "#10B981" : colors.secondary} />
                  }
                  <Text style={[attStyles.gpsBtnText, { color: gpsCoords ? "#10B981" : colors.secondary }]}>
                    {gpsCoords ? gpsCoords.address.slice(0, 50) + (gpsCoords.address.length > 50 ? "…" : "") : "Capture GPS Location"}
                  </Text>
                </TouchableOpacity>

                {/* Photo buttons */}
                <View style={attStyles.photoRow}>
                  <TouchableOpacity
                    style={[attStyles.photoPickBtn, {
                      borderColor: selfieUri ? "#10B98166" : colors.border,
                      backgroundColor: selfieUri ? "#10B98110" : colors.muted,
                      flex: 1,
                    }]}
                    onPress={() => pickPhoto("selfie")}
                    activeOpacity={0.85}
                  >
                    {selfieUri
                      ? <Image source={{ uri: selfieUri }} style={attStyles.photoThumb} />
                      : <Feather name="camera" size={16} color={colors.secondary} />
                    }
                    <Text style={[attStyles.photoPickText, { color: selfieUri ? "#10B981" : colors.secondary }]}>
                      {selfieUri ? "Selfie ✓" : "Selfie"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[attStyles.photoPickBtn, {
                      borderColor: sitePhotoUri ? "#10B98166" : colors.border,
                      backgroundColor: sitePhotoUri ? "#10B98110" : colors.muted,
                      flex: 1,
                    }]}
                    onPress={() => pickPhoto("site")}
                    activeOpacity={0.85}
                  >
                    {sitePhotoUri
                      ? <Image source={{ uri: sitePhotoUri }} style={attStyles.photoThumb} />
                      : <Feather name="image" size={16} color={colors.secondary} />
                    }
                    <Text style={[attStyles.photoPickText, { color: sitePhotoUri ? "#10B981" : colors.secondary }]}>
                      {sitePhotoUri ? "Site ✓" : "Site Photo"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Notes */}
                <View style={[attStyles.notesWrap, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                  <TextInput
                    style={[attStyles.notesInput, { color: colors.foreground }]}
                    value={attendanceNotes}
                    onChangeText={setAttendanceNotes}
                    placeholder="Notes (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Required fields hint */}
                {(!gpsCoords || !selfieUri) && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", marginBottom: 6, fontFamily: "Inter_400Regular" }}>
                    {!gpsCoords && !selfieUri ? "📍 Location + 📷 Selfie required" : !gpsCoords ? "📍 Location required" : "📷 Selfie required"}
                  </Text>
                )}

                {/* Check in button */}
                <TouchableOpacity
                  style={[attStyles.checkInBtn, { backgroundColor: colors.secondary, opacity: (checkInLoading || !gpsCoords || !selfieUri) ? 0.5 : 1 }]}
                  onPress={handleCheckIn}
                  disabled={checkInLoading || !gpsCoords || !selfieUri}
                  activeOpacity={0.85}
                >
                  {checkInLoading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <>
                      <Feather name="log-in" size={16} color="#FFFFFF" />
                      <Text style={attStyles.checkInBtnText}>Check In</Text>
                    </>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Attendance History */}
          {(myAttendance ?? []).length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={[attStyles.historyTitle, { color: colors.foreground }]}>Recent Attendance</Text>
              {(myAttendance ?? []).slice(0, 20).map(rec => {
                const lateColor = rec.isLate ? "#F59E0B" : "#10B981";
                const lateLabel = rec.isLate ? "Late" : "On Time";
                return (
                  <View key={rec.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 10 }]}>
                    <View style={{ height: 4, backgroundColor: lateColor, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
                    <View style={styles.cardTop}>
                      <View style={[styles.iconWrap, { backgroundColor: lateColor + "18" }]}>
                        <Feather name="clock" size={18} color={lateColor} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{formatDate(rec.checkInAt)}</Text>
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                          In: {formatTime(rec.checkInAt)}
                          {rec.checkOutAt ? `  ·  Out: ${formatTime(rec.checkOutAt)}` : "  ·  Not checked out"}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: lateColor + "15", borderColor: lateColor + "55" }]}>
                        <View style={[styles.statusDot, { backgroundColor: lateColor }]} />
                        <Text style={[styles.statusBadgeText, { color: lateColor }]}>{lateLabel}</Text>
                      </View>
                    </View>
                    <View style={[styles.infoChipsRow, { borderTopColor: colors.border }]}>
                      {rec.totalHours != null && (
                        <View style={[styles.infoChip, { backgroundColor: colors.muted }]}>
                          <Feather name="clock" size={11} color={colors.mutedForeground} />
                          <Text style={[styles.infoChipText, { color: colors.mutedForeground }]}>{rec.totalHours.toFixed(1)} hrs</Text>
                        </View>
                      )}
                      {rec.overtimeHours != null && rec.overtimeHours > 0 && (
                        <View style={[styles.infoChip, { backgroundColor: "#F59E0B15" }]}>
                          <Feather name="zap" size={11} color="#F59E0B" />
                          <Text style={[styles.infoChipText, { color: "#F59E0B" }]}>OT {rec.overtimeHours.toFixed(1)} hrs</Text>
                        </View>
                      )}
                    </View>
                    {rec.locationAddress ? (
                      <View style={[styles.addressRow, { borderTopColor: colors.border }]}>
                        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.addressText, { color: colors.mutedForeground }]} numberOfLines={1}>{rec.locationAddress}</Text>
                      </View>
                    ) : null}
                    {(rec.selfieUrl || rec.sitePhotoUrl) && (
                      <View style={[attStyles.photosRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                        {rec.selfieUrl ? (
                          <View style={attStyles.photoWrap}>
                            <Image source={{ uri: photoUrl(rec.selfieUrl) ?? undefined }} style={attStyles.photo} />
                            <Text style={[attStyles.photoLabel, { color: colors.mutedForeground }]}>Selfie</Text>
                          </View>
                        ) : null}
                        {rec.sitePhotoUrl ? (
                          <View style={attStyles.photoWrap}>
                            <Image source={{ uri: photoUrl(rec.sitePhotoUrl) ?? undefined }} style={attStyles.photo} />
                            <Text style={[attStyles.photoLabel, { color: colors.mutedForeground }]}>Site</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {(myAttendance ?? []).length === 0 && !refetchingMyAttendance && (
            <View style={styles.empty}>
              <Feather name="clock" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No attendance records yet</Text>
            </View>
          )}
          </>
          )}

        </View>
      </ScrollView>

      {/* Full-screen location block — shown when technician is checked in but
          location services / permission is off. Modal covers tab bar too. */}
      <Modal
        visible={locationBlocked}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", padding: 32 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 28 }}>
            <Feather name="lock" size={40} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 24, fontFamily: "Inter_700Bold", color: "#1E293B", textAlign: "center", marginBottom: 12 }}>
            Location Band Hai!
          </Text>
          <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 24, marginBottom: 36 }}>
            {"Aap check-in ke doran location off nahi kar sakte.\n\nCheck-out karne tak location ON rakhna zaroori hai — warna aapki tracking ruk jaati hai."}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{ backgroundColor: "#0C4A6E", borderRadius: 14, paddingVertical: 16, width: "100%", alignItems: "center" }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" }}>Settings Mein Jayen</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 20, fontFamily: "Inter_400Regular" }}>
            Location on karte hi yeh screen khud band ho jaegi
          </Text>
        </View>
      </Modal>

      <TrackingDiagnostics visible={showDiag} onClose={() => setShowDiag(false)} />

    </View>
  );
}

const attStyles = StyleSheet.create({
  formHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingBottom: 0 },
  formBody: { padding: 14, gap: 10 },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  gpsBtnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  photoRow: { flexDirection: "row", gap: 10 },
  photoPickBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10,
  },
  photoPickText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  photoThumb: { width: 24, height: 24, borderRadius: 4 },
  notesWrap: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  notesInput: { fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 44 },
  checkInBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 4,
  },
  checkInBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  photosRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 12 },
  photoWrap: { alignItems: "center", gap: 4 },
  photo: { width: 70, height: 70, borderRadius: 8 },
  photoLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  historyTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 10 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 2 },
  headerSub: { color: "#FFFFFFCC", fontSize: 13, fontFamily: "Inter_400Regular" },
  welcomeBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { color: "#FFFFFFBB", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  doneBadge: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  infoChipsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1,
  },
  infoChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  infoChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  addressRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1,
  },
  addressText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  notesRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1,
  },
  messageBox: {
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1,
  },
  messageText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  svcCard: {
    flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  svcCardWide: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  svcIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  svcTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  svcCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
