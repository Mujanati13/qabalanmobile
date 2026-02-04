import { FirebaseApp, initializeApp } from '@react-native-firebase/app';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:android:abcd1234"
};

class FirebaseService {
  private app: FirebaseApp | null = null;
  private messaging: FirebaseMessagingTypes.Module | null = null;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase = async () => {
    try {
      // Initialize Firebase
      this.app = initializeApp(firebaseConfig);
      this.messaging = messaging();
      
      console.log('Firebase initialized successfully');
      
      // Setup messaging
      await this.setupMessaging();
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  };

  private setupMessaging = async () => {
    try {
      // Request permission for notifications
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        
        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        
        // Store token locally
        await AsyncStorage.setItem('fcm_token', token);
        
        // Listen for token refresh
        messaging().onTokenRefresh(token => {
          console.log('FCM Token refreshed:', token);
          AsyncStorage.setItem('fcm_token', token);
        });
      }
    } catch (error) {
      console.error('Messaging setup error:', error);
    }
  };

  // Get FCM token
  public getToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('fcm_token');
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  };

  // Subscribe to topic
  public subscribeToTopic = async (topic: string) => {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  };

  // Unsubscribe from topic
  public unsubscribeFromTopic = async (topic: string) => {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  };
}

export default new FirebaseService();
