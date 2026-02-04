import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Product, ProductVariant } from '../services/apiService';
import { computeVariantPriceFromBase, normalizeVariantPricingMetadata } from '../utils/variantPricing';

interface CartState {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  loading: boolean;
}

interface CartContextType extends CartState {
  addToCart: (
    product: Product,
    quantity?: number,
    options?: {
      variant?: ProductVariant | null;
      variants?: ProductVariant[]; // Support multiple variants
      specialInstructions?: string;
      unitPriceOverride?: number;
      baseUnitPrice?: number;
    }
  ) => void;
  removeFromCart: (product_id: number, variant_id?: number) => void;
  updateQuantity: (product_id: number, quantity: number, variant_id?: number) => void;
  clearCart: () => void;
  clearGuestCart: () => Promise<void>; // New method to clear guest cart data
  getCartItem: (product_id: number, variant_id?: number) => CartItem | undefined;
  switchToGuestMode: () => Promise<void>; // Switch cart to guest mode
  switchToAuthMode: () => Promise<void>; // Switch cart to authenticated mode
}

type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { product_id: number; variant_id?: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { product_id: number; quantity: number; variant_id?: number } }
  | { type: 'CLEAR_CART' };

const CartContext = createContext<CartContextType | undefined>(undefined);

const parseNumericPrice = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

const deriveBasePriceSnapshot = (product?: Product): number => {
  if (!product) return 0;

  const finalPrice = parseNumericPrice(product.final_price);
  if (finalPrice > 0) {
    return finalPrice;
  }

  const basePrice = parseNumericPrice(product.base_price);
  const salePrice = parseNumericPrice(product.sale_price);

  if (salePrice > 0 && salePrice < basePrice) {
    return salePrice;
  }

  return basePrice > 0 ? basePrice : salePrice;
};

const computeUnitPrice = (item: CartItem): number => {
  const baseSnapshot = isValidNumber(item.base_unit_price)
    ? item.base_unit_price
    : deriveBasePriceSnapshot(item.product);

  const basePrice = baseSnapshot;

  const normalizedVariants = item.variants?.map(normalizeVariantPricingMetadata);

  if (normalizedVariants && normalizedVariants.length > 0) {
    let currentPrice = basePrice;
    let winningOverride: ProductVariant | undefined;

    const overrideCandidates = normalizedVariants.filter(
      variant => variant.price_behavior === 'override'
    );

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

    const additiveVariants = normalizedVariants.filter(variant => {
      if (variant.price_behavior === 'override') {
        return !winningOverride || variant.id !== winningOverride.id;
      }
      return true;
    });

    for (const variant of additiveVariants) {
      const { additionAmount, behavior, overrideApplied } = computeVariantPriceFromBase(basePrice, variant);
      if (behavior === 'override' && overrideApplied) {
        // Treat additional overrides as full replacements
        currentPrice = additionAmount + basePrice;
      } else {
        currentPrice += additionAmount;
      }
    }

    return currentPrice;
  }

  if (item.variant) {
    const normalizedVariant = normalizeVariantPricingMetadata(item.variant);
    const { unitPrice } = computeVariantPriceFromBase(basePrice, normalizedVariant);
    if (unitPrice > 0) {
      return unitPrice;
    }
  }

  if (basePrice > 0) {
    return basePrice;
  }

  if (isValidNumber(item.unit_price)) {
    return item.unit_price;
  }

  return basePrice;
};

const getCartItemUnitPrice = (item: CartItem): number => {
  const computedPrice = computeUnitPrice(item);

  if (Number.isFinite(computedPrice) && computedPrice > 0) {
    return computedPrice;
  }

  const storedUnitPrice = parseNumericPrice(item.unit_price);
  if (storedUnitPrice > 0) {
    return storedUnitPrice;
  }

  return Number.isFinite(computedPrice) ? computedPrice : 0;
};

const hydrateCartItemVariant = (item: CartItem): CartItem => {
  if (item.variant || !item.variant_id || !item.product?.variants) {
    return item;
  }

  const matchedVariant = item.product.variants.find(variant => variant.id === item.variant_id);
  if (matchedVariant) {
    return {
      ...item,
      variant: normalizeVariantPricingMetadata(matchedVariant),
    };
  }

  return item;
};

const normalizeCartItemVariants = (item: CartItem): CartItem => {
  if (!item.variants || item.variants.length === 0) {
    return item;
  }

  const normalizedVariants = item.variants.map(normalizeVariantPricingMetadata);
  const shouldUpdate = normalizedVariants.some((variant, index) => variant !== item.variants?.[index]);
  return shouldUpdate ? { ...item, variants: normalizedVariants } : item;
};

const attachBaseUnitPriceSnapshot = (item: CartItem): CartItem => {
  if (isValidNumber(item.base_unit_price)) {
    return item;
  }

  const snapshot = deriveBasePriceSnapshot(item.product);
  if (Number.isFinite(snapshot)) {
    return {
      ...item,
      base_unit_price: snapshot,
    };
  }

  return item;
};

const ensureCartItemUnitPrice = (item: CartItem): CartItem => {
  const hydratedItem = attachBaseUnitPriceSnapshot(normalizeCartItemVariants(hydrateCartItemVariant(item)));
  return {
    ...hydratedItem,
    unit_price: getCartItemUnitPrice(hydratedItem),
  };
};

