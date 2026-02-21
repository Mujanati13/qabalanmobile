import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { OTPInput } from '../components/common';
import apiService, { User } from '../services/apiService';

interface SMSVerificationScreenProps {
  navigation: any;
  route: {
    params?: {
      phone: string;
      mode: 'login' | 'register';
      isExistingUser?: boolean;
      userData?: {
        first_name: string;
        last_name: string;
        password: string;
      };
    };
  };
}

const SMSVerificationScreen: React.FC<SMSVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { currentLanguage, isRTL } = useLanguage();
  const { updateUser, refreshUser, setPendingProfileCompletion } = useAuth();
  const { phone = '', isExistingUser = true, userData } = route.params || {};

  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otpError, setOtpError] = useState(false);

  useEffect(() => {
    // Format phone number for display
    if (phone) {
      let formatted = phone;
      if (phone.startsWith('962')) {
        formatted = `+962 ${phone.substring(3, 5)} ${phone.substring(5, 8)} ${phone.substring(8)}`;
      }
      setFormattedPhone(formatted);
    }
  }, [phone]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const activateAuthenticatedSession = async (user?: User | null) => {
    if (user) {
      updateUser(user);
    } else {
      await refreshUser();
    }
  };

  const getErrorMessage = (errorMessage: string | undefined): string => {
    if (!errorMessage) return t('sms.verificationFailed');
    
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('invalid') || lowerError.includes('expired')) {
      return t('sms.invalidOrExpiredCode');
    }
    if (lowerError.includes('already used')) {
      return t('sms.codeAlreadyUsed');
    }
    if (lowerError.includes('too many') || lowerError.includes('too many attempts')) {
      return t('sms.tooManyAttempts');
    }
    
    // Fallback to default error message
    return t('sms.verificationFailed');
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setOtpError(true);
      Alert.alert(
        t('common.error'),
        t('sms.enterVerificationCode')
      );
      return;
    }

    setOtpError(false);
    setIsLoading(true);

    try {
      if (isExistingUser) {
        // Existing user - login flow
        const response = await apiService.loginWithSMS(phone, verificationCode);

        if (response.success) {
          // Check if user has complete profile information
          const user = response.data?.user;
          const hasCompleteProfile = user?.birth_date && user?.gender;

          if (!hasCompleteProfile) {
            setPendingProfileCompletion(true);
          }

          // Activate session - this switches AppNavigator from AuthNavigator to Tab.Navigator
          await activateAuthenticatedSession(response.data?.user);
        } else {
          Alert.alert(t('common.error'), getErrorMessage(response.message));
        }
      } else {
        // New user - registration flow with basic user info
        const registrationResponse = await apiService.registerWithSMS({
          first_name: userData?.first_name || 'User',
          last_name: userData?.last_name || 'Name',
          phone: phone,
          password: userData?.password || 'Temp123456!',
          sms_code: verificationCode,
          language: currentLanguage,
        });

        if (registrationResponse.success && registrationResponse.data) {
          // Registration now returns tokens directly — no separate login needed
          // Tokens are saved automatically by apiService.registerWithSMS
          const regData = registrationResponse.data as any;
          const user = regData.user;
          const hasCompleteProfile = user?.birth_date && user?.gender;

          if (!hasCompleteProfile) {
            setPendingProfileCompletion(true);
          }

          await activateAuthenticatedSession(user);
        } else {
          // Registration failed — user might already exist, try login
          const loginResponse = await apiService.loginWithSMS(phone, verificationCode);
          
          if (loginResponse.success) {
            const user = loginResponse.data?.user;
            const hasCompleteProfile = user?.birth_date && user?.gender;

            if (!hasCompleteProfile) {
              setPendingProfileCompletion(true);
            }

            await activateAuthenticatedSession(loginResponse.data?.user);
          } else {
            Alert.alert(t('common.error'), getErrorMessage(registrationResponse.message));
          }
        }
      }
    } catch (error) {
      console.error('SMS verification error:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setIsResending(true);

    try {
      const response = await apiService.sendSMSVerification(phone, currentLanguage);

      if (response.success) {
        setCountdown(60); // 60 second countdown
        Alert.alert(
          t('common.success'),
          t('sms.codeResent')
        );
      } else {
        Alert.alert(t('common.error'), getErrorMessage(response.message || '') || t('sms.resendFailed'));
      }
    } catch (error) {
      console.error('SMS resend error:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setIsResending(false);
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
            <Text style={styles.headerTitle}>
              {t('sms.verification')}
            </Text>
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, isRTL && styles.textRTLCenter]}>
              {t('sms.verificationTitle')}
            </Text>
            <Text style={[styles.description, isRTL && styles.textRTLCenter]}>
              {t('sms.verificationDescription', { phone: formattedPhone })}
            </Text>
            <View style={[styles.phoneChip, isRTL && styles.phoneChipRTL]}>
              {!isRTL && <Icon name="phone-portrait-outline" size={16} color={Colors.primary} />}
              <Text style={styles.phoneChipText}>
                {formattedPhone}
              </Text>
              {isRTL && <Icon name="phone-portrait-outline" size={16} color={Colors.primary} />}
            </View>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <Text style={[styles.otpLabel, isRTL && styles.textRTLCenter]}>
              {t('sms.enterCode')}
            </Text>
            <OTPInput
              length={6}
              value={verificationCode}
              onChange={(otp) => {
                setVerificationCode(otp);
                setOtpError(false);
              }}
              error={otpError}
              errorMessage={otpError ? t('sms.invalidCode') : undefined}
              autoFocus={true}
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (isLoading || !verificationCode.trim()) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerifyCode}
            disabled={isLoading || !verificationCode.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textWhite} size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>
                {t('sms.verify')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Code */}
          <View style={styles.resendContainer}>
            <Text style={[styles.resendText, isRTL && styles.textRTLCenter]}>
              {t('sms.didntReceiveCode')}
            </Text>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={countdown > 0 || isResending}
            >
              {isResending ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.resendButtonText,
                    (countdown > 0) && styles.resendButtonTextDisabled,
                  ]}
                >
                  {countdown > 0
                    ? t('sms.resendIn', { seconds: countdown })
                    : t('sms.resendCode')
                  }
                </Text>
              )}
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
    paddingHorizontal: 0,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginTop: 0,
    paddingHorizontal: Spacing.lg,
    minHeight: 50,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.lg,
    padding: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  backButtonRTL: {
    left: 'auto',
    right: Spacing.lg,
  },
  headerTitle: {
    ...Typography.heading.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textRTLReverse: {
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  headerSpacer: {
    display: 'none',
  },
  headerSpacerRTL: {
    display: 'none',
  },
  iconContainer: {
    display: 'none',
  },
  iconBackground: {
    display: 'none',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    ...Typography.heading.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '700',
  },
  description: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryBackground,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginTop: Spacing.md,
    justifyContent: 'center',
  },
  phoneChipRTL: {
    flexDirection: 'row-reverse',
  },
  phoneChipText: {
    ...Typography.body.medium,
    color: Colors.primary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  otpContainer: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
  },
  otpLabel: {
    ...Typography.body.large,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    ...Typography.body.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body.large,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 4,
  },
  inputRTL: {
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadow.md,
  },
  verifyButtonDisabled: {
    backgroundColor: Colors.textHint,
    ...Shadow.none,
  },
  verifyButtonText: {
    ...Typography.body.large,
    color: Colors.textWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 0,
  },
  resendText: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  resendButton: {
    padding: Spacing.xs,
  },
  resendButtonText: {
    ...Typography.body.small,
    color: Colors.primary,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: Colors.textHint,
  },
  textRTLCenter: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

export default SMSVerificationScreen;
