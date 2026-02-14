import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Platform,
  ViewStyle,
  TextStyle,
  I18nManager,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../../theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  error?: boolean;
  errorMessage?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  textStyle?: TextStyle;
  focusedStyle?: ViewStyle;
  errorStyle?: ViewStyle;
}

const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error = false,
  errorMessage,
  autoFocus = true,
  disabled = false,
  containerStyle,
  inputStyle,
  textStyle,
  focusedStyle,
  errorStyle,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const handleChangeText = (text: string, index: number) => {
    // Remove any non-numeric characters
    const sanitized = text.replace(/[^0-9]/g, '');
    
    // Handle paste of multiple digits
    if (sanitized.length > 1) {
      const newValue = value.split('');
      const pastedDigits = sanitized.slice(0, length - index).split('');
      
      pastedDigits.forEach((digit, i) => {
        newValue[index + i] = digit;
      });
      
      const newOTP = newValue.join('').slice(0, length);
      onChange(newOTP);
      
      // Focus next empty field or last field
      const nextIndex = Math.min(index + pastedDigits.length, length - 1);
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 10);
      return;
    }

    // Handle single digit input
    const newValue = value.split('');
    newValue[index] = sanitized;
    const newOTP = newValue.join('');
    
    onChange(newOTP);

    // Auto-focus next input if digit was entered
    if (sanitized && index < length - 1) {
      setTimeout(() => {
        inputRefs.current[index + 1]?.focus();
      }, 10);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    const key = e.nativeEvent.key;

    // Handle backspace
    if (key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current field is empty, move to previous field
        setTimeout(() => {
          inputRefs.current[index - 1]?.focus();
        }, 10);
      } else {
        // Clear current field
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const getInputValue = (index: number): string => {
    return value[index] || '';
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputsContainer}>
        {Array.from({ length }).map((_, index) => {
          const isFocused = focusedIndex === index;
          const hasValue = !!value[index];
          
          return (
            <View
              key={index}
              style={[
                styles.inputWrapper,
                inputStyle,
                isFocused && styles.inputFocused,
                isFocused && focusedStyle,
                error && styles.inputError,
                error && errorStyle,
                hasValue && styles.inputFilled,
              ]}
            >
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.input, textStyle]}
                value={getInputValue(index)}
                onChangeText={(text) => handleChangeText(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => handleFocus(index)}
                onBlur={handleBlur}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!disabled}
                textContentType="oneTimeCode" // iOS auto-fill support
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} // Android auto-fill
                importantForAutofill="yes"
              />
            </View>
          );
        })}
      </View>
      {error && errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputsContainer: {
    flexDirection: 'row', // Always LTR for OTP codes
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    // Force LTR layout regardless of app language
    direction: 'ltr' as any,
  },
  inputWrapper: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 55,
    maxHeight: 55,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
    ...Shadow.md,
    transform: [{ scale: 1.05 }],
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.backgroundCard,
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
  },
  input: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
  },
  errorText: {
    ...Typography.body.small,
    color: Colors.error,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default OTPInput;
