package com.kssolar.trackingwatchdog

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * 15-minute WorkManager backstop: revives tracking AND re-asserts the exact
 * alarm chain for the cases where the alarm grant was revoked or the OEM
 * cleared pending alarms. WorkManager persists across reboots on its own.
 */
class WatchdogWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    if (WatchdogCore.isEnabled(applicationContext)) {
      WatchdogCore.runWatchdogPass(applicationContext, "worker")
    }
    return Result.success()
  }
}
