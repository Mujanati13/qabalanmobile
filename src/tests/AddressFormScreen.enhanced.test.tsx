/**
 * Test Enhanced Address Form with Saved Addresses Feature
 * Tests the new quick start functionality for users with saved GPS addresses
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddressFormScreen from '../screens/AddressFormScreen';
import ApiService from '../services/apiService';

// Mock dependencies
jest.mock('../services/apiService');
jest.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({ isRTL: false, currentLanguage: 'en' })
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn()
};

const mockRoute = {
  params: {}
};

// Mock saved addresses data
const mockSavedAddresses = [
  {
    id: 1,
    name: 'Home',
    phone: '+1234567890',
    building_no: '123',
    details: 'Main building',
    latitude: 31.9539,
    longitude: 35.9106,
    is_default: true
  },
  {
    id: 2,
    name: 'Office',
    phone: '+9876543210',
    building_no: '456',
    details: 'Office building',
    latitude: 31.9454,
    longitude: 35.9284,
    is_default: false
  },
  {
    id: 3,
    name: 'Traditional Address',
    phone: '+5555555555',
    building_no: '789',
    details: 'No GPS coordinates',
    latitude: null,
    longitude: null,
    is_default: false
  }
];

describe('AddressFormScreen - Enhanced Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful API responses
    (ApiService.getUserAddresses as jest.Mock).mockResolvedValue({
      success: true,
      data: mockSavedAddresses
    });
  });

  describe('Quick Start Feature', () => {
    test('shows quick start section when user has saved GPS addresses', async () => {
      const { getByText, queryByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        // Should show quick start section
        expect(getByText('address.quickStart')).toBeTruthy();
        expect(getByText('address.copyFromSavedAddress')).toBeTruthy();
        expect(getByText('address.viewSavedAddresses (3)')).toBeTruthy();
        expect(getByText('common.or')).toBeTruthy();
      });
    });

    test('hides quick start section when editing an address', async () => {
      const editingRoute = {
        params: {
          address: { id: 1, name: 'Test Address' }
        }
      };

      const { queryByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={editingRoute} />
      );

      await waitFor(() => {
        // Should not show quick start section when editing
        expect(queryByText('address.quickStart')).toBeNull();
      });
    });

    test('hides quick start section when user has no saved addresses', async () => {
      (ApiService.getUserAddresses as jest.Mock).mockResolvedValue({
        success: true,
        data: []
      });

      const { queryByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        // Should not show quick start section when no saved addresses
        expect(queryByText('address.quickStart')).toBeNull();
      });
    });
  });

  describe('Saved Addresses Modal', () => {
    test('opens saved addresses modal when view button is pressed', async () => {
      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        const viewButton = getByText('address.viewSavedAddresses (3)');
        fireEvent.press(viewButton);
      });

      await waitFor(() => {
        expect(getByText('address.savedAddresses')).toBeTruthy();
      });
    });

    test('displays saved addresses correctly with GPS indicators', async () => {
      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      // Open modal
      await waitFor(() => {
        fireEvent.press(getByText('address.viewSavedAddresses (3)'));
      });

      await waitFor(() => {
        // Check address names
        expect(getByText('Home')).toBeTruthy();
        expect(getByText('Office')).toBeTruthy();
        expect(getByText('Traditional Address')).toBeTruthy();

        // Check GPS status indicators
        expect(getByText('address.gpsAvailable')).toBeTruthy();
        expect(getByText('address.traditionalAddress')).toBeTruthy();

        // Check default badge
        expect(getByText('address.default')).toBeTruthy();
      });
    });

    test('copies address details when address item is pressed', async () => {
      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      // Open modal
      await waitFor(() => {
        fireEvent.press(getByText('address.viewSavedAddresses (3)'));
      });

      // Press home address (has GPS coordinates)
      await waitFor(() => {
        fireEvent.press(getByText('Home'));
      });

      await waitFor(() => {
        // Should show success alert
        expect(getByText('address.addressCopied')).toBeTruthy();
        expect(getByText('address.addressCopiedMessage')).toBeTruthy();
      });
    });
  });

  describe('GPS Integration', () => {
    test('initializes GPS mode when editing address with coordinates', async () => {
      const gpsAddressRoute = {
        params: {
          address: {
            id: 1,
            name: 'GPS Address',
            latitude: 31.9539,
            longitude: 35.9106
          }
        }
      };

      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={gpsAddressRoute} />
      );

      await waitFor(() => {
        // Should show GPS location info
        expect(getByText('address.usingGPSLocationInfo')).toBeTruthy();
      });
    });

    test('loads saved addresses on component mount', async () => {
      render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        expect(ApiService.getUserAddresses).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles error when loading saved addresses', async () => {
      (ApiService.getUserAddresses as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { queryByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        // Should not show quick start section on error
        expect(queryByText('address.quickStart')).toBeNull();
      });

      // Should not break the component
      expect(queryByText('address.addAddress')).toBeTruthy();
    });

    test('shows empty state when no saved addresses', async () => {
      (ApiService.getUserAddresses as jest.Mock).mockResolvedValue({
        success: true,
        data: []
      });

      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      // Manually open modal to test empty state
      // (This would normally not be accessible without saved addresses)
      await waitFor(() => {
        expect(getByText('address.noSavedAddresses')).toBeTruthy();
      });
    });
  });

  describe('UI/UX Features', () => {
    test('shows correct address count in view button', async () => {
      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        expect(getByText('address.viewSavedAddresses (3)')).toBeTruthy();
      });
    });

    test('displays GPS coordinates with proper formatting', async () => {
      const { getByText } = render(
        <AddressFormScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        fireEvent.press(getByText('address.viewSavedAddresses (3)'));
      });

      await waitFor(() => {
        // Check coordinate display (formatted to 4 decimal places)
        expect(getByText('31.9539, 35.9106')).toBeTruthy();
        expect(getByText('31.9454, 35.9284')).toBeTruthy();
      });
    });
  });
});

export default AddressFormScreen;
