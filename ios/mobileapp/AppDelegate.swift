import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // FORCE RTL LAYOUT AT NATIVE LEVEL
    // AsyncStorage stores in UserDefaults under a prefixed key
    // The actual key format is: RCTAsyncLocalStorage_V2:user_language
    let defaults = UserDefaults.standard
    
    // Debug: Print ALL keys that contain 'language'
    let allKeys = defaults.dictionaryRepresentation().keys
    let languageKeys = allKeys.filter { $0.contains("language") || $0.contains("user") }
    print("[AppDelegate] Keys containing 'language' or 'user':", languageKeys)
    
    // Try both possible AsyncStorage key formats
    var storedLanguage = defaults.string(forKey: "RCTAsyncLocalStorage_V2:user_language")
    print("[AppDelegate] Read from 'RCTAsyncLocalStorage_V2:user_language':", storedLanguage ?? "nil")
    
    if storedLanguage == nil {
      storedLanguage = defaults.string(forKey: "user_language")
      print("[AppDelegate] Read from 'user_language':", storedLanguage ?? "nil")
    }
    
    let language = storedLanguage ?? "en"
    // FORCE LTR (left-to-right) for ALL languages including Arabic
    let shouldUseRTL = false  // Always FALSE to force left-aligned text
    
    print("[AppDelegate] ==========================================")
    print("[AppDelegate] Final language value: '\(language)'")
    print("[AppDelegate] FORCING LTR (left-to-right) for all text")
    print("[AppDelegate] Should use RTL: \(shouldUseRTL) (always false)")
    print("[AppDelegate] ==========================================")
    
    // Set React Native's I18nManager flags in UserDefaults - all to FALSE for LTR
    defaults.set(shouldUseRTL, forKey: "RCTI18nUtil_forceRTL")
    defaults.set(false, forKey: "RCTI18nUtil_allowRTL")  // Disable RTL completely
    defaults.set(shouldUseRTL, forKey: "RCTI18nUtil_swapLeftAndRight")
    defaults.synchronize()

    if let i18nUtil = RCTI18nUtil.sharedInstance() {
      i18nUtil.allowRTL(false)  // Disable RTL completely
      i18nUtil.forceRTL(false)  // Force LTR always
      i18nUtil.swapLeftAndRight(inRTL: false)  // No swapping

      print("[AppDelegate] RCTI18nUtil -> FORCED LTR: allowRTL: \(i18nUtil.isRTLAllowed()), forceRTL: \(i18nUtil.isRTLForced())")
    } else {
      print("[AppDelegate] ⚠️ Unable to access RCTI18nUtil.sharedInstance()")
    }

    let forceRTLDefault = defaults.bool(forKey: "RCTI18nUtil_forceRTL")
    let allowRTLDefault = defaults.bool(forKey: "RCTI18nUtil_allowRTL")
    let swapDefault = defaults.bool(forKey: "RCTI18nUtil_swapLeftAndRight")

    print("[AppDelegate] RN Defaults -> forceRTL: \(forceRTLDefault), allowRTL: \(allowRTLDefault), swap: \(swapDefault)")

    // Always force LTR layout
    let semanticAttribute: UISemanticContentAttribute = .forceLeftToRight

    let applySemantic: (UISemanticContentAttribute) -> Void = { attribute in
      UIView.appearance().semanticContentAttribute = attribute
      UINavigationBar.appearance().semanticContentAttribute = attribute
      UITabBar.appearance().semanticContentAttribute = attribute
      UILabel.appearance().semanticContentAttribute = attribute
      UITextField.appearance().semanticContentAttribute = attribute
      UITextView.appearance().semanticContentAttribute = attribute
      UISearchBar.appearance().semanticContentAttribute = attribute
      UIStackView.appearance().semanticContentAttribute = attribute
      UIScrollView.appearance().semanticContentAttribute = attribute
      UIButton.appearance().semanticContentAttribute = attribute
    }

    if shouldUseRTL {
      // Force RTL layout at iOS native level
      applySemantic(semanticAttribute)
      print("[AppDelegate] ✅ Forced RTL layout at native level; semantic attribute applied: \(semanticAttribute.rawValue)")
    } else {
      applySemantic(semanticAttribute)
      print("[AppDelegate] ✅ Forced LTR layout at native level; semantic attribute applied: \(semanticAttribute.rawValue)")
    }
    
    // Configure Firebase
    FirebaseApp.configure()
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "mobileapp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  // Push notification handlers are temporarily disabled
  // They will be enabled after Xcode project configuration
  // TODO: Re-enable push notifications after adding NotificationBridge files to Xcode project
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
