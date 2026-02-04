import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import ApiService from '../services/apiService';

interface NotificationTestScreenProps {
  navigation: any;
}

const NotificationTestScreen: React.FC<NotificationTestScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [fcmToken, setFcmToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      // Check permission status
      const hasPermission = await notificationService.requestPermission();
      setPermissionStatus(hasPermission ? 'granted' : 'denied');

      // Get current FCM token
      const token = await notificationService.getFCMToken();
      setFcmToken(token || 'No token available');
    } catch (error) {
      console.error('Error checking notification status:', error);
      Alert.alert('Error', 'Failed to check notification status');
    }
  };

  const requestPermission = async () => {
    try {
      setLoading(true);
      const granted = await notificationService.requestPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (granted) {
        Alert.alert('Success', 'Notification permission granted!');
        const token = await notificationService.getFCMToken();
        setFcmToken(token || 'No token available');
      } else {
        Alert.alert('Permission Denied', 'Notification permission was denied');
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!user) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    if (!fcmToken || fcmToken === 'No token available') {
      Alert.alert('Error', 'FCM token not available');
      return;
    }

    try {
      setLoading(true);
      
      // Get the access token
      const accessToken = await ApiService.getAccessToken();
      if (!accessToken) {
        Alert.alert('Error', 'Authentication token not available');
        return;
      }
      
      // Send a test notification via the backend
      const response = await fetch(`${ApiService.getBaseURL()}/api/admin/test-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test notification from FECS app!',
          data: {
            type: 'test',
            action: 'navigate',
            screen: 'Orders'
          },
          token: fcmToken
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Test notification sent successfully!');
      } else {
        Alert.alert('Error', result.message || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const clearToken = async () => {
    try {
      setLoading(true);
      await notificationService.clearToken();
      setFcmToken('Token cleared');
      Alert.alert('Success', 'FCM token cleared successfully!');
    } catch (error) {
      console.error('Error clearing token:', error);
      Alert.alert('Error', 'Failed to clear token');
    } finally {
      setLoading(false);
    }
  };

  const sendSelfTest = async () => {
    try {
      setLoading(true);
      const res = await ApiService.sendSelfTestNotification();
      if (res?.success) {
        Alert.alert('Success', 'Self-test notification requested. Check your device.');
      } else {
        Alert.alert('Error', res?.message || 'Failed to request self-test');
      }
    } catch (error) {
      console.error('Error requesting self-test notification:', error);
      Alert.alert('Error', 'Self-test request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Push Notification Test</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permission Status</Text>
          <Text style={[
            styles.statusText,
            { color: permissionStatus === 'granted' ? '#27ae60' : '#e74c3c' }
          ]}>
            {permissionStatus.toUpperCase()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FCM Token</Text>
          <Text style={styles.tokenText} numberOfLines={4}>
            {fcmToken}
          </Text>
        </View>

  <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={requestPermission}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Request Permission</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={sendSelfTest}
            disabled={loading || !user}
          >
            <Text style={[styles.buttonText, { color: '#007AFF' }]}>Self-Test via Backend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={checkNotificationStatus}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: '#007AFF' }]}>
              Refresh Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={sendTestNotification}
            disabled={loading || !user || !fcmToken || fcmToken === 'No token available'}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Test Notification</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={clearToken}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Clear Token</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Instructions:</Text>
          <Text style={styles.infoText}>
            1. Make sure you're logged in{'\n'}
            2. Grant notification permission{'\n'}
            3. Send a test notification{'\n'}
            4. Check if notification is received{'\n'}
            5. Tap notification to test navigation
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 4,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#1976d2',
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    lineHeight: 20,
  },
});

export default NotificationTestScreen;
