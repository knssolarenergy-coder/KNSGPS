import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  getTrackingDiagnostics,
  sendTestPing,
  startAlwaysOnTracking,
  type TestPingResult,
  type TrackingDiagnostics as Diagnostics,
} from "@/backgroundLocationTask";
import { requestIgnoreBatteryOptimizations } from "@/modules/battery-optimization";
import { useColors } from "@/hooks/useColors";

function ageLabel(ts: number): string {
  if (!ts) return "never";
  const ms = Date.now() - ts;
  if (ms < 0) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

type RowState = "good" | "bad" | "warn" | "neutral";

function StatusRow({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: RowState;
}) {
  const colors = useColors();
  const color =
    state === "good" ? "#10B981" : state === "bad" ? "#EF4444" : state === "warn" ? "#F59E0B" : colors.mutedForeground;
  const icon =
    state === "good" ? "check-circle" : state === "bad" ? "x-circle" : state === "warn" ? "alert-circle" : "info";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <Feather name={icon as any} size={15} color={color} />
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, flexShrink: 1 }}>
          {label}
        </Text>
      </View>
      <Text
        style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color, maxWidth: "55%", textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}

export function TrackingDiagnostics({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [notifPerm, setNotifPerm] = useState<string>("unknown");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [testResult, setTestResult] = useState<TestPingResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, n] = await Promise.all([
        getTrackingDiagnostics(),
        Platform.OS === "web"
          ? Promise.resolve({ status: "n/a" })
          : Notifications.getPermissionsAsync().catch(() => ({ status: "unknown" })),
      ]);
      setDiag(d);
      setNotifPerm((n as { status: string }).status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setTestResult(null);
      load();
    }
  }, [visible, load]);

  const onTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await sendTestPing();
      setTestResult(r);
      await load();
    } finally {
      setTesting(false);
    }
  }, [load]);

  const onRestart = useCallback(async () => {
    setRestarting(true);
    try {
      await startAlwaysOnTracking();
      await load();
    } finally {
      setRestarting(false);
    }
  }, [load]);

  // Reliable manual fallback for the Doze whitelist grant — fires the system
  // "ignore battery optimizations" dialog directly, for when the automatic prompt
  // on tracking-start was missed or blocked by the OEM. This is the #1 cause of
  // tracking dying minutes after the screen turns off on budget Android phones.
  const onFixBattery = useCallback(async () => {
    setFixing(true);
    try {
      await requestIgnoreBatteryOptimizations();
      await load();
    } finally {
      setFixing(false);
    }
  }, [load]);

  const bgGood = diag?.backgroundPermission === "granted";
  const fgGood = diag?.foregroundPermission === "granted";
  const version = Constants.expoConfig?.version ?? "?";
  const buildCode = Constants.expoConfig?.android?.versionCode ?? "?";
  const device =
    Platform.OS === "web"
      ? "web"
      : `${Device.manufacturer ?? "?"} ${Device.modelName ?? ""} · Android ${Device.osVersion ?? "?"}`.trim();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: "90%",
            paddingBottom: 28,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="activity" size={18} color="#0891B2" />
              <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                Tracking Diagnostics
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 18 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Overall banner */}
            {diag && (
              <View
                style={{
                  backgroundColor: diag.alive ? "#10B98114" : "#EF444414",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Feather
                  name={diag.alive ? "check-circle" : "alert-triangle"}
                  size={20}
                  color={diag.alive ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: diag.alive ? "#047857" : "#B91C1C",
                  }}
                >
                  {diag.alive
                    ? "Tracking is active and sending your location."
                    : "Tracking is NOT active. Tap “Send test ping” below to find the exact problem."}
                </Text>
              </View>
            )}

            {/* The single most important fix hint */}
            {diag && fgGood && !bgGood && (
              <View
                style={{
                  backgroundColor: "#F59E0B14",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#B45309", marginBottom: 4 }}>
                  Location set to “While using the app”
                </Text>
                <Text style={{ fontSize: 12.5, fontFamily: "Inter_400Regular", color: "#92400E", lineHeight: 18 }}>
                  Background tracking needs “Allow all the time”. Open settings → Permissions → Location → choose
                  “Allow all the time”.
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openSettings()}
                  style={{
                    marginTop: 10,
                    backgroundColor: "#F59E0B",
                    borderRadius: 9,
                    paddingVertical: 9,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Open app settings</Text>
                </TouchableOpacity>
              </View>
            )}

            {loading && !diag ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <ActivityIndicator color="#0891B2" />
              </View>
            ) : diag ? (
              <View>
                <StatusRow
                  label="Location permission"
                  value={diag.foregroundPermission}
                  state={fgGood ? "good" : "bad"}
                />
                <StatusRow
                  label="Background (Allow all the time)"
                  value={bgGood ? "granted" : diag.backgroundPermission}
                  state={bgGood ? "good" : "bad"}
                />
                <StatusRow
                  label="Notifications"
                  value={notifPerm}
                  state={notifPerm === "granted" ? "good" : "warn"}
                />
                <StatusRow
                  label="Battery optimization (Doze)"
                  value={
                    diag.dozeWhitelisted === null
                      ? "unknown"
                      : diag.dozeWhitelisted
                        ? "OFF (whitelisted)"
                        : "ON (restricted)"
                  }
                  state={
                    diag.dozeWhitelisted === null
                      ? "warn"
                      : diag.dozeWhitelisted
                        ? "good"
                        : "bad"
                  }
                />
                <StatusRow label="Phone GPS / location" value={diag.gpsEnabled ? "ON" : "OFF"} state={diag.gpsEnabled ? "good" : "bad"} />
                <StatusRow label="Logged in (token)" value={diag.tokenPresent ? "yes" : "no"} state={diag.tokenPresent ? "good" : "bad"} />
                <StatusRow
                  label="Service registered"
                  value={diag.registered ? "yes" : "no"}
                  state={diag.registered ? "good" : "bad"}
                />
                <StatusRow
                  label="Service alive"
                  value={diag.alive ? "yes" : "no"}
                  state={diag.alive ? "good" : "bad"}
                />
                <StatusRow label="Last GPS fix" value={ageLabel(diag.lastFixTs)} state={diag.lastFixTs ? "neutral" : "warn"} />
                <StatusRow label="Last started" value={ageLabel(diag.startedTs)} state="neutral" />
                <StatusRow
                  label="Last upload"
                  value={
                    diag.lastBgPost
                      ? `${diag.lastBgPost.ok ? "OK" : diag.lastBgPost.error ?? "failed"} · ${ageLabel(diag.lastBgPost.ts)}`
                      : "never"
                  }
                  state={diag.lastBgPost ? (diag.lastBgPost.ok ? "good" : "bad") : "warn"}
                />
                {diag.lastStart && (
                  <StatusRow
                    label="Last start result"
                    value={`${diag.lastStart.reason} · ${ageLabel(diag.lastStart.ts)}`}
                    state={diag.lastStart.ok ? "good" : "bad"}
                  />
                )}
                <StatusRow
                  label="Auto-revive watchdog"
                  value={
                    diag.watchdog === null
                      ? "not available (old APK)"
                      : diag.watchdog.enabled
                        ? "active"
                        : "off"
                  }
                  state={diag.watchdog === null ? "warn" : diag.watchdog.enabled ? "good" : "bad"}
                />
                {diag.watchdog && (
                  <>
                    <StatusRow
                      label="Exact alarms allowed"
                      value={diag.watchdog.canScheduleExactAlarms ? "yes" : "no (revival slower)"}
                      state={diag.watchdog.canScheduleExactAlarms ? "good" : "warn"}
                    />
                    <StatusRow
                      label="Watchdog last ran"
                      value={
                        diag.watchdog.lastRunTs
                          ? `${ageLabel(diag.watchdog.lastRunTs)} (${diag.watchdog.lastRunSource ?? "?"})`
                          : "not yet"
                      }
                      state={diag.watchdog.lastRunTs ? "neutral" : "warn"}
                    />
                    <StatusRow
                      label="Last auto-revival"
                      value={ageLabel(diag.watchdog.lastRevivalTs)}
                      state="neutral"
                    />
                    {diag.watchdog.lastError && (
                      <StatusRow label="Watchdog error" value={diag.watchdog.lastError} state="bad" />
                    )}
                    <StatusRow
                      label="Native fallback ready"
                      value={diag.watchdog.configPresent ? "yes (token saved)" : "no (login/track once)"}
                      state={diag.watchdog.configPresent ? "good" : "warn"}
                    />
                    <StatusRow
                      label="Native fallback upload"
                      value={
                        diag.watchdog.lastNativePostTs
                          ? `${diag.watchdog.lastNativePostOk ? "OK" : "failed"} · ${ageLabel(diag.watchdog.lastNativePostTs)}`
                          : "never (JS alive — not needed)"
                      }
                      state={
                        diag.watchdog.lastNativePostTs
                          ? diag.watchdog.lastNativePostOk
                            ? "good"
                            : "bad"
                          : "neutral"
                      }
                    />
                    {diag.watchdog.lastNativePostError && (
                      <StatusRow
                        label="Native upload error"
                        value={diag.watchdog.lastNativePostError}
                        state="bad"
                      />
                    )}
                  </>
                )}
                <StatusRow label="Queued (offline) pings" value={String(diag.queueLength)} state={diag.queueLength > 0 ? "warn" : "neutral"} />
                <StatusRow label="App version" value={`${version} (${buildCode})`} state="neutral" />
                <StatusRow label="Device" value={device} state="neutral" />
                <StatusRow label="Server" value={diag.baseUrl.replace("https://", "")} state="neutral" />

                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: "#0891B214",
                    borderRadius: 10,
                    padding: 11,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_600SemiBold",
                      color: "#0E7490",
                      marginBottom: 3,
                    }}
                  >
                    Screen-lock test
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: colors.mutedForeground,
                      lineHeight: 17,
                    }}
                  >
                    Screen band karne ke baad notification bar mein “K&S Solar — Location Active” dikhti
                    rehni chahiye. Agar woh gayab ho jaye → app kill ho rahi hai (Autostart ON karein).
                    Agar woh dikhti rahe magar “Last GPS fix” purana hota jaye → battery optimization
                    (Doze) band karein.{"\n\n"}
                    Auto-revive: agar notification ya app swipe se band ho jaye to watchdog ~2 minute
                    mein tracking khud wapas chalu kar deta hai (gehri neend/Doze mein 9 minute tak lag
                    sakte hain). Kill ke baad app recents mein wapas nazar NAHIN aayegi — ye normal
                    hai; notification aur location bhejna kaafi hai. Agar app ka JS engine wapas na
                    chale to bhi “Native fallback upload” har ~2 minute mein location seedha server
                    bhejta rehta hai. Lekin settings se “Force stop” karne ke baad app khud start
                    NAHIN ho sakti — app dobara kholni paregi.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Test ping result */}
            {testResult && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: testResult.ok ? "#10B98114" : "#EF444414",
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Feather
                  name={testResult.ok ? "check-circle" : "x-circle"}
                  size={18}
                  color={testResult.ok ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: testResult.ok ? "#047857" : "#B91C1C",
                    lineHeight: 18,
                  }}
                >
                  {testResult.ok
                    ? "Test ping reached the server — internet, GPS and login all work. If the Background / Service rows above are red, always-on tracking still needs those fixed."
                    : `Test ping failed: ${testResult.error ?? "unknown error"}`}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Doze whitelist quick-fix — the #1 cause of tracking dying after the
              screen turns off on budget OEMs. Reliable fallback if the automatic
              prompt on tracking-start was missed or blocked. */}
          {Platform.OS !== "web" && (
            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              <TouchableOpacity
                onPress={onFixBattery}
                disabled={fixing}
                style={{
                  backgroundColor: "#F59E0B",
                  borderRadius: 11,
                  paddingVertical: 13,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: fixing ? 0.6 : 1,
                }}
              >
                {fixing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="zap" size={15} color="#fff" />
                )}
                <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                  Fix Background Tracking
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingTop: 14 }}>
            <TouchableOpacity
              onPress={onTest}
              disabled={testing}
              style={{
                flex: 1,
                backgroundColor: "#0891B2",
                borderRadius: 11,
                paddingVertical: 13,
                alignItems: "center",
                opacity: testing ? 0.6 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {testing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="send" size={15} color="#fff" />
              )}
              <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                {testing ? "Testing…" : "Send test ping"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRestart}
              disabled={restarting}
              style={{
                backgroundColor: colors.muted,
                borderRadius: 11,
                paddingVertical: 13,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: restarting ? 0.6 : 1,
              }}
            >
              {restarting ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <Feather name="refresh-cw" size={16} color={colors.foreground} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
