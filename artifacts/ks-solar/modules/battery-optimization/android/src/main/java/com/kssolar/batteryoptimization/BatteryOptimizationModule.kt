package com.kssolar.batteryoptimization

import android.content.Context
import android.os.PowerManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tiny native bridge that reports whether THIS app is on the Android Doze
 * battery-optimization whitelist (PowerManager.isIgnoringBatteryOptimizations).
 *
 * Why this exists: the OEM per-app "Battery: Unrestricted / No restriction"
 * toggle is NOT the same thing as the AOSP Doze whitelist. On many Pakistani
 * budget ROMs (Infinix/Tecno/Realme/Oppo/Vivo) a user can set "no restriction"
 * while the app is still NOT Doze-whitelisted, so a foreground-service location
 * task gets throttled/killed ~5 min after the screen turns off. The readiness
 * gate previously self-attested this with a checkbox; this module lets us read
 * the REAL state and turn the row green only when the exemption is truly granted.
 */
class BatteryOptimizationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BatteryOptimization")

    Function("isIgnoringBatteryOptimizations") {
      val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }
  }
}
