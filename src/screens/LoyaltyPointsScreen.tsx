import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import apiService, { UserLoyaltyPoints, PointTransaction, PaginatedResponse } from '../services/apiService';
import { analyzeError, checkNetworkConnectivity } from '../utils/networkErrorHandler';

interface LoyaltyPointsScreenProps {
  navigation: any;
}

type FilterType = 'all' | 'earned' | 'redeemed' | 'expired' | 'bonus';

const LoyaltyPointsScreen: React.FC<LoyaltyPointsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  
  const [loyaltyPoints, setLoyaltyPoints] = useState<UserLoyaltyPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [networkError, setNetworkError] = useState(false);
  const [serverError, setServerError] = useState(false);

  const filters = [
    { key: 'all' as FilterType, label: t('common.all') },
    { key: 'earned' as FilterType, label: t('profile.pointsEarned'), icon: 'add-circle' },
    { key: 'redeemed' as FilterType, label: t('profile.pointsRedeemed'), icon: 'remove-circle' },
    { key: 'expired' as FilterType, label: t('profile.pointsExpired'), icon: 'time' },
    { key: 'bonus' as FilterType, label: t('profile.pointsBonus'), icon: 'gift' },
  ];

  // Helper function to show appropriate error message
  const showErrorMessage = (error: any, customMessage?: string) => {
    const errorInfo = analyzeError(error);
    let title = t('common.error');
    let message = customMessage || errorInfo.message;

    if (errorInfo.isNetworkError || errorInfo.isTimeoutError) {
      setNetworkError(true);
      title = t('common.connectionError');
      message = t('common.checkInternetConnection');
    } else if (errorInfo.isServerError) {
      setServerError(true);
      title = t('common.serverError');
      message = t('common.serverTemporarilyUnavailable');
    }

    Alert.alert(title, message, [
      {
        text: t('common.tryAgain'),
        onPress: async () => {
          setNetworkError(false);
          setServerError(false);
          
          // Check connectivity before retrying
          const isConnected = await checkNetworkConnectivity();
          if (!isConnected) {
            Alert.alert(
              t('common.noInternetConnection'),
              t('common.pleaseCheckConnection')
            );
            return;
          }
          
          loadData();
        }
      },
      {
        text: t('common.cancel'),
        style: 'cancel',
        onPress: () => {
          setNetworkError(false);
          setServerError(false);
        }
      }
    ]);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Reset transactions when filter changes
    setTransactions([]);
    setCurrentPage(1);
    setHasMorePages(true);
    loadTransactions(1, activeFilter);
  }, [activeFilter]);

  const loadData = async () => {
    setLoading(true);
    setNetworkError(false);
    setServerError(false);
    
    try {
      await Promise.all([
        loadLoyaltyPoints(),
        loadTransactions(1, activeFilter)
      ]);
    } catch (error) {
      console.error('Error loading loyalty data:', error);
      showErrorMessage(error, t('loyalty.failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const loadLoyaltyPoints = async () => {
    try {
      const response = await apiService.getUserLoyaltyPoints();
      
      console.log('===== LOYALTY POINTS RESPONSE =====');
      console.log('Full response:', JSON.stringify(response, null, 2));
      console.log('response.success:', response?.success);
      console.log('response.data:', response?.data);
      console.log('===================================');
      
      if (response && response.success && response.data) {
        setLoyaltyPoints(response.data);
        setNetworkError(false);
        setServerError(false);
      } else {
        // Handle case where response is successful but no data
        console.warn('No loyalty points data received');
      }
    } catch (error) {
      console.error('Error loading loyalty points:', error);
      showErrorMessage(error, t('loyalty.failedToLoadPoints'));
    }
  };

  const loadTransactions = async (page: number = 1, filter: FilterType = 'all') => {
    try {
      const params: any = { page, limit: 20 };
      if (filter !== 'all') {
        params.type = filter;
      }

      const response = await apiService.getPointTransactions(params);
      
      console.log('===== POINT TRANSACTIONS RESPONSE =====');
      console.log('Full response:', JSON.stringify(response, null, 2));
      console.log('response.success:', response?.success);
      console.log('response.data:', response?.data);
      console.log('response.data.data:', response?.data?.data);
      console.log('response.data.pagination:', response?.data?.pagination);
      console.log('=======================================');
      
      if (response && response.success && response.data) {
        const newTransactions = response.data.data || [];
        
        console.log('New transactions count:', newTransactions.length);
        console.log('New transactions:', newTransactions);
        
        if (page === 1) {
          setTransactions(newTransactions);
        } else {
          setTransactions(prev => [...prev, ...newTransactions]);
        }

        // Safe access to pagination data with fallbacks
        const pagination = response.data.pagination || {};
        const currentPageFromResponse = pagination.page || page;
        const totalPages = pagination.totalPages || 1;
        
        setHasMorePages(currentPageFromResponse < totalPages);
        setCurrentPage(page);
        setNetworkError(false);
        setServerError(false);
      } else {
        // Handle case where response is not successful
        console.warn('Failed to load transactions:', response?.message || 'Unknown error');
        if (page === 1) {
          // Only show error for first page, not for load more
          showErrorMessage(new Error(response?.message || 'Failed to load transactions'));
        }
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      
      // Only show error alert for first page load, not for pagination
      if (page === 1) {
        showErrorMessage(error, t('loyalty.failedToLoadTransactions'));
      } else {
        // For pagination errors, just log and stop loading more
        setLoadingMore(false);
        setHasMorePages(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setNetworkError(false);
    setServerError(false);
    setCurrentPage(1);
    setHasMorePages(true);
    
    try {
      await loadData();
    } catch (error) {
      console.error('Error refreshing data:', error);
      showErrorMessage(error, t('loyalty.failedToRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [activeFilter]);

  const loadMore = async () => {
    if (loadingMore || !hasMorePages || networkError || serverError) return;
    
    setLoadingMore(true);
    try {
      await loadTransactions(currentPage + 1, activeFilter);
    } catch (error) {
      console.error('Error loading more transactions:', error);
      // Don't show alert for load more errors, just stop loading
      setHasMorePages(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned': return 'add-circle';
      case 'redeemed': return 'remove-circle';
      case 'expired': return 'time';
      case 'bonus': return 'gift';
      default: return 'star';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned': return '#4CAF50';
      case 'redeemed': return '#FF9800';
      case 'expired': return '#F44336';
      case 'bonus': return '#9C27B0';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderTransaction = ({ item }: { item: PointTransaction }) => {
    const hasOrderId = item.order_id && item.order_id > 0;
    const displayOrderNumber = item.order_number || `#${item.order_id}`;
    const hasOrderTotal = item.order_total && item.order_total > 0;
    const hasProduct = item.product_id && (item.product_name_en || item.product_name_ar);
    const productName = currentLanguage === 'ar' ? (item.product_name_ar || item.product_name_en) : (item.product_name_en || item.product_name_ar);
    const isEarnedFromOrder = item.type === 'earned' && hasOrderId;
    
    return (
      <TouchableOpacity 
        style={[
          styles.transactionItem,
          isEarnedFromOrder ? styles.transactionItemWithOrder : null
        ]}
        onPress={() => {
          if (hasOrderId) {
            navigation.navigate('OrderDetails', { orderId: item.order_id });
          }
        }}
        disabled={!hasOrderId}
        activeOpacity={hasOrderId ? 0.7 : 1}
      >
        <View style={styles.transactionLeft}>
          <View style={[
            styles.transactionIcon,
            { backgroundColor: getTransactionColor(item.type) + '20' }
          ]}>
            <Icon 
              name={getTransactionIcon(item.type)} 
              size={20} 
              color={getTransactionColor(item.type)} 
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>
              {isRTL ? item.description_ar : item.description_en}
            </Text>
            {hasProduct && (
              <View style={[styles.productInfoBadge, isRTL && styles.rtlProductInfoBadge]}>
                <Icon name="cube-outline" size={12} color="#4CAF50" />
                <Text style={[styles.productInfoText, isRTL && styles.rtlText]}>
                  {productName}
                  {item.variant_name && ` (${item.variant_name})`}
                  {item.quantity && item.quantity > 1 && ` × ${item.quantity}`}
                </Text>
              </View>
            )}
            {hasOrderId && (
              <View style={[styles.orderInfoBadge, isRTL && styles.rtlOrderInfoBadge]}>
                <Icon name="receipt-outline" size={12} color="#007AFF" />
                <Text style={[styles.orderInfoText, isRTL && styles.rtlText]}>
                  {t('loyalty.orderNumber')}: {displayOrderNumber}
                  {hasOrderTotal && ` • ${item.order_total?.toFixed(3)} ${t('common.currency')}`}
                </Text>
                <Icon name={isRTL ? "chevron-back" : "chevron-forward"} size={12} color="#007AFF" />
              </View>
            )}
            {isEarnedFromOrder && (
              <View style={[styles.earnedFromOrderBadge, isRTL && styles.rtlEarnedFromOrderBadge]}>
                <Icon name="checkmark-circle" size={12} color="#4CAF50" />
                <Text style={[styles.earnedFromOrderText, isRTL && styles.rtlText]}>
                  {t('loyalty.earnedFromOrder') || 'Earned from this order'}
                </Text>
              </View>
            )}
            <Text style={styles.transactionDate}>
              {formatDate(item.created_at)}
            </Text>
            {item.expires_at && (
              <Text style={styles.transactionExpiry}>
                {t('profile.pointsExpireOn')} {formatDate(item.expires_at)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionPoints,
            { color: getTransactionColor(item.type) }
          ]}>
            {item.type === 'redeemed' ? '-' : '+'}{Math.abs(item.points)}
          </Text>
          <Text style={styles.transactionPointsLabel}>
            {t('loyalty.points')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  // Error state for network issues
  if (networkError && !loyaltyPoints && transactions.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="cloud-offline" size={64} color="#ccc" />
        <Text style={styles.errorTitle}>{t('common.connectionError')}</Text>
        <Text style={styles.errorMessage}>{t('common.checkInternetConnection')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Error state for server issues
  if (serverError && !loyaltyPoints && transactions.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="server" size={64} color="#ccc" />
        <Text style={styles.errorTitle}>{t('common.serverError')}</Text>
        <Text style={styles.errorMessage}>{t('common.serverTemporarilyUnavailable')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Network Error Banner */}
      {(networkError || serverError) && loyaltyPoints && (
        <View style={styles.errorBanner}>
          <Icon 
            name={networkError ? "cloud-offline" : "server"} 
            size={16} 
            color="#fff" 
            style={styles.errorBannerIcon} 
          />
          <Text style={styles.errorBannerText}>
            {networkError 
              ? t('common.connectionIssues') 
              : t('common.serverIssues')
            }
          </Text>
          <TouchableOpacity onPress={loadData} style={styles.errorBannerButton}>
            <Text style={styles.errorBannerButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={true}
      >
        {/* Points Summary */}
        {loyaltyPoints && (
          <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Icon name="star" size={32} color="#FFD700" />
            <Text style={styles.summaryTitle}>{t('profile.loyaltyPoints')}</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{loyaltyPoints.available_points}</Text>
              <Text style={styles.statLabel}>{t('profile.availablePoints')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{loyaltyPoints.total_points}</Text>
              <Text style={styles.statLabel}>{t('profile.totalPoints')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{loyaltyPoints.lifetime_earned}</Text>
              <Text style={styles.statLabel}>{t('profile.lifetimeEarned')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{loyaltyPoints.lifetime_redeemed}</Text>
              <Text style={styles.statLabel}>{t('profile.lifetimeRedeemed')}</Text>
            </View>
          </View>
          
          <Text style={styles.earnMessage}>
            {t('profile.earnPointsMessage')}
          </Text>
        </View>
      )}

      {/* How to Earn Points Section */}
      <View style={styles.howToEarnCard}>
        <View style={styles.howToEarnHeader}>
          <Icon name="help-circle" size={24} color="#007AFF" />
          <Text style={[styles.howToEarnTitle, isRTL && styles.rtlText]}>
            {t('loyalty.howToEarnTitle')}
          </Text>
        </View>
        <Text style={[styles.howToEarnSubtitle, isRTL && styles.rtlText]}>
          {t('loyalty.howToEarnSubtitle')}
        </Text>

        <View style={styles.earnWaysContainer}>
          <View style={styles.earnWayItem}>
            <View style={styles.earnWayIconContainer}>
              <Icon name="cart" size={24} color="#4CAF50" />
            </View>
            <View style={styles.earnWayContent}>
              <Text style={[styles.earnWayTitle, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay1Title')}
              </Text>
              <Text style={[styles.earnWayDescription, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay1Description')}
              </Text>
            </View>
          </View>

          <View style={styles.earnWayItem}>
            <View style={styles.earnWayIconContainer}>
              <Icon name="pricetag" size={24} color="#FF9800" />
            </View>
            <View style={styles.earnWayContent}>
              <Text style={[styles.earnWayTitle, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay2Title')}
              </Text>
              <Text style={[styles.earnWayDescription, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay2Description')}
              </Text>
            </View>
          </View>

          <View style={styles.earnWayItem}>
            <View style={styles.earnWayIconContainer}>
              <Icon name="trending-up" size={24} color="#9C27B0" />
            </View>
            <View style={styles.earnWayContent}>
              <Text style={[styles.earnWayTitle, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay3Title')}
              </Text>
              <Text style={[styles.earnWayDescription, isRTL && styles.rtlText]}>
                {t('loyalty.earnWay3Description')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pointsValueContainer}>
          <Icon name="information-circle" size={16} color="#666" />
          <Text style={[styles.pointsValueText, isRTL && styles.rtlText]}>
            {t('loyalty.pointsValue', { rate: loyaltyPoints?.loyalty_points_rate?.toFixed(2) || '0.01' })}
          </Text>
        </View>

        <View style={styles.infoNotesContainer}>
          <View style={[styles.infoNote, isRTL && styles.rtlInfoNote]}>
            <Icon name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={[styles.infoNoteText, isRTL && styles.rtlText]}>
              {t('loyalty.minimumOrder')}
            </Text>
          </View>
          <View style={[styles.infoNote, isRTL && styles.rtlInfoNote]}>
            <Icon name="time" size={16} color="#FF9800" />
            <Text style={[styles.infoNoteText, isRTL && styles.rtlText]}>
              {t('loyalty.noExpiry')}
            </Text>
          </View>
        </View>
      </View>

      {/* <View style={styles.filterSection}>
        <Text style={[styles.filterSectionTitle, isRTL && styles.rtlText]}>
          {t('profile.pointsHistory')}
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              {filter.icon && (
                <Icon 
                  name={filter.icon} 
                  size={14} 
                  color={activeFilter === filter.key ? '#fff' : '#666'} 
                  style={styles.filterTabIcon}
                />
              )}
              <Text style={[
                styles.filterTabText,
                activeFilter === filter.key && styles.filterTabTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

        <View style={styles.transactionsList}>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="star-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>{t('profile.noPointsHistory')}</Text>
            </View>
          ) : (
            <>
              {transactions.map((item) => renderTransaction({ item }))}
              {renderFooter()}
            </>
          )}
        </View> */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  rtlSummaryTitle: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  rtlStatLabel: {
    textAlign: 'right',
  },
  earnMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  rtlEarnMessage: {
    textAlign: 'right',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 16,
    marginBottom: 12,
  },
  filtersContainer: {
    paddingHorizontal: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterTabIcon: {
    marginRight: 6,
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  transactionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transactionItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionItemWithOrder: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  rtlTransactionDescription: {
    textAlign: 'right',
  },
  transactionDate: {
    fontSize: 14,
    color: '#666',
  },
  rtlTransactionDate: {
    textAlign: 'right',
  },
  transactionExpiry: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  rtlTransactionExpiry: {
    textAlign: 'right',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionPoints: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  rtlEmptyStateText: {
    textAlign: 'right',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorBannerIcon: {
    marginRight: 8,
  },
  errorBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  errorBannerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  errorBannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  rtlOrderInfoBadge: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  orderInfoText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  productInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  rtlProductInfoBadge: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  productInfoText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  earnedFromOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  rtlEarnedFromOrderBadge: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  earnedFromOrderText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  transactionPointsLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
  },
  howToEarnCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  howToEarnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  howToEarnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  howToEarnSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  earnWaysContainer: {
    marginBottom: 16,
  },
  earnWayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  earnWayIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earnWayContent: {
    flex: 1,
    justifyContent: 'center',
  },
  earnWayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  earnWayDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  pointsValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  pointsValueText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  infoNotesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlInfoNote: {
    flexDirection: 'row-reverse',
  },
  infoNoteText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});

export default LoyaltyPointsScreen;
