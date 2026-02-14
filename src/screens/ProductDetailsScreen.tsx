import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  ImageStyle,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import ApiService, { Product, ProductVariant } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import Toast from '../components/common/Toast';
import EnhancedButton from '../components/common/EnhancedButton';
import HapticFeedback from '../utils/HapticFeedback';
import { formatCurrency } from '../utils/currency';
import { computeVariantPriceFromBase, normalizeVariantPricingMetadata, sortVariantsForDisplay } from '../utils/variantPricing';

const { width: screenWidth } = Dimensions.get('window');

interface ProductDetailsScreenProps {
  navigation: any;
  route: any;
}

const ProductDetailsScreen: React.FC<ProductDetailsScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { productId, branchId: branchIdParam } = route.params || {};
  const branchIdNumber = (() => {
    if (typeof branchIdParam === 'number') {
      return branchIdParam;
    }
    if (typeof branchIdParam === 'string') {
      const parsed = parseInt(branchIdParam, 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  })();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Variant selection states - MULTI-SELECT SUPPORT (one variant per category/type)
  // Customers can select multiple variants, e.g., Size: Small AND Color: Red
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  
  // Enhanced UI states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [isAddedToCart, setIsAddedToCart] = useState(false);
  
  // Variant image display state
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);

  // Reset "Added" state when variant selection changes to allow adding different variants immediately
  useEffect(() => {
    if (selectedVariants.length > 0) {
      setIsAddedToCart(false);
    }
  }, [selectedVariants]);
  
  // Update displayed image when variant selection changes
  useEffect(() => {
    if (!product) return;
    
    // Find first selected variant with an image
    const variantWithImage = selectedVariants.find(v => v.image_url);
    
    if (variantWithImage?.image_url) {
      // Use variant-specific image
      setDisplayedImage(ApiService.getImageUrl(variantWithImage.image_url));
    } else {
      // Fallback to product main image
      setDisplayedImage(
        product.main_image 
          ? ApiService.getImageUrl(product.main_image) 
          : 'https://via.placeholder.com/400x300?text=No+Image'
      );
    }
  }, [selectedVariants, product]);
  
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(1);
  const cartButtonScale = new Animated.Value(1);
  const [showAddedToCart, setShowAddedToCart] = useState(false);

  const deriveAvailableQuantity = (variant: ProductVariant): number => {
    if (typeof variant.available_quantity === 'number') {
      return variant.available_quantity;
    }
    if (typeof variant.branch_available_quantity === 'number') {
      return variant.branch_available_quantity;
    }
    if (typeof variant.branch_stock_quantity === 'number') {
      return variant.branch_stock_quantity;
    }
    return variant.stock_quantity ?? 0;
  };

  const deriveStockStatus = (
    variant: ProductVariant,
    availableQuantity: number
  ): NonNullable<ProductVariant['stock_status']> => {
    if (variant.stock_status) {
      return variant.stock_status;
    }
    if (variant.branch_is_available === 0) {
      return 'unavailable';
    }
    return availableQuantity > 0 ? 'in_stock' : 'out_of_stock';
  };

  const normalizeVariant = (variant: ProductVariant): ProductVariant => {
    const availableQuantity = Math.max(deriveAvailableQuantity(variant), 0);
    const stockStatus = deriveStockStatus(variant, availableQuantity);
    const pricingMetadata = normalizeVariantPricingMetadata(variant);

    return {
      ...pricingMetadata,
      available_quantity: availableQuantity,
      stock_status: stockStatus,
    };
  };

  const getVariantAvailableQuantity = (variant?: ProductVariant | null): number => {
    if (!variant) return 0;
    if (typeof variant.available_quantity === 'number') {
      return Math.max(variant.available_quantity, 0);
    }
    return Math.max(variant.stock_quantity ?? 0, 0);
  };

  const getVariantStockStatus = (
    variant?: ProductVariant | null
  ): NonNullable<ProductVariant['stock_status']> => {
    if (!variant) {
      return 'out_of_stock';
    }
    if (variant.stock_status) {
      return variant.stock_status;
    }
    return getVariantAvailableQuantity(variant) > 0 ? 'in_stock' : 'out_of_stock';
  };

  const isVariantAvailable = (variant?: ProductVariant | null): boolean => {
    if (!variant) return false;
    const status = getVariantStockStatus(variant);
    // Allow in_stock, low_stock, and limited status
    return status === 'in_stock' || status === 'low_stock' || status === 'limited';
  };

  const hasAnyVariantAvailable = (variantList: ProductVariant[]): boolean => {
    return variantList.some(item => isVariantAvailable(item));
  };

  // Helper function to get the correct stock status (branch-specific or general)
  const getStockStatus = (product: Product): string => {
    return product.branch_stock_status || product.stock_status;
  };

  // Helper function to check if product is in stock, considering variants when present
  const isProductInStock = (product: Product): boolean => {
    if (variants.length > 0) {
      if (!hasAnyVariantAvailable(variants)) {
        return false;
      }
      // With multi-select, product is in stock if ANY variant is available
      return hasAnyVariantAvailable(variants);
    }

    const status = getStockStatus(product);
    // Allow in_stock, low_stock, and limited status
    return status === 'in_stock' || status === 'low_stock' || status === 'limited';
  };

  // Helper function to get the correct base price (branch-specific or general)
  const getBasePrice = (product: Product): number => {
    if (product.final_price !== undefined && product.final_price !== null) {
      return parsePrice(product.final_price);
    }

    const hasDiscount =
      product.sale_price &&
      parsePrice(product.sale_price) > 0 &&
      parsePrice(product.sale_price) < parsePrice(product.base_price);

    return hasDiscount ? parsePrice(product.sale_price!) : parsePrice(product.base_price);
  };

  useEffect(() => {
    if (productId) {
      loadProduct();
    } else {
      setLoading(false);
    }
  }, [productId]);

  const parsePrice = (price: string | number | null | undefined): number => {
    if (price === null || price === undefined) return 0;
    return typeof price === 'string' ? parseFloat(price) || 0 : price;
  };

  const formatPrice = (price: string | number | null | undefined): string => {
    const numericPrice = parsePrice(price);
    return formatCurrency(numericPrice, { isRTL });
  };

  const calculateDiscountPercentage = (basePrice: string | number, salePrice: string | number): number => {
    const base = parsePrice(basePrice);
    const sale = parsePrice(salePrice);
    if (base <= 0 || sale <= 0 || sale >= base) return 0;
    return Math.round(((base - sale) / base) * 100);
  };

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getProductById(productId);
      
      if (response.success && response.data) {
        setProduct(response.data);
        setIsFavorite(response.data.is_favorited);
        
        // Initialize displayed image with product main image
        if (response.data.main_image) {
          setDisplayedImage(ApiService.getImageUrl(response.data.main_image));
        }
        
        // Load variants for this product
        loadProductVariants();
      } else {
        Alert.alert(t('common.error'), t('products.productNotFound'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert(t('common.error'), t('products.loadProductDetailsFailed'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadProductVariants = async () => {
    if (!productId) return;
    
    try {
      setLoadingVariants(true);
      const response = await ApiService.getProductVariants(productId, {
        branchId: branchIdNumber,
      });

      if (response.success && Array.isArray(response.data)) {
        const normalizedVariants = response.data.map(normalizeVariant);
        const orderedVariants = sortVariantsForDisplay(normalizedVariants);
        setVariants(orderedVariants);
      } else {
        setVariants([]);
      }
    } catch (error) {
      console.error('Error loading variants:', error);
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  useEffect(() => {
    // With multi-select, we don't auto-select variants
    // Users will manually select the variants they want
    if (variants.length === 0) {
      setSelectedVariants([]);
    }
  }, [variants]);

  const getVariantTitle = (variant: ProductVariant): string => {
    // Use title_ar/title_en for proper multilingual support
    return isRTL
      ? variant.title_ar || variant.title_en || variant.variant_value || ''
      : variant.title_en || variant.title_ar || variant.variant_value || '';
  };

  const getVariantDisplayPrice = (variant: ProductVariant): number => {
    if (!product) {
      return parsePrice(variant?.price ?? variant?.price_modifier);
    }

    const basePrice = getBasePrice(product);
    const { unitPrice } = computeVariantPriceFromBase(basePrice, variant);
    return unitPrice;
  };

  const calculateFinalPriceWithVariants = (): number => {
    if (!product) return 0;

    const basePrice = getBasePrice(product);

    // Calculate total for all selected variants
    if (selectedVariants.length > 0) {
      let currentPrice = basePrice;
      
      // Separate override and add variants
      const overrideVariants = selectedVariants.filter(v => 
        v.price_behavior === 'override'
      );
      const addVariants = selectedVariants.filter(v => 
        v.price_behavior !== 'override'
      );
      
      // Sort override variants by priority (lower number = higher priority)
      const sortedOverrides = [...overrideVariants].sort((a, b) => {
        const priorityA = a.override_priority ?? Number.MAX_SAFE_INTEGER;
        const priorityB = b.override_priority ?? Number.MAX_SAFE_INTEGER;
        return priorityA - priorityB;
      });
      
      // Apply only the first (highest priority) override variant
      if (sortedOverrides.length > 0) {
        const winningOverride = sortedOverrides[0];
        const modifier = parseFloat(String(winningOverride.price_modifier || 0));
        currentPrice = modifier; // Override replaces the base price
      }
      
      // Add all "add" variants
      for (const variant of addVariants) {
        const modifier = parseFloat(String(variant.price_modifier || 0));
        currentPrice += modifier;
      }
      
      return currentPrice;
    }

    return basePrice;
  };

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      // Multi-variant validation
      if (variants.length > 0 && selectedVariants.length === 0) {
        Alert.alert(
          t('products.selectVariantTitle') || t('common.alert') || 'Select Variants',
          t('products.selectVariantMessage') || 'Please choose at least one option before adding to cart.'
        );
        return;
      }

      // Check if any selected variant is unavailable
      const unavailableVariants = selectedVariants.filter(v => !isVariantAvailable(v));
      if (unavailableVariants.length > 0) {
        Alert.alert(
          t('products.outOfStock') || t('common.alert') || 'Out of Stock',
          t('products.someVariantsUnavailable') || 'Some selected options are currently unavailable. Please deselect them.'
        );
        return;
      }

      setAddingToCart(true);

      const baseUnitPrice = getBasePrice(product);

      // Add one product with all selected variants as additions
      if (selectedVariants.length > 0) {
        // Calculate total price considering override and add behaviors with priority
        let currentPrice = baseUnitPrice;
        
        // Separate override and add variants
        const overrideVariants = selectedVariants.filter(v => 
          v.price_behavior === 'override'
        );
        const addVariants = selectedVariants.filter(v => 
          v.price_behavior !== 'override'
        );
        
        // Sort override variants by priority (lower number = higher priority)
        const sortedOverrides = [...overrideVariants].sort((a, b) => {
          const priorityA = a.override_priority ?? Number.MAX_SAFE_INTEGER;
          const priorityB = b.override_priority ?? Number.MAX_SAFE_INTEGER;
          return priorityA - priorityB;
        });
        
        // Apply only the first (highest priority) override variant
        if (sortedOverrides.length > 0) {
          const winningOverride = sortedOverrides[0];
          const modifier = parseFloat(String(winningOverride.price_modifier || 0));
          currentPrice = modifier; // Override replaces the base price
        }
        
        // Add all "add" variants
        for (const variant of addVariants) {
          const modifier = parseFloat(String(variant.price_modifier || 0));
          currentPrice += modifier;
        }
        
        const finalUnitPrice = currentPrice;
        
        // Add single product with multiple variants
        addToCart(product, quantity, {
          variants: selectedVariants, // Pass all selected variants as array
          unitPriceOverride: finalUnitPrice,
          baseUnitPrice,
        });
        
        // Enhanced success feedback
        setIsAddedToCart(true);
        setToastMessage(t('cart.itemWithVariantsAdded', { 
          count: selectedVariants.length,
          quantity,
          product: getProductTitle(product) 
        }) || `Added ${quantity} ${getProductTitle(product)} with ${selectedVariants.length} option(s) to cart`);
        setToastType('success');
        setShowToast(true);
      } else {
        // Add product without variant
        const unitPrice = calculateFinalPriceWithVariants();
        addToCart(product, quantity, {
          variant: null,
          unitPriceOverride: unitPrice,
          baseUnitPrice,
        });
        
        setIsAddedToCart(true);
        setToastMessage(t('cart.itemAdded', { 
          quantity, 
          product: getProductTitle(product) 
        }) || `Added ${quantity} ${getProductTitle(product)} to cart`);
        setToastType('success');
        setShowToast(true);
      }
      
      // Haptic feedback for success
      HapticFeedback.success();
      
      // Button scale animation
      Animated.sequence([
        Animated.timing(cartButtonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(cartButtonScale, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(cartButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Reset after adding
      setTimeout(() => {
        setQuantity(1);
        setSelectedVariants([]);
        setIsAddedToCart(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      setToastMessage(t('cart.addError') || 'Failed to add item to cart');
      setToastType('error');
      setShowToast(true);
      HapticFeedback.error();
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    
    try {
      // Multi-variant validation
      if (variants.length > 0 && selectedVariants.length === 0) {
        Alert.alert(
          t('products.selectVariantTitle') || t('common.alert') || 'Select Variants',
          t('products.selectVariantMessage') || 'Please choose at least one option before continuing.'
        );
        return;
      }

      // Check if any selected variant is unavailable
      const unavailableVariants = selectedVariants.filter(v => !isVariantAvailable(v));
      if (unavailableVariants.length > 0) {
        Alert.alert(
          t('products.outOfStock') || t('common.alert') || 'Out of Stock',
          t('products.someVariantsUnavailable') || 'Some selected options are currently unavailable.'
        );
        return;
      }

      setAddingToCart(true);

      const baseUnitPrice = getBasePrice(product);

      // Add one product with all selected variants as additions
      if (selectedVariants.length > 0) {
        // Calculate total price considering override and add behaviors
        let currentPrice = baseUnitPrice;
        
        for (const variant of selectedVariants) {
          const { unitPrice, behavior, overrideApplied } = computeVariantPriceFromBase(currentPrice, variant);
          
          if (behavior === 'override' && overrideApplied) {
            // Override behavior: replace the current price
            currentPrice = unitPrice;
          } else {
            // Add behavior: add to the current price
            const { additionAmount } = computeVariantPriceFromBase(baseUnitPrice, variant);
            currentPrice += additionAmount;
          }
        }
        
        const finalUnitPrice = currentPrice;
        
        // Add single product with multiple variants
        addToCart(product, quantity, {
          variants: selectedVariants, // Pass all selected variants as array
          unitPriceOverride: finalUnitPrice,
          baseUnitPrice,
        });
      } else {
        const unitPrice = calculateFinalPriceWithVariants();
        addToCart(product, quantity, {
          variant: null,
          unitPriceOverride: unitPrice,
          baseUnitPrice,
        });
      }

      // Navigate to Cart tab, then to Checkout screen
      navigation.navigate('Cart', { screen: 'Checkout' });
    } catch (error) {
      console.error('Error in buy now:', error);
      setToastMessage(t('cart.addError') || 'Failed to add item to cart');
      setToastType('error');
      setShowToast(true);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!product || !user) {
      Alert.alert('Login Required', 'Please login to add favorites');
      return;
    }

    try {
      setIsFavorite(!isFavorite);
      // Add favorite toggle functionality here
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setIsFavorite(!isFavorite); // Revert on error
    }
  };

  const getProductTitle = (product: Product) => {
    return currentLanguage === 'ar' ? (product.title_ar || product.title_en) : product.title_en;
  };

  const getProductDescription = (product: Product) => {
    return currentLanguage === 'ar' ? (product.description_ar || product.description_en) : product.description_en;
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
    HapticFeedback.light();
  };

  const decrementQuantity = () => {
    setQuantity(prev => prev > 1 ? prev - 1 : 1);
    HapticFeedback.light();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={[styles.errorText, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.productNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate discount based on whether we have branch-specific pricing or not
  const hasDiscount = product.final_price 
    ? false // Branch pricing already includes discount in final_price
    : product.sale_price && parsePrice(product.sale_price) > 0 && parsePrice(product.sale_price) < parsePrice(product.base_price);
  
  const discountPercentage = hasDiscount ? calculateDiscountPercentage(product.base_price, product.sale_price!) : 0;
  const baseFinalPrice = getBasePrice(product);
  const finalPrice = calculateFinalPriceWithVariants();
  
  // Check if any selected variant is unavailable
  const hasUnavailableVariant = selectedVariants.some(v => !isVariantAvailable(v));
  const variantActionDisabled = variants.length > 0 ? hasUnavailableVariant : false;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={[styles.headerButton, currentLanguage === 'ar' && {marginLeft: 12, marginRight: 0}]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Icon 
            name={currentLanguage === 'ar' ? "chevron-forward" : "chevron-back"} 
            size={28} 
            color="#1c1c1e" 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, currentLanguage === 'ar' && {textAlign: 'right'}]} numberOfLines={1}>
          {getProductTitle(product)}
        </Text>
        <TouchableOpacity 
          onPress={handleToggleFavorite} 
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Icon 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={24} 
            color={isFavorite ? Colors.error : "#333"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: displayedImage || (product.main_image ? ApiService.getImageUrl(product.main_image) : 'https://via.placeholder.com/400x300?text=No+Image')
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {product.is_featured && (
            <View style={[styles.featuredBadge, isRTL && styles.rtlFeaturedBadge]}>
              <Icon name="star" size={16} color={Colors.textWhite} />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={[styles.discountBadge, isRTL && styles.rtlDiscountBadge]}>
              <Text style={styles.discountText}>
                {discountPercentage}% {t('common.off')}
              </Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <Text style={[styles.productTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {getProductTitle(product)}
          </Text>

          <View style={[styles.priceContainer, isRTL && styles.rtlRowReverse]}>
            <Text style={[styles.currentPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {formatPrice(finalPrice)}
            </Text>
            {hasDiscount && (
              <Text style={[styles.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {formatPrice(product.base_price)}
              </Text>
            )}
          </View>

          {/* Variant Selection - MULTI-SELECT BY CATEGORY */}
          {variants.length > 0 && (() => {
            // Group variants by category (variant_name)
            const variantsByCategory: Record<string, ProductVariant[]> = {};
            variants.forEach(variant => {
              const category = variant.variant_name || 'Options';
              if (!variantsByCategory[category]) {
                variantsByCategory[category] = [];
              }
              variantsByCategory[category].push(variant);
            });

            return (
              <View style={styles.variantsContainer}>
                <Text style={[styles.variantTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('products.chooseVariants') || t('products.chooseVariant') || 'Select options'} 
                  {selectedVariants.length > 0 && ` (${selectedVariants.length} selected)`}
                </Text>
                
                {Object.entries(variantsByCategory).map(([categoryName, categoryVariants]) => (
                  <View key={categoryName} style={styles.variantCategoryContainer}>
                    {/* Category Title */}
                    <Text style={[styles.variantCategoryTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                      {isRTL && currentLanguage === 'ar' 
                        ? (categoryVariants[0]?.variant_name || categoryName)
                        : categoryName
                      }
                    </Text>
                    
                    {/* Variants in this category */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      scrollEventThrottle={16}
                      style={styles.variantOptionsScroll}
                    >
                      <View style={styles.variantOptions}>
                        {categoryVariants.map((variant) => {
                          const isSelected = selectedVariants.some(v => v.id === variant.id);
                          const variantAvailable = isVariantAvailable(variant);
                          const availableQty = getVariantAvailableQuantity(variant);
                          const priceDiff = getVariantDisplayPrice(variant) - finalPrice;
                          const availabilityLabel = variantAvailable
                            ? `${t('products.inStock') || 'In Stock'}`
                            : t('products.outOfStock') || 'Out of Stock';
                          return (
                            <TouchableOpacity
                              key={variant.id}
                              style={[
                                styles.variantOption,
                                isSelected && styles.selectedVariantOption,
                                !variantAvailable && styles.unavailableVariantOption
                              ]}
                              onPress={() => {
                                if (variantAvailable) {
                                  // Multi-select: one variant per category (radio button per category)
                                  // User can select Size: Small AND Color: Red simultaneously
                                  if (isSelected) {
                                    // Deselect if clicking the same variant
                                    setSelectedVariants(prev => prev.filter(v => v.id !== variant.id));
                                  } else {
                                    // Remove any other variant of the same category, add this one
                                    setSelectedVariants(prev => [
                                      ...prev.filter(v => v.variant_name !== variant.variant_name),
                                      variant
                                    ]);
                                  }
                                }
                              }}
                              disabled={!variantAvailable}
                            >
                              {/* Radio button indicator */}
                              <View style={[
                                styles.variantRadio,
                                isSelected && styles.variantRadioSelected
                              ]}>
                                {isSelected && (
                                  <View style={styles.variantRadioDot} />
                                )}
                              </View>
                              
                              <View style={styles.variantTextContainer}>
                                <Text
                                  style={[
                                    styles.variantOptionText,
                                    isSelected && styles.selectedVariantOptionText,
                                    { textAlign: 'left', writingDirection: 'ltr' }
                                  ]}
                                  numberOfLines={1}
                                >
                                  {getVariantTitle(variant)}
                                </Text>
                                <Text
                                  style={[
                                    styles.variantPrice,
                                    isSelected && styles.selectedVariantPrice,
                                    { textAlign: 'left', writingDirection: 'ltr' }
                                  ]}
                                  numberOfLines={1}
                                >
                                  {priceDiff !== 0 ? (
                                    <Text>
                                      {priceDiff > 0 ? '+' : ''}{formatPrice(priceDiff)}
                                    </Text>
                                  ) : (
                                    <Text>{formatPrice(getVariantDisplayPrice(variant))}</Text>
                                  )}
                                </Text>
                                {variantAvailable && availableQty <= 5 && availableQty > 0 && (
                                  <Text style={[styles.variantLowStock, { textAlign: 'left', writingDirection: 'ltr' }]}>
                                    {availableQty} left
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                ))}
              </View>
            );
          })()}

          <View style={styles.stockContainer}>
            <View style={[
              styles.stockIndicator,
              { backgroundColor: isProductInStock(product) ? Colors.success : Colors.error }
            ]} />
            <Text style={[styles.stockText, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {isProductInStock(product) ? t('products.inStock') : t('products.outOfStock')}
            </Text>
          </View>

          {getProductDescription(product) && (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.sectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('products.description')}
              </Text>
              <Text style={[styles.description, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {getProductDescription(product)}
              </Text>
            </View>
          )}

          <View style={styles.detailsContainer}>
            <Text style={[styles.sectionTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('products.details')}
            </Text>
            <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
              <Text style={[styles.detailLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>SKU:</Text>
              <Text style={[styles.detailValue, { textAlign: 'left', writingDirection: 'ltr' }]}>{product.sku}</Text>
            </View>
            {product.category_title_en && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('products.category')}:</Text>
                <Text style={[styles.detailValue, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {currentLanguage === 'ar' ? (product.category_title_ar || product.category_title_en) : product.category_title_en}
                </Text>
              </View>
            )}
            {product.loyalty_points > 0 && (
              <View style={[styles.detailRow, isRTL && styles.rtlRowReverse]}>
                <Text style={[styles.detailLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('loyalty.points')}:</Text>
                <Text style={[styles.detailValue, { textAlign: 'left', writingDirection: 'ltr' }]}>{product.loyalty_points} {t('loyalty.pointsEarned')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Enhanced Bottom Actions */}
      {isProductInStock(product) && (
        <View style={styles.bottomActions}>
          <View style={[styles.quantityContainer, isRTL && styles.rtlRowReverse]}>
            <Text style={[styles.quantityLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>{t('cart.quantity')}:</Text>
            <View style={[styles.quantityControls, isRTL && styles.rtlRowReverse]}>
              <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton}>
                <Icon name="remove" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.quantityText, { textAlign: 'left', writingDirection: 'ltr' }]}>{quantity}</Text>
              <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}>
                <Icon name="add" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.actionButtons, isRTL && styles.rtlRowReverse]}>
            {/* Buy Now Button */}
            <EnhancedButton
              title={t('products.buyNow') || 'Buy Now'}
              subtitle={formatPrice(finalPrice * quantity)}
              onPress={handleBuyNow}
              loading={addingToCart}
              loadingText={t('cart.addingToCart') || 'Adding...'}
              variant="secondary"
              size="medium"
              icon="flash"
              style={styles.buyNowButton}
              disabled={addingToCart || variantActionDisabled}
            />
            
            {/* Add to Cart Button */}
            <Animated.View style={[{ transform: [{ scale: cartButtonScale }] }, styles.addToCartContainer]}>
              <EnhancedButton
                title={isAddedToCart ? (t('cart.added') || 'Added!') : (t('cart.addToCart') || 'Add to Cart')}
                subtitle={isAddedToCart ? undefined : formatPrice(finalPrice * quantity)}
                onPress={handleAddToCart}
                loading={addingToCart}
                loadingText={t('cart.addingToCart') || 'Adding...'}
                variant={isAddedToCart ? 'success' : 'primary'}
                size="medium"
                icon={isAddedToCart ? 'checkmark-circle' : 'bag-add'}
                disabled={isAddedToCart || variantActionDisabled}
                style={styles.addToCartButtonEnhanced}
              />
            </Animated.View>
          </View>
        </View>
      )}
      
      {/* Out of Stock Message */}
      {!isProductInStock(product) && (
        <View style={styles.outOfStockContainer}>
          <Icon name="alert-circle-outline" size={20} color="#dc3545" />
          <Text style={[styles.outOfStockText, isRTL && styles.rtlText]}>
            {t('products.outOfStock') || 'Out of Stock'}
          </Text>
        </View>
      )}
      
      {/* Enhanced Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        duration={3000}
        onHide={() => setShowToast(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  rtlContainer: {
    // direction is not valid in React Native StyleSheet
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
  rtlLoadingText: {
    textAlign: 'right',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  rtlErrorText: {
    textAlign: 'right',
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlBackButtonText: {
    textAlign: 'right',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadow.sm,
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  rtlHeaderButton: {
    marginRight: 0,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  rtlHeaderTitle: {
    textAlign: 'right',
  },
  rtlText: {
    textAlign: 'right',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    width: screenWidth,
    height: screenWidth * 0.75,
    backgroundColor: Colors.backgroundLight,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  } as ImageStyle,
  featuredBadge: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    backgroundColor: Colors.star,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rtlFeaturedBadge: {
    left: undefined,
    right: Spacing.lg,
    flexDirection: 'row-reverse',
  },
  featuredText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
    marginStart: Spacing.xs,
  },
  rtlFeaturedText: {
    textAlign: 'right',
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rtlDiscountBadge: {
    right: undefined,
    left: Spacing.lg,
  },
  discountText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
  },
  rtlDiscountText: {
    textAlign: 'right',
  },
  infoContainer: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    marginTop: -BorderRadius.lg,
    minHeight: screenWidth,
  },
  productTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: Typography.lineHeight.lg,
    marginBottom: Spacing.md,
  },
  rtlProductTitle: {
    textAlign: 'right',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  currentPrice: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  rtlCurrentPrice: {
    textAlign: 'right',
  },
  originalPrice: {
    fontSize: Typography.fontSize.lg,
    color: Colors.textHint,
    textDecorationLine: 'line-through',
    marginStart: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
  },
  rtlOriginalPrice: {
    textAlign: 'right',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  stockIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginEnd: Spacing.sm,
  },
  stockText: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlStockText: {
    textAlign: 'right',
  },
  descriptionContainer: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  rtlSectionTitle: {
    textAlign: 'right',
  },
  description: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.xl,
  },
  rtlDescription: {
    textAlign: 'right',
  },
  detailsContainer: {
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlDetailLabel: {
    textAlign: 'right',
  },
  detailValue: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlDetailValue: {
    textAlign: 'right',
  },
  bottomActions: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    ...Shadow.lg,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  buyNowButton: {
    flex: 1,
  },
  addToCartContainer: {
    flex: 1,
  },
  addToCartButtonEnhanced: {
    flex: 1,
  },
  outOfStockContainer: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: '#dc3545',
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    marginStart: Spacing.sm,
  },
  rtlOutOfStockText: {
    textAlign: 'right',
  },
  quantityLabel: {
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlQuantityLabel: {
    textAlign: 'right',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  quantityText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginHorizontal: Spacing.lg,
    minWidth: 30,
    textAlign: 'center',
  },
  rtlQuantityText: {
    textAlign: 'right',
  },
  addToCartButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.base,
  },
  disabledButton: {
    backgroundColor: Colors.textHint,
  },
  addToCartText: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginStart: Spacing.sm,
  },
  rtlAddToCartText: {
    textAlign: 'right',
  },
  // Legacy styles to maintain compatibility
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginStart: 15,
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
  successMessage: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginStart: 8,
    flex: 1,
  },
  // Variant Selection Styles
  variantsContainer: {
    marginBottom: Spacing.sm,
  },
  variantCategoryContainer: {
    marginBottom: 4,
  },
  variantCategoryTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  rtlVariantCategoryTitle: {
    textAlign: 'right',
  },
  variantSection: {
    marginBottom: Spacing.md,
  },
  variantTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  rtlVariantTitle: {
    textAlign: 'right',
  },
  variantOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  variantOptionsScroll: {
    marginBottom: 4,
    maxHeight: 70,
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
    minWidth: 90,
    maxHeight: 60,
    gap: Spacing.xs,
  },
  selectedVariantOption: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  unavailableVariantOption: {
    opacity: 0.5,
  },
  variantCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  variantCheckboxSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  // Radio button styles (for single-select)
  variantRadio: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  variantRadioSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  variantRadioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.background,
  },
  variantTextContainer: {
    flex: 1,
  },
  variantOptionText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  rtlVariantOptionText: {
    textAlign: 'right',
  },
  selectedVariantOptionText: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
  },
  rtlSelectedVariantOptionText: {
    textAlign: 'right',
  },
  variantPrice: {
    fontSize: 10,
    color: Colors.textHint,
    marginTop: 1,
  },
  rtlVariantPrice: {
    textAlign: 'right',
  },
  selectedVariantPrice: {
    color: Colors.primary,
  },
  rtlSelectedVariantPrice: {
    textAlign: 'right',
  },
  variantAvailability: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
    fontFamily: Typography.fontFamily.medium,
  },
  rtlVariantAvailability: {
    textAlign: 'right',
  },
  variantAvailabilityUnavailable: {
    color: Colors.error,
    fontFamily: Typography.fontFamily.medium,
  },
  rtlVariantAvailabilityUnavailable: {
    textAlign: 'right',
  },
  variantLowStock: {
    fontSize: 8,
    color: Colors.error,
    marginTop: 1,
    fontWeight: Typography.fontWeight.medium,
  },
});

export default ProductDetailsScreen;
