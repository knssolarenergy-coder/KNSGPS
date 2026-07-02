import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getIsIgnoringBatteryOptimizations, requestIgnoreBatteryOptimizations } from "@/modules/battery-optimization";
import {
  getWatchdogStatus,
  notifyWatchdogJsAlive,
  setWatchdogConfig,
  setWatchdogEnabled,
  type WatchdogStatus,
} from "@/modules/tracking-watchdog";

export const LOCATION_TASK_NAME = "ks-solar-bg-location";

const TOKEN_KEY = "ks_solar_token";
const LOC_QUEUE_KEY = "ks_solar_loc_queue";
const MAX_QUEUE = 200;

// Heartbeat + restart bookkeeping. A persisted task registration survives BOTH
// OEM/Doze service kills AND app upgrades, so hasStartedLocationUpdatesAsync()
// alone cannot tell us whether the service is actually alive or running the
// CURRENT config. We track when the service last produced a fix and which config
// version it was started with, and force a fresh restart when either is
// stale/outdated.
const LAST_LOC_TS_KEY = "ks_solar_last_loc_ts";
const STARTED_TS_KEY = "ks_solar_started_ts";
const CONFIG_VERSION_KEY = "ks_solar_tracking_config_version";

// Bump this whenever the startLocationUpdatesAsync() options below change. On an
// already-installed phone the old task stays "registered" with the OLD options,
// so a config change (e.g. Balanced -> High accuracy) only actually takes effect
// when this version mismatch forces a fresh start.
const TRACKING_CONFIG_VERSION = "2";

// Treat the service as dead (killed by the OS) when it has neither produced a
// fix nor been (re)started within this window. 5 min tolerates a GPS cold start
// and weak indoor signal without triggering false restarts.
const STALE_MS = 5 * 60 * 1000;

// Observability: the background path used to swallow every failure silently, so
// from the office it was impossible to tell "permission not granted" from "app
// never opened" from "server rejected the ping". We now persist the outcome of
// the last service (re)start and the last upload attempt so an in-app diagnostics
// panel (and a one-tap test ping) can show the REAL reason tracking isn't working.
const LAST_BG_POST_KEY = "ks_solar_last_bg_post";
const LAST_START_KEY = "ks_solar_last_start";

// startAlwaysOnTracking() runs on every app foreground, so auto-prompt the Doze
// whitelist grant at most ONCE per app launch — otherwise a not-yet-whitelisted
// technician would get the system battery dialog popped every time they open the app.
let didAutoPromptBatteryOpt = false;

type QueuedPing = { latitude: string; longitude: string; recordedAt: string };

async function recordBgPost(ok: boolean, status?: number, error?: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_BG_POST_KEY,
      JSON.stringify({ ts: Date.now(), ok, status: status ?? null, error: error ?? null })
    );
  } catch {}
}

async function recordStart(ok: boolean, reason: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_START_KEY, JSON.stringify({ ts: Date.now(), ok, reason }));
  } catch {}
}

