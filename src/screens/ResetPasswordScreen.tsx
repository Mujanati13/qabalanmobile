import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius } from '../theme';
import apiService from '../services/apiService';

interface ResetPasswordScreenProps {
  navigation: any;
  route?: {
    params?: {
      email?: string;
    };
  };
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isRTL = false; // Override to force LTR
  const email = route?.params?.email || '';

  const [formData, setFormData] = useState({
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string | undefined }>({});
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string | undefined } = {};

    if (!formData.code.trim()) {
      newErrors.code = t('auth.resetCodeRequired');
    } else if (formData.code.length !== 6) {
      newErrors.code = t('auth.resetCodeInvalid');
    }

    if (!formData.newPassword.trim()) {
      newErrors.newPassword = t('auth.passwordRequired');
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t('auth.passwordTooShort');
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = t('auth.passwordComplexity');
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = t('auth.confirmPasswordRequired');
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await apiService.resetPassword(
        email,
        formData.code.trim(),
        formData.newPassword
      );
      
      if (response.success) {
        Alert.alert(
          t('common.success'),
          t('auth.passwordResetSuccess'),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert(t('common.error'), response.message || t('auth.passwordResetFailed'));
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      if (error.message?.includes('Invalid or expired')) {
        setErrors({ code: t('auth.resetCodeExpired') });
      } else {
        Alert.alert(t('common.error'), error.message || t('common.tryAgain'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.forgotPassword(email);
      
      if (response.success) {
        Alert.alert(t('common.success'), t('auth.resetCodeSent'));
      } else {
        Alert.alert(t('common.error'), response.message || t('auth.resetCodeFailed'));
      }
    } catch (error: any) {
      console.error('Resend code error:', error);
      Alert.alert(t('common.error'), error.message || t('common.tryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon 
                name={isRTL ? 'chevron-forward' : 'chevron-back'} 
                size={24} 
                color={Colors.textPrimary} 
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
              {t('auth.resetPassword')}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Q</Text>
            </View>
          </View>

          {/* Title and Description */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t('auth.resetPasswordTitle')}
            </Text>
            <Text style={[styles.description, isRTL && styles.textRTL]}>
              {t('auth.resetPasswordDescription', { email })}
            </Text>
          </View>

          {/* Reset Code Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('auth.resetCode')}
            </Text>
            <TextInput
              style={[
                styles.textInput,
                isRTL && styles.inputRTL,
                errors.code && styles.inputError,
              ]}
              value={formData.code}
              onChangeText={(text) => handleInputChange('code', text)}
              placeholder={t('auth.enterResetCode')}
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              maxLength={6}
              textAlign={isRTL ? 'right' : 'left'}
            />
            {errors.code && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.code}
              </Text>
            )}
          </View>

          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('auth.newPassword')}
            </Text>
            <View style={[
              styles.passwordContainer,
              errors.newPassword && styles.inputError,
            ]}>
              <TextInput
                style={[styles.passwordInput, isRTL && styles.inputRTL]}
                value={formData.newPassword}
                onChangeText={(text) => handleInputChange('newPassword', text)}
                placeholder={t('auth.enterNewPassword')}
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showNewPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Icon
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {errors.newPassword && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.newPassword}
              </Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('auth.confirmPassword')}
            </Text>
            <View style={[
              styles.passwordContainer,
              errors.confirmPassword && styles.inputError,
            ]}>
              <TextInput
                style={[styles.passwordInput, isRTL && styles.inputRTL]}
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange('confirmPassword', text)}
                placeholder={t('auth.confirmNewPassword')}
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showConfirmPassword}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Icon
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Reset Password Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isLoading && styles.submitButtonDisabled,
            ]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {t('auth.updatePassword')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendCode}
            disabled={isLoading}
          >
            <Text style={[styles.resendButtonText, isRTL && styles.textRTL]}>
              {t('auth.resendResetCode')}
            </Text>
          </TouchableOpacity>

          {/* Back to Login */}
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.backToLoginText, isRTL && styles.textRTL]}>
              {t('auth.backToLogin')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 48,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 48,
  },
  passwordToggle: {
    padding: 12,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputRTL: {
    textAlign: 'right',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  resendButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  backToLoginButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backToLoginText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default ResetPasswordScreen;