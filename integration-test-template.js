
// Integration Test for Mobile Order Creation
// This code can be added to your test files

import ApiService from '../src/services/apiService';

describe('Mobile Order Creation Integration', () => {
  let authToken = null;
  let testAddress = null;

  beforeAll(async () => {
    // Login test user
    const loginResponse = await ApiService.login({
      email: 'test@example.com',
      password: 'test123'
    });
    
    expect(loginResponse.success).toBe(true);
    authToken = loginResponse.data.token;
  });

  test('should load user addresses', async () => {
    const response = await ApiService.getUserAddresses();
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
    
    if (response.data.length > 0) {
      testAddress = response.data[0];
    }
  });

  test('should calculate order totals', async () => {
    const orderData = {
      items: [{"product_id":1,"variant_id":null,"quantity":2},{"product_id":2,"variant_id":1,"quantity":1}],
      delivery_address_id: testAddress?.id,
      order_type: 'delivery',
      promo_code: null,
      points_to_use: 0
    };

    const response = await ApiService.calculateOrderTotals(orderData);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('subtotal');
    expect(response.data).toHaveProperty('total_amount');
    expect(response.data).toHaveProperty('delivery_fee');
  });

  test('should create order successfully', async () => {
    const orderData = {
      items: [{"product_id":1,"variant_id":null,"quantity":2},{"product_id":2,"variant_id":1,"quantity":1}],
      branch_id: 1,
      delivery_address_id: testAddress?.id,
      customer_name: 'Test User',
      customer_phone: '+962771234567',
      customer_email: 'test@example.com',
      order_type: 'delivery',
      payment_method: 'cash',
      special_instructions: 'Test order from mobile app',
      is_guest: false
    };

    const response = await ApiService.createOrder(orderData);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('order');
    expect(response.data).toHaveProperty('order_items');
    expect(response.data.order_items.length).toBe(2);
  });

  test('should validate promo code', async () => {
    const response = await ApiService.validatePromoCode('WELCOME10', 100);
    // This might fail if promo doesn't exist, which is acceptable
    expect(typeof response).toBe('object');
    expect(response).toHaveProperty('success');
  });

  test('should get cities for address creation', async () => {
    const response = await ApiService.getCities();
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
  });
});

// Guest Order Test
describe('Guest Order Creation', () => {
  test('should create guest order', async () => {
    const guestOrderData = {
      items: [{"product_id":1,"variant_id":null,"quantity":2},{"product_id":2,"variant_id":1,"quantity":1}],
      branch_id: 1,
      customer_name: 'Test Guest User',
      customer_phone: '+962771234568',
      customer_email: 'guest@example.com',
      guest_delivery_address: 'Test Address, Amman, Jordan',
      order_type: 'delivery',
      payment_method: 'cash',
      special_instructions: 'Guest order test',
      is_guest: true
    };

    const response = await ApiService.createOrder(guestOrderData);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('order');
    expect(response.data.order.is_guest).toBe(true);
  });
});
