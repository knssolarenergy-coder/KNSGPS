package com.kssolar.trackingwatchdog

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Auto-revive watchdog for the expo-location background tracking task.
 *
 * Problem: on Tecno/HiOS (and similar OEM ROMs) swiping the app from recents or
 * swiping the persistent "Location Active" notification kills the app process,
 * and tracking only comes back when the technician manually reopens the app.
 *
 * Mechanism (verified against expo-task-manager 14.0.9 / expo-location 19.0.8
 * sources): expo-task-manager persists task registrations in the
 * "TaskManagerModule" SharedPreferences and restores ALL of them whenever a
 * `TaskService` is constructed in a fresh process — this is exactly how its own
 * BOOT_COMPLETED receiver revives tasks after reboot. Restoring the location
 * task runs LocationTaskConsumer.didRegister -> startLocationUpdates() +
 * maybeStartForegroundService(), which brings back tracking AND the
 * notification without any JS/UI. In a process where tasks are already
 * registered the constructor is a no-op (static in-memory repo), so the pass is
 * idempotent and safe to run every ~2 minutes.
 *
 * One catch: maybeStartForegroundService() refuses to start the foreground
 * service while `AppForegroundedSingleton.isForegrounded` is false — which it
 * always is in a headless process. We force the flag true around the restore
 * (and put it back after). Starting an FGS from the background is legal here
 * because the app holds the battery-optimization exemption (the setup gate
 * enforces it); without the exemption Android 12+ throws
 * ForegroundServiceStartNotAllowedException, which we record so the
 * diagnostics panel can show the real reason.
 *
 * Reflection is used for both expo internals on purpose: if a future expo
 * upgrade renames them, the watchdog degrades to a recorded error visible in
 * diagnostics instead of a hard Gradle build failure.
 *
 * Hard limits (Android design, no app can beat them):
 * - "Force stop" from system settings cancels alarms + jobs; nothing revives
 *   until the app is manually reopened.
 * - In deep Doze, even setExactAndAllowWhileIdle is throttled to roughly one
 *   alarm per ~9 minutes — worst-case revival latency.
 */
object WatchdogCore {
  private const val TAG = "KSTrackingWatchdog"
  private const val PREFS_NAME = "KSTrackingWatchdog"
  private const val KEY_ENABLED = "enabled"
  private const val KEY_LAST_RUN_TS = "lastRunTs"
  private const val KEY_LAST_RUN_SOURCE = "lastRunSource"
  private const val KEY_LAST_REVIVAL_TS = "lastRevivalTs"
  private const val KEY_LAST_ERROR = "lastError"

  // ~2-minute revival target. setExactAndAllowWhileIdle is one-shot, so every
  // pass schedules the next alarm (self-chaining).
  private const val INTERVAL_MS = 2L * 60L * 1000L
  private const val ALARM_REQUEST_CODE = 470_012

  private const val WORK_NAME = "ks-tracking-watchdog"

  // expo-task-manager persists registrations here; when no entry mentions our
  // task, the user is logged out / tracking was never started — nothing to revive.
  private const val TASK_MANAGER_PREFS = "TaskManagerModule"
  private const val LOCATION_TASK_NAME = "ks-solar-bg-location"

