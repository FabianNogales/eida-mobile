package bo.eida.control.clock

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.Exceptions

// Source module, not generated android/. elapsedRealtime includes deep sleep.
class EidaOfflineClockModule : Module() {
  private var manager: ConnectivityManager? = null
  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) = publishConnection(null)
    override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) =
      publishConnection(capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))
    override fun onLost(network: Network) = publishConnection(false)
  }

  private fun connectivity(): ConnectivityManager =
    appContext.reactContext?.getSystemService(ConnectivityManager::class.java) ?: throw Exceptions.ReactContextLost()

  private fun publishConnection(connected: Boolean?) {
    sendEvent("onConnectivityChanged", mapOf("connected" to connected))
  }

  private fun stopObservingConnectivity() {
    manager?.unregisterNetworkCallback(callback)
    manager = null
  }

  override fun definition() = ModuleDefinition {
    Name("EidaOfflineClock")
    Events("onConnectivityChanged")
    OnStartObserving {
      val service = connectivity()
      service.registerDefaultNetworkCallback(callback)
      manager = service
    }
    OnStopObserving { stopObservingConnectivity() }
    OnDestroy { stopObservingConnectivity() }
    AsyncFunction("connectionIsValidated") {
      val service = connectivity()
      val network = service.activeNetwork
      network != null && service.getNetworkCapabilities(network)
        ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    }
    AsyncFunction("sample") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
      check(boot >= 0) { "Boot identifier unavailable; online revalidation required" }
      mapOf("boot" to boot.toString(), "elapsed" to SystemClock.elapsedRealtime().toDouble())
    }
  }
}
