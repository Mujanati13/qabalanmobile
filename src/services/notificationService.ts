import messaging, { getMessaging } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import apiService from './apiService';
import localNotificationService from './localNotificationService';
import NotificationManager from './NotificationManager';

interface NotificationData {
  type?: string;
  orderId?: string;
  promoId?: string;
  categoryId?: string;
  productId?: string;
  action?: string;
  [key: string]: any;
}

interface FCMNotification {
  title?: string;
  body?: string;
  android?: {
    channelId?: string;
    largeIcon?: string;
    smallIcon?: string;
  };
  data?: NotificationData;
}

class NotificationService {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private isInitialized: boolean = false; // Add initialization guard
  private unreadCountCallback: ((count: number) => void) | null = null;
  private currentUserId: string | null = null;

  /**
   * Set current user ID for user-specific storage
   */
  setCurrentUserId(userId: string | null) {
    const oldUserId = this.currentUserId;
    this.currentUserId = userId;
    console.log('[NOTIF] Current user ID changed from', oldUserId, 'to', userId);
    
    // If user changed, clear any previous user's cached count
    if (oldUserId !== userId) {
      this.clearBadgeCount().catch(console.error);
    }
  }

  /**
   * Get user-specific storage key for unread count
   */
  private getUnreadCountKey(): string {
    return this.currentUserId ? `unread_notification_count_${this.currentUserId}` : 'unread_notification_count';
  }

