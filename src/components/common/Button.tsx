import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Colors from '../../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.md,
      ...Shadow.base,
    };

    // Size variations
    switch (size) {
      case 'small':
        baseStyle.paddingHorizontal = Spacing.md;
        baseStyle.paddingVertical = Spacing.sm;
        baseStyle.minHeight = 32;
        break;
      case 'large':
        baseStyle.paddingHorizontal = Spacing.xl;
        baseStyle.paddingVertical = Spacing.lg;
        baseStyle.minHeight = 56;
        break;
      default: // medium
        baseStyle.paddingHorizontal = Spacing.lg;
        baseStyle.paddingVertical = Spacing.base;
        baseStyle.minHeight = 48;
    }

    // Variant styles
    switch (variant) {
      case 'secondary':
        baseStyle.backgroundColor = Colors.backgroundCard;
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = Colors.borderLight;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 2;
        baseStyle.borderColor = Colors.primary;
        break;
      case 'text':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.shadowColor = 'transparent';
        baseStyle.elevation = 0;
        break;
      default: // primary
        baseStyle.backgroundColor = Colors.primary;
    }

    // Disabled state
    if (disabled || loading) {
      baseStyle.opacity = 0.6;
    }

    // Full width
    if (fullWidth) {
      baseStyle.width = '100%';
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: Typography.fontFamily.medium,
      fontWeight: Typography.fontWeight.medium,
      textAlign: 'center',
    };

    // Size variations
    switch (size) {
      case 'small':
        baseStyle.fontSize = Typography.fontSize.sm;
        break;
      case 'large':
        baseStyle.fontSize = Typography.fontSize.lg;
        break;
      default: // medium
        baseStyle.fontSize = Typography.fontSize.md;
    }

    // Variant colors
    switch (variant) {
      case 'secondary':
        baseStyle.color = Colors.textPrimary;
        break;
      case 'outline':
        baseStyle.color = Colors.primary;
        break;
      case 'text':
        baseStyle.color = Colors.primary;
        break;
      default: // primary
        baseStyle.color = Colors.textWhite;
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.textWhite : Colors.primary}
        />
      ) : (
        <>
          {icon}
          <Text style={[getTextStyle(), textStyle, icon && { marginLeft: Spacing.xs }]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
