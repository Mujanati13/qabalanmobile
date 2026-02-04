import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  I18nManager,
} from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';
import LanguageChangeOverlay from '../components/LanguageChangeOverlay';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { 
    t, 
    currentLanguage, 
    changeLanguageWithAnimation, 
    availableLanguages,
    isChangingLanguage,
    needsRestart,
    pendingLanguage,
    confirmRestart,
    cancelRestart,
    isRTL,
  } = useLanguage();
  const { user, logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Handle language change with animation
  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) {
      return; // No change needed
    }
    
    try {
      const result = await changeLanguageWithAnimation(languageCode);
      
      if (!result.success) {
        Alert.alert(
          t('common.error'),
          t('settings.languageChangeError'),
        );
      }
    } catch (error) {
      console.error('[SettingsScreen] Language change error:', error);
      Alert.alert(
        t('common.error'),
        t('settings.languageChangeError'),
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('settings.logoutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('common.error'), t('settings.logoutError'));
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteAccountWarning'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.continue'),
          style: 'destructive',
          onPress: () => setShowDeleteModal(true),
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      Alert.alert(t('common.error'), t('settings.passwordRequired'));
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await apiService.requestAccountDeletion(deletePassword);
      
      if (response.success) {
        Alert.alert(
          t('settings.deleteRequestSubmitted'),
          t('settings.deleteRequestMessage'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                setShowDeleteModal(false);
                setDeletePassword('');
              },
            },
          ]
        );
      } else {
        Alert.alert(t('common.error'), response.message || t('settings.deleteAccountError'));
      }
    } catch (error: any) {
      console.error('Delete account error:', error);
      Alert.alert(t('common.error'), error.message || t('settings.deleteAccountError'));
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setDeletePassword('');
    }
  };

  const renderSettingItem = (
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode,
    showArrow: boolean = true
  ) => (
    <TouchableOpacity 
      style={[styles.settingItem, isRTL && styles.rtlSettingItem]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingContent, isRTL && styles.rtlSettingContent]}>
        <Text style={[styles.settingTitle, isRTL && styles.rtlText]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, isRTL && styles.rtlText]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightComponent && (
        <View style={styles.settingRight}>
          {rightComponent}
        </View>
      )}
      {showArrow && !rightComponent && (
        <Text style={[styles.arrow, isRTL && styles.rtlArrow]}>›</Text>
      )}
    </TouchableOpacity>
  );

  const languageOptions = Object.entries(availableLanguages).map(([code, fallbackLabel]) => ({
    code,
    label: t(`settings.languageOptions.${code}.label`, { defaultValue: fallbackLabel }),
    nativeName: t(`settings.languageOptions.${code}.native`, { defaultValue: fallbackLabel }),
  }));

  const renderLanguageSelector = () => {

    return (
      <View style={[styles.languageSelector, isRTL && styles.rtlLanguageSelector]}>
        {languageOptions.map((language) => (
          <TouchableOpacity
            key={language.code}
            style={[
              styles.languageOption,
              isRTL && styles.rtlLanguageOption,
              currentLanguage === language.code && styles.selectedLanguage,
            ]}
            onPress={() => handleLanguageChange(language.code)}
          >
            <Text
              style={[
                styles.languageText,
                isRTL && styles.rtlText,
                currentLanguage === language.code && styles.selectedLanguageText,
              ]}
            >
              {language.label}
            </Text>
            {currentLanguage === language.code && (
              <Text style={[styles.checkmark, isRTL && styles.rtlCheckmark]}>
                ✓
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlHeader]}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('navigation.settings')}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('settings.profile')}
          </Text>
          
          {/* Edit Profile */}
          {renderSettingItem(
            t('profile.editProfile'),
            t('settings.profileEditDescription'),
            () => navigation.navigate('EditProfile')
          )}
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('settings.language')}
          </Text>
          
          {/* Language Settings */}
          {renderSettingItem(
            t('settings.language'),
            t('settings.languagePreferenceDescription')
          )}
          {renderLanguageSelector()}
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={[styles.logoutText, isRTL && styles.rtlText]}>
              {t('auth.logout')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delete Account Button */}
        <View style={styles.dangerZone}>
          <TouchableOpacity 
            style={styles.deleteAccountButton} 
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.deleteAccountText, isRTL && styles.rtlText]}>
              {t('settings.deleteAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('settings.confirmDeleteAccount')}
            </Text>
            <Text style={[styles.modalMessage, isRTL && styles.rtlText]}>
              {t('settings.deleteAccountConfirmMessage')}
            </Text>
            
            <TextInput
              style={[styles.passwordInput, isRTL && styles.rtlPasswordInput]}
              placeholder={t('auth.password')}
              placeholderTextColor="#999"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
              textAlign={isRTL ? 'right' : 'left'}
            />
            
            <View style={[styles.modalButtons, isRTL && styles.rtlModalButtons]}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                <Text style={[styles.modalCancelText, isRTL && styles.rtlText]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteLoading && styles.modalDeleteButtonDisabled
                ]}
                onPress={confirmDeleteAccount}
                disabled={deleteLoading}
              >
                <Text style={[styles.modalDeleteText, isRTL && styles.rtlText]}>
                  {deleteLoading ? t('common.loading') : t('settings.deleteAccount')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Change Overlay with Animation */}
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
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    // direction is not valid in React Native StyleSheet
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  rtlHeader: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlHeaderTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 10,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSectionTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9ecef',
  },
  rtlSettingItem: {
    flexDirection: 'row-reverse',
  },
  settingContent: {
    flex: 1,
  },
  rtlSettingContent: {
    alignItems: 'flex-end',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSettingTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSettingSubtitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  settingRight: {
    marginLeft: 10,
  },
  arrow: {
    fontSize: 18,
    color: '#ccc',
    marginLeft: 10,
  },
  rtlArrow: {
    transform: [{ rotate: '180deg' }],
    marginLeft: 0,
    marginRight: 10,
  },
  languageSelector: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  rtlLanguageSelector: {
    alignItems: 'flex-end',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  rtlLanguageOption: {
    flexDirection: 'row-reverse',
  },
  selectedLanguage: {
    backgroundColor: '#007bff',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlLanguageText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  selectedLanguageText: {
    color: '#fff',
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSelectedLanguageText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  checkmark: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  rtlCheckmark: {
    marginRight: 0,
    marginLeft: 10,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlLogoutText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  dangerZone: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  deleteAccountButton: {
    padding: 10,
    alignItems: 'center',
  },
  deleteAccountText: {
    color: '#dc3545',
    fontSize: 12,
    textDecorationLine: 'underline',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlDeleteAccountText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 10,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlModalTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: 20,
    lineHeight: 20,
  },
  rtlModalMessage: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  passwordInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlPasswordInput: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  rtlModalButtons: {
    flexDirection: 'row-reverse',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlModalCancelText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalDeleteButtonDisabled: {
    backgroundColor: '#aaa',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlModalDeleteText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});

export default SettingsScreen;