async function readQueue(): Promise<QueuedPing[]> {
  try {
    const raw = await AsyncStorage.getItem(LOC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedPing[];
  } catch {
    return [];
  }
}

async function enqueueLocation(latitude: string, longitude: string, recordedAt: string): Promise<void> {
  try {
    const queue = await readQueue();
    queue.push({ latitude, longitude, recordedAt });
    const capped = queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue;
    await AsyncStorage.setItem(LOC_QUEUE_KEY, JSON.stringify(capped));
  } catch {
    // Silent — never block background task for storage errors
  }
}

/**
 * Flush the offline queue to the server. Called after a successful live ping
 * so we know the network is up. On any network/5xx failure the queue is kept
 * intact and retried on the next 60-second tick.
 */
async function flushQueue(token: string): Promise<void> {
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;
    const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/technician-locations/batch`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pings: queue }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Clear on success or 4xx (retrying a 4xx won't help).
        await AsyncStorage.removeItem(LOC_QUEUE_KEY);
      }
      // 5xx or network error: leave queue intact for next tick.
    } catch {
      clearTimeout(timer);
    }
  } catch {
    // Silent
  }
}

/**
 * POST the latest location with real network resilience. Field technicians work
 * on flaky mobile signal — a single fire-and-forget fetch silently drops the
 * ping, and after ~15min of dropped pings the office map marks the technician
 * "offline" even though the app is running fine. So: abort a hung request,
 * treat a non-2xx as a failure, and retry transient (network / 5xx) errors a
 * few times before giving up (the next 60s tick sends a fresh point anyway).
 */
async function postLocationResilient(token: string, latitude: string, longitude: string): Promise<boolean> {
  const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/technician-locations`;
  const body = JSON.stringify({ latitude, longitude, address: null });
  const MAX_ATTEMPTS = 3;
  let lastStatus: number | undefined;
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;
      if (res.ok) {
        await recordBgPost(true, res.status);
        return true;
      }
      // 4xx (expired/invalid token, bad payload) won't be fixed by retrying.
      if (res.status >= 400 && res.status < 500) {
        await recordBgPost(false, res.status, `HTTP ${res.status}`);
        return false;
      }
      lastError = `HTTP ${res.status}`;
      // 5xx falls through to retry.
    } catch {
      clearTimeout(timer);
      lastError = "Network error / timeout";
      // network error / timeout / abort — falls through to retry.
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, attempt * 1_500));
    }
  }
  await recordBgPost(false, lastStatus, lastError ?? "Upload failed");
  return false;
}

// Task must be defined at module top-level (Expo requirement).
// Platform guard ensures expo-task-manager is only required on native.
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: { data: unknown; error: { message: string } | null }) => {
      if (error) {
        await recordBgPost(false, undefined, `Location task error: ${error.message}`);
        return;
      }
      const { locations } = data as { locations: Location.LocationObject[] };
      const loc = locations[locations.length - 1];
      if (!loc) return;
      // Heartbeat FIRST — proves the foreground service is alive and producing
      // fixes, independent of whether the network upload below succeeds.
      try { await AsyncStorage.setItem(LAST_LOC_TS_KEY, String(Date.now())); } catch {}
      // Tell the native watchdog the JS upload pipeline is alive so its native
      // upload fallback stands down (it only posts while this handler is dead).
      notifyWatchdogJsAlive();
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) {
          await recordBgPost(false, undefined, "No auth token in background (logged out?)");
          return;
        }

        const lat = loc.coords.latitude.toString();
        const lng = loc.coords.longitude.toString();
        const recordedAt = new Date(loc.timestamp).toISOString();

        // The server figures out the active shift (if any) from the token —
        // location is reported 24/7 regardless of check-in status.
        const ok = await postLocationResilient(token, lat, lng);

        if (ok) {
          // Network is up — drain any pings saved while offline.
          await flushQueue(token);
        } else {
          // Network is down or server error — save to local queue for later upload.
          await enqueueLocation(lat, lng, recordedAt);
        }
      } catch {
        // Silent fail — background tasks should never throw
      }
    });
  } catch {
    // expo-task-manager not available (e.g. Expo Go) — background tracking disabled
  }
}

/**
 * Ensure always-on (24/7) background location tracking is running. Requests
 * foreground then background ("Allow all the time") permission, then runs a
 * foreground-service location task that keeps reporting even when the app is
 * closed or the screen is locked.
 *
 * Idempotent and self-healing via a HEARTBEAT, not just the registration flag:
 * it forces a fresh stop+start when the task is registered but has gone stale
 * (an OEM/Doze kill, detected by a missing heartbeat) or is still running an
 * outdated config version (old options left over from a previous APK). Safe (and
 * intended) to call on login AND on every app foreground, so reopening the app
 * revives a dead service. Returns true when tracking is (re)confirmed running.
 */
