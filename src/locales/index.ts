import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Settings } from 'react-native';
import { en } from './en';
import { ar } from './ar';
import RNRestart from 'react-native-restart';
import logRTLDiagnostics from '../utils/rtlDiagnostics';

// Storage key for language preference
export const LANGUAGE_STORAGE_KEY = 'user_language';
const DEFAULT_LANGUAGE = 'en';

// Available languages
export const LANGUAGES = {
  en: 'English',
  ar: 'العربية',
};

// Resources
const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

// Get device language
// Get stored language or device language
const getStoredLanguage = async (): Promise<string> => {
  try {
    const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    console.log('[Locales] AsyncStorage language:', storedLanguage);

    if (storedLanguage) {
      return storedLanguage;
    }

    const nativeLanguage = Settings.get('user_language') as string | undefined;
    console.log('[Locales] Native Settings language (fallback):', nativeLanguage);

    if (nativeLanguage) {
      return nativeLanguage;
    }

    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('Error getting stored language:', error);
    return DEFAULT_LANGUAGE;
  }
};

export const syncRTLWithLanguage = (language: string) => {
  // Properly set RTL based on language
  // Arabic = RTL (true), English = LTR (false)
  const shouldUseRTL = language === 'ar';
  const currentRTL = I18nManager.isRTL;

  void logRTLDiagnostics('syncRTLWithLanguage:entry', {
    language,
    shouldUseRTL,
    currentRTL,
  });

  try {
    Settings.set({ user_language: language });
    console.log('[syncRTLWithLanguage] ✅ Saved to native Settings:', language);
  } catch (error) {
    console.warn('[syncRTLWithLanguage] Unable to update native user_language during sync:', error);
  }

  try {
    const currentSettings = Settings.get('user_language');
    console.log('[syncRTLWithLanguage] Native user_language setting now:', currentSettings);
  } catch (readError) {
    console.warn('[syncRTLWithLanguage] Failed to read back native user_language:', readError);
  }

  try {
    I18nManager.allowRTL(true);
  } catch (allowError) {
    console.warn('[syncRTLWithLanguage] Unable to ensure allowRTL(true):', allowError);
  }

  const swapLeftAndRight = (I18nManager as any)?.swapLeftAndRightInRTL;
  if (typeof swapLeftAndRight === 'function') {
    try {
      swapLeftAndRight(shouldUseRTL);
      console.log('[syncRTLWithLanguage] ✅ Set swapLeftAndRightInRTL:', shouldUseRTL);
    } catch (swapError) {
      console.warn('[syncRTLWithLanguage] Unable to update swapLeftAndRightInRTL flag:', swapError);
    }
  }

  // Apply RTL setting based on language (Arabic = RTL, English = LTR)
  if (currentRTL !== shouldUseRTL) {
    console.log(`[syncRTLWithLanguage] Setting I18nManager.forceRTL(${shouldUseRTL}) for language: ${language}`);
    try {
      I18nManager.forceRTL(shouldUseRTL);
      console.log('[syncRTLWithLanguage] ✅ RTL setting applied (requires app restart to take effect)');
    } catch (managerError) {
      console.warn('[syncRTLWithLanguage] Unable to update I18nManager flags:', managerError);
    }
  } else {
    console.log(`[syncRTLWithLanguage] I18nManager already set correctly (RTL=${currentRTL})`);
  }

  console.log(`[syncRTLWithLanguage] Language synced to ${language}. RTL=${shouldUseRTL}`);

  void logRTLDiagnostics('syncRTLWithLanguage:exit', {
    language,
    shouldUseRTL,
    resultingRTL: I18nManager.isRTL,
  });
};

// Store language preference
export const setLanguage = async (language: string): Promise<void> => {
  try {
    console.log('[Locales] setLanguage called with:', language);
    await logRTLDiagnostics('setLanguage:before', { language });
    
    // Save to AsyncStorage (key: 'user_language')
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    console.log('[Locales] ✅ Saved to AsyncStorage with key:', LANGUAGE_STORAGE_KEY);
    
    // Also save to native Settings for AppDelegate to read
    try {
      Settings.set({ user_language: language });
      console.log('[Locales] ✅ Saved to native Settings (UserDefaults): user_language =', language);
    } catch (settingsError) {
      console.warn('[Locales] ⚠️ Failed to persist language to native settings:', settingsError);
    }
    
    // Change i18n language
    await i18n.changeLanguage(language);
    console.log('[Locales] ✅ i18n language changed to:', language);
    
    console.log('[Locales] ✅ Language set complete:', language);
    await logRTLDiagnostics('setLanguage:after', {
      language,
      i18nLanguage: i18n.language,
      isRTL: I18nManager.isRTL,
    });
  } catch (error) {
    console.error('[Locales] ❌ Error storing language:', error);
  }
};

// Get current language
export const getCurrentLanguage = (): string => {
  // Return i18n language if initialized, otherwise default
  if (i18n.isInitialized && i18n.language) {
    return i18n.language;
  }
  return DEFAULT_LANGUAGE;
};

// Get current language async (reads from storage if i18n not ready)
export const getCurrentLanguageAsync = async (): Promise<string> => {
  if (i18n.isInitialized && i18n.language) {
    console.log('[Locales] getCurrentLanguageAsync from i18n:', i18n.language);
    return i18n.language;
  }
  const stored = await getStoredLanguage();
  console.log('[Locales] getCurrentLanguageAsync from storage:', stored);
  return stored;
};

// Check if current language is RTL
export const isRTL = (): boolean => {
  const currentLanguage = getCurrentLanguage();
  return currentLanguage === 'ar';
};

// Initialize i18n
const initI18n = async () => {
  const language = await getStoredLanguage();
  const initialLanguage = language || DEFAULT_LANGUAGE;

  await logRTLDiagnostics('initI18n:resolvedLanguage', {
    storedLanguage: language,
    initialLanguage,
  });

  syncRTLWithLanguage(initialLanguage);
  
  i18n
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: DEFAULT_LANGUAGE,
      debug: __DEV__,
      resources,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  await logRTLDiagnostics('initI18n:afterInit', {
    activeLanguage: i18n.language,
    isRTL: I18nManager.isRTL,
  });
};

// Initialize on app start
initI18n();

export { DEFAULT_LANGUAGE };
export default i18n;
