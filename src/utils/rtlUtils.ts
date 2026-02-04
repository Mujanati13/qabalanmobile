import { I18nManager } from 'react-native';

/**
 * RTL utility functions for handling right-to-left layouts
 */

/**
 * Returns the appropriate text alignment based on current RTL setting
 */
export const getTextAlign = (defaultAlign: 'left' | 'right' | 'center' = 'left'): 'left' | 'right' | 'center' => {
  if (defaultAlign === 'center') return 'center';
  
  if (I18nManager.isRTL) {
    return defaultAlign === 'left' ? 'right' : 'left';
  }
  return defaultAlign;
};

/**
 * Returns the appropriate flex direction based on RTL setting
 */
export const getFlexDirection = (defaultDirection: 'row' | 'row-reverse' = 'row'): 'row' | 'row-reverse' => {
  if (I18nManager.isRTL) {
    return defaultDirection === 'row' ? 'row-reverse' : 'row';
  }
  return defaultDirection;
};

/**
 * Returns RTL-aware margin/padding values
 * Swaps left and right values when in RTL mode
 */
export const getRTLValue = (leftValue: number, rightValue: number) => {
  if (I18nManager.isRTL) {
    return { left: rightValue, right: leftValue };
  }
  return { left: leftValue, right: rightValue };
};

/**
 * Returns the appropriate start/end positions for RTL
 */
export const getPosition = (start: number, end: number) => {
  if (I18nManager.isRTL) {
    return { left: end, right: start };
  }
  return { left: start, right: end };
};

/**
 * Creates RTL-aware styles for common use cases
 */
export const rtlStyles = {
  /**
   * Row direction that respects RTL
   */
  row: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' as const : 'row' as const,
  },
  
  /**
   * Text alignment that starts from the reading direction
   */
  textStart: {
    textAlign: I18nManager.isRTL ? 'right' as const : 'left' as const,
  },
  
  /**
   * Text alignment that ends at the opposite of reading direction
   */
  textEnd: {
    textAlign: I18nManager.isRTL ? 'left' as const : 'right' as const,
  },
  
  /**
   * Creates margin/padding that respects RTL
   */
  marginStart: (value: number) => ({
    [I18nManager.isRTL ? 'marginRight' : 'marginLeft']: value,
  }),
  
  marginEnd: (value: number) => ({
    [I18nManager.isRTL ? 'marginLeft' : 'marginRight']: value,
  }),
  
  paddingStart: (value: number) => ({
    [I18nManager.isRTL ? 'paddingRight' : 'paddingLeft']: value,
  }),
  
  paddingEnd: (value: number) => ({
    [I18nManager.isRTL ? 'paddingLeft' : 'paddingRight']: value,
  }),
  
  /**
   * Position utilities for RTL
   */
  positionStart: (value: number) => ({
    [I18nManager.isRTL ? 'right' : 'left']: value,
  }),
  
  positionEnd: (value: number) => ({
    [I18nManager.isRTL ? 'left' : 'right']: value,
  }),
};

/**
 * Hook-like function to get current RTL state
 */
export const useRTL = () => {
  return {
    isRTL: I18nManager.isRTL,
    textAlign: getTextAlign(),
    flexDirection: getFlexDirection(),
  };
};
