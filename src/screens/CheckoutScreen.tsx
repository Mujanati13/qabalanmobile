import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  PermissionsAndroid,
  I18nManager,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useBranch } from '../contexts/BranchContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService, { Address, CartItem, OrderCalculation, PromoCode } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import guestOrderService from '../services/guestOrderService';
import paymentService, { PaymentSession } from '../services/paymentService';
import Toast from '../components/common/Toast';

// Use the same base URL as other services (includes /api)
const API_BASE_URL = 'https://apiv2.qabalanbakery.com/api';
import EnhancedButton from '../components/common/EnhancedButton';
import HapticFeedback from '../utils/HapticFeedback';
import { formatCurrency } from '../utils/currency';
import { computeVariantPriceFromBase, normalizeVariantPricingMetadata } from '../utils/variantPricing';

// Generate unique session token for Google Places Autocomplete billing optimization
const generateSessionToken = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface CheckoutScreenProps {
  navigation: any;
}

type Branch = {
  id: number;
  title_en?: string;
  title_ar?: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
  // Optional legacy aliases returned by different endpoints
  branch_id?: number;
  name?: string;
  name_en?: string;
  name_ar?: string;
  branch_name?: string;
  branch_title_en?: string;
  branch_title_ar?: string;
  title?: string;
  display_name?: string;
};

type BranchAvailabilityStatus = {
  branch_id: number;
  status: 'available' | 'unavailable' | 'inactive' | 'error';
  min_available?: number | null;
  min_remaining?: number | null;
  issues?: string[];
  message?: string;
};

type BranchStatusTone =
  | 'loading'
  | 'unknown'
  | 'available'
  | 'limited'
  | 'warning'
  | 'inactive'
  | 'unavailable'
  | 'error'
  | 'neutral';

type BranchStatusPresentation = {
  label: string;
  tone: BranchStatusTone;
  message?: string;
  issues?: string[];
};

type BranchStockWarningSource = 'calculation' | 'status' | null;

type BranchStockWarningDetail = {
  message: string;
  productTitle?: string;
  variantLabel?: string;
  suggestion?: string;
};

const toNumeric = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    const parsed = parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return 0;
};

const normalizeOrderCalculation = (raw: any): OrderCalculation => {
  const normalized: OrderCalculation = {
    ...(raw || {}),
    items: Array.isArray(raw?.items) ? raw.items : [],
    subtotal: toNumeric(raw?.subtotal),
    delivery_fee: toNumeric(raw?.delivery_fee),
    delivery_fee_original: raw?.delivery_fee_original !== undefined ? toNumeric(raw?.delivery_fee_original) : undefined,
    tax_amount: toNumeric(raw?.tax_amount),
    discount_amount: toNumeric(raw?.discount_amount),
    shipping_discount_amount: raw?.shipping_discount_amount !== undefined ? toNumeric(raw?.shipping_discount_amount) : undefined,
    total_discount_amount: raw?.total_discount_amount !== undefined ? toNumeric(raw?.total_discount_amount) : undefined,
    total_amount: toNumeric(raw?.total_amount),
    points_earned: toNumeric(raw?.points_earned),
    points_requested: raw?.points_requested !== undefined ? toNumeric(raw?.points_requested) : undefined,
    points_applied: raw?.points_applied !== undefined ? toNumeric(raw?.points_applied) : undefined,
    points_discount_amount: raw?.points_discount_amount !== undefined ? toNumeric(raw?.points_discount_amount) : undefined,
    points_available: raw?.points_available !== undefined ? toNumeric(raw?.points_available) : undefined,
    points_remaining: raw?.points_remaining !== undefined ? toNumeric(raw?.points_remaining) : undefined,
    points_rate: raw?.points_rate !== undefined ? toNumeric(raw?.points_rate) : undefined,
    waived_delivery_fee: raw?.waived_delivery_fee !== undefined ? toNumeric(raw?.waived_delivery_fee) : undefined,
    promo_details: raw?.promo_details,
    delivery_calculation_method: typeof raw?.delivery_calculation_method === 'string'
      ? raw.delivery_calculation_method
      : typeof raw?.delivery_calculation?.calculation_method === 'string'
        ? raw.delivery_calculation.calculation_method
        : typeof raw?.deliveryCalculation?.calculation_method === 'string'
          ? raw.deliveryCalculation.calculation_method
          : undefined,
    points_blocked: raw?.points_blocked === true || raw?.points_blocked === 'true',
  };

  return normalized;
};
const promoNumeric = (value: unknown): number => toNumeric(value);

const calculatePromoDiscount = (promo: PromoCode | null | undefined, orderTotal: number): number => {
  if (!promo) return 0;

  // Free shipping promos don't have a regular discount amount
  // The discount is applied to the delivery fee separately
  if (promo.discount_type === 'free_shipping') {
    return 0;
  }

  const total = Number.isFinite(orderTotal) ? orderTotal : 0;
  const discountValue = promoNumeric(promo.discount_value);
  const maxDiscount = promo.max_discount_amount !== undefined ? promoNumeric(promo.max_discount_amount) : undefined;
  const minOrder = promo.min_order_amount !== undefined ? promoNumeric(promo.min_order_amount) : 0;

  if (minOrder > 0 && total < minOrder) {
    return 0;
  }

  let savings = 0;

  switch (promo.discount_type) {
    case 'percentage': {
      savings = (discountValue / 100) * total;
      break;
    }
    case 'fixed':
    case 'fixed_amount': {
      savings = discountValue;
      break;
    }
    case 'bxgy': {
      savings = discountValue || 10;
      break;
    }
    default: {
      savings = discountValue;
    }
  }

  savings = Math.max(0, savings);

  if (maxDiscount && maxDiscount > 0) {
    savings = Math.min(savings, maxDiscount);
  }

  return Math.min(savings, total);
};

