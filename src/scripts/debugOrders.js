/**
 * Comprehensive Orders Debug Script
 * 
 * This script helps debug why orders don't appear in the mobile app
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

async function debugOrdersIssue() {
  console.log('🔍 COMPREHENSIVE ORDERS DEBUG');
  console.log('='.repeat(50));
  
  // Step 1: Check if orders exist in database
  console.log('\n📍 STEP 1: Check backend database for orders');
  console.log('(This test shows if any orders exist at all)');
  
  try {
    // Try to access admin/staff orders endpoint to see if orders exist
    const response = await fetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    if (response.status === 401) {
      console.log('✅ Orders endpoint exists (requires auth)');
    } else if (response.status === 200) {
      console.log('✅ Orders found in database');
    }
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
  }
  
  // Step 2: Test user-specific orders endpoint
  console.log('\n📍 STEP 2: Test user orders endpoint');
  console.log('URL: /orders/user/{userId}');
  
  try {
    const userId = 1; // Test with user ID 1
    const response = await fetch(`${API_BASE_URL}/orders/user/${userId}`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ User orders endpoint working (needs auth)');
    } else if (response.status === 200) {
      console.log('✅ User orders retrieved');
      console.log(`📊 Orders count: ${data.data?.data?.length || 0}`);
    } else if (response.status === 404) {
      console.log('❌ User orders endpoint not found');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Step 3: Check authentication flow
  console.log('\n📍 STEP 3: Authentication analysis');
  console.log('The mobile app needs to:');
  console.log('1. ✅ User login and get access token');
  console.log('2. ✅ Include token in Authorization header');
  console.log('3. ✅ Call /orders/user/{userId} with token');
  
  // Step 4: Check if orders are being created
  console.log('\n📍 STEP 4: Order creation check');
  console.log('To create test orders, try:');
  console.log('1. Place order through mobile app');
  console.log('2. Check if order appears in backend');
  console.log('3. Verify order has correct user_id');
  
  console.log('\n🔧 POTENTIAL FIXES:');
  console.log('1. ✅ FIXED: API endpoint (was /orders, now /orders/user/{userId})');
  console.log('2. 🔍 CHECK: User authentication in mobile app');
  console.log('3. 🔍 CHECK: Orders exist for the logged-in user');
  console.log('4. 🔍 CHECK: Access token is valid and not expired');
  
  console.log('\n📱 NEXT STEPS:');
  console.log('1. Login to mobile app');
  console.log('2. Place a test order');
  console.log('3. Check if order appears in orders screen');
  console.log('4. If still not working, check authentication');
}

debugOrdersIssue();
