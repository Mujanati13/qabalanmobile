package com.mobileapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(ReactNativePushNotificationPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    loadReactNative(this)
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(NotificationManager::class.java)
      
      // Create default notification channel
      val defaultChannel = NotificationChannel(
        "default",
        "Default Notifications",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Default notification channel for the app"
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
      }
      
      // Create support notification channel
      val supportChannel = NotificationChannel(
        "support",
        "Support Notifications",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifications for support ticket updates"
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
      }
      
      // Create order notification channel
      val orderChannel = NotificationChannel(
        "orders",
        "Order Notifications",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifications for order updates"
        enableLights(true)
        enableVibration(true)
        setShowBadge(true)
      }
      
      notificationManager.createNotificationChannel(defaultChannel)
      notificationManager.createNotificationChannel(supportChannel)
      notificationManager.createNotificationChannel(orderChannel)
    }
  }
}
