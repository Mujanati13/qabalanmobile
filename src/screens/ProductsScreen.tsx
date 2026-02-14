import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  I18nManager,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import ApiService, { Product, Category } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { formatCurrency } from '../utils/currency';
import { CachedImage } from '../components/common';

interface ProductsScreenProps {
  navigation: any;
  route: any;
}

const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { featured, categoryId, categoryName } = route.params || {};

  console.log('📱 ProductsScreen mounted with params:', { featured, categoryId, categoryName });

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null); // Always start with "All" selected
  const [breadcrumb, setBreadcrumb] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    console.log('🚀 ProductsScreen useEffect triggered - initial load');
    loadCategories();
    loadProducts();
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    // Reload products when selected category changes (skip initial load)
    if (!isInitialLoad) {
      console.log('🔄 Selected category changed, reloading products. selectedCategoryId:', selectedCategoryId);
      loadProducts(1, false);
    }
  }, [selectedCategoryId]);

  const parsePrice = (price: string | number | null | undefined): number => {
    if (price === null || price === undefined) return 0;
    return typeof price === 'string' ? parseFloat(price) || 0 : price;
  };

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      console.log('📂 Loading categories for categoryId:', categoryId);
      
      // If we have a selected category, try to load its subcategories
      if (categoryId) {
        console.log('🔍 Loading subcategories for parent category:', categoryId);
        
        // Load breadcrumb path
        try {
          const pathResponse = await ApiService.getCategoryPath(categoryId);
          if (pathResponse.success && pathResponse.data) {
            console.log('📍 Breadcrumb path loaded:', pathResponse.data);
            setBreadcrumb(pathResponse.data);
          }
        } catch (error) {
          console.error('Error loading category path:', error);
        }
        
        // Load subcategories with the correct parent_id
        console.log('🌐 API Call: getSubcategories(' + categoryId + ')');
        const subcategoriesResponse = await ApiService.getSubcategories(categoryId);
        
        console.log('📦 Subcategories API Response:', {
          success: subcategoriesResponse.success,
          dataLength: subcategoriesResponse.data?.length || 0,
          data: subcategoriesResponse.data
        });
        
        if (subcategoriesResponse.success && subcategoriesResponse.data) {
          const subcats = subcategoriesResponse.data;
          console.log('✅ Subcategories loaded:', subcats.length);
          
          // Log each subcategory with its parent_id for verification
          subcats.forEach((cat: any) => {
            console.log(`   - Category: ${cat.title_en || cat.title_ar} (ID: ${cat.id}, parent_id: ${cat.parent_id})`);
          });
          
          // Set categories even if empty to show "All" option only
          setCategories(subcats);
        } else {
          // No subcategories found - this is fine, just show products from this category
          console.log('ℹ️ No subcategories found for category:', categoryId);
          setCategories([]);
        }
      } else {
        // Load top-level categories (for main products view)
        console.log('📂 Loading top-level categories');
        setBreadcrumb([]);
        const response = await ApiService.getTopCategories(50);
        
        if (response.success && response.data) {
          console.log('✅ Top categories loaded:', response.data.length);
          setCategories(response.data);
        } else {
          console.warn('⚠️ Failed to load categories:', response.message);
          setCategories([]);
        }
      }
    } catch (error) {
      console.error('💥 Error loading categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadProducts = async (pageNumber = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      }

      const params: any = {
        page: pageNumber,
        limit: 10,
        sort: 'sort_order',
        order: 'asc'
      };

      if (featured) {
        params.is_featured = true;
      } else if (selectedCategoryId) {
        // User selected a specific subcategory
        params.category_id = selectedCategoryId;
      } else if (categoryId) {
        // No specific subcategory selected, but we're viewing a parent category
        // Show all products from this category and its subcategories
        params.category_id = categoryId;
      }

      console.log('🔍 Loading products with params:', params);
      const response = await ApiService.getProducts(params);
      console.log('📦 Products API response:', {
        success: response.success,
        dataLength: response.data?.length || 0,
        message: response.message
      });

      if (response.success && response.data) {
        const newProducts = response.data || [];  // response.data is the products array
        console.log('✅ Received products:', newProducts.length);
        console.log('📄 Pagination data:', response.pagination);
        
        if (append) {
          setProducts(prev => [...prev, ...newProducts]);
        } else {
          setProducts(newProducts);
        }

        // Check if there are more products - pagination is at the top level
        const hasMoreData = response.pagination?.hasNext ?? false;
        setHasMore(hasMoreData);
        setPage(pageNumber);
      } else {
        const errorMsg = response.message || t('products.loadProductsFailed');
        console.error('❌ Failed to load products:', errorMsg);
        setError(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('common.networkError');
      console.error('💥 Error loading products:', error);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts(1, false);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadProducts(page + 1, true);
    }
  };

  const getProductTitle = (product: Product) => {
    return currentLanguage === 'ar' ? (product.title_ar || product.title_en) : product.title_en;
  };

  const getProductDescription = (product: Product) => {
    return currentLanguage === 'ar' ? (product.description_ar || product.description_en) : product.description_en;
  };

  const getProductPrice = (product: Product) => {
    const salePrice = parsePrice(product.sale_price);
    const basePrice = parsePrice(product.base_price);
    const price = salePrice > 0 ? salePrice : basePrice;
    return formatCurrency(price, { isRTL });
  };

  const getOriginalPrice = (product: Product) => {
    const salePrice = parsePrice(product.sale_price);
    const basePrice = parsePrice(product.base_price);
    
    if (salePrice > 0 && salePrice < basePrice) {
      return formatCurrency(basePrice, { isRTL });
    }
    return null;
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
    >
      {item.main_image ? (
        <CachedImage 
          uri={ApiService.getImageUrl(item.main_image)}
          style={styles.productImage}
          resizeMode="cover"
          showLoadingIndicator={true}
          loadingIndicatorSize="small"
          fallbackComponent={
            <View style={styles.placeholderImage}>
              <Icon name="image-outline" size={40} color="#ccc" />
            </View>
          }
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Icon name="image-outline" size={40} color="#ccc" />
        </View>
      )}
      
      <View style={styles.productInfo}>
        <Text style={[styles.productTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
          {getProductTitle(item)}
        </Text>
        
        <Text style={[styles.productDescription, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
          {getProductDescription(item)}
        </Text>
        
        <View style={styles.priceContainer}>
          <Text style={[styles.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {getProductPrice(item)}
          </Text>
          {getOriginalPrice(item) && (
            <Text style={[styles.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {getOriginalPrice(item)}
            </Text>
          )}
        </View>
        
        {item.is_featured && (
          <View style={styles.featuredBadge}>
            <Icon name="star" size={12} color="#FFD700" />
            <Text style={[styles.featuredText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.featured')}</Text>
          </View>
        )}
        
        <View style={styles.stockContainer}>
          <View style={[
            styles.stockIndicator,
            { backgroundColor: 
                item.stock_status === 'in_stock' ? '#27ae60' : 
                item.stock_status === 'limited' ? '#f39c12' : 
                '#e74c3c' 
            }
          ]} />
          <Text style={[styles.stockText, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {item.stock_status === 'in_stock' ? t('products.inStock') : 
             item.stock_status === 'limited' ? t('products.limitedStock') || 'Limited' :
             t('products.outOfStock')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="basket-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>{t('products.noProductsFound')}</Text>
      <Text style={styles.emptyMessage}>
        {error 
          ? `${t('common.error')}: ${error}`
          : featured 
          ? t('products.noFeaturedProducts')
          : selectedCategoryId 
          ? t('products.noProductsInCategory')
          : t('products.noProductsAvailable')}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadProducts()}>
        <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
      </TouchableOpacity>
      <Text style={styles.debugText}>
        Debug: Products count: {products.length} | Error: {error || 'None'}
      </Text>
    </View>
  );

  const getCategoryTitle = (category: Category) => {
    return currentLanguage === 'ar' 
      ? (category.title_ar || category.title_en)
      : (category.title_en || category.title_ar);
  };

  const handleCategorySelect = (categoryId: number | null, category?: Category) => {
    console.log('🔄 handleCategorySelect called:', { 
      categoryId, 
      categoryName: category ? getCategoryTitle(category) : 'All',
      hasSubcategories: category?.subcategories_count,
      currentSelectedId: selectedCategoryId
    });
    
    // If the category has subcategories, navigate to show them
    if (category && category.subcategories_count && category.subcategories_count > 0) {
      const categoryTitle = getCategoryTitle(category);
      console.log('📂 Navigating to category with subcategories:', categoryTitle);
      navigation.push('Products', {
        categoryId: categoryId,
        categoryName: categoryTitle
      });
    } else {
      // Just filter products by this category (including "All" which is null)
      console.log('🔽 Setting selectedCategoryId to:', categoryId === null ? 'null (All)' : categoryId);
      
      // If clicking the same category (including "All"), force reload
      if (selectedCategoryId === categoryId) {
        console.log('🔄 Same category clicked - force reload');
        setProducts([]); // Clear products
        setPage(1);
        setHasMore(true);
        loadProducts(1, false); // Force reload immediately
      } else {
        // Different category selected - let useEffect handle the reload
        setSelectedCategoryId(categoryId);
        setProducts([]); // Clear products while loading
        setPage(1);
        setHasMore(true);
      }
    }
  };

  const renderCategoryChip = ({ item }: { item: Category }) => {
    const isSelected = selectedCategoryId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.categoryChip,
          isSelected && styles.categoryChipSelected,
        ]}
        onPress={() => handleCategorySelect(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.categoryChipText,
          isSelected && styles.categoryChipTextSelected,
          isRTL && styles.rtlText
        ]}>
          {getCategoryTitle(item)}
        </Text>
      </TouchableOpacity>
    );
  };

  const getScreenTitle = () => {
    if (featured) {
      return t('home.featuredProducts') || 'Featured Products';
    } else if (categoryName) {
      return categoryName;
    } else {
      return t('products.products') || 'Products';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isRTL && styles.rtlHeader]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name={currentLanguage === 'ar' ? "chevron-forward" : "chevron-back"} size={24} color="#333" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={1}>
          {getScreenTitle()}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Breadcrumb Navigation */}
      {breadcrumb.length > 0 && (
        <View style={styles.breadcrumbContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.breadcrumbContent, isRTL && styles.rtlBreadcrumbContent]}>
              {breadcrumb.map((item, index) => (
                <View key={item.id} style={styles.breadcrumbItem}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!item.is_current) {
                        navigation.replace('Products', {
                          categoryId: item.id,
                          categoryName: currentLanguage === 'ar' ? item.title_ar : item.title_en
                        });
                      }
                    }}
                  >
                    <Text style={[
                      styles.breadcrumbText,
                      item.is_current && styles.breadcrumbTextCurrent,
                      isRTL && styles.rtlText
                    ]}>
                      {currentLanguage === 'ar' ? item.title_ar : item.title_en}
                    </Text>
                  </TouchableOpacity>
                  {index < breadcrumb.length - 1 && (
                    <Icon 
                      name={isRTL ? "chevron-back" : "chevron-forward"} 
                      size={14} 
                      color="#999"
                      style={styles.breadcrumbSeparator}
                    />
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Category Filter - Circular Style */}
      {!featured && categories.length > 0 && (
        <View style={styles.categoryFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoryScrollContent,
              isRTL && styles.rtlCategoryScrollContent
            ]}
          >
            {/* "All" Category Option */}
              <TouchableOpacity
                style={styles.categoryCircleContainer}
                onPress={() => handleCategorySelect(null)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.categoryCircle,
                  selectedCategoryId === null && styles.categoryCircleSelected
                ]}>
                  <Icon name="apps" size={32} color={selectedCategoryId === null ? '#fff' : Colors.primary} />
                </View>
                <Text style={[
                  styles.categoryCircleText,
                  selectedCategoryId === null && styles.categoryCircleTextSelected,
                  isRTL && styles.rtlText
                ]} numberOfLines={2}>
                  {t('common.all') || 'All'}
                </Text>
              </TouchableOpacity>

              {/* Category Circles */}
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCircleContainer}
                  onPress={() => handleCategorySelect(category.id, category)}
                  activeOpacity={0.7}
                >
                <View style={[
                  styles.categoryCircle,
                  selectedCategoryId === category.id && styles.categoryCircleSelected
                ]}>
                  {category.image ? (
                    <CachedImage
                      uri={ApiService.getImageUrl(category.image)}
                      style={styles.categoryCircleImage}
                      resizeMode="cover"
                      showLoadingIndicator={true}
                      loadingIndicatorSize="small"
                      fallbackComponent={
                        <Icon name="grid-outline" size={32} color={selectedCategoryId === category.id ? '#fff' : Colors.primary} />
                      }
                    />
                  ) : (
                    <Icon name="grid-outline" size={32} color={selectedCategoryId === category.id ? '#fff' : Colors.primary} />
                  )}
                </View>
                <Text style={[
                  styles.categoryCircleText,
                  selectedCategoryId === category.id && styles.categoryCircleTextSelected,
                  isRTL && styles.rtlText
                ]} numberOfLines={2}>
                  {getCategoryTitle(category)}
                </Text>
                {/* Show indicator if category has subcategories */}
                {(category.subcategories_count && category.subcategories_count > 0) && (
                  <View style={styles.subcategoryIndicator}>
                    <Icon 
                      name={isRTL ? "chevron-back" : "chevron-forward"} 
                      size={10} 
                      color="#fff"
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('products.loadingProducts')}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={[styles.productsList, isRTL && styles.rtlProductsList]}
          columnWrapperStyle={isRTL ? styles.rtlColumnWrapper : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    direction: 'rtl',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    padding: 12,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  productsList: {
    padding: 10,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 5,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  placeholderImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  featuredText: {
    fontSize: 10,
    color: '#856404',
    marginLeft: 4,
    fontWeight: '600',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  stockText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 15,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    marginLeft: 0,
    marginRight: 15,
  },
  rtlProductsList: {
    direction: 'rtl',
  },
  rtlColumnWrapper: {
    flexDirection: 'row-reverse',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 18,
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  // Category Filter Styles
  categoryFilterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  rtlCategoryScrollContent: {
    flexDirection: 'row-reverse',
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  categoryChipIcon: {
    marginLeft: 6,
  },
  // Circular Category Styles
  categoryCircleContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  categoryCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  categoryCircleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryCircleImage: {
    width: '100%',
    height: '100%',
  },
  categoryCircleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  categoryCircleTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  subcategoryIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Breadcrumb Styles
  breadcrumbContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rtlBreadcrumbContent: {
    flexDirection: 'row-reverse',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  breadcrumbTextCurrent: {
    color: '#666',
    fontWeight: '400',
  },
  breadcrumbSeparator: {
    marginHorizontal: 6,
  },
});

export default ProductsScreen;
