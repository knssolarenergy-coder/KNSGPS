package com.kssolar.trackingwatchdog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Target of the self-chaining ~2-minute exact alarm. When the OEM killed the
 * app, this receiver spawns a fresh (headless) process; the watchdog pass then
 * restores the persisted tracking task, which restarts the foreground service
 * and its notification.
 */
class WatchdogAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!WatchdogCore.isEnabled(context)) return
    WatchdogCore.runWatchdogPass(context, "alarm")
  }
}
