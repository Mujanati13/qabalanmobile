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
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import apiService from '../services/apiService';

interface PhoneRegisterScreenProps {
  navigation: any;
}

const PhoneRegisterScreen: React.FC<PhoneRegisterScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = t('auth.enterFirstName');
    } else if (formData.first_name.length < 2) {
      newErrors.first_name = t('auth.firstNameTooShort');
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = t('auth.enterLastName');
    } else if (formData.last_name.length < 2) {
      newErrors.last_name = t('auth.lastNameTooShort');
    }

    const cleanPhone = formData.phone.replace(/\s+/g, '');
    if (!cleanPhone) {
      newErrors.phone = t('auth.enterPhone');
    } else if (!validatePhone(cleanPhone)) {
      newErrors.phone = t('auth.invalidPhone');
    }

    if (!formData.password.trim()) {
      newErrors.password = t('auth.enterPassword');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth.passwordTooShort');
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = t('auth.passwordComplexity');
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = t('auth.confirmPassword');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhone = (phone: string) => {
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // Jordan phone number patterns
    const patterns = [
      /^962[0-9]{9}$/, // 962XXXXXXXXX
      /^\+962[0-9]{9}$/, // +962XXXXXXXXX
      /^00962[0-9]{9}$/, // 00962XXXXXXXXX
      /^0[0-9]{9}$/, // 0XXXXXXXXX (local)
      /^[0-9]{9}$/, // XXXXXXXXX (without country/area code)
    ];

    return patterns.some(pattern => pattern.test(cleanPhone));
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format for Jordan numbers
    if (digits.startsWith('962')) {
      if (digits.length <= 12) {
        return digits.replace(/(\d{3})(\d{2})(\d{3})(\d{0,4})/, '+$1 $2 $3 $4').trim();
      }
    } else if (digits.startsWith('0')) {
      if (digits.length <= 10) {
        return digits.replace(/(\d{2})(\d{3})(\d{0,4})/, '$1 $2 $3').trim();
      }
    } else {
      if (digits.length <= 9) {
        return digits.replace(/(\d{2})(\d{3})(\d{0,4})/, '$1 $2 $3').trim();
      }
    }
    
    return digits;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      value = formatPhoneNumber(value);
    }
    
    setFormData({ ...formData, [field]: value });
    
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const cleanPhone = formData.phone.replace(/\s+/g, '');
      
      // First send SMS verification
      const smsResponse = await apiService.sendSMSVerification(cleanPhone, currentLanguage);

      if (smsResponse.success) {
        // Navigate to SMS verification with user data
        navigation.navigate('SMSVerification', {
          phone: smsResponse.data?.phone || cleanPhone,
          mode: 'register',
          userData: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            password: formData.password,
          },
        });
      } else {
        Alert.alert(t('common.error'), smsResponse.message || t('sms.sendFailed'));
      }
    } catch (error) {
      console.error('Registration SMS error:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, isRTL && styles.backButtonRTL]}
              onPress={() => navigation.goBack()}
            >
              <Icon
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={24}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
              {t('auth.register')}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t('sms.createAccount')}
            </Text>
            <Text style={[styles.description, isRTL && styles.textRTL]}>
              {t('sms.createAccountDescription')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* First Name */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('auth.firstName')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { textAlign: 'left', writingDirection: 'ltr' },
                  isRTL && styles.inputRTL,
                  errors.first_name && styles.inputError,
                ]}
                value={formData.first_name}
                onChangeText={(value) => handleInputChange('first_name', value)}
                placeholder={t('auth.enterFirstName')}
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="words"
              />
              {errors.first_name && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.first_name}
                </Text>
              )}
            </View>

            {/* Last Name */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('auth.lastName')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { textAlign: 'left', writingDirection: 'ltr' },
                  isRTL && styles.inputRTL,
                  errors.last_name && styles.inputError,
                ]}
                value={formData.last_name}
                onChangeText={(value) => handleInputChange('last_name', value)}
                placeholder={t('auth.enterLastName')}
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="words"
              />
              {errors.last_name && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.last_name}
                </Text>
              )}
            </View>

            {/* Phone Number */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('auth.phone')}
              </Text>
              <View style={[
                styles.phoneInputContainer,
                errors.phone && styles.inputError,
              ]}>
                <View style={styles.countryCodeContainer}>
                  <Text style={styles.countryCode}>🇯🇴 +962</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, { textAlign: 'left', writingDirection: 'ltr' }, isRTL && styles.inputRTL]}
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  placeholder={t('sms.phoneExample')}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              {errors.phone && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.phone}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('auth.password')}
              </Text>
              <View style={[
                styles.passwordContainer,
                errors.password && styles.inputError,
              ]}>
                <TextInput
                  style={[styles.passwordInput, { textAlign: 'left', writingDirection: 'ltr' }, isRTL && styles.inputRTL]}
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor={Colors.textSecondary}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('auth.confirmPassword')}
              </Text>
              <View style={[
                styles.passwordContainer,
                errors.confirmPassword && styles.inputError,
              ]}>
                <TextInput
                  style={[styles.passwordInput, { textAlign: 'left', writingDirection: 'ltr' }, isRTL && styles.inputRTL]}
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleInputChange('confirmPassword', value)}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor={Colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
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
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              isLoading && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.registerButtonText}>
                {t('auth.register')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, isRTL && styles.textRTL]}>
              {t('auth.alreadyHaveAccount')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PhoneLogin')}
            >
              <Text style={[styles.loginLink, isRTL && styles.textRTL]}>
                {t('auth.login')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  backButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundLight,
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    ...Typography.heading.h4,
    color: Colors.textPrimary,
  },
  textRTL: {
    textAlign: 'right',
  },
  headerSpacer: {
    width: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  title: {
    ...Typography.heading.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.body.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  formContainer: {
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body.small,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body.medium,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
  },
  inputRTL: {
    textAlign: 'right',
  },
  inputError: {
    borderColor: Colors.error,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryCodeContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  countryCode: {
    ...Typography.body.small,
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    ...Typography.body.medium,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordInput: {
    flex: 1,
    ...Typography.body.large,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
  },
  passwordToggle: {
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.body.small,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },
  registerButtonDisabled: {
    backgroundColor: Colors.textHint,
  },
  registerButtonText: {
    ...Typography.body.large,
    color: Colors.white,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    flexWrap: 'wrap',
  },
  loginText: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  loginLink: {
    ...Typography.body.medium,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default PhoneRegisterScreen;
