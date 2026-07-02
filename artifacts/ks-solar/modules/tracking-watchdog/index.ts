import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type WatchdogStatus = {
  enabled: boolean;
  canScheduleExactAlarms: boolean;
  /** Epoch ms of the last watchdog pass (alarm/worker/boot), 0 = never. */
  lastRunTs: number;
  lastRunSource: string | null;
  /** Epoch ms of the last pass that ran in a fresh process (i.e. the app had been killed and was revived), 0 = never. */
  lastRevivalTs: number;
  lastError: string | null;
  /** Whether the native upload fallback holds an auth token + upload URL. */
  configPresent: boolean;
  /** Epoch ms of the last heartbeat from the JS background task, 0 = never. Stale (>3 min) = JS engine dead, native fallback takes over. */
  jsHeartbeatTs: number;
  /** Epoch ms of the last NATIVE fallback upload attempt, 0 = never. */
  lastNativePostTs: number;
  lastNativePostOk: boolean;
  lastNativePostError: string | null;
};

const NativeTrackingWatchdog = requireOptionalNativeModule<{
  setEnabled: (enabled: boolean) => void;
  setConfig: (authToken: string | null, uploadUrl: string | null) => void;
  notifyJsAlive: () => void;
  getStatus: () => WatchdogStatus;
}>("TrackingWatchdog");

/**
 * Arm/disarm the native auto-revive watchdog: a self-chaining ~2-minute exact
 * alarm (plus a 15-minute WorkManager backstop) that natively restores the
 * expo-location tracking foreground service — notification included — after
 * the OEM kills the app (notification swipe / recents swipe on Tecno-HiOS).
 *
 * No-op on web, Expo Go, and APKs built before this module existed. Safe to
 * call repeatedly; re-arming on every app foreground is intentional
 * self-healing (restores the alarm chain if the OEM cleared it).
 *
 * Hard limits (Android design): "Force stop" cancels alarms — nothing revives
 * until manual relaunch; deep Doze can delay the alarm to ~9 minutes.
 */
export function setWatchdogEnabled(enabled: boolean): void {
  if (Platform.OS !== "android") return;
  if (!NativeTrackingWatchdog) return;
  try {
    NativeTrackingWatchdog.setEnabled(enabled);
  } catch {
    // Best-effort — never let watchdog arming break the tracking start path.
  }
}

/**
 * Hand the native upload fallback what it needs to POST locations BY ITSELF
 * while the JS engine is dead: revival restores the foreground service
 * natively, but the actual upload lives in the JS task handler — which proved
 * NOT to boot headlessly on HiOS (notification returned, zero uploads reached
 * the server). With this config the watchdog pass uploads a fix natively
 * (~2 min cadence) whenever the JS heartbeat goes stale. Pass nulls to clear
 * (logout). Refreshed on every successful tracking start so the token stays
 * fresh.
 */
export function setWatchdogConfig(authToken: string | null, uploadUrl: string | null): void {
  if (Platform.OS !== "android") return;
  if (!NativeTrackingWatchdog) return;
  try {
    NativeTrackingWatchdog.setConfig(authToken, uploadUrl);
  } catch {
    // Best-effort — never let watchdog config break the tracking start path.
  }
}

/**
 * Heartbeat from the JS background task handler (called on every fix). A
 * fresh heartbeat tells the native fallback the JS upload pipeline is alive,
 * so it stands down instead of double-posting.
 */
export function notifyWatchdogJsAlive(): void {
  if (Platform.OS !== "android") return;
  if (!NativeTrackingWatchdog) return;
  try {
    NativeTrackingWatchdog.notifyJsAlive();
  } catch {
    // Best-effort.
  }
}

/**
 * Watchdog state for the diagnostics panel. `null` when the native module is
 * unavailable (web, Expo Go, or an APK built before this module existed).
 */
export function getWatchdogStatus(): WatchdogStatus | null {
  if (Platform.OS !== "android") return null;
  if (!NativeTrackingWatchdog) return null;
  try {
    return NativeTrackingWatchdog.getStatus();
  } catch {
    return null;
  }
}
