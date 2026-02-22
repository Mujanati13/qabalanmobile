import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  I18nManager,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService, { Order, PaginatedResponse } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import guestOrderService, { GuestOrder } from '../services/guestOrderService';
import paymentService, { PaymentSession } from '../services/paymentService';
import MastercardPaymentModal from '../components/payments/MastercardPaymentModal';
import { formatCurrency, formatNumber } from '../utils/currency';

interface OrdersScreenProps {
  navigation: any;
  route: any;
}

const OrdersScreen: React.FC<OrdersScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { user, isGuest } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const autoPayHandledRef = useRef<string | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Prevent loadOrders from firing while the payment WebView is active
  const isPaymentInProgressRef = useRef(false);

  const statusFilters = [
    { key: '', label: t('orders.allOrders') },
    { key: 'pending', label: t('orders.statusLabels.pending') },
    { key: 'confirmed', label: t('orders.statusLabels.confirmed') },
    { key: 'preparing', label: t('orders.statusLabels.preparing') },
    { key: 'ready', label: t('orders.statusLabels.ready') },
    { key: 'out_for_delivery', label: t('orders.statusLabels.out_for_delivery') },
    { key: 'delivered', label: t('orders.statusLabels.delivered') },
    { key: 'cancelled', label: t('orders.statusLabels.cancelled') },
  ];

  // 🔄 Auto-refresh orders every 30 seconds when screen is focused
  // useFocusEffect handles both initial/focus load and status filter changes
  useFocusEffect(
    useCallback(() => {
      if (!isPaymentInProgressRef.current) {
        console.log('🔄 OrdersScreen focused - refreshing orders');
        loadOrders(true);
      }
      
      // Start polling for order status updates every 30 seconds
      // Use silent=true so polling doesn't flash the full-screen spinner
      pollingIntervalRef.current = setInterval(() => {
        if (isPaymentInProgressRef.current) {
          console.log('⏸️ Skipping poll - payment in progress');
          return;
        }
        console.log('🔄 Auto-refreshing orders (polling)');
        loadOrders(true, true);
      }, 30000); // 30 seconds
      
      // Cleanup polling when screen loses focus
      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }, [selectedStatus])
  );

  // 🔄 Refresh orders when route params change (e.g., after navigating back from order details)
  useEffect(() => {
    if (route?.params?.refresh) {
      console.log('🔄 Refresh param detected - reloading orders');
      loadOrders(true);
      
      // Clear the refresh param
      if (route.params) {
        const nextParams = { ...route.params };
        delete nextParams.refresh;
        navigation.setParams(nextParams);
      }
    }
  }, [route?.params?.refresh]);

  useEffect(() => {
    const autoPayOrderIdParam = route?.params?.autoPayOrderId;
    if (!autoPayOrderIdParam) {
      autoPayHandledRef.current = null;
      return;
    }

    const normalizedOrderId = String(autoPayOrderIdParam).trim();
    if (!normalizedOrderId) {
      return;
    }

    if (autoPayHandledRef.current === normalizedOrderId) {
      return;
    }

    autoPayHandledRef.current = normalizedOrderId;

    const sessionParam = route?.params?.autoPaySession as PaymentSession | null | undefined;

    const clearAutoPayParams = () => {
      if (route?.params) {
        const nextParams = { ...route.params };
        delete nextParams.autoPayOrderId;
        delete nextParams.autoPaySession;
        navigation.setParams(nextParams);
      }
    };

    const openPaymentModal = (session: PaymentSession) => {
      isPaymentInProgressRef.current = true;
      setPaymentSession(session);
      setShowPaymentModal(true);
    };

    const initiateAutoPayment = async () => {
      try {
        if (sessionParam?.sessionId) {
          openPaymentModal(sessionParam);
          return;
        }

        const paymentResult = await paymentService.processCardPayment(normalizedOrderId);
        if (paymentResult.success && paymentResult.session) {
          openPaymentModal(paymentResult.session);
          return;
        }

        throw new Error(paymentResult.error || 'Payment session unavailable');
      } catch (error) {
        console.error('❌ Auto payment initialization failed:', error);
        Alert.alert(
          t('common.error'),
          t('orders.paymentRetryFailed'),
          [{ text: t('common.ok') }]
        );
      } finally {
        clearAutoPayParams();
      }
    };

    initiateAutoPayment();
  }, [route?.params?.autoPayOrderId, route?.params?.autoPaySession, route?.params, navigation, t]);

  const loadOrders = async (reset: boolean = false, silent: boolean = false) => {
    // Handle guest users differently
    if (isGuest) {
      console.log('👤 Loading orders for guest user');
      try {
        if (reset) {
          if (!silent) setLoading(true);
          setCurrentPage(1);
          
          // 🔄 GUEST ORDER SYNC: Sync orders from server when refreshing
          await syncGuestOrdersFromServer();
        } else {
          setLoadingMore(true);
        }

        const page = reset ? 1 : currentPage;
        const result = await guestOrderService.getGuestOrdersPaginated({
          page,
          limit: 20,
          status: selectedStatus || undefined,
        });

        console.log('📦 Guest orders loaded:', result.orders.length);

        if (reset) {
          setOrders(result.orders as Order[]);
        } else {
          setOrders(prev => [...prev, ...(result.orders as Order[])]);
        }

        setHasMorePages(result.pagination.hasMore);
        setCurrentPage(page + 1);

      } catch (error) {
        console.error('Error loading guest orders:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
      return;
    }

    // Handle authenticated users
    if (!user || !user.id) {
      console.warn('❌ No user found for loading orders');
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }

    // Validate user ID is a positive integer
    const userId = parseInt(user.id.toString());
    if (!userId || userId <= 0 || !Number.isInteger(userId)) {
      console.error('❌ Invalid user ID:', user.id, 'Parsed:', userId);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }

    try {
      if (reset) {
        if (!silent) setLoading(true);
        setCurrentPage(1);
      } else {
        setLoadingMore(true);
      }

      const page = reset ? 1 : currentPage;
      console.log('🔄 Loading orders for user:', userId, 'page:', page, 'status:', selectedStatus);
      
      const response = await ApiService.getUserOrders(userId, {
        page,
        limit: 20,
        status: selectedStatus || undefined,
      });

      console.log('📦 Orders API response:', response);

      if (response.success && response.data) {
        // Handle both possible response structures
        const newOrders = Array.isArray(response.data) 
          ? response.data 
          : Array.isArray(response.data.data) 
            ? response.data.data 
            : [];
        
        console.log('✅ Loaded orders:', newOrders.length);
        
        // Validate orders data structure
        const validOrders = newOrders.filter(order => {
          if (!order || typeof order !== 'object') {
            console.warn('⚠️  Invalid order object:', order);
            return false;
          }
          return true;
        });
        
        console.log('✅ Valid orders after filtering:', validOrders.length);
        
        if (reset) {
          setOrders(validOrders);
        } else {
          setOrders(prev => [...prev, ...validOrders]);
        }

        // Handle pagination - could be in response.data.pagination or response.pagination
        const pagination = response.data.pagination || (response as any).pagination;
        if (pagination && typeof pagination.page === 'number' && typeof pagination.totalPages === 'number') {
          setHasMorePages(pagination.page < pagination.totalPages);
          setCurrentPage(page + 1);
        } else {
          setHasMorePages(false);
        }
      } else {
        console.warn('❌ Invalid orders response:', response);
        if (reset) {
          setOrders([]);
        }
        
        // Enhanced error logging for debugging
        if (response?.message) {
          console.error('📦 Orders API error:', response.message);
          console.error('📦 Full response:', JSON.stringify(response, null, 2));
          console.error('📦 Request details - User ID:', user.id, 'Page:', page, 'Status:', selectedStatus);
          
          // Show detailed error for validation issues
          if (response.message.includes('Validation failed') && response.errors) {
            console.error('📦 Validation errors:', response.errors);
            response.errors.forEach((err, index) => {
              console.error(`📦 Validation error ${index + 1}:`, err);
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      // Alert.alert(t('common.error'), t('orders.errorLoading'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // 🔄 GUEST ORDER SYNC: Sync guest orders from server
  const syncGuestOrdersFromServer = async () => {
    if (!isGuest) return;
    
    try {
      console.log('🔄 Starting guest order sync from server...');
      
      // Get guest orders with their phone numbers
      const localOrders = await guestOrderService.getGuestOrders();
      
      if (localOrders.length === 0) {
        console.log('📭 No local guest orders to sync');
        return;
      }
      
      // Get the phone number from the first order (all guest orders should have same phone)
      const guestPhone = localOrders[0]?.customerPhone;
      
      if (!guestPhone) {
        console.log('❌ No phone number found in guest orders');
        return;
      }
      
      console.log(`🔄 Syncing ${localOrders.length} guest orders for phone: ${guestPhone}`);
      
      // Sync all orders
      const syncResult = await guestOrderService.syncAllGuestOrders(guestPhone);
      
      if (syncResult.synced > 0) {
        console.log(`✅ Successfully synced ${syncResult.synced} guest orders`);
      }
      
      if (syncResult.failed > 0) {
        console.log(`⚠️ Failed to sync ${syncResult.failed} guest orders`);
      }
      
    } catch (error) {
      console.error('❌ Error syncing guest orders:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders(true, true); // silent=true: RefreshControl already shows its own spinner
  }, [selectedStatus]);

  const loadMoreOrders = () => {
    if (!loadingMore && hasMorePages) {
      loadOrders(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#f39c12';
      case 'confirmed':
        return '#3498db';
      case 'preparing':
        return '#9b59b6';
      case 'ready':
        return '#2ecc71';
      case 'out_for_delivery':
        return '#e67e22';
      case 'delivered':
        return '#27ae60';
      case 'cancelled':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'confirmed':
        return 'checkmark-circle-outline';
      case 'preparing':
        return 'restaurant-outline';
      case 'ready':
        return 'checkmark-done-outline';
      case 'out_for_delivery':
        return 'bicycle-outline';
      case 'delivered':
        return 'gift-outline';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Error formatting date:', error);
      return '';
    }
  };

  const formatAmount = (amount: unknown): string => {
    return formatCurrency(amount, { isRTL });
  };

  const retryPayment = async (orderId: number) => {
    try {
      console.log('🔄 Retrying payment for order:', orderId);
      
      Alert.alert(
        t('orders.retryPayment'),
        t('orders.retryPaymentMessage'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('orders.retryPayment'),
            onPress: async () => {
              try {
                // Import payment service dynamically
                const paymentResult = await paymentService.processCardPayment(orderId.toString());

                if (paymentResult.success && paymentResult.session) {
                  setPaymentSession(paymentResult.session);
                  setShowPaymentModal(true);
                  return;
                }

                throw new Error(paymentResult.error || 'Payment failed');
              } catch (error) {
                console.error('❌ Payment retry failed:', error);
                Alert.alert(
                  t('common.error'),
                  t('orders.paymentRetryFailed'),
                  [{ text: t('common.ok') }]
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error in retryPayment:', error);
    }
  };

  const handlePaymentSuccess = useCallback(
    async (orderId: string) => {
      isPaymentInProgressRef.current = false;
      setShowPaymentModal(false);
      setPaymentSession(null);
      
      console.log('✅ Payment completed successfully for order:', orderId);
      
      // Wait a bit for backend to process the payment callback
      console.log('⏳ Waiting for backend to process payment...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify payment status with backend
      try {
        console.log('🔍 Verifying payment status with backend...');
        const response = await ApiService.verifyPaymentStatus(orderId);
        
        if (response.success && response.data?.paymentStatus === 'paid') {
          console.log('✅ Payment verified as PAID by backend');
        } else {
          console.warn('⚠️  Payment verification returned:', response.data?.paymentStatus);
        }
      } catch (error) {
        console.error('❌ Error verifying payment:', error);
      }
      
      // Force reload orders to get updated payment status
      console.log('🔄 Reloading orders to fetch updated payment status...');
      await loadOrders(true);
      
      // Show success message
      Alert.alert(
        t('orders.paymentSuccess'),
        t('orders.paymentSuccessMessage'),
        [
          {
            text: t('common.ok'),
          },
        ]
      );
    },
    [loadOrders, t]
  );

  const handlePaymentCancel = useCallback((orderId: string) => {
    isPaymentInProgressRef.current = false;
    setShowPaymentModal(false);
    setPaymentSession(null);
    if (orderId) {
      Alert.alert(t('orders.retryPayment'), t('orders.paymentRetryFailed'));
    }
  }, [t]);

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    // Validate order data
    if (!order || typeof order !== 'object') {
      return null;
    }

  const statusColor = getStatusColor(order.order_status);
  const statusIcon = getStatusIcon(order.order_status);
  const isPaymentPaid = ['paid', 'completed'].includes(order.payment_status);
    const branchName = currentLanguage === 'ar' ? (order.branch_title_ar || '') : (order.branch_title_en || '');

    // Always use TouchableOpacity to allow navigation for both guest and authenticated users
    return (
      <TouchableOpacity
        style={[styles.orderCard, isRTL && styles.rtlOrderCard]}
        onPress={() => {
          navigation.navigate('OrderDetails', { orderId: order.id });
        }}
      >
        {/* Order Header */}
        <View style={[styles.orderHeader, isRTL && styles.rtlOrderHeader]}>
          <View style={[styles.orderInfo, isRTL && styles.rtlOrderInfo]}>
            <Text style={[styles.orderNumber, isRTL && styles.rtlText]}>
              {order.order_number || ''}
            </Text>
            <Text style={[styles.orderDate, isRTL && styles.rtlText]}>
              {formatDate(order.created_at)}
            </Text>
          </View>
        </View>

        <View style={[styles.orderDetails, isRTL && styles.rtlOrderDetails]}>
          <View style={[styles.orderMeta, isRTL && styles.rtlOrderMeta]}>
            <View style={[styles.statusOnlyContainer]}>
              <View style={[styles.statusInlineContainer, isRTL && styles.rtlStatusInlineContainer, { backgroundColor: statusColor + '20' }]}>
                <Icon name={statusIcon} size={14} color={statusColor} />
                <Text style={[styles.statusInlineText, { color: statusColor }, isRTL && styles.rtlStatusInlineText]}>
                  {t(`orders.statusLabels.${order.order_status || 'pending'}`)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.orderMeta, isRTL && styles.rtlOrderMeta]}>
            <View style={[styles.metaRow, isRTL && styles.rtlMetaRow]}>
              <Text style={[styles.orderMetaLabel, isRTL && styles.rtlOrderMetaLabel]}>
                {t('orders.orderType')}:
              </Text>
              <Text style={[styles.orderMetaValue, isRTL && styles.rtlMetaValue]}>
                {t(`orders.types.${order.order_type || 'delivery'}`)}
              </Text>
            </View>
          </View>

          <View style={[styles.orderMeta, isRTL && styles.rtlOrderMeta]}>
            <View style={[styles.metaRow, isRTL && styles.rtlMetaRow]}>
              <Text style={[styles.orderMetaLabel, isRTL && styles.rtlOrderMetaLabel]}>
                {t('orders.paymentStatus')}:
              </Text>
              <Text style={[styles.orderMetaValue, isRTL && styles.rtlMetaValue, {
                color: order.payment_status === 'paid' ? '#27ae60' : 
                       order.payment_status === 'failed' ? '#e74c3c' : 
                       order.payment_status === 'refunded' ? '#f39c12' : '#95a5a6'
              }]}>
                {t(`orders.paymentStatusLabels.${order.payment_status || 'pending'}`)}
              </Text>
            </View>
          </View>

          {branchName && branchName.trim() && (
            <View style={[styles.orderMeta, isRTL && styles.rtlOrderMeta]}>
              <View style={[styles.metaRow, isRTL && styles.rtlMetaRow]}>
                <Text style={[styles.orderMetaLabel, isRTL && styles.rtlOrderMetaLabel]}>
                  {t('orders.branch')}:
                </Text>
                <Text style={[styles.orderMetaValue, isRTL && styles.rtlMetaValue]}>
                  {branchName}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.orderMeta, isRTL && styles.rtlOrderMeta]}>
            <View style={[styles.metaRow, isRTL && styles.rtlMetaRow]}>
              <Text style={[styles.orderMetaLabel, isRTL && styles.rtlOrderMetaLabel]}>
                {t('orders.items')}:
              </Text>
              <Text style={[styles.orderMetaValue, isRTL && styles.rtlMetaValue]}>
                {order.items_count || order.order_items?.length || 0} {t('common.items')}
              </Text>
            </View>
          </View>
        </View>

        {/* Product Items Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <View style={[styles.orderItemsPreview, isRTL && styles.rtlOrderItemsPreview]}>
            {order.order_items.slice(0, 3).map((item, index) => {
              const productName = currentLanguage === 'ar' ? item.product_title_ar : item.product_title_en;
              
              // Parse variant data with categories - handle multiple formats
              let variantName = null;
              
              // First, check for variant_data field (JSON string)
              if ((item as any).variant_data) {
                try {
                  const variantData = typeof (item as any).variant_data === 'string' 
                    ? JSON.parse((item as any).variant_data) 
                    : (item as any).variant_data;
                  
                  // Try to build category: value pairs if available
                  if (variantData.variant_categories && variantData.variant_names && 
                      Array.isArray(variantData.variant_categories) && Array.isArray(variantData.variant_names)) {
                    const pairs = variantData.variant_categories.map((category: string, index: number) => 
                      `${category}: ${variantData.variant_names[index] || ''}`
                    ).filter(Boolean);
                    variantName = pairs.length > 0 ? pairs.join(', ') : null;
                  }
                  
                  // Fallback to just names if no categories
                  if (!variantName && variantData.variant_names && Array.isArray(variantData.variant_names)) {
                    variantName = variantData.variant_names.join(', ');
                  }
                } catch (e) {
                  console.error('Error parsing variant_data:', e);
                }
              }
              
              // Fallback to other fields if no variant_data
              if (!variantName) {
                variantName = isRTL 
                  ? (item.variant_title_ar || item.variant_title_en || item.variant_value)
                  : (item.variant_title_en || item.variant_title_ar || item.variant_value);
              }
              
              return (
                <View key={item.id || index} style={[styles.previewItem, isRTL && styles.rtlPreviewItem]}>
                  <View style={styles.previewItemDot} />
                  <Text 
                    style={[styles.previewItemText, isRTL && styles.rtlText]} 
                    numberOfLines={1}
                  >
                    {formatNumber(item.quantity, { decimals: 0 })}x {productName}
                    {variantName ? ` (${variantName})` : ''}
                  </Text>
                </View>
              );
            })}
            {order.order_items.length > 3 && (
              <Text style={[styles.moreItemsText, isRTL && styles.rtlText]}>
                +{formatNumber(order.order_items.length - 3, { decimals: 0 })} {t('orders.moreItems')}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.orderFooter, isRTL && styles.rtlOrderFooter]}>
          <Text style={[styles.totalAmount, isRTL && styles.rtlTotalAmount]}>
            {formatAmount(order.total_amount)}
          </Text>
          
          {/* Show retry payment button for card payments that are not paid */}
          {order.payment_method === 'card' && 
           !isPaymentPaid && 
           !isGuest && (
            <TouchableOpacity 
              style={[styles.retryPaymentButton, isRTL && styles.rtlRetryPaymentButton]}
              onPress={() => retryPayment(order.id)}
            >
              <Icon name="card-outline" size={16} color="#fff" />
              <Text style={styles.retryPaymentText}>
                {t('orders.retryPayment')}
              </Text>
            </TouchableOpacity>
          )}
          
          {!isGuest && !(order.payment_method === 'card' && !isPaymentPaid) && (
            <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color="#666" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusFilter = () => {
    // For RTL (Arabic), show a select box instead of horizontal scrolling
    if (isRTL) {
      const selectedFilter = statusFilters.find(f => f.key === selectedStatus) || statusFilters[0];
      
      return (
        <View style={[styles.statusFilterContainer, styles.rtlContainer]}>
          <TouchableOpacity
            style={styles.statusSelectorBox}
            onPress={() => setShowStatusPicker(true)}
          >
            <View style={[styles.statusSelectorContent, isRTL && styles.rtlRowReverse]}>
              <Text style={[styles.statusSelectorLabel, isRTL && styles.rtlStatusSelectorLabel]}>
                {t('orders.filterByStatus')}:
              </Text>
              <View style={[styles.statusSelectorValueContainer, isRTL && styles.rtlStatusSelectorValueContainer]}>
                <Text style={[styles.statusSelectorValue, isRTL && styles.rtlStatusSelectorValue]}>
                  {selectedFilter.label}
                </Text>
                <Icon name="chevron-down" size={20} color="#007AFF" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Status Picker Modal */}
          <Modal
            visible={showStatusPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowStatusPicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowStatusPicker(false)}
            >
              <View style={[styles.modalContent, isRTL && styles.rtlModalContent]}>
                <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
                  <Text style={[styles.modalTitle, isRTL && styles.rtlModalTitle]}>
                    {t('orders.filterByStatus')}
                  </Text>
                  <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                    <Icon name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {statusFilters.map((filter, index) => {
                    const isSelected = selectedStatus === filter.key;
                    
                    return (
                      <TouchableOpacity
                        key={`filter-${filter.key || index}`}
                        style={[
                          styles.modalFilterItem,
                          isRTL && styles.rtlModalFilterItem,
                          isSelected && styles.modalFilterItemSelected
                        ]}
                        onPress={() => {
                          setSelectedStatus(filter.key);
                          setShowStatusPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.modalFilterText,
                          isRTL && styles.rtlModalFilterText,
                          isSelected && styles.modalFilterTextSelected
                        ]}>
                          {filter.label}
                        </Text>
                        {isSelected && (
                          <Icon name="checkmark-circle" size={24} color="#007AFF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      );
    }

    // For LTR (English), show the normal horizontal scrolling list
    return (
      <View style={[styles.statusFilterContainer, isRTL && styles.rtlContainer]}>
        <View style={[styles.filterRow, isRTL && styles.rtlFilterRow]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={statusFilters}
            keyExtractor={(item, index) => `status-filter-${item.key || index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.statusFilterButton,
                  selectedStatus === item.key && styles.activeStatusFilter,
                  isRTL && styles.rtlStatusFilterButton
                ]}
                onPress={() => setSelectedStatus(item.key)}
              >
                <Text style={[
                  styles.statusFilterText,
                  selectedStatus === item.key && styles.activeStatusFilterText,
                  isRTL && styles.rtlFilterText
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={[styles.statusFilterList, isRTL && styles.rtlStatusFilterList]}
            style={[styles.statusFilterFlatList, isRTL && styles.rtlStatusFilterFlatList]}
          />
          
          {/* 🔄 GUEST SYNC BUTTON: Show sync button for guest users */}
          {isGuest && (
            <TouchableOpacity
              style={[styles.syncButton, refreshing && styles.syncButtonDisabled, isRTL && styles.rtlSyncButton]}
              onPress={() => !refreshing && onRefresh()}
              disabled={refreshing}
            >
              <Icon
                name={refreshing ? "reload" : "refresh"}
                size={16}
                color={refreshing ? "#ccc" : "#007AFF"}
                style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
              />
              <Text style={[
                styles.syncButtonText,
                refreshing && styles.syncButtonTextDisabled,
                isRTL && styles.rtlSyncButtonText
              ]}>
                {refreshing ? t('orders.syncing') : t('orders.syncStatus')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderLoadingFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => {
    const getEmptyMessage = () => {
      if (isGuest) {
        return selectedStatus 
          ? t('orders.noGuestOrdersWithStatus')
          : t('orders.noGuestOrders');
      }
      return selectedStatus ? t('orders.noOrdersWithStatus') : t('orders.noOrders');
    };

    const getSubtitle = () => {
      if (isGuest) {
        return t('orders.guestOrdersNote');
      }
      return t('orders.startShopping');
    };

    return (
      <View style={styles.emptyContainer}>
        <Icon name="receipt-outline" size={80} color="#ccc" />
        <Text style={[styles.emptyTitle, isRTL && styles.rtlEmptyText]}>
          {getEmptyMessage()}
        </Text>
        <Text style={[styles.emptySubtitle, isRTL && styles.rtlEmptyText]}>
          {getSubtitle()}
        </Text>
        <TouchableOpacity 
          style={[styles.startShoppingButton, isRTL && styles.rtlStartShoppingButton]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={[styles.startShoppingButtonText, isRTL && styles.rtlEmptyText]}>
            {t('orders.shopNow')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      {renderStatusFilter()}
      
      <FlatList
        data={orders || []}
        renderItem={renderOrderCard}
        keyExtractor={(item, index) => {
          // Ensure unique key using order ID, order number, or fallback to index
          if (item?.id) return `order-${item.id}`;
          if (item?.order_number) return `order-num-${item.order_number}`;
          return `order-index-${index}`;
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderLoadingFooter}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={[
          orders.length === 0 ? styles.emptyContentContainer : styles.contentContainer
        ]}
        showsVerticalScrollIndicator={false}
      />

      <MastercardPaymentModal
        visible={showPaymentModal}
        session={paymentSession}
        onClose={() => {
          isPaymentInProgressRef.current = false;
          setShowPaymentModal(false);
          setPaymentSession(null);
        }}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
        locale={isRTL ? 'ar' : 'en'}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    flexDirection: 'column',
    textAlign: 'right',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  emptyContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 15,
  },
  
  // Status Filter Styles
  statusFilterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusFilterList: {
    paddingHorizontal: 15,
  },
  rtlStatusFilterList: {
    flexDirection: 'row-reverse',
  },
  statusFilterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginEnd: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  rtlStatusFilterButton: {
    marginEnd: 0,
    marginStart: 10,
  },
  activeStatusFilter: {
    backgroundColor: Colors.primary,
  },
  statusFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeStatusFilterText: {
    color: '#fff',
  },
  rtlText: {
    textAlign: 'right',
    width: '100%',
    alignSelf: 'flex-end',
    textAlignVertical: 'center',
  },
  rtlMetaValue: {
    textAlign: 'right',
    width: '100%',
    alignSelf: 'flex-end',
  },
  rtlFilterText: {
    textAlign: 'center',
  },
  rtlTotalAmount: {
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  rtlEmptyText: {
    textAlign: 'right',
    width: '100%',
  },
  
  // Order Card Styles
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rtlOrderCard: {
    alignItems: 'flex-end',
    width: '100%',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
  },
  rtlOrderHeader: {
    flexDirection: 'row-reverse',
  },
  orderInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rtlOrderInfo: {
    alignItems: 'flex-end',
    width: '100%',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
    width: '100%',
    textAlign: 'left',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    width: '100%',
    textAlign: 'left',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 80, // Ensure minimum width for status badge
  },
  rtlStatusContainer: {
    flexDirection: 'row-reverse',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginStart: 4,
    textAlign: 'left',
  },
  rtlStatusText: {
    marginStart: 0,
    marginEnd: 4,
    textAlign: 'right',
  },
  // Inline Status Styles (in attributes list)
  statusInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    maxWidth: '100%',
  },
  rtlStatusInlineContainer: {
    flexDirection: 'row-reverse',
  },
  statusInlineText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
    marginStart: 4,
  },
  rtlStatusInlineText: {
    textAlign: 'right',
    marginStart: 0,
    marginEnd: 4,
  },
  orderDetails: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  rtlOrderDetails: {
    alignItems: 'flex-end',
    width: '100%',
  },
  orderMeta: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-start',
  },
  rtlOrderMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  rtlMetaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  rtlStatusMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  statusOnlyContainer: {
    marginBottom: 4,
    width: '100%',
  },
  orderItemsPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    width: '100%',
  },
  rtlOrderItemsPreview: {
    alignItems: 'flex-end',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rtlPreviewItem: {
    flexDirection: 'row-reverse',
  },
  previewItemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    marginEnd: 8,
  },
  previewItemText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  orderMetaLabel: {
    fontSize: 14,
    color: '#666',
    marginEnd: 8,
    flexShrink: 0,
    textAlign: 'left',
  },
  rtlOrderMetaLabel: {
    marginEnd: 0,
    marginStart: 8,
    textAlign: 'right',
  },
  orderMetaValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  rtlOrderFooter: {
    flexDirection: 'row-reverse',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'left',
  },
  retryPaymentButton: {
    backgroundColor: '#ff6b35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  rtlRetryPaymentButton: {
    flexDirection: 'row-reverse',
  },
  retryPaymentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Loading Footer
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  startShoppingButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rtlStartShoppingButton: {
    flexDirection: 'row-reverse',
  },
  startShoppingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Guest Sync Button Styles
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rtlFilterRow: {
    flexDirection: 'row-reverse',
  },
  statusFilterFlatList: {
    flex: 1,
  },
  rtlStatusFilterFlatList: {
    flexDirection: 'row-reverse',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginStart: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  rtlSyncButton: {
    flexDirection: 'row-reverse',
    marginStart: 0,
    marginEnd: 10,
  },
  syncButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ccc',
  },
  syncButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginStart: 4,
  },
  rtlSyncButtonText: {
    marginStart: 0,
    marginEnd: 4,
  },
  syncButtonTextDisabled: {
    color: '#ccc',
  },
  rtlAlignEnd: {
    alignItems: 'flex-end',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },

  // Status Selector Styles (for RTL mode)
  statusSelectorBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    padding: 15,
    marginHorizontal: 20,
  },
  statusSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusSelectorLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'left',
  },
  rtlStatusSelectorLabel: {
    textAlign: 'right',
  },
  statusSelectorValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rtlStatusSelectorValueContainer: {
    flexDirection: 'row-reverse',
  },
  statusSelectorValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'left',
  },
  rtlStatusSelectorValue: {
    textAlign: 'right',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  rtlModalContent: {
    alignItems: 'stretch',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rtlModalHeader: {
    flexDirection: 'row-reverse',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
  },
  rtlModalTitle: {
    textAlign: 'right',
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  modalFilterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    width: '100%',
  },
  rtlModalFilterItem: {
    flexDirection: 'row-reverse',
  },
  modalFilterItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  modalFilterText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'left',
    flex: 1,
  },
  rtlModalFilterText: {
    textAlign: 'right',
  },
  modalFilterTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default OrdersScreen;