export async function startAlwaysOnTracking(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    // Foreground permission must be granted before background can be requested.
    // Check the current grant first and only PROMPT when Android can still ask —
    // this runs on every app foreground, so blindly calling request* would keep
    // re-opening the settings page for a user who already denied. Already-granted
    // users never see a prompt.
    const fgCur = await Location.getForegroundPermissionsAsync();
    let fgStatus = fgCur.status;
    if (fgStatus !== "granted" && fgCur.canAskAgain) {
      fgStatus = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (fgStatus !== "granted") {
      await recordStart(false, `foreground permission ${fgStatus}`);
      return false;
    }

    const bgCur = await Location.getBackgroundPermissionsAsync();
    let bgStatus = bgCur.status;
    if (bgStatus !== "granted" && bgCur.canAskAgain) {
      bgStatus = (await Location.requestBackgroundPermissionsAsync()).status;
    }
    if (bgStatus !== "granted") {
      // The single most common field failure: tech granted "While using" instead
      // of "Allow all the time", so the always-on service can never start.
      await recordStart(false, `background permission ${bgStatus} (need "Allow all the time")`);
      return false;
    }

    // Doze whitelist grant. On budget OEMs (Tecno/HiOS, Infinix, Realme, Oppo…)
    // the location foreground service is throttled/killed minutes after the screen
    // turns off unless this app is on the AOSP Doze battery-optimization whitelist
    // — which is SEPARATE from the OEM per-app "unrestricted" toggle. If we can
    // read the real state and it is definitively OFF, fire the system grant dialog
    // once per launch. `null` (old APK / Expo Go) = can't read → don't prompt.
    // Fire-and-forget + try/catch so showing the dialog never blocks the start.
    try {
      if (!didAutoPromptBatteryOpt && getIsIgnoringBatteryOptimizations() === false) {
        didAutoPromptBatteryOpt = true;
        void requestIgnoreBatteryOptimizations().catch(() => {});
      }
    } catch {}

    // hasStartedLocationUpdatesAsync() only reports that the task is REGISTERED,
    // not that the foreground service is alive or running the current config. So
    // we also check the heartbeat + config version and force a fresh start when
    // the service looks dead (OEM/Doze kill) or is still running OLD options
    // after an app upgrade. THIS is what makes reopening the app actually revive
    // tracking instead of silently keeping a dead/outdated registration.
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    let needsRestart = !already;
    if (already) {
      const [lastLocRaw, startedRaw, cfgRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_LOC_TS_KEY).catch(() => null),
        AsyncStorage.getItem(STARTED_TS_KEY).catch(() => null),
        AsyncStorage.getItem(CONFIG_VERSION_KEY).catch(() => null),
      ]);
      const lastAlive = Math.max(Number(lastLocRaw) || 0, Number(startedRaw) || 0);
      const stale = Date.now() - lastAlive > STALE_MS;
      const configOutdated = cfgRaw !== TRACKING_CONFIG_VERSION;
      needsRestart = stale || configOutdated;
      if (needsRestart) {
        // Tear the dead/outdated registration down first; ignore errors because
        // a service the OS already killed can throw on stop.
        try { await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME); } catch {}
      }
    }
    if (needsRestart) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        // High (GPS) is the reliable choice for continuous tracking while the
        // screen is OFF / locked: the foreground-service location task holds a
        // wakelock and GPS keeps emitting points on the time interval. Balanced
        // (fused / network) frequently goes SILENT on a stationary, screen-off
        // phone in Android Doze — wifi/cell scans get throttled — which is
        // exactly the "tracking stops when the screen is locked" symptom this
        // app was hitting. The 60s cadence keeps battery use sane.
        accuracy: Location.Accuracy.High,
        // 60s cadence keeps 24/7 tracking battery-sane while still giving the
        // office a near-live position.
        timeInterval: 60_000,
        // 0 = report on the time interval even when the technician is standing
        // still. With a distance filter, a stationary phone with the screen off
        // would stop sending pings — this keeps tracking alive while locked.
        distanceInterval: 0,
        activityType: Location.ActivityType.Other,
        foregroundService: {
          notificationTitle: "K&S Solar — Location Active",
          notificationBody: "Sharing your location with the office.",
          notificationColor: "#0891B2",
          // Keep the foreground service (and tracking) running even if the app
          // is swiped away from recents while the screen is locked.
          killServiceOnDestroy: false,
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
      // Record start time + config version so the next foreground check knows the
      // service is fresh (start grace window) and running the current options.
      try {
        await AsyncStorage.multiSet([
          [STARTED_TS_KEY, String(Date.now())],
          [CONFIG_VERSION_KEY, TRACKING_CONFIG_VERSION],
        ]);
      } catch {}
    }

    await recordStart(true, needsRestart ? "service (re)started" : "service already running");

    // Hand the watchdog upload credentials BEFORE arming it: revival restores
    // the foreground service natively, but the JS upload handler proved NOT to
    // boot headlessly on HiOS (notification returned, zero uploads reached the
    // server). With this config the watchdog POSTs a fix natively (~2-min
    // cadence) whenever the JS heartbeat goes stale. Refreshed on every
    // foreground so the 30-day token stays fresh. No-op on old APKs.
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      setWatchdogConfig(
        token && domain ? token : null,
        token && domain ? `https://${domain}/api/technician-locations` : null
      );
    } catch {}

    // Arm the native auto-revive watchdog: a ~2-min exact-alarm chain (+15-min
    // WorkManager backstop) that natively restores this foreground service —
    // notification included — after HiOS/Tecno kills the app (notification
    // swipe / recents swipe). Re-arming on every foreground is intentional:
    // it restores the alarm chain if the OEM cleared it. No-op on old APKs.
    setWatchdogEnabled(true);

    return true;
  } catch (e: unknown) {
    // Graceful — background permission denied or a transient error.
    const msg = e instanceof Error ? e.message : "unknown error";
    await recordStart(false, `start error: ${msg}`);
    return false;
  }
}

