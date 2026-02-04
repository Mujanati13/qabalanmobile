import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import supportService, { SupportTicket } from '../services/supportService';
import { useLanguage } from '../contexts/LanguageContext';

interface FilterOptions {
  status: string;
  category: string;
}

const SupportTicketsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR

  // Get route params for notification handling
  const params = route.params as any;
  const notificationTicketId = params?.ticketId;
  const shouldRefresh = params?.refresh;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: '',
    category: '',
  });

  const statusOptions = useMemo(() => ([
    { value: '', label: t('support.filters.allStatus') },
    { value: 'open', label: t('support.statuses.open') },
    { value: 'in_progress', label: t('support.statuses.in_progress') },
    { value: 'resolved', label: t('support.statuses.resolved') },
    { value: 'closed', label: t('support.statuses.closed') },
  ]), [t]);

  const categoryOptions = useMemo(() => ([
    { value: '', label: t('support.filters.allCategories') },
    { value: 'complaint', label: t('support.categories.complaint') },
    { value: 'inquiry', label: t('support.categories.inquiry') },
    { value: 'order_issue', label: t('support.categories.orderIssue') },
  ]), [t]);

  const navigateToTicketDetails = useCallback((ticket: SupportTicket) => {
    navigation.navigate('TicketDetails' as never, { ticketId: ticket.id } as never);
  }, [navigation]);

  const navigateToCreateTicket = useCallback(() => {
    navigation.navigate('CreateTicket' as never);
  }, [navigation]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) {
      return '';
    }

    try {
      const locale = currentLanguage === 'ar' ? 'ar-JO' : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateString));
    } catch (error) {
      console.log('⚠️  Failed to format date:', error);
      return dateString;
    }
  }, [currentLanguage]);

  const getStatusColor = useCallback((status: string) => supportService.getStatusColor(status), []);
  const getPriorityColor = useCallback((priority: string) => supportService.getPriorityColor(priority), []);
  const getCategoryIcon = useCallback((category: string) => supportService.getCategoryIcon(category), []);

  const getStatusLabel = useCallback((status: string) => {
    const key = `support.statuses.${status}`;
    const translated = t(key as any);
    return translated === key ? status : translated;
  }, [t]);

  const getPriorityLabel = useCallback((priority: string) => {
    const key = `support.priorities.${priority}`;
    const translated = t(key as any);
    return translated === key ? priority : translated;
  }, [t]);

  const getUnreadRepliesCount = useCallback((ticket: SupportTicket) => {
    const apiCount = (ticket as any)?.unread_replies_count;
    if (typeof apiCount === 'number' && !Number.isNaN(apiCount)) {
      return apiCount;
    }

    if (!ticket.replies || ticket.replies.length === 0) {
      return 0;
    }

    return ticket.replies.filter(reply => !reply.is_internal_note && !!reply.admin_id).length;
  }, []);

  const fetchTickets = useCallback(async (showSpinner: boolean = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      console.log('🎫 SupportTicketsScreen: Fetching tickets with filters:', filters);

      const filterParams = {
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        page: 1,
        limit: 50,
      };

      console.log('📋 Filter params:', filterParams);
      const response = await supportService.getMyTickets(filterParams);
      const fetchedTickets: SupportTicket[] = Array.isArray(response?.tickets) ? response.tickets : [];

      console.log('✅ Received tickets response:', fetchedTickets.length);
      setTickets(fetchedTickets);

      if (fetchedTickets.length === 0) {
        console.log('⚠️  No tickets found for user');
      }
    } catch (error) {
      console.error('❌ Error fetching support tickets:', error);
      Alert.alert(t('common.error'), t('support.loadTicketsFailed'));
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, [filters, t]);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [fetchTickets])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTickets(false);
    setRefreshing(false);
  }, [fetchTickets]);

  useEffect(() => {
    if (!notificationTicketId && !shouldRefresh) {
      return;
    }

    if (notificationTicketId) {
      const targetTicket = tickets.find(ticket => ticket.id === notificationTicketId);
      if (targetTicket) {
        const timeoutId = setTimeout(() => {
          navigateToTicketDetails(targetTicket);
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }

    if (shouldRefresh) {
      fetchTickets(false);
    }
  }, [notificationTicketId, shouldRefresh, tickets, navigateToTicketDetails, fetchTickets]);

  const renderTicketItem = useCallback(({ item }: { item: SupportTicket }) => {
    const unreadCount = getUnreadRepliesCount(item);

    return (
      <TouchableOpacity
        style={styles.ticketItem}
        onPress={() => navigateToTicketDetails(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.ticketHeader, isRTL && styles.rtlRowReverse]}>
          <View style={[styles.ticketInfo, isRTL && styles.rtlInfoSpacing]}>
            <View style={[styles.ticketTitleRow, isRTL && styles.rtlRowReverse]}>
              <Icon
                name={getCategoryIcon(item.category)}
                size={16}
                color="#666"
                style={[styles.categoryIcon, isRTL && styles.rtlMarginReset]}
              />
              <Text style={[styles.ticketNumber, isRTL && styles.rtlText]}>#{item.ticket_number}</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.ticketSubject, isRTL && styles.rtlText]} numberOfLines={2}>
              {item.subject}
            </Text>
          </View>
          <View style={[styles.ticketMeta, isRTL && styles.rtlAlignStart]}>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }, isRTL && styles.rtlText]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(item.priority)}20` }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }, isRTL && styles.rtlText]}>
                {getPriorityLabel(item.priority)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ticketContent}>
          <Text style={[styles.ticketMessage, isRTL && styles.rtlText]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>

        <View style={[styles.ticketFooter, isRTL && styles.rtlRowReverse]}>
          <View style={[styles.ticketDetails, isRTL && styles.rtlAlignEnd]}>
            {item.order && (
              <View style={[styles.orderInfo, isRTL && styles.rtlOrderInfo]}>
                <Icon name="shopping-cart" size={12} color="#666" />
                <Text style={[styles.orderText, isRTL && styles.rtlOrderText]}>
                  {t('support.orderNumberLabel', { orderNumber: item.order.order_number })}
                </Text>
              </View>
            )}
            <Text style={[styles.ticketDate, isRTL && styles.rtlText]}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={[styles.ticketActions, isRTL && styles.rtlRowReverse]}>
            {item.replies && item.replies.length > 0 && (
              <View style={[styles.repliesInfo, isRTL && styles.rtlRowReverse]}>
                <Icon name="chatbubbles" size={16} color="#666" />
                <Text style={[styles.repliesCount, isRTL && styles.rtlText]}>{item.replies.length}</Text>
              </View>
            )}
            <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color="#ccc" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [
    formatDate,
    getCategoryIcon,
    getPriorityColor,
    getPriorityLabel,
    getStatusColor,
    getStatusLabel,
    getUnreadRepliesCount,
    isRTL,
    navigateToTicketDetails,
    t,
  ]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>{t('support.supportTickets')}</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={navigateToCreateTicket}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{t('support.filters.statusLabel')}:</Text>
            <View style={styles.filterButtons}>
              {statusOptions.slice(0, 3).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterButton,
                    filters.status === option.value && styles.activeFilterButton,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, status: option.value }))}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.status === option.value && styles.activeFilterButtonText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{t('support.filters.categoryLabel')}:</Text>
            <View style={styles.filterButtons}>
              {categoryOptions.slice(0, 3).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterButton,
                    filters.category === option.value && styles.activeFilterButton,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, category: option.value }))}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      filters.category === option.value && styles.activeFilterButtonText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="headset" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>{t('support.noTicketsYet')}</Text>
      <Text style={styles.emptyText}>
        {t('support.createFirstTicket')}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={navigateToCreateTicket}
      >
        <Icon name="add" size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>{t('support.createTicket')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
        <Text style={styles.loadingText}>{t('support.loadingTickets')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tickets}
        renderItem={renderTicketItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1890ff']}
            tintColor="#1890ff"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tickets.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#1890ff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    gap: 8,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginEnd: 8,
    minWidth: 60,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginEnd: 8,
    marginBottom: 4,
  },
  activeFilterButton: {
    backgroundColor: '#1890ff',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  ticketItem: {
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ticketInfo: {
    flex: 1,
    marginEnd: 12,
  },
  ticketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIcon: {
    marginEnd: 6,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1890ff',
    marginEnd: 8,
  },
  unreadBadge: {
    backgroundColor: '#ff4d4f',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  ticketSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 22,
  },
  ticketMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '600',
  },
  ticketContent: {
    marginBottom: 12,
  },
  ticketMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketDetails: {
    flex: 1,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rtlOrderInfo: {
    flexDirection: 'row-reverse',
  },
  orderText: {
    fontSize: 12,
    color: '#666',
    marginStart: 4,
  },
  rtlOrderText: {
    marginLeft: 0,
    marginRight: 4,
    textAlign: 'right',
  },
  ticketDate: {
    fontSize: 12,
    color: '#999',
  },
  ticketActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repliesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginEnd: 8,
  },
  repliesCount: {
    fontSize: 12,
    color: '#666',
    marginStart: 4,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1890ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginStart: 8,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  rtlAlignStart: {
    alignItems: 'flex-start',
  },
  rtlAlignEnd: {
    alignItems: 'flex-end',
  },
  rtlInfoSpacing: {
    marginEnd: 0,
    marginStart: 12,
  },
  rtlMarginReset: {
    marginEnd: 0,
    marginStart: 6,
  },
});

export default SupportTicketsScreen;
