import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface EnhancedButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  animateOnPress?: boolean;
  loadingText?: string;
  style?: any;
}

const EnhancedButton: React.FC<EnhancedButtonProps> = ({
  title,
  subtitle,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  icon,
  animateOnPress = true,
  loadingText,
  style,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (loading || disabled) return;

    if (animateOnPress) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    onPress();
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    if (variant) {
      baseStyle.push(styles[variant] as any);
    }
    
    if (disabled || loading) {
      baseStyle.push(styles.disabled as any);
    }
    
    return baseStyle;
  };

  const getTextColor = () => {
    if (disabled || loading) return '#999';
    
    switch (variant) {
      case 'secondary':
        return '#007AFF';
      default:
        return '#fff';
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator 
              size="small" 
              color={getTextColor()} 
              style={styles.loadingIndicator}
            />
            <Text style={[styles.text, { color: getTextColor() }]}>
              {loadingText || title}
            </Text>
          </View>
        ) : (
          <View style={styles.content}>
            {icon && (
              <Icon 
                name={icon} 
                size={size === 'large' ? 18 : size === 'small' ? 14 : 16} 
                color={getTextColor()} 
                style={styles.icon}
              />
            )}
            <View style={styles.textContainer}>
              <Text style={[styles.text, styles[`${size}Text`], { color: getTextColor() }]}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: getTextColor() }]}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  success: {
    backgroundColor: '#28a745',
  },
  danger: {
    backgroundColor: '#dc3545',
  },
  disabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.8,
  },
  icon: {
    marginRight: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: 8,
  },
});

export default EnhancedButton;
