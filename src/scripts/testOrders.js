/**
 * Test Orders API to debug why orders don't appear
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

async function testOrdersAPI() {
  console.log('🔍 Testing Orders API...\n');
  
  // Test 1: Orders endpoint without auth (should fail)
  console.log('📍 TEST 1: Orders without authentication');
  try {
    const response = await fetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ Expected: Authentication required');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Test 2: Check if orders endpoint exists
  console.log('\n📍 TEST 2: Check orders endpoint structure');
  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST', // Try POST to see what the API expects
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 404) {
      console.log('❌ Orders endpoint might not exist');
    } else if (response.status === 401) {
      console.log('✅ Orders endpoint exists but requires auth');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n📋 Analysis:');
  console.log('• Check if backend has /orders endpoint');
  console.log('• Verify user authentication in mobile app');
  console.log('• Test if orders are being created in database');
}

testOrdersAPI();
