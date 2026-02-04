/**
 * React Native Address Form Test Script
 * 
 * This script helps debug the AddressFormScreen component
 * by testing all API calls and form validations
 */

import ApiService from '../services/apiService';

interface FormData {
  name?: string;
  phone?: string;
  city_id?: number;
  area_id?: number;
  street_id?: number;
  building_number?: string;
  useGPS?: boolean;
}

export class AddressFormTester {
  private static firstCity: any = null;
  private static firstArea: any = null;
  private static firstStreet: any = null;
  private static createdAddressId: number | null = null;
  
  static async runAllTests() {
    console.log('🚀 Starting Address Form Tests...\n');
    
    try {
      await this.testCitiesAPI();
      await this.testAreasAPI();
      await this.testStreetsAPI();
      await this.testAddressCreation();
      await this.testGPSFunctionality();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
    
    console.log('\n🏁 All tests completed!');
  }
  
  static async testCitiesAPI() {
    console.log('='.repeat(50));
    console.log('TEST 1: Cities API');
    console.log('='.repeat(50));
    
    try {
      const response = await ApiService.getCities();
      console.log('✅ Cities API Response:', response);
      
      if (response.success && response.data) {
        console.log(`📊 Found ${response.data.length} cities`);
        if (response.data.length > 0) {
          console.log('📍 First city:', response.data[0]);
          this.firstCity = response.data[0];
        }
      } else {
        console.log('❌ No cities data received');
        console.log('📝 Response:', response);
      }
    } catch (error) {
      console.error('❌ Cities API Error:', error);
    }
  }
  
  static async testAreasAPI() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST 2: Areas API');
    console.log('='.repeat(50));
    
    if (!this.firstCity) {
      console.log('❌ No city available for testing areas');
      return;
    }
    
    try {
      const response = await ApiService.getAreas(this.firstCity.id);
      console.log('✅ Areas API Response:', response);
      
      if (response.success && response.data) {
        console.log(`📊 Found ${response.data.length} areas for city ${this.firstCity.id}`);
        if (response.data.length > 0) {
          console.log('📍 First area:', response.data[0]);
          this.firstArea = response.data[0];
        }
      } else {
        console.log('❌ No areas data received');
        console.log('📝 Response:', response);
      }
    } catch (error) {
      console.error('❌ Areas API Error:', error);
    }
  }
  
  static async testStreetsAPI() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST 3: Streets API');
    console.log('='.repeat(50));
    
    if (!this.firstArea) {
      console.log('❌ No area available for testing streets');
      return;
    }
    
    try {
      const response = await ApiService.getStreets(this.firstArea.id);
      console.log('✅ Streets API Response:', response);
      
      if (response.success && response.data) {
        console.log(`📊 Found ${response.data.length} streets for area ${this.firstArea.id}`);
        if (response.data.length > 0) {
          console.log('📍 First street:', response.data[0]);
          this.firstStreet = response.data[0];
        }
      } else {
        console.log('❌ No streets data received');
        console.log('📝 Response:', response);
      }
    } catch (error) {
      console.error('❌ Streets API Error:', error);
    }
  }
  
  static async testAddressCreation() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST 4: Address Creation');
    console.log('='.repeat(50));
    
    const testAddress = {
      name: 'Test Home Address',
      phone: '+962791234567',
      city_id: this.firstCity?.id || 1,
      area_id: this.firstArea?.id || 1,
      street_id: this.firstStreet?.id,
      building_number: 'Building 123',
      floor_number: '2',
      apartment_number: '45',
      landmark: 'Near the main mosque',
      latitude: 31.9516,
      longitude: 35.9239,
      is_default: false
    };
    
    console.log('📦 Test address data:', testAddress);
    
    try {
      const response = await ApiService.createAddress(testAddress);
      console.log('✅ Create Address Response:', response);
      
      if (response.success) {
        console.log('🎉 Address created successfully!');
        this.createdAddressId = response.data?.id || null;
      } else {
        console.log('❌ Address creation failed');
        console.log('📝 Error:', response.message);
        console.log('🔍 Errors:', response.errors);
      }
    } catch (error) {
      console.error('❌ Create Address Error:', error);
    }
  }
  
  static async testGPSFunctionality() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST 5: GPS Address Creation');
    console.log('='.repeat(50));
    
    const gpsAddress = {
      name: 'GPS Location Address',
      phone: '+962791234567',
      city_id: 0, // GPS addresses use 0
      area_id: 0, // GPS addresses use 0
      building_number: 'GPS Building',
      latitude: 31.9516,
      longitude: 35.9239,
      is_default: false
    };
    
    console.log('📍 GPS address data:', gpsAddress);
    
    try {
      const response = await ApiService.createAddress(gpsAddress);
      console.log('✅ GPS Address Response:', response);
      
      if (response.success) {
        console.log('🎉 GPS address created successfully!');
      } else {
        console.log('❌ GPS address creation failed');
        console.log('📝 Error:', response.message);
        console.log('🔍 Errors:', response.errors);
      }
    } catch (error) {
      console.error('❌ GPS Address Error:', error);
    }
  }
  
  static validateFormData(formData: FormData) {
    console.log('\n' + '='.repeat(50));
    console.log('FORM VALIDATION TEST');
    console.log('='.repeat(50));
    
    const errors = [];
    
    if (!formData.name?.trim()) {
      errors.push('Address name is required');
    }
    
    if (!formData.phone?.trim()) {
      errors.push('Phone number is required');
    }
    
    if (!formData.useGPS) {
      if (!formData.city_id) {
        errors.push('City is required');
      }
      if (!formData.area_id) {
        errors.push('Area is required');
      }
      if (!formData.street_id) {
        errors.push('Street is required');
      }
    }
    
    if (!formData.building_number?.trim()) {
      errors.push('Building number is required');
    }
    
    if (errors.length > 0) {
      console.log('❌ Validation errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
      return false;
    } else {
      console.log('✅ Form validation passed');
      return true;
    }
  }
  
  static logAPIBaseURL() {
    console.log('🌐 API Base URL configured in ApiService');
  }
}

// Export for use in components
export default AddressFormTester;
