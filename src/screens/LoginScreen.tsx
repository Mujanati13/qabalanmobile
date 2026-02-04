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
import notificationService from '../services/notificationService';

interface LoginScreenProps {
  navigation: any; // You can type this properly with your navigation type
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { isRTL: contextIsRTL, currentLanguage } = useLanguage();
  const { login, continueAsGuest } = useAuth();

  // Use actual language for RTL detection so Arabic text displays correctly
  const isRTL = currentLanguage === 'ar';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = t('auth.enterEmail');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }

    if (!formData.password.trim()) {
      newErrors.password = t('auth.enterPassword');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoginLoading(true);
    const result = await login(formData);
    setIsLoginLoading(false);
    
    if (result.success) {
      // Register any pending FCM token after successful login
      try {
        await notificationService.registerPendingToken();
      } catch (error) {
        console.log('⚠️ Failed to register pending FCM token:', error);
      }
      
      // Navigation will be handled by the AuthProvider changing the app state
      Alert.alert(t('common.success'), t('auth.loginSuccess'));
    } else {
      // Set error message to stay on screen instead of just showing alert
      setErrors({ 
        email: ' ', // Add space to trigger error styling
        password: result.message || t('auth.loginFailed') 
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleGuestLogin = () => {
    continueAsGuest();
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
              {t('auth.login')}
            </Text>
          </View>

          <View style={styles.form}>
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
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: 'left', writingDirection: 'ltr' }
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
                <Text style={[styles.errorText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {errors.email}
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
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { textAlign: 'left', writingDirection: 'ltr' }
                  ]}
                  placeholder={t('auth.enterPassword')}
                  placeholderTextColor="#999"
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
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
                <Text style={[styles.errorText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={[styles.forgotPasswordText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.forgotPassword')}
              </Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoginLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoginLoading}
            >
              {isLoginLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.loginButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('auth.login')}</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('auth.dontHaveAccount')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('auth.register')}</Text>
              </TouchableOpacity>
            </View>

            {/* Guest Login Button */}
            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleGuestLogin}
            >
              <Text style={[styles.guestButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('auth.continueAsGuest')}</Text>
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
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 40,
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
    marginBottom: 20,
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
  inputIconRTL: {
    left: 'auto',
    right: 15,
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
  inputRTL: {
    paddingRight: 45,
    paddingLeft: 45,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    padding: 5,
  },
  eyeIconRTL: {
    right: 'auto',
    left: 15,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#a8c5e8',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  registerLink: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  guestButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  guestButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});

export default LoginScreen;
