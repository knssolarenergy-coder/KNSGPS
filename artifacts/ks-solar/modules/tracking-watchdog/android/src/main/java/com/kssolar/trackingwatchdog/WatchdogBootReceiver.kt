package com.kssolar.trackingwatchdog

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-arms the alarm chain after a reboot or an app update (alarms do not
 * survive either). Also runs a full watchdog pass: expo-task-manager's own
 * boot receiver restores the task registration, but its foreground-service
 * start is gated on the app being foregrounded — our pass forces that gate
 * open so the notification + full-rate tracking come back on boot too.
 */
class WatchdogBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!WatchdogCore.isEnabled(context)) return
    WatchdogCore.runWatchdogPass(context, "boot")
  }
}
