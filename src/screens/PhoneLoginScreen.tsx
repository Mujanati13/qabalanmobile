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

interface PhoneLoginScreenProps {
  navigation: any;
}

const PhoneLoginScreen: React.FC<PhoneLoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    
    // Clear errors when user starts typing
    if (errors.phone) {
      setErrors({ ...errors, phone: '' });
    }
  };

  const handleSendSMS = async () => {
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    
    if (!cleanPhone) {
      setErrors({ phone: t('auth.enterPhone') });
      return;
    }

    if (!validatePhone(cleanPhone)) {
      setErrors({ phone: t('auth.invalidPhone') });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await apiService.sendSMSVerification(cleanPhone, currentLanguage);

      if (response.success) {
        navigation.navigate('SMSVerification', {
          phone: response.data?.phone || cleanPhone,
          mode: 'login',
        });
      } else {
        Alert.alert(t('common.error'), response.message || t('sms.sendFailed'));
      }
    } catch (error) {
      console.error('SMS send error:', error);
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
              {t('sms.phoneLogin')}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Phone Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Icon name="call" size={60} color={Colors.primary} />
            </View>
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t('sms.enterPhoneTitle')} ss
            </Text>
            <Text style={[styles.description, isRTL && styles.textRTL]}>
              {t('sms.enterPhoneDescription')}
            </Text>
            <Text style={[styles.benefits, isRTL && styles.textRTL]}>
              {t('sms.loginBenefits')}
            </Text>
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('auth.phone')}
            </Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.countryCode}>🇯🇴 +962</Text>
              </View>
              <TextInput
                style={[
                  styles.phoneInput,
                  { textAlign: 'left', writingDirection: 'ltr' },
                  isRTL && styles.inputRTL,
                  errors.phone && styles.inputError,
                ]}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder={t('sms.phoneExample')}
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>
            {errors.phone && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.phone}
              </Text>
            )}
          </View>

          {/* Send SMS Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (isLoading || !phoneNumber.trim()) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendSMS}
            disabled={isLoading || !phoneNumber.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textWhite} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>
                {t('sms.sendVerificationCode')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Alternative Login */}
          <View style={styles.alternativeContainer}>
            <Text style={[styles.alternativeText, isRTL && styles.textRTL]}>
              {t('sms.orLoginWith')}
            </Text>
            <TouchableOpacity
              style={styles.emailLoginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Icon name="mail" size={20} color={Colors.primary} />
              <Text style={[styles.emailLoginText, isRTL && styles.textRTL]}>
                {t('auth.email')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={[styles.registerText, isRTL && styles.textRTL]}>
              {t('auth.dontHaveAccount')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PhoneRegister')}
            >
              <Text style={[styles.registerLink, isRTL && styles.textRTL]}>
                {t('auth.register')}
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
  iconContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl * 2,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: `${Colors.primary}30`,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
  },
  benefits: {
    ...Typography.body.small,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 18,
    fontSize: 12,
  },
  formContainer: {
    paddingHorizontal: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.body.small,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
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
  inputRTL: {
    textAlign: 'right',
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    ...Typography.body.small,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textHint,
  },
  sendButtonText: {
    ...Typography.body.medium,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  alternativeContainer: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  alternativeText: {
    ...Typography.body.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  emailLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emailLoginText: {
    ...Typography.body.small,
    color: Colors.primary,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  registerText: {
    ...Typography.body.small,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  registerLink: {
    ...Typography.body.small,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default PhoneLoginScreen;