  /**
   * Clean up old cached notification counts (for app maintenance)
   */
  async cleanupOldNotificationData() {
    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Find notification count keys
      const notificationKeys = allKeys.filter(key => 
        key.startsWith('unread_notification_count') && 
        key !== this.getUnreadCountKey()
      );
      
      if (notificationKeys.length > 0) {
        console.log('[NOTIF] Cleaning up old notification data:', notificationKeys);
        await AsyncStorage.multiRemove(notificationKeys);
      }
    } catch (error) {
      console.error('[NOTIF] Error cleaning up old notification data:', error);
    }
  }

  /**
   * Set callback for unread count changes
   */
  setUnreadCountCallback(callback: (count: number) => void) {
    this.unreadCountCallback = callback;
  }

  /**
   * Remove unread count callback
   */
  removeUnreadCountCallback() {
    this.unreadCountCallback = null;
  }

  /**
   * Initialize the notification service
   */
  async initialize(navigationRef?: NavigationContainerRef<any>) {
    // Prevent multiple initializations
    if (this.isInitialized) {
      console.log('[NOTIF][DEBUG] ⚠️ Notification service already initialized, skipping...');
      return;
    }

    console.log('[NOTIF][DEBUG] 🚀 Initializing notification service...');
    
    if (navigationRef) {
      this.navigationRef = navigationRef;
      console.log('[NOTIF][DEBUG] ✅ Navigation ref set');
    }

    try {
      // Initialize React Native Push Notification service
      console.log('[NOTIF][DEBUG] 📱 Configuring React Native Push Notification...');
      localNotificationService.configure();

      // Request permission for notifications
      console.log('[NOTIF][DEBUG] 🔐 Requesting notification permission...');
      await this.requestPermission();

      // Get FCM token
      console.log('[NOTIF][DEBUG] 🎫 Getting FCM token...');
      await this.getFCMToken();

      // Set up notification listeners
      console.log('[NOTIF][DEBUG] 👂 Setting up notification listeners...');
      this.setupNotificationListeners();

      // Check for initial notification when app opens
      console.log('[NOTIF][DEBUG] 🔍 Checking for initial notifications...');
      setTimeout(() => {
        localNotificationService.checkInitialNotification();
      }, 2000); // Give some time for everything to initialize

      this.isInitialized = true; // Mark as initialized
      console.log('[NOTIF][DEBUG] ✅ Notification service initialized successfully');
    } catch (error) {
      console.error('[NOTIF][DEBUG] ❌ Failed to initialize notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<boolean> {
    console.log('[NOTIF][DEBUG] 🔍 Requesting notification permission...');
    try {
      const app = getApp();
      const messagingInstance = getMessaging(app);
      const authStatus = await messagingInstance.requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('[NOTIF][DEBUG] 📋 Permission status:', authStatus, 'enabled:', enabled);
      if (enabled) {
        console.log('[NOTIF][DEBUG] ✅ Notification permission granted');
        return true;
      } else {
        console.log('[NOTIF][DEBUG] ❌ Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('[NOTIF][DEBUG] ❌ Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token and register it with the backend
   */
  async getFCMToken(): Promise<string | null> {
    console.log('[NOTIF][DEBUG] 🔍 Getting FCM token...');
    try {
      const app = getApp();
      const messagingInstance = getMessaging(app);
      const token = await messagingInstance.getToken();
      console.log('[NOTIF][DEBUG] ✅ FCM Token obtained:', token ? `${token.substring(0, 20)}...` : 'null');

      if (token) {
        // Store token locally
        console.log('[NOTIF][DEBUG] 💾 Storing token locally...');
        await AsyncStorage.setItem('fcm_token', token);
        console.log('[NOTIF][DEBUG] ✅ Token stored locally');

        // Register token with backend
        console.log('[NOTIF][DEBUG] 🌐 Attempting to register token with backend...');
        try {
          await this.registerTokenWithBackend(token);
        } catch (error) {
          console.error('[NOTIF][DEBUG] ❌ Failed to register FCM token with backend:', error);
        }
      } else {
        console.log('[NOTIF][DEBUG] ⚠️ No FCM token received');
      }

      return token;
    } catch (error) {
      console.error('[NOTIF][DEBUG] ❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    console.log('[NOTIF][DEBUG] 🔍 registerTokenWithBackend called with token:', `${token.substring(0, 20)}...`);
    
    try {
      // Check if user is logged in before registering token
      const userToken = await AsyncStorage.getItem('accessToken'); // Fixed: was 'access_token'
      console.log('[NOTIF][DEBUG] 🔐 Access token check:', userToken ? 'Found' : 'Not found');
      
      if (!userToken) {
        console.log('[NOTIF][DEBUG] ⚠️ User not logged in, storing as pending token');
        // Store token locally to register later when user logs in
        await AsyncStorage.setItem('pending_fcm_token', token);
        console.log('[NOTIF][DEBUG] ✅ Pending token stored');
        return;
      }

      console.log('[NOTIF][DEBUG] 🚀 User is logged in, registering token for platform:', Platform.OS);
      const response = await apiService.registerFCMToken(token, Platform.OS);
      console.log('[NOTIF][DEBUG] 📡 Backend response:', response);
      
      if (response.success) {
        console.log('[NOTIF][DEBUG] ✅ FCM token registered with backend successfully');
        // Clear any pending token since we successfully registered
        await AsyncStorage.removeItem('pending_fcm_token');
        console.log('[NOTIF][DEBUG] 🗑️ Pending token cleared');
      } else {
        console.log('[NOTIF][DEBUG] ❌ Backend registration failed:', response.message);
        throw new Error(response.message || 'Failed to register FCM token');
      }
    } catch (error) {
      console.error('[NOTIF][DEBUG] ❌ registerTokenWithBackend error:', error);
      
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Duplicate entry found')) {
        console.log('[NOTIF][DEBUG] ℹ️ Token already registered, this is expected behavior');
        // Clear pending token since registration is complete (even if duplicate)
        await AsyncStorage.removeItem('pending_fcm_token');
        return;
      }
      
      if (errorMessage.includes('Token already registered')) {
        console.log('[NOTIF][DEBUG] ℹ️ Token already registered for another user, clearing local token');
        await AsyncStorage.removeItem('pending_fcm_token');
        return;
      }
      
      // For network or other errors, don't clear pending token so we can retry
      console.log('[NOTIF][DEBUG] 🔄 Will retry token registration later');
      // Don't throw error to prevent breaking app initialization
    }
  }

  /**
   * Register pending FCM token after user login
   * Call this method after successful login
   */
  async registerPendingToken(): Promise<void> {
    try {
      const pendingToken = await AsyncStorage.getItem('pending_fcm_token');
      if (pendingToken) {
        console.log('📱 Registering pending FCM token after login');
        await this.registerTokenWithBackend(pendingToken);
      }
    } catch (error) {
      console.error('❌ Failed to register pending FCM token:', error);
    }
  }

  /**
   * Refresh and re-register FCM token with backend
   * Call this when app becomes active to ensure token is always up-to-date
   */
  async refreshToken(): Promise<void> {
    console.log('[NOTIF][DEBUG] 🔄 Refreshing FCM token...');
    try {
      const app = getApp();
      const messagingInstance = getMessaging(app);
      const token = await messagingInstance.getToken();
      
      if (token) {
        console.log('[NOTIF][DEBUG] ✅ FCM Token refreshed:', token ? `${token.substring(0, 20)}...` : 'null');
        
        // Update local storage
        await AsyncStorage.setItem('fcm_token', token);
        
        // Re-register with backend
        console.log('[NOTIF][DEBUG] 🌐 Re-registering token with backend...');
        await this.registerTokenWithBackend(token);
        console.log('[NOTIF][DEBUG] ✅ Token re-registered successfully');
      } else {
        console.log('[NOTIF][DEBUG] ⚠️ No FCM token received during refresh');
      }
    } catch (error) {
      console.error('[NOTIF][DEBUG] ❌ Error refreshing FCM token:', error);
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners(): void {
    console.log('[NOTIF] Setting up Firebase messaging listeners for push notifications');
    
    try {
      const app = getApp();
      const messagingInstance = getMessaging(app);
      
      // Handle notification opened from background/quit state
      messagingInstance.onNotificationOpenedApp((remoteMessage) => {
        console.log('[NOTIF] 📱 Notification opened from background:', JSON.stringify(remoteMessage, null, 2));
        this.handleNotificationNavigation(remoteMessage);
      });

      // Handle notification opened from quit state (when app was completely closed)
      messagingInstance.getInitialNotification().then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[NOTIF] 📱 Notification opened from quit state:', JSON.stringify(remoteMessage, null, 2));
          // Show a popup to indicate the notification was received
          setTimeout(() => {
            this.showNotificationPopup(
              remoteMessage.notification?.title || 'Notification',
              remoteMessage.notification?.body || 'You have a new message'
            );
          }, 1000);
          this.handleNotificationNavigation(remoteMessage);
        } else {
          console.log('[NOTIF] 📱 No initial notification found');
        }
      });

      // Handle foreground notifications (when app is open and active)
      const unsubscribe = messagingInstance.onMessage(async (remoteMessage) => {
        console.log('[NOTIF] 📩 Foreground notification received:', JSON.stringify(remoteMessage, null, 2));
        this.showForegroundNotification(remoteMessage);
      });

      // Handle token refresh
      messagingInstance.onTokenRefresh((token) => {
        console.log('[NOTIF] 🔄 FCM token refreshed:', token ? `${token.substring(0, 20)}...` : 'null');
        this.registerTokenWithBackend(token).catch(console.error);
      });

      console.log('[NOTIF] ✅ Firebase messaging listeners set up successfully');
    } catch (error) {
      console.error('[NOTIF] ❌ Error setting up Firebase messaging listeners:', error);
      console.log('[NOTIF] 📱 Falling back to React Native Push Notification only');
    }
  }

  /**
   * Show notification when app is in foreground
   */
  private showForegroundNotification(remoteMessage: any): void {
    console.log('[NOTIF] 📩 Processing foreground notification...');
    const { notification, data } = remoteMessage;
    
    // Extract notification content
    const title = notification?.title || data?.title || 'New Notification';
    const body = notification?.body || data?.body || 'You have a new message';
    
    console.log('[NOTIF] 📝 Notification content:', { title, body, type: data?.type });
    
    // Update badge count
    this.updateBadgeCount();
    
    // Show local notification popup for better visibility
    this.showLocalNotification(title, body, data);
    
    // Special handling for support notifications
    if (data?.type === 'support_reply') {
      console.log('[NOTIF] 🎫 Support reply notification received for ticket:', data?.ticket_id);
      // You could add special UI handling here, like showing a snackbar or banner
    }
  }

  /**
   * Show local notification for enhanced visibility
   */
  private showLocalNotification(title: string, body: string, data: any = {}) {
    console.log('[NOTIF] 🔔 Showing local notification:', { title, body });
    
    try {
      // Show popup notification
      const type = data?.type === 'support_reply' ? 'info' : 'info';
      this.showNotificationPopup(title, body, type);
      
      // Determine channel based on notification type
      let channelType = 'default';
      if (data.type === 'support') {
        channelType = 'support';
      } else if (data.type === 'order') {
        channelType = 'orders';
      }
      
      // Also try to show a native notification if possible
      localNotificationService.showNotification(title, body, { ...data, type: channelType }, {
        priority: 'high',
        vibrate: true,
        playSound: true,
        largeIcon: 'ic_launcher',
        smallIcon: 'ic_notification',
      });
    } catch (error) {
      console.log('[NOTIF] ❌ Local notification error:', error);
      // Fallback to simple popup
      this.showNotificationPopup(title, body, 'error');
    }
  }

  /**
   * Show notification popup (wrapper for popup manager)
   */
  private showNotificationPopup(title: string, body: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') {
    console.log('[NOTIF] 🔔 Showing notification popup:', { title, body, type });
    
    const notificationManager = NotificationManager.getInstance();
    notificationManager.showNotification(
      title,
      body,
      type,
      () => {
        console.log('[NOTIF] 📱 Notification popup tapped');
        // Handle tap if needed
      },
      4000 // 4 seconds duration
    );
  }

  /**
   * Update notification badge count
   */
  private async updateBadgeCount() {
    try {
      // Get current unread count from user-specific AsyncStorage or API
      let currentCount = await AsyncStorage.getItem(this.getUnreadCountKey());
      let count = currentCount ? parseInt(currentCount) : 0;
      count += 1;
      
      // Store updated count with user-specific key
      await AsyncStorage.setItem(this.getUnreadCountKey(), count.toString());
      
      // Update platform badge using local notification service
      localNotificationService.setBadgeCount(count);
      
      // Trigger callback to update context
      if (this.unreadCountCallback) {
        this.unreadCountCallback(count);
      }
      
      console.log('[NOTIF] Unread count updated to:', count, 'for user:', this.currentUserId);
    } catch (error) {
      console.error('[NOTIF] Error updating badge count:', error);
    }
  }

  /**
   * Get current unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(this.getUnreadCountKey());
      const result = count ? parseInt(count) : 0;
      console.log('[NOTIF] Getting unread count:', result, 'for user:', this.currentUserId);
      return result;
    } catch (error) {
      console.error('[NOTIF] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Set unread notification count
   */
  async setUnreadCount(count: number) {
    try {
      const validCount = Math.max(0, count);
      await AsyncStorage.setItem(this.getUnreadCountKey(), validCount.toString());
      
      // Update platform badge using local notification service
      localNotificationService.setBadgeCount(validCount);
      
      console.log('[NOTIF] Unread count set to:', validCount, 'for user:', this.currentUserId);
    } catch (error) {
      console.error('[NOTIF] Error setting unread count:', error);
    }
  }

  /**
   * Clear notification badge count
   */
  async clearBadgeCount() {
    try {
      await AsyncStorage.setItem(this.getUnreadCountKey(), '0');
      
      // Clear platform badge using local notification service
      localNotificationService.clearBadge();
      
      console.log('[NOTIF] Badge count cleared for user:', this.currentUserId);
    } catch (error) {
      console.error('[NOTIF] Error clearing badge count:', error);
    }
  }

  /**
   * Handle navigation when notification is tapped
   */
  private handleNotificationNavigation(remoteMessage: any): void {
    if (!this.navigationRef) {
      console.warn('[NOTIF] Navigation ref not set, cannot handle notification navigation');
      return;
    }

    const { data } = remoteMessage;
    
    if (!data || !data.type) {
      console.log('No navigation data in notification');
      return;
    }

    try {
      switch (data.type) {
        case 'order_update':
          if (data.orderId) {
            this.navigationRef.navigate('Orders', {
              screen: 'OrderDetails',
              params: { orderId: parseInt(data.orderId) },
            });
          } else {
            this.navigationRef.navigate('Orders');
          }
          break;

        case 'promotion':
          if (data.promoId) {
            // Navigate to promo details or products with promo
            this.navigationRef.navigate('Home');
          } else {
            this.navigationRef.navigate('Home');
          }
          break;

        case 'product':
          if (data.productId) {
            this.navigationRef.navigate('Home', {
              screen: 'ProductDetails',
              params: { productId: parseInt(data.productId) },
            });
          } else {
            this.navigationRef.navigate('Home');
          }
          break;

        case 'category':
          if (data.categoryId) {
            this.navigationRef.navigate('Categories', {
              screen: 'CategoryProducts',
              params: { categoryId: parseInt(data.categoryId) },
            });
          } else {
            this.navigationRef.navigate('Categories');
          }
          break;

        case 'loyalty_points':
          this.navigationRef.navigate('Profile', {
            screen: 'LoyaltyPoints',
          });
          break;

        case 'support_reply':
          if (data.ticket_id) {
            this.navigationRef.navigate('Account', {
              screen: 'SupportTickets',
              params: { 
                ticketId: parseInt(data.ticket_id),
                refresh: true 
              },
            });
          } else {
            this.navigationRef.navigate('Account', {
              screen: 'SupportTickets',
            });
          }
          break;

        default:
          // Default to home screen
          this.navigationRef.navigate('Home');
          break;
      }
    } catch (error) {
  console.error('[NOTIF] Error handling notification navigation:', error);
      // Fallback to home screen
      this.navigationRef.navigate('Home');
    }
  }

  /**
   * Get stored FCM token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('fcm_token');
    } catch (error) {
      console.error('Error getting stored FCM token:', error);
      return null;
    }
  }

  /**
   * Clear FCM token (useful on logout)
   */
  async clearToken(): Promise<void> {
    try {
      // Get current token first
      const currentToken = await AsyncStorage.getItem('fcm_token');
      
      // Remove token from backend first (if authenticated and token exists)
      if (apiService.isAuthenticated() && currentToken) {
        try {
          await apiService.clearFCMToken(currentToken);
        } catch (error) {
          console.error('Failed to remove FCM token from backend:', error);
          // Continue with local cleanup even if backend fails
        }
      }

      // Clear token from Firebase
      await messaging().deleteToken();
      
      // Clear local storage
      await AsyncStorage.removeItem('fcm_token');
      
      console.log('✅ FCM token cleared');
    } catch (error) {
      console.error('❌ Error clearing FCM token:', error);
    }
  }

  /**
   * Manually check for missed notifications when app becomes active
   */
  async checkForMissedNotifications(): Promise<void> {
    console.log('[NOTIF] 🔍 Checking for missed notifications...');
    
    try {
      // Check Firebase for initial notification
      const app = getApp();
      const messagingInstance = getMessaging(app);
      
      const remoteMessage = await messagingInstance.getInitialNotification();
      if (remoteMessage) {
        console.log('[NOTIF] 📩 Found missed notification:', JSON.stringify(remoteMessage, null, 2));
        
        // Show popup for missed notification
        this.showNotificationPopup(
          remoteMessage.notification?.title || 'Missed Notification',
          remoteMessage.notification?.body || 'You have a new message',
          'info'
        );
        
        // Handle navigation if needed
        this.handleNotificationNavigation(remoteMessage);
      } else {
        console.log('[NOTIF] 📭 No missed notifications found');
      }
      
      // Also check local notifications
      localNotificationService.checkInitialNotification();
    } catch (error) {
      console.error('[NOTIF] ❌ Error checking for missed notifications:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: {
    promo_notifications: boolean;
    order_notifications: boolean;
  }): Promise<void> {
    try {
      const response = await apiService.updateNotificationPreferences({
        promo_notifications: preferences.promo_notifications,
        order_notifications: preferences.order_notifications,
      });

      if (response.success) {
        console.log('✅ Notification preferences updated');
      } else {
        throw new Error(response.message || 'Failed to update notification preferences');
      }
    } catch (error) {
      console.error('❌ Failed to update notification preferences:', error);
      // For now, just log the error since the endpoint doesn't exist yet
      console.warn('Notification preferences endpoint not yet implemented on backend');
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const authStatus = await messaging().hasPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  /**
   * Subscribe to topic (for general notifications)
   */
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`✅ Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`❌ Failed to subscribe to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`✅ Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`❌ Failed to unsubscribe from topic ${topic}:`, error);
    }
  }
}

export default new NotificationService();