  // True once app/module code has run in this process. When a watchdog pass
  // finds it false, the process was spawned by the alarm/worker/boot receiver
  // itself — i.e. the app had been killed and this pass is an actual revival.
  @Volatile private var processAlreadySeen = false

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun isEnabled(context: Context): Boolean = prefs(context).getBoolean(KEY_ENABLED, false)

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    return am.canScheduleExactAlarms()
  }

  /**
   * Called from JS while the app is running — marks the process as seen so
   * in-app alarm passes are never miscounted as revivals, then (re)arms or
   * disarms the alarm chain + worker. Re-arming on every app foreground is
   * intentional self-healing: it restores the chain if the OEM cleared it.
   */
  fun setEnabledFromApp(context: Context, enabled: Boolean) {
    processAlreadySeen = true
    val app = context.applicationContext
    prefs(app).edit().putBoolean(KEY_ENABLED, enabled).apply()
    if (enabled) {
      scheduleNextAlarm(app)
      scheduleWorker(app)
    } else {
      cancelAlarm(app)
      cancelWorker(app)
    }
  }

  fun getStatus(context: Context): Map<String, Any?> {
    val p = prefs(context)
    return mapOf(
      "enabled" to p.getBoolean(KEY_ENABLED, false),
      "canScheduleExactAlarms" to canScheduleExactAlarms(context),
      "lastRunTs" to p.getLong(KEY_LAST_RUN_TS, 0L).toDouble(),
      "lastRunSource" to p.getString(KEY_LAST_RUN_SOURCE, null),
      "lastRevivalTs" to p.getLong(KEY_LAST_REVIVAL_TS, 0L).toDouble(),
      "lastError" to p.getString(KEY_LAST_ERROR, null)
    )
  }

  /**
   * One watchdog pass: restore the persisted tracking task (revival when the
   * process is fresh), then chain the next exact alarm. Called from the alarm
   * receiver, the periodic worker and the boot receiver.
   */
  fun runWatchdogPass(context: Context, source: String) {
    val app = context.applicationContext
    val wasFresh = !processAlreadySeen
    processAlreadySeen = true
    // commit(), not apply(): a receiver-spawned process can be torn down right
    // after onReceive returns, and diagnostics must survive that.
    prefs(app).edit()
      .putLong(KEY_LAST_RUN_TS, System.currentTimeMillis())
      .putString(KEY_LAST_RUN_SOURCE, source)
      .commit()
    try {
      if (!hasPersistedTrackingTask(app)) {
        recordError(app, "No persisted tracking task (logged out or tracking never started)")
      } else {
        reviveTrackingTask(app)
        // Any successful pass clears a stale error; only a fresh-process pass
        // counts as an actual revival (the app had been killed).
        val editor = prefs(app).edit().remove(KEY_LAST_ERROR)
        if (wasFresh) {
          editor.putLong(KEY_LAST_REVIVAL_TS, System.currentTimeMillis())
        }
        editor.commit()
      }
    } catch (t: Throwable) {
      Log.w(TAG, "Watchdog revive failed", t)
      // InvocationTargetException hides the real cause (e.g.
      // ForegroundServiceStartNotAllowedException) — surface the cause.
      recordError(app, (t.cause ?: t).toString().take(300))
    }
    // Always re-assert the chain so a revoked-then-restored exact-alarm grant
    // (or an OEM alarm wipe) heals itself on the next worker/boot pass.
    scheduleNextAlarm(app)
  }

  private fun recordError(context: Context, message: String) {
    prefs(context).edit().putString(KEY_LAST_ERROR, message).commit()
  }

  private fun hasPersistedTrackingTask(context: Context): Boolean {
    return try {
      val tm = context.getSharedPreferences(TASK_MANAGER_PREFS, Context.MODE_PRIVATE)
      tm.all.values.any { it is String && it.contains(LOCATION_TASK_NAME) }
    } catch (t: Throwable) {
      false
    }
  }

  private fun reviveTrackingTask(context: Context) {
    val app = context.applicationContext
    val singletonClass = Class.forName("expo.modules.location.AppForegroundedSingleton")
    val instance = singletonClass.getField("INSTANCE").get(null)
    val getter = singletonClass.getMethod("isForegrounded")
    val setter = singletonClass.getMethod("setForegrounded", Boolean::class.javaPrimitiveType)
    val previous = getter.invoke(instance) as? Boolean ?: false
    // Force the foreground gate open so LocationTaskConsumer actually starts
    // the foreground service (notification + unthrottled tracking) headlessly.
    setter.invoke(instance, true)
    try {
      // MUST be the application context: the receiver's own context is a
      // ReceiverRestrictedContext that throws on bindService(), which the
      // location consumer calls right after startForegroundService().
      Class.forName("expo.modules.taskManager.TaskService")
        .getConstructor(Context::class.java)
        .newInstance(app)
    } finally {
      setter.invoke(instance, previous)
    }
  }

  fun scheduleNextAlarm(context: Context) {
    val app = context.applicationContext
    val am = app.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val pi = alarmPendingIntent(app)
    val triggerAt = System.currentTimeMillis() + INTERVAL_MS
    try {
      if (canScheduleExactAlarms(app)) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
      } else {
        // Exact-alarm grant missing/revoked — inexact allow-while-idle still
        // fires, just batched (typically ~15 min windows).
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
      }
    } catch (se: SecurityException) {
      // Grant revoked between the check and the call — degrade to inexact.
      try {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
      } catch (_: Throwable) {
      }
    }
  }

  private fun cancelAlarm(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    am.cancel(alarmPendingIntent(context))
  }

  private fun alarmPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, WatchdogAlarmReceiver::class.java)
    return PendingIntent.getBroadcast(
      context,
      ALARM_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun scheduleWorker(context: Context) {
    try {
      val request = PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context.applicationContext)
        .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to schedule watchdog worker", t)
    }
  }

  private fun cancelWorker(context: Context) {
    try {
      WorkManager.getInstance(context.applicationContext).cancelUniqueWork(WORK_NAME)
    } catch (_: Throwable) {
    }
  }
}
