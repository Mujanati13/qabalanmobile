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
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import apiService from '../services/apiService';

interface RegisterScreenProps {
  navigation: any;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { isRTL: contextIsRTL, currentLanguage } = useLanguage();

  // Use actual language for RTL detection so Arabic text displays correctly
  const isRTL = currentLanguage === 'ar';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

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

    if (!formData.email.trim()) {
      newErrors.email = t('auth.enterEmail');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
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

    if (!formData.phone.trim()) {
      newErrors.phone = t('auth.enterPhone');
    } else if (!/^07[789]\d{7}$/.test(formData.phone)) {
      newErrors.phone = t('auth.invalidJordanPhone');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    // Format phone number for SMS verification (convert 07XXXXXXXX to 962XXXXXXXX)
    const formattedPhone = formData.phone.startsWith('07') 
      ? '962' + formData.phone.substring(1) 
      : formData.phone;

    try {
      // Send SMS verification code
      const response = await apiService.sendSMSVerification(formattedPhone, 'en');
      
      if (response.success) {
        // Navigate to SMS verification with user data
        navigation.navigate('SMSVerification', {
          phone: formattedPhone,
          mode: 'register',
          userData: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            password: formData.password,
          }
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { direction: isRTL ? 'rtl' : 'ltr' }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Icon 
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={24} 
                color={Colors.textPrimary} 
              />
            </TouchableOpacity>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
              {t('auth.register')}
            </Text>
          </View>

          <View style={styles.form}>
            {/* First Name Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.firstName')}
              </Text>
              <View style={[styles.inputWrapper, errors.first_name && styles.inputError]}>
                <Icon 
                  name="person-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder={t('auth.enterFirstName')}
                  placeholderTextColor="#999"
                  value={formData.first_name}
                  onChangeText={(value) => handleInputChange('first_name', value)}
                  autoCapitalize="words"
                />
              </View>
              {errors.first_name && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.first_name}
                </Text>
              )}
            </View>

            {/* Last Name Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.lastName')}
              </Text>
              <View style={[styles.inputWrapper, errors.last_name && styles.inputError]}>
                <Icon 
                  name="person-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder={t('auth.enterLastName')}
                  placeholderTextColor="#999"
                  value={formData.last_name}
                  onChangeText={(value) => handleInputChange('last_name', value)}
                  autoCapitalize="words"
                />
              </View>
              {errors.last_name && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.last_name}
                </Text>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.email')}
              </Text>
              <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                <Icon 
                  name="mail-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder={t('auth.enterEmail')}
                  placeholderTextColor="#999"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.email}
                </Text>
              )}
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.phone')} *
              </Text>
              <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                <Icon 
                  name="call-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder="07XXXXXXXX"
                  placeholderTextColor="#999"
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {errors.phone && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.phone}
                </Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.password')}
              </Text>
              <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                <Icon 
                  name="lock-closed-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor="#999"
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.eyeIcon, isRTL && styles.eyeIconRTL]}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Icon 
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.confirmPassword')}
              </Text>
              <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                <Icon 
                  name="lock-closed-outline" 
                  size={20} 
                  color="#666" 
                  style={[styles.inputIcon, isRTL && styles.inputIconRTL]}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
                    isRTL && styles.inputRTL
                  ]}
                  placeholder={t('auth.confirmPassword')}
                  placeholderTextColor="#999"
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleInputChange('confirmPassword', value)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.eyeIcon, isRTL && styles.eyeIconRTL]}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon 
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={[styles.errorText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {errors.confirmPassword}
                </Text>
              )}
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.registerButtonText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('auth.sendVerificationCode')}</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('auth.alreadyHaveAccount')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{t('auth.login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    position: 'relative',
  },
  inputError: {
    borderColor: '#ff4757',
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 45,
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  registerButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  registerButtonDisabled: {
    backgroundColor: '#a8c5e8',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  loginLink: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  // RTL styles
  inputIconRTL: {
    position: 'absolute',
    right: 15,
    left: 'auto',
    zIndex: 1,
  },
  inputRTL: {
    paddingLeft: 45,
    paddingRight: 45,
  },
  eyeIconRTL: {
    position: 'absolute',
    left: 15,
    right: 'auto',
    padding: 5,
  },
});

export default RegisterScreen;
