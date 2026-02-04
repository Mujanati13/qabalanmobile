import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import NotificationManager from './NotificationManager';

interface NotificationData {
  type?: string;
  [key: string]: any;
}

class LocalNotificationService {
  private isConfigured: boolean = false;
  private navigationRef: any = null;

  setNavigationRef(ref: any) {
    this.navigationRef = ref;
  }

  configure() {
    // Prevent multiple configurations
    if (this.isConfigured) {
      console.log('[LOCAL_NOTIF] Already configured, skipping...');
      return;
    }

    console.log('[LOCAL_NOTIF] Configuring local notifications with popup support...');
    
    PushNotification.configure({
      onRegister: function(token: any) {
        console.log('[LOCAL_NOTIF] TOKEN:', token);
      },

      onNotification: function(notification: any) {
        console.log('[LOCAL_NOTIF] NOTIFICATION RECEIVED:', notification);
        
        // Handle initial notification when app is opened
        if (notification.userInteraction) {
          console.log('[LOCAL_NOTIF] User opened app from notification');
          // Handle navigation or show popup
        } else {
          console.log('[LOCAL_NOTIF] Notification received while app active');
        }
        
        // Show popup for notifications when app opens
        if (notification.message || notification.body) {
          const title = notification.title || 'New Notification';
          const message = notification.message || notification.body || 'You have a new message';
          
          const notificationManager = NotificationManager.getInstance();
          notificationManager.showNotification(
            title,
            message,
            'info',
            () => console.log('[LOCAL_NOTIF] Notification popup dismissed'),
            4000
          );
        }
        
        notification.finish && notification.finish();
      },

      onAction: function(notification: any) {
        console.log('[LOCAL_NOTIF] ACTION:', notification.action);
      },

      // Enable popup for initial notifications when app opens
      popInitialNotification: true,
      requestPermissions: false, // Don't request permissions, let Firebase handle it
    });

    this.isConfigured = true;
    console.log('[LOCAL_NOTIF] ✅ Configuration completed with popup support');
  }

  // Simplified badge management only
  setBadgeCount(count: number) {
    if (Platform.OS === 'ios') {
      PushNotification.setApplicationIconBadgeNumber(count);
    }
  }

  clearBadge() {
    this.setBadgeCount(0);
  }

  // Show notification popup manually
  showNotificationPopup(title: string, message: string) {
    console.log('[LOCAL_NOTIF] Showing manual notification popup:', { title, message });
    
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      title,
      message,
      'info',
      () => console.log('[LOCAL_NOTIF] Manual popup dismissed'),
      4000
    );
  }

  // Show local push notification
  showNotification(title: string, body: string, data: NotificationData = {}, options: any = {}) {
    console.log('[LOCAL_NOTIF] Creating local notification:', { title, body, data });
    
    // Determine channel based on notification type
    let channelId = 'default';
    if (data.type === 'support') {
      channelId = 'support';
    } else if (data.type === 'order') {
      channelId = 'orders';
    }
    
    PushNotification.localNotification({
      title,
      message: body,
      userInfo: data, // Use userInfo instead of data
      playSound: options.playSound !== false,
      soundName: 'default',
      vibrate: options.vibrate !== false,
      vibration: 300,
      importance: 'high',
      priority: options.priority || 'high',
      largeIcon: options.largeIcon || 'ic_launcher',
      smallIcon: options.smallIcon || 'ic_notification',
      channelId: channelId,
    });
  }

  // Check for initial notification when app starts
  checkInitialNotification() {
    console.log('[LOCAL_NOTIF] Checking for initial notification...');
    PushNotification.popInitialNotification((notification) => {
      if (notification) {
        console.log('[LOCAL_NOTIF] Found initial notification:', notification);
        const title = (notification as any).title || 'New Message';
        const message = (notification as any).message || (notification as any).body || 'You have a new notification';
        
        const notificationManager = NotificationManager.getInstance();
        notificationManager.showNotification(
          title,
          message,
          'info',
          () => console.log('[LOCAL_NOTIF] Initial notification popup dismissed'),
          4000
        );
      } else {
        console.log('[LOCAL_NOTIF] No initial notification found');
      }
    });
  }
}

export default new LocalNotificationService();
