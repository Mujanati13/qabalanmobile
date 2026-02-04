import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import notificationService from '../services/notificationService';
import localNotificationService from '../services/localNotificationService';
import NotificationManager from '../services/NotificationManager';

interface NotificationTestProps {}

const NotificationTest: React.FC<NotificationTestProps> = () => {
  
  const testLocalNotification = () => {
    console.log('Testing local notification popup...');
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      'Test Notification',
      'This is a test notification popup to verify the system is working',
      'info',
      () => console.log('Test notification tapped'),
      5000
    );
  };

  const testLocalPushNotification = () => {
    console.log('Testing local push notification...');
    localNotificationService.showNotification(
      'Test Push Notification',
      'This is a test push notification',
      { type: 'test' },
      {
        priority: 'high',
        vibrate: true,
        playSound: true,
      }
    );
  };

  const checkInitialNotification = () => {
    console.log('Checking for initial notification...');
    localNotificationService.checkInitialNotification();
  };

  const checkMissedNotifications = async () => {
    console.log('Checking for missed notifications...');
    try {
      await notificationService.checkForMissedNotifications();
    } catch (error) {
      console.error('Error checking missed notifications:', error);
      const notificationManager = NotificationManager.getInstance();
      notificationManager.showNotification(
        'Error',
        'Failed to check for missed notifications',
        'error'
      );
    }
  };

  const testFCMToken = async () => {
    console.log('Testing FCM token...');
    try {
      const token = await notificationService.getStoredToken();
      const notificationManager = NotificationManager.getInstance();
      
      if (token) {
        console.log(`FCM Token found: ${token.substring(0, 20)}...`);
        notificationManager.showNotification(
          'FCM Token',
          `Token found: ${token.substring(0, 20)}...`,
          'success'
        );
      } else {
        notificationManager.showNotification(
          'FCM Token',
          'No token found. Try refreshing the token.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      const notificationManager = NotificationManager.getInstance();
      notificationManager.showNotification(
        'Error',
        'Failed to get FCM token',
        'error'
      );
    }
  };

  const testSupportReplyNotification = () => {
    console.log('Testing support reply notification...');
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      'New Support Reply',
      'Your support ticket #12345 has been replied to',
      'info',
      () => {
        console.log('Support notification tapped - would navigate to ticket');
      },
      6000
    );
  };

  const testSuccessNotification = () => {
    console.log('Testing success notification...');
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      'Success!',
      'Your action was completed successfully',
      'success',
      undefined,
      3000
    );
  };

  const testErrorNotification = () => {
    console.log('Testing error notification...');
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      'Error Occurred',
      'Something went wrong. Please try again.',
      'error',
      undefined,
      4000
    );
  };

  return (
    <View style={styles.container}>
      <Button
        title="Test Local Popup"
        onPress={testLocalNotification}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Test Local Push"
        onPress={testLocalPushNotification}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Check Initial Notification"
        onPress={checkInitialNotification}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Check Missed Notifications"
        onPress={checkMissedNotifications}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Check FCM Token"
        onPress={testFCMToken}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Test Support Reply"
        onPress={testSupportReplyNotification}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Test Success Popup"
        onPress={testSuccessNotification}
      />
      <View style={styles.spacing} />
      
      <Button
        title="Test Error Popup"
        onPress={testErrorNotification}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  spacing: {
    height: 10,
  },
});

export default NotificationTest;
