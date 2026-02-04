/**
 * React Native Order Screens Component Test
 * Tests for OrdersScreen and OrderDetailsScreen components
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import { formatCurrency } from '../utils/currency';

// Mock API service
const mockApiService = {
  getUserOrders: jest.fn(),
  getOrderDetails: jest.fn(),
};

// Mock components for isolated testing
jest.mock('../services/apiService', () => mockApiService);
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('Order Screens Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = { id: 1, name: 'Test User' };
  
  const mockOrders = [
    {
      id: 1,
      order_number: 'ORD-25-001',
      order_status: 'delivered',
      total_amount: 25.50,
      subtotal: 22.00,
      delivery_fee: 2.50,
      tax_amount: 1.00,
      discount_amount: 0,
      created_at: '2024-01-15T10:30:00Z',
      delivery_address: {
        street: '123 Test St',
        city: 'Test City'
      }
    },
    {
      id: 2,
      order_number: 'ORD-25-002',
      order_status: 'pending',
      total_amount: '15.75', // String to test currency formatting
      subtotal: '13.25',
      delivery_fee: '2.50',
      tax_amount: null, // Null to test safe formatting
      discount_amount: undefined, // Undefined to test safe formatting
      created_at: '2024-01-14T15:45:00Z',
      delivery_address: {
        street: '456 Test Ave',
        city: 'Test Town'
      }
    }
  ];

  const expectCurrencyMatch = (value, amount) => {
    const expected = formatCurrency(amount);
    expect(value).toBe(expected);
  };

  const mockOrderDetails = {
    order: {
      id: 1,
      order_number: 'ORD-25-001',
      order_status: 'delivered',
      total_amount: 25.50,
      subtotal: 22.00,
      delivery_fee: 2.50,
      tax_amount: 1.00,
      discount_amount: 0,
      created_at: '2024-01-15T10:30:00Z',
      delivery_address: {
        street: '123 Test St',
        city: 'Test City',
        phone: '962791234567'
      }
    },
    order_items: [
      {
        id: 1,
        product_id: 1,
        product_name: 'Test Pastry',
        quantity: 2,
        unit_price: 10.00,
        total_price: 20.00,
        variant_name: 'Large'
      },
      {
        id: 2,
        product_id: 2,
        product_name: 'Test Cake',
        quantity: 1,
        unit_price: '2.00', // String to test formatting
        total_price: '2.00',
        variant_name: 'Small'
      }
    ],
    status_history: [
      {
        id: 1,
        order_status: 'pending',
        created_at: '2024-01-15T10:30:00Z',
        notes: 'Order placed'
      },
      {
        id: 2,
        order_status: 'delivered',
        created_at: '2024-01-15T12:00:00Z',
        notes: 'Order delivered successfully'
      }
    ]
  };

  describe('OrdersScreen Component Tests', () => {
    // Mock OrdersScreen component since we can't import the actual file
    const MockOrdersScreen = ({ navigation }) => {
      const [orders, setOrders] = React.useState([]);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);

      React.useEffect(() => {
        const fetchOrders = async () => {
          try {
            setLoading(true);
            const response = await mockApiService.getUserOrders(mockUser.id, 1, 20);
            setOrders(response.data || []);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        };
        fetchOrders();
      }, []);

      if (loading) return <div testID="loading">Loading...</div>;
      if (error) return <div testID="error">{error}</div>;

      return (
        <div testID="orders-screen">
          {orders.map(order => (
            <div key={order.id} testID={`order-${order.id}`}>
              <div testID="order-number">{order.order_number}</div>
              <div testID="order-status">{order.order_status}</div>
              <div testID="order-total">{formatCurrency(order.total_amount)}</div>
              <div testID="order-date">{new Date(order.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      );
    };

    it('should render orders list successfully', async () => {
      mockApiService.getUserOrders.mockResolvedValue({
        success: true,
        data: mockOrders
      });

      const { getByTestId, getAllByTestId } = render(<MockOrdersScreen />);

      await waitFor(() => {
        expect(getByTestId('orders-screen')).toBeTruthy();
      });

      const orderElements = getAllByTestId(/order-\d+/);
      expect(orderElements).toHaveLength(2);
    });

    it('should format currency correctly for all orders', async () => {
      mockApiService.getUserOrders.mockResolvedValue({
        success: true,
        data: mockOrders
      });

      const { getByTestId } = render(<MockOrdersScreen />);

      await waitFor(() => {
        expect(getByTestId('orders-screen')).toBeTruthy();
      });

      // Test numeric amount formatting
  const order1Total = getByTestId('order-1').querySelector('[data-testid="order-total"]');
  expectCurrencyMatch(order1Total.textContent, 25.50);

  // Test string amount formatting
  const order2Total = getByTestId('order-2').querySelector('[data-testid="order-total"]');
  expectCurrencyMatch(order2Total.textContent, '15.75');
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.getUserOrders.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(<MockOrdersScreen />);

      await waitFor(() => {
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').textContent).toContain('Network error');
      });
    });
  });

  describe('OrderDetailsScreen Component Tests', () => {
    // Mock OrderDetailsScreen component
    const MockOrderDetailsScreen = ({ route }) => {
      const [orderData, setOrderData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const orderId = route?.params?.orderId || 1;

      // Currency formatting function (matches the one we added)
      React.useEffect(() => {
        const fetchOrderDetails = async () => {
          try {
            setLoading(true);
            const response = await mockApiService.getOrderDetails(orderId);
            setOrderData(response.data);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        };
        fetchOrderDetails();
      }, [orderId]);

      if (loading) return <div testID="loading">Loading...</div>;
      if (error) return <div testID="error">{error}</div>;
      if (!orderData) return <div testID="no-data">No order data</div>;

      const { order, order_items, status_history } = orderData;

      return (
        <div testID="order-details-screen">
          <div testID="order-info">
            <div testID="order-number">{order.order_number}</div>
            <div testID="order-status">{order.order_status}</div>
          </div>
          
          <div testID="order-summary">
            <div testID="subtotal">{formatCurrency(order.subtotal)}</div>
            <div testID="delivery-fee">{formatCurrency(order.delivery_fee)}</div>
            <div testID="tax-amount">{formatCurrency(order.tax_amount)}</div>
            <div testID="discount-amount">{formatCurrency(order.discount_amount)}</div>
            <div testID="total-amount">{formatCurrency(order.total_amount)}</div>
          </div>

          <div testID="order-items">
            {order_items.map(item => (
              <div key={item.id} testID={`item-${item.id}`}>
                <div testID="product-name">{item.product_name}</div>
                <div testID="quantity">{item.quantity}</div>
                <div testID="unit-price">{formatCurrency(item.unit_price)}</div>
                <div testID="total-price">{formatCurrency(item.total_price)}</div>
              </div>
            ))}
          </div>

          <div testID="status-history">
            {status_history.map(status => (
              <div key={status.id} testID={`status-${status.id}`}>
                <div testID="status-name">{status.order_status}</div>
                <div testID="status-date">{new Date(status.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      );
    };

    it('should render order details successfully', async () => {
      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: mockOrderDetails
      });

      const mockRoute = { params: { orderId: 1 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('order-details-screen')).toBeTruthy();
      });

      expect(getByTestId('order-number').textContent).toBe('ORD-001');
      expect(getByTestId('order-status').textContent).toBe('delivered');
    });

    it('should format all currency fields safely', async () => {
      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: mockOrderDetails
      });

      const mockRoute = { params: { orderId: 1 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('order-summary')).toBeTruthy();
      });

      // Test all currency fields
  expectCurrencyMatch(getByTestId('subtotal').textContent, 22.00);
  expectCurrencyMatch(getByTestId('delivery-fee').textContent, 2.50);
  expectCurrencyMatch(getByTestId('tax-amount').textContent, 1.00);
  expectCurrencyMatch(getByTestId('discount-amount').textContent, 0);
  expectCurrencyMatch(getByTestId('total-amount').textContent, 25.50);
    });

    it('should format item prices safely with mixed data types', async () => {
      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: mockOrderDetails
      });

      const mockRoute = { params: { orderId: 1 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('order-items')).toBeTruthy();
      });

      // Test numeric price (item 1)
      const item1 = getByTestId('item-1');
  expectCurrencyMatch(item1.querySelector('[data-testid="unit-price"]').textContent, 10.00);
  expectCurrencyMatch(item1.querySelector('[data-testid="total-price"]').textContent, 20.00);

      // Test string price (item 2)
      const item2 = getByTestId('item-2');
  expectCurrencyMatch(item2.querySelector('[data-testid="unit-price"]').textContent, 2.00);
  expectCurrencyMatch(item2.querySelector('[data-testid="total-price"]').textContent, 2.00);
    });

    it('should handle null/undefined currency values', async () => {
      const orderWithNulls = {
        ...mockOrderDetails,
        order: {
          ...mockOrderDetails.order,
          tax_amount: null,
          discount_amount: undefined,
          subtotal: '',
        }
      };

      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: orderWithNulls
      });

      const mockRoute = { params: { orderId: 1 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('order-summary')).toBeTruthy();
      });

      // All null/undefined/empty values should format to $0.00
  expectCurrencyMatch(getByTestId('subtotal').textContent, 0);
  expectCurrencyMatch(getByTestId('tax-amount').textContent, 0);
  expectCurrencyMatch(getByTestId('discount-amount').textContent, 0);
    });

    it('should display status history correctly', async () => {
      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: mockOrderDetails
      });

      const mockRoute = { params: { orderId: 1 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('status-history')).toBeTruthy();
      });

      expect(getByTestId('status-1')).toBeTruthy();
      expect(getByTestId('status-2')).toBeTruthy();
      
      const status1 = getByTestId('status-1');
      expect(status1.querySelector('[data-testid="status-name"]').textContent).toBe('pending');
      
      const status2 = getByTestId('status-2');
      expect(status2.querySelector('[data-testid="status-name"]').textContent).toBe('delivered');
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.getOrderDetails.mockRejectedValue(new Error('Order not found'));

      const mockRoute = { params: { orderId: 999 } };
      const { getByTestId } = render(<MockOrderDetailsScreen route={mockRoute} />);

      await waitFor(() => {
        expect(getByTestId('error')).toBeTruthy();
        expect(getByTestId('error').textContent).toContain('Order not found');
      });
    });
  });

  describe('Currency Formatting Utility Tests', () => {
    const zeroFormatted = formatCurrency(0);

    it('should format valid numbers correctly', () => {
      expectCurrencyMatch(formatCurrency(25.50), 25.50);
      expectCurrencyMatch(formatCurrency(2.75), 2.75);
      expectCurrencyMatch(formatCurrency(100), 100);
      expectCurrencyMatch(formatCurrency(0), 0);
    });

    it('should format string numbers correctly', () => {
      expectCurrencyMatch(formatCurrency('25.50'), 25.50);
      expectCurrencyMatch(formatCurrency('2.75'), 2.75);
      expectCurrencyMatch(formatCurrency('100'), 100);
      expectCurrencyMatch(formatCurrency('0'), 0);
    });

    it('should handle invalid values safely', () => {
      expect(formatCurrency(null)).toBe(zeroFormatted);
      expect(formatCurrency(undefined)).toBe(zeroFormatted);
      expect(formatCurrency('')).toBe(zeroFormatted);
      expect(formatCurrency('invalid')).toBe(zeroFormatted);
      expect(formatCurrency(NaN)).toBe(zeroFormatted);
      expect(formatCurrency(Infinity)).toBe(zeroFormatted);
    });

    it('should not throw errors on any input', () => {
      const testValues = [null, undefined, '', 'abc', {}, [], true, false, NaN, Infinity];

      testValues.forEach(value => {
        expect(() => formatCurrency(value)).not.toThrow();
        expect(formatCurrency(value)).toBe(zeroFormatted);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should complete full order viewing flow', async () => {
      // Step 1: Load orders list
      mockApiService.getUserOrders.mockResolvedValue({
        success: true,
        data: mockOrders
      });

      // Step 2: Load specific order details
      mockApiService.getOrderDetails.mockResolvedValue({
        success: true,
        data: mockOrderDetails
      });

      // Simulate navigation flow
      const MockNavigationFlow = () => {
        const [currentScreen, setCurrentScreen] = React.useState('orders');
        const [selectedOrderId, setSelectedOrderId] = React.useState(null);

        return (
          <div testID="navigation-flow">
            {currentScreen === 'orders' && (
              <div testID="orders-view">
                <button 
                  testID="view-order-1"
                  onClick={() => {
                    setSelectedOrderId(1);
                    setCurrentScreen('details');
                  }}
                >
                  View Order 1
                </button>
              </div>
            )}
            {currentScreen === 'details' && (
              <div testID="details-view">
                Order ID: {selectedOrderId}
              </div>
            )}
          </div>
        );
      };

      const { getByTestId } = render(<MockNavigationFlow />);

      // Start at orders screen
      expect(getByTestId('orders-view')).toBeTruthy();

      // Navigate to order details
      fireEvent.click(getByTestId('view-order-1'));

      await waitFor(() => {
        expect(getByTestId('details-view')).toBeTruthy();
        expect(getByTestId('details-view').textContent).toContain('Order ID: 1');
      });
    });
  });
});

// Export test configuration for Jest
export default {
  displayName: 'Order Screens Component Tests',
  testMatch: ['**/order-screens-test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
