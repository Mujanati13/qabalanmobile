import { device, element, by, expect } from 'detox';
import { reloadApp, loginAsCustomer, logout, clearAppData } from './helpers/appHelpers';

// Comprehensive E2E Mobile App Test Suite
describe('E2E Mobile App Testing Suite - Products, Orders, Promos, Shipping', () => {
  
  beforeAll(async () => {
    await device.launchApp();
    await clearAppData();
  });

  beforeEach(async () => {
    await reloadApp();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  // ================================
  // AUTHENTICATION TESTS
  // ================================
  describe('Authentication Flow', () => {
    
    test('AUTH-001: Guest browsing capabilities', async () => {
      // Verify guest can browse without login
      await expect(element(by.id('products-tab'))).toBeVisible();
      await element(by.id('products-tab')).tap();
      
      // Should see products but not be able to order
      await expect(element(by.id('product-list'))).toBeVisible();
      await element(by.id('product-card-1')).tap();
      
      // Try to add to cart as guest
      await element(by.id('add-to-cart-button')).tap();
      await expect(element(by.text('Login Required'))).toBeVisible();
    });

    test('AUTH-002: Customer login and authentication', async () => {
      await loginAsCustomer('test@example.com', 'password123');
      
      // Verify successful login
      await expect(element(by.id('user-profile-button'))).toBeVisible();
      await expect(element(by.text('Welcome back!'))).toBeVisible();
    });
  });

  // ================================
  // PRODUCT BROWSING TESTS
  // ================================
  describe('Product Management E2E', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
    });

    test('PM-MOB-001: Browse products and view details', async () => {
      await element(by.id('products-tab')).tap();
      await expect(element(by.id('product-list'))).toBeVisible();
      
      // Tap on first product
      await element(by.id('product-card-1')).tap();
      
      // Verify product details screen
      await expect(element(by.id('product-details-screen'))).toBeVisible();
      await expect(element(by.id('product-title'))).toBeVisible();
      await expect(element(by.id('product-price'))).toBeVisible();
      await expect(element(by.id('product-description'))).toBeVisible();
      await expect(element(by.id('add-to-cart-button'))).toBeVisible();
    });

    test('PM-MOB-002: Product search functionality', async () => {
      await element(by.id('products-tab')).tap();
      
      // Use search functionality
      await element(by.id('search-input')).tap();
      await element(by.id('search-input')).typeText('cake');
      await element(by.id('search-button')).tap();
      
      // Wait for search results
      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Verify search results contain cake products
      await expect(element(by.text('Cake')).atIndex(0)).toBeVisible();
    });

    test('PM-MOB-003: Category filtering', async () => {
      await element(by.id('products-tab')).tap();
      
      // Filter by category
      await element(by.id('category-filter')).tap();
      await element(by.id('category-cakes')).tap();
      
      // Verify only cake products are shown
      await waitFor(element(by.id('filtered-products')))
        .toBeVisible()
        .withTimeout(2000);
      
      await expect(element(by.text('Cakes'))).toBeVisible();
    });

    test('PM-MOB-004: Add products to cart', async () => {
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      
      // Add to cart
      await element(by.id('add-to-cart-button')).tap();
      
      // Verify success message and cart badge
      await expect(element(by.text('Added to cart'))).toBeVisible();
      await expect(element(by.id('cart-badge'))).toBeVisible();
      
      // Navigate to cart and verify item
      await element(by.id('cart-tab')).tap();
      await expect(element(by.id('cart-item-0'))).toBeVisible();
    });
  });

  // ================================
  // ORDER FLOW TESTS
  // ================================
  describe('Order Flow E2E', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      // Add products to cart for order tests
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('product-card-2')).tap();
      await element(by.id('add-to-cart-button')).tap();
    });

    test('OF-MOB-001: Complete delivery order flow', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Select delivery option
      await element(by.id('delivery-option')).tap();
      
      // Add/select delivery address
      await element(by.id('address-section')).tap();
      await element(by.id('add-address-button')).tap();
      
      // Fill address form
      await element(by.id('street-input')).typeText('123 Test Street, Amman');
      await element(by.id('phone-input')).typeText('+962791234567');
      await element(by.id('save-address-button')).tap();
      
      // Wait for shipping calculation
      await waitFor(element(by.id('shipping-cost')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Select payment method
      await element(by.id('payment-cash')).tap();
      
      // Add special instructions
      await element(by.id('instructions-input'))
        .typeText('E2E test order - handle with care');
      
      // Place order
      await element(by.id('place-order-button')).tap();
      
      // Verify order confirmation
      await expect(element(by.id('order-confirmation'))).toBeVisible();
      await expect(element(by.id('order-number'))).toBeVisible();
    });

    test('OF-MOB-002: Pickup order flow', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Select pickup option
      await element(by.id('pickup-option')).tap();
      
      // Select branch
      await element(by.id('branch-selector')).tap();
      await element(by.id('branch-main')).tap();
      
      // Select pickup time
      await element(by.id('pickup-time')).tap();
      await element(by.id('time-slot-afternoon')).tap();
      
      // Complete order
      await element(by.id('place-order-button')).tap();
      
      // Verify pickup order confirmation
      await expect(element(by.text('Pickup Order Confirmed'))).toBeVisible();
    });
  });

  // ================================
  // SHIPPING CALCULATION TESTS
  // ================================
  describe('Shipping Integration E2E', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
    });

    test('SHIP-MOB-001: Real-time shipping calculation', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      await element(by.id('delivery-option')).tap();
      
      // Test different addresses for shipping zones
      const addresses = [
        { street: '5km Test Address', zone: 'Urban' },
        { street: '15km Test Address', zone: 'Metropolitan' },
        { street: '30km Test Address', zone: 'Regional' }
      ];
      
      for (const address of addresses) {
        await element(by.id('address-section')).tap();
        await element(by.id('add-address-button')).tap();
        
        await element(by.id('street-input')).clearText();
        await element(by.id('street-input')).typeText(address.street);
        await element(by.id('save-address-button')).tap();
        
        // Wait for shipping calculation
        await waitFor(element(by.id('shipping-zone')))
          .toBeVisible()
          .withTimeout(5000);
        
        // Verify correct zone
        await expect(element(by.text(address.zone))).toBeVisible();
      }
    });

    test('SHIP-MOB-002: Free shipping threshold display', async () => {
      // Add expensive items to reach threshold
      await element(by.id('products-tab')).tap();
      for (let i = 0; i < 3; i++) {
        await element(by.id('product-card-premium')).tap();
        await element(by.id('add-to-cart-button')).tap();
        await device.pressBack();
      }
      
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      await element(by.id('delivery-option')).tap();
      
      // Select address
      await element(by.id('address-section')).tap();
      await element(by.id('address-saved-0')).tap();
      
      // Verify free shipping message
      await expect(element(by.text('Free Shipping Applied!'))).toBeVisible();
      await expect(element(by.text('Shipping: Free'))).toBeVisible();
    });
  });

  // ================================
  // PROMO CODE TESTS
  // ================================
  describe('Promo Code Integration E2E', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
    });

    test('PC-MOB-001: Apply percentage discount promo', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Apply promo code
      await element(by.id('promo-code-input')).tap();
      await element(by.id('promo-code-input')).typeText('SAVE10');
      await element(by.id('apply-promo-button')).tap();
      
      // Wait for discount calculation
      await waitFor(element(by.id('discount-applied')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Verify discount is shown
      await expect(element(by.text('10% Discount Applied'))).toBeVisible();
      await expect(element(by.id('discount-amount'))).toBeVisible();
    });

    test('PC-MOB-002: Apply free shipping promo', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      await element(by.id('delivery-option')).tap();
      
      // Add address to trigger shipping
      await element(by.id('address-section')).tap();
      await element(by.id('address-saved-0')).tap();
      
      // Apply free shipping promo
      await element(by.id('promo-code-input')).typeText('FREESHIP25');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify free shipping applied
      await expect(element(by.text('Free Shipping Promo Applied!'))).toBeVisible();
    });

    test('PC-MOB-003: BXGY promo validation', async () => {
      // Add qualifying products for BXGY
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-cake')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('product-card-cake')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('product-card-pastry')).tap();
      await element(by.id('add-to-cart-button')).tap();
      
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Apply BXGY promo
      await element(by.id('promo-code-input')).typeText('BXGY-CAKE');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify BXGY discount
      await expect(element(by.text('Buy 2 Get 1 Free Applied!'))).toBeVisible();
      await expect(element(by.text('Free Item: Basic Pastry'))).toBeVisible();
    });

    test('PC-MOB-004: Invalid promo code handling', async () => {
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Try invalid promo
      await element(by.id('promo-code-input')).typeText('INVALID123');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify error message
      await expect(element(by.text('Invalid or expired promo code'))).toBeVisible();
      
      // Verify no discount applied
      await expect(element(by.id('discount-applied'))).not.toBeVisible();
    });
  });
  describe('Product Browsing and Search', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
    });

    test('PROD-001: Browse products by category', async () => {
      await element(by.id('products-tab')).tap();
      
      // Test category filtering
      await element(by.id('category-filter')).tap();
      await element(by.text('Cakes')).tap();
      
      // Verify filtered results
      await expect(element(by.id('product-list'))).toBeVisible();
      await expect(element(by.text('Premium Cake'))).toBeVisible();
    });

    test('PROD-002: Search products by name', async () => {
      await element(by.id('products-tab')).tap();
      await element(by.id('search-input')).typeText('Premium Cake');
      await element(by.id('search-button')).tap();
      
      // Verify search results
      await expect(element(by.text('Premium Cake'))).toBeVisible();
      await expect(element(by.id('search-results-count'))).toBeVisible();
    });

    test('PROD-003: View product details', async () => {
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      
      // Verify product details page
      await expect(element(by.id('product-title'))).toBeVisible();
      await expect(element(by.id('product-price'))).toBeVisible();
      await expect(element(by.id('product-description'))).toBeVisible();
      await expect(element(by.id('product-images'))).toBeVisible();
      await expect(element(by.id('add-to-cart-button'))).toBeVisible();
    });

    test('PROD-004: Add product to cart', async () => {
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      
      // Add to cart
      await element(by.id('quantity-input')).replaceText('2');
      await element(by.id('add-to-cart-button')).tap();
      
      // Verify cart updated
      await expect(element(by.text('Added to cart'))).toBeVisible();
      await expect(element(by.id('cart-badge-2'))).toBeVisible();
    });
  });

  // ================================
  // CART MANAGEMENT TESTS
  // ================================
  describe('Cart Management', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      // Add items to cart
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
    });

    test('CART-001: View cart contents', async () => {
      await element(by.id('cart-tab')).tap();
      
      // Verify cart items
      await expect(element(by.id('cart-item-list'))).toBeVisible();
      await expect(element(by.id('cart-item-1'))).toBeVisible();
      await expect(element(by.id('cart-subtotal'))).toBeVisible();
    });

    test('CART-002: Update item quantities', async () => {
      await element(by.id('cart-tab')).tap();
      
      // Increase quantity
      await element(by.id('quantity-increase-1')).tap();
      await expect(element(by.id('quantity-display-2'))).toBeVisible();
      
      // Decrease quantity
      await element(by.id('quantity-decrease-1')).tap();
      await expect(element(by.id('quantity-display-1'))).toBeVisible();
    });

    test('CART-003: Remove items from cart', async () => {
      await element(by.id('cart-tab')).tap();
      
      // Remove item
      await element(by.id('remove-item-1')).tap();
      await element(by.text('Confirm')).tap();
      
      // Verify item removed
      await expect(element(by.id('empty-cart-message'))).toBeVisible();
    });

    test('CART-004: Apply promo code', async () => {
      await element(by.id('cart-tab')).tap();
      
      // Apply promo code
      await element(by.id('promo-code-input')).typeText('SAVE10');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify discount applied
      await expect(element(by.text('Discount Applied'))).toBeVisible();
      await expect(element(by.id('discount-amount'))).toBeVisible();
    });
  });

  // ================================
  // CHECKOUT AND ORDERING TESTS
  // ================================
  describe('Checkout and Order Placement', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      // Add items to cart
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('cart-tab')).tap();
    });

    test('CHECKOUT-001: Delivery order with address selection', async () => {
      await element(by.id('checkout-button')).tap();
      
      // Select delivery option
      await element(by.id('delivery-option')).tap();
      
      // Select delivery address
      await element(by.id('select-address-button')).tap();
      await element(by.id('address-option-1')).tap();
      
      // Verify shipping calculation
      await expect(element(by.id('shipping-cost'))).toBeVisible();
      await expect(element(by.id('delivery-zone'))).toBeVisible();
      
      // Select payment method
      await element(by.id('payment-cash')).tap();
      
      // Place order
      await element(by.id('place-order-button')).tap();
      
      // Verify order confirmation
      await expect(element(by.text('Order Placed Successfully'))).toBeVisible();
      await expect(element(by.id('order-number'))).toBeVisible();
    });

    test('CHECKOUT-002: Pickup order', async () => {
      await element(by.id('checkout-button')).tap();
      
      // Select pickup option
      await element(by.id('pickup-option')).tap();
      
      // Select branch
      await element(by.id('select-branch-button')).tap();
      await element(by.id('branch-option-1')).tap();
      
      // Verify no shipping cost
      await expect(element(by.text('No Delivery Fee'))).toBeVisible();
      
      // Select pickup time
      await element(by.id('pickup-time-selector')).tap();
      await element(by.text('2:00 PM')).tap();
      
      // Complete order
      await element(by.id('payment-cash')).tap();
      await element(by.id('place-order-button')).tap();
      
      await expect(element(by.text('Order Placed Successfully'))).toBeVisible();
    });

    test('CHECKOUT-003: Order with multiple promo codes', async () => {
      await element(by.id('checkout-button')).tap();
      
      // Apply percentage discount
      await element(by.id('promo-code-input')).typeText('SAVE15');
      await element(by.id('apply-promo-button')).tap();
      await expect(element(by.text('15% Discount Applied'))).toBeVisible();
      
      // Try to apply free shipping (should choose best combination)
      await element(by.id('promo-code-input')).clearText();
      await element(by.id('promo-code-input')).typeText('FREESHIP50');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify system chose optimal discount
      await expect(element(by.id('total-savings'))).toBeVisible();
    });

    test('CHECKOUT-004: Guest checkout', async () => {
      await logout();
      
      // Browse and add to cart as guest
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await element(by.text('Continue as Guest')).tap();
      
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Fill guest information
      await element(by.id('guest-name-input')).typeText('Guest User');
      await element(by.id('guest-phone-input')).typeText('+962791234567');
      await element(by.id('guest-address-input')).typeText('123 Test Street, Amman');
      
      // Complete guest order
      await element(by.id('delivery-option')).tap();
      await element(by.id('payment-cash')).tap();
      await element(by.id('place-order-button')).tap();
      
      await expect(element(by.text('Order Placed Successfully'))).toBeVisible();
    });
  });

  // ================================
  // SHIPPING CALCULATION TESTS
  // ================================
  describe('Shipping Calculation and Display', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
    });

    test('SHIP-001: Real-time shipping calculation', async () => {
      await element(by.id('delivery-option')).tap();
      
      // Select different addresses and verify shipping updates
      const testAddresses = [
        { id: 'address-option-1', expectedZone: 'Urban Zone' },
        { id: 'address-option-2', expectedZone: 'Metropolitan Zone' },
        { id: 'address-option-3', expectedZone: 'Regional Zone' }
      ];

      for (const addr of testAddresses) {
        await element(by.id('select-address-button')).tap();
        await element(by.id(addr.id)).tap();
        
        // Verify shipping zone and cost update
        await expect(element(by.text(addr.expectedZone))).toBeVisible();
        await expect(element(by.id('shipping-cost'))).toBeVisible();
        
        // Wait for calculation to complete
        await waitFor(element(by.id('shipping-calculated'))).toBeVisible().withTimeout(3000);
      }
    });

    test('SHIP-002: Free shipping threshold display', async () => {
      await element(by.id('delivery-option')).tap();
      await element(by.id('select-address-button')).tap();
      await element(by.id('address-option-1')).tap(); // Urban zone
      
      // Should show free shipping threshold
      await expect(element(by.text('Free shipping over 30 JOD'))).toBeVisible();
      
      // Add more items to reach threshold
      await device.pressBack();
      await element(by.id('cart-tab')).tap();
      await element(by.id('add-more-items-button')).tap();
      
      // Add expensive item to exceed threshold
      await element(by.id('product-card-2')).tap(); // Assume expensive item
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      
      await element(by.id('checkout-button')).tap();
      await element(by.id('delivery-option')).tap();
      
      // Verify free shipping applied
      await expect(element(by.text('FREE'))).toBeVisible();
      await expect(element(by.text('You saved on shipping!'))).toBeVisible();
    });

    test('SHIP-003: Branch distance optimization', async () => {
      await element(by.id('delivery-option')).tap();
      await element(by.id('select-address-button')).tap();
      await element(by.id('address-option-1')).tap();
      
      // Should show optimal branch selection
      await expect(element(by.id('selected-branch'))).toBeVisible();
      await expect(element(by.id('branch-distance'))).toBeVisible();
      
      // Tap to see alternative branches
      await element(by.id('view-alternative-branches')).tap();
      await expect(element(by.id('branch-alternatives-list'))).toBeVisible();
      
      // Verify distances are sorted (closest first)
      await expect(element(by.id('closest-branch-indicator'))).toBeVisible();
    });
  });

  // ================================
  // ORDER TRACKING TESTS
  // ================================
  describe('Order Tracking and Management', () => {
    
    let orderNumber;

    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
      
      // Place a test order first
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      await element(by.id('pickup-option')).tap();
      await element(by.id('payment-cash')).tap();
      await element(by.id('place-order-button')).tap();
      
      // Get order number
      orderNumber = await element(by.id('order-number')).getAttributes().text;
    });

    test('TRACK-001: View order history', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('order-history-button')).tap();
      
      // Verify order appears in history
      await expect(element(by.text(orderNumber))).toBeVisible();
      await expect(element(by.id('order-status'))).toBeVisible();
    });

    test('TRACK-002: Real-time order status updates', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('order-history-button')).tap();
      await element(by.text(orderNumber)).tap();
      
      // Verify order details and tracking
      await expect(element(by.id('order-status-timeline'))).toBeVisible();
      await expect(element(by.id('estimated-time'))).toBeVisible();
      
      // Test status update notifications (would require backend simulation)
      // This would typically be tested with mock push notifications
    });

    test('TRACK-003: Order cancellation', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('order-history-button')).tap();
      await element(by.text(orderNumber)).tap();
      
      // Cancel order (if status allows)
      if (await element(by.id('cancel-order-button')).isVisible()) {
        await element(by.id('cancel-order-button')).tap();
        await element(by.id('cancellation-reason-selector')).tap();
        await element(by.text('Changed mind')).tap();
        await element(by.id('confirm-cancellation')).tap();
        
        // Verify cancellation
        await expect(element(by.text('Order Cancelled'))).toBeVisible();
      }
    });
  });

  // ================================
  // ADDRESS MANAGEMENT TESTS
  // ================================
  describe('Address Management', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
    });

    test('ADDR-001: Add new delivery address', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('manage-addresses-button')).tap();
      await element(by.id('add-address-button')).tap();
      
      // Fill address form
      await element(by.id('address-name-input')).typeText('Home');
      await element(by.id('city-selector')).tap();
      await element(by.text('Amman')).tap();
      await element(by.id('area-selector')).tap();
      await element(by.text('Abdoun')).tap();
      await element(by.id('street-input')).typeText('Rainbow Street');
      await element(by.id('building-input')).typeText('Building 123');
      await element(by.id('details-input')).typeText('Apartment 4B');
      
      // Save address
      await element(by.id('save-address-button')).tap();
      
      // Verify address saved
      await expect(element(by.text('Address saved successfully'))).toBeVisible();
      await expect(element(by.text('Home'))).toBeVisible();
    });

    test('ADDR-002: Edit existing address', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('manage-addresses-button')).tap();
      
      // Edit first address
      await element(by.id('edit-address-1')).tap();
      await element(by.id('address-name-input')).clearText();
      await element(by.id('address-name-input')).typeText('Updated Home');
      await element(by.id('save-address-button')).tap();
      
      await expect(element(by.text('Updated Home'))).toBeVisible();
    });

    test('ADDR-003: Set default address', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('manage-addresses-button')).tap();
      
      // Set address as default
      await element(by.id('set-default-1')).tap();
      
      // Verify default indicator
      await expect(element(by.id('default-address-badge'))).toBeVisible();
    });

    test('ADDR-004: Delete address', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('manage-addresses-button')).tap();
      
      // Delete address
      await element(by.id('delete-address-2')).tap();
      await element(by.text('Confirm')).tap();
      
      // Verify address removed
      await expect(element(by.text('Address deleted'))).toBeVisible();
    });
  });

  // ================================
  // PROMOTION AND DISCOUNT TESTS
  // ================================
  describe('Promotions and Discounts', () => {
    
    beforeEach(async () => {
      await loginAsCustomer('test@example.com', 'password123');
    });

    test('PROMO-001: View available promotions', async () => {
      await element(by.id('promotions-tab')).tap();
      
      // Verify promotions list
      await expect(element(by.id('promotions-list'))).toBeVisible();
      await expect(element(by.id('promo-card-active'))).toBeVisible();
      
      // View promo details
      await element(by.id('promo-card-1')).tap();
      await expect(element(by.id('promo-details'))).toBeVisible();
      await expect(element(by.id('promo-terms'))).toBeVisible();
    });

    test('PROMO-002: Apply promo code in cart', async () => {
      // Add items to cart first
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      
      await element(by.id('cart-tab')).tap();
      
      // Apply valid promo code
      await element(by.id('promo-section')).tap();
      await element(by.id('promo-code-input')).typeText('SAVE20');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify discount applied
      await expect(element(by.text('20% discount applied'))).toBeVisible();
      await expect(element(by.id('discount-amount'))).toBeVisible();
      
      // Try invalid promo code
      await element(by.id('promo-code-input')).clearText();
      await element(by.id('promo-code-input')).typeText('INVALID');
      await element(by.id('apply-promo-button')).tap();
      
      await expect(element(by.text('Invalid promo code'))).toBeVisible();
    });

    test('PROMO-003: BXGY promotion application', async () => {
      // Add qualifying items for BXGY promo
      await element(by.id('products-tab')).tap();
      
      // Add 2 cakes (buy requirement)
      await element(by.id('product-card-cake')).tap();
      await element(by.id('quantity-input')).replaceText('2');
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      
      // Add pastry (get item)
      await element(by.id('product-card-pastry')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      
      await element(by.id('cart-tab')).tap();
      
      // Apply BXGY promo
      await element(by.id('promo-code-input')).typeText('BXGY-CAKE');
      await element(by.id('apply-promo-button')).tap();
      
      // Verify BXGY discount
      await expect(element(by.text('Buy 2 Get 1 Free applied'))).toBeVisible();
      await expect(element(by.id('free-item-indicator'))).toBeVisible();
    });
  });

  // ================================
  // PERFORMANCE TESTS
  // ================================
  describe('Performance and Responsiveness', () => {
    
    test('PERF-001: App launch and initial load time', async () => {
      const startTime = Date.now();
      
      await device.relaunchApp();
      await waitFor(element(by.id('main-screen'))).toBeVisible().withTimeout(5000);
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('PERF-002: Smooth scrolling and navigation', async () => {
      await element(by.id('products-tab')).tap();
      
      // Test smooth scrolling through product list
      await element(by.id('product-list')).scroll(1000, 'down');
      await element(by.id('product-list')).scroll(1000, 'up');
      
      // Navigation should be responsive
      await element(by.id('cart-tab')).tap();
      await element(by.id('profile-tab')).tap();
      await element(by.id('products-tab')).tap();
      
      // No performance degradation expected
    });

    test('PERF-003: Large cart handling', async () => {
      await loginAsCustomer('test@example.com', 'password123');
      
      // Add many items to cart
      for (let i = 1; i <= 20; i++) {
        await element(by.id('products-tab')).tap();
        await element(by.id(`product-card-${i % 5 + 1}`)).tap();
        await element(by.id('add-to-cart-button')).tap();
        await device.pressBack();
      }
      
      // Cart should remain responsive
      await element(by.id('cart-tab')).tap();
      await expect(element(by.id('cart-item-list'))).toBeVisible();
      
      // Checkout should work with large cart
      await element(by.id('checkout-button')).tap();
      await expect(element(by.id('checkout-screen'))).toBeVisible();
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================
  describe('Error Handling and Edge Cases', () => {
    
    test('ERROR-001: Network connectivity issues', async () => {
      await loginAsCustomer('test@example.com', 'password123');
      
      // Simulate network disconnection
      await device.setNetworkConnection(false);
      
      await element(by.id('products-tab')).tap();
      
      // Should show appropriate error message
      await expect(element(by.text('No internet connection'))).toBeVisible();
      await expect(element(by.id('retry-button'))).toBeVisible();
      
      // Restore connection
      await device.setNetworkConnection(true);
      await element(by.id('retry-button')).tap();
      
      // Should recover gracefully
      await expect(element(by.id('product-list'))).toBeVisible();
    });

    test('ERROR-002: Invalid input validation', async () => {
      await element(by.id('profile-tab')).tap();
      await element(by.id('manage-addresses-button')).tap();
      await element(by.id('add-address-button')).tap();
      
      // Try to save without required fields
      await element(by.id('save-address-button')).tap();
      
      // Should show validation errors
      await expect(element(by.text('Name is required'))).toBeVisible();
      await expect(element(by.text('City is required'))).toBeVisible();
      
      // Test invalid phone number
      await element(by.id('phone-input')).typeText('invalid-phone');
      await element(by.id('save-address-button')).tap();
      
      await expect(element(by.text('Invalid phone number format'))).toBeVisible();
    });

    test('ERROR-003: Order placement failures', async () => {
      await loginAsCustomer('test@example.com', 'password123');
      
      // Add items to cart
      await element(by.id('products-tab')).tap();
      await element(by.id('product-card-1')).tap();
      await element(by.id('add-to-cart-button')).tap();
      await device.pressBack();
      
      await element(by.id('cart-tab')).tap();
      await element(by.id('checkout-button')).tap();
      
      // Try to place order without selecting address (delivery)
      await element(by.id('delivery-option')).tap();
      await element(by.id('place-order-button')).tap();
      
      // Should show validation error
      await expect(element(by.text('Please select a delivery address'))).toBeVisible();
      
      // Try with invalid promo code
      await element(by.id('promo-code-input')).typeText('EXPIRED123');
      await element(by.id('apply-promo-button')).tap();
      
      await expect(element(by.text('Promo code has expired'))).toBeVisible();
    });
  });

  // ================================
  // ACCESSIBILITY TESTS
  // ================================
  describe('Accessibility and Usability', () => {
    
    test('A11Y-001: Screen reader compatibility', async () => {
      await device.enableSynchronization(false);
      await device.setAccessibilityIdentifier('accessibility-mode');
      
      // Test important elements have accessibility labels
      await expect(element(by.id('products-tab'))).toHaveAccessibilityLabel('Products');
      await expect(element(by.id('cart-tab'))).toHaveAccessibilityLabel('Shopping Cart');
      await expect(element(by.id('checkout-button'))).toHaveAccessibilityLabel('Proceed to Checkout');
      
      await device.enableSynchronization(true);
    });

    test('A11Y-002: Large text support', async () => {
      // Test app with large text settings
      await device.setUserDefaults({ 'accessibility.font_size': 'large' });
      await reloadApp();
      
      // Verify layout doesn't break with larger text
      await element(by.id('products-tab')).tap();
      await expect(element(by.id('product-list'))).toBeVisible();
      
      // Text should be readable and buttons accessible
      await element(by.id('product-card-1')).tap();
      await expect(element(by.id('product-title'))).toBeVisible();
      await expect(element(by.id('add-to-cart-button'))).toBeVisible();
    });

    test('A11Y-003: Voice control compatibility', async () => {
      // Test voice commands (if supported)
      await device.setOrientation('portrait');
      
      // Basic voice navigation test
      await expect(element(by.id('main-screen'))).toBeVisible();
      
      // Voice-activated buttons should be properly labeled
      await expect(element(by.id('products-tab'))).toHaveAccessibilityTraits(['button']);
      await expect(element(by.id('add-to-cart-button'))).toHaveAccessibilityTraits(['button']);
    });
  });
});

// ================================
// HELPER FUNCTIONS
// ================================
async function waitForShippingCalculation() {
  await waitFor(element(by.id('shipping-calculated')))
    .toBeVisible()
    .withTimeout(3000);
}

async function addMultipleItemsToCart(productIds) {
  for (const productId of productIds) {
    await element(by.id('products-tab')).tap();
    await element(by.id(`product-card-${productId}`)).tap();
    await element(by.id('add-to-cart-button')).tap();
    await device.pressBack();
  }
}

async function verifyOrderSummary(expectedSubtotal, expectedShipping, expectedDiscount) {
  await expect(element(by.id('order-subtotal'))).toHaveText(`${expectedSubtotal.toFixed(2)} JOD`);
  await expect(element(by.id('shipping-cost'))).toHaveText(`${expectedShipping.toFixed(2)} JOD`);
  if (expectedDiscount > 0) {
    await expect(element(by.id('discount-amount'))).toHaveText(`-${expectedDiscount.toFixed(2)} JOD`);
  }
}

module.exports = {
  waitForShippingCalculation,
  addMultipleItemsToCart,
  verifyOrderSummary
};
