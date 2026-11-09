package bo.eida.control.clock

import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions

// Source module, not generated android/. elapsedRealtime includes deep sleep.
class EidaOfflineClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EidaOfflineClock")
    AsyncFunction("sample") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
      check(boot >= 0) { "Boot identifier unavailable; online revalidation required" }
      mapOf("boot" to boot.toString(), "elapsed" to SystemClock.elapsedRealtime().toDouble())
    }
  }
}
