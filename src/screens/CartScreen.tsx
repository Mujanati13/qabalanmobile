import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  TextInput,
  Platform,
  StatusBar,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { ProductVariant } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { formatCurrency, formatNumber } from '../utils/currency';
import { computeVariantPriceFromBase, normalizeVariantPricingMetadata } from '../utils/variantPricing';

const { width } = Dimensions.get('window');

interface CartScreenProps {
  navigation: any;
}

const CartScreen: React.FC<CartScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { user, isGuest } = useAuth();
  const { items, itemCount, totalAmount, updateQuantity, removeFromCart, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());
  const formatAmount = useCallback((value: unknown) => formatCurrency(value, { isRTL }), [isRTL]);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const AnimatedCartItem = ({ item, index }: { item: any; index: number }) => {
    const itemFadeAnim = useRef(new Animated.Value(1)).current;
    const itemSlideAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const animateQuantityChange = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const animateRemove = () => {
      Animated.parallel([
        Animated.timing(itemFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(itemSlideAnim, {
          toValue: isRTL ? width : -width,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleRemove = () => {
      const itemKey = `${item.product_id}-${item.variant_id || 'default'}`;
      setAnimatingItems(prev => new Set([...prev, itemKey]));
      animateRemove();
      setTimeout(() => {
        removeFromCart(item.product_id, item.variant_id);
        setAnimatingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
      }, 300);
    };

    const handleQuantityChange = (newQuantity: number) => {
      if (newQuantity < 1) {
        handleRemove();
        return;
      }
      animateQuantityChange();
      updateQuantity(item.product_id, newQuantity, item.variant_id);
    };

    const product = item.product;
    if (!product) return null;

    const parseNumericValue = (value: unknown): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') {
        return Number.isNaN(value) ? 0 : value;
      }
      const parsed = parseFloat(String(value));
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const resolveUnitPrice = (): number => {
      const storedUnitPrice = parseNumericValue(item.unit_price);
      const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;

      const basePrice = (() => {
        if (typeof item.base_unit_price === 'number' && !Number.isNaN(item.base_unit_price)) {
          return item.base_unit_price;
        }

        if (product.final_price !== undefined && product.final_price !== null) {
          const finalPrice = parseNumericValue(product.final_price);
          if (finalPrice > 0) {
            return finalPrice;
          }
        }

        const basePriceValue = parseNumericValue(product.base_price);
        const salePriceValue = parseNumericValue(product.sale_price);
        if (salePriceValue > 0 && salePriceValue < basePriceValue) {
          return salePriceValue;
        }

        return basePriceValue;
      })();

      if (hasVariants) {
        const normalizedVariants: ProductVariant[] = item.variants!.map((variant: ProductVariant) =>
          normalizeVariantPricingMetadata(variant)
        );
        let currentPrice = basePrice;
        let winningOverride: ProductVariant | undefined;

        const overrideCandidates = normalizedVariants.filter((variant: ProductVariant) => variant.price_behavior === 'override');
        if (overrideCandidates.length > 0) {
          const sortedOverrides = [...overrideCandidates].sort((a, b) => {
            const priorityA = a.override_priority ?? Number.MAX_SAFE_INTEGER;
            const priorityB = b.override_priority ?? Number.MAX_SAFE_INTEGER;
            return priorityA - priorityB;
          });

          const candidate = sortedOverrides[0];
          const { unitPrice, behavior, overrideApplied } = computeVariantPriceFromBase(basePrice, candidate);
          if (behavior === 'override' && overrideApplied) {
            currentPrice = unitPrice;
            winningOverride = candidate;
          }
        }

        const additiveVariants = normalizedVariants.filter((variant: ProductVariant) => {
          if (variant.price_behavior === 'override') {
            return !winningOverride || variant.id !== winningOverride.id;
          }
          return true;
        });

        for (const variant of additiveVariants) {
          const { additionAmount, behavior, overrideApplied } = computeVariantPriceFromBase(basePrice, variant);
          if (behavior === 'override' && overrideApplied) {
            currentPrice = additionAmount + basePrice;
          } else {
            currentPrice += additionAmount;
          }
        }

        return Number.isFinite(currentPrice) ? currentPrice : storedUnitPrice;
      }

      if (item.variant) {
        const normalizedVariant = normalizeVariantPricingMetadata(item.variant);
        const { unitPrice } = computeVariantPriceFromBase(basePrice, normalizedVariant);
        if (Number.isFinite(unitPrice) && unitPrice > 0) {
          return unitPrice;
        }
      }

      if (storedUnitPrice > 0) {
        return storedUnitPrice;
      }

      return basePrice;
    };

    const normalizeVariantKey = (value: string): string | null => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return null;
      }
      const isAscii = /^[\u0000-\u007F]+$/.test(trimmed);
      if (!isAscii) {
        return null;
      }
      return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    };

    const translateVariantAttribute = (attribute?: string | null): string | null => {
      if (!attribute) {
        return null;
      }
      const normalized = normalizeVariantKey(attribute);
      if (!normalized) {
        return attribute;
      }
      return t(`products.attributes.${normalized}`, { defaultValue: attribute });
    };

    const translateVariantValue = (value?: string | null): string | null => {
      if (!value) {
        return null;
      }
      const normalized = normalizeVariantKey(value);
      if (!normalized) {
        return value;
      }
      return t(`products.variantValues.${normalized}`, { defaultValue: value });
    };

    const resolveVariantLabel = (): string | null => {
      // Handle multiple variants (new multi-select feature)
      if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
        const variantLabels = item.variants.map((variant: ProductVariant) => {
          // Prioritize localized title
          const localizedTitle = currentLanguage === 'ar'
            ? variant.title_ar || variant.title_en
            : variant.title_en || variant.title_ar;
          
          if (localizedTitle && localizedTitle.trim().length > 0) {
            return localizedTitle;
          }
          
          // Fallback to variant_name: variant_value
          const rawAttribute = variant.variant_name || null;
          const rawValue = variant.variant_value || null;
          
          const attributeLabel = rawAttribute ? translateVariantAttribute(rawAttribute) : null;
          const valueLabel = rawValue ? translateVariantValue(rawValue) : null;
          
          if (attributeLabel && valueLabel) {
            return `${attributeLabel}: ${valueLabel}`;
          }
          return valueLabel || attributeLabel || rawValue || rawAttribute;
        }).filter(Boolean);
        
        return variantLabels.length > 0 ? variantLabels.join(', ') : null;
      }
      
      // Handle single variant (legacy)
      if (!item.variant) {
        return null;
      }

      // Prioritize localized title (title_ar/title_en) for proper multilingual support
      const localizedTitle = (() => {
        const title = currentLanguage === 'ar'
          ? item.variant.title_ar || item.variant.title_en
          : item.variant.title_en || item.variant.title_ar;
        return title && title.trim().length > 0 ? title : null;
      })();

      // Return localized title if available
      if (localizedTitle) {
        return localizedTitle;
      }

      // Fallback to translated variant_name and variant_value
      const rawAttribute = item.variant.variant_name || null;
      const rawValue = item.variant.variant_value || null;

      const attributeLabel = rawAttribute ? translateVariantAttribute(rawAttribute) : null;
      const valueSource = rawValue ?? (rawAttribute && !rawValue ? rawAttribute : null);
      const valueLabel = valueSource ? translateVariantValue(valueSource) : null;

      const attributeLooksLikeValue =
        !rawValue &&
        !!rawAttribute &&
        valueSource === rawAttribute &&
        (!attributeLabel || attributeLabel === rawAttribute);

      if (!attributeLooksLikeValue && attributeLabel && valueLabel) {
        return `${attributeLabel}: ${valueLabel}`;
      }

      if (valueLabel) {
        return valueLabel;
      }

      if (attributeLabel && !attributeLooksLikeValue) {
        return attributeLabel;
      }

      if (rawAttribute) {
        return rawAttribute;
      }

      return null;
    };

    const title = currentLanguage === 'ar' ? product.title_ar : product.title_en;
    const variantLabel = resolveVariantLabel();
    const unitPrice = resolveUnitPrice();
    
  console.log('Cart item debug -> unitPrice:', unitPrice, 'stored unit_price:', item.unit_price, 'base snapshot:', item.base_unit_price);

    // Calculate base price using same logic as ProductDetailsScreen
    let basePrice = parseNumericValue(product.base_price);
    if (product.final_price !== undefined && product.final_price !== null) {
      basePrice = parseNumericValue(product.final_price);
    } else if (product.sale_price && parseNumericValue(product.sale_price) > 0) {
      const salePrice = parseNumericValue(product.sale_price);
      const basePriceCheck = parseNumericValue(product.base_price);
      if (salePrice < basePriceCheck) {
        basePrice = salePrice;
      }
    }
    
    // Snapshot base price captured when item was added to cart (preferred)
    const basePriceSnapshot = (() => {
      if (typeof item.base_unit_price === 'number' && !Number.isNaN(item.base_unit_price)) {
        return item.base_unit_price;
      }
      return null;
    })();

    // For variant breakdown display, we need the ACTUAL product base price (before ANY variants)
    // Prefer the stored snapshot; fall back to current product pricing if unavailable
    const actualProductBasePrice = (() => {
      if (basePriceSnapshot !== null) {
        return basePriceSnapshot;
      }

      const rawBasePrice = parseNumericValue(product.base_price);

      // Check if there's a valid sale price
      if (product.sale_price && parseNumericValue(product.sale_price) > 0) {
        const salePrice = parseNumericValue(product.sale_price);
        if (salePrice < rawBasePrice) {
          return salePrice;
        }
      }

      return rawBasePrice;
    })();
    
    const originalPrice = basePrice;
    const hasDiscount = basePrice > 0 && unitPrice > 0 && unitPrice < basePrice;
    const discountPercentage = hasDiscount
      ? Math.round(((basePrice - unitPrice) / basePrice) * 100)
      : 0;
    const itemTotal = unitPrice * item.quantity;

    // Define variant price breakdown function here (after actualProductBasePrice is available)
    const getVariantPriceBreakdown = (): Array<{variant: ProductVariant; addition: number; label: string; isOverride: boolean}> => {
      if (!item.variants || !Array.isArray(item.variants) || item.variants.length === 0) {
        return [];
      }

      return item.variants.map((variant: ProductVariant) => {
        const normalizedVariant = normalizeVariantPricingMetadata(variant);
        const { additionAmount, behavior } = computeVariantPriceFromBase(actualProductBasePrice, normalizedVariant);
        const isOverride = behavior === 'override';

        const label = (() => {
          const localizedTitle = currentLanguage === 'ar'
            ? normalizedVariant.title_ar || normalizedVariant.title_en
            : normalizedVariant.title_en || normalizedVariant.title_ar;
          
          if (localizedTitle && localizedTitle.trim().length > 0) {
            return localizedTitle;
          }
          
          const attribute = normalizedVariant.variant_name || '';
          const value = normalizedVariant.variant_value || '';
          if (attribute && value) {
            return `${attribute}: ${value}`;
          }
          return attribute || value || 'Variant';
        })();

        return {
          variant: normalizedVariant,
          addition: additionAmount,
          label,
          isOverride,
        };
      });
    };

    return (
      <Animated.View 
        style={[
          styles.cartItem,
          {
            opacity: itemFadeAnim,
            transform: [
              { translateX: itemSlideAnim },
              { scale: scaleAnim },
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                })
              }
            ],
          }
        ]}
      >
  <View style={[styles.cartItemContent, isRTL && styles.rtlCartItemContent]}>
          <View style={styles.imageContainer}>
            <Image
              source={{ 
                uri: product.main_image || 'https://via.placeholder.com/80x80?text=No+Image' 
              }}
              style={styles.productImage}
              resizeMode="cover"
            />
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  {discountPercentage}%
                </Text>
              </View>
            )}
          </View>
          
          <View style={[styles.productInfo, isRTL && styles.rtlProductInfo]}>
            <Text style={[styles.productTitle, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
              {title}
            </Text>
            
            {/* Enhanced variant display with breakdown */}
            {variantLabel && (
              <View style={styles.variantContainer}>
                <Text style={[styles.variantLabel, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={3}>
                  {variantLabel}
                </Text>
              </View>
            )}
            
            {/* Price breakdown */}
            <View style={[styles.priceContainer, isRTL && styles.rtlPriceContainer]}>
              <View>
                <Text style={styles.currentPrice}>
                  {formatAmount(unitPrice)}
                </Text>
                
                {/* Show variant price breakdown if variants exist */}
                {item.variants && item.variants.length > 0 && (
                  <View style={styles.variantPriceBreakdown}>
                    <Text style={[styles.breakdownLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>
                      {t('products.basePrice') || 'Base'}: {formatAmount(actualProductBasePrice)}
                    </Text>
                    {getVariantPriceBreakdown().map((breakdown, idx) => (
                      breakdown.addition !== 0 && (
                        <Text key={`${breakdown.variant.id}-${idx}`} style={[styles.breakdownItem, { textAlign: 'left', writingDirection: 'ltr' }]}>
                          {breakdown.label}: {breakdown.addition > 0 ? '+' : ''}{formatAmount(breakdown.addition)}
                        </Text>
                      )
                    ))}
                  </View>
                )}
                
                {/* Show base price if variants change price but no detailed breakdown */}
                {!item.variants && basePrice !== unitPrice && (
                  <Text style={[styles.basePriceLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>
                    {t('products.basePrice') || 'Base'}: {formatAmount(basePrice)}
                  </Text>
                )}
              </View>
              {hasDiscount && (
                <Text style={[styles.originalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {formatAmount(originalPrice)}
                </Text>
              )}
            </View>

            {item.special_instructions && (
              <Text style={[styles.specialInstructions, { textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={2}>
                {t('cart.specialInstructions')}: {item.special_instructions}
              </Text>
            )}

            <View style={[styles.quantityAndTotal, isRTL && styles.rtlQuantityAndTotal]}>
              <View style={[styles.quantityControls, isRTL && styles.rtlQuantityControls]}>
                <TouchableOpacity
                  style={[styles.quantityButton, styles.decreaseButton]}
                  onPress={() => handleQuantityChange(item.quantity - 1)}
                  disabled={loading}
                >
                  <Icon name="remove" size={16} color="#fff" />
                </TouchableOpacity>
                
                <Animated.View style={[styles.quantityContainer, { transform: [{ scale: scaleAnim }] }]}>
                  <Text style={styles.quantityText}>{formatNumber(item.quantity, { decimals: 0 })}</Text>
                </Animated.View>
                
                <TouchableOpacity
                  style={[styles.quantityButton, styles.increaseButton]}
                  onPress={() => handleQuantityChange(item.quantity + 1)}
                  disabled={loading}
                >
                  <Icon name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={[styles.itemTotalContainer, isRTL && styles.rtlAlignStart]}>
                <Text style={[styles.itemTotal, isRTL && styles.rtlText]}>
                  {formatAmount(itemTotal)}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.removeButton, isRTL && styles.rtlRemoveButton]}
            onPress={handleRemove}
            disabled={loading}
          >
            <Icon name="trash-outline" size={22} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const calculateDiscount = () => {
    return 0; // No promo code discount in cart
  };

  const discount = calculateDiscount();
  const finalTotal = Math.max(totalAmount, 0); // Delivery fee will be calculated during checkout

  const handleQuantityChange = (productId: number, newQuantity: number, variantId?: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(productId, variantId);
      return;
    }
    updateQuantity(productId, newQuantity, variantId);
  };

  const handleRemoveItem = (productId: number, variantId?: number) => {
    Alert.alert(
      t('cart.removeItem'),
      t('cart.removeItemConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'), 
          style: 'destructive',
          onPress: () => removeFromCart(productId, variantId)
        }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      t('cart.clearCart'),
      t('cart.clearCartConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.confirm'), 
          style: 'destructive',
          onPress: () => {
            clearCart();
          }
        }
      ]
    );
  };

  const handleCheckout = () => {
    if (!user && !isGuest) {
      Alert.alert(
        t('auth.loginRequired'),
        t('auth.loginRequiredMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('auth.login'), 
            onPress: () => navigation.navigate('Auth', { screen: 'Login' })
          }
        ]
      );
      return;
    }

    if (items.length === 0) {
      Alert.alert(t('cart.empty'), t('cart.addItemsFirst'));
      return;
    }

    // Navigate to checkout
    navigation.navigate('Checkout');
  };

  const renderCartItem = (item: any, index: number) => {
    return <AnimatedCartItem item={item} index={index} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={[styles.headerContent, isRTL && styles.rtlHeader]}>
          <Text style={[styles.title, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {t('cart.title')} ({itemCount})
          </Text>
          {items.length > 0 && (
            <TouchableOpacity onPress={handleClearCart} disabled={loading}>
              <Text style={[styles.clearButton, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('cart.clearCart')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {items.length === 0 ? (
        <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
          <Icon name="basket-outline" size={100} color="#ddd" />
          <Text style={[styles.emptyTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {t('cart.empty')}
          </Text>
          <Text style={[styles.emptySubtitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
            {t('cart.addItemsFirst')}
          </Text>
          <TouchableOpacity 
            style={[styles.continueShoppingButton, isRTL && styles.rtlContinueShoppingButton]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={[styles.continueShoppingText, { textAlign: 'left', writingDirection: 'ltr' }]}>
              {t('cart.continueShopping')}
            </Text>
            <Icon name={currentLanguage === 'ar' ? "chevron-back" : "chevron-forward"} size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Animated.View style={[styles.itemsContainer, { opacity: fadeAnim }]}>
              {items.map((item, index) => (
                <View key={`cart-item-${item.product_id}-${item.variant_id || 'default'}-${index}`}>
                  {renderCartItem(item, index)}
                </View>
              ))}
            </Animated.View>
          </ScrollView>

          <Animated.View style={[styles.bottomContainer, { 
            opacity: fadeAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              })
            }]
          }]}>
            <View style={styles.summaryContainer}>
              <Text style={[styles.summaryTitle, { textAlign: 'left', writingDirection: 'ltr' }]}>
                {t('cart.orderSummary')}
              </Text>
              
              {/* Items subtotal */}
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('cart.itemsTotal')} ({itemCount})
                </Text>
                <Text style={[styles.summaryValue, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {formatAmount(totalAmount)}
                </Text>
              </View>
              
              {/* Delivery fee note */}
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.deliveryNote, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('cart.deliveryCalculatedAtCheckout')}
                </Text>
              </View>
              
              <View style={styles.divider} />
              
              {/* Total to pay */}
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.totalLabel, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('cart.totalToPay')} 
                  <Text style={styles.withoutDeliveryText}> ({t('cart.withoutDelivery')})</Text>
                </Text>
                <Text style={[styles.totalValue, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {formatAmount(finalTotal)}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.checkoutButton, loading && styles.disabledButton, isRTL && styles.rtlCheckoutButton]}
              onPress={handleCheckout}
              disabled={loading || items.length === 0}
            >
              <View style={[styles.checkoutButtonContent, isRTL && styles.rtlAlignEnd]}>
                <Text style={[styles.checkoutButtonText, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {t('cart.checkout')}
                </Text>
                <View style={styles.checkoutPriceBreakdown}>
                  <Text style={[styles.checkoutButtonPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                    {t('cart.itemsTotal')}: {formatAmount(totalAmount)}
                  </Text>
                  <Text style={[styles.checkoutDeliveryNote, { textAlign: 'left', writingDirection: 'ltr' }]}>
                    {t('cart.deliveryCalculatedAtCheckout')}
                  </Text>
                </View>
              </View>
              <View style={styles.checkoutPriceContainer}>
                <Text style={[styles.checkoutFinalPrice, { textAlign: 'left', writingDirection: 'ltr' }]}>
                  {formatAmount(finalTotal)}
                </Text>
              </View>
              <Icon name={currentLanguage === 'ar' ? "chevron-back" : "chevron-forward"} size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </>
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
    // RTL handled by I18nManager
  },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  rtlTitle: {
    textAlign: 'right',
  },
  rtlText: {
    textAlign: 'right',
  },
  clearButton: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#f8f9fa',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 24,
    marginBottom: 12,
  },
  rtlEmptyTitle: {
    textAlign: 'right',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  rtlEmptySubtitle: {
    textAlign: 'right',
  },
  continueShoppingButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  rtlContinueShoppingButton: {
    flexDirection: 'row-reverse',
  },
  continueShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  itemsContainer: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cartItemContent: {
    flexDirection: 'row',
    padding: 16,
  },
  rtlCartItemContent: {
    flexDirection: 'row-reverse',
  },
  imageContainer: {
    position: 'relative',
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  discountBadge: {
    position: 'absolute',
    top: -4,
    end: -4,
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  productInfo: {
    flex: 1,
    marginStart: 16,
  },
  rtlProductInfo: {
    marginStart: 0,
    marginEnd: 16,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
    lineHeight: 20,
  },
  rtlProductTitle: {
    textAlign: 'right',
  },
  variantLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  rtlVariantLabel: {
    textAlign: 'right',
  },
  variantContainer: {
    marginBottom: 6,
  },
  variantCountBadge: {
    backgroundColor: '#007AFF15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  variantCountText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  variantPriceBreakdown: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  breakdownItem: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  basePriceLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlPriceContainer: {
    flexDirection: 'row-reverse',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginStart: 8,
  },
  rtlOriginalPrice: {
    marginStart: 0,
    marginEnd: 8,
  },
  specialInstructions: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  rtlSpecialInstructions: {
    textAlign: 'right',
  },
  quantityAndTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  rtlQuantityAndTotal: {
    flexDirection: 'row-reverse',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 2,
  },
  rtlQuantityControls: {
    flexDirection: 'row-reverse',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decreaseButton: {
    backgroundColor: '#ff6b6b',
  },
  increaseButton: {
    backgroundColor: '#007AFF',
  },
  quantityContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotalContainer: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  removeButton: {
    padding: 12,
    alignSelf: 'flex-start',
  },
  summaryContainer: {
    marginBottom: 12,
  },
  bottomContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  rtlSummaryTitle: {
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlSummaryRow: {
    flexDirection: 'row-reverse',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  rtlAlignEnd: {
    alignItems: 'flex-end',
  },
  rtlAlignStart: {
    alignItems: 'flex-start',
  },
  rtlRemoveButton: {
    alignSelf: 'flex-end',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  rtlSummaryLabel: {
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  rtlSummaryValue: {
    textAlign: 'left',
  },
  deliveryNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  withoutDeliveryText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#888',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  rtlCheckoutButton: {
    flexDirection: 'row-reverse',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  checkoutButtonContent: {
    flex: 1,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  rtlCheckoutButtonText: {
    textAlign: 'right',
  },
  checkoutPriceBreakdown: {
    gap: 2,
  },
  checkoutButtonPrice: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },
  checkoutDeliveryNote: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '400',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  checkoutPriceContainer: {
    alignItems: 'center',
    marginEnd: 12,
  },
  checkoutFinalPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default CartScreen;
