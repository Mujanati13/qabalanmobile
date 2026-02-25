import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  ImageStyle,
  I18nManager,
  Platform,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import ApiService, { Category, Product, Offer } from '../services/apiService';
import notificationService from '../services/notificationService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { Button, Card, SearchBar, CachedImage } from '../components/common';
import { formatCurrency } from '../utils/currency';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// iPhone XS tuned dimensions (375pt width)
const XS_BANNER_CARD_WIDTH = 200;
const XS_BANNER_IMAGE_HEIGHT = 145;
const XS_BANNER_SNAP_INTERVAL = XS_BANNER_CARD_WIDTH + 12;
const XS_PRODUCT_CARD_WIDTH = 140;
const XS_CATEGORY_SIZE = 74;
const XS_OFFER_CARD_WIDTH = screenWidth * 0.62;

interface HomeScreenXSProps {
  navigation: any;
}

const HomeScreenXS: React.FC<HomeScreenXSProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { isRTL: contextIsRTL, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { unreadCount } = useNotification();

  const isRTL = false;
  const isArabic = currentLanguage === 'ar';

  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    setLanguage(currentLanguage);
  }, [currentLanguage]);

  const [banners, setBanners] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [featuredOffers, setFeaturedOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const failedImagesRef = useRef<Set<string>>(new Set());
  const [offersError, setOffersError] = useState<string>('');

  // Banner auto-slide
  const bannerScrollRef = useRef<ScrollView>(null);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bannerIndexRef = useRef(0);
  const bannerCountRef = useRef(0);

  // All products infinite scroll
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allProductsPage, setAllProductsPage] = useState(1);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [allProductsHasMore, setAllProductsHasMore] = useState(true);

  useEffect(() => {
    loadHomeData();
  }, []);

  useEffect(() => {
    loadAllProducts(1);
  }, []);

  useEffect(() => {
    bannerCountRef.current = banners.length;
  }, [banners.length]);

  const loadHomeData = async () => {
    try {
      setLoading(true);
      const [bannersRes, categoriesRes, featuredRes, homeTopRes, homeNewRes, offersRes] = await Promise.all([
        ApiService.getBannerCategories(),
        ApiService.getTopCategories(50),
        ApiService.getFeaturedProducts(6),
        ApiService.getHomeTopProducts(10),
        ApiService.getHomeNewProducts(10),
        ApiService.getFeaturedOffers(6),
      ]);

      setBanners(bannersRes.success && Array.isArray(bannersRes.data) ? bannersRes.data : []);
      setCategories(categoriesRes.success && Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setFeaturedProducts(featuredRes.success && Array.isArray(featuredRes.data) ? featuredRes.data : []);

      if (offersRes.success && Array.isArray(offersRes.data)) {
        setFeaturedOffers(offersRes.data);
        setOffersError('');
      } else {
        setFeaturedOffers([]);
        setOffersError(offersRes.message || t('home.offersUnavailable', 'Offers are temporarily unavailable.'));
      }

      setTopProducts(homeTopRes.success && Array.isArray(homeTopRes.data) ? homeTopRes.data : []);
      setRecentProducts(homeNewRes.success && Array.isArray(homeNewRes.data) ? homeNewRes.data : []);
    } catch (error) {
      console.error('Error loading home data:', error);
      setBanners([]);
      setCategories([]);
      setFeaturedProducts([]);
      setFeaturedOffers([]);
      setTopProducts([]);
      setRecentProducts([]);
      setOffersError(t('home.offersUnavailable', 'Offers are temporarily unavailable.'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  // Banner auto-slide
  const startAutoSlide = () => {
    if (bannerCountRef.current <= 1) return;
    stopAutoSlide();
    autoSlideTimerRef.current = setInterval(() => {
      const nextIndex = (bannerIndexRef.current + 1) % bannerCountRef.current;
      bannerIndexRef.current = nextIndex;
      setCurrentBannerIndex(nextIndex);
      bannerScrollRef.current?.scrollTo({
        x: nextIndex * XS_BANNER_SNAP_INTERVAL,
        animated: true,
      });
    }, 3000);
  };

  const stopAutoSlide = () => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  };

  const resetAutoSlide = () => {
    stopAutoSlide();
    startAutoSlide();
  };

  useFocusEffect(
    React.useCallback(() => {
      if (banners.length > 1) startAutoSlide();
      return () => stopAutoSlide();
    }, [banners.length])
  );

  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / XS_BANNER_SNAP_INTERVAL);
    if (idx !== bannerIndexRef.current && idx >= 0 && idx < bannerCountRef.current) {
      bannerIndexRef.current = idx;
      setCurrentBannerIndex(idx);
    }
  };

  // Helpers
  const parsePrice = (price: string | number | null | undefined): number => {
    if (price === null || price === undefined) return 0;
    return typeof price === 'string' ? parseFloat(price) || 0 : price;
  };

  const calculateDiscountPercentage = (basePrice: string | number, salePrice: string | number): number => {
    const base = parsePrice(basePrice);
    const sale = parsePrice(salePrice);
    if (base <= 0 || sale <= 0 || sale >= base) return 0;
    return Math.round(((base - sale) / base) * 100);
  };

  // Search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    try {
      setIsSearching(true);
      const response = await ApiService.getProducts({ search: query.trim(), limit: 20 });
      setSearchResults(response.success && Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Infinite scroll
  const loadAllProducts = async (page: number = 1) => {
    if (allProductsLoading || (!allProductsHasMore && page > 1)) return;
    try {
      setAllProductsLoading(true);
      const response = await ApiService.getProducts({ page, limit: 10, sort: 'created_at', order: 'desc' });
      if (response.success && Array.isArray(response.data)) {
        if (page === 1) setAllProducts(response.data);
        else setAllProducts(prev => [...prev, ...response.data]);
        setAllProductsHasMore(response.data.length === 10);
      } else {
        setAllProductsHasMore(false);
      }
    } catch (error) {
      console.error('Error loading all products:', error);
      setAllProductsHasMore(false);
    } finally {
      setAllProductsLoading(false);
    }
  };

  const loadMoreAllProducts = () => {
    if (!allProductsLoading && allProductsHasMore) {
      const nextPage = allProductsPage + 1;
      setAllProductsPage(nextPage);
      loadAllProducts(nextPage);
    }
  };

  // Navigation handlers
  const handleBannerPress = (item: Category) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    try {
      navigation.navigate('Products', { categoryId: item.id, categoryName: title || 'Category' });
    } catch (error) {
      Alert.alert(t('common.error') || 'Error', t('home.navigationError') || 'Unable to open this section. Please try again.', [{ text: t('common.ok') || 'OK' }]);
    }
  };

  const handleCategoryPress = (item: Category) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    try {
      navigation.navigate('Products', { categoryId: item.id, categoryName: title || 'Category' });
    } catch (error) {
      Alert.alert(t('common.error') || 'Error', t('home.navigationError') || 'Unable to open this category. Please try again.', [{ text: t('common.ok') || 'OK' }]);
    }
  };

  const handleProductPress = (item: Product) => {
    try {
      navigation.navigate('ProductDetails', { productId: item.id });
    } catch (error) {
      Alert.alert(t('common.error') || 'Error', t('home.navigationError') || 'Unable to open this product. Please try again.', [{ text: t('common.ok') || 'OK' }]);
    }
  };

  const handleOfferPress = (offer: Offer) => {
    try {
      navigation.navigate('Offers');
    } catch (error) {
      Alert.alert(t('common.error') || 'Error', t('home.navigationError') || 'Unable to open offers. Please try again.', [{ text: t('common.ok') || 'OK' }]);
    }
  };

  // ── Render helpers ──

  const renderBanner = (item: Category, index: number) => {
    const bannerImage = item.banner_mobile || item.banner_image || item.image;
    const imageUrl = bannerImage ? ApiService.getImageUrl(bannerImage, 'categories') : '';
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    const description = currentLanguage === 'ar' ? (item.description_ar || item.description_en || '') : (item.description_en || item.description_ar || '');

    return (
      <TouchableOpacity
        key={`banner-${item.id || index}`}
        style={xs.bannerCard}
        onPress={() => handleBannerPress(item)}
        activeOpacity={0.85}
      >
        <View style={xs.bannerImageWrap}>
          {imageUrl && !failedImagesRef.current.has(`banner-${item.id}`) ? (
            <CachedImage
              uri={imageUrl}
              style={xs.bannerImage}
              resizeMode="cover"
              showLoadingIndicator
              onError={() => failedImagesRef.current.add(`banner-${item.id}`)}
              fallbackComponent={<View style={xs.bannerFallback}><Icon name="image-outline" size={36} color={Colors.primary} /></View>}
            />
          ) : (
            <View style={xs.bannerFallback}><Icon name="image-outline" size={36} color={Colors.primary} /></View>
          )}
        </View>
        <View style={xs.bannerInfo}>
          <Text style={[xs.bannerTitle, { textAlign: 'center', writingDirection: isArabic ? 'rtl' : 'ltr' }]} numberOfLines={1}>
            {title || t('common.category')}
          </Text>
          {description ? (
            <Text style={[xs.bannerDesc, { textAlign: 'center', writingDirection: isArabic ? 'rtl' : 'ltr' }]} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategory = (item: Category, index: number) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    return (
      <TouchableOpacity
        key={`cat-${item.id || index}`}
        style={xs.categoryItem}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.7}
      >
        <View style={xs.categoryImageWrap}>
          {item.image && !failedImagesRef.current.has(`category-${item.id}`) ? (
            <CachedImage
              uri={ApiService.getImageUrl(item.image, 'categories')}
              style={xs.categoryImage}
              resizeMode="cover"
              showLoadingIndicator
              onError={() => failedImagesRef.current.add(`category-${item.id}`)}
              fallbackComponent={<View style={[xs.categoryImage, xs.iconFallback]}><Icon name="grid-outline" size={32} color={Colors.primary} /></View>}
            />
          ) : (
            <View style={[xs.categoryImage, xs.iconFallback]}><Icon name="grid-outline" size={32} color={Colors.primary} /></View>
          )}
        </View>
        <Text style={[xs.categoryText, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
          {title || t('common.category')}
        </Text>
        {(item.products_count && item.products_count > 0) ? (
          <Text style={[xs.categoryCount, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {item.products_count} {t('common.items')}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderProductCard = (item: Product, index: number) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    const hasDiscount = item.sale_price && item.sale_price < item.base_price;
    const isOutOfStock = item.stock_status === 'out_of_stock';

    return (
      <TouchableOpacity
        key={`prod-${item.id || index}`}
        style={xs.productCard}
        onPress={() => handleProductPress(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
      >
        <View style={xs.productImageWrap}>
          {item.main_image && !failedImagesRef.current.has(`product-${item.id}`) ? (
            <CachedImage
              uri={ApiService.getImageUrl(item.main_image)}
              style={xs.productImage}
              resizeMode="cover"
              showLoadingIndicator
              onError={() => failedImagesRef.current.add(`product-${item.id}`)}
              fallbackComponent={<View style={[xs.productImage, xs.iconFallback]}><Icon name="cube-outline" size={40} color={Colors.primary} /></View>}
            />
          ) : (
            <View style={[xs.productImage, xs.iconFallback]}><Icon name="cube-outline" size={40} color={Colors.primary} /></View>
          )}
          {item.is_featured && !isOutOfStock && (
            <View style={xs.featuredBadge}>
              <Icon name="star" size={10} color={Colors.textWhite} />
            </View>
          )}
          {hasDiscount && !isOutOfStock && (
            <View style={xs.discountBadge}>
              <Text style={xs.discountText}>
                {calculateDiscountPercentage(item.base_price || 0, item.sale_price || 0)}% {t('common.off')}
              </Text>
            </View>
          )}
          {isOutOfStock && (
            <View style={xs.outOfStockOverlay}>
              <Text style={xs.outOfStockText}>{t('products.outOfStock')}</Text>
            </View>
          )}
        </View>
        <View style={xs.productInfo}>
          <Text style={[xs.productTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
            {title || t('common.product')}
          </Text>
          <View style={xs.priceRow}>
            <Text style={[xs.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatCurrency(parsePrice(item.final_price ?? item.sale_price ?? item.base_price ?? 0), { isRTL })}
            </Text>
            {hasDiscount && !isOutOfStock && (
              <Text style={[xs.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {formatCurrency(parsePrice(item.base_price || 0), { isRTL })}
              </Text>
            )}
          </View>
          {!isOutOfStock && (
            <View style={xs.quickAddBtn}>
              <Icon name="add" size={14} color={Colors.textWhite} />
              <Text style={xs.quickAddText}>{t('products.quickAdd') || 'Add'}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderGridProduct = (item: Product, index: number) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    const hasDiscount = item.sale_price && item.sale_price < item.base_price;
    const isOutOfStock = item.stock_status === 'out_of_stock';

    return (
      <TouchableOpacity
        key={`grid-${item.id || index}`}
        style={xs.gridProductCard}
        onPress={() => handleProductPress(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
      >
        <View style={xs.gridProductImageWrap}>
          {item.main_image && !failedImagesRef.current.has(`product-${item.id}`) ? (
            <CachedImage
              uri={ApiService.getImageUrl(item.main_image)}
              style={xs.gridProductImage}
              resizeMode="cover"
              showLoadingIndicator
              onError={() => failedImagesRef.current.add(`product-${item.id}`)}
              fallbackComponent={<View style={[xs.gridProductImage, xs.iconFallback]}><Icon name="cube-outline" size={36} color={Colors.primary} /></View>}
            />
          ) : (
            <View style={[xs.gridProductImage, xs.iconFallback]}><Icon name="cube-outline" size={36} color={Colors.primary} /></View>
          )}
          {hasDiscount && !isOutOfStock && (
            <View style={xs.discountBadge}>
              <Text style={xs.discountText}>
                {calculateDiscountPercentage(item.base_price || 0, item.sale_price || 0)}%
              </Text>
            </View>
          )}
          {isOutOfStock && (
            <View style={xs.outOfStockOverlay}>
              <Text style={xs.outOfStockText}>{t('products.outOfStock')}</Text>
            </View>
          )}
        </View>
        <View style={xs.gridProductInfo}>
          <Text style={[xs.gridProductTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
            {title || t('common.product')}
          </Text>
          <View style={xs.priceRow}>
            <Text style={[xs.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatCurrency(parsePrice(item.final_price ?? item.sale_price ?? item.base_price ?? 0), { isRTL })}
            </Text>
          </View>
          {hasDiscount && !isOutOfStock && (
            <Text style={[xs.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatCurrency(parsePrice(item.base_price || 0), { isRTL })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferCard = (item: Offer, index: number) => {
    const title = currentLanguage === 'ar'
      ? item.title_ar || item.title_en || item.title || t('offers.defaultTitle')
      : item.title_en || item.title_ar || item.title || t('offers.defaultTitle');
    const description = currentLanguage === 'ar'
      ? item.description_ar || item.description_en || item.description || ''
      : item.description_en || item.description_ar || item.description || '';
    const imageSource = item.featured_image || item.banner_image || item.image_url;
    const imageKey = `offer-${item.id}`;

    return (
      <TouchableOpacity
        key={`offer-${item.id || index}`}
        style={xs.offerCard}
        onPress={() => handleOfferPress(item)}
        activeOpacity={0.7}
      >
        {imageSource && !failedImagesRef.current.has(imageKey) ? (
          <CachedImage
            uri={ApiService.getImageUrl(imageSource)}
            style={xs.offerImage}
            resizeMode="cover"
            showLoadingIndicator
            onError={() => failedImagesRef.current.add(imageKey)}
            fallbackComponent={<View style={[xs.offerImage, xs.offerFallback]}><Icon name="gift-outline" size={36} color={Colors.primary} /></View>}
          />
        ) : (
          <View style={[xs.offerImage, xs.offerFallback]}><Icon name="gift-outline" size={36} color={Colors.primary} /></View>
        )}
        <View style={xs.offerInfo}>
          <Text style={[xs.offerTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>{title}</Text>
          {description ? (
            <Text style={[xs.offerDesc, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={3}>{description}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Section header ──
  const SectionHeader = ({ title, subtitle, onViewAll }: { title: string; subtitle?: string; onViewAll?: () => void }) => (
    <View style={[xs.sectionHeader, isRTL && xs.sectionHeaderRTL]}>
      <View style={{ flex: 1 }}>
        <Text style={[xs.sectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>{title}</Text>
        {subtitle ? <Text style={[xs.sectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>{subtitle}</Text> : null}
      </View>
      {onViewAll && (
        <TouchableOpacity style={[xs.viewAllBtn, isRTL && xs.viewAllBtnRTL]} onPress={onViewAll}>
          <Text style={xs.viewAllText}>{t('home.viewAll') || 'View All'}</Text>
          <Icon name={currentLanguage === 'ar' ? 'chevron-back' : 'chevron-forward'} size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={xs.container}>
        <View style={xs.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={xs.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──
  return (
    <SafeAreaView style={xs.container}>
      <ScrollView
        style={xs.scrollView}
        contentContainerStyle={xs.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
      >
        {/* Search */}
        <View style={xs.searchSection}>
          <SearchBar
            placeholder={t('home.searchProducts')}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        {/* Search results */}
        {searchQuery.trim().length > 0 && (
          <View style={xs.searchResultsBox}>
            <View style={[xs.sectionHeader, isRTL && xs.sectionHeaderRTL]}>
              <View style={{ flex: 1 }}>
                <Text style={[xs.sectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.searchResults')} "{searchQuery}"
                </Text>
                <Text style={[xs.sectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {isSearching ? t('common.searching') : searchResults.length > 0 ? `${searchResults.length} ${t('common.itemsFound')}` : t('home.noSearchResults')}
                </Text>
              </View>
              <TouchableOpacity style={xs.clearSearchBtn} onPress={clearSearch}>
                <Icon name="close" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {isSearching ? (
              <View style={xs.searchLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={xs.searchLoadingText}>{t('common.searching')}</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={xs.hScroll}>
                {searchResults.map((item, i) => renderProductCard(item, i))}
              </ScrollView>
            ) : (
              <View style={xs.noResults}>
                <Icon name="search-outline" size={44} color={Colors.borderLight} />
                <Text style={xs.noResultsText}>{t('home.noSearchResults')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Banner slider — uses bare ScrollView, no FlatList */}
        {banners.length > 0 && (
          <View style={xs.bannerSection}>
            <Text style={[xs.sectionTitle, { textAlign: 'left', writingDirection: 'ltr', paddingHorizontal: Spacing.lg }]}>
              {t('home.featuredOffers') || 'Featured Offers'}
            </Text>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              pagingEnabled={false}
              snapToInterval={XS_BANNER_SNAP_INTERVAL}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={xs.bannerScroll}
              onScrollBeginDrag={stopAutoSlide}
              onMomentumScrollEnd={(e) => {
                onBannerScroll(e);
                resetAutoSlide();
              }}
              scrollEventThrottle={16}
            >
              {banners.map((item, i) => renderBanner(item, i))}
            </ScrollView>
            {banners.length > 1 && (
              <View style={xs.bannerDots}>
                {banners.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      bannerIndexRef.current = i;
                      setCurrentBannerIndex(i);
                      bannerScrollRef.current?.scrollTo({ x: i * XS_BANNER_SNAP_INTERVAL, animated: true });
                      resetAutoSlide();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    activeOpacity={0.7}
                  >
                    <View style={[xs.dot, i === currentBannerIndex && xs.activeDot]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Special Deals */}
        {(featuredOffers.length > 0 || offersError) && (
          <View style={xs.section}>
            <SectionHeader
              title={t('home.specialDeals')}
              subtitle={t('home.specialDealsDesc')}
              onViewAll={() => navigation.navigate('Offers')}
            />
            {offersError && featuredOffers.length === 0 ? (
              <View style={xs.errorBox}>
                <Text style={xs.errorText}>{t('home.offersUnavailable')}</Text>
                <TouchableOpacity onPress={loadHomeData} style={xs.retryBtn}>
                  <Text style={xs.retryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : featuredOffers.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={xs.hScroll}>
                {featuredOffers.map((item, i) => renderOfferCard(item, i))}
              </ScrollView>
            ) : null}
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={xs.section}>
            <SectionHeader
              title={t('home.shopByCategory')}
              subtitle={t('home.exploreCategories')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={xs.hScroll}>
              {categories.map((item, i) => renderCategory(item, i))}
            </ScrollView>
          </View>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <View style={xs.section}>
            <SectionHeader
              title={t('home.topProducts') || 'Top Products'}
              subtitle={t('home.topProductsDesc') || "Best selling products you'll love"}
              onViewAll={() => navigation.navigate('Products', { sort: 'sort_order', order: 'asc', sectionTitle: t('home.topProducts') || 'Top Products' })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={xs.hScroll}>
              {topProducts.map((item, i) => renderProductCard(item, i))}
            </ScrollView>
          </View>
        )}

        {/* New Arrivals */}
        {recentProducts.length > 0 && (
          <View style={xs.section}>
            <SectionHeader
              title={t('home.newArrivals') || 'New Arrivals'}
              subtitle={t('home.latestProducts') || 'Fresh products just added'}
              onViewAll={() => navigation.navigate('Products', { sort: 'created_at', order: 'desc', sectionTitle: t('home.newArrivals') || 'New Arrivals' })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={xs.hScroll}>
              {recentProducts.map((item, i) => renderProductCard(item, i))}
            </ScrollView>
          </View>
        )}

        {/* Browse All Products — grid */}
        {allProducts.length > 0 && (
          <View style={xs.section}>
            <SectionHeader
              title={t('home.browseAllProducts') || 'Browse All Products'}
              subtitle={t('home.browseAllProductsDesc') || 'Explore our complete product catalog'}
            />
            <View style={xs.productGrid}>
              {allProducts.map((item, i) => (
                <View key={`all-${item.id || i}`} style={xs.gridItem}>
                  {renderGridProduct(item, i)}
                </View>
              ))}
              {allProductsLoading && (
                <View style={xs.loadingMore}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={xs.loadingMoreText}>{t('common.loadingMore', 'Loading more...')}</Text>
                </View>
              )}
              {!allProductsLoading && allProductsHasMore && (
                <TouchableOpacity style={xs.loadMoreBtn} onPress={loadMoreAllProducts}>
                  <Text style={xs.loadMoreText}>{t('common.loadMore', 'Load More')}</Text>
                  <Icon name="chevron-down" size={18} color={Colors.primary} />
                </TouchableOpacity>
              )}
              {!allProductsLoading && !allProductsHasMore && allProducts.length > 0 && (
                <View style={xs.endOfProducts}>
                  <Text style={xs.endOfProductsText}>{t('common.endOfProducts', "You've seen all products")}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!loading && !searchQuery && banners.length === 0 && categories.length === 0 && topProducts.length === 0 && (
          <View style={xs.emptyState}>
            <Icon name="storefront-outline" size={70} color="#ccc" />
            <Text style={xs.emptyText}>{t('home.noDataAvailable')}</Text>
            <Text style={xs.emptySubtext}>{t('home.pullToRefresh') || 'Pull down to refresh and check for new content'}</Text>
            <TouchableOpacity style={xs.retryBtn} onPress={loadHomeData}>
              <Text style={xs.retryText}>{t('common.refresh')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Skeleton while loading */}
        {loading && (
          <View style={xs.skeletonContainer}>
            {[1, 2, 3].map(i => (
              <View key={i} style={xs.skeletonSection}>
                <View style={xs.skeletonTitle} />
                <View style={xs.skeletonRow}>
                  {[1, 2, 3].map(j => <View key={j} style={xs.skeletonCard} />)}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles tuned for iPhone XS (375×812) ──

const xs = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },

  // Search
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchResultsBox: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  clearSearchBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundLight,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  searchLoadingText: {
    marginStart: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noResultsText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    fontFamily: Typography.fontFamily.medium,
  },

  // Section layout
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryBackground,
  },
  viewAllBtnRTL: {
    flexDirection: 'row-reverse',
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
    marginEnd: Spacing.xs,
  },
  hScroll: {
    paddingLeft: 0,
    gap: 10,
  },

  // Banner — sized for 375pt
  bannerSection: {
    marginBottom: Spacing.xl,
  },
  bannerScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bannerCard: {
    width: XS_BANNER_CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.borderLight || '#E5E7EB',
  },
  bannerImageWrap: {
    width: XS_BANNER_CARD_WIDTH,
    height: XS_BANNER_IMAGE_HEIGHT,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  bannerFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundLight,
  },
  bannerInfo: {
    padding: 10,
    backgroundColor: Colors.backgroundCard,
  },
  bannerTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 15,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.xs,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 24,
  },

  // Categories — compact for XS
  categoryItem: {
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    width: XS_CATEGORY_SIZE,
  },
  categoryImageWrap: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.backgroundCard,
    marginBottom: Spacing.sm,
    padding: Spacing.xs,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.lg,
    resizeMode: 'cover',
  } as ImageStyle,
  categoryText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
  },
  categoryCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: Typography.fontFamily.regular,
  },

  // Product card — horizontal lists
  productCard: {
    width: XS_PRODUCT_CARD_WIDTH,
    marginHorizontal: Spacing.xs,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
  },
  productImageWrap: {
    position: 'relative',
    width: '100%',
    height: 125,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  } as ImageStyle,
  productInfo: {
    padding: Spacing.sm,
  },
  productTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    minHeight: 28,
    fontFamily: Typography.fontFamily.medium,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  currentPrice: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  originalPrice: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textHint,
    textDecorationLine: 'line-through',
    marginStart: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  quickAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontWeight: Typography.fontWeight.medium,
    marginStart: 4,
    fontFamily: Typography.fontFamily.medium,
  },

  // Badges
  featuredBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: Colors.star,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
    fontFamily: Typography.fontFamily.bold,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontWeight: Typography.fontWeight.bold,
    fontFamily: Typography.fontFamily.bold,
  },

  // Offers
  offerCard: {
    width: XS_OFFER_CARD_WIDTH,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  offerImage: {
    width: '100%',
    height: 125,
  },
  offerFallback: {
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerInfo: {
    padding: Spacing.sm,
    gap: 4,
  },
  offerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  offerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 16,
  },

  // Grid products
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xs,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  gridProductCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  gridProductImageWrap: {
    position: 'relative',
    width: '100%',
    height: 145,
    backgroundColor: Colors.primaryBackground,
  },
  gridProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  } as ImageStyle,
  gridProductInfo: {
    padding: Spacing.sm,
  },
  gridProductTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    minHeight: 32,
    fontFamily: Typography.fontFamily.medium,
  },
  iconFallback: {
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Error / retry
  errorBox: {
    backgroundColor: Colors.errorBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: Spacing.xs,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontFamily: Typography.fontFamily.medium,
  },

  // Load more
  loadingMore: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingMoreText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  loadMoreBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primaryBackground,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  loadMoreText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.medium,
  },
  endOfProducts: {
    width: '100%',
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  endOfProductsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textHint,
    fontFamily: Typography.fontFamily.regular,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['6xl'],
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  emptyText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.base,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },
  emptySubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textHint,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },

  // Skeleton
  skeletonContainer: {
    paddingHorizontal: Spacing.lg,
  },
  skeletonSection: {
    marginBottom: Spacing.xl,
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    width: '40%',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  skeletonCard: {
    width: 130,
    height: 180,
    backgroundColor: '#e0e0e0',
    borderRadius: BorderRadius.md,
  },
});

export default HomeScreenXS;
