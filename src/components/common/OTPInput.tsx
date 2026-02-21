import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Platform,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../../theme';

/**
 * Convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Extended Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹)
 * to Western digits (0-9) so OTP auto-fill works with Arabic SMS messages.
 */
const normalizeDigits = (text: string): string => {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
             .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
};

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
  const hiddenInputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => hiddenInputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handlePress = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const handleChangeText = useCallback((text: string) => {
    // Normalize Arabic-Indic numerals and strip non-digits
    const sanitized = normalizeDigits(text).replace(/[^0-9]/g, '').slice(0, length);
    onChange(sanitized);
  }, [length, onChange]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  // The cursor sits on the next empty position
  const cursorIndex = value.length < length ? value.length : length - 1;

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Single hidden TextInput — receives all keyboard + auto-fill input */}
      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
      />

      {/* Visible digit boxes — purely presentational */}
      <Pressable
        onPress={handlePress}
        style={styles.inputsContainer}
      >
        {Array.from({ length }).map((_, index) => {
          const hasValue = !!value[index];
          const isActive = isFocused && index === cursorIndex;

          return (
            <View
              key={index}
              style={[
                styles.inputWrapper,
                inputStyle,
                isActive && styles.inputFocused,
                isActive && focusedStyle,
                error && styles.inputError,
                error && errorStyle,
                hasValue && styles.inputFilled,
              ]}
            >
              <Text style={[styles.digitText, textStyle]}>
                {value[index] || ''}
              </Text>
              {isActive && !hasValue && <View style={styles.cursor} />}
            </View>
          );
        })}
      </Pressable>

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
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
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
  digitText: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cursor: {
    position: 'absolute',
    width: 2,
    height: 28,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  errorText: {
    ...Typography.body.small,
    color: Colors.error,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

export default OTPInput;
