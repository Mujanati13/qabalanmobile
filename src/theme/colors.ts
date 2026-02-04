/**
 * App Color Palette
 * Primary color: #229A95 (Teal/Turquoise)
 */

export const Colors = {
  // Primary Colors - flat structure for backward compatibility
  primary: '#229A95',
  primaryDark: '#1A7B77',
  primaryLight: '#4DB8B3',
  primaryLighter: '#7FCAC6',
  primaryBackground: '#E8F4F3',

  // Secondary Colors - flat structure for backward compatibility
  secondary: '#FFB74D',
  secondaryDark: '#FF9800',
  secondaryLight: '#FFCC80',

  // Gradient Colors
  gradientStart: '#229A95',
  gradientEnd: '#4DB8B3',
  gradientSecondary: ['#FFB74D', '#FFCC80'],

  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Rating/Star Colors
  star: '#FFD700',
  starEmpty: '#E0E0E0',

  // Text Colors - both flat and nested for compatibility
  textPrimary: '#212121',
  textSecondary: '#757575',
  textHint: '#BDBDBD',
  textWhite: '#FFFFFF',
  textLink: '#229A95', // Keep as direct color for backward compatibility

  // Background Colors - both flat and nested for compatibility
  background: '#FFFFFF',
  backgroundLight: '#FAFAFA',
  backgroundDark: '#F5F5F5',
  backgroundCard: '#FFFFFF',
  backgroundOverlay: 'rgba(0, 0, 0, 0.5)',

  // Modern UI Colors
  accent: '#E91E63', // Pink accent for special highlights
  accentLight: '#F48FB1',
  neutral100: '#F8F9FA',
  neutral200: '#E9ECEF',
  neutral300: '#DEE2E6',
  neutral400: '#CED4DA',
  neutral500: '#ADB5BD',
  neutral600: '#6C757D',
  neutral700: '#495057',
  neutral800: '#343A40',
  neutral900: '#212529',

  // Border Colors - both flat and nested for compatibility
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  borderDark: '#BDBDBD',
  divider: '#E0E0E0',

  // Status-specific Background Colors
  successBackground: '#E8F5E8',
  warningBackground: '#FFF3E0',
  errorBackground: '#FFEBEE',
  infoBackground: '#E3F2FD',

  // Cart & Commerce Colors
  price: '#229A95',
  discount: '#F44336',
  outOfStock: '#757575',

  // Shadow
  shadow: '#000000',
  shadowLight: 'rgba(0, 0, 0, 0.1)',
  shadowMedium: 'rgba(0, 0, 0, 0.2)',
  shadowDark: 'rgba(0, 0, 0, 0.3)',

  // Transparent variants
  transparent: 'transparent',
  primaryTransparent: 'rgba(34, 154, 149, 0.1)',
  primarySemiTransparent: 'rgba(34, 154, 149, 0.8)',
};

export const Gradients = {
  primary: ['#229A95', '#1A7B77'],
  primaryLight: ['#4DB8B3', '#229A95'],
  secondary: ['#FFB74D', '#FF9800'],
  sunset: ['#FF6B6B', '#FFB74D'],
  ocean: ['#229A95', '#2196F3'],
};

export default Colors;
