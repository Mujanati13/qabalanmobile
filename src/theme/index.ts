import { Platform } from 'react-native';
import { rtlStyles } from '../utils/rtlUtils';
import { Colors } from './colors';

/**
 * Typography System
 */
export const Typography = {
  // Font Families
  fontFamily: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
    medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    light: Platform.OS === 'ios' ? 'System' : 'Roboto-Light',
  },

  // Font Sizes
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
    '6xl': 48,
  },

  // Line Heights
  lineHeight: {
    xs: 14,
    sm: 16,
    base: 20,
    md: 22,
    lg: 24,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
    '5xl': 44,
    '6xl': 56,
  },

  // Font Weights
  fontWeight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Heading Styles
  heading: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    },
    h2: {
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 36,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    },
    h4: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    },
    h5: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 24,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    },
    h6: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 22,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    },
  },

  // Body Text Styles
  body: {
    large: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 24,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    medium: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 22,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    small: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    xs: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  },
};

/**
 * Spacing System (using 4px base unit)
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 56,
  '6xl': 64,
  '7xl': 80,
  '8xl': 96,
};

/**
 * Border Radius
 */
export const BorderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

/**
 * Shadow Presets
 */
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
};

// Export individual objects for direct access
export { Colors } from './colors';

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
};
