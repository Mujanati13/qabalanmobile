import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import WebView, {
  WebViewNavigation,
  WebViewNavigationEvent,
} from 'react-native-webview';
import Icon from 'react-native-vector-icons/Ionicons';

import { PaymentSession } from '../../services/paymentService';

type Locale = 'en' | 'ar';

interface MastercardPaymentModalProps {
  visible: boolean;
  session: PaymentSession | null;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  locale?: Locale;
  loadingLabel?: string;
  cancelLabel?: string;
}

const SUCCESS_PATH = '/api/payments/mpgs/payment/success';
const CANCEL_PATH = '/api/payments/mpgs/payment/cancel';

const localeTextMap: Record<Locale, { title: string; loading: string; close: string }> = {
  en: {
    title: 'Secure Card Payment',
    loading: 'Loading secure checkout…',
    close: 'Cancel payment',
  },
  ar: {
    title: 'دفع آمن بالبطاقة',
    loading: 'جاري تحميل صفحة الدفع الآمنة…',
    close: 'إلغاء الدفع',
  },
};

const extractQueryParam = (url: string, key: string): string | null => {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }

  const queryString = url.substring(queryIndex + 1);
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [rawParam, rawValue = ''] = pair.split('=');
    if (decodeURIComponent(rawParam) === key) {
      return decodeURIComponent(rawValue);
    }
  }

  return null;
};

const getOrderIdFromUrl = (url: string, fallback?: string | number | null): string => {
  const orderIdParam =
    extractQueryParam(url, 'orders_id') ||
    extractQueryParam(url, 'orderId') ||
    extractQueryParam(url, 'order_id');

  if (orderIdParam) {
    return orderIdParam;
  }

  if (fallback != null) {
    return String(fallback);
  }

  return '';
};

const isFecsDeepLink = (url: string) => url.startsWith('fecs://');

const MastercardPaymentModal: React.FC<MastercardPaymentModalProps> = ({
  visible,
  session,
  onClose,
  onSuccess,
  onCancel,
  locale = 'en',
  loadingLabel,
  cancelLabel,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  const strings = useMemo(() => localeTextMap[locale] || localeTextMap.en, [locale]);
  const loadingText = loadingLabel || strings.loading;
  const closeText = cancelLabel || strings.close;

  useEffect(() => {
    if (!visible) {
      setIsLoading(true);
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    if (session) {
      onCancel(String(session.orderId));
    }
    onClose();
  }, [onCancel, onClose, session]);

  const handleExternalScheme = useCallback(
    (url: string) => {
      const orderId = getOrderIdFromUrl(url, session?.orderId);
      if (url.startsWith('fecs://payment-success')) {
        onSuccess(orderId);
      } else {
        onCancel(orderId);
      }
      onClose();
    },
    [session?.orderId, onSuccess, onCancel, onClose]
  );

  const interceptNavigation = useCallback(
    (url: string) => {
      if (!url || !session) {
        return false;
      }

      if (isFecsDeepLink(url)) {
        handleExternalScheme(url);
        return true;
      }

      if (url.includes(SUCCESS_PATH)) {
        const orderId = getOrderIdFromUrl(url, session.orderId);
        onSuccess(orderId);
        onClose();
        return true;
      }

      if (url.includes(CANCEL_PATH)) {
        const orderId = getOrderIdFromUrl(url, session.orderId);
        onCancel(orderId);
        onClose();
        return true;
      }

      return false;
    },
    [session, handleExternalScheme, onSuccess, onClose, onCancel]
  );

  const handleShouldStartLoad = useCallback(
    (event: WebViewNavigation) => {
      if (interceptNavigation(event.url)) {
        return false;
      }
      return true;
    },
    [interceptNavigation]
  );

  const handleNavigationStateChange = useCallback(
    (event: WebViewNavigationEvent) => {
      interceptNavigation(event.url);
    },
    [interceptNavigation]
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'overFullScreen'}
      visible={visible}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#1f2937" />
            <Text style={styles.closeText}>{closeText}</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Icon name="lock-closed" size={20} color="#1677ff" />
            <Text style={styles.title}>{strings.title}</Text>
          </View>

          <View style={styles.headerFiller} />
        </View>

        {!session ? (
          <View style={styles.emptyState}>
            <Icon name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.emptyStateTitle}>Unable to start payment</Text>
            <Text style={styles.emptyStateText}>
              {`We couldn't load the secure checkout session. Please go back and try again.`}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
              <Text style={styles.retryText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webviewWrapper}>
            <WebView
              ref={webViewRef}
              source={{ uri: session.paymentUrl }}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#1677ff" />
                  <Text style={styles.loadingText}>{loadingText}</Text>
                </View>
              )}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              onNavigationStateChange={handleNavigationStateChange}
              javaScriptEnabled
              domStorageEnabled
            />

            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#1677ff" />
                <Text style={styles.loadingText}>{loadingText}</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    marginLeft: 6,
  },
  headerFiller: {
    width: 60,
  },
  webviewWrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    color: '#334155',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#4b5563',
    lineHeight: 20,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MastercardPaymentModal;
