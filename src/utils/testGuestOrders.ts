import guestOrderService from '../services/guestOrderService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Test script to add sample guest orders for testing
export const addSampleGuestOrders = async () => {
  console.log('🧪 Adding sample guest orders for testing...');
  
  const sampleOrders = [
    {
      id: Date.now() + 1,
      order_number: `GUEST${Date.now()}1`,
      order_status: 'delivered',
      total_amount: 25.50,
      order_type: 'delivery',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      items: [
        {
          product_id: 1,
          product_name: 'Chocolate Cake',
          quantity: 1,
          price: 20.00,
          variant_name: 'Large'
        },
        {
          product_id: 2,
          product_name: 'Coffee',
          quantity: 2,
          price: 2.75,
          variant_name: 'Medium'
        }
      ],
      branch: {
        name: 'Main Branch'
      }
    },
    {
      id: Date.now() + 2,
      order_number: `GUEST${Date.now()}2`,
      order_status: 'pending',
      total_amount: 15.75,
      order_type: 'pickup',
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      items: [
        {
          product_id: 3,
          product_name: 'Blueberry Muffin',
          quantity: 3,
          price: 4.50,
          variant_name: 'Regular'
        },
        {
          product_id: 4,
          product_name: 'Hot Tea',
          quantity: 1,
          price: 2.25,
          variant_name: 'Large'
        }
      ],
      branch: {
        name: 'Downtown Branch'
      }
    }
  ];

  try {
    for (const order of sampleOrders) {
      await guestOrderService.saveGuestOrder(order as any, {
        phone: '+962791234567',
        email: 'guest@example.com'
      });
    }
    
    console.log('✅ Sample guest orders added successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to add sample guest orders:', error);
    return false;
  }
};

// Function to add sample cart items for guest mode
export const addSampleGuestCart = async () => {
  console.log('🛒 Adding sample guest cart items...');
  
  const sampleCartItems = [
    {
      product_id: 1,
      variant_id: null,
      quantity: 2,
      special_instructions: '',
      product: {
        id: 1,
        name: 'Chocolate Cake',
        base_price: 20.00,
        final_price: 20.00,
        image_url: null
      }
    },
    {
      product_id: 2,
      variant_id: 1,
      quantity: 1,
      special_instructions: 'Extra hot',
      product: {
        id: 2,
        name: 'Coffee',
        base_price: 2.75,
        final_price: 2.75,
        image_url: null
      }
    }
  ];

  try {
    await AsyncStorage.setItem('@guest_cart_items', JSON.stringify(sampleCartItems));
    console.log('✅ Sample guest cart items added');
    return true;
  } catch (error) {
    console.error('❌ Failed to add sample guest cart:', error);
    return false;
  }
};

// Function to clear all guest orders (for testing)
export const clearAllGuestOrders = async () => {
  try {
    await guestOrderService.clearGuestOrders();
    console.log('✅ All guest orders cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear guest orders:', error);
    return false;
  }
};

// Function to clear all guest data (for testing)
export const clearAllGuestData = async () => {
  try {
    await guestOrderService.clearGuestSession();
    console.log('✅ All guest session data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear guest session data:', error);
    return false;
  }
};

// Function to check what guest data exists
export const checkGuestData = async () => {
  try {
    const orders = await guestOrderService.getGuestOrders();
    const cartData = await AsyncStorage.getItem('@guest_cart_items');
    const cart = cartData ? JSON.parse(cartData) : [];
    
    console.log('📊 Guest Data Status:');
    console.log(`- Orders: ${orders.length} items`);
    console.log(`- Cart: ${cart.length} items`);
    
    return {
      orders: orders.length,
      cart: cart.length
    };
  } catch (error) {
    console.error('❌ Failed to check guest data:', error);
    return { orders: 0, cart: 0 };
  }
};
