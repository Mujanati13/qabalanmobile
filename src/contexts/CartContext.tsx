import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService, { CartItem, Product, ProductVariant } from '../services/apiService';
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
  removeFromCart: (product_id: number, variant_id?: number, variants?: ProductVariant[]) => void;
  updateQuantity: (product_id: number, quantity: number, variant_id?: number, variants?: ProductVariant[]) => void;
  clearCart: () => void;
  clearGuestCart: () => Promise<void>; // Clear guest cart data
  clearAllCartStorage: () => Promise<void>; // Clear ALL cart storage (for debugging)
  debugStorage: () => Promise<void>; // Debug storage contents
  getCartItem: (product_id: number, variant_id?: number, variants?: ProductVariant[]) => CartItem | undefined;
  switchToGuestMode: () => Promise<void>; // Switch cart to guest mode
  switchToAuthMode: () => Promise<void>; // Switch cart to authenticated mode
  refreshCartProducts: () => Promise<void>;
}

type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { product_id: number; variant_id?: number; variants?: ProductVariant[] } }
  | { type: 'UPDATE_QUANTITY'; payload: { product_id: number; quantity: number; variant_id?: number; variants?: ProductVariant[] } }
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

// Helper function to compare two variant arrays
const areVariantsEqual = (variants1?: ProductVariant[], variants2?: ProductVariant[]): boolean => {
  // Both undefined or empty - consider equal
  if ((!variants1 || variants1.length === 0) && (!variants2 || variants2.length === 0)) {
    return true;
  }
  
  // One has variants, other doesn't - not equal
  if (!variants1 || !variants2) {
    return false;
  }
  
  // Different lengths - not equal
  if (variants1.length !== variants2.length) {
    return false;
  }
  
  // Compare variant IDs (sorted to handle different orders)
  const ids1 = variants1.map(v => v.id).sort();
  const ids2 = variants2.map(v => v.id).sort();
  
  return ids1.every((id, index) => id === ids2[index]);
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_CART':
      console.log('[CartReducer] SET_CART action received with', action.payload.length, 'items');
      console.log('[CartReducer] Current cart has', state.items.length, 'items');
      console.log('[CartReducer] Call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
      
      const normalizedItems = action.payload.map(ensureCartItemUnitPrice);
      const { itemCount: setItemCount, totalAmount: setTotalAmount } = aggregateCartState(normalizedItems);
      
      console.log('[CartReducer] After SET_CART: itemCount =', setItemCount, 'totalAmount =', setTotalAmount);
      
      return {
        ...state,
        items: normalizedItems,
        itemCount: setItemCount,
        totalAmount: setTotalAmount,
        loading: false,
      };

    case 'ADD_ITEM': {
      const existingItemIndex = state.items.findIndex(
        item => {
          // Must have same product_id
          if (item.product_id !== action.payload.product_id) {
            return false;
          }
          
          // If both have single variant_id, compare those
          if (item.variant_id !== undefined && action.payload.variant_id !== undefined) {
            return item.variant_id === action.payload.variant_id;
          }
          
          // If both have variants arrays, compare those
          if ((item.variants && item.variants.length > 0) || 
              (action.payload.variants && action.payload.variants.length > 0)) {
            return areVariantsEqual(item.variants, action.payload.variants);
          }
          
          // Both have no variants - same item
          return item.variant_id === action.payload.variant_id;
        }
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
      console.log('[CartReducer] REMOVE_ITEM action received:', action.payload);
      console.log('[CartReducer] Current items:', state.items.map(i => ({ 
        product_id: i.product_id, 
        variant_id: i.variant_id, 
        variants: i.variants?.map(v => v.id) 
      })));
      console.log('[CartReducer] Trying to remove:', { 
        product_id: action.payload.product_id, 
        variant_id: action.payload.variant_id, 
        variants: action.payload.variants?.map(v => v.id) 
      });
      
      const newItems = state.items.filter(
        item => {
          // Must have same product_id to be removed
          if (item.product_id !== action.payload.product_id) {
            console.log('[CartReducer] Keeping item', item.product_id, '- different product');
            return true; // Keep this item
          }
          
          // If both have single variant_id, compare those
          if (item.variant_id !== undefined && action.payload.variant_id !== undefined) {
            const shouldKeep = item.variant_id !== action.payload.variant_id;
            console.log('[CartReducer] Product', item.product_id, '- comparing variant_id:', item.variant_id, 'vs', action.payload.variant_id, '→', shouldKeep ? 'KEEP' : 'REMOVE');
            return shouldKeep; // Keep if different
          }
          
          // If both have variants arrays, compare those
          if ((item.variants && item.variants.length > 0) || 
              (action.payload.variants && action.payload.variants.length > 0)) {
            const areEqual = areVariantsEqual(item.variants, action.payload.variants);
            console.log('[CartReducer] Product', item.product_id, '- comparing variants arrays → areEqual:', areEqual, '→', areEqual ? 'REMOVE' : 'KEEP');
            return !areEqual;
          }
          
          // Same product and both have no variants - remove this item
          const shouldKeep = item.variant_id !== action.payload.variant_id;
          console.log('[CartReducer] Product', item.product_id, '- no variants, comparing variant_id:', item.variant_id, 'vs', action.payload.variant_id, '→', shouldKeep ? 'KEEP' : 'REMOVE');
          return shouldKeep;
        }
      );

      console.log('[CartReducer] Items before:', state.items.length, 'Items after:', newItems.length);
      
      if (state.items.length === newItems.length) {
        console.error('[CartReducer] ⚠️ NO ITEMS WERE REMOVED! Check the matching logic.');
      }
      
      const { itemCount, totalAmount } = aggregateCartState(newItems);

      return {
        ...state,
        items: newItems,
        itemCount,
        totalAmount,
        loading: false,
      };
    }

    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        // Remove item if quantity is 0 or negative
        return cartReducer(state, {
          type: 'REMOVE_ITEM',
          payload: { 
            product_id: action.payload.product_id, 
            variant_id: action.payload.variant_id,
            variants: action.payload.variants
          }
        });
      }

      const newItems = state.items.map(item => {
        // Check if this is the item to update
        if (item.product_id !== action.payload.product_id) {
          return item;
        }
        
        // If both have single variant_id, compare those
        if (item.variant_id !== undefined && action.payload.variant_id !== undefined) {
          return item.variant_id === action.payload.variant_id
            ? { ...item, quantity: action.payload.quantity }
            : item;
        }
        
        // If both have variants arrays, compare those
        if ((item.variants && item.variants.length > 0) || 
            (action.payload.variants && action.payload.variants.length > 0)) {
          return areVariantsEqual(item.variants, action.payload.variants)
            ? { ...item, quantity: action.payload.quantity }
            : item;
        }
        
        // Both have no variants
        return item.variant_id === action.payload.variant_id
          ? { ...item, quantity: action.payload.quantity }
          : item;
      });

      const { itemCount, totalAmount } = aggregateCartState(newItems);

      return {
        ...state,
        items: newItems,
        itemCount,
        totalAmount,
      };
    }

    case 'CLEAR_CART':
      console.log('[CartReducer] CLEAR_CART action received');
      console.log('[CartReducer] Clearing', state.items.length, 'items');
      const clearedState = {
        ...state,
        items: [],
        itemCount: 0,
        totalAmount: 0,
        loading: false,
      };
      console.log('[CartReducer] New state after clear - items:', clearedState.items.length);
      return clearedState;

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
  console.log('[CartContext] CartProvider mounting/re-rendering');
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isGuestMode, setIsGuestMode] = React.useState(false);
  const isSavingRef = React.useRef(false);
  const lastLoadedModeRef = React.useRef<boolean | null>(null);
  const justLoadedRef = React.useRef(false); // Prevent saving immediately after load
  const isModifyingCartRef = React.useRef(false); // Track if cart is being cleared/modified
  const isRefreshingRef = React.useRef(false); // Prevent concurrent refreshes
  const itemsRef = React.useRef(state.items); // Always tracks the latest items
  const cartVersionRef = React.useRef(0); // Increments on every cart modification

  // Keep itemsRef in sync with state
  React.useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  // Load cart from AsyncStorage on initialization
  useEffect(() => {
    console.log('[CartContext] useEffect triggered - isGuestMode:', isGuestMode, 'lastLoadedMode:', lastLoadedModeRef.current);
    // Only load on first mount or when actually switching between guest/auth modes
    if (lastLoadedModeRef.current === null || lastLoadedModeRef.current !== isGuestMode) {
      console.log('[CartContext] Loading cart due to mode change');
      loadCart();
      lastLoadedModeRef.current = isGuestMode;
    } else {
      console.log('[CartContext] Skipping load - no mode change detected');
    }
  }, [isGuestMode]);

  // Save cart to AsyncStorage whenever items change
  // NOTE: Do NOT include isGuestMode in dependencies - we don't want to save when switching modes
  useEffect(() => {
    console.log('[CartContext] Save effect triggered - loading:', state.loading, 'items:', state.items.length, 'justLoaded:', justLoadedRef.current);
    
    // Don't save if we just loaded from storage
    if (justLoadedRef.current) {
      console.log('[CartContext] Skipping save - just loaded from storage');
      justLoadedRef.current = false;
      return;
    }
    
    if (!state.loading) {
      console.log('[CartContext] Saving cart...');
      saveCart();
    } else {
      console.log('[CartContext] Skipping save because loading=true');
    }
  }, [state.items, state.loading]);

  const getCurrentStorageKey = () => {
    return isGuestMode ? GUEST_CART_STORAGE_KEY : CART_STORAGE_KEY;
  };

  const loadCart = async () => {
    try {
      console.log('[CartContext] loadCart() started');
      console.log('[CartContext] Call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
      
      // Wait for any pending save to complete
      if (isSavingRef.current) {
        console.log('[CartContext] Waiting for pending save to complete before loading...');
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (!isSavingRef.current) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 50);
        });
        console.log('[CartContext] Pending save completed, proceeding with load');
      }
      
      const storageKey = getCurrentStorageKey();
      console.log('[CartContext] Loading from storage key:', storageKey);
      const cartData = await AsyncStorage.getItem(storageKey);
      if (cartData) {
        const parsed = JSON.parse(cartData);
        
        // Handle both old format (array) and new format (object with items and timestamp)
        const items: CartItem[] = Array.isArray(parsed) ? parsed : (parsed.items || []);
        const timestamp = parsed.timestamp || null;
        
        console.log('[CartContext] Loaded', items.length, 'items from storage');
        if (timestamp) {
          console.log('[CartContext] Cart was saved at:', new Date(timestamp).toISOString());
        }
        console.log('[CartContext] First 3 product IDs:', items.slice(0, 3).map(i => i.product_id));
        
        if (items.length > 0) {
          console.log('[CartContext] loadCart() loaded NON-EMPTY cart, debugging storage...');
          await debugStorage();
        }
        
        // Mark that we just loaded, so save effect doesn't immediately save
        justLoadedRef.current = true;
        dispatch({ type: 'SET_CART', payload: items });
      } else {
        console.log('[CartContext] No cart data found in storage');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const saveCart = async () => {
    if (isSavingRef.current) {
      console.log('[CartContext] saveCart() - Already saving, skipping duplicate call');
      return;
    }
    
    try {
      isSavingRef.current = true;
      const storageKey = getCurrentStorageKey();
      const itemsToSave = state.items;
      const timestamp = Date.now();
      
      console.log('[CartContext] saveCart() - Saving', itemsToSave.length, 'items to', storageKey);
      console.log('[CartContext] Call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
      
      if (itemsToSave.length === 0) {
        console.log('[CartContext] saveCart() - Saving EMPTY cart with timestamp:', timestamp);
      } else {
        console.log('[CartContext] First 3 product IDs being saved:', itemsToSave.slice(0, 3).map(i => i.product_id));
      }
      
      // Save cart with timestamp
      const dataToSave = {
        items: itemsToSave,
        timestamp: timestamp,
      };
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log('[CartContext] saveCart() - Save completed successfully at', new Date(timestamp).toISOString());
      
      // Verify the save
      const verification = await AsyncStorage.getItem(storageKey);
      if (verification) {
        const parsed = JSON.parse(verification);
        const verifiedItems = parsed.items || [];
        const verifiedTimestamp = parsed.timestamp;
        console.log('[CartContext] saveCart() - Verification: storage now has', verifiedItems.length, 'items, timestamp:', verifiedTimestamp);
      } else {
        console.log('[CartContext] saveCart() - Verification: storage is null/empty');
      }
      
      // If we just saved an empty cart, debug all storage to confirm
      if (itemsToSave.length === 0) {
        console.log('[CartContext] saveCart() - Saved EMPTY cart, debugging storage...');
        await debugStorage();
      }
      
      isSavingRef.current = false;
    } catch (error) {
      console.error('[CartContext] Error saving cart:', error);
      isSavingRef.current = false;
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

  const removeFromCart = (product_id: number, variant_id?: number, variants?: ProductVariant[]) => {
    console.log('[CartContext] removeFromCart called:', { product_id, variant_id, variants: variants?.map(v => v.id) });
    console.log('[CartContext] Current items before removal:', state.items.length);
    isModifyingCartRef.current = true; // Mark that we're modifying
    cartVersionRef.current += 1; // Bump version so in-flight refreshes abort
    dispatch({ type: 'REMOVE_ITEM', payload: { product_id, variant_id, variants } });
    // Reset flag after a short delay to allow save to complete
    setTimeout(() => {
      isModifyingCartRef.current = false;
    }, 2000);
  };

  const updateQuantity = (product_id: number, quantity: number, variant_id?: number, variants?: ProductVariant[]) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { product_id, quantity, variant_id, variants } });
  };

  const clearCart = () => {
    console.log('[CartContext] clearCart called');
    console.log('[CartContext] Current items before clear:', state.items.length);
    console.log('[CartContext] Call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
    isModifyingCartRef.current = true; // Mark that we're modifying
    cartVersionRef.current += 1; // Bump version so in-flight refreshes abort
    dispatch({ type: 'CLEAR_CART' });
    console.log('[CartContext] CLEAR_CART action dispatched');
    // Reset flag after a short delay to allow save to complete
    setTimeout(() => {
      isModifyingCartRef.current = false;
    }, 2000);
  };

  const clearGuestCart = async (): Promise<void> => {
    try {
      console.log('[CartContext] clearGuestCart() called - Removing guest cart from storage');
      await AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY);
      console.log('✅ Guest cart data cleared from AsyncStorage');
    } catch (error) {
      console.error('❌ Failed to clear guest cart:', error);
    }
  };
  
  // Utility to completely wipe ALL cart data from storage (for debugging)
  const clearAllCartStorage = async (): Promise<void> => {
    try {
      console.log('[CartContext] clearAllCartStorage() - Wiping all cart data');
      await AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY);
      await AsyncStorage.removeItem(CART_STORAGE_KEY);
      console.log('✅ All cart storage cleared');
      
      // Also clear the current cart in memory
      dispatch({ type: 'CLEAR_CART' });
    } catch (error) {
      console.error('❌ Failed to clear all cart storage:', error);
    }
  };

  // Debug utility to inspect what's actually in AsyncStorage
  const debugStorage = async (): Promise<void> => {
    try {
      console.log('🔍 [CartContext] === STORAGE DEBUG ===');
      console.log('[CartContext] Current isGuestMode:', isGuestMode);
      console.log('[CartContext] Current state.items.length:', state.items.length);
      
      const guestData = await AsyncStorage.getItem(GUEST_CART_STORAGE_KEY);
      const authData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      
      if (guestData) {
        const parsed = JSON.parse(guestData);
        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
        const timestamp = parsed.timestamp || null;
        console.log('[CartContext] Guest cart storage (@guest_cart_items):', items.length, 'items');
        if (timestamp) {
          console.log('[CartContext] Guest cart timestamp:', new Date(timestamp).toISOString());
        }
        console.log('[CartContext] Guest cart items:', items.map((i: any) => ({ product_id: i.product_id, qty: i.quantity })));
      } else {
        console.log('[CartContext] Guest cart storage (@guest_cart_items): null/empty');
      }
      
      if (authData) {
        const parsed = JSON.parse(authData);
        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
        const timestamp = parsed.timestamp || null;
        console.log('[CartContext] Auth cart storage (@cart_items):', items.length, 'items');
        if (timestamp) {
          console.log('[CartContext] Auth cart timestamp:', new Date(timestamp).toISOString());
        }
        console.log('[CartContext] Auth cart items:', items.map((i: any) => ({ product_id: i.product_id, qty: i.quantity })));
      } else {
        console.log('[CartContext] Auth cart storage (@cart_items): null/empty');
      }
      
      console.log('🔍 [CartContext] === END DEBUG ===');
    } catch (error) {
      console.error('[CartContext] debugStorage error:', error);
    }
  };

  const switchToGuestMode = async (): Promise<void> => {
    console.log('[CartContext] switchToGuestMode() called, current isGuestMode:', isGuestMode);
    if (isGuestMode === true) {
      console.log('[CartContext] Already in guest mode, skipping');
      return;
    }
    console.log('[CartContext] Switching to guest mode and loading guest cart...');
    setIsGuestMode(true);
    // Load guest cart data - this will trigger via useEffect
  };

  const switchToAuthMode = async (): Promise<void> => {
    console.log('[CartContext] switchToAuthMode() called, current isGuestMode:', isGuestMode);
    if (isGuestMode === false) {
      console.log('[CartContext] Already in auth mode, skipping');
      return;
    }
    console.log('[CartContext] Switching to auth mode and loading user cart...');
    setIsGuestMode(false);
    // Load authenticated user cart data - this will trigger via useEffect
  };

  const refreshCartProducts = useCallback(async (): Promise<void> => {
    try {
      // Use itemsRef for the LATEST items, not stale closure state
      const currentItems = itemsRef.current;
      console.log('[CartContext] refreshCartProducts() called, current items:', currentItems.length);
      
      // Don't allow concurrent refreshes
      if (isRefreshingRef.current) {
        console.log('[CartContext] refreshCartProducts() - Already refreshing, aborting');
        return;
      }
      
      // Don't refresh if cart is being modified
      if (isModifyingCartRef.current) {
        console.log('[CartContext] refreshCartProducts() - Cart is being modified, aborting');
        return;
      }
      
      isRefreshingRef.current = true;
      
      // Capture version at start to detect modifications during fetch
      const versionAtStart = cartVersionRef.current;
      
      // Capture the current items at the START of the refresh
      const itemsAtStart = currentItems;
      const itemCountAtStart = itemsAtStart.length;
      
      if (itemCountAtStart === 0) {
        console.log('[CartContext] refreshCartProducts() - No items to refresh, exiting');
        return;
      }

      const uniqueProductIds = Array.from(new Set(itemsAtStart.map(item => item.product_id)));
      console.log('[CartContext] refreshCartProducts() - Refreshing', uniqueProductIds.length, 'unique products:', uniqueProductIds);
      const results = await Promise.all(
        uniqueProductIds.map(async productId => {
          try {
            const response = await apiService.getProductById(productId);
            if (response.success && response.data) {
              return { productId, product: response.data as Product };
            }
          } catch (error) {
            console.warn(`Failed to refresh product ${productId}:`, error);
          }
          return null;
        })
      );

      const latestProductMap = new Map<number, Product>();
      for (const result of results) {
        if (result) {
          latestProductMap.set(result.productId, result.product);
        }
      }

      if (latestProductMap.size === 0) {
        return;
      }

      // CRITICAL: Check if the cart was cleared or modified during the fetch
      // Use itemsRef for ACTUAL current state, not stale closure
      const itemsNow = itemsRef.current;
      const itemCountNow = itemsNow.length;
      const versionNow = cartVersionRef.current;
      
      console.log('[CartContext] refreshCartProducts() - Items at start:', itemCountAtStart, 'Items now:', itemCountNow, 'Version start:', versionAtStart, 'Version now:', versionNow);
      
      // If cart version changed, a modification happened during the fetch
      if (versionNow !== versionAtStart) {
        console.log('[CartContext] refreshCartProducts() - Cart was MODIFIED during refresh (version changed:', versionAtStart, '->', versionNow, '), aborting SET_CART');
        return;
      }
      
      // Double-check: if cart is being modified right now, abort
      if (isModifyingCartRef.current) {
        console.log('[CartContext] refreshCartProducts() - Cart modification in progress, aborting SET_CART');
        return;
      }
      
      // If cart is now empty, don't overwrite it
      if (itemCountNow === 0) {
        console.log('[CartContext] refreshCartProducts() - Cart was CLEARED during refresh, aborting SET_CART');
        return;
      }
      
      // If the items changed significantly, don't overwrite
      if (Math.abs(itemCountNow - itemCountAtStart) > 0) {
        console.log('[CartContext] refreshCartProducts() - Cart was MODIFIED during refresh (', itemCountAtStart, '->', itemCountNow, '), aborting SET_CART');
        return;
      }

      const refreshedItems = itemsAtStart.map(item => {
        const latestProduct = latestProductMap.get(item.product_id);
        if (!latestProduct) {
          return item;
        }

        let refreshedItem: CartItem = {
          ...item,
          product: latestProduct,
        };

        if (item.variant_id && latestProduct.variants?.length) {
          const matchedVariant = latestProduct.variants.find(v => v.id === item.variant_id);
          if (matchedVariant) {
            refreshedItem = {
              ...refreshedItem,
              variant: normalizeVariantPricingMetadata(matchedVariant),
            };
          }
        }

        if (item.variants && item.variants.length > 0 && latestProduct.variants?.length) {
          const refreshedVariants = item.variants.map(variant => {
            const matchedVariant = latestProduct.variants?.find(v => v.id === variant.id);
            return normalizeVariantPricingMetadata(matchedVariant ?? variant);
          });

          refreshedItem = {
            ...refreshedItem,
            variants: refreshedVariants,
          };
        }

        return ensureCartItemUnitPrice(refreshedItem);
      });

      console.log('[CartContext] refreshCartProducts() - Dispatching SET_CART with', refreshedItems.length, 'refreshed items');
      dispatch({ type: 'SET_CART', payload: refreshedItems });
    } catch (error) {
      console.error('[CartContext] Error refreshing cart product metadata:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []); // Empty deps - uses refs for all mutable state, so reference stays stable

  const getCartItem = (product_id: number, variant_id?: number, variants?: ProductVariant[]): CartItem | undefined => {
    return state.items.find(
      item => {
        // Check product_id first
        if (item.product_id !== product_id) {
          return false;
        }
        
        // If both have single variant_id, compare those
        if (item.variant_id !== undefined && variant_id !== undefined) {
          return item.variant_id === variant_id;
        }
        
        // If both have variants arrays, compare those
        if ((item.variants && item.variants.length > 0) || 
            (variants && variants.length > 0)) {
          return areVariantsEqual(item.variants, variants);
        }
        
        // Both have no variants
        return item.variant_id === variant_id;
      }
    );
  };

  const value: CartContextType = {
    ...state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    clearGuestCart,
    clearAllCartStorage,
    debugStorage,
    switchToGuestMode,
    switchToAuthMode,
    refreshCartProducts,
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
