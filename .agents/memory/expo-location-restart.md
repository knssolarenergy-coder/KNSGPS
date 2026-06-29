---
name: Expo background-location restart & config-version
description: hasStartedLocationUpdatesAsync reports registration, not liveness — persisted registration hides dead services AND stale options across app upgrades; needs a heartbeat + config-version forced restart.
---

# Expo background-location: restart reliability on Android

`Location.hasStartedLocationUpdatesAsync(TASK)` reports that the task is **registered** (persisted by TaskManager), NOT that the foreground-service is actually alive or running the current options. That registration survives **both**:
- an OEM battery-manager / Doze **kill** of the service (very common on budget Android in Pakistan: Infinix/Tecno/Xiaomi/Realme/Oppo/Vivo), and
- an **app upgrade** (new APK installed over the old one).

**Two consequences (both bit this app):**
1. **Dead-but-registered = no self-heal.** Guarding start with `if (!hasStarted) start()` means a service the OS killed is never restarted, because `hasStarted` stays true. Symptom: "tracking works a while, dies after screen-off/lock, and does NOT restart even after unlocking / reopening the app."
2. **Stale options on upgrade.** Changing `startLocationUpdatesAsync` options (e.g. `Accuracy.Balanced` → `High`) has **no effect on already-installed phones** — the old registration is reused and `start()` is never re-called. The change only reaches *fresh installs* unless a restart is forced.

**The fix (in `backgroundLocationTask.ts`):**
- Write a **heartbeat** timestamp from the TaskManager handler on every received fix, plus a **started-at** timestamp and a **config-version** string when `start()` succeeds.
- In `startAlwaysOnTracking()` (called on login + every app foreground via `_layout`), force `stop()` then `start()` when the registration is **stale** (`now - max(lastFix, startedAt) > ~5min`) OR the **config-version mismatches**. Bump the config-version constant whenever the options change.
- Make the readiness gate's "service running" check use heartbeat liveness (`getTrackingLiveness`), not raw `hasStarted`, or it shows false-green over a dead service.

**Why ~5 min staleness + a started-at grace:** tolerates GPS cold start / weak indoor signal so the foreground ensure() does not thrash-restart before the first fix arrives.

**Hard limit (no code fix exists):** if the user only *unlocks* the phone but never *reopens* the app, JS never runs, so a killed service cannot self-restart. Expo managed has no supported BOOT/UNLOCK/AlarmManager/WorkManager watchdog to relaunch a killed foreground-location task on Android 14/15, and a **force-stopped** app cannot recover until manually launched. So OEM autostart + battery-unrestricted + recents-lock (guided in `TrackingSetupGate` / `useTrackingReadiness`) remain mandatory to *prevent* the kill in the first place.
