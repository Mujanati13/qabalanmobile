import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  ImageStyle,
  I18nManager,
  Platform,
  Alert,
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

const { width: screenWidth } = Dimensions.get('window');
const BANNER_WIDTH = screenWidth - 40;
const BANNER_HEIGHT = BANNER_WIDTH * 0.50; // Original size with moderate height

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { isRTL: contextIsRTL, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { unreadCount } = useNotification();
  
  // FORCE LTR LAYOUT: Override isRTL to always be false for touch handling on iOS
  const isRTL = false; // Always false to force left-to-right LAYOUT
  const isArabic = currentLanguage === 'ar'; // Use for Arabic TEXT direction only
  
  // Local language state for CSS text direction
  const [language, setLanguage] = useState(currentLanguage);
  // Use proper text alignment based on language - Arabic text should be RTL
  const textAlign = isArabic ? 'right' : 'left';
  const textDirection = isArabic ? 'rtl' : 'ltr';
  
  // Sync with context language changes
  useEffect(() => {
    console.log('[HomeScreen] Language changed:', currentLanguage, 'isArabic:', isArabic);
    console.log('[HomeScreen] Setting textAlign to:', textAlign, 'textDirection:', textDirection);
    console.log('[HomeScreen] Setting textDirection to: ltr (always)');
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
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [offersError, setOffersError] = useState<string>('');

  // Auto-slide refs and state
  const bannerFlatListRef = useRef<FlatList>(null);
  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSlideInterval, setAutoSlideInterval] = useState(3000); // 3 seconds default
  const [isAutoSlideEnabled, setIsAutoSlideEnabled] = useState(true);

  // All products infinite scroll state
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allProductsPage, setAllProductsPage] = useState(1);
  const [allProductsLoading, setAllProductsLoading] = useState(false);
  const [allProductsHasMore, setAllProductsHasMore] = useState(true);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      setLoading(true);
      
      const [bannersRes, categoriesRes, featuredRes, homeTopRes, homeNewRes, offersRes] = await Promise.all([
        ApiService.getBannerCategories(),
        ApiService.getTopCategories(50), // Increased from 8 to 50 to load all categories
        ApiService.getFeaturedProducts(6),
        ApiService.getHomeTopProducts(6),
        ApiService.getHomeNewProducts(6),
        ApiService.getFeaturedOffers(6),
      ]);

      if (bannersRes.success && bannersRes.data && Array.isArray(bannersRes.data)) {
        setBanners(bannersRes.data);
      } else {
        setBanners([]);
      }

      if (categoriesRes.success && categoriesRes.data && Array.isArray(categoriesRes.data)) {
        setCategories(categoriesRes.data);
      } else {
        setCategories([]);
      }

      if (featuredRes.success && featuredRes.data && Array.isArray(featuredRes.data)) {
        setFeaturedProducts(featuredRes.data);
      } else {
        setFeaturedProducts([]);
      }

      if (offersRes.success && offersRes.data && Array.isArray(offersRes.data)) {
        console.log('✅ Featured offers loaded:', offersRes.data.length, 'items');
        setFeaturedOffers(offersRes.data);
        setOffersError('');
      } else {
        console.warn('⚠️ Offers response issue:', offersRes);
        setFeaturedOffers([]);
        setOffersError(offersRes.message || t('home.offersUnavailable', 'Offers are temporarily unavailable.'));
      }

      let resolvedTopProducts: Product[] = [];
      if (homeTopRes.success && homeTopRes.data && Array.isArray(homeTopRes.data)) {
        resolvedTopProducts = homeTopRes.data;
      }

      if (resolvedTopProducts.length === 0) {
        const fallbackTopRes = await ApiService.getProducts({ limit: 6, sort: 'sort_order', order: 'asc' });
        if (fallbackTopRes.success && fallbackTopRes.data && Array.isArray(fallbackTopRes.data)) {
          resolvedTopProducts = fallbackTopRes.data;
        }
      }

      setTopProducts(resolvedTopProducts);

      let resolvedNewProducts: Product[] = [];
      if (homeNewRes.success && homeNewRes.data && Array.isArray(homeNewRes.data)) {
        resolvedNewProducts = homeNewRes.data;
      }

      if (resolvedNewProducts.length === 0) {
        const fallbackNewRes = await ApiService.getProducts({ limit: 6, sort: 'created_at', order: 'desc' });
        if (fallbackNewRes.success && fallbackNewRes.data && Array.isArray(fallbackNewRes.data)) {
          resolvedNewProducts = fallbackNewRes.data;
        }
      }

      setRecentProducts(resolvedNewProducts);
    } catch (error) {
      console.error('Error loading home data:', error);
      // Reset arrays to empty on error to prevent undefined length errors
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

  // Auto-slide functionality
  const startAutoSlide = () => {
    if (!isAutoSlideEnabled || banners.length <= 1) return;
    
    stopAutoSlide(); // Clear any existing timer
    
    autoSlideTimerRef.current = setInterval(() => {
      setCurrentBannerIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % banners.length;
        
        // Scroll to next banner
        if (bannerFlatListRef.current) {
          bannerFlatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        }
        
        return nextIndex;
      });
    }, autoSlideInterval);
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

  // Start auto-slide when banners are loaded and component is focused
  useEffect(() => {
    if (banners.length > 1 && isAutoSlideEnabled) {
      startAutoSlide();
    }
    
    return () => stopAutoSlide();
  }, [banners, autoSlideInterval, isAutoSlideEnabled]);

  // Stop auto-slide when component loses focus
  useFocusEffect(
    React.useCallback(() => {
      if (banners.length > 1 && isAutoSlideEnabled) {
        startAutoSlide();
      }
      
      return () => stopAutoSlide();
    }, [banners, autoSlideInterval, isAutoSlideEnabled])
  );

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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await ApiService.getProducts({
        search: query.trim(),
        limit: 20,
      });

      if (response.success && response.data && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
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

  // Load all products for infinite scroll
  const loadAllProducts = async (page: number = 1) => {
    if (allProductsLoading || (!allProductsHasMore && page > 1)) return;

    try {
      setAllProductsLoading(true);
      const response = await ApiService.getProducts({
        page,
        limit: 10,
        sort: 'created_at',
        order: 'desc',
      });

      if (response.success && response.data && Array.isArray(response.data)) {
        if (page === 1) {
          setAllProducts(response.data);
        } else {
          setAllProducts((prev) => [...prev, ...response.data]);
        }
        
        // Check if there are more products to load
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

  // Load initial batch of all products
  useEffect(() => {
    loadAllProducts(1);
  }, []);

  // Navigation handlers - defined directly to avoid stale closure issues
  const handleBannerPress = (item: Category) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    try {
      console.log('[HomeScreen] Banner pressed:', item.id, title);
      navigation.navigate('Products', { 
        categoryId: item.id, 
        categoryName: title || 'Category'
      });
    } catch (error) {
      console.error('[HomeScreen] Banner navigation error:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('home.navigationError') || 'Unable to open this section. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  const handleCategoryPress = (item: Category) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    try {
      console.log('[HomeScreen] Category pressed:', item.id, title);
      navigation.navigate('Products', { 
        categoryId: item.id, 
        categoryName: title || 'Category'
      });
    } catch (error) {
      console.error('[HomeScreen] Category navigation error:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('home.navigationError') || 'Unable to open this category. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  const handleProductPress = (item: Product) => {
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    try {
      console.log('[HomeScreen] Product pressed:', item.id, title);
      navigation.navigate('ProductDetails', { productId: item.id });
    } catch (error) {
      console.error('[HomeScreen] Product navigation error:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('home.navigationError') || 'Unable to open this product. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  const handleOfferPressAction = (offer: Offer) => {
    try {
      console.log('[HomeScreen] Offer pressed:', offer.id);
      navigation.navigate('Offers');
    } catch (error) {
      console.error('[HomeScreen] Offer navigation error:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('home.navigationError') || 'Unable to open offers. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  // Memoized render functions for optimal FlatList performance
  const renderBannerItem = useCallback(({ item, index }: { item: Category; index: number }) => {
    if (!item || typeof item !== 'object') return null;
    
    const bannerImage = item.banner_mobile || item.banner_image || item.image;
    // Use currentLanguage instead of isRTL to determine which text to show
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    
    console.log('[HomeScreen] renderBannerItem - language:', language, 'textAlign:', textAlign, 'textDirection:', textDirection, 'title:', title);

    return (
      <TouchableOpacity
        style={styles.bannerContainer}
        onPress={() => handleBannerPress(item)}
        activeOpacity={0.8}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {bannerImage && !failedImages.has(`banner-${item.id}`) ? (
          <CachedImage
            uri={bannerImage}
            style={styles.bannerImage}
            resizeMode="contain"
            pointerEvents="none"
            showLoadingIndicator={true}
            onError={() => {
              setFailedImages(prev => new Set(prev).add(`banner-${item.id}`));
            }}
            fallbackComponent={
              <View style={[styles.bannerImage, styles.bannerIconFallback]}>
                <Icon name="image-outline" size={60} color={Colors.primary} />
              </View>
            }
          />
        ) : (
          <View style={[styles.bannerImage, styles.bannerIconFallback]}>
            <Icon name="image-outline" size={60} color={Colors.primary} />
          </View>
        )}
        <View style={[styles.bannerOverlay, isRTL && styles.rtlBannerOverlay]} pointerEvents="none">
          <Text style={[styles.bannerTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {title || t('common.category')}
          </Text>
          {(item.description_ar || item.description_en) ? (
            <Text style={[styles.bannerDescription, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {currentLanguage === 'ar' ? (item.description_ar || item.description_en || '') : (item.description_en || item.description_ar || '')}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [isRTL, t, failedImages, navigation, textDirection, currentLanguage]);

  const renderCategoryItem = useCallback(({ item }: { item: Category }) => {
    if (!item || typeof item !== 'object') return null;
    
    // Use currentLanguage instead of isRTL to determine which text to show
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    
    return (
      <TouchableOpacity
        style={[styles.categoryItem, isRTL && styles.rtlCategoryItem]}
        onPress={() => handleCategoryPress(item)}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.categoryImageContainer} pointerEvents="box-none">
          {item.image && !failedImages.has(`category-${item.id}`) ? (
            <CachedImage
              uri={item.image}
              style={styles.categoryImage}
              resizeMode="cover"
              pointerEvents="none"
              showLoadingIndicator={true}
              loadingIndicatorSize="small"
              onError={() => {
                setFailedImages(prev => new Set(prev).add(`category-${item.id}`));
              }}
              fallbackComponent={
                <View style={[styles.categoryImage, styles.categoryIconFallback]}>
                  <Icon name="grid-outline" size={40} color={Colors.primary} />
                </View>
              }
            />
          ) : (
            <View style={[styles.categoryImage, styles.categoryIconFallback]}>
              <Icon name="grid-outline" size={40} color={Colors.primary} />
            </View>
          )}
        </View>
        <Text style={[styles.categoryText, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
          {title || t('common.category')}
        </Text>
        {(item.products_count && item.products_count > 0) && (
          <Text style={[styles.productCount, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {item.products_count || 0} {t('common.items')}
          </Text>
        )}
      </TouchableOpacity>
    );
  }, [isRTL, t, failedImages, navigation, textDirection, currentLanguage]);

  const renderProductItem = useCallback(({ item }: { item: Product }) => {
    if (!item || typeof item !== 'object') return null;
    
    // Use currentLanguage instead of isRTL to determine which text to show
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    const hasDiscount = item.sale_price && item.sale_price < item.base_price;
    // Only disable if truly out of stock, allow limited availability
    const isOutOfStock = item.stock_status === 'out_of_stock';

    return (
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => handleProductPress(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.productImageContainer} pointerEvents="box-none">
          {item.main_image && !failedImages.has(`product-${item.id}`) ? (
            <CachedImage
              uri={ApiService.getImageUrl(item.main_image)}
              style={styles.productImage}
              resizeMode="cover"
              pointerEvents="none"
              showLoadingIndicator={true}
              loadingIndicatorSize="small"
              onError={() => {
                setFailedImages(prev => new Set(prev).add(`product-${item.id}`));
              }}
              fallbackComponent={
                <View style={[styles.productImage, styles.productIconFallback]}>
                  <Icon name="cube-outline" size={50} color={Colors.primary} />
                </View>
              }
            />
          ) : (
            <View style={[styles.productImage, styles.productIconFallback]}>
              <Icon name="cube-outline" size={50} color={Colors.primary} />
              </View>
            )}
            {item.is_featured && !isOutOfStock && (
              <View style={[styles.featuredBadge, isRTL && styles.rtlFeaturedBadge]} pointerEvents="none">
                <Icon name="star" size={12} color={Colors.textWhite} />
              </View>
            )}
            {hasDiscount && !isOutOfStock && (
              <View style={[styles.discountBadge, isRTL && styles.rtlDiscountBadge]} pointerEvents="none">
                <Text style={[styles.discountText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {calculateDiscountPercentage(item.base_price || 0, item.sale_price || 0)}% {t('common.off')}
                </Text>
              </View>
            )}
            {isOutOfStock && (
              <View style={styles.outOfStockOverlay} pointerEvents="none">
                <Text style={[styles.outOfStockBadgeText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.outOfStock')}</Text>
              </View>
            )}
          </View>
          
          <View style={[styles.productInfo, isRTL && styles.rtlProductInfo]}>
            <Text style={[styles.productTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
              {title || t('common.product')}
            </Text>
            
            <View style={[styles.priceContainer, isRTL && styles.rtlPriceContainer]}>
              <Text style={[styles.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {formatCurrency(parsePrice(item.final_price ?? item.sale_price ?? item.base_price ?? 0), { isRTL })}
              </Text>
              {hasDiscount && !isOutOfStock && (
                <Text style={[styles.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {formatCurrency(parsePrice(item.base_price || 0), { isRTL })}
                </Text>
              )}
            </View>

            {/* Quick Add Button for In-Stock Items */}
            {!isOutOfStock && (
              <View style={[styles.quickAddButton, isRTL && styles.rtlQuickAddButton]} pointerEvents="none">
                <Icon name="add" size={16} color={Colors.textWhite} />
                <Text style={[styles.quickAddText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.quickAdd') || 'Add'}</Text>
              </View>
            )}
          </View>
      </TouchableOpacity>
    );
  }, [isRTL, t, failedImages, navigation, calculateDiscountPercentage, parsePrice, textDirection, currentLanguage]);

  const renderGridProductItem = useCallback(({ item, index }: { item: Product; index: number }) => {
    if (!item || typeof item !== 'object') return null;
    
    const title = currentLanguage === 'ar' ? (item.title_ar || item.title_en || '') : (item.title_en || item.title_ar || '');
    const hasDiscount = item.sale_price && item.sale_price < item.base_price;
    const isOutOfStock = item.stock_status === 'out_of_stock';

    return (
      <TouchableOpacity
        style={styles.gridProductItem}
        onPress={() => handleProductPress(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
      >
        <View style={styles.gridProductImageContainer}>
          {item.main_image && !failedImages.has(`product-${item.id}`) ? (
            <CachedImage
              uri={ApiService.getImageUrl(item.main_image)}
              style={styles.gridProductImage}
              resizeMode="cover"
              showLoadingIndicator={true}
              loadingIndicatorSize="small"
              onError={() => {
                setFailedImages(prev => new Set(prev).add(`product-${item.id}`));
              }}
              fallbackComponent={
                <View style={[styles.gridProductImage, styles.productIconFallback]}>
                  <Icon name="cube-outline" size={40} color={Colors.primary} />
                </View>
              }
            />
          ) : (
            <View style={[styles.gridProductImage, styles.productIconFallback]}>
              <Icon name="cube-outline" size={40} color={Colors.primary} />
            </View>
          )}
          {item.is_featured && !isOutOfStock && (
            <View style={[styles.featuredBadge, isRTL && styles.rtlFeaturedBadge]} pointerEvents="none">
              <Icon name="star" size={10} color={Colors.textWhite} />
            </View>
          )}
          {hasDiscount && !isOutOfStock && (
            <View style={[styles.discountBadge, isRTL && styles.rtlDiscountBadge]} pointerEvents="none">
              <Text style={[styles.discountText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {calculateDiscountPercentage(item.base_price || 0, item.sale_price || 0)}%
              </Text>
            </View>
          )}
          {isOutOfStock && (
            <View style={styles.outOfStockOverlay} pointerEvents="none">
              <Text style={[styles.outOfStockBadgeText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.outOfStock')}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.gridProductInfo}>
          <Text style={[styles.gridProductTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
            {title || t('common.product')}
          </Text>
          
          <View style={[styles.priceContainer, isRTL && styles.rtlPriceContainer]}>
            <Text style={[styles.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatCurrency(parsePrice(item.final_price ?? item.sale_price ?? item.base_price ?? 0), { isRTL })}
            </Text>
          </View>
          {hasDiscount && !isOutOfStock && (
            <Text style={[styles.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatCurrency(parsePrice(item.base_price || 0), { isRTL })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [isRTL, t, failedImages, currentLanguage, calculateDiscountPercentage, parsePrice]);

  const renderOfferCard = useCallback(({ item }: { item: Offer }) => {
    if (!item || typeof item !== 'object') return null;

    // Use currentLanguage instead of isRTL to determine which text to show
    const title = currentLanguage === 'ar'
      ? item.title_ar || item.title_en || item.title || t('offers.defaultTitle')
      : item.title_en || item.title_ar || item.title || t('offers.defaultTitle');
    const description = currentLanguage === 'ar'
      ? item.description_ar || item.description_en || item.description || ''
      : item.description_en || item.description_ar || item.description || '';
    const imageSource = item.featured_image || item.banner_image || item.image_url;
    const imageKey = `offer-${item.id}`;
    const startDate = item.valid_from ? new Date(item.valid_from) : item.start_date ? new Date(item.start_date) : null;
    const endDate = item.valid_until ? new Date(item.valid_until) : item.end_date ? new Date(item.end_date) : null;

    return (
      <TouchableOpacity 
        style={styles.offerCard}
        onPress={() => handleOfferPressAction(item)}
        activeOpacity={0.7}
        delayPressIn={0}
        delayPressOut={0}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {imageSource && !failedImages.has(imageKey) ? (
          <CachedImage
            uri={ApiService.getImageUrl(imageSource)}
            style={styles.offerImage}
            resizeMode="cover"
            pointerEvents="none"
            showLoadingIndicator={true}
            loadingIndicatorSize="small"
            onError={() => {
              setFailedImages((prev) => new Set(prev).add(imageKey));
            }}
            fallbackComponent={
              <View style={[styles.offerImage, styles.offerImageFallback]}>
                <Icon name="gift-outline" size={40} color={Colors.primary} />
              </View>
            }
          />
        ) : (
          <View style={[styles.offerImage, styles.offerImageFallback]}>
            <Icon name="gift-outline" size={40} color={Colors.primary} />
          </View>
        )}

        <View style={[styles.offerInfo, isRTL && styles.rtlOfferInfo]}>
          <Text style={[styles.offerTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
            {title}
          </Text>
          {description ? (
            <Text style={[styles.offerDescription, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={3}>
              {description}
            </Text>
          ) : null}

          <View style={[styles.offerMeta, isRTL && styles.rtlOfferMeta]}>
            {item.code ? (
              <View style={[styles.offerBadge, isRTL && styles.rtlOfferBadge]}>
                <Text style={[styles.offerBadgeLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('offers.promoCode')}</Text>
                <Text style={[styles.offerBadgeValue, { textAlign: 'left', writingDirection: 'ltr' }]}>{item.code}</Text>
              </View>
            ) : null}
            {(startDate || endDate) && (
              <Text style={[styles.offerDates, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {startDate ? startDate.toLocaleDateString() : t('offers.availableNow')}
                {endDate ? ` – ${endDate.toLocaleDateString()}` : ''}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isRTL, t, failedImages, textDirection, currentLanguage]);

  // Memoized key extractor for offers
  const offerKeyExtractor = useCallback((item: Offer, index: number) => {
    return item?.id?.toString() || `offer-${index}`;
  }, []);

  // Memoized key extractors for all FlatLists
  const bannerKeyExtractor = useCallback((item: Category, index: number) => {
    return item?.id?.toString() || `banner-${index}`;
  }, []);

  const categoryKeyExtractor = useCallback((item: Category, index: number) => {
    return item?.id?.toString() || `category-${index}`;
  }, []);

  const productKeyExtractor = useCallback((item: Product, index: number) => {
    return item?.id?.toString() || `product-${index}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, isRTL && styles.rtlText]}>{t('common.loading')}</Text>
      </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Search Section */}
        <View style={[styles.searchHeaderSection, isRTL && styles.rtlSearchHeaderSection]}>
          <SearchBar
            placeholder={t('home.searchProducts')}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
            {/* Enhanced Search Results */}
            {searchQuery.trim().length > 0 && (
          <View style={styles.modernSearchResultsSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.searchResults')} "{searchQuery}"
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {isSearching 
                    ? t('common.searching') 
                    : searchResults.length > 0 
                      ? `${searchResults.length} ${t('common.itemsFound')}` 
                      : t('home.noSearchResults')
                  }
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.modernClearButton, isRTL && styles.rtlRowReverse]}
                onPress={clearSearch}
              >
                <Icon name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {isSearching ? (
              <View style={[styles.modernSearchLoadingContainer, isRTL && styles.rtlModernSearchLoadingContainer]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={[styles.modernSearchLoadingText, isRTL && styles.rtlModernSearchLoadingText]}>{t('common.searching')}</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults || []}
                renderItem={renderProductItem}
                keyExtractor={productKeyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={styles.modernProductsList}
                removeClippedSubviews={false}
                nestedScrollEnabled={true}
                maxToRenderPerBatch={4}
                windowSize={6}
                extraData={currentLanguage}
              />
            ) : (
              <View style={styles.modernNoResultsContainer}>
                <Icon name="search-outline" size={48} color={Colors.borderLight} />
                <Text style={[styles.modernNoResultsText, isRTL && styles.rtlText]}>
                  {t('home.noSearchResults')}
                </Text>
                <Text style={[styles.modernNoResultsSubtext, isRTL && styles.rtlText]}>
                  {t('home.tryDifferentKeywords') || 'Try different keywords or browse categories'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Modern Banner Slider */}
        {(banners && banners.length > 0) && (
          <View style={styles.modernBannerSection}>
            <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('home.featuredOffers') || 'Featured Offers'}
            </Text>
            <FlatList
              ref={bannerFlatListRef}
              data={banners || []}
              renderItem={renderBannerItem}
              keyExtractor={bannerKeyExtractor}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={BANNER_WIDTH + 20}
              decelerationRate="fast"
              contentContainerStyle={styles.modernBannerList}
              removeClippedSubviews={false}
              maxToRenderPerBatch={3}
              windowSize={5}
              extraData={currentLanguage}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              onScrollBeginDrag={() => {
                stopAutoSlide();
              }}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / (BANNER_WIDTH + 20));
                setCurrentBannerIndex(newIndex);
                resetAutoSlide();
              }}
              onScrollToIndexFailed={(info) => {
                console.log('Scroll to index failed:', info);
                setTimeout(() => {
                  if (bannerFlatListRef.current && info.index < banners.length) {
                    bannerFlatListRef.current.scrollToIndex({
                      index: info.index,
                      animated: false,
                    });
                  }
                }, 100);
              }}
            />
            {banners.length > 1 && (
              <View style={styles.modernBannerDots}>
                {banners.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.modernDot,
                      index === currentBannerIndex && styles.modernActiveDot
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Special Deals Section */}
        {(featuredOffers.length > 0 || offersError) && (
          <View style={styles.modernSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.specialDeals')}
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.specialDealsDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modernViewAllButton, isRTL && styles.rtlModernViewAllButton]}
                onPress={() => navigation.navigate('Offers')}
              >
                <Text style={[styles.modernViewAllText, isRTL && styles.rtlModernViewAllText]}>
                  {t('home.viewAll')}
                </Text>
                <Icon
                  name={currentLanguage === 'ar' ? 'chevron-back' : 'chevron-forward'}
                  size={16}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>

            {offersError && featuredOffers.length === 0 ? (
              <View style={styles.offersErrorContainer}>
                <Text style={[styles.offersErrorText, isRTL && styles.rtlText]}>{t('home.offersUnavailable')}</Text>
                <TouchableOpacity onPress={loadHomeData} style={styles.offersRetryButton}>
                  <Text style={styles.offersRetryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {featuredOffers.length > 0 ? (
              <FlatList
                data={featuredOffers}
                renderItem={renderOfferCard}
                keyExtractor={offerKeyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.offersList, isRTL && styles.rtlList]}
                removeClippedSubviews={false}
                nestedScrollEnabled={true}
                maxToRenderPerBatch={3}
                updateCellsBatchingPeriod={50}
                initialNumToRender={3}
                windowSize={5}
                extraData={currentLanguage}
              />
            ) : !offersError ? (
              <View style={styles.offersPlaceholder}>
                <Icon name="gift-outline" size={36} color={Colors.primary} />
                <Text style={[styles.offersPlaceholderText, isRTL && styles.rtlText]}>
                  {t('home.noOffers')}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Modern Categories Section */}
        {(categories && categories.length > 0) && (
          <View style={styles.modernSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.shopByCategory')}
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.exploreCategories')}
                </Text>
              </View>
            </View>
            
            <FlatList
              data={categories || []}
              renderItem={renderCategoryItem}
              keyExtractor={categoryKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              nestedScrollEnabled={true}
              maxToRenderPerBatch={8}
              windowSize={10}
              initialNumToRender={6}
              scrollEventThrottle={16}
              contentContainerStyle={styles.modernCategoriesList}
              extraData={currentLanguage}
            />
          </View>
        )}

        {/* Top Products Section */}
        {(topProducts && topProducts.length > 0) && (
          <View style={styles.modernSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.topProducts') || 'Top Products'}
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.topProductsDesc') || 'Best selling products you\'ll love'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.modernViewAllButton, isRTL && styles.rtlModernViewAllButton]}
                onPress={() => navigation.navigate('Products', { sort: 'sort_order', order: 'asc' })}
              >
                <Text style={[styles.modernViewAllText, isRTL && styles.rtlModernViewAllText]}>
                  {t('home.viewAll') || 'View All'}
                </Text>
                <Icon 
                  name={currentLanguage === 'ar' ? "chevron-back" : "chevron-forward"} 
                  size={16} 
                  color={Colors.primary} 
                />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={topProducts || []}
              renderItem={renderProductItem}
              keyExtractor={productKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              nestedScrollEnabled={true}
              maxToRenderPerBatch={4}
              windowSize={6}
              scrollEventThrottle={16}
              contentContainerStyle={styles.modernProductsList}
              extraData={currentLanguage}
            />
          </View>
        )}

        {/* Modern Featured Products Section - HIDDEN ON MOBILE */}
        {false && (
          (featuredProducts && featuredProducts.length > 0) && (
            <View style={styles.modernSection}>
              <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
                <View>
                  <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                    {t('home.recommendedForYou') || 'Recommended for You'}
                  </Text>
                  <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                    {t('home.featuredProductsDesc') || 'Handpicked products just for you'}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modernViewAllButton, isRTL && styles.rtlModernViewAllButton]}
                  onPress={() => navigation.navigate('Products', { featured: true })}
                >
                  <Text style={[styles.modernViewAllText, isRTL && styles.rtlModernViewAllText]}>
                    {t('home.viewAll') || 'View All'}
                  </Text>
                  <Icon 
                    name={currentLanguage === 'ar' ? "chevron-back" : "chevron-forward"} 
                    size={16} 
                    color={Colors.primary} 
                  />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={featuredProducts || []}
                renderItem={renderProductItem}
                keyExtractor={productKeyExtractor}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                removeClippedSubviews={false}
                nestedScrollEnabled={true}
                maxToRenderPerBatch={4}
                windowSize={6}
                contentContainerStyle={[styles.modernProductsList, isRTL && styles.rtlList]}
                extraData={currentLanguage}
              />
            </View>
          )
        )}

        {/* Modern Recent Products Section */}
        {(recentProducts && recentProducts.length > 0) && (
          <View style={styles.modernSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.newArrivals') || 'New Arrivals'}
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.latestProducts') || 'Fresh products just added'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.modernViewAllButton, isRTL && styles.rtlModernViewAllButton]}
                onPress={() => navigation.navigate('Products')}
              >
                <Text style={[styles.modernViewAllText, isRTL && styles.rtlModernViewAllText]}>
                  {t('home.viewAll') || 'View All'}
                </Text>
                <Icon 
                  name={currentLanguage === 'ar' ? "chevron-back" : "chevron-forward"} 
                  size={16} 
                  color={Colors.primary} 
                />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={recentProducts || []}
              renderItem={renderProductItem}
              keyExtractor={productKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              contentContainerStyle={[styles.modernProductsList, isRTL && styles.rtlList]}
              removeClippedSubviews={false}
              nestedScrollEnabled={true}
              maxToRenderPerBatch={4}
              windowSize={6}
              extraData={currentLanguage}
            />
          </View>
        )}

        {/* Browse All Products Section with Infinite Scroll */}
        {allProducts.length > 0 && (
          <View style={styles.modernSection}>
            <View style={[styles.modernSectionHeader, isRTL && styles.rtlModernSectionHeader]}>
              <View>
                <Text style={[styles.modernSectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.browseAllProducts') || 'Browse All Products'}
                </Text>
                <Text style={[styles.modernSectionSubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('home.browseAllProductsDesc') || 'Explore our complete product catalog'}
                </Text>
              </View>
            </View>
            
            <View style={styles.allProductsGrid}>
              {allProducts.map((product, index) => (
                <View key={`all-product-${allProductsPage}-${index}`} style={styles.allProductsGridItem}>
                  {renderGridProductItem({ item: product, index })}
                </View>
              ))}
              
              {/* Loading indicator for more products */}
              {allProductsLoading && (
                <View key="loading-indicator" style={styles.allProductsLoadingMore}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.loadingMoreText, isRTL && styles.rtlText]}>
                    {t('common.loadingMore', 'Loading more...')}
                  </Text>
                </View>
              )}
              
              {/* Load more button */}
              {!allProductsLoading && allProductsHasMore && (
                <TouchableOpacity
                  key="load-more-button"
                  style={styles.loadMoreButton}
                  onPress={loadMoreAllProducts}
                >
                  <Text style={styles.loadMoreButtonText}>
                    {t('common.loadMore', 'Load More')}
                  </Text>
                  <Icon name="chevron-down" size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}
              
              {/* End of products message */}
              {!allProductsLoading && !allProductsHasMore && allProducts.length > 0 && (
                <View key="end-of-products" style={styles.endOfProductsContainer}>
                  <Text style={[styles.endOfProductsText, isRTL && styles.rtlText]}>
                    {t('common.endOfProducts', 'You\'ve seen all products')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Empty State with Better UX */}
        {!loading && !searchQuery && banners.length === 0 && categories.length === 0 && featuredProducts.length === 0 && topProducts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="storefront-outline" size={80} color="#ccc" />
            <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('home.noDataAvailable')}</Text>
            <Text style={[styles.emptySubtext, isRTL && styles.rtlText]}>
              {t('home.pullToRefresh') || 'Pull down to refresh and check for new content'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadHomeData}>
              <Text style={[styles.retryText, isRTL && styles.rtlText]}>{t('common.refresh')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Small Sections Loading States */}
        {loading && (
          <View style={styles.sectionsLoadingContainer}>
            {[1, 2, 3].map(index => (
              <View key={index} style={styles.sectionLoadingSkeleton}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonItems}>
                  {[1, 2, 3].map(itemIndex => (
                    <View key={itemIndex} style={styles.skeletonItem} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    // RTL is handled by I18nManager globally
  },
  scrollView: {
    flex: 1,
  },
  rtlScrollView: {
    // RTL is handled by I18nManager globally
  },
  scrollContent: {
    paddingBottom: Spacing['3xl'],
  },
  rtlScrollContent: {
    // RTL is handled by I18nManager globally
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
  // Header Styles
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  rtlHeader: {
    alignItems: 'flex-end',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    minHeight: 50,
  },
  rtlHeaderTop: {
    flexDirection: 'row-reverse',
  },
  appTitleSection: {
    flex: 1,
  },
  headerSpacer: {
    flex: 1,
  },
  logoCorner: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 56,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationButton: {
    position: 'relative',
    padding: Spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rtlNotificationBadge: {
    right: undefined,
    left: 2,
  },
  
  // Search Header Section
  searchHeaderSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.md,
  },
  rtlSearchHeaderSection: {
    // RTL handled by I18nManager
  },
  
  profileButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  
  // Modern Quick Actions Styles
  quickActionsContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  rtlQuickActionsContainer: {
    // RTL handled by I18nManager
  },
  quickActionsTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.bold,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rtlQuickActionsGrid: {
    flexDirection: 'row-reverse',
  },
  modernQuickActionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: (screenWidth - 48) / 2 - 6, // 2 columns with proper spacing
    marginBottom: Spacing.sm,
    alignItems: 'center',
    ...Shadow.sm,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  actionTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.bold,
  },
  actionSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },
  
  // Modern Section Styles
  modernSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  rtlModernSectionHeader: {
    flexDirection: 'row-reverse',
  },
  modernSectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
    marginBottom: Spacing.xs,
  },
  modernSectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  modernViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryBackground,
  },
  rtlModernViewAllButton: {
    flexDirection: 'row-reverse',
  },
  modernViewAllText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
    marginEnd: Spacing.xs,
  },
  rtlModernViewAllText: {
    marginEnd: 0,
    marginStart: Spacing.xs,
  },
  
  // Modern Banner Styles
  modernBannerSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modernBannerList: {
    paddingLeft: 0,
  },
  modernBannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  modernDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.xs,
  },
  modernActiveDot: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  
  // Modern Categories List
  modernCategoriesList: {
    paddingLeft: 0,
  },
  
  // Modern Products List
  modernProductsList: {
    paddingLeft: 0,
  },

  // Offers Section Styles
  offersList: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  rtlList: {
    flexDirection: 'row-reverse',
  },
  offersPlaceholder: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  offersPlaceholderText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  offersErrorContainer: {
    backgroundColor: Colors.errorBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  offersErrorText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
    marginBottom: Spacing.xs,
  },
  offersRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  offersRetryText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontFamily: Typography.fontFamily.medium,
  },
  offerCard: {
    width: screenWidth * 0.65,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  offerImage: {
    width: '100%',
    height: 110,
  },
  offerImageFallback: {
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerInfo: {
    padding: Spacing.sm,
    gap: 4,
  },
  rtlOfferInfo: {
    alignItems: 'flex-end',
  },
  offerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  rtlOfferTitle: {
    textAlign: 'right',
  },
  offerDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    lineHeight: 16,
  },
  rtlOfferDescription: {
    textAlign: 'right',
  },
  offerMeta: {
    marginTop: 4,
    gap: 4,
  },
  rtlOfferMeta: {
    alignItems: 'flex-end',
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  rtlOfferBadge: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  offerBadgeLabel: {
    fontSize: 9,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  offerBadgeValue: {
    fontSize: 10,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  offerDates: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  
  // Modern Search Results Styles
  modernSearchResultsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.backgroundCard,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  modernClearButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundLight,
  },
  modernSearchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  rtlModernSearchLoadingContainer: {
    flexDirection: 'row-reverse',
  },
  modernSearchLoadingText: {
    marginStart: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
  },
  rtlModernSearchLoadingText: {
    marginStart: 0,
    marginEnd: Spacing.sm,
  },
  modernNoResultsContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  modernNoResultsText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  modernNoResultsSubtext: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  rtlQuickActions: {
    flexDirection: 'row-reverse',
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryBackground,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  quickActionText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: Typography.fontWeight.medium,
    marginStart: Spacing.xs,
    fontFamily: Typography.fontFamily.medium,
  },
  rtlText: {
    textAlign: 'right',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  rtlWritingDirection: {
    // RTL handled by I18nManager
  },

  // Banner Styles
  bannerSection: {
    marginVertical: Spacing.md,
  },
  bannerList: {
    paddingHorizontal: Spacing.sm,
  },
  bannerContainer: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundCard,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: Spacing.lg,
  },
  rtlBannerOverlay: {
    alignItems: 'flex-end',
  },
  bannerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.bold,
  },
  rtlBannerTitle: {
    textAlign: 'right',
  },
  bannerDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textWhite,
    opacity: 0.9,
    fontFamily: Typography.fontFamily.regular,
  },
  rtlBannerDescription: {
    textAlign: 'right',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
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

  // Section Styles
  section: {
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  rtlSectionHeader: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bold,
  },
  rtlSectionTitle: {
    textAlign: 'right',
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryBackground,
  },  // Categories Styles
  categoriesList: {
    paddingHorizontal: Spacing.sm,
  },
  categoryItem: {
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    width: 80,
  },
  rtlCategoryItem: {
    // RTL handled by I18nManager
  },
  categoryImageContainer: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.backgroundCard,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.lg,
    resizeMode: 'cover',
  } as ImageStyle,
  categoryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.medium,
  },
  rtlCategoryText: {
    textAlign: 'center',
  },
  productCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },

  // Products Styles
  productsList: {
    paddingHorizontal: Spacing.sm,
  },
  productItem: {
    width: 150,
    marginHorizontal: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
  },
  productImageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  } as ImageStyle,
  featuredBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.star,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rtlFeaturedBadge: {
    left: undefined,
    right: Spacing.sm,
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rtlDiscountBadge: {
    right: undefined,
    left: Spacing.sm,
  },
  discountText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
    fontFamily: Typography.fontFamily.bold,
  },
  productInfo: {
    padding: Spacing.md,
  },
  rtlProductInfo: {
    alignItems: 'flex-end',
  },
  productTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    minHeight: 32,
    fontFamily: Typography.fontFamily.medium,
  },
  rtlProductTitle: {
    textAlign: 'right',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  rtlPriceContainer: {
    flexDirection: 'row-reverse',
  },
  currentPrice: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  originalPrice: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textHint,
    textDecorationLine: 'line-through',
    marginStart: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },
  rtlOriginalPrice: {
    marginStart: 0,
    marginEnd: Spacing.xs,
  },
  outOfStock: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
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
  outOfStockBadgeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontWeight: Typography.fontWeight.bold,
    fontFamily: Typography.fontFamily.bold,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  rtlQuickAddButton: {
    flexDirection: 'row-reverse',
  },
  quickAddText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textWhite,
    fontWeight: Typography.fontWeight.medium,
    marginStart: Spacing.xs,
    fontFamily: Typography.fontFamily.medium,
  },
  rtlQuickAddText: {
    marginStart: 0,
    marginEnd: Spacing.xs,
  },

  // Empty State
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
  sectionsLoadingContainer: {
    paddingHorizontal: Spacing.lg,
  },
  sectionLoadingSkeleton: {
    marginBottom: Spacing.xl,
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    width: '40%',
  },
  skeletonItems: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  skeletonItem: {
    width: 140,
    height: 200,
    backgroundColor: '#e0e0e0',
    borderRadius: BorderRadius.md,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    color: Colors.textWhite,
    fontWeight: Typography.fontWeight.medium,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.medium,
  },
  
  // Search styles
  searchSection: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
  },
  clearSearchText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  searchLoadingText: {
    marginStart: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noResultsText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
  
  // Fallback icon styles
  categoryIconFallback: {
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productIconFallback: {
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerIconFallback: {
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Store Unavailable Banner Styles
  storeUnavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b35',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rtlStoreUnavailableBanner: {
    flexDirection: 'row-reverse',
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderRightColor: '#ff6b35',
  },
  storeUnavailableTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  storeUnavailableTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: '#d84315',
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.bold,
  },
  storeUnavailableMessage: {
    fontSize: Typography.fontSize.sm,
    color: '#5d4037',
    lineHeight: 20,
    fontFamily: Typography.fontFamily.regular,
  },
  
  // All Products Grid Styles
  allProductsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
    justifyContent: 'space-between',
  },
  allProductsGridItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  gridProductItem: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  gridProductImageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
    backgroundColor: Colors.primaryBackground,
  },
  gridProductImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  } as ImageStyle,
  gridProductInfo: {
    padding: Spacing.md,
  },
  gridProductTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    minHeight: 36,
    fontFamily: Typography.fontFamily.medium,
  },
  allProductsLoadingMore: {
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
  loadMoreButton: {
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
  loadMoreButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.medium,
  },
  endOfProductsContainer: {
    width: '100%',
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  endOfProductsText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textHint,
    fontFamily: Typography.fontFamily.regular,
  },
});

export default HomeScreen;
