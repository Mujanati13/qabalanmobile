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
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { updateUser, refreshUser } = useAuth();
  const { phone = '', isExistingUser = true, userData } = route.params || {};

  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formattedPhone, setFormattedPhone] = useState('');

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

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert(
        t('common.error'),
        t('sms.enterVerificationCode')
      );
      return;
    }

    setIsLoading(true);

    try {
      if (isExistingUser) {
        // Existing user - login flow
        const response = await apiService.loginWithSMS(phone, verificationCode);

        if (response.success) {
          await activateAuthenticatedSession(response.data?.user);
          navigation.reset({
            index: 0,
            routes: [{ name: 'AuthWelcome' }],
          });
        } else {
          Alert.alert(t('common.error'), response.message || t('sms.verificationFailed'));
        }
      } else {
        // New user - registration flow with basic user info
        // For now, create account with minimal info and default name/password
        const registrationResponse = await apiService.registerWithSMS({
          first_name: userData?.first_name || 'User',
          last_name: userData?.last_name || 'Name',
          phone: phone,
          password: userData?.password || 'Temp123456!',
          sms_code: verificationCode,
          language: currentLanguage,
        });

        if (registrationResponse.success) {
          // After registration, log the user in to initialize their session
          const loginAfterRegister = await apiService.loginWithSMS(phone, verificationCode);

          if (loginAfterRegister.success) {
            navigation.reset({
              index: 0,
              routes: [{ 
                name: 'AddressSetup',
                params: {
                  isFirstTime: true,
                  phone: phone,
                },
              }],
            });
          } else {
            Alert.alert(t('common.error'), loginAfterRegister.message || t('sms.verificationFailed'));
          }
        } else {
          // If registration fails, might be because user already exists
          // Try login instead
          const loginResponse = await apiService.loginWithSMS(phone, verificationCode);
          
          if (loginResponse.success) {
            await activateAuthenticatedSession(loginResponse.data?.user);
            navigation.reset({
              index: 0,
              routes: [{ name: 'AuthWelcome' }],
            });
          } else {
            Alert.alert(t('common.error'), registrationResponse.message || t('sms.verificationFailed'));
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
        Alert.alert(t('common.error'), response.message || t('sms.resendFailed'));
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
            <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
              {t('sms.verification')}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* SMS Icon */}
          <View style={styles.iconContainer}>
            <Icon name="phone-portrait" size={80} color={Colors.primary} />
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {t('sms.verificationTitle')}
            </Text>
            <Text style={[styles.description, isRTL && styles.textRTL]}>
              {t('sms.verificationDescription', { phone: formattedPhone })}
            </Text>
          </View>

          {/* Verification Code Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('sms.verificationCode')}
            </Text>
            <TextInput
              style={[
                styles.input,
                isRTL && styles.inputRTL,
              ]}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder={t('sms.enterVerificationCode')}
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              textAlign={isRTL ? 'right' : 'left'}
              autoFocus
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
            <Text style={[styles.resendText, isRTL && styles.textRTL]}>
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
    ...Typography.heading.h3,
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.heading.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
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
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },
  verifyButtonDisabled: {
    backgroundColor: Colors.textHint,
  },
  verifyButtonText: {
    ...Typography.body.large,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  resendText: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  resendButton: {
    padding: Spacing.sm,
  },
  resendButtonText: {
    ...Typography.body.medium,
    color: Colors.primary,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: Colors.textHint,
  },
});

export default SMSVerificationScreen;
