import { Platform, Vibration } from 'react-native';

interface HapticOptions {
  type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
  duration?: number;
}

class HapticFeedback {
  static trigger(options: HapticOptions = {}) {
    const { type = 'light' } = options;
    
    if (Platform.OS === 'ios') {
      // On iOS, we can use specific haptic patterns
      // Note: In a real app, you'd use react-native-haptic-feedback
      this.triggerIOS(type);
    } else {
      // On Android, use vibration patterns
      this.triggerAndroid(type);
    }
  }

  private static triggerIOS(type: string) {
    // Simplified iOS haptic feedback
    switch (type) {
      case 'light':
        Vibration.vibrate(10);
        break;
      case 'medium':
        Vibration.vibrate(25);
        break;
      case 'heavy':
        Vibration.vibrate(50);
        break;
      case 'success':
        Vibration.vibrate([0, 50, 100, 50]);
        break;
      case 'warning':
        Vibration.vibrate([0, 100, 50, 100]);
        break;
      case 'error':
        Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        break;
      default:
        Vibration.vibrate(10);
    }
  }

  private static triggerAndroid(type: string) {
    switch (type) {
      case 'light':
        Vibration.vibrate(30);
        break;
      case 'medium':
        Vibration.vibrate(50);
        break;
      case 'heavy':
        Vibration.vibrate(100);
        break;
      case 'success':
        Vibration.vibrate([0, 50, 100, 50]);
        break;
      case 'warning':
        Vibration.vibrate([0, 100, 50, 100]);
        break;
      case 'error':
        Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        break;
      default:
        Vibration.vibrate(30);
    }
  }

  static success() {
    this.trigger({ type: 'success' });
  }

  static error() {
    this.trigger({ type: 'error' });
  }

  static warning() {
    this.trigger({ type: 'warning' });
  }

  static light() {
    this.trigger({ type: 'light' });
  }

  static medium() {
    this.trigger({ type: 'medium' });
  }

  static heavy() {
    this.trigger({ type: 'heavy' });
  }
}

export default HapticFeedback;
