import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

const NativeBatteryOptimization = requireOptionalNativeModule<{
  isIgnoringBatteryOptimizations: () => boolean;
}>("BatteryOptimization");

/**
 * Whether this app is on the Android Doze battery-optimization whitelist
 * (PowerManager.isIgnoringBatteryOptimizations). This is the REAL system state,
 * not the OEM per-app "unrestricted" toggle.
 *
 * Returns `null` when the native module is unavailable — web, Expo Go, or an
 * APK built before this module existed — so callers can gracefully fall back to
 * the older self-attested confirmation instead of hard-failing.
 */
export function getIsIgnoringBatteryOptimizations(): boolean | null {
  if (Platform.OS !== "android") return null;
  if (!NativeBatteryOptimization) return null;
  try {
    return NativeBatteryOptimization.isIgnoringBatteryOptimizations();
  } catch {
    return null;
  }
}
