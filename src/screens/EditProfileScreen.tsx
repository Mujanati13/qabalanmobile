import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Modal,
  I18nManager,
} from 'react-native';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import apiService, { User } from '../services/apiService';

interface EditProfileScreenProps {
  navigation: any;
  route?: {
    params?: {
      isFirstTime?: boolean;
    };
  };
}

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isRTL = false; // Override to force LTR
  const { user: authUser, updateUser } = useAuth();
  const isFirstTime = route?.params?.isFirstTime || false;

  // Helper function to format date to YYYY-MM-DD
  const formatDateToYYYYMMDD = (dateStr: string): string | null => {
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse other formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null; // Invalid date
    }
    
    // Format to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: '',
    notification_promo: true,
    notification_orders: true,
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState('');

  useEffect(() => {
    if (authUser) {
      setFormData({
        first_name: authUser.first_name || '',
        last_name: authUser.last_name || '',
        email: authUser.email || '',
        phone: authUser.phone || '',
        gender: authUser.gender || '',
        birth_date: authUser.birth_date || '',
        notification_promo: authUser.notification_promo ?? true,
        notification_orders: authUser.notification_orders ?? true,
      });
    }
  }, [authUser]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // First name validation - must be at least 2 characters (matching backend)
    if (!formData.first_name.trim()) {
      newErrors.first_name = t('auth.firstNameRequired');
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = t('profile.firstNameMinLength');
    }

    // Last name validation - must be at least 2 characters (matching backend)
    if (!formData.last_name.trim()) {
      newErrors.last_name = t('auth.lastNameRequired');
    } else if (formData.last_name.trim().length < 2) {
      newErrors.last_name = t('profile.lastNameMinLength');
    }

    // Email validation - matching backend regex exactly
    if (!formData.email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }

    // Phone validation - phone should already exist from SMS verification
    // Just verify it exists for first-time users (it's read-only)
    if (isFirstTime && !formData.phone.trim()) {
      newErrors.phone = t('auth.phoneRequired');
    }

    // Birth date validation - required when isFirstTime
    if (isFirstTime && !formData.birth_date.trim()) {
      newErrors.birth_date = t('auth.birthDateRequired');
    } else if (formData.birth_date && formData.birth_date.trim()) {
      const formatted = formatDateToYYYYMMDD(formData.birth_date.trim());
      if (!formatted) {
        newErrors.birth_date = t('profile.invalidBirthDate');
      }
    }

    // Gender validation - required when isFirstTime
    if (isFirstTime && !formData.gender) {
      newErrors.gender = t('auth.genderRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Prepare and validate birth date
      let birthDate = null;
      if (formData.birth_date && formData.birth_date.trim()) {
        const dateStr = formData.birth_date.trim();
        birthDate = formatDateToYYYYMMDD(dateStr);
        
        if (!birthDate) {
          Alert.alert(
            t('common.error'),
            t('profile.invalidBirthDate')
          );
          setLoading(false);
          return;
        }
      }

      // Clean and prepare all data
      const updateData: any = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone ? formData.phone.trim() : undefined,
        birth_date: birthDate,
        gender: formData.gender || undefined
      };

      // Remove empty/null/undefined values to avoid backend validation issues
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined || updateData[key] === '') {
          delete updateData[key];
        }
      });

      console.log('Sending cleaned profile update data:', updateData);
      const response = await apiService.updateUserProfile(updateData);
      
      if (response.success && response.data) {
        // Update auth context with new user data
        updateUser(response.data);
        
        // If this is first-time profile completion, navigate to home screen
        if (isFirstTime) {
          Alert.alert(
            t('common.success'),
            t('profile.profileCompleted'),
            [{ 
              text: t('common.ok'), 
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            }]
          );
        } else {
          Alert.alert(
            t('common.success'),
            t('profile.profileUpdated'),
            [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
          );
        }
      } else {
        throw new Error(response.message || t('profile.updateFailed'));
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      // Handle specific errors
      if (error.message?.includes('email') || error.message?.includes('Email')) {
        setErrors({ email: t('profile.emailInUse') });
      } else if (error.message?.includes('phone') || error.message?.includes('Phone')) {
        setErrors({ phone: t('profile.phoneInUse') });
      } else if (error.message?.includes('Validation failed')) {
        // Log detailed validation errors
        console.error('Validation failed details:', error);
        Alert.alert(
          t('common.error'), 
          t('profile.validationError')
        );
      } else {
        Alert.alert(t('common.error'), error.message || t('common.tryAgain'));
      }
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

  const toggleNotification = (field: 'notification_promo' | 'notification_orders') => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleDateChange = () => {
    setShowDatePicker(true);
    // Initialize with current date or today's date
    setTempDate(formData.birth_date || new Date().toISOString().split('T')[0]);
  };

  const confirmDate = () => {
    if (tempDate) {
      setFormData(prev => ({ ...prev, birth_date: tempDate }));
    }
    setShowDatePicker(false);
  };

  const cancelDate = () => {
    setTempDate(formData.birth_date);
    setShowDatePicker(false);
  };

  const handleDateInput = (text: string) => {
    // Allow only numbers, dashes, and slashes, format as YYYY-MM-DD
    let cleanedText = text.replace(/[^0-9\-\/]/g, '');
    
    // Auto-format to YYYY-MM-DD as user types
    if (cleanedText.length === 8 && !cleanedText.includes('-')) {
      // If user enters YYYYMMDD, format to YYYY-MM-DD
      cleanedText = `${cleanedText.substring(0, 4)}-${cleanedText.substring(4, 6)}-${cleanedText.substring(6, 8)}`;
    } else if (cleanedText.includes('/')) {
      // Convert MM/DD/YYYY or DD/MM/YYYY to YYYY-MM-DD
      const parts = cleanedText.split('/');
      if (parts.length === 3) {
        const [part1, part2, part3] = parts;
        if (part3.length === 4) {
          // Assume MM/DD/YYYY format
          cleanedText = `${part3}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
        }
      }
    }
    
    setTempDate(cleanedText);
  };

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as any, // Fix for TypeScript compatibility
    };

    Alert.alert(
      t('profile.updateProfilePicture'),
      t('profile.selectImageSource'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.selectFromGallery'),
          onPress: () => {
            launchImageLibrary(options, handleImageResponse);
          }
        }
      ]
    );
  };

  const handleImageResponse = async (response: ImagePickerResponse) => {
    if (response.didCancel || !response.assets || response.assets.length === 0) {
      return;
    }

    const asset = response.assets[0];
    if (!asset.uri) {
      Alert.alert(t('common.error'), t('profile.imageSelectionFailed'));
      return;
    }

    try {
      setLoading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'profile.jpg',
      } as any);

      // Upload image
      const uploadResponse = await apiService.uploadFile(formData);
      
      console.log('📸 Upload response:', uploadResponse);
      console.log('📸 Upload response success:', uploadResponse.success);
      console.log('📸 Upload response data:', uploadResponse.data);
      console.log('📸 Upload response message:', uploadResponse.message);
      console.log('📸 Upload response errors:', uploadResponse.errors);
      
      if (uploadResponse.success && uploadResponse.data?.url) {
        console.log('🔗 Image URL received:', uploadResponse.data.url);
        
        // Update user avatar
        const updateResponse = await apiService.updateUserProfile({
          avatar: uploadResponse.data.url
        });
        
        console.log('👤 Profile update response:', updateResponse);
        
        if (updateResponse.success && updateResponse.data) {
          console.log('✅ Updated user data:', updateResponse.data);
          updateUser(updateResponse.data);
          Alert.alert(t('common.success'), t('profile.profilePictureUpdated'));
        } else {
          console.log('❌ Profile update failed:', updateResponse);
          throw new Error(updateResponse.message || t('profile.updateFailed'));
        }
      } else {
        console.log('❌ Upload failed - Response details:', {
          success: uploadResponse.success,
          hasData: !!uploadResponse.data,
          hasUrl: !!uploadResponse.data?.url,
          data: uploadResponse.data,
          message: uploadResponse.message,
          errors: uploadResponse.errors
        });
        throw new Error(uploadResponse.message || t('profile.imageUploadFailed'));
      }
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      Alert.alert(t('common.error'), error.message || t('common.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* First-time profile completion notification */}
        {isFirstTime && (
          <View style={styles.notificationBanner}>
            <Icon name="information-circle" size={24} color="#007AFF" />
            <Text style={styles.notificationText}>
              {t('profile.completeYourProfile')}
            </Text>
          </View>
        )}
        
        {isFirstTime && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {t('profile.requiredFieldsMessage')}
            </Text>
          </View>
        )}

        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <View style={styles.avatarContainer}>
            {authUser?.avatar ? (
              <Image 
                source={{ uri: authUser.avatar }} 
                style={styles.avatar}
                onLoad={() => console.log('✅ Profile image loaded successfully:', authUser.avatar)}
                onError={(error) => console.log('❌ Profile image failed to load:', error.nativeEvent.error, 'URL:', authUser.avatar)}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Icon name="person" size={40} color="#666" />
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={handleImagePicker}
            disabled={loading}
          >
            <Text style={styles.changePhotoText}>{t('profile.updateProfilePicture')}</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.firstName')}</Text>
            <TextInput
              style={[styles.input, errors.first_name && styles.inputError]}
              value={formData.first_name}
              onChangeText={(value) => handleInputChange('first_name', value)}
              placeholder={t('profile.firstName')}
              textAlign={isRTL ? 'right' : 'left'}
            />
            {errors.first_name && (
              <Text style={styles.errorText}>{errors.first_name}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.lastName')}</Text>
            <TextInput
              style={[styles.input, errors.last_name && styles.inputError]}
              value={formData.last_name}
              onChangeText={(value) => handleInputChange('last_name', value)}
              placeholder={t('profile.lastName')}
              textAlign={isRTL ? 'right' : 'left'}
            />
            {errors.last_name && (
              <Text style={styles.errorText}>{errors.last_name}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.email')}</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              placeholder={t('profile.email')}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign={isRTL ? 'right' : 'left'}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('profile.phone')}
              {isFirstTime && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError, isFirstTime && styles.inputDisabled]}
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              placeholder={t('profile.phone')}
              keyboardType="phone-pad"
              textAlign={isRTL ? 'right' : 'left'}
              editable={false}
            />
            {isFirstTime && (
              <Text style={styles.helperText}>{t('profile.phoneFromRegistration')}</Text>
            )}
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('profile.birthDate')}
              {isFirstTime && <Text style={styles.required}> *</Text>}
            </Text>
            <TouchableOpacity 
              style={[styles.input, errors.birth_date && styles.inputError]}
              onPress={handleDateChange}
            >
              <Text style={[
                styles.inputText, 
                !formData.birth_date && styles.placeholderText
              ]}>
                {formData.birth_date || t('profile.selectBirthDate')}
              </Text>
              <Icon name="calendar-outline" size={20} color="#666" />
            </TouchableOpacity>
            {errors.birth_date && (
              <Text style={styles.errorText}>{errors.birth_date}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('profile.gender')}
              {isFirstTime && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={styles.genderContainer}>
              {['male', 'female'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderOption,
                    formData.gender === g && styles.genderOptionSelected,
                  ]}
                  onPress={() => handleInputChange('gender', g)}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      formData.gender === g && styles.genderOptionTextSelected,
                    ]}
                  >
                    {t(`auth.${g}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.gender && (
              <Text style={styles.errorText}>{errors.gender}</Text>
            )}
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.notificationSettings')}</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>{t('profile.promoNotifications')}</Text>
              <Text style={styles.switchDescription}>
                {t('profile.promoNotificationsDescription')}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.switch,
                formData.notification_promo && styles.switchActive
              ]}
              onPress={() => toggleNotification('notification_promo')}
            >
              <View style={[
                styles.switchThumb,
                formData.notification_promo && styles.switchThumbActive
              ]} />
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>{t('profile.orderNotifications')}</Text>
              <Text style={styles.switchDescription}>
                {t('profile.orderNotificationsDescription')}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.switch,
                formData.notification_orders && styles.switchActive
              ]}
              onPress={() => toggleNotification('notification_orders')}
            >
              <View style={[
                styles.switchThumb,
                formData.notification_orders && styles.switchThumbActive
              ]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? t('common.loading') : t('profile.saveChanges')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelDate}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={cancelDate}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('profile.selectBirthDate')}</Text>
              <TouchableOpacity onPress={confirmDate}>
                <Text style={styles.modalConfirmText}>{t('common.confirm')}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>{t('profile.dateInputLabel')}</Text>
              <TextInput
                style={styles.dateInput}
                value={tempDate}
                onChangeText={handleDateInput}
                placeholder={t('profile.datePlaceholder')}
                maxLength={10}
                keyboardType="numeric"
              />
              <Text style={styles.dateInputHint}>
                {t('profile.dateInputHint')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
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
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 12,
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  infoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 20,
  },
  profilePictureSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
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
    marginBottom: 16,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSectionTitle: {
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputDisabled: {
    backgroundColor: '#f8f9fa',
    opacity: 0.7,
  },
  helperText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  placeholderText: {
    color: '#999',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSwitchLabel: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSwitchDescription: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#007AFF',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlModalTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalConfirmText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  dateInputContainer: {
    marginBottom: 20,
  },
  dateInputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  dateInputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  required: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    minWidth: '48%',
    alignItems: 'center',
  },
  genderOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF15',
  },
  genderOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  genderOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default EditProfileScreen;
