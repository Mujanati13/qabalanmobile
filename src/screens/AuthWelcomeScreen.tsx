import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const { width, height } = Dimensions.get('window');

interface AuthWelcomeScreenProps {
  navigation: any;
}

const AuthWelcomeScreen: React.FC<AuthWelcomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { continueAsGuest } = useAuth();

  const handlePhoneAuth = () => {
    navigation.navigate('PhoneAuth');
  };

  const handleEmailLogin = () => {
    navigation.navigate('Login');
  };

  const handleGuestLogin = () => {
    continueAsGuest();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Background */}
      <View
        style={[styles.gradient, { backgroundColor: '#FFFFFF' }]}
      >
        {/* Header Section */}
        <View style={styles.header}>
          {/* Logo/App Icon */}
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
          
          {/* Welcome Text */}
          <Text style={[styles.welcomeTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {t('auth.welcomeToQabalan')}
          </Text>
        </View>

        {/* Action Buttons Section */}
        <View style={styles.actionSection}>
          {/* Primary Phone Login */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handlePhoneAuth}
            activeOpacity={0.8}
          >
            <View
              style={[styles.primaryButtonGradient, { backgroundColor: Colors.primary }]}
            >
              <Icon name="call" size={24} color={Colors.textWhite} />
              <Text style={[styles.primaryButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('auth.continueWithPhone')}
              </Text>
              <Icon 
                name="chevron-forward"
                size={20} 
                color={Colors.textWhite} 
              />
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('auth.orContinueWith')}
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Login Option */}
          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleEmailLogin}
            activeOpacity={0.8}
          >
            <Icon name="mail" size={20} color={Colors.primary} />
            <Text style={[styles.emailButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('auth.emailLogin')}
            </Text>
          </TouchableOpacity>

          {/* Guest Login Option */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGuestLogin}
            activeOpacity={0.8}
          >
            <Icon name="person-outline" size={20} color={Colors.primary} />
            <Text style={[styles.secondaryButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('auth.continueAsGuest')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Section - Removed as requested */}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
  },
  welcomeTitle: {
    ...Typography.heading.h4,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontWeight: 'bold',
    writingDirection: 'ltr',
  },
  welcomeSubtitle: {
    ...Typography.body.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    writingDirection: 'ltr',
  },
  actionSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  primaryButton: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.body.medium,
    color: Colors.textWhite,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    writingDirection: 'ltr',
  },
  secondaryButton: {
    marginTop:10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.body.medium,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  secondaryButtonRTL: {
    flexDirection: 'row-reverse',
  },
  rtlMarginFix: {
    marginLeft: 0,
    marginRight: Spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    ...Typography.body.small,
    color: '#666666',
    marginHorizontal: Spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.md,
  },
  emailButtonText: {
    ...Typography.body.medium,
    color: Colors.primary,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default AuthWelcomeScreen;