const aggregateCartState = (items: CartItem[]) => {
  return items.reduce(
    (acc, item) => {
      const unitPrice = getCartItemUnitPrice(item);
      return {
        itemCount: acc.itemCount + item.quantity,
        totalAmount: acc.totalAmount + unitPrice * item.quantity,
      };
    },
    { itemCount: 0, totalAmount: 0 }
  );
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_CART':
      const normalizedItems = action.payload.map(ensureCartItemUnitPrice);
      const { itemCount: setItemCount, totalAmount: setTotalAmount } = aggregateCartState(normalizedItems);
      return {
        ...state,
        items: normalizedItems,
        itemCount: setItemCount,
        totalAmount: setTotalAmount,
        loading: false,
      };

    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        item => item.product_id === action.payload.product_id && 
                 item.variant_id === action.payload.variant_id
      );

      let newItems: CartItem[];
      const incomingItem = ensureCartItemUnitPrice(action.payload);
      if (existingItemIndex >= 0) {
        // Update existing item quantity and refresh pricing metadata
        newItems = state.items.map((item, index) => {
          if (index !== existingItemIndex) {
            return item;
          }

          const mergedItem: CartItem = {
            ...item,
            quantity: item.quantity + incomingItem.quantity,
            variant: incomingItem.variant ?? item.variant,
            variants: incomingItem.variants ?? item.variants,
            unit_price: incomingItem.unit_price,
            base_unit_price: isValidNumber(incomingItem.base_unit_price)
              ? incomingItem.base_unit_price
              : item.base_unit_price,
          };

          return ensureCartItemUnitPrice(mergedItem);
        });
      } else {
        // Add new item
        newItems = [...state.items, incomingItem];
      }

      const { itemCount, totalAmount } = aggregateCartState(newItems);

      return {
        ...state,
        items: newItems,
        itemCount,
        totalAmount,
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(
        item => !(item.product_id === action.payload.product_id && 
                 item.variant_id === action.payload.variant_id)
      );

      const { itemCount, totalAmount } = aggregateCartState(newItems);

      return {
        ...state,
        items: newItems,
        itemCount,
        totalAmount,
      };
    }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        // Remove item if quantity is 0 or negative
        return cartReducer(state, {
          type: 'REMOVE_ITEM',
          payload: { 
            product_id: action.payload.product_id, 
            variant_id: action.payload.variant_id 
          }
        });
      }

      const newItems = state.items.map(item =>
        item.product_id === action.payload.product_id && 
        item.variant_id === action.payload.variant_id
          ? { ...item, quantity: action.payload.quantity }
          : item
      );

      const { itemCount, totalAmount } = aggregateCartState(newItems);

      return {
        ...state,
        items: newItems,
        itemCount,
        totalAmount,
      };
    }

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        itemCount: 0,
        totalAmount: 0,
      };

    default:
      return state;
  }
};

const initialState: CartState = {
  items: [],
  itemCount: 0,
  totalAmount: 0,
  loading: true,
};

const CART_STORAGE_KEY = '@cart_items';
const GUEST_CART_STORAGE_KEY = '@guest_cart_items';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isGuestMode, setIsGuestMode] = React.useState(false);

  // Load cart from AsyncStorage on initialization
  useEffect(() => {
    loadCart();
  }, [isGuestMode]);

  // Save cart to AsyncStorage whenever items change
  useEffect(() => {
    if (!state.loading) {
      saveCart();
    }
  }, [state.items, state.loading, isGuestMode]);

  const getCurrentStorageKey = () => {
    return isGuestMode ? GUEST_CART_STORAGE_KEY : CART_STORAGE_KEY;
  };

  const loadCart = async () => {
    try {
      const storageKey = getCurrentStorageKey();
      const cartData = await AsyncStorage.getItem(storageKey);
      if (cartData) {
        const items: CartItem[] = JSON.parse(cartData);
        dispatch({ type: 'SET_CART', payload: items });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const saveCart = async () => {
    try {
      const storageKey = getCurrentStorageKey();
      await AsyncStorage.setItem(storageKey, JSON.stringify(state.items));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (
    product: Product,
    quantity: number = 1,
    options?: {
      variant?: ProductVariant | null;
      variants?: ProductVariant[]; // Support multiple variants
      specialInstructions?: string;
      unitPriceOverride?: number;
      baseUnitPrice?: number;
    }
  ) => {
    const selectedVariant = options?.variant ?? null;
    const selectedVariants = options?.variants ?? undefined;
    const unitPrice = options?.unitPriceOverride;
    const baseUnitPrice = options?.baseUnitPrice;

    const cartItem: CartItem = {
      product_id: product.id,
      variant_id: selectedVariant?.id ?? undefined,
      variants: selectedVariants, // Include multiple variants if provided
      quantity,
      special_instructions: options?.specialInstructions,
      product,
      variant: selectedVariant,
      unit_price: unitPrice,
      base_unit_price: baseUnitPrice,
    };

    dispatch({ type: 'ADD_ITEM', payload: cartItem });
  };

  const removeFromCart = (product_id: number, variant_id?: number) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { product_id, variant_id } });
  };

  const updateQuantity = (product_id: number, quantity: number, variant_id?: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { product_id, quantity, variant_id } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const clearGuestCart = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY);
      console.log('✅ Guest cart data cleared');
    } catch (error) {
      console.error('❌ Failed to clear guest cart:', error);
    }
  };

  const switchToGuestMode = async (): Promise<void> => {
    setIsGuestMode(true);
    // Load guest cart data
    await loadCart();
  };

  const switchToAuthMode = async (): Promise<void> => {
    setIsGuestMode(false);
    // Load authenticated user cart data
    await loadCart();
  };

  const getCartItem = (product_id: number, variant_id?: number): CartItem | undefined => {
    return state.items.find(
      item => item.product_id === product_id && item.variant_id === variant_id
    );
  };

  const value: CartContextType = {
    ...state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    clearGuestCart,
    switchToGuestMode,
    switchToAuthMode,
    getCartItem,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
