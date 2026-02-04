import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import ApiService, { Offer } from '../services/apiService';
import Colors from '../theme/colors';
import { BorderRadius, Shadow, Spacing, Typography } from '../theme';

// Memoized offer card component for performance
interface OfferCardProps {
  item: Offer;
  t: ReturnType<typeof useTranslation>['t'];
  onPress: (offer: Offer) => void;
}

const OfferCard = React.memo<OfferCardProps>(({ item, t, onPress }) => {
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const title = currentLanguage === 'ar'
    ? item?.title_ar || item?.title_en || item?.title || t('offers.defaultTitle')
    : item?.title_en || item?.title_ar || item?.title || t('offers.defaultTitle');
  const description = currentLanguage === 'ar'
    ? item?.description_ar || item?.description_en || item?.description || ''
    : item?.description_en || item?.description_ar || item?.description || '';
  const image = item?.featured_image || item?.banner_image || item?.image_url;
  const startDate = item?.valid_from ? new Date(item.valid_from) : item?.start_date ? new Date(item.start_date) : null;
  const endDate = item?.valid_until ? new Date(item.valid_until) : item?.end_date ? new Date(item.end_date) : null;

  return (
    <TouchableOpacity 
      style={styles.offerCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {image ? (
        <Image
          source={{ uri: ApiService.getImageUrl(image) }}
          style={styles.offerImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.offerImage, styles.offerImageFallback]}>
          <Text style={styles.offerImageFallbackText}>QB</Text>
        </View>
      )}

      <View style={styles.offerContent}>
        <Text style={[styles.offerTitle, isRTL && styles.rtlText]} numberOfLines={2}>{title}</Text>
        {description ? <Text style={[styles.offerDescription, isRTL && styles.rtlText]} numberOfLines={2}>{description}</Text> : null}

        <View style={[styles.offerMeta, isRTL && styles.rtlOfferMeta]}>
          {item?.code ? (
            <View style={styles.offerPill}>
              <Text style={[styles.offerPillLabel, isRTL && styles.rtlText]}>{t('offers.promoCode')}</Text>
              <Text style={[styles.offerPillValue, isRTL && styles.rtlText]}>{item.code}</Text>
            </View>
          ) : null}

          {(startDate || endDate) && (
            <Text style={[styles.offerDates, isRTL && styles.rtlText]}>
              {startDate ? startDate.toLocaleDateString() : t('offers.availableNow')} 
              {endDate ? ` – ${endDate.toLocaleDateString()}` : ''}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return prevProps.item?.id === nextProps.item?.id &&
         prevProps.item?.title === nextProps.item?.title &&
         (prevProps.item?.featured_image || prevProps.item?.banner_image) === 
         (nextProps.item?.featured_image || nextProps.item?.banner_image);
});

OfferCard.displayName = 'OfferCard';

const OffersScreen: React.FC = () => {
  const { t } = useTranslation();
  const isRTL = false; // Override to force LTR
  const navigation = useNavigation<any>();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const hasFocusedOnce = useRef(false);

  const loadOffers = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await ApiService.getOffers({ status: 'active', limit: 30 });
      
      if (response.success && Array.isArray(response.data)) {
        setOffers(response.data);
      } else {
        setOffers([]);
        setError(response.message || t('offers.unavailable'));
      }
    } catch (err) {
      setOffers([]);
      setError(t('offers.unavailable'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      loadOffers();
    }, [loadOffers])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadOffers();
  };

  // Handle offer click
  const handleOfferPress = useCallback((offer: Offer) => {
    // Navigate to products screen and apply the offer/promo code
    navigation.navigate('Products', { promoCode: offer.code });
  }, [navigation]);

  // Memoized render function for FlatList
  const renderOffer = useCallback(({ item }: { item: Offer }) => {
    return <OfferCard item={item} t={t} onPress={handleOfferPress} />;
  }, [t, handleOfferPress]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: Offer, index: number) => {
    return item?.id?.toString() || `offer-${index}`;
  }, []);

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isRTL && styles.rtlScrollContent]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          <Text style={[styles.pageTitle, isRTL && styles.rtlText]}>{t('offers.title')}</Text>
          <Text style={[styles.pageSubtitle, isRTL && styles.rtlText]}>
            {t('offers.subtitle')}
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, isRTL && styles.rtlText]}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadOffers}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <FlatList
            data={offers}
            keyExtractor={keyExtractor}
            renderItem={renderOffer}
            scrollEnabled={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
            contentContainerStyle={isRTL ? styles.rtlList : undefined}
            ListEmptyComponent={!error ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>{t('offers.emptyTitle')}</Text>
                <Text style={[styles.emptyDescription, isRTL && styles.rtlText]}>
                  {t('offers.emptyDescription')}
                </Text>
              </View>
            ) : null}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
  },
  pageTitle: {
    ...Typography.heading.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  pageSubtitle: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  errorContainer: {
    backgroundColor: Colors.errorBackground,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    color: Colors.textWhite,
    fontWeight: '600',
  },
  offerCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  offerImage: {
    width: '100%',
    height: 110,
  },
  offerImageFallback: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerImageFallbackText: {
    fontSize: 28,
    color: Colors.textWhite,
    fontWeight: '700',
  },
  offerContent: {
    padding: Spacing.sm,
    gap: 4,
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  offerDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  offerMeta: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  offerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  offerPillLabel: {
    fontSize: 9,
    color: Colors.primary,
    marginRight: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  offerPillValue: {
    fontSize: 10,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  offerDates: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  emptyState: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.heading.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyDescription: {
    ...Typography.body.small,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  rtlContainer: {
    direction: 'rtl',
  },
  rtlScrollContent: {
    direction: 'rtl',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlList: {
    direction: 'rtl',
  },
  rtlOfferMeta: {
    alignItems: 'flex-end',
  },
});

export default OffersScreen;
