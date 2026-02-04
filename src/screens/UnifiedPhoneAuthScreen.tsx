import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing } from '../theme';
import apiService, { User } from '../services/apiService';
import LanguageChangeOverlay from '../components/LanguageChangeOverlay';

interface UnifiedPhoneAuthScreenProps {
  navigation: any;
}

interface UserData {
  first_name: string;
  last_name: string;
  password: string;
  confirmPassword: string;
}

const UnifiedPhoneAuthScreen: React.FC<UnifiedPhoneAuthScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguageWithAnimation, isChangingLanguage, needsRestart, pendingLanguage, confirmRestart, cancelRestart, isRTL } = useLanguage();
  const { updateUser, refreshUser } = useAuth();
  
  const [step, setStep] = useState<'phone' | 'user_data' | 'sms'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userData, setUserData] = useState<UserData>({
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isNewUser, setIsNewUser] = useState(false);
  const [normalizedPhone, setNormalizedPhone] = useState('');

  const completeAuthentication = async (user?: User | null) => {
    if (user) {
      updateUser(user);
    } else {
      await refreshUser();
    }
  };

  const handleLanguageChange = async () => {
    const newLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    await changeLanguageWithAnimation(newLanguage);
  };

  const sanitizePhoneInput = (phone: string): string => phone.replace(/\D/g, '');

  const formatPhoneForDisplay = (phone: string): string => {
    const digits = sanitizePhoneInput(phone);

    if (!digits) {
      return phone;
    }

    if (digits.startsWith('962')) {
      return `+${digits}`;
    }

    if (digits.startsWith('0')) {
      return `+962${digits.substring(1)}`;
    }

    if (digits.startsWith('7') && digits.length === 9) {
      return `+962${digits}`;
    }

    return `+${digits}`;
  };

  const validatePhone = (phone: string): boolean => {
    const digits = sanitizePhoneInput(phone);

    if (!digits) {
      return false;
    }

    let normalizedDigits = digits;

    if (normalizedDigits.startsWith('00')) {
      normalizedDigits = normalizedDigits.substring(2);
    }

    if (normalizedDigits.startsWith('9620') && normalizedDigits.length >= 12) {
      normalizedDigits = '962' + normalizedDigits.substring(4);
    }

    const patterns = [
      /^9627[0-9]{8}$/,
      /^07[0-9]{8}$/,
      /^7[0-9]{8}$/,
      /^[0-9]{9}$/,
    ];

    return patterns.some(pattern => pattern.test(normalizedDigits));
  };

  const handleSendSMS = async () => {
    const cleanPhone = phoneNumber.trim();
    const sanitizedPhone = sanitizePhoneInput(cleanPhone);

    if (!sanitizedPhone) {
      setErrors({ phone: t('auth.enterPhone') });
      return;
    }

    if (!validatePhone(sanitizedPhone)) {
      setErrors({ phone: t('auth.invalidPhone') });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Send SMS verification
      const response = await apiService.sendSMSVerification(sanitizedPhone, currentLanguage);

      if (response.success) {
        const phoneFromApi = response.data?.phone || sanitizedPhone;
        setNormalizedPhone(formatPhoneForDisplay(phoneFromApi));
        
        // Try to check if user exists (this might not be available in API)
        try {
          const userCheckResponse = await apiService.checkUserExists(sanitizedPhone);
          if (userCheckResponse.success && userCheckResponse.data?.exists) {
            // User exists, go directly to SMS verification
            setIsNewUser(false);
            setStep('sms');
          } else {
            // User doesn't exist, collect user data first
            setIsNewUser(true);
            setStep('user_data');
          }
        } catch (error) {
          // If user check endpoint doesn't exist, assume we need user data
          setIsNewUser(true);
          setStep('user_data');
        }
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

  const handleUserDataSubmit = () => {
    const newErrors: any = {};

    if (!userData.first_name.trim()) {
      newErrors.first_name = t('auth.firstNameRequired');
    }
    if (!userData.last_name.trim()) {
      newErrors.last_name = t('auth.lastNameRequired');
    }
    if (!userData.password) {
      newErrors.password = t('auth.enterPassword');
    }
    if (userData.password !== userData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep('sms');
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert(t('common.error'), t('sms.enterVerificationCode'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.authenticateWithSMS(
        normalizedPhone,
        verificationCode,
        isNewUser ? {
          first_name: userData.first_name,
          last_name: userData.last_name,
          password: userData.password,
        } : undefined
      );

      if (response.success) {
        const action = response.data?.action || 'login';
        const message = action === 'register' 
          ? t('sms.registrationSuccess') 
          : t('sms.loginSuccess');

        await completeAuthentication(response.data?.user);

        Alert.alert(
          t('common.success'),
          message,
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'AuthWelcome' }],
              }),
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), response.message || t('sms.verificationFailed'));
      }
    } catch (error) {
      console.error('SMS verification error:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <View style={styles.phoneStepContainer}>
      {/* Header with back button and language toggle */}
      <View style={styles.phoneHeader}>
        <TouchableOpacity 
          style={styles.backButtonSmall}
          onPress={() => navigation.goBack()}
        >
          <Icon 
            name={isRTL ? 'chevron-forward' : 'chevron-back'} 
            size={24} 
            color="#666" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.languageButton} 
          onPress={handleLanguageChange}
        >
          <Text style={styles.languageButtonText}>
            {currentLanguage === 'ar' ? 'English' : 'عربي'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logo Container */}
      <View style={styles.logoSection}>
        <View style={styles.logoContainer}>
          <Icon name="storefront" size={80} color={Colors.primary} />
        </View>
        <Text style={[styles.logoText, isRTL && styles.textRTL]}>
          {t('auth.qabalan')}
        </Text>
      </View>

      {/* Welcome Title */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeTitle, isRTL && styles.textRTL]}>
          {t('auth.fillYourPrivateApp')} 
        </Text>
        <Text style={[styles.welcomeSubtitle, isRTL && styles.textRTL]}>
          {t('auth.enterPhoneNumber')}
        </Text>
      </View>

      {/* Phone Input Section */}
      <View style={styles.phoneSection}>
        <Text style={[styles.phoneLabel, isRTL && styles.textRTL]}>
          {t('auth.phoneNumber')}
        </Text>
        
        <View style={[styles.phoneInputWrapper, errors.phone && styles.inputError]}>
          <View style={styles.countrySection}>
            <Text style={styles.flagText}>🇯🇴</Text>
            <Text style={styles.countryCodeText}>+962</Text>
          </View>
          <TextInput
            style={[styles.phoneTextInput, isRTL && styles.inputRTL]}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="790000000"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>
        
        {errors.phone && (
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {errors.phone}
          </Text>
        )}
      </View>

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.submitButton, (!phoneNumber.trim() || isLoading) && styles.submitButtonDisabled]}
        onPress={handleSendSMS}
        disabled={!phoneNumber.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.textWhite} size="small" />
        ) : (
          <Text style={[styles.submitButtonText, isRTL && styles.textRTL]}>
            {t('auth.loginRegister')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderUserDataStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Icon name="person-add" size={60} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t('auth.createAccount')}
        </Text>
        <Text style={[styles.description, isRTL && styles.textRTL]}>
          {t('sms.createAccountDescription')}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
          {t('auth.firstName')}
        </Text>
        <TextInput
          style={[
            styles.input,
            isRTL && styles.inputRTL,
            errors.first_name && styles.inputError,
          ]}
          value={userData.first_name}
          onChangeText={(text) => setUserData({ ...userData, first_name: text })}
          placeholder={t('auth.enterFirstName')}
          placeholderTextColor={Colors.textSecondary}
          textAlign={isRTL ? 'right' : 'left'}
        />
        {errors.first_name && (
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {errors.first_name}
          </Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
          {t('auth.lastName')}

        </Text>
        <TextInput
          style={[
            styles.input,
            isRTL && styles.inputRTL,
            errors.last_name && styles.inputError,
          ]}
          value={userData.last_name}
          onChangeText={(text) => setUserData({ ...userData, last_name: text })}
          placeholder={t('auth.enterLastName')}
          placeholderTextColor={Colors.textSecondary}
          textAlign={isRTL ? 'right' : 'left'}
        />
        {errors.last_name && (
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {errors.last_name}
          </Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
          {t('auth.password')}
        </Text>
        <TextInput
          style={[
            styles.input,
            isRTL && styles.inputRTL,
            errors.password && styles.inputError,
          ]}
          value={userData.password}
          onChangeText={(text) => setUserData({ ...userData, password: text })}
          placeholder={t('auth.enterPassword')}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          textAlign={isRTL ? 'right' : 'left'}
        />
        {errors.password && (
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {errors.password}
          </Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
          {t('auth.confirmPassword')}
        </Text>
        <TextInput
          style={[
            styles.input,
            isRTL && styles.inputRTL,
            errors.confirmPassword && styles.inputError,
          ]}
          value={userData.confirmPassword}
          onChangeText={(text) => setUserData({ ...userData, confirmPassword: text })}
          placeholder={t('auth.confirmPassword')}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry
          textAlign={isRTL ? 'right' : 'left'}
        />
        {errors.confirmPassword && (
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {errors.confirmPassword}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.sendButton}
        onPress={handleUserDataSubmit}
      >
        <Text style={[styles.sendButtonText, isRTL && styles.textRTL]}>
          {t('common.continue')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSMSStep = () => (
    <View style={styles.formContainer}>
      <View style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Icon name="chatbubble-ellipses" size={60} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t('sms.verificationTitle')}
        </Text>
        <Text style={[styles.description, isRTL && styles.textRTL]}>
          {t('sms.verificationDescription', { phone: normalizedPhone })}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
          {t('sms.verificationCode')}
        </Text>
        <TextInput
          style={[styles.input, isRTL && styles.inputRTL]}
          value={verificationCode}
          onChangeText={setVerificationCode}
          placeholder={t('sms.enterVerificationCode')}
          placeholderTextColor={Colors.textSecondary}
          keyboardType="numeric"
          textAlign={isRTL ? 'right' : 'left'}
          autoFocus
        />
      </View>

      <TouchableOpacity
        style={[
          styles.sendButton,
          (isLoading || !verificationCode.trim()) && styles.sendButtonDisabled,
        ]}
        onPress={handleVerifyCode}
        disabled={isLoading || !verificationCode.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.textWhite} size="small" />
        ) : (
          <Text style={[styles.sendButtonText, isRTL && styles.textRTL]}>
            {t('sms.verify')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 'phone' && renderPhoneStep()}
          {step === 'user_data' && renderUserDataStep()}
          {step === 'sms' && renderSMSStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Language Change Overlay */}
      <LanguageChangeOverlay
        visible={isChangingLanguage}
        targetLanguage={pendingLanguage || undefined}
        showRestartPrompt={false}
        loadingText={t('settings.changingLanguage')}
      />
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
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
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
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body.small,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.backgroundDark,
    borderRadius: 8,
    backgroundColor: Colors.backgroundCard,
  },
  countryCodeContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    borderRightWidth: 1,
    borderRightColor: Colors.backgroundDark,
  },
  countryCode: {
    ...Typography.body.medium,
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    ...Typography.body.medium,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    minHeight: 48,
  },
  input: {
    ...Typography.body.medium,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.backgroundDark,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.base,
    backgroundColor: Colors.backgroundCard,
    minHeight: 48,
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
    borderRadius: 8,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  sendButtonText: {
    ...Typography.body.medium,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  textRTL: {
    textAlign: 'right',
  },
  // New styles for redesigned interface
  phoneStepContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  phoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  backButtonSmall: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  languageButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 50,
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 28,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneSection: {
    marginBottom: 40,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'center',
  },
  countrySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    marginRight: 12,
  },
  flagText: {
    fontSize: 20,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    minHeight: 48,
  },
  submitButton: {
    backgroundColor: '#00BFA5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default UnifiedPhoneAuthScreen;
