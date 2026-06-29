---
name: 24/7 background tracking vs OEM battery killers
description: Why a correctly-configured foreground-service location task still stops in the background on Pakistani phones, and the multi-pronged fix (it's NOT just battery optimization).
---

# Background location stops when locked / app swiped — even with all permissions AND battery optimization off

Symptom: technicians grant "Allow all the time" + every location/foreground-service permission, AND manually set battery optimization = unrestricted + background data = allowed — yet tracking STILL sometimes stops. The `expo-location` foreground-service task is configured correctly (`killServiceOnDestroy:false`, `pausesUpdatesAutomatically:false`, `foregroundServiceTypes:["location"]`, `distanceInterval:0`, 60s `timeInterval`).

**The code config is almost never the whole story.** When battery optimization is already off and it still stops, the cause is one (or more) of these, in priority order:

1. **OEM "Autostart" / "Auto-launch" is a SEPARATE setting from battery optimization** — and is the real killer on Xiaomi/MIUI, Oppo/Realme/ColorOS, Vivo/FuntouchOS, Infinix (dominant in Pakistan). Without Autostart, once the OS kills the process the foreground service is **never allowed to relaunch**. Battery-opt "unrestricted" does NOT cover this. There is **no universal Android API** to toggle it — you can only deep-link to the per-OEM Autostart screen (`IntentLauncher`, explicit `packageName`+`className`, ACTION_MAIN, with try/catch + fallback to `APPLICATION_DETAILS_SETTINGS`) and instruct the user. This is the highest-impact device-side fix after battery-opt.

2. **A harmful "started once" gate in the client.** If the app marks tracking "started" permanently after the first success (e.g. a `startedFor` ref) and then early-returns, a service the OEM killed later **never restarts** unless the user logs in again. `startAlwaysOnTracking()` must be called on login AND on every `AppState === "active"` (short throttle). **Caveat — DO NOT trust `hasStartedLocationUpdatesAsync` for self-heal (see [expo-location-restart](expo-location-restart.md)):** it reports *registration*, not liveness, so a killed-but-registered service is skipped and never restarts, AND an upgraded APK keeps the OLD options. Real self-heal needs a heartbeat + config-version forced stop/start.

3. **No network resilience in the background POST.** A fire-and-forget `fetch` with no timeout / no `res.ok` check / no retry silently drops pings on flaky field signal. After ~15min of dropped pings the admin map marks the tech "offline" even though the service is alive. Fix: `AbortController` timeout (~8s), check `res.ok`, retry transient (network/5xx) failures 2–3×, but BAIL on 4xx (a 401 won't be fixed by retrying). Do NOT buffer-and-flush old coordinates: the server stamps receive-time as `updatedAt`, so a late-flushed stale point would overwrite the current position with an old location.

4. **User is still on an old APK** that predates the always-on service. Foreground-service changes only take effect after they install the new build — confirm which APK they have before debugging further.

## "Stops the instant the screen turns off" — that's NOT Doze, it's the FGS not surviving
Immediate stop on screen-off/lock (not after ~30 min) means the location foreground service isn't actually staying alive/visible. Beyond Autostart, these CODE/CONFIG levers matter on Android 13/14:
- **POST_NOTIFICATIONS (Android 13+):** the persistent FGS notification only shows if notifications are granted. A *hidden* FGS notification is killed far more aggressively by OEM power managers. Add the permission AND request it at runtime (expo-notifications) BEFORE `startLocationUpdatesAsync` — not only in the push-token hook.
- **WAKE_LOCK:** expo-location does NOT add it or hold one itself. Declare it so the service/system can keep CPU time for screen-off callbacks + the JS headless POST.
- **`Accuracy.High`, NOT `Balanced` (reversed after field testing):** on a stationary, screen-off phone in Doze, Balanced (fused cell/wifi) frequently goes SILENT because wifi/cell scans get throttled — the exact "tracking stops when locked" symptom. High (GPS) keeps emitting on the time interval while the FGS holds a wakelock; 60s cadence keeps battery sane. See [expo-location-restart](expo-location-restart.md).
- **Bump `android.versionCode` every build:** leaving every build at versionCode 1 makes it impossible to tell which APK a technician actually has — they may be silently running an OLD build that lacks the fixes. Increment it so field verification is reliable.
- Note: Expo's `android.permissions` is an ADD list, not a strict allow-list (only `android.blockedPermissions` strips). It does not silently drop plugin perms — but declare the survival-critical ones explicitly anyway.

## What NOT to reach for
- **`expo-background-fetch` / periodic TaskManager as a "watchdog" is mostly theater** for this failure class: the same OEMs that kill foreground services also throttle/kill background fetch, Android schedules it opportunistically (not on a fixed interval), and after a force-stop it usually won't run at all. Adds EAS/Gradle risk for little gain. Skip it.
- **`RECEIVE_BOOT_COMPLETED` permission alone does not guarantee restart** after reboot — you'd need a real receiver / WorkManager path (higher native/EAS risk).

**Bottom line:** no Expo/Android API can *guarantee* tracking if the OEM or user force-kills the app. The honest, durable fix is: correct foreground service + battery-opt exemption + self-healing restart on every foreground + network retry + a one-time user guide to enable Autostart and lock the app in recents.