export type TrackingLiveness = {
  registered: boolean;
  alive: boolean;
  lastPingTs: number;
};

/**
 * Report whether the background tracking service is genuinely alive — for the
 * readiness gate. Unlike a raw hasStartedLocationUpdatesAsync() check, the
 * service counts as alive ONLY when it is registered AND has produced a fix (or
 * was started) within the staleness window, so a zombie registration left behind
 * by an OEM/Doze kill correctly shows as dead and prompts the user to fix it.
 */
export async function getTrackingLiveness(): Promise<TrackingLiveness> {
  if (Platform.OS === "web") return { registered: true, alive: true, lastPingTs: 0 };
  try {
    const registered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    const [lastLocRaw, startedRaw] = await Promise.all([
      AsyncStorage.getItem(LAST_LOC_TS_KEY).catch(() => null),
      AsyncStorage.getItem(STARTED_TS_KEY).catch(() => null),
    ]);
    const lastPingTs = Number(lastLocRaw) || 0;
    const lastAlive = Math.max(lastPingTs, Number(startedRaw) || 0);
    const alive = registered && Date.now() - lastAlive <= STALE_MS;
    return { registered, alive, lastPingTs };
  } catch {
    return { registered: false, alive: false, lastPingTs: 0 };
  }
}

export type TestPingResult = {
  ok: boolean;
  status?: number;
  error?: string;
  latitude?: string;
  longitude?: string;
};

/**
 * One-tap end-to-end probe of the WHOLE tracking chain — GPS fix, foreground
 * permission, network and server auth — surfacing the exact failure point to the
 * technician instead of failing silently. Used by the diagnostics panel so the
 * office can tell "permission off" from "GPS off" from "server rejected" without
 * reading device logs.
 */
