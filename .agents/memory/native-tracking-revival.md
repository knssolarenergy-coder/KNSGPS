---
name: Native tracking revival (watchdog)
description: How to natively revive the expo-location foreground tracking task after an OEM app-kill, and the gotchas that make or break it
---

# Native revival of expo-location tracking after OEM kill

**Rule:** To revive expo-location background tracking (service + notification) from a headless process (alarm/boot receiver), construct `expo.modules.taskManager.TaskService(applicationContext)` — it restores all persisted tasks in a fresh process and is a no-op when the process is alive (static in-memory repo). BUT you must first reflectively force `expo.modules.location.AppForegroundedSingleton.isForegrounded = true` (INSTANCE field, `isForegrounded()`/`setForegrounded(boolean)`), else `maybeStartForegroundService()` silently refuses and you get throttled background-rate fixes with NO notification. Restore the flag after.

**Why:** Verified in expo-task-manager 14.0.9 / expo-location 19.0.8 sources — the foreground gate exists precisely to block FGS starts from the background; the stock BOOT_COMPLETED restore path suffers the same degradation. FGS start from background is legal only because the app is Doze-whitelisted; without it Android 12+ throws `ForegroundServiceStartNotAllowedException` (wrapped in `InvocationTargetException` — unwrap `t.cause` when recording errors).

**How to apply:** The `tracking-watchdog` local module implements this (2-min self-chaining `setExactAndAllowWhileIdle` + 15-min WorkManager backstop + boot receiver). Use reflection, not compile deps, so expo upgrades degrade to a recorded diagnostics error instead of a Gradle failure. Detect "real revival" via a process-static boolean (fresh process = app had been killed). Gate on the `TaskManagerModule` SharedPreferences containing the task name (logout = nothing persisted = no-op). Use `commit()` not `apply()` in receiver-spawned processes. HiOS "Force stop" and disabled Autostart still kill the alarm chain — unrecoverable by design; keep the honest copy.

**Hard limits:** deep Doze throttles even exact allow-while-idle alarms to ~1 per 9 min; force-stop cancels alarms + jobs until manual relaunch.
