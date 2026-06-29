---
name: EAS Android build reliability (ks-solar)
description: Why the standalone Android APK fails to build or crashes on launch, and the durable rules that keep it green.
---

## Running EAS build in Replit — always use EAS_NO_VCS=1

`eas build` in Replit fails with "Destructive git operations are not allowed" because EAS CLI internally runs `git add` to stage untracked files before archiving the project, and Replit's sandbox blocks that.

**Fix:** always prefix with `EAS_NO_VCS=1`:
```
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --profile preview --platform android --non-interactive
```

The command times out waiting for build completion (~10-20 min) — that's expected and fine. The build URL is printed before the timeout; track/download APK from expo.dev. Use `--no-wait` to return immediately after the build is queued.

## APK "request failed" on login (but web works) → wrong EXPO_PUBLIC_DOMAIN

The app picks its API base at build time: web uses `${window.location.origin}/api` (same-origin, always works in preview/deploy), but native/APK hardcodes `https://${EXPO_PUBLIC_DOMAIN}/api`. `EXPO_PUBLIC_DOMAIN` is baked in from the `env` block of the active profile in `artifacts/ks-solar/eas.json` (all three profiles: development/preview/production).

**Symptom:** login works on web simulate but APK shows "request failed" / network error.
**Cause:** `EXPO_PUBLIC_DOMAIN` points to a dead or wrong-account deployment (e.g. an old owner's `*--olduser.replit.app` that returns "This app isn't live yet"). The APK must target the *current* live deployment URL.
**Fix:** set `EXPO_PUBLIC_DOMAIN` to the live deployment host (no `https://`, no trailing slash), verify with `curl https://<host>/api/auth/login` returns a token, then rebuild with `EAS_NO_VCS=1`.
**Why EAS_NO_VCS matters here too:** editing eas.json dirties the working tree; a dirty tree makes EAS attempt a git write (blocked in main agent). `EAS_NO_VCS=1` tarballs the working dir directly, so uncommitted eas.json edits ARE included and no git runs.

# EAS Android build reliability (ks-solar Expo app)

Multiple consecutive `eas build --profile preview --platform android` runs failed with
Gradle "build failed (unknown error)" or built-but-crash-on-launch. Each failure had a
distinct native-config root cause; fixing one revealed the next. The durable rules:

## Rules (each one was a real failure cause)

- **`google-services.json` must be present** at `artifacts/ks-solar/google-services.json`
  with a client whose `package_name` matches `com.kssolar.app`. `expo-notifications`
  turns on the Google Services Gradle plugin, which hard-fails the build if the file is
  missing. A structurally-valid placeholder is enough to BUILD (push delivery needs a
  real Firebase project later). Must NOT be gitignored — EAS needs it in the upload.
  **Why:** this was the persistent "unknown error" that survived several other fixes.

- **Keep native plugins/deps limited to modules actually imported.** Anything that ships
  native code is autolinked and compiled even if unused, enlarging the build surface and
  adding failure points. `expo-camera` was present (plugin + dep) but never imported and
  was removed; `expo-image-picker`'s `launchCameraAsync` already covers camera capture
  and only needs the `CAMERA` permission.

- **No React Compiler.** Remove `babel-plugin-react-compiler` from babel.config.js AND
  `reactCompiler: true` from app.json experiments. The beta compiler crashes Metro during
  the Gradle JS-bundle step. Double-wiring (both places) is especially fatal.

- **`newArchEnabled: true` is MANDATORY, not optional.** react-native-reanimated v4
  (`~4.1`, + `react-native-worklets`) dropped the old architecture entirely. Its
  `assertNewArchitectureEnabledTask` fails the Gradle build **deterministically** with
  "[Reanimated] Reanimated requires new architecture to be enabled" whenever
  `newArchEnabled` is false. New Arch is also the Expo SDK 54 default and is stable for
  this module set. Set it in app.json AND in the `withGradleProperties` plugin (belt &
  suspenders, independent of config-merge order). Verify it landed:
  `gradle.properties` must contain `newArchEnabled=true` after `expo prebuild`.
  **Why:** "New Arch is unstable, keep it off" is a tempting but wrong assumption for
  this stack — reanimated v4 leaves no choice, so never disable New Arch while it (or any
  v4-era worklets dep) is installed. If you ever truly need old arch, you must downgrade
  reanimated to v3 (fights SDK 54 pins) — prefer staying on New Arch.

- **No `react-native-maps`.** Replaced with WebView + Leaflet (`LiveMapModal.native.tsx`);
  react-native-maps without a Google Maps API key crashed on launch.

- **Pin exact native versions to the Expo SDK** via `expo install`; drift breaks Gradle.

- **Intermittent "Gradle build failed with unknown error" is most likely OOM,
  not a deterministic config bug** (deterministic config bugs fail every time).
  The Expo template default compiles 4 ABIs at a low JVM heap, so the heavy C++
  modules (reanimated, worklets) build 4× and can exhaust the EAS worker's memory
  unpredictably ("kabhi build hota hai kabhi nahi"). Mitigation: a local config
  plugin using `withGradleProperties` that trims `reactNativeArchitectures` to
  ARM-only (drop emulator x86/x86_64) and raises `org.gradle.jvmargs`. Trimming
  ABIs is the bigger lever (halves native compile); JVM heap mainly helps
  Gradle/Kotlin, not the external C++ compiler. Safe for real ARM phones, but the
  APK then won't run on x86 emulators/devices. If logs show memory pressure after,
  lower the heap rather than raising it. **Why a custom plugin:**
  expo-build-properties has no field for ABI list or jvmargs in SDK 54, and the
  managed/CNG workflow regenerates gradle.properties on every prebuild, so the
  value must be injected via a config plugin — never edit android/ directly.
  **Confirm root cause before further changes** by reading the EAS "Run gradlew"
  log; local prebuild cannot surface compile/OOM errors (no Android SDK locally).

## How to verify BEFORE burning an EAS build
- `pnpm exec expo config --type prebuild --json` must exit 0 and show
  `android.googleServicesFile` populated — this evaluates every config plugin and surfaces
  misconfig locally (fast) instead of after a multi-minute cloud build.
- `pnpm --filter @workspace/ks-solar run typecheck` must pass.
- Confirm the Expo web bundle has no "Unable to resolve module" lines in the workflow log.

## Crash-on-launch hardening (already in place — keep it)
- `ErrorBoundary` wraps the whole tree in `app/_layout.tsx`.
- Every native module touch (background location task, push-token registration, Haptics,
  SecureStore, localStorage/window) is `Platform.OS` guarded and/or try/caught, including
  module-level `TaskManager.defineTask` and `setNotificationHandler`.
