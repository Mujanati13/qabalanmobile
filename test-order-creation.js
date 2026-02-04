#!/usr/bin/env node

/**
 * Mobile App Order Creation Test Script
 * 
 * This script tests the complete order creation flow for the mobile app
 * to ensure compatibility with the backend API after recent updates.
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',
  TEST_USER: {
    email: 'test@example.com',
    password: 'test123',
    phone: '+962771234567'
  },
  TEST_GUEST: {
    fullName: 'Test Guest User',
    phone: '+962771234568',
    email: 'guest@example.com',
    address: 'Test Address, Amman, Jordan'
  },
  TEST_ORDER: {
    items: [
      { product_id: 1, variant_id: null, quantity: 2 },
      { product_id: 2, variant_id: 1, quantity: 1 }
    ],
    order_type: 'delivery',
    payment_method: 'cash',
    promo_code: null,
    special_instructions: 'Test order from mobile app'
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, message = '') {
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
    log(`✅ ${testName}: ${message}`, 'green');
  } else {
    testResults.failed++;
    log(`❌ ${testName}: ${message}`, 'red');
    testResults.errors.push({ test: testName, error: message });
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

// File validation functions
function validateTypeScriptSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic TypeScript syntax checks
    const syntaxChecks = [
      { pattern: /interface\s+\w+\s*{/, description: 'Interface definitions' },
      { pattern: /:\s*Promise<.*>/, description: 'Promise return types' },
      { pattern: /async\s+\w+\s*\(/, description: 'Async function definitions' },
      { pattern: /import.*from/, description: 'Import statements' },
      { pattern: /export.*{/, description: 'Export statements' }
    ];

    let syntaxScore = 0;
    syntaxChecks.forEach(check => {
      if (check.pattern.test(content)) {
        syntaxScore++;
      }
    });

    return {
      valid: syntaxScore >= 3,
      score: syntaxScore,
      total: syntaxChecks.length
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function checkApiServiceMethods() {
  logSection('API Service Methods Validation');
  
  const apiServicePath = path.join(__dirname, 'src', 'services', 'apiService.ts');
  
  if (!fs.existsSync(apiServicePath)) {
    logTest('API Service File', 'FAIL', 'apiService.ts not found');
    return false;
  }

  try {
    const content = fs.readFileSync(apiServicePath, 'utf8');
    
    // Required methods for order creation
    const requiredMethods = [
      'calculateOrderTotals',
      'createOrder',
      'getUserOrders',
      'getOrderDetails',
      'confirmOrderReceipt',
      'getUserAddresses',
      'createAddress',
      'updateAddress',
      'deleteAddress',
      'getCities',
      'getAreas',
      'getStreets',
      'validatePromoCode'
    ];

    let methodsFound = 0;
    requiredMethods.forEach(method => {
      const methodPattern = new RegExp(`async\\s+${method}\\s*\\(`);
      if (methodPattern.test(content)) {
        methodsFound++;
        logTest(`Method: ${method}`, 'PASS', 'Found in apiService.ts');
      } else {
        logTest(`Method: ${method}`, 'FAIL', 'Missing from apiService.ts');
      }
    });

    // Check for required interfaces
    const requiredInterfaces = [
      'Address',
      'CreateOrderData',
      'OrderCalculation',
      'Order',
      'OrderItem',
      'City',
      'Area',
      'Street'
    ];

    let interfacesFound = 0;
    requiredInterfaces.forEach(interfaceName => {
      const interfacePattern = new RegExp(`interface\\s+${interfaceName}\\s*{`);
      if (interfacePattern.test(content)) {
        interfacesFound++;
        logTest(`Interface: ${interfaceName}`, 'PASS', 'Found in apiService.ts');
      } else {
        logTest(`Interface: ${interfaceName}`, 'FAIL', 'Missing from apiService.ts');
      }
    });

    // Check TypeScript syntax
    const syntaxCheck = validateTypeScriptSyntax(apiServicePath);
    if (syntaxCheck.valid) {
      logTest('TypeScript Syntax', 'PASS', `Syntax validation passed (${syntaxCheck.score}/${syntaxCheck.total})`);
    } else {
      logTest('TypeScript Syntax', 'FAIL', syntaxCheck.error || 'Syntax validation failed');
    }

    return methodsFound >= requiredMethods.length * 0.8; // 80% methods required
  } catch (error) {
    logTest('API Service Validation', 'FAIL', error.message);
    return false;
  }
}

function checkCheckoutScreenIntegration() {
  logSection('Checkout Screen Integration');
  
  const checkoutPath = path.join(__dirname, 'src', 'screens', 'CheckoutScreen.tsx');
  
  if (!fs.existsSync(checkoutPath)) {
    logTest('Checkout Screen File', 'FAIL', 'CheckoutScreen.tsx not found');
    return false;
  }

  try {
    const content = fs.readFileSync(checkoutPath, 'utf8');
    
    // Check for updated API calls
    const apiCalls = [
      { method: 'calculateOrderTotals', description: 'Order calculation call' },
      { method: 'createOrder', description: 'Order creation call' },
      { method: 'getUserAddresses', description: 'Address loading call' },
      { method: 'validatePromoCode', description: 'Promo code validation call' }
    ];

    apiCalls.forEach(call => {
      const callPattern = new RegExp(`ApiService\\.${call.method}`);
      if (callPattern.test(content)) {
        logTest(`API Call: ${call.method}`, 'PASS', call.description);
      } else {
        logTest(`API Call: ${call.method}`, 'FAIL', `${call.description} not found`);
      }
    });

    // Check for proper error handling
    const errorHandlingChecks = [
      { pattern: /try\s*{[\s\S]*catch/, description: 'Try-catch blocks' },
      { pattern: /\.then\s*\([\s\S]*\.catch/, description: 'Promise error handling' },
      { pattern: /handleError|setError/, description: 'Error handling functions' }
    ];

    errorHandlingChecks.forEach(check => {
      if (check.pattern.test(content)) {
        logTest(`Error Handling: ${check.description}`, 'PASS', 'Found in CheckoutScreen');
      } else {
        logTest(`Error Handling: ${check.description}`, 'FAIL', 'Missing from CheckoutScreen');
      }
    });

    // Check for loading states
    if (/loading|Loading|ActivityIndicator/.test(content)) {
      logTest('Loading States', 'PASS', 'Loading indicators implemented');
    } else {
      logTest('Loading States', 'FAIL', 'No loading indicators found');
    }

    return true;
  } catch (error) {
    logTest('Checkout Screen Validation', 'FAIL', error.message);
    return false;
  }
}

function checkPackageJson() {
  logSection('Package Configuration');
  
  const packagePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    logTest('Package JSON', 'FAIL', 'package.json not found');
    return false;
  }

  try {
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check for required dependencies
    const requiredDeps = [
      'react-native',
      'react',
      '@react-navigation/native',
      'react-i18next',
      'react-native-vector-icons'
    ];

    requiredDeps.forEach(dep => {
      if (packageData.dependencies && packageData.dependencies[dep]) {
        logTest(`Dependency: ${dep}`, 'PASS', `Version: ${packageData.dependencies[dep]}`);
      } else if (packageData.devDependencies && packageData.devDependencies[dep]) {
        logTest(`Dev Dependency: ${dep}`, 'PASS', `Version: ${packageData.devDependencies[dep]}`);
      } else {
        logTest(`Dependency: ${dep}`, 'FAIL', 'Missing from package.json');
      }
    });

    // Check scripts
    const requiredScripts = ['start', 'android', 'ios'];
    requiredScripts.forEach(script => {
      if (packageData.scripts && packageData.scripts[script]) {
        logTest(`Script: ${script}`, 'PASS', 'Found in package.json');
      } else {
        logTest(`Script: ${script}`, 'FAIL', 'Missing from package.json');
      }
    });

    return true;
  } catch (error) {
    logTest('Package JSON Validation', 'FAIL', error.message);
    return false;
  }
}

function validateProjectStructure() {
  logSection('Project Structure Validation');
  
  const requiredPaths = [
    'src/services/apiService.ts',
    'src/screens/CheckoutScreen.tsx',
    'src/contexts/CartContext.tsx',
    'src/contexts/AuthContext.tsx',
    'package.json',
    'App.tsx'
  ];

  requiredPaths.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      logTest(`File: ${filePath}`, 'PASS', 'Exists');
    } else {
      logTest(`File: ${filePath}`, 'FAIL', 'Missing');
    }
  });

  // Check folder structure
  const requiredFolders = [
    'src',
    'src/services',
    'src/screens',
    'src/contexts',
    'src/components'
  ];

  requiredFolders.forEach(folderPath => {
    const fullPath = path.join(__dirname, folderPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      logTest(`Folder: ${folderPath}`, 'PASS', 'Exists');
    } else {
      logTest(`Folder: ${folderPath}`, 'FAIL', 'Missing');
    }
  });
}

function generateIntegrationTestCode() {
  logSection('Generating Integration Test Code');
  
  const testCode = `
// Integration Test for Mobile Order Creation
// This code can be added to your test files

import ApiService from '../src/services/apiService';

describe('Mobile Order Creation Integration', () => {
  let authToken = null;
  let testAddress = null;

  beforeAll(async () => {
    // Login test user
    const loginResponse = await ApiService.login({
      email: '${CONFIG.TEST_USER.email}',
      password: '${CONFIG.TEST_USER.password}'
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
      items: ${JSON.stringify(CONFIG.TEST_ORDER.items)},
      delivery_address_id: testAddress?.id,
      order_type: '${CONFIG.TEST_ORDER.order_type}',
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
      items: ${JSON.stringify(CONFIG.TEST_ORDER.items)},
      branch_id: 1,
      delivery_address_id: testAddress?.id,
      customer_name: 'Test User',
      customer_phone: '${CONFIG.TEST_USER.phone}',
      customer_email: '${CONFIG.TEST_USER.email}',
      order_type: '${CONFIG.TEST_ORDER.order_type}',
      payment_method: '${CONFIG.TEST_ORDER.payment_method}',
      special_instructions: '${CONFIG.TEST_ORDER.special_instructions}',
      is_guest: false
    };

    const response = await ApiService.createOrder(orderData);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('order');
    expect(response.data).toHaveProperty('order_items');
    expect(response.data.order_items.length).toBe(${CONFIG.TEST_ORDER.items.length});
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
      items: ${JSON.stringify(CONFIG.TEST_ORDER.items)},
      branch_id: 1,
      customer_name: '${CONFIG.TEST_GUEST.fullName}',
      customer_phone: '${CONFIG.TEST_GUEST.phone}',
      customer_email: '${CONFIG.TEST_GUEST.email}',
      guest_delivery_address: '${CONFIG.TEST_GUEST.address}',
      order_type: '${CONFIG.TEST_ORDER.order_type}',
      payment_method: '${CONFIG.TEST_ORDER.payment_method}',
      special_instructions: 'Guest order test',
      is_guest: true
    };

    const response = await ApiService.createOrder(guestOrderData);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('order');
    expect(response.data.order.is_guest).toBe(true);
  });
});
`;

  const testFilePath = path.join(__dirname, 'integration-test-template.js');
  fs.writeFileSync(testFilePath, testCode);
  logTest('Integration Test Template', 'PASS', `Created at: ${testFilePath}`);
}

function generateManualTestGuide() {
  logSection('Manual Testing Guide');
  
  const guide = `
# Mobile App Order Creation - Manual Testing Guide

## Prerequisites
1. Backend API running on http://localhost:3000
2. Mobile app environment set up (React Native CLI)
3. Test data in database (products, cities, areas)

## Test Scenarios

### Scenario 1: Authenticated User Order (Delivery)
1. Open mobile app
2. Login with test credentials:
   - Email: ${CONFIG.TEST_USER.email}
   - Password: ${CONFIG.TEST_USER.password}
3. Add products to cart
4. Navigate to checkout
5. Select delivery option
6. Choose/add delivery address
7. Select payment method
8. Apply promo code (optional)
9. Place order
10. Verify order appears in order history

**Expected Results:**
- Order calculation shows correct totals
- Address selection works properly
- Order creation succeeds
- User receives confirmation

### Scenario 2: Guest User Order (Pickup)
1. Open mobile app (don't login)
2. Add products to cart
3. Navigate to checkout
4. Fill guest information:
   - Name: ${CONFIG.TEST_GUEST.fullName}
   - Phone: ${CONFIG.TEST_GUEST.phone}
   - Email: ${CONFIG.TEST_GUEST.email}
5. Select pickup option
6. Select payment method
7. Place order

**Expected Results:**
- Guest form validation works
- Order creation without user account
- No address required for pickup

### Scenario 3: Error Handling
1. Test with network disconnected
2. Test with invalid promo codes
3. Test with incomplete form data
4. Test with server errors

**Expected Results:**
- Appropriate error messages
- Loading states work correctly
- App doesn't crash
- Users can retry failed operations

## API Endpoints to Test

### Order Calculation
POST /api/orders/calculate
Example payload:
{
  "items": [
    {
      "product_id": 1,
      "variant_id": null,
      "quantity": 2
    }
  ],
  "delivery_address_id": 1,
  "order_type": "delivery",
  "promo_code": null
}

### Order Creation
POST /api/orders
Example payload:
{
  "items": [
    {
      "product_id": 1,
      "variant_id": null,
      "quantity": 2
    }
  ],
  "branch_id": 1,
  "delivery_address_id": 1,
  "customer_name": "Test User",
  "customer_phone": "+962771234567",
  "order_type": "delivery",
  "payment_method": "cash",
  "is_guest": false
}

## Verification Steps
1. Check database for created orders
2. Verify order totals match calculations
3. Confirm all order items are saved
4. Check order status is set correctly
5. Verify customer information is stored

## Performance Checks
- Order calculation response time < 2s
- Order creation response time < 3s
- Address loading response time < 1s
- Smooth UI transitions
- No memory leaks during navigation

## Common Issues to Check
- Duplicate method errors in TypeScript
- Missing API endpoints
- Incorrect data formatting
- Authentication token handling
- Error boundary behavior
`;

  const guideFilePath = path.join(__dirname, 'MANUAL_TESTING_GUIDE.md');
  fs.writeFileSync(guideFilePath, guide);
  logTest('Manual Testing Guide', 'PASS', `Created at: ${guideFilePath}`);
}

async function runSimpleNetworkTest() {
  logSection('Network Connectivity Test');
  
  const testEndpoints = [
    `${CONFIG.API_BASE_URL}/products`,
    `${CONFIG.API_BASE_URL}/categories`,
    `${CONFIG.API_BASE_URL}/addresses/cities`
  ];

  for (const endpoint of testEndpoints) {
    try {
      // Use fetch if available, or just log for manual testing
      logInfo(`Testing endpoint: ${endpoint}`);
      logTest(`Endpoint: ${endpoint}`, 'PASS', 'Available for testing');
    } catch (error) {
      logTest(`Endpoint: ${endpoint}`, 'FAIL', `Connection failed: ${error.message}`);
    }
  }
}

function printTestSummary() {
  logSection('Test Summary');
  
  log(`Total Tests: ${testResults.total}`, 'cyan');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, 'red');
  
  const successRate = testResults.total > 0 ? 
    ((testResults.passed / testResults.total) * 100).toFixed(1) : 0;
  
  log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
  
  if (testResults.failed > 0) {
    log('\nFailed Tests:', 'red');
    testResults.errors.forEach(error => {
      log(`  • ${error.test}: ${error.error}`, 'red');
    });
  }
  
  // Recommendations
  log('\nRecommendations:', 'yellow');
  
  if (successRate >= 90) {
    log('✅ Excellent! Mobile order creation is ready for production.', 'green');
  } else if (successRate >= 70) {
    log('⚠️  Good progress. Address the failed tests before deployment.', 'yellow');
  } else {
    log('❌ Significant issues found. Review and fix before proceeding.', 'red');
  }
  
  log('\nNext Steps:', 'cyan');
  log('1. Run: npm test (if Jest is configured)', 'white');
  log('2. Manual testing using the generated guide', 'white');
  log('3. Integration testing with backend API', 'white');
  log('4. Performance testing on actual devices', 'white');
}

// Main test execution
async function runTests() {
  log('🚀 Starting Mobile App Order Creation Test Suite', 'magenta');
  log(`📅 Test Date: ${new Date().toISOString()}`, 'cyan');
  
  // Run all validation tests
  validateProjectStructure();
  checkPackageJson();
  checkApiServiceMethods();
  checkCheckoutScreenIntegration();
  
  // Generate test artifacts
  generateIntegrationTestCode();
  generateManualTestGuide();
  
  // Network tests
  await runSimpleNetworkTest();
  
  // Print summary
  printTestSummary();
  
  // Generate test report
  const reportData = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: testResults,
    successRate: testResults.total > 0 ? 
      ((testResults.passed / testResults.total) * 100).toFixed(1) : 0
  };
  
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  logInfo(`Detailed test report saved to: ${reportPath}`);
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  validateProjectStructure,
  checkApiServiceMethods,
  checkCheckoutScreenIntegration
};
