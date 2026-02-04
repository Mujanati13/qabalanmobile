import { I18nManager } from 'react-native';

/**
 * Global RTL-aware styles that can be used across the app
 * IMPORTANT: We ALWAYS use LTR layout to prevent touch issues on iPhone X
 * Arabic text direction is handled with writingDirection: 'rtl' on text components
 */

export const RTLStyles = {
  // Direction helpers - ALWAYS LTR
  row: {
    flexDirection: 'row' as const,
  },
  rowReverse: {
    flexDirection: 'row-reverse' as const,
  },
  
  // Text alignment - ALWAYS LTR
  textLeft: {
    textAlign: 'left' as const,
  },
  textRight: {
    textAlign: 'right' as const,
  },
  
  // Positioning - ALWAYS LTR
  alignStart: {
    alignItems: 'flex-start' as const,
  },
  alignEnd: {
    alignItems: 'flex-end' as const,
  },
  
  // Writing direction - ALWAYS LTR (use isArabic check for Arabic text)
  writingDirection: {
    writingDirection: 'ltr' as const,
  },
};

/**
 * Flip margins/paddings for RTL
 * DISABLED: We always use LTR layout
 */
export const flipStyle = (style: any) => {
  // Always return original style - we don't flip for RTL anymore
  return style;
};

export const isRTL = () => false; // Always false - we use LTR layout
