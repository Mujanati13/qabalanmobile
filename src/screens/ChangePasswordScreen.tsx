import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import apiService from '../services/apiService';

interface ChangePasswordScreenProps {
  navigation: any;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const isRTL = false; // Override to force LTR
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSettingFirstPassword, setIsSettingFirstPassword] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!isSettingFirstPassword && !formData.currentPassword) {
      newErrors.currentPassword = t('profile.currentPassword') + ' ' + t('common.required');
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t('profile.newPassword') + ' ' + t('common.required');
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t('auth.passwordTooShort');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = t('auth.passwordWeak');
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('profile.confirmNewPassword') + ' ' + t('common.required');
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('profile.passwordsDoNotMatch');
    }

    if (!isSettingFirstPassword && formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = t('profile.passwordMustDiffer');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Attempting to change password...');
      const response = await apiService.changePassword(
        formData.currentPassword,
        formData.newPassword
      );
      
      console.log('🔐 Password change response:', response);
      
      if (response.success) {
        Alert.alert(
          t('common.success'),
          t('profile.passwordChanged'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
      } else {
        console.log('❌ Password change failed:', response.message);
        throw new Error(response.message || 'Password change failed');
      }
    } catch (error: any) {
      console.error('❌ Error changing password:', error);
      
      // Handle different types of errors
      if (error.message?.includes('Network request failed')) {
        Alert.alert(
          t('common.error'), 
          t('profile.networkErrorMessage')
        );
      } else if (error.message?.includes('No password set')) {
        // User doesn't have a password set - switch to set password mode
        setIsSettingFirstPassword(true);
        setFormData(prev => ({ ...prev, currentPassword: '' }));
        Alert.alert(
          t('profile.setPasswordTitle'),
          t('profile.setPasswordMessage')
        );
      } else if (error.message?.includes('incorrect') || error.message?.includes('Current password is incorrect')) {
        setErrors({ currentPassword: t('profile.currentPasswordIncorrect') });
      } else if (error.message?.includes('validation')) {
  Alert.alert(t('common.error'), t('profile.validationError'));
      } else {
        Alert.alert(
          t('common.error'), 
          error.message || t('profile.passwordChangeFailed')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    // Validate new password and confirmation only
    const newErrors: Record<string, string> = {};

    if (!formData.newPassword) {
      newErrors.newPassword = t('profile.newPassword') + ' ' + t('common.required');
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = t('auth.passwordTooShort');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = t('auth.passwordWeak');
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('profile.confirmNewPassword') + ' ' + t('common.required');
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('profile.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Setting password for first time...');
      const response = await apiService.setPassword(formData.newPassword);
      
      console.log('🔐 Set password response:', response);
      
      if (response.success) {
        Alert.alert(
          t('common.success'),
          t('profile.passwordSet'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
      } else {
        console.log('❌ Set password failed:', response.message);
        throw new Error(response.message || 'Failed to set password');
      }
    } catch (error: any) {
      console.error('❌ Error setting password:', error);
      Alert.alert(
        t('common.error'), 
        error.message || t('profile.setPasswordFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '', color: '#ddd' };
    
    let strength = 0;
    let text = '';
    let color = '#FF3B30';

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    switch (strength) {
      case 0:
      case 1:
        text = t('profile.passwordStrengthVeryWeak');
        color = '#FF3B30';
        break;
      case 2:
        text = t('profile.passwordStrengthWeak');
        color = '#FF9500';
        break;
      case 3:
        text = t('profile.passwordStrengthFair');
        color = '#FFCC00';
        break;
      case 4:
        text = t('profile.passwordStrengthGood');
        color = '#30D158';
        break;
      case 5:
        text = t('profile.passwordStrengthStrong');
        color = '#007AFF';
        break;
    }

    return { strength: (strength / 5) * 100, text, color };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isSettingFirstPassword ? t('profile.setPassword') : t('profile.changePassword')}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isSettingFirstPassword 
              ? t('profile.setPasswordDescription')
              : t('profile.changePasswordDescription')
            }
          </Text>

          {!isSettingFirstPassword && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('profile.currentPassword')}</Text>
              <View style={styles.passwordInput}>
                <TextInput
                  style={[styles.input, errors.currentPassword && styles.inputError]}
                  value={formData.currentPassword}
                  onChangeText={(value) => handleInputChange('currentPassword', value)}
                  placeholder={t('profile.currentPassword')}
                  secureTextEntry={!showPasswords.current}
                  textAlign={isRTL ? 'right' : 'left'}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('current')}
                >
                  <Icon 
                    name={showPasswords.current ? 'eye-off' : 'eye'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              {errors.currentPassword && (
                <Text style={styles.errorText}>{errors.currentPassword}</Text>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.newPassword')}</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, errors.newPassword && styles.inputError]}
                value={formData.newPassword}
                onChangeText={(value) => handleInputChange('newPassword', value)}
                placeholder={t('profile.newPassword')}
                secureTextEntry={!showPasswords.new}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('new')}
              >
                <Icon 
                  name={showPasswords.new ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            
            {/* Password Strength Indicator */}
            {formData.newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View 
                    style={[
                      styles.strengthFill,
                      { 
                        width: `${passwordStrength.strength}%`,
                        backgroundColor: passwordStrength.color 
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.text}
                </Text>
              </View>
            )}
            
            {errors.newPassword && (
              <Text style={styles.errorText}>{errors.newPassword}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.confirmNewPassword')}</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                placeholder={t('profile.confirmNewPassword')}
                secureTextEntry={!showPasswords.confirm}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('confirm')}
              >
                <Icon 
                  name={showPasswords.confirm ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>{t('profile.passwordRequirementsTitle')}:</Text>
            <View style={styles.requirement}>
              <Icon 
                name={formData.newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={formData.newPassword.length >= 8 ? '#30D158' : '#ddd'} 
              />
              <Text style={styles.requirementText}>{t('profile.passwordRequirementLength')}</Text>
            </View>
            <View style={styles.requirement}>
              <Icon 
                name={/[a-z]/.test(formData.newPassword) ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={/[a-z]/.test(formData.newPassword) ? '#30D158' : '#ddd'} 
              />
              <Text style={styles.requirementText}>{t('profile.passwordRequirementLowercase')}</Text>
            </View>
            <View style={styles.requirement}>
              <Icon 
                name={/[A-Z]/.test(formData.newPassword) ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={/[A-Z]/.test(formData.newPassword) ? '#30D158' : '#ddd'} 
              />
              <Text style={styles.requirementText}>{t('profile.passwordRequirementUppercase')}</Text>
            </View>
            <View style={styles.requirement}>
              <Icon 
                name={/\d/.test(formData.newPassword) ? 'checkmark-circle' : 'ellipse-outline'} 
                size={16} 
                color={/\d/.test(formData.newPassword) ? '#30D158' : '#ddd'} 
              />
              <Text style={styles.requirementText}>{t('profile.passwordRequirementNumber')}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.changeButton, loading && styles.changeButtonDisabled]}
          onPress={isSettingFirstPassword ? handleSetPassword : handleChangePassword}
          disabled={loading}
        >
          <Text style={styles.changeButtonText}>
            {loading 
              ? t('common.loading') 
              : (isSettingFirstPassword ? t('profile.setPassword') : t('profile.changePassword'))
            }
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  form: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSectionTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSectionSubtitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlLabel: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  passwordInput: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    paddingRight: 48,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStrengthText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  requirementsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlRequirementsTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlRequirementText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlErrorText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  changeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  changeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlChangeButtonText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});

export default ChangePasswordScreen;
