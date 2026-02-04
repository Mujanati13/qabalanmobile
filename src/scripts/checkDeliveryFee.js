/**
 * Check delivery_fee field format
 */

const API_BASE_URL = 'http://192.168.72.1:3015/api';

async function checkDeliveryFeeFormat() {
  console.log('🔍 Checking delivery_fee field format...\n');
  
  try {
    // Get Amman areas to check delivery_fee format
    const response = await fetch(`${API_BASE_URL}/addresses/locations/areas/541`);
    const data = await response.json();
    
    if (response.status === 200 && data.success && data.data.length > 0) {
      console.log('✅ Found areas for Amman');
      
      const firstArea = data.data[0];
      console.log('\n📊 First area data:');
      console.log(JSON.stringify(firstArea, null, 2));
      
      console.log('\n🔍 delivery_fee analysis:');
      console.log('• Value:', firstArea.delivery_fee);
      console.log('• Type:', typeof firstArea.delivery_fee);
      console.log('• Is string?', typeof firstArea.delivery_fee === 'string');
      console.log('• Is number?', typeof firstArea.delivery_fee === 'number');
      console.log('• Is null?', firstArea.delivery_fee === null);
      console.log('• Is undefined?', firstArea.delivery_fee === undefined);
      
      if (typeof firstArea.delivery_fee === 'string') {
        console.log('• Parsed as number:', parseFloat(firstArea.delivery_fee));
        console.log('• Can use toFixed?', !isNaN(parseFloat(firstArea.delivery_fee)));
      }
      
    } else {
      console.log('❌ Failed to get areas');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkDeliveryFeeFormat();
