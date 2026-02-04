/**
 * Address API Test Script
 * 
 * This script tests all address-related API endpoints to debug issues
 * with city, area, and street loading.
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

// Test function to make API calls
async function testAPI(endpoint, method = 'GET', body = null) {
  console.log(`\n🔍 Testing: ${method} ${endpoint}`);
  
  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      config.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error);
    return null;
  }
}

// Test all address endpoints
async function testAddressEndpoints() {
  console.log('🚀 Starting Address API Tests...\n');
  
  // Test 1: Get Cities
  console.log('='.repeat(50));
  console.log('TEST 1: GET CITIES');
  console.log('='.repeat(50));
  const cities = await testAPI('/addresses/cities');
  
  // Test 2: Get Areas (if cities exist)
  if (cities && cities.data && cities.data.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log('TEST 2: GET AREAS');
    console.log('='.repeat(50));
    const firstCityId = cities.data[0].id;
    console.log(`Using first city ID: ${firstCityId}`);
    const areas = await testAPI(`/addresses/cities/${firstCityId}/areas`);
    
    // Test 3: Get Streets (if areas exist)
    if (areas && areas.data && areas.data.length > 0) {
      console.log('\n' + '='.repeat(50));
      console.log('TEST 3: GET STREETS');
      console.log('='.repeat(50));
      const firstAreaId = areas.data[0].id;
      console.log(`Using first area ID: ${firstAreaId}`);
      await testAPI(`/addresses/areas/${firstAreaId}/streets`);
    } else {
      console.log('\n❌ No areas found, skipping streets test');
    }
  } else {
    console.log('\n❌ No cities found, skipping areas and streets tests');
  }
  
  // Test 4: Test Create Address
  console.log('\n' + '='.repeat(50));
  console.log('TEST 4: CREATE ADDRESS');
  console.log('='.repeat(50));
  const testAddress = {
    name: 'Test Address',
    phone: '+962123456789',
    city_id: 1,
    area_id: 1,
    street_id: 1,
    building_number: '123',
    floor_number: '2',
    apartment_number: '4',
    landmark: 'Near test landmark',
    latitude: 31.9516,
    longitude: 35.9239,
    is_default: false
  };
  
  await testAPI('/addresses/user', 'POST', testAddress);
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Address API Tests Complete');
  console.log('='.repeat(50));
}

// Run the tests
testAddressEndpoints().catch(console.error);

module.exports = {
  testAPI,
  testAddressEndpoints,
  API_BASE_URL
};
