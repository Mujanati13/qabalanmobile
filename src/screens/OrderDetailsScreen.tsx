import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  I18nManager,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService, { Order, OrderItem, OrderStatusHistory } from '../services/apiService';
import guestOrderService from '../services/guestOrderService';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatCurrency, formatNumber } from '../utils/currency';

interface OrderDetailsScreenProps {
  navigation: any;
  route: {
    params: {
      orderId: number;
    };
  };
}

const OrderDetailsScreen: React.FC<any> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { user } = useAuth();
  const { orderId } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  useEffect(() => {
    loadOrderDetails();
    
    // Trigger refresh on the orders list when this screen unmounts
    return () => {
      console.log('🔄 OrderDetailsScreen unmounting - triggering orders list refresh');
      // Navigate back with refresh param to trigger reload
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.setParams({ refresh: true });
      }
    };
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      
      try {
        // Try to fetch from API first
        const orderResponse = await ApiService.getOrderDetails(orderId);

        if (orderResponse.success && orderResponse.data) {
          const detailedOrder = {
            ...orderResponse.data.order,
            order_items: orderResponse.data.order_items
              || orderResponse.data.items
              || orderResponse.data.order?.order_items
              || [],
          } as Order;

          setOrder(detailedOrder);
          
          // Set status history from the order details response
          if (orderResponse.data.status_history) {
            setStatusHistory(orderResponse.data.status_history);
          } else {
            setStatusHistory([]);
          }
          return; // Success, exit early
        }
      } catch (apiError: any) {
        console.log('API error fetching order details:', apiError);
        
        // If not authenticated (401/403), try to load from local guest orders
        if (!user && (apiError?.response?.status === 401 || apiError?.response?.status === 403)) {
          console.log('🔍 Attempting to load guest order from local storage...');
          
          try {
            const guestOrders = await guestOrderService.getGuestOrders();
            const localOrder = guestOrders.find(o => o.id === orderId);
            
            if (localOrder) {
              console.log('✅ Found guest order in local storage:', localOrder.order_number);
              setOrder(localOrder);
              setStatusHistory([]); // Guest orders from local storage don't have status history
              return; // Success, exit early
            } else {
              console.log('❌ Guest order not found in local storage');
            }
          } catch (storageError) {
            console.error('Error loading from local storage:', storageError);
          }
        }
        
        // Re-throw if we couldn't handle it
        throw apiError;
      }
      
      // If we got here without setting an order, show error
      if (!order) {
        Alert.alert(t('common.error'), t('orders.orderNotFound'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading order details:', error);
      Alert.alert(t('common.error'), t('orders.errorLoadingDetails'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const confirmReceipt = async () => {
    if (!order) return;

    Alert.alert(
      t('orders.confirmReceipt'),
      t('orders.confirmReceiptMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              setConfirmingReceipt(true);
              const response = await ApiService.confirmOrderReceipt(order.id);
              
              if (response.success) {
                Alert.alert(t('common.success'), t('orders.receiptConfirmed'));
                loadOrderDetails(); // Refresh order details
              } else {
                Alert.alert(t('common.error'), response.message);
              }
            } catch (error) {
              console.error('Error confirming receipt:', error);
              Alert.alert(t('common.error'), t('orders.errorConfirmingReceipt'));
            } finally {
              setConfirmingReceipt(false);
            }
          },
        },
      ]
    );
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
      case 'receipt_confirmed':
        return '#1abc9c';
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
      case 'receipt_confirmed':
        return 'thumbs-up-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const formatAmount = (amount: unknown): string => {
    return formatCurrency(amount, { isRTL });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderOrderItem = (item: OrderItem) => {
    // Product name with fallback
    const productName = (currentLanguage === 'ar' ? item.product_title_ar : item.product_title_en) || 
                        (currentLanguage === 'ar' ? item.product_title_en : item.product_title_ar) ||
                        t('orders.unknownProduct');
    
    // Parse variant data with categories - handle multiple formats
    let variantName = null;
    
    // First, check for VARIANT_DATA field (JSON string)
    if ((item as any).variant_data) {
      try {
        const variantData = typeof (item as any).variant_data === 'string' 
          ? JSON.parse((item as any).variant_data) 
          : (item as any).variant_data;
        
        console.log('📦 Parsed variant_data:', variantData);
        
        // Try to build category: value pairs if available
        if (variantData.variant_categories && variantData.variant_names && 
            Array.isArray(variantData.variant_categories) && Array.isArray(variantData.variant_names)) {
          
          // Ensure arrays have same length
          const minLength = Math.min(variantData.variant_categories.length, variantData.variant_names.length);
          
          // Format: "Size: Small, Color: Red"
          const pairs = [];
          for (let i = 0; i < minLength; i++) {
            const category = variantData.variant_categories[i];
            const name = variantData.variant_names[i];
            
            // Skip invalid entries
            if (category && name && typeof category === 'string' && typeof name === 'string') {
              pairs.push(`${category}: ${name}`);
            }
          }
          
          variantName = pairs.length > 0 ? pairs.join(', ') : null;
          console.log('📦 Built variant pairs:', variantName);
        }
        
        // Fallback to just names if no categories
        if (!variantName && variantData.variant_names && Array.isArray(variantData.variant_names)) {
          variantName = variantData.variant_names.filter((v: any) => v && typeof v === 'string').join(', ');
        } else if (!variantName && variantData.variant_ids && Array.isArray(variantData.variant_ids)) {
          // If we only have IDs, show them as fallback
          variantName = `${t('orders.variants')}: ${variantData.variant_ids.join(', ')}`;
        }
      } catch (e) {
        console.error('Error parsing variant_data:', e, 'Raw data:', (item as any).variant_data);
      }
    }
    
    // If no variant_data, check for title fields
    if (!variantName && (item.variant_title_ar || item.variant_title_en)) {
      variantName = currentLanguage === 'ar'
        ? (item.variant_title_ar || item.variant_title_en)
        : (item.variant_title_en || item.variant_title_ar);
    } else if (!variantName && (item as any).variant_name && (item as any).variant_value) {
      variantName = `${(item as any).variant_name}: ${(item as any).variant_value}`;
    } else if (!variantName && (item as any).variant_value) {
      variantName = (item as any).variant_value;
    } else if (!variantName && (item as any).variant_name) {
      variantName = (item as any).variant_name;
    }
    
    // Filter out special instructions that contain variant data markers
    const hasValidSpecialInstructions = item.special_instructions && 
      !item.special_instructions.includes('_VARIANT_DATA_') &&
      !item.special_instructions.includes('variant_ids') &&
      item.special_instructions.trim().length > 0;

    return (
      <View key={item.id} style={[styles.orderItem, isRTL && styles.rtlOrderItem]}>
        {item.product_image && (
          <Image 
            source={{ uri: item.product_image }} 
            style={[styles.productImage, isRTL && styles.rtlProductImage]}
            resizeMode="cover"
          />
        )}
        
        <View style={[styles.itemDetails, isRTL && styles.rtlAlignEnd]}>
          <Text style={[styles.productName, isRTL && styles.rtlText]}>
            {productName}
          </Text>
          
          <Text style={[styles.variantName, isRTL && styles.rtlText, !variantName && styles.noVariant]}>
            {variantName || t('orders.noVariant')}
          </Text>
          
          {hasValidSpecialInstructions && (
            <Text style={[styles.specialInstructions, isRTL && styles.rtlText]}>
              {t('orders.specialInstructions')}: {item.special_instructions}
            </Text>
          )}
          
          <View style={[styles.itemPricing, isRTL && styles.rtlItemPricing]}>
            <Text style={[styles.quantity, isRTL && styles.rtlText]}>
              {t('orders.quantity')}: {formatNumber(item.quantity, { decimals: 0 })}
            </Text>
            <Text style={[styles.unitPrice, isRTL && styles.rtlText]}>
              {formatAmount(item.unit_price)} {t('orders.each')}
            </Text>
          </View>
        </View>
        
        <View style={[styles.itemTotal, isRTL && styles.rtlItemTotal]}>
          <Text style={[styles.itemTotalPrice, isRTL && styles.rtlText]}>
            {formatAmount(item.total_price)}
          </Text>
        </View>
      </View>
    );
  };

  const renderStatusHistory = () => {
    // Helper to detect and render URLs in status notes
    const renderStatusNoteWithLinks = (note: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = note.split(urlRegex);
      
      return parts.map((part, index) => {
        if (urlRegex.test(part)) {
          // This is a URL
          return (
            <TouchableOpacity 
              key={index}
              onPress={() => {
                Linking.openURL(part).catch(err =>
                  Alert.alert(t('common.error'), t('orders.cannotOpenLink'))
                );
              }}
            >
              <Text style={[styles.statusNoteLink, isRTL && styles.rtlText]}>
                {part}
              </Text>
            </TouchableOpacity>
          );
        } else {
          // Regular text
          return (
            <Text key={index} style={[styles.statusNote, isRTL && styles.rtlText]}>
              {part}
            </Text>
          );
        }
      });
    };

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t('orders.statusHistory')}
        </Text>
        
        {statusHistory.map((status, index) => {
          const statusColor = getStatusColor(status.status);
          const statusIcon = getStatusIcon(status.status);
          const isLast = index === statusHistory.length - 1;
          
          return (
            <View key={status.id} style={[styles.statusItem, isRTL && styles.rtlStatusItem]}>
              <View style={[styles.statusIndicator, isRTL && styles.rtlStatusIndicator]}>
                <View style={[styles.statusIcon, { backgroundColor: statusColor }]}>
                  <Icon name={statusIcon} size={16} color="#fff" />
                </View>
                {!isLast && <View style={styles.statusLine} />}
              </View>
              
              <View style={[styles.statusContent, isRTL && styles.rtlStatusContent]}>
                <Text style={[styles.statusTitle, isRTL && styles.rtlText]}>
                  {t(`orders.statusLabels.${status.status}`)}
                </Text>
                
                <Text style={[styles.statusDate, isRTL && styles.rtlText]}>
                  {formatDate(status.created_at)}
                </Text>
                
                {status.note && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {renderStatusNoteWithLinks(status.note)}
                  </View>
                )}
                
                {status.first_name && status.last_name && (
                  <Text style={[styles.statusBy, isRTL && styles.rtlText]}>
                    {t('orders.updatedBy')}: {status.first_name} {status.last_name}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('orders.orderNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = getStatusColor(order.order_status);
  const statusIcon = getStatusIcon(order.order_status);
  const branchName = currentLanguage === 'ar' ? order.branch_title_ar : order.branch_title_en;
  const canConfirmReceipt = order.order_status === 'delivered' && 
    !statusHistory.some(h => h.status === 'receipt_confirmed');

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Order Header */}
        <View style={styles.section}>
          {/* Status Badge - Top Left/Right Corner */}
          <View style={[styles.statusBadgeTopCorner, isRTL && styles.rtlStatusBadgeTopCorner]}>
            <View style={[styles.statusContainer, isRTL && styles.rtlRowReverse, { backgroundColor: statusColor + '20' }]}>
              <Icon name={statusIcon} size={20} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }, isRTL && styles.rtlText, isRTL && styles.rtlStatusText]}>
                {t(`orders.statusLabels.${order.order_status}`)}
              </Text>
            </View>
          </View>

          <View style={[styles.orderHeader, isRTL && styles.rtlOrderHeader]}>
            <View style={styles.orderInfo}>
              <Text style={[styles.orderNumber, isRTL && styles.rtlText]}>
                {order.order_number}
              </Text>
              <Text style={[styles.orderDate, isRTL && styles.rtlText]}>
                {formatDate(order.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('orders.orderDetails')}
          </Text>
          
          <View style={styles.detailsGrid}>
            <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
              <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                {t('orders.orderType')}:
              </Text>
              <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                {t(`orders.types.${order.order_type}`)}
              </Text>
            </View>
            
            <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
              <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                {t('orders.paymentMethod')}:
              </Text>
              <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                {t(`orders.paymentMethods.${order.payment_method}`)}
              </Text>
            </View>
            
            <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
              <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                {t('orders.paymentStatus')}:
              </Text>
              <Text style={[styles.detailValue, isRTL && styles.rtlText, {
                color: order.payment_status === 'paid' ? '#27ae60' : 
                       order.payment_status === 'failed' ? '#e74c3c' : 
                       order.payment_status === 'refunded' ? '#f39c12' : '#95a5a6'
              }]}>
                {t(`orders.paymentStatusLabels.${order.payment_status}`)}
              </Text>
            </View>
            
            {branchName && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                  {t('orders.branch')}:
                </Text>
                <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                  {branchName}
                </Text>
              </View>
            )}
            
            {order.estimated_delivery_time && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                  {t('orders.estimatedDelivery')}:
                </Text>
                <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                  {formatDate(order.estimated_delivery_time)}
                </Text>
              </View>
            )}
            
            {order.delivered_at && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                  {t('orders.deliveredAt')}:
                </Text>
                <Text style={[styles.detailValue, isRTL && styles.rtlText]}>
                  {formatDate(order.delivered_at)}
                </Text>
              </View>
            )}
            
            {order.promo_code && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                  {t('orders.promoCode')}:
                </Text>
                <Text style={[styles.detailValue, styles.promoCode, isRTL && styles.rtlText]}>
                  {order.promo_code}
                </Text>
              </View>
            )}
          </View>
          
          {order.special_instructions && (
            <View style={styles.specialInstructionsContainer}>
              <Text style={[styles.detailLabel, isRTL && styles.rtlText]}>
                {t('orders.specialInstructions')}:
              </Text>
              <Text style={[styles.specialInstructionsText, isRTL && styles.rtlText]}>
                {order.special_instructions}
              </Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        {order.order_items && order.order_items.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('orders.orderItems')}
            </Text>
            
            {order.order_items.map(renderOrderItem)}
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t('orders.orderSummary')}
          </Text>
          
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
              <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                {t('orders.subtotal')}:
              </Text>
              <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                {formatAmount(order.subtotal)}
              </Text>
            </View>
            
            {(Number(order.delivery_fee) || 0) > 0 && (
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('orders.deliveryFee')}:
                </Text>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {formatAmount(order.delivery_fee)}
                </Text>
              </View>
            )}
            
            {(Number(order.tax_amount) || 0) > 0 && (
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('orders.tax')}:
                </Text>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {formatAmount(order.tax_amount)}
                </Text>
              </View>
            )}
            
            {(Number(order.discount_amount) || 0) > 0 && (
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, styles.discountLabel, isRTL && styles.rtlText]}>
                  {t('orders.discount')}:
                </Text>
                <Text style={[styles.summaryValue, styles.discountValue, isRTL && styles.rtlText]}>
                  {formatAmount(-(Number(order.discount_amount) || 0))}
                </Text>
              </View>
            )}
            
            {/* 🔄 SOLUTION: Show points used if any */}
            {(Number(order.points_used) || 0) > 0 && (
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, isRTL && styles.rtlText]}>
                  {t('orders.pointsUsed')}:
                </Text>
                <Text style={[styles.summaryValue, isRTL && styles.rtlText]}>
                  {Number(order.points_used) || 0} {t('common.points')}
                </Text>
              </View>
            )}
            
            {/* 🔄 SOLUTION: Show points earned if any */}
            {(Number(order.points_earned) || 0) > 0 && (
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, styles.pointsEarnedLabel, isRTL && styles.rtlText]}>
                  {t('orders.pointsEarned')}:
                </Text>
                <Text style={[styles.summaryValue, styles.pointsEarnedValue, isRTL && styles.rtlText]}>
                  +{Number(order.points_earned) || 0} {t('common.points')}
                </Text>
              </View>
            )}
            
            <View style={[styles.summaryRow, styles.totalRow, isRTL && styles.rtlSummaryRow]}>
              <Text style={[styles.totalLabel, isRTL && styles.rtlText]}>
                {t('orders.total')}:
              </Text>
              <Text style={[styles.totalValue, isRTL && styles.rtlText]}>
                {formatAmount(order.total_amount)}
              </Text>
            </View>
          </View>
        </View>

        {/* Status History */}
        {renderStatusHistory()}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomContainer, isRTL && styles.rtlContainer]}>
        {/* Support Ticket Button */}
        <TouchableOpacity
          style={[styles.supportButton, isRTL && styles.rtlRowReverse]}
          onPress={() => navigation.navigate('CreateTicket', { orderId: order?.id })}
        >
          <Icon name="headset" size={20} color="#666" />
          <Text style={[styles.supportButtonText, isRTL && styles.rtlText, isRTL && styles.rtlSupportButtonText]}>
            {t('orders.needHelp')}
          </Text>
        </TouchableOpacity>

        {/* Confirm Receipt Button */}
        {canConfirmReceipt && (
          <TouchableOpacity
            style={[styles.confirmReceiptButton, isRTL && styles.rtlRowReverse, confirmingReceipt && styles.disabledButton]}
            onPress={confirmReceipt}
            disabled={confirmingReceipt}
          >
            {confirmingReceipt ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="checkmark-circle" size={20} color="#fff" />
                <Text style={[styles.confirmReceiptText, isRTL && styles.rtlText, isRTL && styles.rtlConfirmReceiptText]}>
                  {t('orders.confirmReceipt')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    // RTL handled by I18nManager
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Section Styles
  section: {
    backgroundColor: '#fff',
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSectionTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  rtlAlignEnd: {
    alignItems: 'flex-end',
  },
  
  // Status Badge Top Corner
  statusBadgeTopCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    maxWidth: '80%', // Prevent badge from being too wide
  },
  rtlStatusBadgeTopCorner: {
    left: 'auto',
    right: 0,
  },
  
  // Order Header Styles
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 40, // Add space for the status badge
  },
  rtlOrderHeader: {
    flexDirection: 'row-reverse',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlOrderNumber: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlOrderDate: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100, // Ensure minimum width for status badge
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginStart: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStatusText: {
    marginStart: 0,
    marginEnd: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Details Styles
  detailsGrid: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlDetailLabel: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlDetailValue: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  promoCode: {
    color: '#28a745',
    fontWeight: 'bold',
  },
  specialInstructionsContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  specialInstructionsText: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Order Items Styles
  orderItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rtlOrderItem: {
    flexDirection: 'row-reverse',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginEnd: 15,
  },
  rtlProductImage: {
    marginEnd: 0,
    marginStart: 15,
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlProductName: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  variantName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  noVariant: {
    color: '#999',
    fontStyle: 'italic',
  },
  rtlVariantName: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  specialInstructions: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSpecialInstructions: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  itemPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rtlItemPricing: {
    flexDirection: 'row-reverse',
  },
  quantity: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  unitPrice: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  itemTotal: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rtlItemTotal: {
    alignItems: 'flex-start',
  },
  itemTotalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Summary Styles
  summaryContainer: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rtlSummaryRow: {
    flexDirection: 'row-reverse',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSummaryLabel: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSummaryValue: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  discountLabel: {
    color: '#28a745',
  },
  discountValue: {
    color: '#28a745',
  },
  pointsEarnedLabel: {
    color: '#FFD700',
  },
  pointsEarnedValue: {
    color: '#FFD700',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Status History Styles
  statusItem: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%', // Ensure full width
  },
  rtlStatusItem: {
    flexDirection: 'row-reverse',
    alignSelf: 'stretch', // Stretch to parent width
  },
  statusIndicator: {
    alignItems: 'center',
    marginEnd: 15,
  },
  rtlStatusIndicator: {
    marginEnd: 0,
    marginStart: 15,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
  },
  statusContent: {
    flex: 1,
    minWidth: 0, // Fix for RTL text overflow
  },
  rtlStatusContent: {
    alignItems: 'flex-end',
    width: '100%', // Ensure full width in RTL
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    flexWrap: 'wrap', // Allow text to wrap
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStatusTitle: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  statusDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    flexWrap: 'wrap',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStatusDate: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  statusNote: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 4,
    flexWrap: 'wrap',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  statusNoteLink: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
    marginBottom: 4,
    flexWrap: 'wrap',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStatusNote: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  statusBy: {
    fontSize: 12,
    color: '#999',
    flexWrap: 'wrap',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlStatusBy: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  
  // Bottom Action Styles
  bottomContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  supportButton: {
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  supportButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginStart: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlSupportButtonText: {
    marginStart: 0,
    marginEnd: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  confirmReceiptButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  confirmReceiptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginStart: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlConfirmReceiptText: {
    marginStart: 0,
    marginEnd: 8,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});

export default OrderDetailsScreen;
