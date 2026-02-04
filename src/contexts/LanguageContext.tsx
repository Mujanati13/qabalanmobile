import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import RNRestart from 'react-native-restart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLanguage, getCurrentLanguage, getCurrentLanguageAsync, LANGUAGES, syncRTLWithLanguage } from '../locales';
import logRTLDiagnostics from '../utils/rtlDiagnostics';
import directionService, { SupportedLanguage, LanguageChangeResult } from '../services/DirectionService';

interface LanguageContextType {
  currentLanguage: string;
  availableLanguages: typeof LANGUAGES;
  changeLanguage: (language: string) => Promise<void>;
  changeLanguageWithAnimation: (language: string) => Promise<LanguageChangeResult>;
  isRTL: boolean;
  t: (key: string, options?: any) => string;
  isLanguageLoaded: boolean;
  isChangingLanguage: boolean;
  needsRestart: boolean;
  pendingLanguage: string | null;
  confirmRestart: () => Promise<void>;
  cancelRestart: () => void;
}

interface InternalLanguageContextType extends LanguageContextType {
  __isFallback?: boolean;
}

const fallbackLanguageContext: InternalLanguageContextType = {
  currentLanguage: 'en',
  availableLanguages: LANGUAGES,
  changeLanguage: async () => {
    if (__DEV__) {
      console.warn('[LanguageContext] changeLanguage called without a LanguageProvider in the tree.');
    }
    return Promise.resolve();
  },
  changeLanguageWithAnimation: async (language: string) => {
    if (__DEV__) {
      console.warn('[LanguageContext] changeLanguageWithAnimation called without a LanguageProvider in the tree.');
    }
    return {
      success: false,
      needsRestart: false,
      previousLanguage: 'en',
      newLanguage: language,
      error: 'No provider',
    };
  },
  isRTL: false,
  t: (key: string, _options?: any) => key,
  __isFallback: true,
  isLanguageLoaded: false,
  isChangingLanguage: false,
  needsRestart: false,
  pendingLanguage: null,
  confirmRestart: async () => {},
  cancelRestart: () => {},
};

const LanguageContext = createContext<InternalLanguageContextType>(fallbackLanguageContext);

