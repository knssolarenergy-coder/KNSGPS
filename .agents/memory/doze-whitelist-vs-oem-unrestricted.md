---
name: Doze whitelist vs OEM "unrestricted"
description: Why background-GPS dies ~5min after screen-off even with battery set "unrestricted", and how to truly verify/grant the AOSP Doze exemption in Expo managed
---

The OEM per-app "Battery: Unrestricted / No restriction" toggle is NOT the same
as the AOSP Doze battery-optimization whitelist
(`PowerManager.isIgnoringBatteryOptimizations(packageName)`). On budget ROMs
(Infinix/Tecno/Realme/Oppo/Vivo, common in Pakistan) a user can set "no
restriction" while the app is still NOT Doze-whitelisted → a foreground-service
location task gets throttled/killed ~5 min after screen-off.

**Rule:** never trust a self-attested "battery unrestricted" checkbox for
background tracking. Read the REAL state and fire the real grant.

**How to apply (Expo SDK 54 managed / CNG, no eject):**
- READ: there is no Expo/first-party JS API for `isIgnoringBatteryOptimizations`.
  Add a tiny LOCAL Expo native module under `modules/<name>/` (the dir is
  auto-discovered by expo-modules-autolinking's default `./modules` searchPath,
  works in EAS). Kotlin `Function("isIgnoringBatteryOptimizations")` returning
  `pm.isIgnoringBatteryOptimizations(packageName)`. build.gradle just needs
  `plugins { id 'com.android.library'; id 'expo-module-gradle-plugin' }` +
  group/namespace; compileSdk/minSdk/kotlin come from the Expo root config.
  JS side: `requireOptionalNativeModule("BatteryOptimization")` imported from
  `"expo"` (NOT `"expo-modules-core"` — that's not a direct dep so TS can't
  resolve it). Return `boolean | null` (null on web/Expo Go/old APK) so callers
  fall back gracefully.
- GRANT: `expo-intent-launcher` (already a dep) →
  `startActivityAsync("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", { data: "package:<pkg>" })`.
  This AOSP dialog is universally supported (incl. Chinese OEMs) and reliably
  flips the flag to true on "Allow". `startActivityAsync` resolves when the
  dialog closes, so re-read the status right after.
- Verify a local module is linked before building:
  `pnpm exec expo-modules-autolinking search -p android` must list it.

**Why:** survived 3 config-only fix rounds (perms, FGS type, self-heal heartbeat)
because the actual gap was the Doze exemption never being truly granted/verified.

**Auto-prompt throttle:** the tracking-start routine runs on EVERY app foreground,
so auto-firing the grant dialog whenever `isIgnoring === false` nags the user on
every open until they allow. Gate the auto-prompt with a once-per-launch flag, and
fire-and-forget (don't await) so the dialog never delays the FGS start. Only prompt
on a definitive `false`; `null` = can't read (web/Expo Go/old APK) → skip. Always
also expose a manual "Fix Background Tracking" button as the reliable fallback.

**Note:** AOSP Doze whitelist is separate from OEM autostart/auto-launch (the
other half of the kill problem) — keep both as distinct readiness rows. A wake
lock is a battery-heavy last resort; confirm Doze whitelist is true (and whether
the FGS notification survives screen-off = killed vs throttled) before reaching
for it.
