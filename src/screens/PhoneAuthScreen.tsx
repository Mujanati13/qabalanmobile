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
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import apiService from '../services/apiService';
import LanguageChangeOverlay from '../components/LanguageChangeOverlay';

interface PhoneAuthScreenProps {
  navigation: any;
}

const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguageWithAnimation, isChangingLanguage, needsRestart, pendingLanguage, confirmRestart, cancelRestart, isRTL } = useLanguage();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleLanguageChange = async () => {
    const newLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    await changeLanguageWithAnimation(newLanguage);
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

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    
    // Clear errors when user starts typing
    if (errors.phone) {
      setErrors({ ...errors, phone: '' });
    }
  };

  const handleContinue = async () => {
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    
    if (!cleanPhone) {
      setErrors({ phone: t('auth.enterPhone') });
      return;
    }

    if (!validatePhone(cleanPhone)) {
      setErrors({ phone: t('auth.invalidPhone') });
      return;
    }

    setIsCheckingUser(true);
    setErrors({});

    try {
      // First check if user exists
      const userCheckResponse = await apiService.checkUserExists(cleanPhone);
      
      if (userCheckResponse.success && userCheckResponse.data?.exists) {
        // User exists - proceed with login flow
        setIsCheckingUser(false);
        setIsLoading(true);
        
        try {
          // Send SMS verification for login
          const smsResponse = await apiService.sendSMSVerification(cleanPhone, currentLanguage);
          
          if (smsResponse.success) {
            navigation.navigate('SMSVerification', {
              phone: smsResponse.data?.phone || cleanPhone,
              mode: 'login',
              isExistingUser: true,
            });
          } else {
            Alert.alert(t('common.error'), smsResponse.message || t('sms.sendFailed'));
          }
        } catch (error) {
          console.error('SMS send error:', error);
          Alert.alert(t('common.error'), t('common.networkError'));
        } finally {
          setIsLoading(false);
        }
      } else {
        // User doesn't exist - proceed to address setup for new user
        setIsCheckingUser(false);
        setIsLoading(true);
        
        try {
          // Send SMS verification for new user
          const smsResponse = await apiService.sendSMSVerification(cleanPhone, currentLanguage);
          
          if (smsResponse.success) {
            navigation.navigate('SMSVerification', {
              phone: smsResponse.data?.phone || cleanPhone,
              mode: 'register',
              isExistingUser: false,
              userData: {
                first_name: 'User',
                last_name: 'Name',
                password: 'Temp123456!'
              }
            });
          } else {
            Alert.alert(t('common.error'), smsResponse.message || t('sms.sendFailed'));
          }
        } catch (error) {
          console.error('SMS send error:', error);
          Alert.alert(t('common.error'), t('common.networkError'));
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('User check error:', error);
      setIsCheckingUser(false);
      Alert.alert(t('common.error'), t('common.networkError'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back button and language toggle */}
          <View style={styles.phoneHeader}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonSmall}
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
              <Image 
                source={currentLanguage === 'ar' 
                  ? require('../assets/logo-arabic.png')
                  : require('../assets/logo.png')
                }
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Welcome Title */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeTitle, isRTL && styles.textRTL]}>
              {currentLanguage === 'ar' 
                ? 'أهلا بك في التطبيق الخاص بمخابر قبلان'
                : 'Welcome to Qabalan Bakery app'
              }
            </Text>
            <Text style={[styles.welcomeSubtitle, isRTL && styles.textRTL]}>
              {t('auth.enterPhoneNumber')}
            </Text>
          </View>

          {/* Phone Input Section */}
          <View style={styles.phoneSection}>
            <Text style={[styles.phoneLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>
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
                onChangeText={handlePhoneChange}
                placeholder="790000000"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
                maxLength={20}
                editable={!isLoading && !isCheckingUser}
              />
            </View>
            
            {errors.phone && (
              <Text style={[styles.errorText, isRTL && styles.textRTL]}>
                {errors.phone}
              </Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (isLoading || isCheckingUser || !phoneNumber.trim()) && styles.submitButtonDisabled]}
            onPress={handleContinue}
            disabled={isLoading || isCheckingUser || !phoneNumber.trim()}
          >
            {isCheckingUser ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                  {t('auth.checkingUser')}
                </Text>
              </View>
            ) : isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.submitButtonText, isRTL && styles.textRTL]}>
                {t('auth.loginRegister')}
              </Text>
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 24,
  },
  // New clean design styles
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 350,
    height: 150,
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
  inputError: {
    borderColor: Colors.error,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRTL: {
    textAlign: 'right',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default PhoneAuthScreen;