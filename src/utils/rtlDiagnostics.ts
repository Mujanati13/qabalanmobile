import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, NativeModules, Platform, Settings } from 'react-native';

const LANGUAGE_STORAGE_KEY = 'user_language';
const RTL_RELOAD_FLAG_KEY = 'rtl_needs_reload';

type Extras = Record<string, unknown>;

type SafeNativeSnapshot = {
  isRTL?: boolean;
  localeIdentifier?: string;
  doLeftAndRightSwapInRTL?: boolean;
  isRTLForced?: boolean;
  isRTLAllowed?: boolean;
  allowRTL?: string;
  forceRTL?: string;
};

type IOSSettingsSnapshot = {
  AppleLocale?: string;
  AppleLanguages?: string[];
  AppleTextDirection?: string;
  AppleInterfaceStyle?: string;
};

type DiagnostcPayload = {
  context: string;
  timestamp: string;
  platform: {
    OS: typeof Platform.OS;
    version: typeof Platform.Version;
    isPad?: boolean;
    isTV?: boolean;
  };
  extras: Extras;
  asyncStorage: {
    language: string | null;
    rtlReloadFlag: string | null;
  };
  settingsModuleLanguage?: string | null;
  iosSettings?: IOSSettingsSnapshot;
  i18nManager: {
    isRTL: boolean;
    doLeftAndRightSwapInRTL: boolean;
    constants?: unknown;
  };
  nativeModule?: SafeNativeSnapshot;
};

const snapshotNativeI18nModule = (): SafeNativeSnapshot | undefined => {
  const native = NativeModules?.I18nManager;
  if (!native) {
    return undefined;
  }

  const serializeFn = (value: unknown): string | undefined => {
    if (typeof value === 'function') {
      return '[function]';
    }
    if (value == null) {
      return undefined;
    }

    return String(value);
  };

  return {
    isRTL: typeof native.isRTL === 'boolean' ? native.isRTL : undefined,
    localeIdentifier: typeof native.localeIdentifier === 'string' ? native.localeIdentifier : undefined,
    doLeftAndRightSwapInRTL:
      typeof native.doLeftAndRightSwapInRTL === 'boolean' ? native.doLeftAndRightSwapInRTL : undefined,
    isRTLForced: typeof native.isRTLForced === 'boolean' ? native.isRTLForced : undefined,
    isRTLAllowed: typeof native.isRTLAllowed === 'boolean' ? native.isRTLAllowed : undefined,
    allowRTL: serializeFn(native.allowRTL),
    forceRTL: serializeFn(native.forceRTL),
  };
};

const snapshotIOSSettings = (): IOSSettingsSnapshot | undefined => {
  const settingsManager = NativeModules?.SettingsManager;
  const settings = settingsManager?.settings;

  if (!settings || Platform.OS !== 'ios') {
    return undefined;
  }

  return {
    AppleLocale: typeof settings.AppleLocale === 'string' ? settings.AppleLocale : undefined,
    AppleLanguages: Array.isArray(settings.AppleLanguages)
      ? settings.AppleLanguages.filter((lang: unknown): lang is string => typeof lang === 'string')
      : undefined,
    AppleTextDirection: typeof settings.AppleTextDirection === 'string' ? settings.AppleTextDirection : undefined,
    AppleInterfaceStyle:
      typeof settings.AppleInterfaceStyle === 'string' ? settings.AppleInterfaceStyle : undefined,
  };
};

export const logRTLDiagnostics = async (context: string, extras: Extras = {}): Promise<void> => {
  const timestamp = new Date().toISOString();
  const platformConstants = NativeModules?.PlatformConstants;
  const isPad = Platform.OS === 'ios' && platformConstants?.interfaceIdiom === 'pad';
  const isTV = typeof Platform.isTV === 'boolean' ? Platform.isTV : undefined;

  let storedLanguage: string | null = null;
  let rtlReloadFlag: string | null = null;

  try {
    storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    console.warn('[RTLDiagnostics] Failed to read AsyncStorage language:', error);
  }

  try {
    rtlReloadFlag = await AsyncStorage.getItem(RTL_RELOAD_FLAG_KEY);
  } catch (error) {
    console.warn('[RTLDiagnostics] Failed to read AsyncStorage RTL reload flag:', error);
  }

  let settingsLanguage: string | null = null;
  try {
    const nativeLanguage = Settings.get('user_language');
    settingsLanguage = typeof nativeLanguage === 'string' ? nativeLanguage : null;
  } catch (error) {
    console.warn('[RTLDiagnostics] Failed to read Settings user_language:', error);
  }

  let constants: unknown;
  try {
    constants = typeof I18nManager.getConstants === 'function' ? I18nManager.getConstants() : undefined;
  } catch (error) {
    console.warn('[RTLDiagnostics] Failed to read I18nManager constants:', error);
  }

  const payload: DiagnostcPayload = {
    context,
    timestamp,
    platform: {
      OS: Platform.OS,
      version: Platform.Version,
      isPad: isPad || undefined,
      isTV: isTV,
    },
    extras,
    asyncStorage: {
      language: storedLanguage,
      rtlReloadFlag,
    },
    settingsModuleLanguage: settingsLanguage,
    iosSettings: snapshotIOSSettings(),
    i18nManager: {
      isRTL: I18nManager.isRTL,
      doLeftAndRightSwapInRTL: I18nManager.doLeftAndRightSwapInRTL,
      constants,
    },
    nativeModule: snapshotNativeI18nModule(),
  };

  console.log('[RTLDiagnostics]', JSON.stringify(payload, null, 2));
};

export default logRTLDiagnostics;
