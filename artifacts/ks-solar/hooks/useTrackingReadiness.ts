import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { getTrackingLiveness } from "@/backgroundLocationTask";
import { getIsIgnoringBatteryOptimizations } from "@/modules/battery-optimization";

export type RequirementKey =
  | "notification"
  | "backgroundLocation"
  | "serviceRunning"
  | "battery"
  | "autostart"
  | "recentsLock";

export interface TrackingRequirement {
  key: RequirementKey;
  labelUrdu: string;
  descUrdu: string;
  status: "pass" | "fail";
  isCheckable: boolean;
  confirmed: boolean;
}

export interface TrackingReadinessResult {
  requirements: TrackingRequirement[];
  isGateRequired: boolean;
  blockingGate: boolean;
  isLoaded: boolean;
  refresh: () => Promise<void>;
  confirmGuideOnly: (key: RequirementKey) => Promise<void>;
}

export const BATTERY_CONFIRMED_KEY = "ks_solar_battery_prompt_done";
export const AUTOSTART_CONFIRMED_KEY = "ks_solar_autostart_prompt_done";
export const RECENTS_CONFIRMED_KEY = "ks_solar_recents_lock_confirmed";

async function checkNotifPerm(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const N = require("expo-notifications") as typeof import("expo-notifications");
    const { granted } = await N.getPermissionsAsync();
    return granted;
  } catch {
    return true;
  }
}

async function checkBgLocation(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function checkServiceRunning(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  try {
    const { alive } = await getTrackingLiveness();
    return alive;
  } catch {
    return false;
  }
}

export function useTrackingReadiness(): TrackingReadinessResult {
  const [requirements, setRequirements] = useState<TrackingRequirement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefresh.current < 2_000) return;
    lastRefresh.current = now;

    const [notifOk, bgOk, svcOk, battDone, autoDone, recentsDone] =
      await Promise.all([
        checkNotifPerm(),
        checkBgLocation(),
        checkServiceRunning(),
        SecureStore.getItemAsync(BATTERY_CONFIRMED_KEY)
          .then((v) => !!v)
          .catch(() => false),
        SecureStore.getItemAsync(AUTOSTART_CONFIRMED_KEY)
          .then((v) => !!v)
          .catch(() => false),
        SecureStore.getItemAsync(RECENTS_CONFIRMED_KEY)
          .then((v) => !!v)
          .catch(() => false),
      ]);

    // Real Doze whitelist state when the native module is present; null on web,
    // Expo Go, or an older APK — then fall back to the self-attested checkbox.
    const dozeStatus = getIsIgnoringBatteryOptimizations();
    const batteryRealCheck = dozeStatus !== null;
    const batteryPass = batteryRealCheck ? (dozeStatus as boolean) : battDone;

    setRequirements([
      {
        key: "notification",
        labelUrdu: "Notifications ON karein",
        descUrdu:
          '"K&S Solar — Location Active" notification zaroor dikhni chahiye. Iske baghair phone ki OS service ko jaldi band kar deti hai.',
        status: notifOk ? "pass" : "fail",
        isCheckable: true,
        confirmed: notifOk,
      },
      {
        key: "backgroundLocation",
        labelUrdu: 'Location "Hamesha Allow" set karein',
        descUrdu:
          'Is app ki location permission "Allow all the time" par honi chahiye — "While using" kafi nahi, tracking band ho jati hai.',
        status: bgOk ? "pass" : "fail",
        isCheckable: true,
        confirmed: bgOk,
      },
      {
        key: "serviceRunning",
        labelUrdu: "Tracking service active hai",
        descUrdu:
          "Background location service chal rahi honi chahiye taake office ko live position milti rahe.",
        status: svcOk ? "pass" : "fail",
        isCheckable: true,
        confirmed: svcOk,
      },
      {
        key: "battery",
        labelUrdu: batteryRealCheck
          ? "Battery optimization OFF karein"
          : "Battery: Koi Restriction Nahi",
        descUrdu: batteryRealCheck
          ? 'Is app ke liye battery optimization OFF honi chahiye, warna screen band hone ke ~5 min baad tracking ruk jati hai. "Fix Karein" daba kar dialog mein "Allow" karein.'
          : 'Settings → Apps → K&S Solar → Battery → "Unrestricted" ya "No restriction" select karein.',
        status: batteryPass ? "pass" : "fail",
        isCheckable: batteryRealCheck,
        confirmed: batteryPass,
      },
      {
        key: "autostart",
        labelUrdu: "Autostart / Auto-launch ON karein",
        descUrdu:
          'Phone ki Security ya Battery settings mein K&S Solar ka "Autostart" ON karein. Iske baghair app screen band hone par wapis nahi aati.',
        status: autoDone ? "pass" : "fail",
        isCheckable: false,
        confirmed: autoDone,
      },
      {
        key: "recentsLock",
        labelUrdu: "Recents mein App Lock karein",
        descUrdu:
          'Recent apps (pahela/square button) mein K&S Solar card par lock icon 🔒 tap karein — taake swipe se band na ho.',
        status: recentsDone ? "pass" : "fail",
        isCheckable: false,
        confirmed: recentsDone,
      },
    ]);
    setIsLoaded(true);
  }, []);

  const confirmGuideOnly = useCallback(
    async (key: RequirementKey) => {
      const storeKey =
        key === "battery"
          ? BATTERY_CONFIRMED_KEY
          : key === "autostart"
            ? AUTOSTART_CONFIRMED_KEY
            : key === "recentsLock"
              ? RECENTS_CONFIRMED_KEY
              : null;
      if (!storeKey) return;
      await SecureStore.setItemAsync(storeKey, "1");
      lastRefresh.current = 0;
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        lastRefresh.current = 0;
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const blockingGate = requirements.some(
    (r) => r.isCheckable && r.status === "fail"
  );
  const hasUnconfirmedGuide = requirements.some(
    (r) => !r.isCheckable && !r.confirmed
  );
  const isGateRequired =
    Platform.OS !== "web" && (blockingGate || hasUnconfirmedGuide);

  return {
    requirements,
    isGateRequired,
    blockingGate,
    isLoaded,
    refresh,
    confirmGuideOnly,
  };
}
