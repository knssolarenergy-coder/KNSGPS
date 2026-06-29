import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { startAlwaysOnTracking } from "@/backgroundLocationTask";
import { TrackingDiagnostics } from "@/components/TrackingDiagnostics";
import { type TrackingRequirement, type RequirementKey } from "@/hooks/useTrackingReadiness";

const AUTOSTART_INTENTS: {
  match: string[];
  pkg: string;
  cls: string;
  steps: string;
}[] = [
  {
    match: ["xiaomi", "redmi", "poco"],
    pkg: "com.miui.securitycenter",
    cls: "com.miui.permcenter.autostart.AutoStartManagementActivity",
    steps:
      "MIUI: Security app kholein → Permissions → Autostart → K&S Solar → ON karein",
  },
  {
    match: ["oppo"],
    pkg: "com.coloros.safecenter",
    cls: "com.coloros.safecenter.permission.startup.StartupAppListActivity",
    steps:
      "Oppo: Settings → Battery → App startup → K&S Solar → Manual manage → ON karein",
  },
  {
    match: ["realme"],
    pkg: "com.coloros.safecenter",
    cls: "com.coloros.safecenter.permission.startup.StartupAppListActivity",
    steps:
      "Realme: Settings → Battery → App quick freeze → K&S Solar → OFF karein (ya App startup mein ON)",
  },
  {
    match: ["vivo"],
    pkg: "com.vivo.permissionmanager",
    cls: "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
    steps:
      "Vivo: iManager app → App Manager → Autostart Management → K&S Solar → ON karein",
  },
  {
    match: ["huawei", "honor"],
    pkg: "com.huawei.systemmanager",
    cls: "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
    steps:
      "Huawei/Honor: Settings → Battery → Launch → K&S Solar → Manage Manually → Auto-launch ON karein",
  },
  {
    match: ["infinix", "tecno", "itel"],
    pkg: "com.transsion.phonemaster",
    cls: "com.transsion.phonemaster.ui.page.StartupManagerActivity",
    steps:
      "Infinix/Tecno: Phone Master app → Permission Manager → Startup → K&S Solar → ON karein",
  },
  {
    match: ["samsung"],
    pkg: "com.samsung.android.lool",
    cls: "com.samsung.android.lool.view.activity.MainActivity",
    steps:
      "Samsung: Settings → Device care → Battery → Background usage limits → Never sleeping apps mein K&S Solar add karein",
  },
];

const GENERIC_AUTOSTART_STEPS =
  'Settings → Apps → "K&S Solar" → Battery → "Unrestricted" karein, phir phone ki Security/Privacy settings mein Autostart ya Auto-launch dhundein aur ON karein.';

interface Props {
  requirements: TrackingRequirement[];
  blockingGate: boolean;
  onRefresh: () => Promise<void>;
  onConfirmGuideOnly: (key: RequirementKey) => Promise<void>;
}

