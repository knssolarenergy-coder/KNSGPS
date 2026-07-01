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

/**
 * Fire the Android system "Allow app to ignore battery optimizations?" dialog for
 * this app — i.e. request the AOSP Doze whitelist grant. On budget OEMs
 * (Tecno/HiOS, Infinix, Realme, Oppo, Vivo…) the location foreground service is
 * throttled/killed minutes after the screen turns off unless this is granted, and
 * it is SEPARATE from the OEM per-app "unrestricted" toggle. On "Allow" the system
 * flips PowerManager.isIgnoringBatteryOptimizations() to true.
 *
 * Falls back to the app-details settings screen if the direct dialog isn't
 * available on a given ROM. No-op off Android.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IntentLauncher = require("expo-intent-launcher") as typeof import("expo-intent-launcher");
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
        { data: "package:com.kssolar.app" },
      );
    } catch {
      // Some ROMs don't expose the direct dialog — open the app's details page so
      // the user can toggle battery optimization manually.
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: "package:com.kssolar.app" },
      );
    }
  } catch {
    // require() failed (module missing, e.g. Expo Go) or both intents failed —
    // never throw from a best-effort grant helper.
  }
}
