import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, I18nManager, AppState, Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import i18n, { syncRTLWithLanguage } from './src/locales';
import logRTLDiagnostics from './src/utils/rtlDiagnostics';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { BranchProvider } from './src/contexts/BranchContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { AuthCartSync } from './src/contexts/AuthCartSync';
import { NotificationProvider as NotificationContextProvider } from './src/contexts/NotificationContext';
import { NotificationProvider } from './src/services/NotificationManager';
import { RTLEnforcer } from './src/components/RTLEnforcer';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';
import localNotificationService from './src/services/localNotificationService';

function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [isAppReady, setIsAppReady] = useState<boolean>(false);
  
  useEffect(() => {
    const checkRTLReload = async () => {
      try {
        const needsReload = await AsyncStorage.getItem('rtl_needs_reload');
        
        if (needsReload === 'true') {
          console.log('[APP] 🔄 RTL needs reload flag detected; aligning I18nManager state');

          // Clear the flag early to avoid loops
          await AsyncStorage.removeItem('rtl_needs_reload');

          const storedLanguage = await AsyncStorage.getItem('user_language');
          const shouldBeRTL = storedLanguage === 'ar';
          const currentRTL = I18nManager.isRTL;

          if (currentRTL !== shouldBeRTL) {
            console.log('[APP] Updating I18nManager.isRTL from', currentRTL, 'to', shouldBeRTL);
            try {
              I18nManager.allowRTL(true);
              I18nManager.forceRTL(shouldBeRTL);
              const swapLeftAndRight = (I18nManager as any)?.swapLeftAndRightInRTL;
              if (typeof swapLeftAndRight === 'function') {
                swapLeftAndRight(shouldBeRTL);
              }
            } catch (rtlError) {
              console.warn('[APP] Unable to update I18nManager flags after reload:', rtlError);
            }
          } else {
            console.log('[APP] I18nManager already matches stored language RTL setting.');
          }
        }

        return false;
      } catch (error) {
        console.error('[APP] Error checking RTL reload:', error);
        return false;
      }
    };
    
    // Initialize language before rendering
    const initializeApp = async () => {
      try {
        // First check if we need to reload
        const willReload = await checkRTLReload();
        if (willReload) {
          console.log('[APP] App will reload, skipping initialization');
          return; // Don't initialize, we're about to reload
        }
        
        // Read stored language directly from AsyncStorage
        const storedLanguage = await AsyncStorage.getItem('user_language');

        console.log('[APP] Stored language:', storedLanguage);
        console.log('[APP] I18nManager.isRTL at init:', I18nManager.isRTL);

        await logRTLDiagnostics('App.initializeApp:beforeSync', {
          storedLanguage,
          initRTL: I18nManager.isRTL,
        });

        if (storedLanguage) {
          syncRTLWithLanguage(storedLanguage);
          // Wait a bit for i18n to initialize with the language
          await new Promise(resolve => setTimeout(resolve, 100));

          await logRTLDiagnostics('App.initializeApp:afterSync', {
            storedLanguage,
            postSyncRTL: I18nManager.isRTL,
          });
        }

        setIsAppReady(true);
      } catch (error) {
        console.error('[APP] Error initializing app:', error);
        setIsAppReady(true); // Show app anyway
      }
    };

    // Request permissions on app launch
    const requestAppPermissions = async () => {
      console.log('[APP][DEBUG] 📋 Requesting app permissions...');
      try {
        // For Android 13+ (API level 33+), need to request POST_NOTIFICATIONS permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          console.log('[APP][DEBUG] 📱 Android 13+ detected, requesting POST_NOTIFICATIONS permission...');
          try {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              {
                title: 'Notification Permission',
                message: 'Allow Qabalan Bakery to send you notifications about your orders?',
                buttonPositive: 'Allow',
                buttonNegative: 'Deny',
              }
            );
            console.log('[APP][DEBUG] POST_NOTIFICATIONS permission result:', granted);
            
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log('[APP][DEBUG] ✅ POST_NOTIFICATIONS permission granted');
            } else {
              console.log('[APP][DEBUG] ❌ POST_NOTIFICATIONS permission denied');
            }
          } catch (error) {
            console.error('[APP][DEBUG] ❌ Error requesting POST_NOTIFICATIONS:', error);
          }
        }
        
        // Request notification permissions (for iOS and general Firebase setup)
        console.log('[APP][DEBUG] 🔔 Requesting notification permission...');
        const notificationGranted = await notificationService.requestPermission();
        console.log('[APP][DEBUG] Notification permission:', notificationGranted ? '✅ Granted' : '❌ Denied');
        
        // Check location permission at app startup
        console.log('[APP][DEBUG] 📍 Checking location permission...');
        const locationPermission = Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
        
        const locationStatus = await check(locationPermission);
        console.log('[APP][DEBUG] Location permission status:', locationStatus);
        
        if (locationStatus === RESULTS.DENIED) {
          // Permission has not been requested yet, request it
          console.log('[APP][DEBUG] 📍 Requesting location permission...');
          const result = await request(locationPermission);
          console.log('[APP][DEBUG] Location permission request result:', result);
          
          if (result === RESULTS.GRANTED) {
            console.log('[APP][DEBUG] ✅ Location permission granted');
          } else if (result === RESULTS.BLOCKED) {
            console.log('[APP][DEBUG] ⚠️ Location permission blocked');
          }
        } else if (locationStatus === RESULTS.BLOCKED) {
          // Permission is blocked, show alert to guide user to settings
          console.log('[APP][DEBUG] ⚠️ Location permission is blocked, prompting user to enable in settings');
          
          setTimeout(() => {
            Alert.alert(
              i18n.t('common.locationPermissionTitle'),
              i18n.t('common.locationPermissionMessage'),
              [
                {
                  text: i18n.t('common.cancel'),
                  style: 'cancel',
                },
                {
                  text: i18n.t('common.openSettings'),
                  onPress: () => {
                    console.log('[APP][DEBUG] 📱 Opening settings...');
                    openSettings().catch(() => {
                      console.warn('[APP][DEBUG] ⚠️ Could not open settings');
                    });
                  },
                },
              ]
            );
          }, 2000); // Delay to ensure app is fully loaded
        } else if (locationStatus === RESULTS.GRANTED) {
          console.log('[APP][DEBUG] ✅ Location permission already granted');
        }
      } catch (error) {
        console.error('[APP][DEBUG] ❌ Error requesting permissions:', error);
      }
    };

    // Initialize notifications after navigation is ready
    const initializeNotifications = async () => {
      console.log('[APP][DEBUG] 🚀 Starting notification initialization...');
      try {
        // Wait for navigation ref to be ready
        if (navigationRef.current) {
          console.log('[APP][DEBUG] 🧭 Navigation ref is ready');
          await notificationService.initialize(navigationRef.current);
          console.log('[APP][DEBUG] ✅ Notification service initialized in App.tsx');
        } else {
          console.log('[APP][DEBUG] ⏳ Navigation ref not ready, retrying...');
          // Retry after a short delay
          setTimeout(async () => {
            if (navigationRef.current) {
              await notificationService.initialize(navigationRef.current);
              console.log('[APP][DEBUG] ✅ Notification service initialized (delayed)');
            } else {
              console.log('[APP][DEBUG] ⚠️ Navigation ref still not ready, initializing without ref');
              await notificationService.initialize();
            }
          }, 500);
        }
      } catch (error) {
        console.error('[APP][DEBUG] ❌ Failed to initialize notification service:', error);
      }
    };

    // Handle app state changes to check for notifications when app becomes active
    const handleAppStateChange = (nextAppState: string) => {
      console.log('[APP][DEBUG] 🔄 App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        console.log('[APP][DEBUG] 📱 App became active - checking for missed notifications...');
        // Check for any notifications that might have been received while app was in background
        setTimeout(() => {
          notificationService.checkForMissedNotifications();
          // Re-register FCM token with backend to keep it up-to-date
          notificationService.refreshToken();
        }, 1000); // Small delay to ensure app is fully active
      }
    };

    initializeApp();
    const handleLanguageChanged = (lng: string) => {
      syncRTLWithLanguage(lng);
      console.log('[APP] Language changed to:', lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    
    // Delay permission requests to ensure app UI is fully rendered
    // This ensures permission dialogs show properly on first install
    const permissionRequestTimer = setTimeout(() => {
      requestAppPermissions();
      initializeNotifications();
    }, 1000); // 1 second delay to ensure UI is ready

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      clearTimeout(permissionRequestTimer);
      appStateSubscription?.remove();
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  // Show nothing until language is initialized
  if (!isAppReady) {
    return null;
  }

  // Read RTL state to apply to SafeAreaView
  const isRTL = I18nManager.isRTL;
  console.log('[APP] Rendering with I18nManager.isRTL:', isRTL);

  return (
    <RTLEnforcer>
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#fff',
            direction: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
          } as any}
          edges={['top', 'left', 'right']}
        >
          <I18nextProvider i18n={i18n}>
            <LanguageProvider>
              <BranchProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <NotificationContextProvider>
                      <CartProvider>
                        <AuthCartSync>
                          <StatusBar barStyle="dark-content" />
                          <AppNavigator navigationRef={navigationRef as React.RefObject<NavigationContainerRef<any>>} />
                        </AuthCartSync>
                      </CartProvider>
                    </NotificationContextProvider>
                  </NotificationProvider>
                </AuthProvider>
              </BranchProvider>
            </LanguageProvider>
          </I18nextProvider>
        </SafeAreaView>
      </SafeAreaProvider>
    </RTLEnforcer>
  );
}

export default App;