export function TrackingSetupGate({
  requirements,
  blockingGate,
  onRefresh,
  onConfirmGuideOnly,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<RequirementKey | "refresh" | null>(null);
  const [manufacturer, setManufacturer] = useState("");
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    try {
      const Device = require("expo-device") as typeof import("expo-device");
      setManufacturer((Device.manufacturer ?? "").toLowerCase());
    } catch {}
  }, []);

  const autostartEntry = AUTOSTART_INTENTS.find((e) =>
    e.match.some((m) => manufacturer.includes(m))
  );
  const autostartSteps = autostartEntry?.steps ?? GENERIC_AUTOSTART_STEPS;

  const openNotifSettings = useCallback(async () => {
    try {
      const IL = require("expo-intent-launcher") as typeof import("expo-intent-launcher");
      await IL.startActivityAsync("android.settings.APP_NOTIFICATION_SETTINGS", {
        extra: { "android.provider.extra.APP_PACKAGE": "com.kssolar.app" },
      });
    } catch {
      await Linking.openSettings();
    }
  }, []);

  const handleFixNotification = useCallback(async () => {
    setBusy("notification");
    try {
      const N = require("expo-notifications") as typeof import("expo-notifications");
      let { granted, canAskAgain } = await N.getPermissionsAsync();
      if (!granted && canAskAgain) {
        ({ granted } = await N.requestPermissionsAsync());
      }
      if (!granted) {
        await openNotifSettings();
      }
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }, [onRefresh, openNotifSettings]);

  const handleFixBgLocation = useCallback(async () => {
    setBusy("backgroundLocation");
    try {
      const cur = await Location.getBackgroundPermissionsAsync();
      if (cur.status !== "granted" && cur.canAskAgain) {
        await Location.requestBackgroundPermissionsAsync();
      } else {
        await Linking.openSettings();
      }
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }, [onRefresh]);

  const handleFixService = useCallback(async () => {
    setBusy("serviceRunning");
    try {
      await startAlwaysOnTracking();
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }, [onRefresh]);

  const handleOpenBattery = useCallback(async () => {
    try {
      const IL = require("expo-intent-launcher") as typeof import("expo-intent-launcher");
      await IL.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        { data: "package:com.kssolar.app" }
      );
    } catch {
      await Linking.openSettings();
    }
  }, []);

  const handleOpenAutostart = useCallback(async () => {
    try {
      const IL = require("expo-intent-launcher") as typeof import("expo-intent-launcher");
      if (autostartEntry) {
        try {
          await IL.startActivityAsync("android.intent.action.MAIN", {
            packageName: autostartEntry.pkg,
            className: autostartEntry.cls,
          });
          return;
        } catch {}
      }
      await IL.startActivityAsync(
        "android.settings.APPLICATION_DETAILS_SETTINGS",
        { data: "package:com.kssolar.app" }
      );
    } catch {
      await Linking.openSettings();
    }
  }, [autostartEntry]);

  const handleRefresh = useCallback(async () => {
    setBusy("refresh");
    try {
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }, [onRefresh]);

  const handleConfirm = useCallback(
    async (key: RequirementKey) => {
      setBusy(key);
      try {
        await onConfirmGuideOnly(key);
      } finally {
        setBusy(null);
      }
    },
    [onConfirmGuideOnly]
  );

  const failingCount = requirements.filter(
    (r) => r.status === "fail" || (!r.isCheckable && !r.confirmed)
  ).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Feather name="alert-triangle" size={18} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Setup Zaroori Hai</Text>
          <Text style={styles.headerSub}>
            {failingCount} setting{failingCount !== 1 ? "s" : ""} baki hain —
            tracking tab tak kaam nahi karegi
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowDiag(true)}
          style={styles.headerDiagBtn}
          activeOpacity={0.82}
          accessibilityLabel="Tracking diagnostics"
        >
          <Feather name="activity" size={16} color="#0891B2" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {requirements.map((req) => {
          const passing =
            req.status === "pass" && (req.isCheckable || req.confirmed);
          const isBusy = busy === req.key;

          if (passing) {
            return (
              <View key={req.key} style={styles.cardPass}>
                <View style={styles.statusDotGreen}>
                  <Feather name="check" size={11} color="#fff" />
                </View>
                <Text style={styles.cardTitlePass}>{req.labelUrdu}</Text>
              </View>
            );
          }

          return (
            <View
              key={req.key}
              style={[
                styles.card,
                req.isCheckable ? styles.cardFail : styles.cardWarn,
              ]}
            >
              {/* Card header row */}
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: req.isCheckable
                        ? "#EF4444"
                        : "#F59E0B",
                    },
                  ]}
                >
                  <Feather
                    name={req.isCheckable ? "x" : "info"}
                    size={11}
                    color="#fff"
                  />
                </View>
                <Text style={styles.cardTitle}>{req.labelUrdu}</Text>
                {!req.isCheckable && (
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Guide</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardDesc}>{req.descUrdu}</Text>

              {/* Extra brand-specific steps */}
              {req.key === "autostart" && (
                <View style={styles.stepsBox}>
                  <Feather name="smartphone" size={12} color="#0891B2" />
                  <Text style={styles.stepsText}>{autostartSteps}</Text>
                </View>
              )}
              {req.key === "battery" && (
                <View style={styles.stepsBox}>
                  <Feather name="battery" size={12} color="#0891B2" />
                  <Text style={styles.stepsText}>
                    Settings → Apps → K&S Solar → Battery →
                    {' "Unrestricted"'} ya {'"No restriction"'} select karein
                  </Text>
                </View>
              )}
              {req.key === "recentsLock" && (
                <View style={styles.stepsBox}>
                  <Feather name="layers" size={12} color="#0891B2" />
                  <Text style={styles.stepsText}>
                    Recent Apps button (square/3-dot) dabayein → K&S Solar card
                    ko dekhein → card ke upar pin ya lock icon tap karein 📌
                  </Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                {/* Checkable: single Fix button */}
                {req.isCheckable && (
                  <TouchableOpacity
                    style={styles.btnFix}
                    onPress={
                      req.key === "notification"
                        ? handleFixNotification
                        : req.key === "backgroundLocation"
                          ? handleFixBgLocation
                          : handleFixService
                    }
                    disabled={isBusy}
                    activeOpacity={0.82}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="tool" size={13} color="#fff" />
                        <Text style={styles.btnFixText}>Fix Karein</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Guide-only: open settings + Maine kar liya */}
                {!req.isCheckable && (
                  <>
                    {(req.key === "battery" || req.key === "autostart") && (
                      <TouchableOpacity
                        style={styles.btnSettings}
                        onPress={
                          req.key === "battery"
                            ? handleOpenBattery
                            : handleOpenAutostart
                        }
                        activeOpacity={0.82}
                      >
                        <Feather name="external-link" size={13} color="#0891B2" />
                        <Text style={styles.btnSettingsText}>
                          Settings Kholein
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.btnDone}
                      onPress={() => void handleConfirm(req.key)}
                      disabled={isBusy}
                      activeOpacity={0.82}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Feather name="check" size={13} color="#fff" />
                          <Text style={styles.btnDoneText}>
                            Maine Kar Liya ✓
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Refresh button */}
        <TouchableOpacity
          style={styles.btnRefresh}
          onPress={handleRefresh}
          disabled={busy === "refresh"}
          activeOpacity={0.82}
        >
          {busy === "refresh" ? (
            <ActivityIndicator size="small" color="#0891B2" />
          ) : (
            <>
              <Feather name="refresh-cw" size={15} color="#0891B2" />
              <Text style={styles.btnRefreshText}>Dobara Check Karo</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Diagnostics — works even in this broken state so the office can see
            the exact cause and run a live test ping. */}
        <TouchableOpacity
          style={styles.btnDiag}
          onPress={() => setShowDiag(true)}
          activeOpacity={0.82}
        >
          <Feather name="activity" size={15} color="#0891B2" />
          <Text style={styles.btnRefreshText}>Tracking Test / Diagnostics</Text>
        </TouchableOpacity>

        {blockingGate && (
          <Text style={styles.blockNote}>
            Upar wali ✗ settings theek karein — phir yeh screen khud hat
            jayegi aur aap apna kaam shuru kar sakte hain.
          </Text>
        )}
      </ScrollView>

      <TrackingDiagnostics visible={showDiag} onClose={() => setShowDiag(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#92400E",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#B45309",
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  cardPass: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardTitlePass: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#166534",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardFail: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FECACA",
  },
  cardWarn: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  optionalBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  optionalText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#92400E",
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    lineHeight: 18,
  },
  stepsBox: {
    flexDirection: "row",
    gap: 7,
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
  },
  stepsText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#1E40AF",
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  btnFix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 110,
    justifyContent: "center",
  },
  btnFixText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  btnSettings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "#0891B2",
    backgroundColor: "#fff",
  },
  btnSettingsText: {
    color: "#0891B2",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  btnDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10B981",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 140,
    justifyContent: "center",
  },
  btnDoneText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusDotGreen: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  btnRefresh: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#0891B2",
    paddingVertical: 12,
    marginTop: 6,
    backgroundColor: "#fff",
  },
  btnRefreshText: {
    color: "#0891B2",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  headerDiagBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDiag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: "#F0F9FF",
  },
  blockNote: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