const calculateActualSavings = (promo: PromoCode | null | undefined, orderTotal: number): number => {
  if (!promo) return 0;
  return calculatePromoDiscount(promo, orderTotal);
};

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const isArabic = currentLanguage === 'ar'; // For text direction only
  
  // Debug logging
  console.log('[CheckoutScreen] currentLanguage:', currentLanguage);
  console.log('[CheckoutScreen] isArabic:', isArabic);
  
  const { user, isGuest } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const formatAmount = useCallback((value: unknown) => formatCurrency(value, { isRTL: isArabic }), [isArabic]);

  const { branches, selectedBranchId, setSelectedBranchId, refreshBranches: refreshBranchList } = useBranch();
  const [branchPriceOverrides, setBranchPriceOverrides] = useState<Record<string, number>>({});
  const buildItemPriceKey = useCallback((productId: number, variantId?: number | null) => `${productId}:${variantId ?? 'base'}`, []);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryZone, setDeliveryZone] = useState<'inside_amman' | 'outside_amman' | null>(null); // null = auto-detect
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [orderCalculation, setOrderCalculation] = useState<OrderCalculation | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  
  // Enhanced UI states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [orderProgress, setOrderProgress] = useState(0);
  const [canPlaceOrder, setCanPlaceOrder] = useState(false);
  const [branchStockWarnings, setBranchStockWarnings] = useState<string[]>([]);
  const [branchStockDetails, setBranchStockDetails] = useState<BranchStockWarningDetail[]>([]);
  const [branchStockWarningSource, setBranchStockWarningSource] = useState<BranchStockWarningSource>(null);
  const [branchAvailability, setBranchAvailability] = useState<Record<number, BranchAvailabilityStatus>>({});
  const [branchAvailabilityLoading, setBranchAvailabilityLoading] = useState(false);
  const branchAvailabilityRequestRef = useRef(0);
  const branchAvailabilitySignatureRef = useRef<string | null>(null);
  
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Prevent stale calculateOrder responses from overwriting newer results
  const calcRequestRef = useRef(0);
  // Persist last validated promo to keep free-shipping sticky across recalculations
  const lastValidatedPromoRef = useRef<PromoCode | null>(null);
  // Track if user manually removed promo to prevent auto-reapply
  const promoManuallyRemovedRef = useRef<boolean>(false);

  // Error states for modern error handling
  const [errors, setErrors] = useState({
    addresses: null as string | null,
    calculation: null as string | null,
    promoCode: null as string | null,
    order: null as string | null,
    general: null as string | null,
  });
  const [retryCount, setRetryCount] = useState({
    addresses: 0,
    calculation: 0,
    promoCode: 0,
    order: 0,
  });

  // Guest user information
  const [guestInfo, setGuestInfo] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  // Add custom back button to allow navigation back to cart
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CartMain')}
          style={{ 
            marginLeft: isArabic ? 0 : 15,
            marginRight: isArabic ? 15 : 0,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Icon 
            name={isArabic ? "chevron-forward" : "chevron-back"} 
            size={28} 
            color="#007AFF" 
          />
        </TouchableOpacity>
      ),
      headerTitleAlign: isArabic ? 'left' : 'center',
    });
  }, [navigation, isArabic]);

  useEffect(() => {
    if (branches && branches.length > 0) {
      console.log('[CheckoutScreen] Branch sample payload', JSON.stringify(branches.slice(0, 3), null, 2));
    }
  }, [branches]);
  const getBranchDisplayName = useCallback((input?: Branch | null) => {
    if (!input) {
      return '';
    }

    const raw = input as Branch & Record<string, unknown>;
    
    console.log('[CheckoutScreen] getBranchDisplayName input:', JSON.stringify(raw, null, 2));

    const localizedCandidates = currentLanguage === 'ar'
      ? [raw.title_ar, raw.name_ar, raw.branch_title_ar]
      : [raw.title_en, raw.name_en, raw.branch_title_en];

    const neutralCandidates = [
      raw.title_en,
      raw.title_ar,
      raw.display_name,
      raw.branch_name,
      raw.name,
      raw.title,
    ];

    for (const value of [...localizedCandidates, ...neutralCandidates]) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          console.log('[CheckoutScreen] getBranchDisplayName returning:', trimmed);
          return trimmed;
        }
      }
    }

    const idCandidates = [raw.id, raw.branch_id];
    for (const id of idCandidates) {
      if (typeof id === 'number' && Number.isFinite(id)) {
        console.log('[CheckoutScreen] getBranchDisplayName returning ID fallback:', `#${id}`);
        return `#${id}`;
      }
      if (typeof id === 'string') {
        const trimmed = id.trim();
        if (trimmed.length > 0) {
          console.log('[CheckoutScreen] getBranchDisplayName returning string ID fallback:', `#${trimmed}`);
          return `#${trimmed}`;
        }
      }
    }

    console.warn('[CheckoutScreen] getBranchDisplayName returning empty string for:', raw);
    return '';
  }, [currentLanguage]);

  const getBranchStatus = useCallback((branchId: number): { label: string; color: string; icon: string } => {
    if (branchAvailabilityLoading) {
      return {
        label: t('checkout.branchStatusChecking'),
        color: '#999',
        icon: 'time-outline'
      };
    }

    const availability = branchAvailability[branchId];
    
    if (!availability) {
      return {
        label: t('checkout.branchStatusUnknown'),
        color: '#999',
        icon: 'help-circle-outline'
      };
    }

    switch (availability.status) {
      case 'available':
        if (availability.min_remaining !== null && availability.min_remaining !== undefined) {
          if (availability.min_remaining <= 3) {
            return {
              label: t('checkout.branchStatusLastUnits'),
              color: '#FF9500',
              icon: 'alert-circle-outline'
            };
          } else if (availability.min_remaining <= 10) {
            return {
              label: t('checkout.branchStatusLimited'),
              color: '#FF9500',
              icon: 'warning-outline'
            };
          }
        }
        return {
          label: t('checkout.branchStatusAvailable'),
          color: '#34C759',
          icon: 'checkmark-circle'
        };
      case 'unavailable':
        return {
          label: t('checkout.branchStatusUnavailable'),
          color: '#FF3B30',
          icon: 'close-circle'
        };
      case 'inactive':
        return {
          label: t('checkout.branchStatusInactive'),
          color: '#999',
          icon: 'ban-outline'
        };
      case 'error':
        return {
          label: t('checkout.branchStatusError'),
          color: '#FF3B30',
          icon: 'alert-circle-outline'
        };
      default:
        return {
          label: t('checkout.branchStatusUnknown'),
          color: '#999',
          icon: 'help-circle-outline'
        };
    }
  }, [branchAvailability, branchAvailabilityLoading, t]);
  const [guestErrors, setGuestErrors] = useState<{ [key: string]: string }>({});

  // Guest GPS functionality
  const [guestLocation, setGuestLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [guestLocationLoading, setGuestLocationLoading] = useState(false);
  const [guestUseAutoLocation, setGuestUseAutoLocation] = useState(false);

  // Guest Map Modal States (matching AddressFormScreen)
  const [showGuestMapModal, setShowGuestMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 31.9539, // Default to Amman, Jordan
    longitude: 35.9106,
  });
  const [mapLocation, setMapLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<Array<{
    place: string;
    text: string;
    structuredFormat?: {
      mainText: string;
      secondaryText: string;
    };
  }>>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [autocompleteSessionToken, setAutocompleteSessionToken] = useState(generateSessionToken());

  const paymentMethods = [
    { id: 'cash', title: t('checkout.paymentMethods.cash'), icon: 'cash-outline' },
    { id: 'card', title: t('checkout.paymentMethods.card'), icon: 'card-outline' },
    // Temporarily hidden: E-Wallet payment option
    // { id: 'wallet', title: t('checkout.paymentMethods.wallet'), icon: 'wallet-outline' },
  ];

  const parseNumericValue = useCallback((value: unknown): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') {
      return Number.isNaN(value) ? 0 : value;
    }
    const parsed = parseFloat(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
  }, []);

  const hydrateVariant = useCallback((item: CartItem) => {
    if (item.variant) {
      return normalizeVariantPricingMetadata(item.variant);
    }
    if (item.variant_id && item.product?.variants) {
      const matched = item.product.variants.find(variant => variant.id === item.variant_id);
      if (matched) {
        return normalizeVariantPricingMetadata(matched);
      }
    }
    return null;
  }, []);

  const normalizeVariantKey = useCallback((value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }
    const isAscii = /^[\u0000-\u007F]+$/.test(trimmed);
    if (!isAscii) {
      return null;
    }
    return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }, []);

  const translateVariantAttribute = useCallback((attribute?: string | null) => {
    if (!attribute) {
      return null;
    }
    const normalized = normalizeVariantKey(attribute);
    if (!normalized) {
      return attribute;
    }
    return t(`products.attributes.${normalized}`, { defaultValue: attribute });
  }, [normalizeVariantKey, t]);

  const translateVariantValue = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }
    const normalized = normalizeVariantKey(value);
    if (!normalized) {
      return value;
    }
    return t(`products.variantValues.${normalized}`, { defaultValue: value });
  }, [normalizeVariantKey, t]);

  const getVariantLabel = useCallback((item: CartItem): string | null => {
    // Handle multiple variants (new multi-select feature)
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
      const variantLabels = item.variants.map(variant => {
        // Prioritize localized title
        const localizedTitle = currentLanguage === 'ar'
          ? (variant.title_ar || variant.title_en || '').trim()
          : (variant.title_en || variant.title_ar || '').trim();
        
        if (localizedTitle.length > 0) {
          return localizedTitle;
        }
        
        // Fallback to variant_name: variant_value
        const rawAttribute = variant.variant_name || null;
        const rawValue = variant.variant_value || null;
        
        const attributeLabel = translateVariantAttribute(rawAttribute);
        const valueLabel = translateVariantValue(rawValue);
        
        if (attributeLabel && valueLabel && attributeLabel !== valueLabel) {
          return `${attributeLabel}: ${valueLabel}`;
        }
        return valueLabel || attributeLabel || rawValue || rawAttribute;
      }).filter(Boolean);
      
      return variantLabels.length > 0 ? variantLabels.join(', ') : null;
    }
    
    // Handle single variant (legacy)
    const variant = hydrateVariant(item);
    if (!variant) {
      return null;
    }

    // Prioritize localized title (title_ar/title_en) for proper multilingual support
    const localizedTitle = isRTL
      ? (variant.title_ar || variant.title_en || '').trim()
      : (variant.title_en || variant.title_ar || '').trim();

    // Return localized title if available
    if (localizedTitle.length > 0) {
      return localizedTitle;
    }

    // Fallback to translated variant_name and variant_value
    const rawAttribute = variant.variant_name || null;
    const rawValue = variant.variant_value || null;

    const attributeLabel = translateVariantAttribute(rawAttribute);
    const effectiveValueSource = rawValue ?? (rawAttribute && !rawValue ? rawAttribute : null);
    const valueLabel = translateVariantValue(effectiveValueSource);

    if (attributeLabel && valueLabel && attributeLabel !== valueLabel) {
      return `${attributeLabel}: ${valueLabel}`;
    }

    if (valueLabel) {
      return valueLabel;
    }

    if (attributeLabel) {
      return attributeLabel;
    }

    return null;
  }, [hydrateVariant, isRTL, translateVariantAttribute, translateVariantValue]);

  const getItemUnitPrice = useCallback((item: CartItem): number => {
    const key = buildItemPriceKey(item.product_id, item.variant_id ?? null);
    if (Object.prototype.hasOwnProperty.call(branchPriceOverrides, key)) {
      const overridePrice = branchPriceOverrides[key];
      if (typeof overridePrice === 'number' && Number.isFinite(overridePrice)) {
        return overridePrice;
      }
    }

    if (typeof item.unit_price === 'number' && Number.isFinite(item.unit_price) && item.unit_price > 0) {
      return item.unit_price;
    }

    const basePrice = parseNumericValue(
      item.product?.final_price ?? item.product?.sale_price ?? item.product?.base_price
    );

    // Handle multiple variants (considering override and add behaviors with priority)
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
      let currentPrice = basePrice;
      
      // Separate override and add variants
      const overrideVariants = item.variants.filter((v: any) => 
        v.price_behavior === 'override'
      );
      const addVariants = item.variants.filter((v: any) => 
        v.price_behavior !== 'override'
      );
      
      // Sort override variants by priority (lower number = higher priority)
      const sortedOverrides = [...overrideVariants].sort((a: any, b: any) => {
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
        const modifier = parseFloat(String((variant as any).price_modifier || 0));
        currentPrice += modifier;
      }
      
      return currentPrice;
    }

    // Handle single variant (legacy)
    const variant = hydrateVariant(item);
    if (variant) {
      const { unitPrice } = computeVariantPriceFromBase(basePrice, variant);
      if (unitPrice > 0) {
        return unitPrice;
      }
    }

    return basePrice;
  }, [branchPriceOverrides, buildItemPriceKey, hydrateVariant, parseNumericValue]);

  const getProductTitle = useCallback((item: CartItem): string => {
    // Try localized title first
    const localizedTitle = currentLanguage === 'ar' ? item.product?.title_ar : item.product?.title_en;
    if (localizedTitle && localizedTitle.trim().length > 0) {
      return localizedTitle.trim();
    }
    
    // Try opposite language as fallback
    const fallbackTitle = currentLanguage === 'ar' ? item.product?.title_en : item.product?.title_ar;
    if (fallbackTitle && fallbackTitle.trim().length > 0) {
      return fallbackTitle.trim();
    }
    
    // Try other title fields
    const product = item.product as any;
    const titleCandidates = [
      product?.title,
      product?.name,
      product?.product_name,
      product?.display_name,
    ];
    
    for (const candidate of titleCandidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    
    return t('checkout.itemUnknownProduct', { id: item.product_id });
  }, [isRTL, t]);

  const buildFriendlyStockDetail = useCallback(
    (rawMessage?: string | null): BranchStockWarningDetail => {
      const fallbackMessage = t('checkout.insufficientStockGeneric');
      const suggestion = t('checkout.insufficientStockSuggestion');
      const baseDetail: BranchStockWarningDetail = {
        message: fallbackMessage,
        suggestion,
      };

      if (!rawMessage || typeof rawMessage !== 'string') {
        return baseDetail;
      }

      const sanitizedMessage = rawMessage.replace(/^calculate order error:\s*/i, '').trim() || rawMessage;

      const variantMatch = sanitizedMessage.match(/variant(?:\s+with)?\s+id\s*(\d+)/i);
      if (variantMatch) {
        const variantId = Number(variantMatch[1]);
        const matchedVariantItem = items?.find(item => Number(item.variant_id) === variantId);
        if (matchedVariantItem) {
          const productTitle = getProductTitle(matchedVariantItem);
          const variantLabel = getVariantLabel(matchedVariantItem);
          if (variantLabel) {
            return {
              message: t('checkout.insufficientStockForVariant', {
                product: productTitle,
                variant: variantLabel,
              }),
              productTitle,
              variantLabel,
              suggestion,
            };
          }
          return {
            message: t('checkout.insufficientStockForItem', { product: productTitle }),
            productTitle,
            suggestion,
          };
        }
      }

      const productMatch = sanitizedMessage.match(/product(?:\s+with)?\s+id\s*(\d+)/i);
      if (productMatch) {
        const productId = Number(productMatch[1]);
        const matchedProductItem = items?.find(item => Number(item.product_id) === productId);
        if (matchedProductItem) {
          const productTitle = getProductTitle(matchedProductItem);
          return {
            message: t('checkout.insufficientStockForItem', { product: productTitle }),
            productTitle,
            suggestion,
          };
        }
      }

      const normalized = sanitizedMessage.toLowerCase();
      if (
        normalized.includes('insufficient stock') ||
        normalized.includes('out of stock') ||
        normalized.includes('branch inventory') ||
        normalized.includes('not available')
      ) {
        return baseDetail;
      }

      return {
        message: sanitizedMessage,
        suggestion,
      };
    },
    [getProductTitle, getVariantLabel, items, t]
  );

  const localizeCalculationErrorMessage = useCallback(
    (rawMessage?: string | null) => {
      if (!rawMessage || typeof rawMessage !== 'string') {
        return t('checkout.errorCalculating');
      }

      const sanitized = rawMessage.replace(/^calculate order error:\s*/i, '').trim() || rawMessage;

      // Check for variant errors and translate them
      if (sanitized.includes('Product variant') || sanitized.includes('product variant')) {
        return t('checkout.productVariantNotFound');
      }

      const detail = buildFriendlyStockDetail(rawMessage);

      if (detail.message && detail.message !== sanitized) {
        return detail.message;
      }

      const stockPattern = /(insufficient stock|out of stock|branch inventory|not available)/i;
      if (stockPattern.test(sanitized)) {
        return detail.message;
      }

      return sanitized.length > 0 ? sanitized : t('checkout.errorCalculating');
    },
    [buildFriendlyStockDetail, t]
  );

  // Error recovery functions
  const clearError = (errorType: keyof typeof errors) => {
    setErrors(prev => ({ ...prev, [errorType]: null }));
  };

  const clearAllErrors = () => {
    setErrors({
      addresses: null,
      calculation: null,
      promoCode: null,
      order: null,
      general: null,
    });
  };

  const handleError = (errorType: keyof typeof errors, error: any, fallbackMessage: string) => {
    const errorMessage = error instanceof Error ? error.message : 
                        (typeof error === 'string' ? error : fallbackMessage);
    
    setErrors(prev => ({ ...prev, [errorType]: errorMessage }));
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      clearError(errorType);
    }, 5000);
  };

  const canRetry = (type: keyof typeof retryCount) => retryCount[type] < 3;

  const incrementRetry = (type: keyof typeof retryCount) => {
    setRetryCount(prev => ({ ...prev, [type]: prev[type] + 1 }));
  };

  // Guest location functions
  const requestLocationPermission = async (): Promise<boolean> => {
    console.log('🔐 requestLocationPermission called for platform:', Platform.OS);
    
    if (Platform.OS === 'android') {
      try {
        console.log('🤖 Requesting Android location permission...');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('address.locationPermissionTitle'),
            message: t('address.locationPermissionMessage'),
            buttonNeutral: t('common.cancel'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        console.log('🤖 Android permission result:', granted);
        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('🤖 Has Android permission:', hasPermission);
        return hasPermission;
      } catch (err) {
        console.error('🚨 Android permission request error:', err);
        return false;
      }
    }
    console.log('🍎 iOS platform - assuming permission available');
    return true; // iOS handles permissions differently
  };

  const getGuestCurrentLocation = async () => {
    console.log('🗺️ getGuestCurrentLocation called');
    setGuestLocationLoading(true);
    
    try {
      const hasPermission = await requestLocationPermission();
      console.log('🔐 Location permission granted:', hasPermission);
      
      if (!hasPermission) {
        setGuestLocationLoading(false);
        Alert.alert(
          t('address.locationPermissionDenied'),
          t('address.locationPermissionDeniedMessage')
        );
        return;
      }

      console.log('📍 Starting GPS getCurrentPosition (high accuracy)...');
      
      // Try high accuracy first
      Geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ GPS Position obtained (high accuracy):', position);
          const { latitude, longitude } = position.coords;
          console.log('📍 Coordinates:', { latitude, longitude });
          
          // Store GPS coordinates to supplement the text address
          setGuestLocation({ latitude, longitude });
          setGuestUseAutoLocation(true);
          setGuestLocationLoading(false);
          
          // Show success toast
          setToastMessage(t('address.locationDetected'));
          setToastType('success');
          setShowToast(true);
          
          // Trigger recalculation with GPS coordinates
          calculateOrder();
        },
        (error) => {
          console.error('❌ GPS Error (high accuracy):', error);
          console.error('GPS Error Code:', error.code);
          console.error('GPS Error Message:', error.message);
          
          // If high accuracy fails with code 2 (POSITION_UNAVAILABLE), try low accuracy
          if (error.code === 2) {
            console.log('⚠️ High accuracy failed, trying low accuracy (network-based)...');
            
            Geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ GPS Position obtained (low accuracy):', position);
                const { latitude, longitude } = position.coords;
                console.log('📍 Coordinates (network-based):', { latitude, longitude });
                
                setGuestLocation({ latitude, longitude });
                setGuestUseAutoLocation(true);
                setGuestLocationLoading(false);
                
                setToastMessage(t('address.locationDetected') + ' (Network)');
                setToastType('success');
                setShowToast(true);
                
                calculateOrder();
              },
              (fallbackError) => {
                console.error('❌ GPS Error (low accuracy):', fallbackError);
                console.error('❌ Error code:', fallbackError?.code, '- TIMEOUT (3), POSITION_UNAVAILABLE (2), PERMISSION_DENIED (1)');
                setGuestLocationLoading(false);
                
                let errorMessage = t('address.locationErrorMessage');
                if (fallbackError.code === 1) {
                  errorMessage = 'Location access denied. Please enable location services in your device settings.';
                } else if (fallbackError.code === 2) {
                  errorMessage = 'Location unavailable. Please ensure location services are enabled and try moving to a more open area.';
                } else if (fallbackError.code === 3) {
                  errorMessage = 'Location request timed out. Please try again in a moment.';
                }
                
                Alert.alert(
                  t('address.locationError'),
                  errorMessage
                );
              },
              {
                enableHighAccuracy: false, // Use network-based location
                timeout: 15000, // Reduced from 30s to 15s to fail faster
                maximumAge: 30000, // Reduced from 10s to 30s for fresher data
              }
            );
            return; // Don't show error alert yet, wait for fallback
          }
          
          // For other errors (permission denied or timeout), show error immediately
          setGuestLocationLoading(false);
          
          let errorMessage = t('address.locationErrorMessage');
          if (error.code === 1) {
            errorMessage = 'Location access denied. Please enable location services in your device settings.';
          } else if (error.code === 3) {
            errorMessage = 'Location request timed out. Please try again.';
          }
          
          Alert.alert(
            t('address.locationError'),
            errorMessage
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 25000, // Increased to 25s to give GPS time to acquire satellites
          maximumAge: 5000,
        }
      );
    } catch (error) {
      console.error('🚨 Exception in getGuestCurrentLocation:', error);
      setGuestLocationLoading(false);
      Alert.alert(
        t('address.locationError'),
        'An unexpected error occurred while getting your location.'
      );
    }
  };

  const clearGuestLocation = () => {
    console.log('🗑️ Clearing GPS location');
    setGuestLocation(null);
    setGuestUseAutoLocation(false);
    
    setToastMessage(t('address.locationCleared'));
    setToastType('info');
    setShowToast(true);
    
    // Trigger recalculation without GPS coordinates
    calculateOrder();
  };

  // Guest Map Modal Handlers (matching AddressFormScreen)
  const handleOpenGuestMapModal = () => {
    // If guest already has GPS location, use it as the initial map region
    if (guestLocation) {
      setMapRegion({
        latitude: guestLocation.latitude,
        longitude: guestLocation.longitude,
      });
      setMapLocation(guestLocation);
    } else {
      // Default to Amman, Jordan
      setMapRegion({ latitude: 31.9539, longitude: 35.9106 });
      setMapLocation(null);
    }
    setMapSearchQuery('');
    setMapSearchResults([]);
    setMapError(null);
    setShowGuestMapModal(true);
  };

  const searchPlaces = async (query: string) => {
    if (!query || query.trim().length < 3) {
      setMapSearchResults([]);
      return;
    }

    setIsSearchingMap(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      // Call backend proxy for Google Places Autocomplete (New API)
      const url = `${API_BASE_URL}/places/autocomplete`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          sessionToken: autocompleteSessionToken,
          languageCode: isArabic ? 'ar' : 'en',
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        console.error(`Places autocomplete failed with status ${response.status}`);
        setMapSearchResults([]);
        return;
      }
      
      const data = await response.json();
      
      // Ensure suggestions is an array
      if (!Array.isArray(data.suggestions)) {
        console.warn('Places API returned invalid data format');
        setMapSearchResults([]);
        return;
      }
      
      // Map Google Places API (New) suggestions to our result format
      const results = data.suggestions
        .filter((suggestion: any) => suggestion.placePrediction)
        .map((suggestion: any) => ({
          place: suggestion.placePrediction.place,
          text: suggestion.placePrediction.text?.text || '',
          structuredFormat: suggestion.placePrediction.structuredFormat,
        }));
      
      setMapSearchResults(results);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Map search request timed out');
      } else {
        console.error('Map search error:', error);
      }
      setMapSearchResults([]);
    } finally {
      setIsSearchingMap(false);
    }
  };

  // Fetch place details from backend proxy to get coordinates
  const fetchPlaceDetails = async (placeId: string) => {
    try {
      const url = new URL(`${API_BASE_URL}/places/details`);
      url.searchParams.append('place_id', placeId);
      url.searchParams.append('sessionToken', autocompleteSessionToken);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`Place Details failed with status ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data.location) {
        console.error('Place Details API error: No location in response');
        return null;
      }
      
      return {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      };
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  };

  const selectSearchResult = async (result: { place: string; text: string }) => {
    // Show loading state
    setIsSearchingMap(true);
    
    // Fetch place details to get coordinates
    const location = await fetchPlaceDetails(result.place);
    
    setIsSearchingMap(false);
    
    if (location) {
      setMapLocation(location);
      setMapRegion(location);
      setMapSearchQuery('');
      setMapSearchResults([]);
      
      // Generate new session token for next search session
      // (current session concludes after place selection)
      setAutocompleteSessionToken(generateSessionToken());
      
      // Send message to WebView to update map
      // This will be handled by the WebView's message handler
    } else {
      Alert.alert(
        t('common.error'),
        t('address.failedToGetLocation') || 'Failed to get location details. Please try again.'
      );
    }
  };

  const confirmMapLocation = () => {
    if (!mapLocation) {
      Alert.alert(
        t('common.error'),
        'Please select a location on the map first.'
      );
      return;
    }

    setGuestLocation(mapLocation);
    setGuestUseAutoLocation(true);
    setShowGuestMapModal(false);
    
    setToastMessage(t('address.locationUpdated') || 'Location updated');
    setToastType('success');
    setShowToast(true);
    
    // Trigger recalculation with new GPS coordinates
    calculateOrder();
  };

  // Check for Amman-only delivery restriction violations
  const ammanOnlyRestrictionWarning = useMemo(() => {
    if (orderType !== 'delivery' || deliveryZone !== 'outside_amman') {
      return null;
    }
    
    const ammanOnlyItems = items.filter(item => item.product?.amman_only_delivery === 1);
    if (ammanOnlyItems.length === 0) {
      return null;
    }

    return {
      count: ammanOnlyItems.length,
      items: ammanOnlyItems.map(item => {
        const productName = isArabic ? (item.product?.title_ar || item.product?.title_en) : (item.product?.title_en || item.product?.title_ar);
        return productName || 'Unknown Product';
      })
    };
  }, [items, orderType, deliveryZone, isArabic]);

  // Validation effect to check if order can be placed
  useEffect(() => {
    const validateOrder = () => {
      let isValid = true;
      let progress = 0;
      
      // Check cart items
      if (items && items.length > 0) {
        progress += 20;
      } else {
        isValid = false;
      }
      
      // Check for Amman-only delivery restrictions
      if (orderType === 'delivery' && deliveryZone === 'outside_amman') {
        const ammanOnlyItems = items.filter(item => item.product?.amman_only_delivery === 1);
        if (ammanOnlyItems.length > 0) {
          isValid = false;
        }
      }
      
      // Check address for delivery
      if (orderType === 'delivery') {
        if (isGuest) {
          // For guest delivery orders, require both address and GPS location
          if (guestInfo.address.trim() && guestLocation && guestUseAutoLocation) {
            progress += 20;
          } else {
            isValid = false;
          }
        } else if (!isGuest && selectedAddress) {
          progress += 20;
        } else {
          isValid = false;
        }
      } else {
        progress += 20; // No address needed for pickup
      }
      
      // Check guest info
      if (isGuest) {
        if (guestInfo.fullName.trim() && guestInfo.phone.trim()) {
          progress += 20;
        } else {
          isValid = false;
        }
      } else {
        progress += 20; // User info available
      }
      
      // Check branch selection
      if (selectedBranchId || branches[0]?.id) {
        progress += 20;
      } else {
        isValid = false;
      }
      
      // Check order calculation
      const totalsReady =
        orderCalculation !== null &&
        orderCalculation?.total_amount !== undefined &&
        orderCalculation?.total_amount !== null &&
        Number.isFinite(Number(orderCalculation?.total_amount));

      if (totalsReady) {
        progress += 20;
      } else {
        isValid = false;
      }

      if (branchStockWarnings.length > 0) {
        isValid = false;
      }
      
      setOrderProgress(progress);
      setCanPlaceOrder(isValid);
    };
    
    validateOrder();
  }, [items, orderType, isGuest, guestInfo, selectedAddress, selectedBranchId, branches, orderCalculation, branchStockWarnings, guestLocation, guestUseAutoLocation, deliveryZone]);

  useEffect(() => {
    calculateOrder();
  }, [selectedAddress, orderType, appliedPromo]);

  // 🔄 SOLUTION: Recalculate when cart items change (variant selection, quantity, etc.)
  useEffect(() => {
    if (items && items.length > 0) {
      console.log('🔄 Cart items changed - triggering recalculation for variant prices');
      calculateOrder();
    }
  }, [items]);

  // Recalculate when guest info changes (for delivery orders)
  useEffect(() => {
    if (isGuest && orderType === 'delivery' && guestInfo.address.trim()) {
      console.log('🔄 Guest delivery info changed - triggering recalculation');
      calculateOrder();
    }
  }, [isGuest, guestInfo.address, guestInfo.phone, guestInfo.fullName]);

  // Recalculate when branch changes (price overrides will be updated in calculateOrder)
  useEffect(() => {
    if (selectedBranchId) {
      console.log('🔄 Branch changed to:', selectedBranchId, '- triggering recalculation');
      calculateOrder();
    }
  }, [selectedBranchId]);

  // Recalculate when branches list loads initially
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      calculateOrder();
    }
  }, [branches.length]);

  // Recalculate when delivery zone changes
  useEffect(() => {
    if (deliveryZone && orderType === 'delivery') {
      console.log('🗺️ Delivery zone changed to:', deliveryZone, '- triggering recalculation');
      calculateOrder();
    }
  }, [deliveryZone]);

  useEffect(() => {
    if (orderType !== 'pickup') {
      return;
    }

    const hasFreeShippingPromo = appliedPromo?.discount_type === 'free_shipping';
    const hasFreeShippingRef = lastValidatedPromoRef.current?.discount_type === 'free_shipping';

    if (!hasFreeShippingPromo && !hasFreeShippingRef) {
      return;
    }

    if (hasFreeShippingPromo) {
      setAppliedPromo(null);
    }

    if (hasFreeShippingRef) {
      lastValidatedPromoRef.current = null;
    }

    setPromoCode(prev => (prev ? '' : prev));
    promoManuallyRemovedRef.current = true;

    setToastMessage(t('checkout.freeShippingRemovedForPickup'));
    setToastType('info');
    setShowToast(true);
  }, [orderType, appliedPromo, t]);

  const resolveOrderId = useCallback((payload: any): string | null => {
    if (!payload) {
      return null;
    }

    const candidates = [
      payload?.order?.id,
      payload?.order?.order_id,
      payload?.order?.orders_id,
      payload?.order?.orderId,
      payload?.order?.orderID,
      payload?.order?.order_number,
      payload?.order?.orderNumber,
      payload?.order?.order_reference,
      payload?.order?.orderReference,
      payload?.order_id,
      payload?.orders_id,
      payload?.orderId,
      payload?.orderID,
      payload?.order_number,
      payload?.orderNumber,
      payload?.order_reference,
      payload?.orderReference,
      payload?.id,
      payload?.reference,
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        const value = String(candidate).trim();
        if (value.length > 0 && value.toLowerCase() !== 'null' && value.toLowerCase() !== 'undefined') {
          return value;
        }
      }
    }

    return null;
  }, []);

  const navigateToOrdersTab = useCallback(
    (params?: Record<string, any>) => {
      const parentNavigation = typeof navigation.getParent === 'function' ? navigation.getParent() : null;
      const finalParams = params ?? { refresh: true };

      if (parentNavigation) {
        parentNavigation.navigate('Orders', {
          screen: 'OrdersMain',
          params: finalParams,
        });
      } else {
        navigation.navigate('Orders', finalParams);
      }
    },
    [navigation]
  );

  const navigateToHomeTab = useCallback(() => {
    const parentNavigation = typeof navigation.getParent === 'function' ? navigation.getParent() : null;

    if (parentNavigation) {
      parentNavigation.navigate('Home');
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const redirectToOrdersForPayment = useCallback(
    (orderId: string, session?: PaymentSession | null) => {
      if (!orderId) {
        return;
      }

      const params: Record<string, any> = {
        refresh: true,
        autoPayOrderId: orderId,
      };

      if (session) {
        params.autoPaySession = session;
      }

      navigateToOrdersTab(params);
    },
    [navigateToOrdersTab]
  );


  // Load active branches
  const loadBranches = React.useCallback(async () => {
    try {
      await refreshBranchList();
    } catch (error) {
      console.warn('Failed to refresh branches for checkout:', error);
    }
  }, [refreshBranchList]);

  const fetchBranchAvailability = useCallback(async () => {
    if (!items || items.length === 0 || !branches || branches.length === 0) {
      setBranchAvailability({});
      return;
    }

    const payloadItems = items.map(item => ({
      product_id: Number(item?.product_id),
      variant_id: item?.variant_id ? Number(item.variant_id) : undefined,
      quantity: Number(item?.quantity || 1),
    }));

    const branchIds = branches
      .map(branch => branch?.id)
      .filter(id => typeof id === 'number') as number[];

    if (branchIds.length === 0) {
      setBranchAvailability({});
      return;
    }

    const requestId = ++branchAvailabilityRequestRef.current;
    setBranchAvailabilityLoading(true);
    setBranchAvailability({});

    try {
      const response = await ApiService.getBranchAvailability({
        items: payloadItems,
        branch_ids: branchIds,
      });

      if (requestId !== branchAvailabilityRequestRef.current) {
        return;
      }

      if (response?.success && response?.data?.branches) {
        const availabilityMap: Record<number, BranchAvailabilityStatus> = {};
        response.data.branches.forEach(entry => {
          if (entry && typeof entry.branch_id === 'number') {
            availabilityMap[entry.branch_id] = entry as BranchAvailabilityStatus;
          }
        });
        setBranchAvailability(availabilityMap);
      } else {
        setBranchAvailability({});
      }
    } catch (error) {
      console.error('Failed to load branch availability', error);
      if (requestId === branchAvailabilityRequestRef.current) {
        setBranchAvailability({});
      }
    } finally {
      if (requestId === branchAvailabilityRequestRef.current) {
        setBranchAvailabilityLoading(false);
      }
    }
  }, [items, branches]);

  const resolveBranchStatus = useCallback(
    (branchId: number): BranchStatusPresentation => {
      const info = branchAvailability[branchId];

      if (!info) {
        if (branchAvailabilityLoading) {
          return {
            label: t('checkout.branchStatusChecking'),
            tone: 'loading',
          };
        }

        return {
          label: t('checkout.branchStatusUnknown'),
          tone: 'unknown',
        };
      }

      if (info.status === 'inactive') {
        return {
          label: t('checkout.branchStatusInactive'),
          tone: 'inactive',
          message: info.message,
          issues: info.issues,
        };
      }

      if (info.status === 'available') {
        let tone: BranchStatusTone = 'available';
        let label = t('checkout.branchStatusAvailable');

        const minRemaining =
          typeof info.min_remaining === 'number' && Number.isFinite(info.min_remaining)
            ? info.min_remaining
            : null;

        if (minRemaining !== null) {
          if (minRemaining <= 0) {
            tone = 'warning';
            label = t('checkout.branchStatusLastUnits');
          } else if (minRemaining <= 2) {
            tone = 'limited';
            label = t('checkout.branchStatusLimited');
          }
        }

        return {
          label,
          tone,
        };
      }

      if (info.status === 'unavailable') {
        return {
          label: t('checkout.branchStatusUnavailable'),
          tone: 'unavailable',
          message: info.message,
          issues: info.issues,
        };
      }

      return {
        label: t('checkout.branchStatusError'),
        tone: 'error',
        message: info.message,
        issues: info.issues,
      };
    },
    [branchAvailability, branchAvailabilityLoading, t]
  );

  // Haversine distance in KM
  const distanceKm = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  // Determine nearest branch based on selected address coords or guest location
  const pickNearestBranch = useCallback(() => {
    try {
      console.log('🔍 pickNearestBranch called - State:', {
        isGuest,
        guestLocationExists: !!guestLocation,
        guestLocation,
        selectedAddressExists: !!selectedAddress,
        branchesCount: branches.length,
        currentBranchId: selectedBranchId,
      });

      if (branches.length === 0) {
        console.log('⏭️ Skipping nearest branch - no branches loaded yet');
        return;
      }

      // Get coordinates from either logged-in user's address or guest location
      let latitude: number | null = null;
      let longitude: number | null = null;
      let hasLocationData = false;

      if (isGuest && guestLocation) {
        // For guests, use GPS location
        latitude = guestLocation.latitude;
        longitude = guestLocation.longitude;
        hasLocationData = true;
        console.log('🗺️ Using guest GPS location for nearest branch:', { latitude, longitude });
      } else if (selectedAddress) {
        // For logged-in users, use address coordinates
        const addressLat = (selectedAddress as any)?.latitude ?? (selectedAddress as any)?.lat;
        const addressLng = (selectedAddress as any)?.longitude ?? (selectedAddress as any)?.lng;
        latitude = addressLat;
        longitude = addressLng;
        hasLocationData = true;
        console.log('🗺️ Using logged-in user address for nearest branch:', { latitude, longitude });
      }

      if (!hasLocationData || !latitude || !longitude) {
        console.log('⚠️ No coordinates available for nearest branch detection');
        // Only check for valid selection if we don't have location data
        const normalizedSelected = selectedBranchId ?? null;
        const hasValidSelection = normalizedSelected !== null && branches.some(branch => {
          const branchIdNumeric = Number(branch?.id);
          return Number.isFinite(branchIdNumeric) && branchIdNumeric === Number(normalizedSelected);
        });

        if (hasValidSelection) {
          console.log('✓ Keeping current branch selection (no location data):', normalizedSelected);
        }
        return;
      }

      // When we have location data, always find the nearest branch (override defaults)
      console.log('📍 Searching for nearest branch among', branches.length, 'branches...');
      let bestId: number | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const branch of branches) {
        const branchIdNumeric = Number(branch?.id);
        if (!Number.isFinite(branchIdNumeric)) {
          continue;
        }

        const d = distanceKm(latitude, longitude, Number(branch.latitude), Number(branch.longitude));
        console.log(`  Branch ${branchIdNumeric}: ${d?.toFixed(2)} km`);
        if (d !== null && d < bestDist) {
          bestDist = d;
          bestId = branchIdNumeric;
        }
      }

      if (bestId !== null) {
        const normalizedSelected = selectedBranchId ?? null;
        
        // Only auto-select if no branch is currently selected
        // This prevents overriding user's manual selection when they change branch
        if (normalizedSelected === null) {
          console.log('✅ Auto-selecting nearest branch:', bestId, 'Distance:', bestDist?.toFixed(2), 'km');
          
          // Get branch name for notification
          const selectedBranch = branches.find(b => b.id === bestId);
          const branchName = getBranchDisplayName(selectedBranch);
          
          setSelectedBranchId(bestId);
          
          // Show notification to user
          setToastMessage(
            t('checkout.nearestBranchSelected', { 
              branch: branchName, 
              distance: bestDist?.toFixed(1) 
            })
          );
          setToastType('info');
          setShowToast(true);
        } else if (bestId !== normalizedSelected) {
          console.log('ℹ️ User has selected branch:', normalizedSelected, '- keeping selection (nearest is:', bestId, ')');
        } else {
          console.log('ℹ️ Nearest branch is already selected:', bestId, 'Distance:', bestDist?.toFixed(2), 'km');
        }
      } else {
        console.log('❌ No valid branch found');
      }
    } catch (error) {
      console.warn('❌ Failed to auto-select nearest branch:', error);
    }
  }, [branches, selectedAddress, selectedBranchId, setSelectedBranchId, isGuest, guestLocation]);

  // Auto-select nearest branch only when location changes, not when user manually selects
  useEffect(() => {
    pickNearestBranch();
  }, [branches, selectedAddress, isGuest, guestLocation]);

  useEffect(() => {
    if (showBranchModal) {
      fetchBranchAvailability();
    }
  }, [showBranchModal, fetchBranchAvailability]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    if (!branches || branches.length === 0) return;
    const branchIdsSignature = branches
      .map(branch => branch?.id)
      .filter(id => typeof id === 'number')
      .sort((a, b) => a - b)
      .join(',');
    const itemsSignature = items
      .map(item => `${item?.product_id ?? 'x'}:${item?.variant_id ?? 'base'}:${item?.quantity ?? 0}`)
      .sort()
      .join('|');
    const signature = `${branchIdsSignature}__${itemsSignature}`;

    if (branchAvailabilitySignatureRef.current === signature) {
      return;
    }

    branchAvailabilitySignatureRef.current = signature;
    const fetchPromise = fetchBranchAvailability();
    fetchPromise.catch(() => {
      branchAvailabilitySignatureRef.current = null;
    });
  }, [branches, items, fetchBranchAvailability]);

  useEffect(() => {
    if (!selectedBranchId) {
      if (branchStockWarningSource === 'status' && branchStockWarnings.length > 0) {
        setBranchStockWarnings([]);
        setBranchStockDetails([]);
        setBranchStockWarningSource(null);
      }
      return;
    }

    const availabilityInfo = branchAvailability[selectedBranchId];

    if (!availabilityInfo) {
      return;
    }

    if (['unavailable', 'inactive', 'error'].includes(availabilityInfo.status)) {
      const issues = Array.isArray(availabilityInfo.issues) ? availabilityInfo.issues : [];
      const fallbackMessage = availabilityInfo.message || t('checkout.branchStockUnavailable');
      const warnings = issues.length > 0 ? issues : [fallbackMessage];
      const filteredWarnings = warnings.filter(Boolean);

      if (filteredWarnings.length === 0) {
        return;
      }

      // Use buildFriendlyStockDetail to show product names instead of IDs
      const detailedWarnings = filteredWarnings.map(msg => buildFriendlyStockDetail(msg));
      const warningMessages = detailedWarnings.map(d => d.message);
      
      const existingKey = branchStockWarnings.join('||');
      const nextKey = warningMessages.join('||');

      if (branchStockWarningSource !== 'status' || existingKey !== nextKey) {
        setBranchStockWarnings(warningMessages);
        setBranchStockDetails(detailedWarnings);
        setBranchStockWarningSource('status');
        // Don't show toast - warnings are already visible in the banner
      }
    } else if (branchStockWarningSource === 'status' && branchStockWarnings.length > 0) {
      setBranchStockWarnings([]);
      setBranchStockDetails([]);
      setBranchStockWarningSource(null);
    }
  }, [
    selectedBranchId,
    branchAvailability,
    branchStockWarnings,
    branchStockWarningSource,
    t,
    buildFriendlyStockDetail
  ]);

  // Auto-apply promo codes functionality
  useEffect(() => {
    const autoApplyBestPromo = async () => {
      // Only auto-apply if:
      // 1. No promo is currently applied
      // 2. We have a valid order total
      // 3. We're not currently validating a promo
      // 4. User hasn't manually removed a promo
      if (appliedPromo || !orderCalculation?.subtotal || validatingPromo || promoCode.trim() || promoManuallyRemovedRef.current) {
        return;
      }

      const totalAmount = orderCalculation.subtotal || 0;
      if (totalAmount <= 0) {
        return;
      }

      try {
        console.log('🎫 Auto-detecting available promo codes for order total:', totalAmount);
        
        const response = await ApiService.getAvailablePromoCodes();
        
        if (!response.success || !response.data || response.data.length === 0) {
          console.log('ℹ️ No available promo codes for auto-apply');
          return;
        }

        console.log('🎯 Found available promo codes:', response.data.length);
        
        // Filter promos that meet the minimum order requirement
        const eligiblePromos = response.data.filter(promo => {
          const minOrder = promo.min_order_amount || 0;
          return totalAmount >= minOrder;
        });

        if (eligiblePromos.length === 0) {
          console.log('ℹ️ No promo codes meet minimum order requirements');
          return;
        }

        // Sort by best value: calculate actual savings for each promo
        const sortedPromos = eligiblePromos.sort((a, b) => {
          // Calculate actual savings for each promo
          const savingsA = calculateActualSavings(a, totalAmount);
          const savingsB = calculateActualSavings(b, totalAmount);
          
          // Sort by highest savings first
          if (savingsB !== savingsA) {
            return savingsB - savingsA;
          }
          
          // If savings are equal, prioritize percentage discounts
          if (a.discount_type === 'percentage' && b.discount_type !== 'percentage') return -1;
          if (b.discount_type === 'percentage' && a.discount_type !== 'percentage') return 1;
          
          // Then by discount value (higher is better)
          return (b.discount_value || 0) - (a.discount_value || 0);
        });

        const bestPromo = sortedPromos[0];
        console.log('🏆 Auto-applying best promo:', bestPromo.code);

        // Validate and apply the best promo
        const validateResponse = await ApiService.validatePromoCode(
          bestPromo.code,
          totalAmount,
          isGuest
        );

        if (validateResponse.success && validateResponse.data) {
          setAppliedPromo(validateResponse.data.promo);
          setPromoCode(bestPromo.code);
          lastValidatedPromoRef.current = validateResponse.data.promo;
          promoManuallyRemovedRef.current = false; // Reset flag when auto-applied
          
          // Show success message with discount amount
          const discountAmount = validateResponse.data.discount_amount || 0;
          setToastMessage(`🎉 Promo ${bestPromo.code} automatically applied! Saved ${formatAmount(discountAmount)}`);
          setToastType('success');
          setShowToast(true);
          
          console.log('✅ Auto-applied promo successfully:', bestPromo.code, 'Discount:', discountAmount);
          
          // Trigger recalculation
          setTimeout(() => calculateOrder(), 100);
        } else {
          console.log('❌ Failed to validate auto-apply promo:', validateResponse.message);
        }

      } catch (error) {
        console.error('❌ Error in auto-apply promo:', error);
      }
    };

    // Debounce the auto-apply to avoid too many API calls
    const timeoutId = setTimeout(autoApplyBestPromo, 1000);
    return () => clearTimeout(timeoutId);
  }, [orderCalculation?.subtotal, appliedPromo, validatingPromo, promoCode, isGuest]);

  const loadAddresses = React.useCallback(async () => {
    try {
      setLoadingAddresses(true);
      clearError('addresses');
      
      console.log('🔄 Loading addresses for user:', user?.id);
      const response = await ApiService.getUserAddresses();
      console.log('📍 Address API response:', JSON.stringify(response, null, 2));
      console.log('📍 Response.success:', response?.success);
      console.log('📍 Response.data:', response?.data);
      console.log('📍 Is Array:', Array.isArray(response?.data));
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        const addressList = response.data;
        setAddresses(addressList);
        console.log('✅ Loaded addresses:', addressList.length);
        console.log('📍 Address list:', JSON.stringify(addressList, null, 2));
        
        // Select default address
        const defaultAddress = addressList.find(addr => addr?.is_default);
        if (defaultAddress) {
          console.log('🏠 Found default address:', JSON.stringify(defaultAddress, null, 2));
          setSelectedAddress(defaultAddress);
          console.log('🏠 Selected default address:', defaultAddress.name);
        } else if (addressList.length > 0) {
          console.log('🏠 No default, using first address:', JSON.stringify(addressList[0], null, 2));
          setSelectedAddress(addressList[0]);
          console.log('🏠 Selected first address:', addressList[0].name);
        } else {
          console.warn('⚠️ Address list is empty!');
        }
      } else {
        console.warn('❌ Invalid addresses response:', response);
        setAddresses([]);
        
        // Handle specific validation errors
        if (response?.errors && Array.isArray(response.errors)) {
          const errorDetails = response.errors.map(err => err.message || err).join(', ');
          handleError('addresses', `${t('checkout.validationError')}: ${errorDetails}`, t('checkout.errorLoadingAddresses'));
        } else {
          const errorMessage = response?.message || response?.message_ar || t('checkout.invalidResponseFormat');
          handleError('addresses', errorMessage, t('checkout.errorLoadingAddresses'));
        }
      }
    } catch (error) {
      console.error('❌ Error loading addresses:', error);
      setAddresses([]);
      handleError('addresses', error, t('checkout.errorLoadingAddresses'));
      incrementRetry('addresses');
    } finally {
      setLoadingAddresses(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, t]);

  // Load addresses and branches on mount or when user changes
  useEffect(() => {
    if (user) {
      loadAddresses();
    }
    // Load branches for branch validation & distance-based fee when possible
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const calculateOrder = async () => {
  const requestId = ++calcRequestRef.current;
    if (!items || items.length === 0) {
      console.log('⏭️ Skipping calculation - no items in cart');
      setLoading(false);
      clearError('calculation');
      setBranchPriceOverrides({});
      setOrderCalculation({
        items: [],
        subtotal: 0,
        delivery_fee: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        points_earned: 0,
        promo_details: undefined
      });
      return;
    }

    // CRITICAL: Wait for address to load in delivery mode
    // For logged-in users, wait for selectedAddress
    // For guests, wait for guestInfo.address
    if (orderType === 'delivery' && !isGuest && !selectedAddress) {
      console.log('⏳ Waiting for address to be selected before calculating delivery order...');
      setLoading(false);
      return;
    }
    
    if (orderType === 'delivery' && isGuest && !guestInfo.address.trim()) {
      console.log('⏳ Waiting for guest address before calculating delivery order...');
      setLoading(false);
      return;
    }

    console.log('🧮 Starting order calculation [#' + requestId + ']');
    console.log('📦 Order type:', orderType);
    console.log('📍 Selected address:', selectedAddress?.id, selectedAddress?.name);
    console.log('🏢 Selected branch:', selectedBranchId);

    try {
      setLoading(true);
      clearError('calculation');
  // Prefer appliedPromo; fall back to last validated promo to avoid setState timing issues
  const promoCandidate: PromoCode | null = appliedPromo || lastValidatedPromoRef.current || null;

      // For delivery orders, ensure we have a branch before calculating
      if (orderType === 'delivery') {
        const branchIdReady = selectedBranchId || (branches[0]?.id ?? null);
        if (!branchIdReady) {
          console.log('⏳ Waiting for branches to load before calculation...');
          setLoading(false);
          return;
        }
      }
      
      const requestData: any = {
        items: (items || []).map(item => ({
          product_id: item?.product_id,
          variant_id: item?.variant_id,
          variants: item?.variants ? item.variants.map((v: any) => v.id) : undefined, // Support multiple variants
          quantity: item?.quantity || 1,
          special_instructions: item?.special_instructions,
        })),
        delivery_address_id: orderType === 'delivery' && selectedAddress ? selectedAddress.id : undefined,
  branch_id: selectedBranchId || (branches[0]?.id ?? undefined),
        order_type: orderType,
        promo_code: promoCandidate?.code,
        is_guest: isGuest,
        delivery_zone: deliveryZone, // 'inside_amman', 'outside_amman', or null (auto-detect)
      };

      // Diagnostics: log whether address has coordinates
      if (orderType === 'delivery') {
        const hasCoords = !!(selectedAddress && (selectedAddress as any).latitude && (selectedAddress as any).longitude);
        console.log('📍 Address has coordinates:', hasCoords, 'address_id:', selectedAddress?.id);
      }
      // Provide explicit coordinates when available to improve backend delivery fee calculation
      if (orderType === 'delivery') {
        const addressLat = (selectedAddress as any)?.latitude ?? (selectedAddress as any)?.lat;
        const addressLng = (selectedAddress as any)?.longitude ?? (selectedAddress as any)?.lng;
        const addressAreaId = (selectedAddress as any)?.area_id ?? (selectedAddress as any)?.areaId ?? (selectedAddress as any)?.area?.id;

        const parsedLat = addressLat !== undefined && addressLat !== null && addressLat !== ''
          ? Number(addressLat)
          : NaN;
        const parsedLng = addressLng !== undefined && addressLng !== null && addressLng !== ''
          ? Number(addressLng)
          : NaN;
        const parsedAreaId = addressAreaId !== undefined && addressAreaId !== null && addressAreaId !== ''
          ? Number(addressAreaId)
          : undefined;

        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
          requestData.delivery_coordinates = {
            latitude: parsedLat,
            longitude: parsedLng,
            area_id: Number.isFinite(parsedAreaId) ? parsedAreaId : undefined,
          };
          console.log('🗺️ MOBILE - Using address coordinates:', requestData.delivery_coordinates);
          console.log('📍 MOBILE - EXACT COORDS - Lat:', parsedLat, 'Lng:', parsedLng, 'Area ID:', parsedAreaId);
        } else if (isGuest && guestLocation) {
          requestData.delivery_coordinates = {
            latitude: guestLocation.latitude,
            longitude: guestLocation.longitude,
            area_id: undefined,
          };
          console.log('🗺️ MOBILE - Using guest location:', requestData.delivery_coordinates);
          console.log('📍 MOBILE - GUEST COORDS - Lat:', guestLocation.latitude, 'Lng:', guestLocation.longitude);
        } else {
          console.warn('⚠️ MOBILE - No valid coordinates available!');
        }
      }

      // Provide guest delivery address context when available
      if (isGuest && orderType === 'delivery') {
        // Always send text address if provided
        if (guestInfo.address?.trim()) {
          requestData.guest_delivery_address = guestInfo.address.trim();
        }
        
        // GPS coordinates supplement the text address (not replace it)
        if (guestLocation) {
          requestData.delivery_coordinates = {
            latitude: guestLocation.latitude,
            longitude: guestLocation.longitude,
          };
          console.log('📍 Including GPS coordinates as supplement to text address:', {
            textAddress: requestData.guest_delivery_address,
            gpsCoordinates: requestData.delivery_coordinates
          });
        }
      }

  console.log('💳 Applied Promo Code:', promoCandidate?.code);
  console.log('🔍 Full Applied Promo:', JSON.stringify(promoCandidate, null, 2));
  console.log('🗺️ MOBILE DELIVERY COORDINATES BEING SENT:', requestData.delivery_coordinates);
  console.log('📍 MOBILE DELIVERY ADDRESS ID:', requestData.delivery_address_id);
  console.log('🏢 MOBILE BRANCH ID:', requestData.branch_id);
  console.log('📦 MOBILE ORDER TYPE:', requestData.order_type);

      // Add timeout to the request
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(t('checkout.requestTimeout'))), 10000)
      );

  const response = await Promise.race([
        ApiService.calculateOrderTotals(requestData),
        timeoutPromise
      ]) as any;
      
      console.log(`📊 Order calculation request [#${requestId}]:`, JSON.stringify(requestData, null, 2));
      console.log(`📊 Order calculation response [#${requestId}]:`, JSON.stringify(response, null, 2));
      
  if (response?.success && response?.data) {
        console.log(`✅ Setting order calculation [#${requestId}]:`, response.data);
        console.log('💰 Applied discount:', response.data.discount_amount);
        console.log('🎫 Promo details:', response.data.promo_details);

  const rawCalcData = response.data;
  let calc = normalizeOrderCalculation(rawCalcData);
  const rawShippingDiscount = toNumeric((rawCalcData as any)?.shipping_discount_amount);

        // If we have an applied promo but no discount from backend, calculate it locally
        if (promoCandidate && calc.discount_amount === 0) {
          console.log('⚠️ Backend returned no discount, calculating locally...');
          const localDiscount = calculatePromoDiscount(promoCandidate, calc.subtotal);
          console.log('💰 Local discount calculation:', localDiscount);

          calc = {
            ...calc,
            discount_amount: localDiscount,
            total_amount: calc.subtotal + calc.delivery_fee - localDiscount + calc.tax_amount,
            promo_details: promoCandidate,
          };
        }
        
        if (orderType === 'delivery') {
          const backendDeliveryFee = parseNumericValue(calc.delivery_fee);
          const backendDeliveryFeeOriginal = (() => {
            if ((rawCalcData as any)?.delivery_fee_original !== undefined) {
              return parseNumericValue((rawCalcData as any).delivery_fee_original);
            }
            if (typeof calc.delivery_fee_original === 'number') {
              return calc.delivery_fee_original;
            }
            return 0;
          })();
          const backendShippingDiscount = rawShippingDiscount;
          const backendTotalAmount = toNumeric(rawCalcData?.total_amount);

          const deliveryCalculationMeta = (rawCalcData as any)?.delivery_calculation
            ?? (rawCalcData as any)?.deliveryCalculation
            ?? null;
          const deliveryCalculationFee = deliveryCalculationMeta
            ? parseNumericValue(
                deliveryCalculationMeta.delivery_fee ??
                deliveryCalculationMeta.total_cost ??
                deliveryCalculationMeta.cost ??
                deliveryCalculationMeta.amount
              )
            : 0;
          const deliveryCalculationMethod = calc.delivery_calculation_method
            ?? (typeof deliveryCalculationMeta?.calculation_method === 'string'
              ? deliveryCalculationMeta.calculation_method
              : undefined);

          const addressDeliveryFee = (() => {
            if (!selectedAddress) return 0;
            const candidates = [
              (selectedAddress as any)?.area_delivery_fee,
              (selectedAddress as any)?.delivery_fee,
              (selectedAddress as any)?.default_delivery_fee,
            ];
            for (const candidate of candidates) {
              const numeric = parseNumericValue(candidate);
              if (numeric > 0) {
                return numeric;
              }
            }
            return 0;
          })();

          const branchDeliveryFee = (() => {
            const branch = branches.find(b => b.id === (selectedBranchId || branches[0]?.id));
            if (!branch) return 0;
            const candidates = [
              (branch as any)?.delivery_fee,
              (branch as any)?.default_delivery_fee,
              (branch as any)?.base_delivery_fee,
            ];
            for (const candidate of candidates) {
              const numeric = parseNumericValue(candidate);
              if (numeric > 0) {
                return numeric;
              }
            }
            return 0;
          })();

          const explicitFallbacks = [
            deliveryCalculationFee,
            parseNumericValue((rawCalcData as any)?.delivery_fee_fallback),
            parseNumericValue((rawCalcData as any)?.default_delivery_fee),
            addressDeliveryFee,
            branchDeliveryFee,
          ];

          const shippingDiscountApplied = backendShippingDiscount > 0;
          
          // Check if backend explicitly calculated delivery fee (even if 0 for free shipping)
          const backendCalculatedDelivery = 
            deliveryCalculationMethod && 
            deliveryCalculationMethod !== 'unknown' &&
            deliveryCalculationMethod !== 'fallback';

          let resolvedDeliveryFee = backendDeliveryFee;
          // Only apply fallback if backend didn't calculate AND no shipping discount applied
          if (!shippingDiscountApplied && !backendCalculatedDelivery && resolvedDeliveryFee <= 0) {
            const fallbackCandidate = explicitFallbacks.find(value => value > 0);
            if (fallbackCandidate !== undefined) {
              resolvedDeliveryFee = fallbackCandidate;
              console.log('📦 Applied fallback delivery fee:', resolvedDeliveryFee);
            }
          } else if (backendCalculatedDelivery) {
            console.log('✅ Using backend calculated delivery fee:', resolvedDeliveryFee, 'method:', deliveryCalculationMethod);
          }

          const deliveryFeeOriginal = (() => {
            if (backendDeliveryFeeOriginal > 0) {
              return backendDeliveryFeeOriginal;
            }
            const candidate = explicitFallbacks.find(value => value > 0);
            if (candidate !== undefined) {
              return candidate;
            }
            return resolvedDeliveryFee;
          })();

          const waivedFee = (() => {
            const existingWaived = parseNumericValue((calc as any).waived_delivery_fee);
            if (shippingDiscountApplied) {
              return backendShippingDiscount;
            }
            if (existingWaived > 0) {
              return existingWaived;
            }
            if (deliveryFeeOriginal > resolvedDeliveryFee && resolvedDeliveryFee >= 0) {
              return deliveryFeeOriginal - resolvedDeliveryFee;
            }
            return 0;
          })();

          const totalDelta = resolvedDeliveryFee - backendDeliveryFee;
          const adjustedTotalAmount = backendTotalAmount + totalDelta;

          calc = {
            ...calc,
            delivery_fee: resolvedDeliveryFee,
            delivery_fee_original: deliveryFeeOriginal > 0 ? deliveryFeeOriginal : undefined,
            shipping_discount_amount: shippingDiscountApplied ? backendShippingDiscount : undefined,
            waived_delivery_fee: waivedFee > 0 ? waivedFee : undefined,
            delivery_calculation_method: deliveryCalculationMethod,
            total_amount: Math.max(0, adjustedTotalAmount),
          };
        } else {
          const sanitizedCalc: OrderCalculation = {
            ...calc,
            delivery_fee: 0,
            delivery_fee_original: undefined,
            shipping_discount_amount: undefined,
            waived_delivery_fee: undefined,
          };

          sanitizedCalc.total_amount = toNumeric(rawCalcData?.total_amount ?? sanitizedCalc.subtotal - sanitizedCalc.discount_amount + sanitizedCalc.tax_amount - (sanitizedCalc.points_discount_amount ?? 0));

          // Explicitly ignore any shipping discount metadata for pickup orders
          if (rawShippingDiscount > 0 && sanitizedCalc.promo_details?.discount_type === 'free_shipping') {
            console.log('🚫 Ignoring free shipping discount metadata for pickup order');
          }

          calc = sanitizedCalc;
        }
        // Only apply the latest calculation result
        if (requestId === calcRequestRef.current) {
          const derivedOverrides: Record<string, number> = {};
          if (Array.isArray(calc.items)) {
            calc.items.forEach(line => {
              const numericProductId = Number(line?.product_id ?? line?.product?.id);
              if (!Number.isFinite(numericProductId) || numericProductId <= 0) {
                return;
              }

              const variantRaw = line?.variant_id ?? line?.variant?.id ?? null;
              const numericVariantId = variantRaw === null || variantRaw === undefined
                ? null
                : Number(variantRaw);
              const normalizedVariantId =
                numericVariantId !== null && Number.isFinite(numericVariantId)
                  ? numericVariantId
                  : null;

              const candidateValues = [
                line?.unit_price,
                (line as any)?.unitPrice,
                (line as any)?.unit_price_override,
                (line as any)?.unitPriceOverride,
                (line as any)?.price_override,
                (line as any)?.priceOverride,
                (line as any)?.product?.branch_price_override,
                (line as any)?.product?.price_override,
                (line as any)?.product?.final_price,
              ];

              const resolvedUnitPrice = candidateValues.reduce<number | null>((acc, candidate) => {
                if (acc !== null) {
                  return acc;
                }
                const numericValue = parseNumericValue(candidate);
                return numericValue > 0 ? numericValue : null;
              }, null);

              if (resolvedUnitPrice !== null) {
                const key = buildItemPriceKey(numericProductId, normalizedVariantId);
                derivedOverrides[key] = resolvedUnitPrice;
              }
            });
          }

          setBranchPriceOverrides(prev => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(derivedOverrides);
            const isSameLength = prevKeys.length === nextKeys.length;
            const isSameContent =
              isSameLength && prevKeys.every(key => prev[key] === derivedOverrides[key]);

            if (isSameContent) {
              return prev;
            }

            return derivedOverrides;
          });

          setBranchStockWarnings([]);
          setBranchStockDetails([]);
          setBranchStockWarningSource(null);
          setOrderCalculation(calc);
        } else {
          console.log(`⏭️ Skipping stale calculation result [#${requestId}] in favor of [#${calcRequestRef.current}]`);
        }
      } else {
        if (requestId !== calcRequestRef.current) {
          console.log(`⏭️ Skipping stale calculation error [#${requestId}] in favor of [#${calcRequestRef.current}]`);
          return;
        }

        setBranchPriceOverrides({});
        const apiErrors = Array.isArray(response?.errors) ? response.errors : [];
        const detailedErrorMessage = apiErrors.length > 0 ? (apiErrors[0]?.message || String(apiErrors[0])) : null;
        const errorMessage = detailedErrorMessage || response?.message || t('checkout.errorCalculating');
        const normalizedMessage = errorMessage.toLowerCase();
        const branchErrorPatterns = ['not available at branch', 'insufficient stock', 'out of stock', 'branch inventory'];
        const isBranchStockIssue = branchErrorPatterns.some(pattern => normalizedMessage.includes(pattern));
        
        // Check for Amman-only delivery restriction (expected validation, not an error)
        const isAmmanOnlyRestriction = normalizedMessage.includes('only be delivered inside amman') || 
                                       normalizedMessage.includes('amman_only_restriction');

        if (isBranchStockIssue) {
          // Use console.warn for expected branch availability issues instead of console.error
          console.warn('⚠️ Branch stock validation:', errorMessage);
          const friendlyDetail = buildFriendlyStockDetail(errorMessage);
          handleError('calculation', friendlyDetail.message, t('checkout.errorCalculating'));
          setBranchStockWarnings([friendlyDetail.message]);
          setBranchStockDetails([friendlyDetail]);
          setBranchStockWarningSource('calculation');
          if (requestId === calcRequestRef.current) {
            setOrderCalculation(null);
          }
          // Don't show toast for branch stock issues - they're already shown in the warning banner
        } else if (isAmmanOnlyRestriction) {
          // Amman-only restriction is handled by the warning banner above the cart
          console.warn('⚠️ Amman-only delivery restriction:', errorMessage);
          setBranchStockWarnings([]);
          setBranchStockDetails([]);
          setBranchStockWarningSource(null);
          if (requestId === calcRequestRef.current) {
            setOrderCalculation(null);
          }
          // Don't show toast - the warning banner is already visible
        } else {
          // Actual errors that aren't expected validations
          console.error('❌ Calculate order error:', errorMessage);
          const localizedMessage = localizeCalculationErrorMessage(errorMessage);
          handleError('calculation', localizedMessage, t('checkout.errorCalculating'));
          setBranchStockWarnings([]);
          setBranchStockDetails([]);
          setBranchStockWarningSource(null);

          setToastMessage(localizedMessage);
          setToastType('error');
          setShowToast(true);

          // Set a default calculation to prevent infinite loading
          const fallbackDiscountAmount = appliedPromo ? 
            calculatePromoDiscount(appliedPromo, totalAmount || 0) : 0;
          
          setOrderCalculation({
            items: requestData?.items || [],
            subtotal: totalAmount || 0,
            delivery_fee: orderType === 'delivery' ? 5.99 : 0,
            tax_amount: 0,
            discount_amount: Math.min(fallbackDiscountAmount, totalAmount || 0),
            total_amount: (totalAmount || 0) + (orderType === 'delivery' ? 5.99 : 0) - fallbackDiscountAmount,
            points_earned: 0,
            promo_details: appliedPromo || undefined
          });
        }
      }
    } catch (error: any) {
      console.error('❌ Error calculating order:', error);
      console.error('❌ Error details:', JSON.stringify({
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      }, null, 2));
      
      // Only handle error for the latest request
      if (requestId !== calcRequestRef.current) {
        console.log(`⏭️ Skipping error handling for stale request [#${requestId}]`);
        return;
      }
      
      incrementRetry('calculation');
      
      // Keep existing price overrides on error - don't clear them
      // setBranchPriceOverrides({});  // Commented out to prevent losing branch prices
      
      setBranchStockWarnings([]);
      setBranchStockDetails([]);
      setBranchStockWarningSource(null);
      
      // Set a fallback calculation using existing cart prices
      const fallbackDiscountAmount = appliedPromo ? 
        calculatePromoDiscount(appliedPromo, totalAmount || 0) : 0;
      
      // Calculate fallback using actual item prices instead of 0
      const fallbackItems = (items || []).map(item => {
        const unitPrice = getItemUnitPrice(item);
        const quantity = item?.quantity || 1;
        return {
          product_id: item?.product_id || 0,
          variant_id: item?.variant_id || 0,
          quantity,
          unit_price: unitPrice,
          total_price: unitPrice * quantity,
          points_earned: 0,
          special_instructions: item?.special_instructions || '',
        };
      });
      
      const fallbackSubtotal = fallbackItems.reduce((sum, item) => sum + item.total_price, 0);
      
      setOrderCalculation({
        items: fallbackItems,
        subtotal: fallbackSubtotal,
        delivery_fee: orderType === 'delivery' ? 5.99 : 0,
        tax_amount: 0,
        discount_amount: Math.min(fallbackDiscountAmount, fallbackSubtotal),
        total_amount: fallbackSubtotal + (orderType === 'delivery' ? 5.99 : 0) - fallbackDiscountAmount,
        points_earned: 0,
        promo_details: appliedPromo || undefined
      });
      
      if (error?.message === t('checkout.requestTimeout')) {
        handleError('calculation', t('checkout.orderCalculationTimeout'), t('checkout.errorCalculating'));
      } else {
        const fallbackMessage = typeof error === 'string' ? error : error?.message;
        const localizedMessage = localizeCalculationErrorMessage(fallbackMessage);
        handleError('calculation', localizedMessage, t('checkout.errorCalculating'));
        setToastMessage(localizedMessage);
        setToastType('error');
        setShowToast(true);
      }
    } finally {
      // Only clear loading for the latest request
      if (requestId === calcRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const handleBranchSelection = useCallback(
    (branch: Branch, status: BranchStatusPresentation) => {
      if (!branch) return;

      const disallowedTones: BranchStatusTone[] = ['unavailable', 'inactive', 'error'];
      if (disallowedTones.includes(status.tone)) {
        const issues = Array.isArray(status.issues) ? status.issues : [];
        const fallbackMessage = status.message || t('checkout.branchStockUnavailable');
        const warnings = issues.length > 0 ? issues : [fallbackMessage];
        const filteredWarnings = warnings.filter(Boolean);

        if (filteredWarnings.length > 0) {
          // Use buildFriendlyStockDetail to show product names instead of IDs
          const detailedWarnings = filteredWarnings.map(msg => buildFriendlyStockDetail(msg));
          setBranchStockWarnings(detailedWarnings.map(d => d.message));
          setBranchStockDetails(detailedWarnings);
          setBranchStockWarningSource('status');
        }

        // Don't show toast - warnings are already visible in the banner
        HapticFeedback.error();
        return;
      }

      setSelectedBranchId(branch.id);
      setBranchStockWarnings([]);
      setBranchStockDetails([]);
      setBranchStockWarningSource(null);
      setShowBranchModal(false);
      HapticFeedback.light();

      // Note: Recalculation is handled by useEffect watching selectedBranchId
    },
    [t]
  );

  // 🔄 SOLUTION: Add useFocusEffect to reload addresses when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('🔄 CheckoutScreen focused - reloading addresses');
        loadAddresses();
        // Don't call calculateOrder() here - let the useEffect that watches selectedAddress handle it
      }
    }, [user, loadAddresses])
  );

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setAppliedPromo(null);
      clearError('promoCode');
      return;
    }

    try {
      setValidatingPromo(true);
      clearError('promoCode');
      
      console.log('🎫 Validating promo code:', promoCode.trim(), 'with total:', totalAmount || 0);
      
      const response = await ApiService.validatePromoCode(promoCode.trim(), totalAmount || 0, isGuest);
      
      console.log('🎫 Promo validation response:', JSON.stringify(response, null, 2));
      
      if (response?.success && response?.data && ((response as any).data.promo || (response as any).data.promo_code)) {
        const raw = (response as any).data;
        const promoData: PromoCode = (raw.promo || raw.promo_code) as PromoCode;
        console.log('✅ Promo validation successful:', promoData);
        console.log('💰 Discount amount from validation:', response.data.discount_amount);
        console.log('💵 Final amount from validation:', response.data.final_amount);
        console.log('🔍 Full validation response:', JSON.stringify(response.data, null, 2));
        
        // Clear any previous errors first
        clearError('promoCode');
        
        // Set the applied promo and persist it
        setAppliedPromo(promoData);
        lastValidatedPromoRef.current = promoData;
        promoManuallyRemovedRef.current = false; // Reset flag when promo applied
        
        // Calculate expected discount
        const expectedDiscount = calculatePromoDiscount(promoData, totalAmount || 0);
        console.log('📊 Expected discount calculation:', expectedDiscount);
        
        // Show success message
        Alert.alert(
          t('common.success'), 
          t('checkout.promoAppliedWithDiscount', { discount: formatAmount(response.data.discount_amount ?? expectedDiscount) })
        );
        
        // Force recalculation after promo is applied
        setTimeout(() => {
          console.log('🔄 Recalculating order after promo applied...');
          calculateOrder();
        }, 100);
      } else {
        console.warn('❌ Promo validation failed:', response?.message);
        setAppliedPromo(null);
        const errorMessage = response?.message || response?.errors?.[0]?.message || t('checkout.invalidPromo');
        handleError('promoCode', errorMessage, t('checkout.invalidPromo'));
      }
    } catch (error) {
      console.error('❌ Error validating promo code:', error);
      setAppliedPromo(null);
      incrementRetry('promoCode');
      const errorMessage = error instanceof Error ? error.message : t('checkout.networkError');
      handleError('promoCode', errorMessage, t('checkout.invalidPromo'));
    } finally {
      setValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    console.log('🗑️ Removing promo code...');
    setPromoCode('');
    setAppliedPromo(null);
    lastValidatedPromoRef.current = null;
    promoManuallyRemovedRef.current = true; // Prevent auto-reapply
    clearError('promoCode');
    // Force recalculation immediately after promo is removed
    console.log('🔄 Recalculating order after promo removed...');
    calculateOrder();
  };

  const validateGuestInfo = () => {
    const errors: { [key: string]: string } = {};
    
    if (!guestInfo.fullName.trim()) {
      errors.fullName = t('auth.firstNameRequired');
    }
    
    if (!guestInfo.phone.trim()) {
      errors.phone = t('auth.enterPhone');
    }
    
    if (orderType === 'delivery' && !guestInfo.address.trim()) {
      errors.address = t('checkout.addressRequired');
    }
    
    setGuestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const placeOrder = async () => {
    try {
      // Clear previous errors
      clearAllErrors();

      // Check if store is accepting orders
      try {
        const storeStatusResponse = await ApiService.checkStoreStatus();
        if (storeStatusResponse.success && storeStatusResponse.data) {
          if (!storeStatusResponse.data.accepting_orders) {
            const message = currentLanguage === 'ar' 
              ? storeStatusResponse.data.message_ar 
              : storeStatusResponse.data.message_en;
            
            handleError('order', message, t('checkout.storeNotAcceptingOrders'));
            setPlacingOrder(false);
            return;
          }
        }
      } catch (storeStatusError) {
        console.error('Failed to check store status:', storeStatusError);
        // Continue with order if check fails (fail-open for better UX)
      }

      // Enhanced validation checks with detailed error reporting
      if (isGuest && !validateGuestInfo()) {
        // Guest validation errors will show inline in the form
        setPlacingOrder(false);
        return;
      }

      if (!user && !isGuest) {
        handleError('order', t('checkout.authenticationRequired'), t('auth.loginRequired'));
        setPlacingOrder(false);
        return;
      }

      if (!items || items.length === 0) {
        handleError('order', t('cart.empty'), t('cart.empty'));
        setPlacingOrder(false);
        return;
      }

      // Validate cart items have valid data
      const invalidItems = items.filter(item => 
        !item?.product_id || 
        !item?.quantity || 
        item.quantity <= 0 ||
        isNaN(Number(item.quantity))
      );
      
      if (invalidItems.length > 0) {
        handleError('order', t('checkout.invalidItemsInCart'), t('checkout.invalidItems'));
        setPlacingOrder(false);
        return;
      }

      if (orderType === 'delivery' && !isGuest && !selectedAddress) {
        handleError('order', t('checkout.addressSelectionRequired'), t('checkout.selectAddress'));
        setPlacingOrder(false);
        return;
      }

      // For guest delivery orders, GPS location requirement (handled by inline validation)
      if (orderType === 'delivery' && isGuest && (!guestLocation || !guestUseAutoLocation)) {
        // Show inline error instead of error banner
        setGuestErrors(prev => ({ 
          ...prev, 
          address: t('checkout.useGPSForAccurateDeliveryFee') 
        }));
        setPlacingOrder(false);
        return;
      }

      // Validate order calculation exists and has valid totals
      if (!orderCalculation) {
        handleError('order', t('checkout.orderCalculationMissing'), t('checkout.calculationRequired'));
        setPlacingOrder(false);
        return;
      }

      const normalizedTotalAmount = Number(orderCalculation.total_amount);
      if (!Number.isFinite(normalizedTotalAmount) || normalizedTotalAmount < 0) {
        handleError('order', t('checkout.invalidOrderTotal'), t('checkout.invalidTotal'));
        setPlacingOrder(false);
        return;
      }

      if (branchStockWarnings.length > 0) {
        const warningMessage = branchStockWarnings.join('\n');
        handleError('order', warningMessage, t('checkout.branchStockUnavailable'));
        setToastMessage(t('checkout.branchStockUnavailable'));
        setToastType('error');
        setShowToast(true);
        setPlacingOrder(false);
        return;
      }

      setPlacingOrder(true);

      // Enhanced branch and customer info validation
      let branchIdToUse = selectedBranchId || (branches[0]?.id ?? null);
      if (!branchIdToUse) {
        handleError('order', t('checkout.branchNotAvailable'), t('checkout.selectBranchMessage'));
        setPlacingOrder(false);
        return;
      }

      const derivedName = isGuest
        ? guestInfo.fullName.trim()
        : `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || (selectedAddress as any)?.name || t('checkout.customerDefault');
      const derivedPhone = isGuest
        ? guestInfo.phone.trim()
        : (user?.phone || (selectedAddress as any)?.phone || '').toString().trim();

      // Enhanced name and phone validation
      if (!derivedName || derivedName.length < 2) {
        handleError('order', t('checkout.validCustomerNameRequired'), t('checkout.customerNameRequired'));
        setPlacingOrder(false);
        return;
      }

      if (!derivedPhone || !/^[0-9+\-\s()]{7,15}$/.test(derivedPhone)) {
        handleError('order', t('checkout.validPhoneNumberRequired'), t('checkout.customerPhoneRequired'));
        setPlacingOrder(false);
        return;
      }

      // Build comprehensive order data with error handling
      const orderData: any = {
        items: items.map(item => ({
          product_id: Number(item.product_id),
          variant_id: item.variant_id ? Number(item.variant_id) : undefined,
          variants: item.variants ? item.variants.map((v: any) => Number(v.id)) : undefined, // Support multiple variants
          quantity: Number(item.quantity),
          special_instructions: item.special_instructions?.trim() || undefined,
        })),
        branch_id: Number(branchIdToUse),
        delivery_address_id: orderType === 'delivery' && selectedAddress ? Number(selectedAddress.id) : undefined,
        customer_name: derivedName,
        customer_phone: derivedPhone,
        customer_email: isGuest ? (guestInfo.email?.trim() || undefined) : (user?.email || undefined),
        guest_delivery_address: isGuest && orderType === 'delivery' ? 
          (guestUseAutoLocation && guestLocation ? 
            {
              address: guestInfo.address.trim(),
              latitude: guestLocation.latitude,
              longitude: guestLocation.longitude,
              auto_detected: true
            } : guestInfo.address.trim()) : undefined,
        order_type: orderType,
        payment_method: paymentMethod,
        promo_code: appliedPromo?.code || undefined,
        special_instructions: specialInstructions?.trim() || undefined,
        is_guest: isGuest,
        // Enhanced delivery information for better fee calculation
        expected_total: orderCalculation.total_amount,
        expected_delivery_fee: orderType === 'delivery' ? orderCalculation.delivery_fee : 0,
        expected_discount: orderCalculation.discount_amount || 0,
      };

      // Enhanced coordinates and address context for delivery orders
      if (orderType === 'delivery') {
        if (!isGuest && selectedAddress && (selectedAddress as any).latitude && (selectedAddress as any).longitude) {
          orderData.delivery_coordinates = {
            latitude: Number((selectedAddress as any).latitude),
            longitude: Number((selectedAddress as any).longitude),
            area_id: (selectedAddress as any).area_id,
            city_id: (selectedAddress as any).city_id,
            street_id: (selectedAddress as any).street_id,
          };
        }
        
        // For guest orders with delivery, ensure we have address details
        if (isGuest && guestInfo.address) {
          orderData.guest_delivery_details = {
            address: guestInfo.address.trim(),
            notes: guestInfo.notes?.trim() || undefined,
            // If we have GPS location from address form, include it
            ...(selectedAddress && (selectedAddress as any).latitude ? {
              latitude: Number((selectedAddress as any).latitude),
              longitude: Number((selectedAddress as any).longitude),
            } : {})
          };
        }
      }

      console.log('🚀 Placing order with data:', JSON.stringify(orderData, null, 2));

      // Enhanced API call with retry logic and timeout
      let response;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(t('checkout.orderCreationTimeout'))), 30000)
          );

          response = await Promise.race([
            ApiService.createOrder(orderData),
            timeoutPromise
          ]) as any;

          // Check if we got a successful response
          if (response?.success && response?.data) {
            break; // Success, exit retry loop
          } else {
            throw new Error(response?.message || t('checkout.orderCreationFailed'));
          }
        } catch (error) {
          attempts++;
          console.error(`Order creation attempt ${attempts} failed:`, error);
          
          if (attempts >= maxAttempts) {
            throw error; // Re-throw after max attempts
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
      }
      
      if (response?.success && response?.data) {
        // Save guest order locally for guest users
        if (isGuest && response.data.order) {
          try {
            await guestOrderService.saveGuestOrder(
              response.data.order,
              {
                phone: guestInfo.phone,
                email: guestInfo.email,
              }
            );
            console.log('✅ Guest order saved locally');
          } catch (error) {
            console.error('❌ Failed to save guest order locally:', error);
            // Don't fail the order placement if local storage fails
          }
        }
        
        clearCart();
        clearAllErrors(); // Clear all errors on successful order
        promoManuallyRemovedRef.current = false; // Reset promo flag for next order
        
        // Enhanced haptic feedback for success
        HapticFeedback.success();
        
        // Get order ID from response (handle different response structures)
        const orderId =
          resolveOrderId(response?.data) ||
          resolveOrderId(response) ||
          'N/A';
        console.log('✅ Order created successfully:', orderId);
        
        // Handle payment processing based on payment method
        if (paymentMethod === 'card') {
          if (orderId === 'N/A') {
            console.error('❌ Unable to resolve order ID for card payment.', response?.data);
            Alert.alert(
              t('checkout.paymentFailed'),
              t('checkout.paymentOrderIdMissing'),
              [
                {
                  text: t('orders.viewOrders'),
                  onPress: () => navigateToOrdersTab()
                },
                {
                  text: t('common.ok'),
                  style: 'cancel',
                }
              ]
            );
            return;
          }
          try {
            console.log('🔄 Processing card payment for order:', orderId);
            setShowPaymentModal(false);
            setToastMessage(t('checkout.paymentRedirectMessage'));
            setToastType('info');
            setShowToast(true);
            setLoading(true);

            const paymentResult = await paymentService.processCardPayment(orderId.toString(), orderCalculation?.total_amount);

            if (!paymentResult.success || !paymentResult.session) {
              throw new Error(paymentResult.error || t('checkout.paymentFailedError'));
            }

            console.log('✅ Card payment session created:', paymentResult.session.sessionId);
            redirectToOrdersForPayment(orderId.toString(), paymentResult.session);
            return; // Orders screen will continue the payment flow
          } catch (paymentError) {
            console.error('❌ Payment processing failed:', paymentError);
            
            // Show payment failure but order was created
            Alert.alert(
              t('checkout.paymentFailed'),
              t('checkout.orderCreatedPaymentFailedWithId', { message: t('checkout.orderCreatedPaymentFailed'), orderId }),
              [
                {
                  text: t('checkout.retryPayment'),
                  onPress: () => redirectToOrdersForPayment(orderId.toString())
                },
                {
                  text: t('common.ok'),
                  onPress: () => {
                    navigateToHomeTab();
                  }
                }
              ]
            );
            return;
          } finally {
            setLoading(false);
          }
        }
        
        // Enhanced success feedback (for non-card payments)
        setToastMessage(t('checkout.orderPlacedSuccessfully', { orderId }));
        setToastType('success');
        setShowToast(true);
        
        // Navigate with enhanced success flow
        setTimeout(() => {
          Alert.alert(
            t('checkout.orderPlaced'),
            t('checkout.orderPlacedMessageWithId', { message: t('checkout.orderPlacedMessage'), orderId }),
            [
              {
                text: t('orders.viewOrders'),
                onPress: () => navigateToOrdersTab()
              },
              {
                text: t('common.ok'),
                onPress: () => navigateToHomeTab()
              }
            ]
          );
        }, 1000);
      } else {
        // Handle bilingual error messages (e.g., store status errors)
        const errorMessage = currentLanguage === 'ar' && response?.message_ar
          ? response.message_ar
          : (response?.message || t('checkout.errorPlacingOrder'));
        
        handleError('order', errorMessage, t('checkout.errorPlacingOrder'));
        setToastMessage(errorMessage);
        setToastType('error');
        setShowToast(true);
        HapticFeedback.error();
      }
    } catch (error) {
      console.error('Error placing order:', error);
      incrementRetry('order');
      const errorMessage = error instanceof Error ? error.message : t('checkout.errorPlacingOrder');
      handleError('order', error, t('checkout.errorPlacingOrder'));
      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
      HapticFeedback.error();
    } finally {
      setPlacingOrder(false);
    }
  };

  const renderAddressCard = (address: Address, isSelected: boolean) => {
    const cityName = currentLanguage === 'ar' ? address.city_title_ar : address.city_title_en;
    const areaName = currentLanguage === 'ar' ? address.area_title_ar : address.area_title_en;

    return (
      <View
        key={address.id}
        style={[styles.addressCard, isSelected && styles.selectedAddressCard]}
      >
        <TouchableOpacity
          style={[styles.addressContent, isRTL && styles.rtlAlignEnd]}
          onPress={() => {
            setSelectedAddress(address);
            setShowAddressModal(false);
          }}
        >
          <View style={[styles.addressHeader, isRTL && styles.rtlRow]}>
            <Text style={[styles.addressName, isRTL ? styles.rtlText : styles.ltrText]} allowFontScaling={false}>
              {address.name}
            </Text>
            {isSelected && (
              <Icon name="checkmark-circle" size={20} color={Colors.primary} />
            )}
          </View>
          
          <Text style={[styles.addressDetails, isRTL ? styles.rtlText : styles.ltrText]} allowFontScaling={false}>
            {address.building_no}, {cityName}, {areaName}
          </Text>
          
          {address.details && (
            <Text style={[styles.addressNotes, isRTL ? styles.rtlText : styles.ltrText]} allowFontScaling={false}>
              {address.details}
            </Text>
          )}
        </TouchableOpacity>
        
      </View>
    );
  };

  // Safety check for cart items
  if (!items || items.length === 0) {
    return (
      <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
        <View style={styles.emptyContainer}>
          <Icon name="cart-outline" size={60} color="#C7C7CC" />
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>{t('cart.empty')}</Text>
          <Text style={[styles.helperText, isRTL && styles.rtlText]}>{t('cart.addItemsFirst')}</Text>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.continueButtonText}>{t('cart.continueShopping')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Error Banner Component
  const renderErrorBanner = () => {
    // Filter out errors that are handled inline for guests
    const activeErrors = Object.entries(errors).filter(([type, error]) => {
      if (error === null) return false;
      // Hide order validation errors for guests (they show inline in the form)
      if (isGuest && type === 'order') return false;
      return true;
    });
    
    if (activeErrors.length === 0) return null;

    return (
      <View style={styles.errorContainer}>
        {activeErrors.map(([type, message]) => {
          // Translate error messages
          let translatedMessage = message;
          if (message.includes('Product variant') || message.includes('product variant')) {
            translatedMessage = t('checkout.productVariantNotFound');
          }
          
          return (
            <View key={type} style={[styles.errorBanner, isRTL && styles.rtlErrorBanner]}>
              <View style={[styles.errorContent, isRTL && styles.rtlRowReverse]}>
                <Icon 
                  name="alert-circle" 
                  size={24} 
                  color="#FF4757" 
                  style={{marginTop: 2, flexShrink: 0}}
                />
                <View style={{flex: 1}}>
                  <Text style={[styles.errorText, isRTL && styles.rtlText]}>
                    {translatedMessage}
                  </Text>
                  {/* Show additional context for variant errors */}
                  {message.includes('Product variant') && (
                    <Text style={[{color: '#c22032', fontSize: 12, marginTop: 6}, isRTL && styles.rtlText]}>
                      {t('checkout.productVariantNotFoundDetail')}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.dismissButton, {padding: 8}]}
                  onPress={() => clearError(type as keyof typeof errors)}
                >
                  <Icon name="close" size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      {renderErrorBanner()}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order Type Selection */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="swap-horizontal" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
              <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                {t('checkout.orderType')}
              </Text>
            </View>
          </View>
          
          <View style={[styles.orderTypeContainer, isRTL && styles.rtlRow]}>
            <TouchableOpacity
              style={[
                styles.orderTypeButton,
                isRTL && styles.rtlRowReverse,
                orderType === 'delivery' && styles.selectedOrderType
              ]}
              onPress={() => setOrderType('delivery')}
            >
              <Icon name="bicycle" size={20} color={orderType === 'delivery' ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.orderTypeText,
                orderType === 'delivery' && styles.selectedOrderTypeText,
                isRTL && styles.rtlText
              ]}>
                {t('checkout.delivery')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.orderTypeButton,
                isRTL && styles.rtlRowReverse,
                orderType === 'pickup' && styles.selectedOrderType
              ]}
              onPress={() => setOrderType('pickup')}
            >
              <Icon name="storefront" size={20} color={orderType === 'pickup' ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.orderTypeText,
                orderType === 'pickup' && styles.selectedOrderTypeText,
                isRTL && styles.rtlText
              ]}>
                {t('checkout.pickup')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Zone Selection (only for delivery orders) */}
        {orderType === 'delivery' && (
          <View style={styles.section}>
            <View style={[styles.sectionHeaderColumn, isRTL && styles.rtlSectionHeaderColumn]}>
              <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                <Icon name="map-outline" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
                <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                  {t('checkout.deliveryZone')}
                </Text>
              </View>
              <Text style={[styles.sectionHint, isArabic && styles.rtlText]}>
                {t('checkout.deliveryZoneHint')}
              </Text>
            </View>
            
            <View style={[styles.deliveryZoneContainer, isRTL && styles.rtlRow]}>
              <TouchableOpacity
                style={[
                  styles.deliveryZoneButton,
                  isRTL && styles.rtlRowReverse,
                  (deliveryZone === 'inside_amman' || deliveryZone === null) && styles.selectedDeliveryZone
                ]}
                onPress={() => setDeliveryZone('inside_amman')}
              >
                <Icon 
                  name="checkmark-circle" 
                  size={20} 
                  color={(deliveryZone === 'inside_amman' || deliveryZone === null) ? '#fff' : '#007AFF'} 
                />
                <Text style={[
                  styles.deliveryZoneText,
                  (deliveryZone === 'inside_amman' || deliveryZone === null) && styles.selectedDeliveryZoneText,
                  isRTL && styles.rtlText
                ]}>
                  {t('checkout.insideAmman')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.deliveryZoneButton,
                  isRTL && styles.rtlRowReverse,
                  deliveryZone === 'outside_amman' && styles.selectedDeliveryZone
                ]}
                onPress={() => setDeliveryZone('outside_amman')}
              >
                <Icon 
                  name="location-outline" 
                  size={20} 
                  color={deliveryZone === 'outside_amman' ? '#fff' : '#007AFF'} 
                />
                <Text style={[
                  styles.deliveryZoneText,
                  deliveryZone === 'outside_amman' && styles.selectedDeliveryZoneText,
                  isRTL && styles.rtlText
                ]}>
                  {t('checkout.outsideAmman')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {deliveryZone === 'outside_amman' && (
              <View style={styles.deliveryZoneNotice}>
                <Icon name="information-circle" size={16} color="#007AFF" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                <Text style={[styles.deliveryZoneNoticeText, isRTL && styles.rtlText]}>
                  {t('checkout.outsideAmmanNotice')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Branch Selection */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="business" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
              <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                {t('checkout.selectedBranch')}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.branchSelectorCard, isRTL && styles.rtlRow]}
            onPress={() => setShowBranchModal(true)}
          >
            <View style={[{flex: 1, flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="location" size={24} color="#007AFF" style={{marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0}} />
              <View style={[{flex: 1}, isRTL && styles.rtlAlignEnd]}>
                <Text style={[styles.branchName, isRTL && styles.rtlText]}>
                  {selectedBranchId 
                    ? getBranchDisplayName(branches.find(b => b.id === selectedBranchId))
                    : t('checkout.selectBranch')}
                </Text>
                <Text style={[styles.branchHint, isRTL && styles.rtlText]}>
                  {orderType === 'pickup' 
                    ? t('checkout.pickupFrom') 
                    : t('checkout.deliveryFrom')}
                </Text>
                {selectedBranchId && orderType === 'delivery' && (() => {
                  const selectedBranch = branches.find(b => b.id === selectedBranchId);
                  if (selectedBranch?.distance_km) {
                    return (
                      <View style={[styles.branchDistanceContainer, isRTL && {flexDirection: 'row-reverse'}]}>
                        <Icon name="car-outline" size={14} color="#007AFF" style={{marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0}} />
                        <Text style={[styles.branchDistance, isRTL && styles.rtlText]}>
                          {t('checkout.distanceAway', { distance: selectedBranch.distance_km.toFixed(1) })}
                        </Text>
                        {selectedBranch.driving_duration && (
                          <Text style={[styles.branchDuration, isRTL && styles.rtlText]}>
                            {' • '}{selectedBranch.driving_duration}
                          </Text>
                        )}
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>
            </View>
            {/* <Icon name="chevron-forward" size={20} color="#999" /> */}
          </TouchableOpacity>

          {/* Branch availability warnings */}
          {branchStockWarnings.length > 0 && (
            <View style={styles.branchWarningContainer}>
              <View style={[styles.branchWarningHeader, isRTL && styles.rtlRow]}>
                <Icon name="warning" size={18} color="#ff9500" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
                <Text style={[styles.branchWarningTitle, isRTL && styles.rtlText]}>
                  {t('checkout.stockWarning')}
                </Text>
              </View>
              {branchStockDetails.map((detail, index) => (
                <Text key={index} style={[styles.branchWarningText, isRTL && styles.rtlText]}>
                  • {detail.message}
                  {detail.suggestion && (
                    <Text style={styles.branchWarningSuggestion}>
                      {' '}{detail.suggestion}
                    </Text>
                  )}
                </Text>
              ))}
            </View>
          )}

          {/* Amman-only delivery restriction warning */}
          {ammanOnlyRestrictionWarning && (
            <View style={styles.branchWarningContainer}>
              <View style={[styles.branchWarningHeader, isRTL && styles.rtlRow]}>
                <Icon name="alert-circle" size={18} color="#ff9500" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
                <Text style={[styles.branchWarningTitle, isRTL && styles.rtlText]}>
                  {t('checkout.ammanOnlyRestrictionTitle')}
                </Text>
              </View>
              <Text style={[styles.branchWarningText, isRTL && styles.rtlText]}>
                {t('checkout.ammanOnlyRestrictionMessage')}
              </Text>
              <Text style={[styles.branchWarningText, {marginTop: 8, fontWeight: '600'}, isRTL && styles.rtlText]}>
                {t('checkout.ammanOnlyRestrictionSummary', { 
                  count: ammanOnlyRestrictionWarning.count,
                  count_label: ammanOnlyRestrictionWarning.count === 1 ? t('checkout.item') || 'item' : t('checkout.items') || 'items'
                })}
              </Text>
              <Text style={[styles.branchWarningText, {marginTop: 8, fontStyle: 'italic'}, isRTL && styles.rtlText]}>
                {t('checkout.ammanOnlyRestrictionAction')}
              </Text>
              <Text style={[styles.branchWarningText, {marginTop: 12, fontWeight: '600'}, isRTL && styles.rtlText]}>
                {t('checkout.ammanOnlyItems')}
              </Text>
              {ammanOnlyRestrictionWarning.items.map((itemName, index) => (
                <Text key={index} style={[styles.branchWarningText, isRTL && styles.rtlText, {marginTop: 4}]}>
                  • {itemName}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Cart Items */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="cart" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
              <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                {t('checkout.itemsSectionTitle')}
              </Text>
            </View>
          </View>

          <View style={styles.itemsList}>
            {items.map((item, index) => {
              const productTitle = getProductTitle(item);
              const variantLabel = getVariantLabel(item);
              const unitPrice = getItemUnitPrice(item);
              const quantity = Number(item.quantity) || 0;
              const lineTotal = unitPrice * quantity;
              const quantityLabel = t('checkout.itemQuantity', { count: quantity });
              const unitLabel = unitPrice > 0 ? t('checkout.itemUnitPrice', { amount: formatAmount(unitPrice) }) : null;
              
              // Calculate base price for variant breakdown
              const basePrice = parseNumericValue(
                item.product?.final_price ?? item.product?.sale_price ?? item.product?.base_price
              );
              const hasVariantPrice = item.variants && item.variants.length > 0 && basePrice !== unitPrice;

              return (
                <React.Fragment key={`${item.product_id}-${item.variant_id ?? 'base'}`}>
                  <View style={[styles.checkoutItemRow, isRTL && styles.rtlRowReverse]}>
                    <View style={[styles.checkoutItemInfo, isRTL && styles.rtlAlignEnd]}>
                      <Text style={[styles.checkoutItemTitle, isRTL && styles.rtlText]} numberOfLines={2}>
                        {productTitle}
                      </Text>

                      {variantLabel && (
                        <View style={styles.variantDetailsContainer}>
                          <Text style={[styles.checkoutItemVariant, isRTL && styles.rtlText]}>
                            {t('checkout.itemSpecification')}: {variantLabel}
                          </Text>
                          
                          {/* Show variant count badge for multi-variant items */}
                          {item.variants && item.variants.length > 1 && (
                            <View style={styles.variantCountBadgeCheckout}>
                              <Text style={styles.variantCountTextCheckout}>
                                {item.variants.length} {t('products.options') || 'options'}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View style={[styles.checkoutItemMetaRow, isRTL && styles.rtlRowReverse]}>
                        <Text style={[styles.checkoutItemMetaText, isRTL && styles.rtlText]}>
                          {quantityLabel}
                        </Text>
                        {unitLabel && (
                          <Text
                            style={[
                              styles.checkoutItemMetaText,
                              styles.checkoutItemMetaSpacer,
                              isRTL && styles.rtlCheckoutItemMetaSpacer,
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {unitLabel}
                          </Text>
                        )}
                        
                        {/* Show base price if variants modify it */}
                        {hasVariantPrice && (
                          <Text style={[styles.checkoutBasePriceLabel, isRTL && styles.rtlText]}>
                            ({t('products.basePrice') || 'Base'}: {formatAmount(basePrice)})
                          </Text>
                        )}
                      </View>

                      {item.special_instructions && (
                        <Text style={[styles.checkoutItemNote, isRTL && styles.rtlText]}>
                          {t('cart.specialInstructions')}: {item.special_instructions}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.checkoutItemPrice, isRTL && styles.rtlCheckoutItemPrice]}>
                      {formatAmount(lineTotal)}
                    </Text>
                  </View>

                  {index < items.length - 1 && <View style={styles.checkoutItemDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Guest Information */}
        {isGuest && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
              <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                <Icon name="person" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
                <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                  {t('checkout.contactInfo')}
                </Text>
              </View>
            </View>
            
            <View style={styles.guestFormContainer}>
              <View style={styles.inputContainer}>
                <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                  <Icon name="person-outline" size={16} color="#007AFF" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    {t('auth.fullName')} *
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    isRTL && styles.rtlTextInput,
                    guestErrors.fullName && styles.inputError
                  ]}
                  value={guestInfo.fullName}
                  onChangeText={(text) => {
                    setGuestInfo(prev => ({ ...prev, fullName: text }));
                    if (guestErrors.fullName) {
                      setGuestErrors(prev => ({ ...prev, fullName: '' }));
                    }
                  }}
                  placeholder={t('auth.enterFullName')}
                  placeholderTextColor="#999"
                />
                {guestErrors.fullName && (
                  <View style={[styles.inputErrorContainer, isRTL && styles.rtlRowReverse]}>
                    <Icon name="alert-circle" size={16} color="#ff4757" />
                    <Text style={[styles.inputErrorText, isRTL && styles.rtlText]}>
                      {guestErrors.fullName}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                  <Icon name="call-outline" size={16} color="#007AFF" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    {t('auth.phone')} *
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    isRTL && styles.rtlTextInput,
                    guestErrors.phone && styles.inputError
                  ]}
                  value={guestInfo.phone}
                  onChangeText={(text) => {
                    setGuestInfo(prev => ({ ...prev, phone: text }));
                    if (guestErrors.phone) {
                      setGuestErrors(prev => ({ ...prev, phone: '' }));
                    }
                  }}
                  placeholder={t('auth.enterPhone')}
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
                {guestErrors.phone && (
                  <View style={[styles.inputErrorContainer, isRTL && styles.rtlRowReverse]}>
                    <Icon name="alert-circle" size={16} color="#ff4757" />
                    <Text style={[styles.inputErrorText, isRTL && styles.rtlText]}>
                      {guestErrors.phone}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                  <Icon name="mail-outline" size={16} color="#007AFF" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                  <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                    {t('auth.email')}
                  </Text>
                </View>
                <TextInput
                  style={[styles.textInput, isRTL && styles.rtlTextInput]}
                  value={guestInfo.email}
                  onChangeText={(text) => setGuestInfo(prev => ({ ...prev, email: text }))}
                  placeholder={t('auth.enterEmail')}
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {orderType === 'delivery' && (
                <View style={styles.inputContainer}>
                  <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                    <Icon name="location" size={16} color="#007AFF" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                      {t('checkout.deliveryAddress')} *
                    </Text>
                  </View>
                  
                  {/* GPS Location Selection - Optimized Display */}
                  {guestUseAutoLocation && guestLocation ? (
                    <View style={styles.guestGpsLocationContainer}>
                      <View style={[styles.guestGpsLocationInfo, isRTL && styles.rtlGuestGpsLocationInfo]}>
                        <Icon name="location" size={20} color="#28a745" style={{marginRight: isRTL ? 0 : 6, marginLeft: isRTL ? 6 : 0}} />
                        <View style={styles.guestGpsLocationTextContainer}>
                          <Text style={[styles.guestGpsLocationText, isRTL && styles.rtlText]}>
                            {t('address.usingGPSLocationInfo')}
                          </Text>
                          <View style={[styles.guestCoordinatesRow, isRTL && styles.rtlCoordinatesRow]}>
                            <Icon name="pin" size={13} color="#999" style={{marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0}} />
                            <Text style={[styles.guestCoordinatesText, isRTL && styles.rtlText]}>
                              {guestLocation.latitude.toFixed(6)}, {guestLocation.longitude.toFixed(6)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.guestLocationButtonsRow, isRTL && styles.rtlRow]}>
                        <TouchableOpacity 
                          style={[styles.guestChangeLocationButton, isRTL && styles.rtlGuestChangeLocationButton]}
                          onPress={handleOpenGuestMapModal}
                        >
                          <Icon name="map-outline" size={16} color="#007AFF" />
                          <Text style={[styles.guestChangeLocationText, isRTL && styles.rtlText]}>
                            {t('address.changeLocation') || 'Change Location'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={clearGuestLocation}
                          style={[styles.guestClearLocationButton, isRTL && styles.rtlGuestClearLocationButton]}
                        >
                          <Icon name="close-circle" size={16} color="#ff4757" />
                          <Text style={[styles.guestClearLocationText, isRTL && styles.rtlText]}>
                            {t('common.clear') || 'Clear'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.guestLocationButtonsContainer, isRTL && styles.rtlRow]}>
                      <TouchableOpacity
                        style={[styles.guestGpsButton, isRTL && styles.rtlRowReverse]}
                        onPress={getGuestCurrentLocation}
                        disabled={guestLocationLoading}
                      >
                        {guestLocationLoading ? (
                          <ActivityIndicator size="small" color="#007AFF" />
                        ) : (
                          <Icon name="location-outline" size={16} color="#007AFF" />
                        )}
                        <Text style={[styles.guestGpsButtonText, isRTL && styles.rtlText]}>
                          {guestLocationLoading 
                            ? t('address.detectingLocation')
                            : t('address.useCurrentLocation')
                          }
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.guestMapButton, isRTL && styles.rtlRowReverse]}
                        onPress={handleOpenGuestMapModal}
                      >
                        <Icon name="map-outline" size={16} color="#007AFF" />
                        <Text style={[styles.guestMapButtonText, isRTL && styles.rtlText]}>
                          {t('address.selectFromMap') || 'Select from Map'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <TextInput
                    style={[
                      styles.textAreaInput,
                      isRTL && styles.rtlTextInput,
                      guestErrors.address && styles.inputError,
                      guestUseAutoLocation && styles.gpsAddressInput
                    ]}
                    value={guestInfo.address}
                    onChangeText={(text) => {
                      setGuestInfo(prev => ({ ...prev, address: text }));
                      // Clear error when user starts typing
                      if (guestErrors.address) {
                        setGuestErrors(prev => ({ ...prev, address: '' }));
                      }
                    }}
                    placeholder={guestUseAutoLocation 
                      ? t('checkout.addressWithGPSPlaceholder') || 'Enter street/building details (GPS added)'
                      : t('checkout.enterDeliveryAddress')
                    }
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                    editable={!guestLocationLoading}
                  />
                  {guestErrors.address && (
                    <View style={[styles.inputErrorContainer, isRTL && styles.rtlRowReverse]}>
                      <Icon name="alert-circle" size={16} color="#ff4757" />
                      <Text style={[styles.inputErrorText, isRTL && styles.rtlText]}>
                        {guestErrors.address}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Address Selection (for delivery) */}
        {orderType === 'delivery' && !isGuest && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlSectionTitle]}>
                {t('checkout.deliveryAddress')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddressModal(true)}
                hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              >
                <Text style={[styles.changeButton, isRTL && styles.rtlText]}>
                  {t('checkout.change')}
                </Text>
              </TouchableOpacity>
            </View>
            
            {loadingAddresses ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : selectedAddress ? (
              renderAddressCard(selectedAddress, true)
            ) : (
              <TouchableOpacity 
                style={[styles.addAddressButton, isRTL && styles.rtlRowReverse]}
                onPress={() => navigation.navigate('AddressForm', {
                  isGuest: isGuest,
                })}
              >
                <Icon name="add-circle-outline" size={24} color="#007AFF" />
                <Text style={[styles.addAddressText, isRTL && styles.rtlText]}>
                  {t('checkout.addAddress')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlSectionTitle]}>
              {t('checkout.paymentMethod')}
            </Text>
            <TouchableOpacity
              onPress={() => setShowPaymentModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            >
              <Text style={[styles.changeButton, isRTL && styles.rtlText]}>
                {t('checkout.change')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.paymentMethodCard, isRTL && styles.rtlRowReverse]}>
            <Icon 
              name={paymentMethods.find(p => p.id === paymentMethod)?.icon || 'cash-outline'} 
              size={24} 
              color="#007AFF" 
            />
            <Text style={[styles.paymentMethodText, isRTL && styles.rtlText]}>
              {paymentMethods.find(p => p.id === paymentMethod)?.title}
            </Text>
          </View>
        </View>

        {/* Promo Code */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="pricetag" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
              <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                {t('checkout.promoCode')}
              </Text>
            </View>
          </View>
          
          {appliedPromo ? (
            <View style={[styles.appliedPromoCard, isRTL && styles.rtlRowReverse]}>
              <View style={[styles.appliedPromoInfo, isRTL && styles.rtlRowReverse]}>
                <Icon name="pricetag" size={20} color="#28a745" />
                <Text style={[styles.appliedPromoText, isArabic && styles.rtlText]}>
                  {appliedPromo.code} - {currentLanguage === 'ar' ? appliedPromo.title_ar : appliedPromo.title_en}
                </Text>
              </View>
              <TouchableOpacity onPress={removePromoCode}>
                <Icon name="close-circle" size={24} color="#FF4757" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.promoInputContainer, isRTL && styles.rtlRowReverse]}>
              <TextInput
                style={[styles.promoInput, isArabic && styles.rtlTextInput]}
                placeholder={t('checkout.enterPromoCode')}
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                editable={!validatingPromo}
              />
              <TouchableOpacity
                style={[styles.applyPromoButton, validatingPromo && styles.disabledButton]}
                onPress={validatePromoCode}
                disabled={validatingPromo || !promoCode.trim()}
              >
                {validatingPromo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyPromoText}>{t('checkout.apply')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
            <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
              <Icon name="document-text" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
              <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                {t('checkout.specialInstructions')}
              </Text>
            </View>
          </View>
          
          <TextInput
            style={[styles.instructionsInput, isArabic && styles.rtlTextInput]}
            placeholder={t('checkout.specialInstructionsPlaceholder')}
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Order Summary */}
        {orderCalculation && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.rtlSectionHeader]}>
              <View style={[{flexDirection: 'row', alignItems: 'center'}, isRTL && {flexDirection: 'row-reverse'}]}>
                <Icon name="receipt" size={20} color="#007AFF" style={{marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0}} />
                <Text style={[styles.sectionTitle, isArabic && styles.rtlText, {marginBottom: 0}]}>
                  {t('checkout.orderSummary')}
                </Text>
              </View>
            </View>
            
            <View style={styles.summaryCard}>
              <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.summaryLabel, isArabic && styles.rtlText]}>
                  {t('checkout.subtotal')}
                </Text>
                <Text style={[styles.summaryValue, isArabic && styles.rtlText]}>
                  {formatAmount(orderCalculation.subtotal)}
                </Text>
              </View>
              
              {orderType === 'delivery' && (
                <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                  <View style={[styles.deliveryFeeContainer, isRTL && styles.rtlRowReverse]}>
                    <Text style={[styles.summaryLabel, isArabic && styles.rtlText]}>
                      {t('checkout.deliveryFee')}
                    </Text>
                    {orderCalculation.delivery_calculation?.free_shipping_applied && Number(orderCalculation.delivery_fee) === 0 && (
                      <Text style={[styles.freeShippingBadge, isArabic && styles.rtlText]}>
                        {t('checkout.free') || 'FREE'}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.summaryValue, 
                    isArabic ? styles.rtlText : styles.ltrText,
                    orderCalculation.delivery_calculation?.free_shipping_applied && Number(orderCalculation.delivery_fee) === 0 && styles.freeValue
                  ]}>
                    {Number(orderCalculation.delivery_fee) === 0 && orderCalculation.delivery_calculation?.free_shipping_applied
                      ? t('checkout.free') || 'FREE'
                      : formatAmount(Number(orderCalculation.delivery_fee) || 0)
                    }
                  </Text>
                </View>
              )}
              
              {/* Show discount row only for non-free-shipping promos */}
              {(appliedPromo || lastValidatedPromoRef.current || orderCalculation.discount_amount > 0) && 
               orderCalculation.discount_amount > 0 && 
               (!appliedPromo || appliedPromo.discount_type !== 'free_shipping') && (
                <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                  <Text style={[styles.summaryLabel, styles.discountLabel, isArabic ? styles.rtlText : styles.ltrText]}>
                    {`${t('checkout.discount')}${(appliedPromo || lastValidatedPromoRef.current) ? ` (${(appliedPromo || lastValidatedPromoRef.current)?.code})` : ''}`}
                  </Text>
                  <Text style={[styles.summaryValue, styles.discountValue, isArabic ? styles.rtlText : styles.ltrText]}>
                    {formatAmount(-(orderCalculation.discount_amount || 0))}
                  </Text>
                </View>
              )}
              
              {/* Show shipping discount for free shipping promos */}
              {orderCalculation.shipping_discount_amount > 0 && (
                <View style={[styles.summaryRow, isRTL && styles.rtlSummaryRow]}>
                  <Text style={[styles.summaryLabel, styles.discountLabel, isArabic ? styles.rtlText : styles.ltrText]}>
                    {`${t('checkout.shippingDiscount')}${(appliedPromo?.discount_type === 'free_shipping') ? ` (${appliedPromo.code})` : ''}`}
                  </Text>
                  <Text style={[styles.summaryValue, styles.discountValue, isArabic ? styles.rtlText : styles.ltrText]}>
                    {formatAmount(-Number(orderCalculation.shipping_discount_amount || 0))}
                  </Text>
                </View>
              )}
              
              <View style={[styles.summaryRow, styles.totalRow, isRTL && styles.rtlSummaryRow]}>
                <Text style={[styles.totalLabel, isArabic ? styles.rtlText : styles.ltrText]}>
                  {t('checkout.total')}
                </Text>
                <Text style={[styles.totalValue, isArabic ? styles.rtlText : styles.ltrText]}>
                  {formatAmount(orderCalculation.total_amount)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Place Order Button */}
  <View style={[styles.bottomContainer, isRTL && styles.rtlContainer]}>
        {/* Order Progress Indicator */}
        {!canPlaceOrder && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${orderProgress}%` }]} />
            </View>
            <Text style={[styles.progressText, isRTL ? styles.rtlText : styles.ltrText]}>
              {orderProgress < 100 ? t('checkout.progressComplete', { progress: orderProgress }) : t('checkout.readyToPlaceOrder')}
            </Text>
          </View>
        )}
        
        <EnhancedButton
          title={placingOrder ? '' : t('checkout.placeOrder')}
          subtitle={!placingOrder && orderCalculation ? formatAmount(orderCalculation.total_amount) : undefined}
          onPress={placeOrder}
          loading={placingOrder}
          loadingText={t('checkout.placingOrder')}
          disabled={!canPlaceOrder || loading}
          variant={canPlaceOrder ? 'primary' : 'secondary'}
          size="large"
          icon={canPlaceOrder ? 'checkmark-circle' : 'alert-circle'}
          style={styles.placeOrderButtonEnhanced}
        />
        
        {!canPlaceOrder && (
          <Text style={[styles.requirementsText, isRTL ? styles.rtlText : styles.ltrText]}>
            {(() => {
              if (!items || items.length === 0) return t('checkout.addItemsToCart');
              // Check for Amman-only restriction FIRST (most specific)
              if (orderType === 'delivery' && deliveryZone === 'outside_amman' && ammanOnlyRestrictionWarning && ammanOnlyRestrictionWarning.count > 0) {
                return t('checkout.ammanOnlyRestrictionAction');
              }
              if (orderType === 'delivery' && isGuest && !guestInfo.address.trim()) return t('checkout.enterDeliveryAddressRequired');
              if (orderType === 'delivery' && isGuest && guestInfo.address.trim() && (!guestLocation || !guestUseAutoLocation)) return t('checkout.useGPSForDeliveryPrice');
              if (orderType === 'delivery' && !isGuest && !selectedAddress) return t('checkout.selectDeliveryAddress');
              if (isGuest && (!guestInfo.fullName.trim() || !guestInfo.phone.trim())) return t('checkout.completeContactInfo');
              if (!selectedBranchId && !branches[0]?.id) return t('checkout.selectBranchRequired');
              if (branchStockWarnings.length > 0) return t('checkout.branchStockUnavailable');
              if (!orderCalculation || !Number.isFinite(Number(orderCalculation.total_amount))) return t('checkout.waitForCalculation');
              return t('checkout.completeAllRequirements');
            })()}
          </Text>
        )}
      </View>

      {/* Enhanced Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        duration={4000}
        onHide={() => setShowToast(false)}
      />

      {/* Address Selection Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddressModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlModalTitle]}>
              {t('checkout.selectAddress')}
            </Text>
            <TouchableOpacity onPress={() => setShowAddressModal(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {(addresses || []).map(address => renderAddressCard(address, address?.id === selectedAddress?.id))}
            
            <TouchableOpacity 
              style={[styles.addNewAddressButton, isRTL && styles.rtlRowReverse]}
              onPress={() => {
                setShowAddressModal(false);
                navigation.navigate('AddressForm', {
                  isGuest: isGuest,
                });
              }}
            >
              <Icon name="add-circle" size={24} color="#007AFF" />
              <Text style={[styles.addNewAddressText, isRTL && styles.rtlText]}>
                {t('checkout.addNewAddress')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlModalTitle]}>
              {t('checkout.selectPaymentMethod')}
            </Text>
            <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            {(paymentMethods || []).map(method => (
              <TouchableOpacity
                key={method?.id}
                style={[
                  styles.paymentOptionCard,
                  paymentMethod === method?.id && styles.selectedPaymentOption,
                  isRTL && styles.rtlRowReverse
                ]}
                onPress={() => {
                  setPaymentMethod(method?.id);
                  setShowPaymentModal(false);
                }}
              >
                <Icon name={method?.icon || 'cash-outline'} size={24} color="#007AFF" />
                <Text style={[styles.paymentOptionText, isRTL && styles.rtlText]}>
                  {method.title}
                </Text>
                {paymentMethod === method.id && (
                  <Icon name="checkmark-circle" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Guest Map Selection Modal */}
      <Modal
        visible={showGuestMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setMapError(null);
          setShowGuestMapModal(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <TouchableOpacity
              onPress={() => setShowGuestMapModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('address.selectLocationFromMap')}
            </Text>
            <TouchableOpacity
              onPress={confirmMapLocation}
              style={[styles.modalConfirmButton, !mapLocation && { opacity: 0.5 }]}
              disabled={!mapLocation}
            >
              <Text style={styles.modalConfirmText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Map Search */}
          <View style={styles.mapSearchContainer}>
            <View style={[styles.mapSearchInputContainer, isRTL && styles.rtlMapSearchInputContainer]}>
              <Icon name="search" size={20} color="#666" style={[styles.mapSearchIcon, isRTL && styles.rtlMapSearchIcon]} />
              <TextInput
                style={[styles.mapSearchInput, isRTL && styles.rtlTextInput]}
                placeholder={t('address.searchPlaces') || 'Search places...'}
                value={mapSearchQuery}
                onChangeText={(text) => {
                  setMapSearchQuery(text);
                  searchPlaces(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {mapSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setMapSearchQuery('');
                    setMapSearchResults([]);
                  }}
                  style={[styles.mapSearchClearButton, isRTL && styles.rtlMapSearchClearButton]}
                >
                  <Icon name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Search Results */}
            {mapSearchResults.length > 0 && (
              <View style={styles.mapSearchResults}>
                <ScrollView style={styles.mapSearchResultsList} keyboardShouldPersistTaps="handled">
                  {mapSearchResults.map((result) => (
                    <TouchableOpacity
                      key={result.place}
                      style={[styles.mapSearchResultItem, isRTL && styles.rtlMapSearchResultItem]}
                      onPress={() => selectSearchResult(result)}
                    >
                      <Icon name="location" size={16} color="#007AFF" />
                      <Text style={[styles.mapSearchResultText, isRTL && styles.rtlMapSearchResultText]} numberOfLines={2}>
                        {result.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {isSearchingMap && (
              <View style={[styles.mapSearchLoading, isRTL && styles.rtlMapSearchLoading]}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={[styles.mapSearchLoadingText, isRTL && styles.rtlText]}>{t('common.searching')}</Text>
              </View>
            )}
          </View>
          
          {/* WebView Map */}
          <WebView
            style={styles.map}
            source={{
              html: `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .leaflet-control-attribution { display: none !important; }
    </style>
</head>
<body>
    <div id="map"></div>
    
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Initialize map
        var map = L.map('map').setView([${mapRegion.latitude}, ${mapRegion.longitude}], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Current marker
        var marker = null;
        
        // Set initial marker if location exists
        ${mapLocation ? `
        marker = L.marker([${mapLocation.latitude}, ${mapLocation.longitude}]).addTo(map);
        ` : ''}
        
        // Handle map clicks
        map.on('click', function(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            
            // Remove existing marker
            if (marker) {
                map.removeLayer(marker);
            }
            
            // Add new marker
            marker = L.marker([lat, lng]).addTo(map);
            
            // Send coordinates to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_selected',
                latitude: lat,
                longitude: lng
            }));
        });
        
        // Handle messages from React Native
        window.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                
                if (data.type === 'set_location') {
                    // Remove existing marker
                    if (marker) {
                        map.removeLayer(marker);
                    }
                    
                    // Add marker at specified location
                    marker = L.marker([data.latitude, data.longitude]).addTo(map);
                    map.setView([data.latitude, data.longitude], 15);
                }
                
                if (data.type === 'center_map') {
                    map.setView([data.latitude, data.longitude], data.zoom || 13);
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    </script>
</body>
</html>
              `
            }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'location_selected') {
                  setMapLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                  });
                }
              } catch (error) {
                console.error('Error parsing map message:', error);
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </SafeAreaView>
      </Modal>

      {/* Branch Selection Modal */}
      <Modal
        visible={showBranchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBranchModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <TouchableOpacity
              onPress={() => setShowBranchModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('checkout.selectBranch')}
            </Text>
            <View style={{width: 24}} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{padding: 15}}>
            <Text style={[styles.branchModalHint, isRTL && styles.rtlText]}>
              {orderType === 'pickup' 
                ? t('checkout.selectPickupBranch')
                : t('checkout.selectDeliveryBranch')}
            </Text>

            {branches.map((branch) => {
              const isSelected = selectedBranchId === branch.id;
              const branchName = getBranchDisplayName(branch);
              const branchStatus = getBranchStatus(branch.id);
              
              return (
                <TouchableOpacity
                  key={branch.id}
                  style={[
                    styles.paymentOptionCard,
                    isSelected && styles.selectedPaymentOption,
                    isRTL && styles.rtlRow
                  ]}
                  onPress={() => {
                    setSelectedBranchId(branch.id);
                    setShowBranchModal(false);
                    // Trigger recalculation with new branch
                    setTimeout(() => calculateOrder(), 300);
                  }}
                >
                  <Icon 
                    name={isSelected ? "radio-button-on" : "radio-button-off"} 
                    size={24} 
                    color={isSelected ? "#007AFF" : "#999"} 
                  />
                  <View style={[styles.branchTextWrapper, isRTL && styles.rtlAlignEnd]}>
                    <View style={[styles.branchNameRow, isRTL && styles.rtlRow]}>
                      <Text style={[styles.paymentOptionText, isRTL && styles.rtlText]}>
                        {branchName}
                      </Text>
                      <View style={[styles.branchStatusBadge, { backgroundColor: `${branchStatus.color}15`, borderColor: branchStatus.color }]}>
                        <Icon name={branchStatus.icon} size={12} color={branchStatus.color} style={{marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0}} />
                        <Text style={[styles.branchStatusText, { color: branchStatus.color }, isRTL && styles.rtlText]}>
                          {branchStatus.label}
                        </Text>
                      </View>
                    </View>
                    {branch.distance_km && (
                      <View style={styles.branchDistanceContainer}>
                        <Icon name="car-outline" size={14} color="#007AFF" style={{marginRight: isRTL ? 0 : 4, marginLeft: isRTL ? 4 : 0}} />
                        <Text style={[styles.branchDistance, isRTL && styles.rtlText]}>
                          {t('checkout.distanceAway', { distance: branch.distance_km.toFixed(1) })}
                        </Text>
                        {branch.driving_duration && (
                          <Text style={[styles.branchDuration, isRTL && styles.rtlText]}>
                            {' • '}{branch.driving_duration}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {isSelected && (
                    <Icon name="checkmark-circle" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionHeaderColumn: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  rtlSectionHeader: {
    flexDirection: 'row-reverse',
  },
  rtlSectionHeaderColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  sectionHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    marginLeft: 28,
    fontStyle: 'italic',
    lineHeight: 16,
    maxWidth: '90%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  rtlSectionTitle: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlTextStrong: {
    textAlign: 'right',
    writingDirection: 'rtl',
    textAlignVertical: 'top',
  },
  ltrText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlAlignEnd: {
    alignItems: 'flex-end',
  },
  rtlRowReverse: {
    flexDirection: 'row-reverse',
  },
  changeButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 8,
    color: '#666',
    fontSize: 12,
  },
  rtlHelperText: {
    textAlign: 'right',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF5E6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
    marginTop: 12,
  },
  warningIcon: {
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
    marginStart: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B26A00',
  },
  rtlWarningTitle: {
    textAlign: 'right',
  },
  warningText: {
    fontSize: 13,
    color: '#B26A00',
    marginTop: 4,
  },
  rtlWarningText: {
    textAlign: 'right',
  },
  warningItem: {
    marginTop: 8,
  },
  warningItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4D00',
  },
  warningSuggestion: {
    fontSize: 12,
    color: '#9C5A00',
    marginTop: 4,
  },
  
  // Order Type Styles
  orderTypeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  orderTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  selectedOrderType: {
    backgroundColor: '#007AFF',
  },
  orderTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginStart: 8,
  },
  selectedOrderTypeText: {
    color: '#fff',
  },

  // Delivery Zone Styles - Responsive
  deliveryZoneContainer: {
    flexDirection: 'row',
    gap: Math.min(Dimensions.get('window').width * 0.04, 10),
    flexWrap: 'wrap' as any,
    justifyContent: 'space-between',
  },
  deliveryZoneButton: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 120 : Math.min(Dimensions.get('window').width * 0.35, 160),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.select({
      ios: Dimensions.get('window').width > 375 ? 14 : 11,
      android: Dimensions.get('window').width > 375 ? 14 : 11,
      default: 14,
    }),
    paddingHorizontal: Platform.select({
      ios: Dimensions.get('window').width > 375 ? 14 : 10,
      android: Dimensions.get('window').width > 375 ? 14 : 10,
      default: 14,
    }),
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
    gap: 6,
  },
  selectedDeliveryZone: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  deliveryZoneText: {
    fontSize: Dimensions.get('window').width > 375 ? 14 : 12.5,
    fontWeight: '500',
    color: '#007AFF',
    flexShrink: 1,
    flex: 1,
    textAlign: 'center',
  },
  selectedDeliveryZoneText: {
    color: '#fff',
    fontWeight: '600',
  },
  deliveryZoneNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: Dimensions.get('window').width > 375 ? 11 : 9,
    marginTop: 12,
    gap: 8,
  },
  deliveryZoneNoticeText: {
    flex: 1,
    fontSize: Dimensions.get('window').width > 375 ? 13 : 11.5,
    color: '#1976D2',
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  
  // Address Styles
  addressCard: {
    backgroundColor: '#ffffff',
    marginBottom: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedAddressCard: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  addressDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  addressNotes: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    lineHeight: 16,
  },
  deliveryFee: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  addressContent: {
    flex: 1,
  },
  editAddressButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  rtlEditAddressButton: {
    right: undefined,
    left: 10,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addAddressText: {
    fontSize: 16,
    color: '#007AFF',
    marginStart: 8,
    fontWeight: '500',
  },
  
  // Payment Method Styles
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    color: '#333',
    marginStart: 12,
    fontWeight: '500',
  },
  
  // Promo Code Styles
  promoInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  rtlTextInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  applyPromoButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyPromoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appliedPromoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  appliedPromoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appliedPromoText: {
    fontSize: 14,
    color: '#28a745',
    marginStart: 8,
    fontWeight: '500',
  },

  // Cart Items Styles
  itemsList: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  checkoutItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  checkoutItemInfo: {
    flex: 1,
    marginEnd: 12,
  },
  checkoutItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rtlCheckoutItemTitle: {
    textAlign: 'right',
  },
  checkoutItemVariant: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 4,
  },
  rtlCheckoutItemVariant: {
    textAlign: 'right',
  },
  variantDetailsContainer: {
    marginTop: 4,
  },
  variantCountBadgeCheckout: {
    backgroundColor: '#007AFF15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  variantCountTextCheckout: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  checkoutBasePriceLabel: {
    fontSize: 11,
    color: '#999',
    marginStart: 8,
    fontStyle: 'italic',
  },
  checkoutItemMetaRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  checkoutItemMetaText: {
    fontSize: 13,
    color: '#6C757D',
  },
  checkoutItemMetaSpacer: {
    marginStart: 12,
  },
  rtlCheckoutItemMetaSpacer: {
    marginStart: 0,
    marginEnd: 12,
  },
  checkoutItemNote: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 6,
  },
  checkoutItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    minWidth: 80,
    marginStart: 12,
  },
  rtlCheckoutItemPrice: {
    textAlign: 'left',
    marginStart: 0,
    marginEnd: 12,
  },
  checkoutItemDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  
  // Instructions Styles
  instructionsInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 80,
  },
  
  // Summary Styles
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
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
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  discountLabel: {
    color: '#28a745',
  },
  discountValue: {
    color: '#28a745',
  },
  deliveryFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeShippingBadge: {
    backgroundColor: '#28a745',
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  freeValue: {
    color: '#28a745',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  
  // Bottom Container
  bottomContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  placeOrderButtonEnhanced: {
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  placeOrderButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 18,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeOrderAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rtlModalHeader: {
    flexDirection: 'row-reverse',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rtlModalTitle: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 10,
  },
  addNewAddressText: {
    fontSize: 16,
    color: '#007AFF',
    marginStart: 8,
    fontWeight: '500',
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPaymentOption: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  disabledBranchOption: {
    opacity: 0.6,
  },
  paymentOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginStart: 12,
    fontWeight: '500',
  },
  disabledBranchText: {
    color: '#9AA0A6',
  },
  branchTextWrapper: {
    flex: 1,
    marginStart: 12,
  },
  branchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  branchStatusLoader: {
    marginTop: 2,
    marginEnd: 6,
  },
  branchStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  branchStatusAvailable: {
    color: '#1BA466',
  },
  branchStatusLimited: {
    color: '#F39C12',
  },
  branchStatusWarning: {
    color: '#E67E22',
  },
  branchStatusUnavailable: {
    color: '#D9534F',
  },
  branchStatusInactive: {
    color: '#6C757D',
  },
  branchStatusNeutral: {
    color: '#5C6C7C',
  },
  branchStatusMessage: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 4,
  },
  branchStatusIssues: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 2,
  },
  
  // Guest Form Styles
  guestFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff4757',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 12,
    marginTop: 4,
  },
  inputErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    gap: 6,
  },
  inputErrorText: {
    color: '#ff4757',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  
  // Error Banner Styles
  errorContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4757',
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 8,
  },
  rtlErrorBanner: {
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderRightColor: '#FF4757',
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorText: {
    color: '#c22032',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dismissButton: {
    padding: 4,
  },
  
  // GPS Address Styles
  addressHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  gpsButtonActive: {
    backgroundColor: '#007AFF',
  },
  gpsButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  gpsButtonTextActive: {
    color: '#fff',
  },
  gpsInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
    gap: 8,
  },
  gpsInfoText: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
    flex: 1,
  },
  clearGpsButton: {
    padding: 2,
  },
  gpsAddressInput: {
    backgroundColor: '#f8fff8',
    borderColor: '#28a745',
  },
  
  // Address buttons container
  addressButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  
  // Guest GPS Location Styles (matching AddressFormScreen)
  guestGpsLocationContainer: {
    marginBottom: 15,
  },
  guestGpsLocationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  rtlGuestGpsLocationInfo: {
    flexDirection: 'row-reverse',
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderRightColor: '#28a745',
  },
  guestGpsLocationTextContainer: {
    flex: 1,
  },
  guestGpsLocationText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    lineHeight: 20,
  },
  guestCoordinatesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  guestCoordinatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rtlCoordinatesRow: {
    flexDirection: 'row-reverse',
  },
  guestLocationButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'stretch',
  },
  guestChangeLocationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rtlGuestChangeLocationButton: {
    flexDirection: 'row-reverse',
  },
  guestChangeLocationText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  guestClearLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ff4757',
  },
  rtlGuestClearLocationButton: {
    flexDirection: 'row-reverse',
  },
  guestClearLocationText: {
    fontSize: 13,
    color: '#ff4757',
    fontWeight: '600',
  },
  
  // Guest location buttons (when no GPS selected)
  guestLocationButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  guestGpsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  guestGpsButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  guestMapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  guestMapButtonText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  
  // Old map button styles (kept for compatibility)
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  mapButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Map Modal Styles
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  map: {
    flex: 1,
  },
  
  // Map Search Styles
  mapSearchContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mapSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rtlMapSearchInputContainer: {
    flexDirection: 'row-reverse',
  },
  mapSearchIcon: {
    marginRight: 8,
  },
  rtlMapSearchIcon: {
    marginRight: 0,
    marginLeft: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  mapSearchClearButton: {
    marginLeft: 8,
  },
  rtlMapSearchClearButton: {
    marginLeft: 0,
    marginRight: 8,
  },
  mapSearchResults: {
    backgroundColor: '#fff',
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  mapSearchResultsList: {
    maxHeight: 200,
  },
  mapSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  rtlMapSearchResultItem: {
    flexDirection: 'row-reverse',
  },
  mapSearchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  rtlMapSearchResultText: {
    marginLeft: 0,
    marginRight: 8,
  },
  mapSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  rtlMapSearchLoading: {
    flexDirection: 'row-reverse',
  },
  mapSearchLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  
  // Branch Selector Styles
  branchSelectorCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  branchHint: {
    fontSize: 14,
    color: '#666',
  },
  branchDistance: {
    fontSize: 13,
    color: '#666',
    fontWeight: '400',
  },
  branchDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  branchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  branchStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  branchDuration: {
    fontSize: 13,
    color: '#666',
    fontWeight: '400',
  },
  branchWarningContainer: {
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9500',
  },
  branchWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  branchWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff9500',
  },
  branchWarningText: {
    fontSize: 13,
    color: '#8b6914',
    marginBottom: 4,
    lineHeight: 18,
  },
  branchWarningSuggestion: {
    fontSize: 13,
    color: '#007AFF',
    fontStyle: 'italic',
  },
  branchModalHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
});

export default CheckoutScreen;
