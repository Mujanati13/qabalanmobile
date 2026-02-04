import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import PhoneLoginScreen from '../screens/PhoneLoginScreen';
import PhoneRegisterScreen from '../screens/PhoneRegisterScreen';
import SMSVerificationScreen from '../screens/SMSVerificationScreen';
import AuthWelcomeScreen from '../screens/AuthWelcomeScreen';
import UnifiedPhoneAuthScreen from '../screens/UnifiedPhoneAuthScreen';
import PhoneAuthScreen from '../screens/PhoneAuthScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import AddressSetupScreen from '../screens/AddressSetupScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      initialRouteName="AuthWelcome"
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerTintColor: '#333',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="AuthWelcome" 
        component={AuthWelcomeScreen} 
        options={{ 
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="PhoneLogin" 
        component={PhoneLoginScreen} 
        options={{ 
          title: t('sms.phoneLogin'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="PhoneAuth" 
        component={PhoneAuthScreen} 
        options={{ 
          title: t('auth.phoneLogin'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="UnifiedPhoneAuth" 
        component={UnifiedPhoneAuthScreen} 
        options={{ 
          title: t('auth.phoneLogin'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="PhoneRegister" 
        component={PhoneRegisterScreen} 
        options={{ 
          title: t('auth.register'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="SMSVerification" 
        component={SMSVerificationScreen} 
        options={{ 
          title: t('sms.verification'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ 
          title: t('auth.emailLogin'),
          headerShown: false, // Login screen has custom header
        }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ 
          title: t('auth.emailRegister'),
          headerShown: false, // Register screen has custom header
        }}
      />
      <Stack.Screen 
        name="AddressSetup" 
        component={AddressSetupScreen} 
        options={{ 
          title: t('addresses.addressSetup', { defaultValue: 'Address Setup' }),
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen} 
        options={{ 
          title: t('auth.forgotPassword'),
          headerShown: false, // Custom header
        }}
      />
      <Stack.Screen 
        name="ResetPassword" 
        component={ResetPasswordScreen} 
        options={{ 
          title: t('auth.resetPassword'),
          headerShown: false, // Custom header
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