let hasWarnedMissingProvider = false;

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if ((context as InternalLanguageContextType).__isFallback && !hasWarnedMissingProvider) {
    hasWarnedMissingProvider = true;
    console.warn('[LanguageContext] useLanguage accessed without a LanguageProvider. Falling back to defaults.');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<string>('en'); // Start with default
  const [isRTLLayout, setIsRTLLayout] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState<boolean>(false);
  const [needsRestart, setNeedsRestart] = useState<boolean>(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);

  // Initialize language from storage on mount
  useEffect(() => {
    const initLanguage = async () => {
      try {
        // Read directly from AsyncStorage first for fastest result
        const storedLang = await getCurrentLanguageAsync();
        console.log('[LanguageContext] Stored language from AsyncStorage:', storedLang);
        await logRTLDiagnostics('LanguageContext:initLanguage', { storedLang });
        
        setCurrentLanguage(storedLang);
        // CORRECT LOGIC: Arabic = RTL, English = LTR
        setIsRTLLayout(storedLang === 'ar');
        setIsInitialized(true);
        
        console.log('[LanguageContext] Initialized with language:', storedLang, 'RTL:', storedLang === 'ar');
        await logRTLDiagnostics('LanguageContext:initLanguage:afterState', {
          storedLang,
          isRTL: storedLang === 'ar',
        });

        // Check for pending restart from previous session
        const hasPending = await directionService.hasPendingRestart();
        if (hasPending) {
          const pendingLang = await directionService.getPendingLanguage();
          if (pendingLang) {
            setPendingLanguage(pendingLang);
            setNeedsRestart(true);
          }
        }
      } catch (error) {
        console.error('[LanguageContext] Failed to initialize language:', error);
        // Fallback to default
        setCurrentLanguage('en');
        setIsRTLLayout(false);
        setIsInitialized(true);
        await logRTLDiagnostics('LanguageContext:initLanguage:error', { error: String(error) });
      }
    };
    initLanguage();
  }, []);

  // Subscribe to direction service events
  useEffect(() => {
    const unsubscribeChange = directionService.onLanguageChangeStateChange((isChanging, language) => {
      setIsChangingLanguage(isChanging);
      if (language) {
        setPendingLanguage(language);
      }
    });

    const unsubscribeRestart = directionService.onRestartRequired((needsRestartNow, language) => {
      setNeedsRestart(needsRestartNow);
      if (language) {
        setPendingLanguage(language);
      }
    });

    return () => {
      unsubscribeChange();
      unsubscribeRestart();
    };
  }, []);

  const changeLanguage = useCallback(async (language: string) => {
    try {
      const oldLanguage = currentLanguage;
      // CORRECT LOGIC: Arabic = RTL, English = LTR
      const wasRTL = oldLanguage === 'ar';
      const willBeRTL = language === 'ar';
      
      console.log('[LanguageContext] Changing language from', oldLanguage, 'to', language);
      console.log('[LanguageContext] RTL change:', wasRTL, '→', willBeRTL);
      await logRTLDiagnostics('LanguageContext:changeLanguage:before', {
        oldLanguage,
        targetLanguage: language,
        wasRTL,
        willBeRTL,
      });
      
      await setLanguage(language);
      setCurrentLanguage(language);

      syncRTLWithLanguage(language);

      // Keep internal state for text direction purposes
      setIsRTLLayout(willBeRTL);
      await logRTLDiagnostics('LanguageContext:changeLanguage:afterSync', {
        language,
        willBeRTL,
        i18nLanguage: i18n.language,
        managerRTL: I18nManager.isRTL,
      });
      
      console.log('[LanguageContext] Language changed to:', language);
      await logRTLDiagnostics('LanguageContext:changeLanguage:complete', {
        language,
        willBeRTL,
        currentLanguage,
      });
    } catch (error) {
      console.error('Error changing language:', error);
      await logRTLDiagnostics('LanguageContext:changeLanguage:error', { error: String(error), language });
    }
  }, [currentLanguage, i18n]);

  // New method: Change language with animation and automatic restart
  const changeLanguageWithAnimation = useCallback(async (language: string): Promise<LanguageChangeResult> => {
    try {
      console.log('[LanguageContext] changeLanguageWithAnimation called:', language);
      
      const result = await directionService.changeLanguage(language as SupportedLanguage, {
        showAnimation: true,
        autoRestart: true, // Automatically restart if needed
        animationDuration: 0, // Restart immediately
      });

      if (result.success) {
        setCurrentLanguage(language);
        setIsRTLLayout(language === 'ar');

        // Note: If restart is needed, app will restart before this point
        if (result.needsRestart) {
          console.log('[LanguageContext] App should have restarted');
        }
      }

      return result;
    } catch (error) {
      console.error('[LanguageContext] Error in changeLanguageWithAnimation:', error);
      return {
        success: false,
        needsRestart: false,
        previousLanguage: currentLanguage,
        newLanguage: language,
        error: String(error),
      };
    }
  }, [currentLanguage]);

  // Confirm restart
  const confirmRestart = useCallback(async () => {
    console.log('[LanguageContext] Restart confirmed');
    setNeedsRestart(false);
    await directionService.restartApp();
  }, []);

  // Cancel restart (keep using app without restart)
  const cancelRestart = useCallback(() => {
    console.log('[LanguageContext] Restart cancelled, will apply on next app launch');
    setNeedsRestart(false);
    // The language is already saved, it will apply on next restart
  }, []);

  useEffect(() => {
    // Listen for language changes from i18n
    const handleLanguageChange = (lng: string) => {
      console.log('[LanguageContext] i18n languageChanged event:', lng);
      setCurrentLanguage(lng);
      setIsRTLLayout(lng === 'ar');
      void logRTLDiagnostics('LanguageContext:i18nLanguageChanged', {
        language: lng,
        managerRTL: I18nManager.isRTL,
      });
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const contextValue: InternalLanguageContextType = useMemo(() => ({
    currentLanguage,
    availableLanguages: LANGUAGES,
    changeLanguage,
    changeLanguageWithAnimation,
    isRTL: isRTLLayout,
    t,
    __isFallback: false,
    isLanguageLoaded: isInitialized,
    isChangingLanguage,
    needsRestart,
    pendingLanguage,
    confirmRestart,
    cancelRestart,
  }), [
    currentLanguage,
    isRTLLayout,
    changeLanguage,
    changeLanguageWithAnimation,
    t,
    isInitialized,
    isChangingLanguage,
    needsRestart,
    pendingLanguage,
    confirmRestart,
    cancelRestart,
  ]);

  // Don't render children until language is initialized to prevent flash of wrong direction
  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