export async function sendTestPing(): Promise<TestPingResult> {
  if (Platform.OS === "web") return { ok: false, error: "Test ping is only available on the mobile app" };
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return { ok: false, error: "Not logged in (no auth token on device)" };

    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return { ok: false, error: "Location permission not granted" };

    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return { ok: false, error: "Phone location / GPS is turned OFF" };

    let loc: Location.LocationObject;
    try {
      loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    } catch {
      return { ok: false, error: "Could not get a GPS fix (move to open sky and retry)" };
    }
    const latitude = loc.coords.latitude.toString();
    const longitude = loc.coords.longitude.toString();

    const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/technician-locations`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude, longitude, address: null }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      await recordBgPost(res.ok, res.status, res.ok ? undefined : `HTTP ${res.status}`);
      if (res.ok) return { ok: true, status: res.status, latitude, longitude };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, status: res.status, error: "Server rejected login (session expired — log out and back in)", latitude, longitude };
      }
      return { ok: false, status: res.status, error: `Server error HTTP ${res.status}`, latitude, longitude };
    } catch {
      clearTimeout(timer);
      await recordBgPost(false, undefined, "Network error / timeout");
      return { ok: false, error: "Could not reach the server (check internet)", latitude, longitude };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export type TrackingDiagnostics = {
  baseUrl: string;
  tokenPresent: boolean;
  foregroundPermission: string;
  backgroundPermission: string;
  gpsEnabled: boolean;
  dozeWhitelisted: boolean | null;
  registered: boolean;
  alive: boolean;
  lastFixTs: number;
  startedTs: number;
  configVersion: string | null;
  queueLength: number;
  lastStart: { ts: number; ok: boolean; reason: string } | null;
  lastBgPost: { ts: number; ok: boolean; status: number | null; error: string | null } | null;
  /** Auto-revive watchdog state; null on web/Expo Go/old APKs. */
  watchdog: WatchdogStatus | null;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Gather the full tracking state from the device for the diagnostics panel. This
 * is the single source of truth the technician (and, relayed by them, the office)
 * uses to see WHY tracking is or isn't working — no more guessing blind.
 */
export async function getTrackingDiagnostics(): Promise<TrackingDiagnostics> {
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "(not set)"}`;
  if (Platform.OS === "web") {
    return {
      baseUrl,
      tokenPresent: false,
      foregroundPermission: "n/a (web)",
      backgroundPermission: "n/a (web)",
      gpsEnabled: false,
      dozeWhitelisted: null,
      registered: false,
      alive: false,
      lastFixTs: 0,
      startedTs: 0,
      configVersion: null,
      queueLength: 0,
      lastStart: null,
      lastBgPost: null,
      watchdog: null,
    };
  }
  const [token, fg, bg, gpsEnabled, registered, lastLocRaw, startedRaw, cfgRaw, queue, lastStartRaw, lastPostRaw] =
    await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
      Location.getForegroundPermissionsAsync().catch(() => ({ status: "unknown" } as { status: string })),
      Location.getBackgroundPermissionsAsync().catch(() => ({ status: "unknown" } as { status: string })),
      Location.hasServicesEnabledAsync().catch(() => false),
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false),
      AsyncStorage.getItem(LAST_LOC_TS_KEY).catch(() => null),
      AsyncStorage.getItem(STARTED_TS_KEY).catch(() => null),
      AsyncStorage.getItem(CONFIG_VERSION_KEY).catch(() => null),
      readQueue(),
      AsyncStorage.getItem(LAST_START_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_BG_POST_KEY).catch(() => null),
    ]);
  const lastFixTs = Number(lastLocRaw) || 0;
  const startedTs = Number(startedRaw) || 0;
  const alive = registered && Date.now() - Math.max(lastFixTs, startedTs) <= STALE_MS;
  return {
    baseUrl,
    tokenPresent: !!token,
    foregroundPermission: fg.status,
    backgroundPermission: bg.status,
    gpsEnabled,
    dozeWhitelisted: getIsIgnoringBatteryOptimizations(),
    registered,
    alive,
    lastFixTs,
    startedTs,
    configVersion: cfgRaw,
    queueLength: queue.length,
    lastStart: safeParse(lastStartRaw),
    lastBgPost: safeParse(lastPostRaw),
    watchdog: getWatchdogStatus(),
  };
}

/** Stop background tracking. Call on logout. */
export async function stopBackgroundLocation(): Promise<void> {
  if (Platform.OS === "web") return;
  // Disarm the auto-revive watchdog FIRST so it cannot resurrect the service
  // we are about to stop. Clearing the config drops the native fallback's
  // auth token (disarm also clears it natively — belt and braces).
  setWatchdogConfig(null, null);
  setWatchdogEnabled(false);
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (already) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {}
  // Clear heartbeat bookkeeping so the next login starts from a clean slate.
  try {
    await AsyncStorage.multiRemove([LAST_LOC_TS_KEY, STARTED_TS_KEY, CONFIG_VERSION_KEY]);
  } catch {}
}
