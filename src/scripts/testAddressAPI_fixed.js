/**
 * Address API Test Script (FIXED VERSION)
 * 
 * This script tests all address-related API endpoints with correct URLs
 * to debug issues with city, area, and street loading.
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

async function testAddressAPI() {
  console.log('🚀 Starting Address API Tests (FIXED VERSION)...');
  console.log('==================================================');
  
  let firstCity = null;
  let firstArea = null;
  let firstStreet = null;
  
  // Test 1: Get Cities
  console.log('TEST 1: GET CITIES');
  console.log('==================================================');
  try {
    console.log('🔍 Testing: GET /addresses/locations/cities');
    const response = await fetch(`${API_BASE_URL}/addresses/locations/cities`);
    console.log('✅ Status:', response.status);
    const data = await response.json();
    console.log('📦 Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      firstCity = data.data[0];
      console.log('🎯 First city found:', firstCity.title_ar || firstCity.name_ar);
    } else {
      console.log('❌ No cities found, skipping areas and streets tests');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('');
  
  // Test 2: Get Areas (only if we have a city)
  if (firstCity) {
    console.log('TEST 2: GET AREAS');
    console.log('==================================================');
    try {
      console.log(`🔍 Testing: GET /addresses/locations/areas/${firstCity.id}`);
      const response = await fetch(`${API_BASE_URL}/addresses/locations/areas/${firstCity.id}`);
      console.log('✅ Status:', response.status);
      const data = await response.json();
      console.log('📦 Response:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data && data.data.length > 0) {
        firstArea = data.data[0];
        console.log('🎯 First area found:', firstArea.title_ar || firstArea.name_ar);
      } else {
        console.log('❌ No areas found, skipping streets test');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
  }
  
  // Test 3: Get Streets (only if we have an area)
  if (firstArea) {
    console.log('TEST 3: GET STREETS');
    console.log('==================================================');
    try {
      console.log(`🔍 Testing: GET /addresses/locations/streets/${firstArea.id}`);
      const response = await fetch(`${API_BASE_URL}/addresses/locations/streets/${firstArea.id}`);
      console.log('✅ Status:', response.status);
      const data = await response.json();
      console.log('📦 Response:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data && data.data.length > 0) {
        firstStreet = data.data[0];
        console.log('🎯 First street found:', firstStreet.title_ar || firstStreet.name_ar);
      } else {
        console.log('✅ No streets found (street is optional)');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
  }
  
  // Test 4: Create Address (will fail without auth token)
  console.log('TEST 4: CREATE ADDRESS');
  console.log('==================================================');
  try {
    const addressData = {
      name: 'Test Address',
      phone: '0790123456',
      city_id: firstCity ? firstCity.id : 1,
      area_id: firstArea ? firstArea.id : 1,
      street_id: firstStreet ? firstStreet.id : null,
      building_number: '123',
      floor_number: '2',
      apartment_number: '4',
      landmark: 'Near Test Landmark',
      latitude: 31.9515694,
      longitude: 35.9239625,
      is_default: false
    };
    
    console.log('🔍 Testing: POST /addresses');
    console.log('📤 Request data:', JSON.stringify(addressData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth token - this will fail with 401
      },
      body: JSON.stringify(addressData)
    });
    
    console.log('✅ Status:', response.status);
    const data = await response.json();
    console.log('📦 Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ Expected result: Authentication required for address creation');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  // Test 5: Test GPS Mode (city_id: 0, area_id: 0)
  console.log('');
  console.log('TEST 5: CREATE GPS ADDRESS');
  console.log('==================================================');
  try {
    const gpsAddressData = {
      name: 'GPS Test Address',
      phone: '0790123456',
      city_id: 0,  // GPS mode
      area_id: 0,  // GPS mode
      street_id: null,
      building_number: '123',
      floor_number: '2',
      apartment_number: '4',
      landmark: 'GPS Location Test',
      latitude: 31.9515694,
      longitude: 35.9239625,
      is_default: false
    };
    
    console.log('🔍 Testing: POST /addresses (GPS Mode)');
    console.log('📤 Request data:', JSON.stringify(gpsAddressData, null, 2));
    
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth token - this will fail with 401
      },
      body: JSON.stringify(gpsAddressData)
    });
    
    console.log('✅ Status:', response.status);
    const data = await response.json();
    console.log('📦 Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ Expected result: Authentication required for GPS address creation');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('');
  console.log('==================================================');
  console.log('🏁 Address API Tests Complete');
  console.log('==================================================');
  console.log('');
  console.log('📋 SUMMARY:');
  console.log('- Cities endpoint: /addresses/locations/cities');
  console.log('- Areas endpoint: /addresses/locations/areas/{city_id}');
  console.log('- Streets endpoint: /addresses/locations/streets/{area_id}');
  console.log('- Create address: /addresses (requires authentication)');
  console.log('- GPS mode: Use city_id: 0, area_id: 0 with latitude/longitude');
}

testAddressAPI();
