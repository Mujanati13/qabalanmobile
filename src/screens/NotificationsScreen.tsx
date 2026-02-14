import React, { useState, useCallback, useMemo } from 'react';
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
  Platform,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '../services/apiService';
import notificationService from '../services/notificationService';
interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}

interface NotificationsScreenProps {
  navigation: any;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { user: _user, isGuest, logout } = useAuth();
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'ar' || I18nManager.isRTL;
  const { unreadCount, decrementUnreadCount, clearAllUnread, refreshUnreadCount } = useNotification();
  const [rawNotifications, setRawNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const transformNotification = useCallback((notif: any): Notification => {
    const getLocalizedField = (field: 'title' | 'message') => {
      const primaryKey = `${field}_${currentLanguage}`;
      const secondaryKey = currentLanguage === 'ar' ? `${field}_en` : `${field}_ar`;
      return (
        (notif && notif[primaryKey]) ||
        (notif && notif[secondaryKey]) ||
        (notif && notif[field]) ||
        ''
      );
    };

    return {
      id: notif.id,
      title: getLocalizedField('title') || 'Notification',
      message: getLocalizedField('message'),
      type: notif.type || 'general',
      is_read: Boolean(notif.is_read),
      created_at: notif.created_at,
      data: notif.data ?? null,
    };
  }, [currentLanguage]);

  const notifications = useMemo(
    () => rawNotifications.map(transformNotification),
    [rawNotifications, transformNotification]
  );

  const loadNotifications = async (pageNum = 1, showLoading = true) => {
    // Check if user is authenticated
    if (isGuest || !_user) {
      console.log('[NOTIF] Skipping notification load - user not authenticated');
      setLoading(false);
      setRefreshing(false);
      setRawNotifications([]);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      
      console.log('[NOTIF] Loading notifications, page:', pageNum);
      const response = await ApiService.getNotifications({ page: pageNum, limit: 20 });
      console.log('[NOTIF] API Response:', {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        dataLength: response.data?.length || 0
      });
      
      if (response.success && response.data) {
        let notificationData = [];
        let paginationData = null;
        
        // Handle the backend response structure: { notifications: [], pagination: {} }
        if ((response.data as any).notifications && Array.isArray((response.data as any).notifications)) {
          notificationData = (response.data as any).notifications;
          paginationData = (response.data as any).pagination;
          console.log('[NOTIF] Found notifications array:', notificationData.length, 'items');
        } else if (Array.isArray(response.data)) {
          // Fallback: direct array response
          notificationData = response.data;
          console.log('[NOTIF] Direct array response:', notificationData.length, 'items');
        }
        
        // Process notifications to ensure proper data structure
        const normalizedNotifications = notificationData.map((notif: any) => ({
          ...notif,
          is_read: Boolean(notif.is_read),
          data: notif.data
            ? (typeof notif.data === 'string' ? JSON.parse(notif.data) : notif.data)
            : null,
        }));

        console.log('[NOTIF] Processed notifications:', normalizedNotifications.length, 'items');
        console.log('[NOTIF] First notification sample:', normalizedNotifications[0]);

        if (pageNum === 1) {
          setRawNotifications(normalizedNotifications);
        } else {
          setRawNotifications(prev => [...prev, ...normalizedNotifications]);
        }
        
        // Handle pagination
        if (paginationData) {
          setHasMore(paginationData.page < paginationData.pages);
        } else {
          setHasMore(normalizedNotifications.length === 20);
        }
        
        setPage(pageNum);
      } else {
        console.error('[NOTIF] Failed response:', response);
        if (pageNum === 1) {
          setRawNotifications([]);
        }
      }
    } catch (error) {
      console.error('[NOTIF] Error loading notifications:', error);
      Alert.alert(t('common.error'), t('notifications.loadError'));
      if (pageNum === 1) {
        setRawNotifications([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await ApiService.markNotificationAsRead(notificationId);
      
      setRawNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, is_read: true }
            : notif
        )
      );
      
      // Decrement unread count if notification was unread
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.is_read) {
        decrementUnreadCount();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await ApiService.markAllNotificationsAsRead();
      
      if (response.success) {
        setRawNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
        
        // Clear all unread notifications only after server confirms success
        clearAllUnread();
        
        // Also refresh the count from server to ensure consistency
        setTimeout(() => {
          refreshUnreadCount();
        }, 500);
      } else {
        throw new Error(response.message || 'Failed to mark all as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert(t('common.error'), t('notifications.markAllError'));
      
      // Refresh count from server in case of error to show accurate state
      refreshUnreadCount();
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.type === 'order' && notification.data?.order_id) {
      navigation.navigate('OrderDetails', { orderId: notification.data.order_id });
    } else if (notification.type === 'promotion') {
      navigation.navigate('Products', { featured: true });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadNotifications(1, false);
    refreshUnreadCount();
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadNotifications(page + 1, false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      refreshUnreadCount();
      // Clear badge count when user opens notifications screen
      notificationService.clearBadgeCount();
    }, [])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMinutes < 1) {
      return t('notifications.timeAgo.now');
    } else if (diffMinutes < 60) {
      return t('notifications.timeAgo.minutesAgo', { count: diffMinutes });
    } else if (diffHours < 24) {
      return t('notifications.timeAgo.hoursAgo', { count: diffHours });
    } else if (diffDays === 1) {
      return t('notifications.timeAgo.yesterday');
    } else if (diffDays < 2) {
      return t('notifications.timeAgo.today');
    } else if (diffDays < 7) {
      return t('notifications.timeAgo.daysAgo', { count: diffDays });
    } else if (diffWeeks < 4) {
      return t('notifications.timeAgo.weeksAgo', { count: diffWeeks });
    } else if (diffMonths < 12) {
      return t('notifications.timeAgo.monthsAgo', { count: diffMonths });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return 'receipt-outline';
      case 'promotion':
        return 'pricetag-outline';
      case 'system':
        return 'information-circle-outline';
      case 'delivery':
        return 'car-outline';
      case 'payment':
        return 'card-outline';
      case 'account':
        return 'person-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order':
        return '#3B82F6';
      case 'promotion':
        return '#10B981';
      case 'system':
        return '#6B7280';
      case 'delivery':
        return '#F59E0B';
      case 'payment':
        return '#8B5CF6';
      case 'account':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getNotificationTitle = (type: string) => {
    return t(`notifications.types.${type}`) || t('notifications.types.general');
  };

  // Enhanced notification item component with better organization
  const NotificationItem: React.FC<{ item: Notification; index: number }> = ({ item, index }) => {
    const isOrderType = item.type === 'order' || item.type === 'delivery' || item.type === 'payment';
    
    // Debug logging for notification content
    console.log('[NOTIF] Rendering notification:', {
      id: item.id,
      title: item.title,
      message: item.message,
      messageLength: item.message?.length || 0,
      type: item.type,
      isRead: item.is_read,
      isOrderType
    });

    return (
      <TouchableOpacity
        style={[
          styles.notificationWrapper,
          isRTL && styles.rtlNotificationWrapper,
          !item.is_read && styles.unreadNotification,
          isOrderType && styles.orderNotification
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Left side - Icon and status */}
        <View style={[
          styles.iconBackground,
          { backgroundColor: getNotificationColor(item.type) + '20' }
        ]}>
          <Icon 
            name={getNotificationIcon(item.type)} 
            size={22} 
            color={getNotificationColor(item.type)}
          />
        </View>
        {!item.is_read && (
          <View style={[styles.unreadDot, isRTL && styles.rtlUnreadDot]} />
        )}
        
        {/* Main content */}
        <View style={[styles.notificationContainer, isRTL && styles.rtlNotificationContainer]}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.notificationTitle,
              !item.is_read && styles.unreadTitle,
              isRTL && styles.rtlText
            ]} numberOfLines={1}>
              {item.title || 'No Title'}
            </Text>
            <View style={[
              styles.typeChip,
              { backgroundColor: getNotificationColor(item.type) + '15' },
              isRTL && styles.rtlTypeChip
            ]}>
              <Text style={[
                styles.typeChipText,
                { color: getNotificationColor(item.type) },
                isRTL && styles.rtlWritingDirection
              ]}>
                {getNotificationTitle(item.type)}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.notificationTime, isRTL && styles.rtlText]}>
            {formatDate(item.created_at)}
          </Text>
          
          <Text style={[
            styles.notificationMessage,
            !item.is_read && styles.unreadMessage,
            isRTL && styles.rtlText
          ]} numberOfLines={2}>
            {item.message || 'No message content'}
          </Text>
          
          {/* Order-specific information */}
          {isOrderType && item.data?.order_id && (
            <View style={styles.orderInfo}>
              <Text style={[styles.orderInfoText, isRTL && styles.rtlText]}>
                {`${t('orders.orderNumber')}: ${item.data.order_id}`}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Simple render function for FlatList
  const renderNotification = ({ item, index }: { item: Notification; index: number }) => {
    return <NotificationItem item={item} index={index} />;
  };

  // Simple empty state without animation
  const EmptyStateComponent: React.FC = () => {
    if (isGuest || !_user) {
      return (
        <View style={styles.emptyState}>
          <Icon name="notifications-off-outline" size={80} color="#D1D5DB" />
          <Text style={[styles.emptyStateTitle, isRTL && styles.rtlText]}>
            {t('auth.loginRequired')}
          </Text>
          <Text style={[styles.emptyStateSubtitle, isRTL && styles.rtlText]}>
            {t('notifications.loginToView')}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={async () => {
              // Logout guest user first to reset navigation to AuthNavigator
              await logout();
              // AuthWelcome will be shown automatically when isGuest becomes false
            }}
          >
            <Text style={styles.loginButtonText}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Icon name="notifications-outline" size={80} color="#D1D5DB" />
        <Text style={[styles.emptyStateTitle, isRTL && styles.rtlText]}>
          {t('notifications.empty')}
        </Text>
        <Text style={[styles.emptyStateSubtitle, isRTL && styles.rtlText]}>
          {t('notifications.emptyDescription')}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    return <EmptyStateComponent />;
  };

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#111827" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, isRTL && { writingDirection: 'rtl' }]}>{t('notifications.title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
          >
            <Icon name="checkmark-done-outline" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>

      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  badgeContainer: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginStart: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  unreadNotification: {
    backgroundColor: '#EFF6FF',
    borderStartWidth: 4,
    borderStartColor: '#3B82F6',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginEnd: 16,
  },
  notificationContent: {
    flex: 1,
    paddingVertical: 4, // Add some vertical padding
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6, // Increase margin for better spacing
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    marginEnd: 8,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#374151', // Darker color to make it more visible
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 20,
    minHeight: 20, // Ensure minimum height even if text is empty
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  // New styles for enhanced notification items
  notificationWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    position: 'relative',
  },
  orderNotification: {
    backgroundColor: '#F8FAFC',
    borderStartWidth: 4,
    borderStartColor: '#3B82F6',
  },
  notificationContainer: {
    flex: 1,
    marginLeft: 12,
  },
  iconBackground: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#111827',
  },
  orderInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  orderInfoText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rtlText: {
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  rtlNotificationWrapper: {
    // No flexDirection needed - I18nManager handles layout mirroring
  },
  rtlNotificationContainer: {
    marginLeft: 0,
    marginRight: 12,
  },
  rtlRowReverse: {
    // No flexDirection needed - I18nManager handles layout mirroring
  },
  rtlTypeChip: {
    marginLeft: 0,
    marginRight: 8,
  },
  rtlUnreadDot: {
    right: undefined,
    left: 12,
  },
  rtlWritingDirection: {
    writingDirection: 'rtl',
    textAlign: 'left',
  },
});

export default NotificationsScreen;