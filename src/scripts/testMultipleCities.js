/**
 * Test Multiple Cities for Areas - Debug Script
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

async function testMultipleCities() {
  console.log('🔍 Testing multiple cities to find one with areas...\n');
  
  // Get cities first
  const citiesResponse = await fetch(`${API_BASE_URL}/addresses/locations/cities`);
  const citiesData = await citiesResponse.json();
  
  if (!citiesData.success || !citiesData.data) {
    console.log('❌ Could not fetch cities');
    return;
  }
  
  // Test first 5 cities for areas
  const citiesToTest = citiesData.data.slice(0, 10);
  
  for (const city of citiesToTest) {
    console.log(`\n🏙️ Testing City: ${city.title_ar} (${city.title_en}) - ID: ${city.id}`);
    
    try {
      const areasResponse = await fetch(`${API_BASE_URL}/addresses/locations/areas/${city.id}`);
      const areasData = await areasResponse.json();
      
      if (areasData.success && areasData.data && areasData.data.length > 0) {
        console.log(`✅ Found ${areasData.data.length} areas!`);
        console.log('First area:', areasData.data[0]);
        
        // Test streets for the first area
        const firstArea = areasData.data[0];
        console.log(`\n🏘️ Testing Streets for Area: ${firstArea.title_ar} (${firstArea.title_en}) - ID: ${firstArea.id}`);
        
        const streetsResponse = await fetch(`${API_BASE_URL}/addresses/locations/streets/${firstArea.id}`);
        const streetsData = await streetsResponse.json();
        
        if (streetsData.success && streetsData.data) {
          console.log(`✅ Found ${streetsData.data.length} streets!`);
          if (streetsData.data.length > 0) {
            console.log('First street:', streetsData.data[0]);
          }
        } else {
          console.log('❌ No streets found');
        }
        
        break; // Found a working city, stop testing
      } else {
        console.log(`❌ No areas found (${areasData.data ? areasData.data.length : 0} areas)`);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
}

testMultipleCities();
