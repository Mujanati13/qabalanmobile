/**
 * RTL Diagnostic Helper
 * 
 * Add this to any screen to see RTL state
 */
import { I18nManager, Platform } from 'react-native';

export const logRTLState = (componentName: string) => {
  console.log(`[${componentName}] RTL Diagnostic:`, {
    'I18nManager.isRTL': I18nManager.isRTL,
    'I18nManager.doLeftAndRightSwapInRTL': I18nManager.doLeftAndRightSwapInRTL,
    'I18nManager.allowRTL': I18nManager.allowRTL(false), // Just checking, not changing
    'Platform.OS': Platform.OS,
  });
};

/**
 * Usage in any screen:
 * 
 * import { logRTLState } from '../utils/rtlDiagnostic';
 * 
 * const MyScreen = () => {
 *   useEffect(() => {
 *     logRTLState('MyScreen');
 *   }, []);
 *   
 *   // ... rest of component
 * }
 */
