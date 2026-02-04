import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Easing,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LanguageChangeOverlayProps {
  visible: boolean;
  targetLanguage?: string;
  showRestartPrompt?: boolean;
  onRestartConfirm?: () => void;
  onRestartCancel?: () => void;
  loadingText?: string;
  restartTitle?: string;
  restartMessage?: string;
  restartNowText?: string;
  restartLaterText?: string;
}

/**
 * LanguageChangeOverlay - Shows a loading animation during language change
 * and a restart prompt when needed for RTL changes
 */
const LanguageChangeOverlay: React.FC<LanguageChangeOverlayProps> = ({
  visible,
  targetLanguage,
  showRestartPrompt = false,
  onRestartConfirm,
  onRestartCancel,
  loadingText = 'Changing Language...',
  restartTitle = 'Restart Required',
  restartMessage = 'The app needs to restart to apply the language change. Would you like to restart now?',
  restartNowText = 'Restart Now',
  restartLaterText = 'Later',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showLoading, setShowLoading] = useState(true);

  // Entry animation
  useEffect(() => {
    if (visible) {
      setShowLoading(!showRestartPrompt);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Start rotation animation for loading indicator
      if (!showRestartPrompt) {
        startRotationAnimation();
        startPulseAnimation();
      }
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, showRestartPrompt]);

  // When restart prompt appears, transition from loading to prompt
  useEffect(() => {
    if (showRestartPrompt && visible) {
      // Small delay for smooth transition
      setTimeout(() => {
        setShowLoading(false);
      }, 200);
    }
  }, [showRestartPrompt, visible]);

  const startRotationAnimation = () => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getLanguageIcon = (lang?: string): string => {
    switch (lang) {
      case 'ar':
        return '🌍';
      case 'en':
        return '🌎';
      default:
        return '🌐';
    }
  };

  const getLanguageLabel = (lang?: string): string => {
    switch (lang) {
      case 'ar':
        return 'العربية';
      case 'en':
        return 'English';
      default:
        return '';
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={showRestartPrompt ? onRestartCancel : undefined}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {showLoading ? (
            // Loading State
            <View style={styles.loadingContent}>
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [
                      { scale: pulseAnim },
                    ],
                  },
                ]}
              >
                <Text style={styles.languageIcon}>
                  {getLanguageIcon(targetLanguage)}
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.spinnerContainer,
                  {
                    transform: [{ rotate: spin }],
                  },
                ]}
              >
                <View style={styles.spinnerDot} />
              </Animated.View>

              <Text style={styles.loadingText}>{loadingText}</Text>
              
              {targetLanguage && (
                <Text style={styles.languageLabel}>
                  {getLanguageLabel(targetLanguage)}
                </Text>
              )}

              <ActivityIndicator
                size="small"
                color="#BE1E2D"
                style={styles.activityIndicator}
              />
            </View>
          ) : (
            // Restart Prompt State
            <View style={styles.restartContent}>
              <View style={styles.restartIconContainer}>
                <Text style={styles.restartIcon}>🔄</Text>
              </View>

              <Text style={styles.restartTitle}>{restartTitle}</Text>
              
              <Text style={styles.restartMessage}>{restartMessage}</Text>

              {targetLanguage && (
                <View style={styles.languagePreview}>
                  <Text style={styles.languagePreviewIcon}>
                    {getLanguageIcon(targetLanguage)}
                  </Text>
                  <Text style={styles.languagePreviewText}>
                    {getLanguageLabel(targetLanguage)}
                  </Text>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={onRestartCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.laterButtonText}>{restartLaterText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.restartButton}
                  onPress={onRestartConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.restartButtonText}>{restartNowText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  contentContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 280,
    maxWidth: SCREEN_WIDTH - 60,
  },
  loadingContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  languageIcon: {
    fontSize: 40,
  },
  spinnerContainer: {
    position: 'absolute',
    top: 0,
    width: 80,
    height: 80,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BE1E2D',
    marginTop: -4,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  languageLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  activityIndicator: {
    marginTop: 20,
  },
  restartContent: {
    alignItems: 'center',
    width: '100%',
  },
  restartIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  restartIcon: {
    fontSize: 40,
  },
  restartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  restartMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  languagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 25,
  },
  languagePreviewIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  languagePreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  laterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  restartButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#BE1E2D',
    alignItems: 'center',
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LanguageChangeOverlay;
