package com.kssolar.trackingwatchdog

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * One-shot background job for the native upload fallback. The alarm/boot
 * receivers run on the main thread with a ~10s budget — far too tight for a
 * GPS fix + HTTP POST — so they enqueue this worker, which gets a generous
 * background-thread budget from WorkManager.
 */
class NativePingWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    WatchdogCore.nativePing(applicationContext)
    return Result.success()
  }
}
