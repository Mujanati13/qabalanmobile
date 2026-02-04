import { I18nManager, Settings, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNRestart from 'react-native-restart';
import i18n from '../locales';
import logRTLDiagnostics from '../utils/rtlDiagnostics';

// Constants
export const LANGUAGE_STORAGE_KEY = 'user_language';
export const RTL_NEEDS_RELOAD_KEY = 'rtl_needs_reload';
export const PENDING_LANGUAGE_CHANGE_KEY = 'pending_language_change';

export type SupportedLanguage = 'en' | 'ar';

export interface LanguageChangeResult {
  success: boolean;
  needsRestart: boolean;
  previousLanguage: string;
  newLanguage: string;
  error?: string;
}

/**
 * DirectionService - Manages language direction (LTR/RTL) changes in the app
 * Handles the complexity of switching languages with proper animations and restart logic
 */
class DirectionService {
  private isChangingLanguage: boolean = false;
  private changeListeners: Set<(isChanging: boolean, language?: string) => void> = new Set();
  private restartListeners: Set<(needsRestart: boolean, language?: string) => void> = new Set();

  /**
   * Check if a language change is currently in progress
   */
  isLanguageChangeInProgress(): boolean {
    return this.isChangingLanguage;
  }

  /**
   * Subscribe to language change events
   */
  onLanguageChangeStateChange(callback: (isChanging: boolean, language?: string) => void): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Subscribe to restart required events
   */
  onRestartRequired(callback: (needsRestart: boolean, language?: string) => void): () => void {
    this.restartListeners.add(callback);
    return () => {
      this.restartListeners.delete(callback);
    };
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(isChanging: boolean, language?: string): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(isChanging, language);
      } catch (error) {
        console.error('[DirectionService] Error in change listener:', error);
      }
    });
  }

  /**
   * Notify all restart listeners
   */
  private notifyRestartListeners(needsRestart: boolean, language?: string): void {
    this.restartListeners.forEach(listener => {
      try {
        listener(needsRestart, language);
      } catch (error) {
        console.error('[DirectionService] Error in restart listener:', error);
      }
    });
  }

  /**
   * Get the current language from storage
   */
  async getCurrentLanguage(): Promise<SupportedLanguage> {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'ar' || stored === 'en') {
        return stored;
      }
      return 'en';
    } catch (error) {
      console.error('[DirectionService] Error getting current language:', error);
      return 'en';
    }
  }

  /**
   * Check if the current language is RTL
   */
  async isCurrentLanguageRTL(): Promise<boolean> {
    const language = await this.getCurrentLanguage();
    return language === 'ar';
  }

  /**
   * Check if app needs restart for RTL changes to take effect
   * I18nManager.forceRTL() ALWAYS requires app restart to take effect
   */
  needsRestartForLanguageChange(currentLanguage: string, newLanguage: string): boolean {
    const currentIsRTL = currentLanguage === 'ar';
    const newIsRTL = newLanguage === 'ar';
    
    // Always need restart when switching between RTL and LTR
    // because I18nManager.forceRTL() requires app restart
    if (currentIsRTL !== newIsRTL) {
      console.log('[DirectionService] RTL direction change detected - restart required');
      console.log(`[DirectionService] ${currentLanguage} (RTL=${currentIsRTL}) → ${newLanguage} (RTL=${newIsRTL})`);
      return true;
    }
    
    console.log('[DirectionService] Same RTL direction - no restart needed');
    return false;
  }

  /**
   * Change the app language with proper handling
   * @param newLanguage The language to change to
   * @param options Configuration options
   * @returns Result of the language change operation
   */
  async changeLanguage(
    newLanguage: SupportedLanguage,
    options: {
      showAnimation?: boolean;
      autoRestart?: boolean;
      animationDuration?: number;
    } = {}
  ): Promise<LanguageChangeResult> {
    const {
      showAnimation = true,
      autoRestart = false,
      animationDuration = 1500,
    } = options;

    // Prevent concurrent language changes
    if (this.isChangingLanguage) {
      console.warn('[DirectionService] Language change already in progress');
      return {
        success: false,
        needsRestart: false,
        previousLanguage: '',
        newLanguage,
        error: 'Language change already in progress',
      };
    }

    const previousLanguage = await this.getCurrentLanguage();

    // No change needed
    if (previousLanguage === newLanguage) {
      console.log('[DirectionService] Language already set to:', newLanguage);
      return {
        success: true,
        needsRestart: false,
        previousLanguage,
        newLanguage,
      };
    }

    try {
      this.isChangingLanguage = true;
      
      // Notify listeners that language change has started
      if (showAnimation) {
        this.notifyChangeListeners(true, newLanguage);
      }

      await logRTLDiagnostics('DirectionService:changeLanguage:start', {
        previousLanguage,
        newLanguage,
        currentI18nRTL: I18nManager.isRTL,
      });

      // Step 1: Save the new language to AsyncStorage
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
      console.log('[DirectionService] ✅ Saved language to AsyncStorage:', newLanguage);

      // Step 2: Save to native Settings (for AppDelegate to read on iOS)
      try {
        Settings.set({ user_language: newLanguage });
        console.log('[DirectionService] ✅ Saved to native Settings');
      } catch (settingsError) {
        console.warn('[DirectionService] ⚠️ Failed to save to native Settings:', settingsError);
      }

      // Step 3: Change i18next language
      await i18n.changeLanguage(newLanguage);
      console.log('[DirectionService] ✅ Changed i18next language to:', newLanguage);

      // Step 4: Check if RTL change is needed
      const needsRTLChange = this.needsRestartForLanguageChange(previousLanguage, newLanguage);
      const shouldBeRTL = newLanguage === 'ar';

      if (needsRTLChange) {
        console.log('[DirectionService] RTL change required:', previousLanguage, '->', newLanguage);

        // Update I18nManager flags
        try {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(shouldBeRTL);
          
          const swapLeftAndRight = (I18nManager as any)?.swapLeftAndRightInRTL;
          if (typeof swapLeftAndRight === 'function') {
            swapLeftAndRight(shouldBeRTL);
          }
          
          console.log('[DirectionService] ✅ Updated I18nManager flags');
        } catch (rtlError) {
          console.warn('[DirectionService] ⚠️ Failed to update I18nManager:', rtlError);
        }

        // Set flag for reload
        await AsyncStorage.setItem(RTL_NEEDS_RELOAD_KEY, 'true');
        await AsyncStorage.setItem(PENDING_LANGUAGE_CHANGE_KEY, newLanguage);

        // Notify that restart is required
        this.notifyRestartListeners(true, newLanguage);

        // Auto restart if requested - restart immediately to keep overlay visible
        if (autoRestart) {
          await this.restartApp();
        }

        return {
          success: true,
          needsRestart: true,
          previousLanguage,
          newLanguage,
        };
      }

      // Wait for animation if enabled (even without RTL change for visual feedback)
      if (showAnimation && animationDuration > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(animationDuration, 800)));
      }

      await logRTLDiagnostics('DirectionService:changeLanguage:complete', {
        previousLanguage,
        newLanguage,
        needsRestart: needsRTLChange,
      });

      return {
        success: true,
        needsRestart: false,
        previousLanguage,
        newLanguage,
      };

    } catch (error) {
      console.error('[DirectionService] Error changing language:', error);
      
      await logRTLDiagnostics('DirectionService:changeLanguage:error', {
        previousLanguage,
        newLanguage,
        error: String(error),
      });

      return {
        success: false,
        needsRestart: false,
        previousLanguage,
        newLanguage,
        error: String(error),
      };

    } finally {
      this.isChangingLanguage = false;
      this.notifyChangeListeners(false, newLanguage);
    }
  }

  /**
   * Restart the app to apply RTL changes
   */
  async restartApp(): Promise<void> {
    console.log('[DirectionService] 🔄 Restarting app...');
    
    try {
      await logRTLDiagnostics('DirectionService:restartApp', {
        isRTL: I18nManager.isRTL,
      });

      // Restart immediately while overlay is still visible
      RNRestart.Restart();
    } catch (error) {
      console.error('[DirectionService] Error restarting app:', error);
      throw error;
    }
  }

  /**
   * Clear pending language change flags
   */
  async clearPendingChanges(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RTL_NEEDS_RELOAD_KEY);
      await AsyncStorage.removeItem(PENDING_LANGUAGE_CHANGE_KEY);
      console.log('[DirectionService] Cleared pending changes');
    } catch (error) {
      console.error('[DirectionService] Error clearing pending changes:', error);
    }
  }

  /**
   * Check if there's a pending language change that needs a restart
   */
  async hasPendingRestart(): Promise<boolean> {
    try {
      const needsReload = await AsyncStorage.getItem(RTL_NEEDS_RELOAD_KEY);
      return needsReload === 'true';
    } catch (error) {
      console.error('[DirectionService] Error checking pending restart:', error);
      return false;
    }
  }

  /**
   * Get the pending language (if any)
   */
  async getPendingLanguage(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PENDING_LANGUAGE_CHANGE_KEY);
    } catch (error) {
      console.error('[DirectionService] Error getting pending language:', error);
      return null;
    }
  }
}

// Export singleton instance
const directionService = new DirectionService();
export default directionService;
