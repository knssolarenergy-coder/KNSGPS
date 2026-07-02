package com.kssolar.trackingwatchdog

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for the auto-revive tracking watchdog. Armed after every
 * successful tracking start (also re-asserted on each app foreground) and
 * disarmed on logout.
 */
class TrackingWatchdogModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TrackingWatchdog")

    Function("setEnabled") { enabled: Boolean ->
      WatchdogCore.setEnabledFromApp(context, enabled)
    }

    Function("getStatus") {
      WatchdogCore.getStatus(context)
    }
  }
}
