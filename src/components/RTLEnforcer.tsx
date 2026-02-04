import React, { useEffect, useState } from 'react';
import { View, I18nManager, StyleSheet, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * RTL Enforcer - Ensures RTL state matches saved language
 * If there's a mismatch, forces an app reload to apply RTL correctly
 */
export const RTLEnforcer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAndFixRTL = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('user_language');
        const shouldBeRTL = savedLanguage === 'ar';
        const currentRTL = I18nManager.isRTL;
        
        console.log('[RTLEnforcer] ==========================================');
        console.log('[RTLEnforcer] Saved language:', savedLanguage);
        console.log('[RTLEnforcer] Should be RTL:', shouldBeRTL);
        console.log('[RTLEnforcer] I18nManager.isRTL:', currentRTL);
        
        // If there's a mismatch, we need to fix it and reload
        if (currentRTL !== shouldBeRTL) {
          console.log('[RTLEnforcer] ⚠️ RTL MISMATCH DETECTED!');
          console.log('[RTLEnforcer] Current RTL:', currentRTL, 'but should be:', shouldBeRTL);
          console.log('[RTLEnforcer] 🔧 Forcing I18nManager.forceRTL(' + shouldBeRTL + ')');
          
          // Force the correct RTL state
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(shouldBeRTL);
          
          // On iOS, we MUST reload the app for RTL to take effect
          console.log('[RTLEnforcer] 🔄 Reloading app to apply RTL...');
          
          // Small delay to ensure settings are saved
          setTimeout(() => {
            const { RNRestart } = NativeModules;
            if (RNRestart && RNRestart.Restart) {
              RNRestart.Restart();
            } else {
              console.error('[RTLEnforcer] ⚠️ RNRestart not available, reload manually');
            }
          }, 100);
          
          // Don't render yet, we're about to reload
          return;
        }
        
        console.log('[RTLEnforcer] ✅ RTL state is correct');
        console.log('[RTLEnforcer] ==========================================');
        setIsReady(true);
        
      } catch (error) {
        console.error('[RTLEnforcer] Error:', error);
        setIsReady(true);
      }
    };

    checkAndFixRTL();
  }, []);

  if (!isReady) {
    return null; // Wait until RTL check is complete
  }

  return (
    <View style={styles.container}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
