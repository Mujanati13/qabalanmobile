import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import NotificationPopup from '../components/NotificationPopup';

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  onPress?: () => void;
  duration?: number;
}

class NotificationManager {
  private static instance: NotificationManager;
  private showNotificationCallback: ((notification: NotificationData) => void) | null = null;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  setShowNotificationCallback(callback: (notification: NotificationData) => void) {
    this.showNotificationCallback = callback;
  }

  showNotification(
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    onPress?: () => void,
    duration?: number
  ) {
    if (this.showNotificationCallback) {
      const notification: NotificationData = {
        id: Date.now().toString(),
        title,
        message,
        type,
        onPress,
        duration,
      };
      this.showNotificationCallback(notification);
    } else {
      console.warn('NotificationManager: No callback set. Make sure NotificationProvider is mounted.');
    }
  }
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);

  const showNotification = useCallback((notification: NotificationData) => {
    setCurrentNotification(notification);
  }, []);

  const hideNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  React.useEffect(() => {
    const manager = NotificationManager.getInstance();
    manager.setShowNotificationCallback(showNotification);

    return () => {
      manager.setShowNotificationCallback(() => {});
    };
  }, [showNotification]);

  return (
    <View style={styles.container}>
      {children}
      {currentNotification && (
        <NotificationPopup
          visible={true}
          title={currentNotification.title}
          message={currentNotification.message}
          type={currentNotification.type}
          onPress={currentNotification.onPress}
          onDismiss={hideNotification}
          duration={currentNotification.duration}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default NotificationManager;
