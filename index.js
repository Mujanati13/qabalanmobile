/**
 * @format
 */

import { AppRegistry, I18nManager, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { name as appName } from './app.json';

console.log('[INDEX][RTL] =============================================');
console.log('[INDEX][RTL] Pre-initialization RTL check...');

// CRITICAL: Force LTR layout for all text
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Read initial state from native
console.log('[INDEX][RTL] Initial I18nManager.isRTL:', I18nManager.isRTL);

// Register app immediately (must be synchronous)
console.log('[INDEX][RTL] Registering app with I18nManager.isRTL:', I18nManager.isRTL);
AppRegistry.registerComponent(appName, () => App);

// Initialize RTL settings asynchronously (in background)
async function initializeRTLSettings() {
  try {
    console.log('[INDEX][RTL] Forcing LTR layout for all languages...');
    const savedLanguage = await AsyncStorage.getItem('user_language');
    
    console.log('[INDEX][RTL] ─────────────────────────────────────────────');
    console.log('[INDEX][RTL] Saved language:', savedLanguage);
    console.log('[INDEX][RTL] Forced LTR (left-to-right) for all text');
    console.log('[INDEX][RTL] Current I18nManager.isRTL:', I18nManager.isRTL);
    
    // Always force LTR, regardless of language
    I18nManager.forceRTL(false);
    
    console.log('[INDEX][RTL] ✅ After forcing LTR, I18nManager.isRTL:', I18nManager.isRTL);
    console.log('[INDEX][RTL] =============================================');
    
  } catch (error) {
    console.error('[INDEX][RTL] ❌ Error reading AsyncStorage:', error);
    // Default to LTR on error
    I18nManager.forceRTL(false);
  }
}

// Start RTL initialization in background
initializeRTLSettings();
