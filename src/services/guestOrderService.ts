import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService, { Order } from './apiService';

const GUEST_ORDERS_KEY = 'guest_orders';

interface GuestOrder extends Order {
  localId: string; // For local identification
  customerPhone: string;
  customerEmail?: string;
  createdAt: string;
}

class GuestOrderService {
  // Save a guest order locally
  async saveGuestOrder(order: Order, customerInfo: { phone: string; email?: string }): Promise<void> {
    try {
      const existingOrders = await this.getGuestOrders();
      
      const guestOrder: GuestOrder = {
        ...order,
        localId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        createdAt: new Date().toISOString(),
      };
      
      const updatedOrders = [guestOrder, ...existingOrders];
      
      // Keep only last 50 orders to prevent storage bloat
      if (updatedOrders.length > 50) {
        updatedOrders.splice(50);
      }
      
      await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updatedOrders));
      console.log('✅ Guest order saved locally:', guestOrder.localId);
    } catch (error) {
      console.error('❌ Failed to save guest order:', error);
    }
  }

  // Get all guest orders from local storage
  async getGuestOrders(): Promise<GuestOrder[]> {
    try {
      const ordersJson = await AsyncStorage.getItem(GUEST_ORDERS_KEY);
      if (!ordersJson) {
        return [];
      }
      
      const orders = JSON.parse(ordersJson) as GuestOrder[];
      console.log(`📦 Retrieved ${orders.length} guest orders from storage`);
      return orders;
    } catch (error) {
      console.error('❌ Failed to get guest orders:', error);
      return [];
    }
  }

  // Get guest orders with pagination and filtering
  async getGuestOrdersPaginated(options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<{
    orders: GuestOrder[];
    pagination: {
      page: number;
      totalPages: number;
      totalItems: number;
      hasMore: boolean;
    };
  }> {
    try {
      const allOrders = await this.getGuestOrders();
      
      // Filter by status if provided
      let filteredOrders = allOrders;
      if (options.status) {
        filteredOrders = allOrders.filter(order => order.order_status === options.status);
      }
      
      // Sort by creation date (newest first)
      filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
      const totalItems = filteredOrders.length;
      const totalPages = Math.ceil(totalItems / limit);
      
      return {
        orders: paginatedOrders,
        pagination: {
          page,
          totalPages,
          totalItems,
          hasMore: page < totalPages,
        },
      };
    } catch (error) {
      console.error('❌ Failed to get paginated guest orders:', error);
      return {
        orders: [],
        pagination: {
          page: 1,
          totalPages: 0,
          totalItems: 0,
          hasMore: false,
        },
      };
    }
  }

  // Clear all guest orders
  async clearGuestOrders(): Promise<void> {
    try {
      await AsyncStorage.removeItem(GUEST_ORDERS_KEY);
      console.log('✅ Guest orders cleared');
    } catch (error) {
      console.error('❌ Failed to clear guest orders:', error);
    }
  }

  // Clear all guest session data (orders, cart, etc.) - called on logout
  async clearGuestSession(): Promise<void> {
    try {
      // Clear guest orders
      await this.clearGuestOrders();
      
      // Clear guest cart data
      await AsyncStorage.removeItem('@guest_cart_items');
      
      // Clear any other guest-specific data
      await AsyncStorage.removeItem('guest_user_info');
      await AsyncStorage.removeItem('guest_addresses');
      await AsyncStorage.removeItem('guest_checkout_data');
      
      console.log('✅ All guest session data cleared');
    } catch (error) {
      console.error('❌ Failed to clear guest session data:', error);
    }
  }

  // Update guest order status (for simulation purposes)
  async updateGuestOrderStatus(localId: string, newStatus: string): Promise<void> {
    try {
      const orders = await this.getGuestOrders();
      const orderIndex = orders.findIndex(order => order.localId === localId);
      
      if (orderIndex !== -1) {
        orders[orderIndex].order_status = newStatus as any;
        await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(orders));
        console.log(`✅ Guest order ${localId} status updated to ${newStatus}`);
      }
    } catch (error) {
      console.error('❌ Failed to update guest order status:', error);
    }
  }

  // Find guest order by phone number (for lookup purposes)
  async findOrdersByPhone(phone: string): Promise<GuestOrder[]> {
    try {
      const orders = await this.getGuestOrders();
      return orders.filter(order => order.customerPhone === phone);
    } catch (error) {
      console.error('❌ Failed to find orders by phone:', error);
      return [];
    }
  }

  // Sync guest order status from server
  async syncGuestOrderFromServer(phone: string, orderNumber: string): Promise<Order | null> {
    try {
      console.log('🔄 Syncing guest order from server:', { phone, orderNumber });
      
      // Use ApiService instead of direct fetch for better error handling
      const response = await ApiService.lookupGuestOrder(phone, orderNumber);
      
      if (response.success && response.data?.order) {
        console.log('✅ Server order data received:', response.data.order);
        
        // Update local storage with server data
        await this.updateGuestOrderFromServer(response.data.order);
        
        return response.data.order;
      } else {
        console.log('❌ Order not found on server or lookup failed:', response.message);
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to sync guest order from server:', error);
      return null;
    }
  }

  // Update local guest order with server data
  private async updateGuestOrderFromServer(serverOrder: Order): Promise<void> {
    try {
      const orders = await this.getGuestOrders();
      const orderIndex = orders.findIndex(order => order.order_number === serverOrder.order_number);
      
      if (orderIndex !== -1) {
        // Update existing local order with server data
        orders[orderIndex] = {
          ...orders[orderIndex], // Keep local metadata
          ...serverOrder, // Override with server data
          localId: orders[orderIndex].localId, // Preserve local ID
          customerPhone: orders[orderIndex].customerPhone, // Preserve local phone
          customerEmail: orders[orderIndex].customerEmail, // Preserve local email
          createdAt: orders[orderIndex].createdAt, // Preserve local creation time
        };
        
        await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(orders));
        console.log('✅ Local guest order updated with server data:', serverOrder.order_number);
      } else {
        console.log('⚠️ Local order not found for server order:', serverOrder.order_number);
      }
    } catch (error) {
      console.error('❌ Failed to update local guest order:', error);
    }
  }

  // Sync all guest orders from server
  async syncAllGuestOrders(phone: string): Promise<{ synced: number; failed: number }> {
    try {
      const localOrders = await this.getGuestOrders();
      let synced = 0;
      let failed = 0;

      console.log(`🔄 Syncing ${localOrders.length} guest orders from server`);

      for (const localOrder of localOrders) {
        try {
          const serverOrder = await this.syncGuestOrderFromServer(phone, localOrder.order_number);
          if (serverOrder) {
            synced++;
            console.log(`✅ Synced order: ${localOrder.order_number}`);
          } else {
            failed++;
            console.log(`❌ Failed to sync order: ${localOrder.order_number}`);
          }
          
          // Add small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          failed++;
          console.error(`❌ Error syncing order ${localOrder.order_number}:`, error);
        }
      }

      console.log(`📊 Sync completed: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      console.error('❌ Failed to sync all guest orders:', error);
      return { synced: 0, failed: 0 };
    }
  }
}

export default new GuestOrderService();
export type { GuestOrder };
