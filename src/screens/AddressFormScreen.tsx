import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  Platform,
  FlatListComponent,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import ApiService, { Address } from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { WebView } from 'react-native-webview';

// Use the same base URL as other services (includes /api)
const API_BASE_URL = 'https://apiv2.qabalanbakery.com/api';

// Generate unique session token for Google Places Autocomplete billing optimization
const generateSessionToken = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface AddressFormScreenProps {
  navigation: any;
  route: {
    params?: {
      address?: Address;
      onSave?: (address: Address) => void;
      isGuest?: boolean;
    };
  };
}

interface City {
  id: number;
  title_ar: string;
  title_en: string;
  is_active: boolean;
}

interface Area {
  id: number;
  title_ar: string;
  title_en: string;
  delivery_fee: string; // API returns as string
  is_active: boolean;
}

interface Street {
  id: number;
  title_ar: string;
  title_en: string;
  is_active: boolean;
}

const AddressFormScreen: React.FC<AddressFormScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'ar';
  const { address: editingAddress, onSave, isGuest = false } = route.params || {};
  
  const isEditing = !!editingAddress;

  // RTL Helper function for dynamic styling
  const getFlexDirection = (reverse = false) => ({
    flexDirection: isRTL ? (reverse ? 'row' : 'row-reverse') : (reverse ? 'row-reverse' : 'row')
  });

  const getTextAlign = () => ({
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  });

  const getMarginStyle = (side: 'left' | 'right', value: number) => {
    if (isRTL) {
      return side === 'left' ? { marginRight: value } : { marginLeft: value };
    }
    return side === 'left' ? { marginLeft: value } : { marginRight: value };
  };

  // Force RTL detection - fallback to checking language directly
  const isRTLLayout = isRTL || currentLanguage === 'ar';

  // Debug RTL state
  useEffect(() => {
  console.log('📱 AddressFormScreen - Language:', currentLanguage, 'isRTL:', isRTL, 'isRTLLayout:', isRTLLayout);
  console.log('📱 AddressFormScreen - Language:', currentLanguage, 'isRTL:', isRTL, 'isRTLLayout:', isRTLLayout);
  }, [currentLanguage, isRTL, isRTLLayout]);

  // Helper function to safely format coordinates
  const formatCoordinates = (lat?: number, lng?: number, precision: number = 6): string => {
    if (lat == null || lng == null || typeof lat !== 'number' || typeof lng !== 'number') {
      return '0.000000, 0.000000';
    }
    return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
  };

  // Helper function to safely set location
  const safeSetCurrentLocation = (location: {latitude: number, longitude: number} | null) => {
    if (location && 
        typeof location.latitude === 'number' && 
        typeof location.longitude === 'number' &&
        !isNaN(location.latitude) && 
        !isNaN(location.longitude)) {
      setCurrentLocation(location);
    } else {
      console.warn('Invalid location coordinates provided:', location);
      setCurrentLocation(null);
    }
  };

  // Form state
  const [name, setName] = useState(editingAddress?.name || '');
  const [phone, setPhone] = useState(editingAddress?.phone || '');
  const [buildingNo, setBuildingNo] = useState(editingAddress?.building_no || '');
  const [floorNo, setFloorNo] = useState(editingAddress?.floor_no || '');
  const [apartmentNo, setApartmentNo] = useState(editingAddress?.apartment_no || '');
  const [details, setDetails] = useState(editingAddress?.details || '');
  const [isDefault, setIsDefault] = useState(editingAddress?.is_default || false);

  // GPS state
  const [useGPS, setUseGPS] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  
  // Map state
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 31.9539, // Default to Amman, Jordan
    longitude: 35.9106,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [autocompleteSessionToken, setAutocompleteSessionToken] = useState(generateSessionToken());
  const [isLoadingMapLocation, setIsLoadingMapLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const webViewRef = React.useRef<any>(null);

  // Location state
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [streetsUnavailable, setStreetsUnavailable] = useState<boolean>(false);
  const [manualStreet, setManualStreet] = useState<string>('');
  
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<Street | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingStreets, setLoadingStreets] = useState(false);
  
  const [showCityModal, setShowCityModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showStreetModal, setShowStreetModal] = useState(false);

  // Modal search queries
  const [cityQuery, setCityQuery] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [streetQuery, setStreetQuery] = useState('');

  // Enhanced error states for better UX
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    city?: string;
    area?: string;
    street?: string;
    building?: string;
    location?: string;
  }>({});
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  // Saved addresses state for enhanced UI
  const [hasSavedGPSAddresses, setHasSavedGPSAddresses] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);

  useEffect(() => {
    loadCities();
    loadSavedAddresses();
    
    // Initialize with editing address if it has GPS coordinates
    if (editingAddress && editingAddress.latitude && editingAddress.longitude) {
      console.log('🗺️ Editing address with GPS coordinates:', {
        latitude: editingAddress.latitude,
        longitude: editingAddress.longitude
      });
      setUseGPS(true);
      safeSetCurrentLocation({
        latitude: editingAddress.latitude,
        longitude: editingAddress.longitude
      });
      setMapLocation({
        latitude: editingAddress.latitude,
        longitude: editingAddress.longitude
      });
    }
  }, []);

  const loadSavedAddresses = async () => {
    try {
      const response = await ApiService.getUserAddresses();
      if (response?.success && response?.data) {
        const addresses = response.data;
        setSavedAddresses(addresses);
        const gpsAddresses = addresses.filter((addr: Address) => 
          addr.latitude != null && addr.longitude != null && 
          typeof addr.latitude === 'number' && typeof addr.longitude === 'number'
        );
        setHasSavedGPSAddresses(gpsAddresses.length > 0);
        console.log('📍 Found saved GPS addresses:', gpsAddresses.length);
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const copyFromSavedAddress = (address: Address) => {
    if (address.latitude != null && address.longitude != null && 
        typeof address.latitude === 'number' && typeof address.longitude === 'number') {
      setUseGPS(true);
      safeSetCurrentLocation({
        latitude: address.latitude,
        longitude: address.longitude
      });
      setMapLocation({
        latitude: address.latitude,
        longitude: address.longitude
      });
    }
    
    // Copy basic info
    setName(address.name || '');
    setPhone(address.phone || '');
    setBuildingNo(address.building_no || '');
    setFloorNo(address.floor_no || '');
    setApartmentNo(address.apartment_no || '');
    setDetails(address.details || '');
    
    setShowSavedAddresses(false);
    
    Alert.alert(
      t('address.addressCopied'),
      t('address.addressCopiedMessage'),
      [{ text: t('common.ok') }]
    );
  };

  useEffect(() => {
    loadCities();
  }, []);

  // GPS Permission and Location Methods
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('address.locationPermissionTitle'),
            message: t('address.locationPermissionMessage'),
            buttonNeutral: t('common.askLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      Alert.alert(
        t('address.locationPermissionDenied'),
        t('address.locationPermissionDeniedMessage')
      );
      return;
    }

    setGpsLoading(true);
    
    // First attempt: High accuracy GPS (satellite-based)
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ latitude, longitude });
        setMapLocation({ latitude, longitude });
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setUseGPS(true);
        setGpsLoading(false);
        
        Alert.alert(
          t('address.locationDetected'),
          t('address.locationDetectedMessage'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                // When using GPS, make city/area/street optional
                // User can still select them if they want to be more specific
              }
            }
          ]
        );
      },
      (error) => {
        console.error('High accuracy GPS Error:', error);
        
        // Second attempt: Network-based location (WiFi/Cell tower)
        Geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ latitude, longitude });
            setMapLocation({ latitude, longitude });
            setMapRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            setUseGPS(true);
            setGpsLoading(false);
            
            Alert.alert(
              t('address.locationDetected'),
              t('address.locationDetectedMessage') + ' (' + t('address.networkBased') + ')',
              [
                {
                  text: t('common.ok'),
                  onPress: () => {}
                }
              ]
            );
          },
          (networkError) => {
            console.error('Network-based GPS Error:', networkError);
            console.error('❌ Error code:', networkError?.code, '- TIMEOUT (3), POSITION_UNAVAILABLE (2), PERMISSION_DENIED (1)');
            setGpsLoading(false);
            
            // Final fallback: Default to Amman, Jordan
            const defaultLocation = { latitude: 31.9539, longitude: 35.9106 };
            setCurrentLocation(defaultLocation);
            setMapLocation(defaultLocation);
            setMapRegion({
              latitude: defaultLocation.latitude,
              longitude: defaultLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            setUseGPS(true);
            
            Alert.alert(
              t('address.locationError'),
              t('address.locationErrorMessage') + ' ' + t('address.defaultLocationUsed'),
              [
                {
                  text: t('common.ok'),
                  onPress: () => {}
                }
              ]
            );
          },
          {
            enableHighAccuracy: false, // Use network-based location
            timeout: 15000, // Reduced from 30s to 15s to fail faster
            maximumAge: 30000, // Reduced from 60s to 30s for fresher data
          }
        );
      },
      {
        enableHighAccuracy: true, // Try GPS satellite first
        timeout: 25000, // Increased to 25s to give GPS time to acquire satellites
        maximumAge: 10000,
      }
    );
  };

  const openMapPicker = async () => {
    // Always open map centered on Jordan (Amman) without GPS detection
    const defaultLocation = { latitude: 31.9539, longitude: 35.9106 };
    
    // Use current location if available for map region, otherwise use Jordan default
    const locationToUse = currentLocation || defaultLocation;
    
    // Set map region but don't set marker location automatically
    setMapRegion({
      latitude: locationToUse.latitude,
      longitude: locationToUse.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    
    // Only set mapLocation if we already have a current location (editing scenario)
    // For new addresses, user must select on map
    if (currentLocation) {
      setMapLocation(currentLocation);
    }
    
    setShowMapModal(true);
  };

  // Handle opening map modal with proper initialization
  const handleOpenMapModal = () => {
    console.log('🗺️ Opening map modal...');
    
    // Reset any previous errors
    setMapError(null);
    
    // Set initial region - use current location if available, otherwise default to Amman
    const initialRegion = currentLocation ? {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    } : {
      latitude: 31.9539, // Amman, Jordan city center
      longitude: 35.9106,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    
    setMapRegion(initialRegion);
    
    // If we have current location, set it as selected
    if (currentLocation) {
      setMapLocation(currentLocation);
    }
    
    setShowMapModal(true);
    
    // After modal opens, center map on location if available
    setTimeout(() => {
      if (webViewRef.current && currentLocation) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'set_location',
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        }));
      }
    }, 1000);
  };

  // Search places on map
  const searchPlaces = async (query: string) => {
    if (!query.trim()) {
      setMapSearchResults([]);
      return;
    }

    setIsSearchingMap(true);
    
    // Add a delay to avoid too frequent requests
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      // Call backend proxy for Google Places Autocomplete (New API)
      const url = `${API_BASE_URL}/places/autocomplete`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: query,
          sessionToken: autocompleteSessionToken,
          languageCode: currentLanguage === 'ar' ? 'ar' : 'en',
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        console.error(`Places autocomplete failed with status ${response.status}`);
        setMapSearchResults([]);
        return;
      }
      
      const data = await response.json();
      
      // Ensure suggestions is an array
      if (!Array.isArray(data.suggestions)) {
        console.warn('Places API returned invalid data format');
        setMapSearchResults([]);
        return;
      }
      
      // Map Google Places API (New) suggestions to our result format
      console.log('🔍 Backend autocomplete response:', data);
      const results = data.suggestions
        .filter((suggestion: any) => suggestion.placePrediction)
        .map((suggestion: any) => {
          const result = {
            place: suggestion.placePrediction.placeId || suggestion.placePrediction.place,
            text: suggestion.placePrediction.text?.text || '',
            structuredFormat: suggestion.placePrediction.structuredFormat,
          };
          console.log('📍 Mapped suggestion:', result);
          return result;
        });
      
      setMapSearchResults(results);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Map search request timed out');
      } else {
        console.error('Map search error:', error);
      }
      setMapSearchResults([]);
    } finally {
      setIsSearchingMap(false);
    }
  };

  // Fetch place details from backend proxy to get coordinates
  const fetchPlaceDetails = async (placeId: string) => {
    try {
      console.log('🌍 Fetching place details for:', placeId);
      const url = new URL(`${API_BASE_URL}/places/details`);
      url.searchParams.append('place_id', placeId);
      url.searchParams.append('sessionToken', autocompleteSessionToken);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`❌ Place Details failed with status ${response.status}`);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        return null;
      }
      
      const data = await response.json();
      console.log('📍 Place details response:', data);
      
      if (!data.location) {
        console.error('❌ Place Details API error: No location in response');
        return null;
      }
      
      return {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      };
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  };

  // Handle search result selection
  const selectSearchResult = async (result: any) => {
    console.log('🎯 Selecting search result:', result);
    // Show loading spinner while setting location on map
    setIsLoadingMapLocation(true);
    
    // Fetch place details to get coordinates
    const location = await fetchPlaceDetails(result.place);
    
    if (!location) {
      console.error('❌ Failed to get location details');
      setIsLoadingMapLocation(false);
      Alert.alert(
        t('common.error'),
        t('addressForm.errorFetchingLocation') || 'Failed to get location details'
      );
      return;
    }
    
    const newRegion = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    
    setMapRegion(newRegion);
    setMapLocation({ latitude: location.latitude, longitude: location.longitude });
    setMapSearchQuery(result.text);
    setMapSearchResults([]);
    
    // Send location to webview
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'set_location',
        latitude: location.latitude,
        longitude: location.longitude
      }));
    }
    
    // Generate new session token after place selection (billing optimization)
    setAutocompleteSessionToken(generateSessionToken());
    
    // Hide spinner after a short delay to allow map to update
    setTimeout(() => {
      setIsLoadingMapLocation(false);
    }, 800);
  };

  const confirmMapLocation = async () => {
    if (!mapLocation) return;
    
    // Show loading state
    setShowMapModal(false);
    setCurrentLocation(mapLocation);
    setUseGPS(true);
    
    Alert.alert(
      t('address.processingLocation'),
      t('address.processingLocationMessage'),
      [],
      { cancelable: false }
    );
    
    try {
      console.log('🗺️ Processing map location:', mapLocation);
      
      // Try to reverse geocode the location to get address details
      // Using OpenStreetMap Nominatim as alternative to Google (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapLocation.latitude}&lon=${mapLocation.longitude}&addressdetails=1&accept-language=${currentLanguage}`
      );
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        const formattedAddress = data.display_name;
        
        console.log('🏠 Reverse geocode result:', data);
        
        // Extract address components from OpenStreetMap Nominatim response
        let buildingNumber = '';
        let streetName = '';
        let areaNames: string[] = [];
        let cityNames: string[] = [];
        
        // Building number
        if (address.house_number) {
          buildingNumber = address.house_number;
        }
        
        // Street name
        if (address.road || address.street) {
          streetName = address.road || address.street;
        }
        
        // Area/neighborhood names
        if (address.neighbourhood) areaNames.push(address.neighbourhood);
        if (address.suburb) areaNames.push(address.suburb);
        if (address.district) areaNames.push(address.district);
        
        // City names
        if (address.city) cityNames.push(address.city);
        if (address.town) cityNames.push(address.town);
        if (address.municipality) cityNames.push(address.municipality);
        
        console.log('📍 Extracted components:', {
          buildingNumber,
          streetName,
          areaNames,
          cityNames
        });
        
        // Auto-fill building number
        if (buildingNumber && !buildingNo.trim()) {
          setBuildingNo(buildingNumber);
        }
        
        // Try to match and select city from database
        let matchedCity = null;
        if (cityNames.length > 0 && cities.length > 0) {
          for (const cityName of cityNames) {
            matchedCity = cities.find(city => 
              city.title_en.toLowerCase().includes(cityName.toLowerCase()) ||
              city.title_ar.includes(cityName) ||
              cityName.toLowerCase().includes(city.title_en.toLowerCase())
            );
            if (matchedCity) break;
          }
          
          if (matchedCity) {
            console.log('🏙️ Matched city:', matchedCity);
            setSelectedCity(matchedCity);
            
            // Load areas for the matched city and try to find matching area
            try {
              const areasResponse = await ApiService.getAreas(matchedCity.id);
              if (areasResponse.success && areasResponse.data) {
                setAreas(areasResponse.data);
                
                // Try to match area from reverse geocoding
                let matchedArea = null;
                for (const areaName of areaNames) {
                  matchedArea = areasResponse.data.find(area =>
                    area.title_en.toLowerCase().includes(areaName.toLowerCase()) ||
                    area.title_ar.includes(areaName) ||
                    areaName.toLowerCase().includes(area.title_en.toLowerCase())
                  );
                  if (matchedArea) break;
                }
                
                if (matchedArea) {
                  console.log('🏘️ Matched area:', matchedArea);
                  setSelectedArea(matchedArea);
                  
                  // Load streets for the matched area and try to find matching street
                  try {
                    const streetsResponse = await ApiService.getStreets(matchedArea.id);
                    if (streetsResponse.success && streetsResponse.data && streetName) {
                      setStreets(streetsResponse.data);
                      
                      const matchedStreet = streetsResponse.data.find(street =>
                        street.title_en.toLowerCase().includes(streetName.toLowerCase()) ||
                        street.title_ar.includes(streetName) ||
                        streetName.toLowerCase().includes(street.title_en.toLowerCase())
                      );
                      
                      if (matchedStreet) {
                        console.log('🛣️ Matched street:', matchedStreet);
                        setSelectedStreet(matchedStreet);
                      } else {
                        // If no street match found, store in manual street field
                        setManualStreet(streetName);
                        setStreetsUnavailable(true);
                      }
                    }
                  } catch (error) {
                    console.log('Error loading streets:', error);
                    if (streetName) {
                      setManualStreet(streetName);
                      setStreetsUnavailable(true);
                    }
                  }
                }
              }
            } catch (error) {
              console.log('Error loading areas:', error);
            }
          }
        }
        
        // Set address details with formatted address for reference
        if (!details.trim()) {
          setDetails(formattedAddress);
        }
        
        // Auto-generate address name if empty
        if (!name.trim()) {
          const locationParts = [streetName, areaNames[0], cityNames[0]].filter(Boolean);
          const locationName = locationParts.length > 0 ? locationParts.join(', ') : t('address.selectFromMap');
          setName(locationName);
        }
        
        // Dismiss loading alert and show success
        Alert.alert(
          t('address.locationProcessed'),
          `${t('address.locationProcessedMessage')}\n\n📍 ${formattedAddress}\n\n` +
          `${matchedCity ? '✅ ' + t('address.cityMatched') + ': ' + matchedCity.title_en : '❌ ' + t('address.cityNotMatched')}\n` +
          `${selectedArea ? '✅ ' + t('address.areaMatched') + ': ' + selectedArea.title_en : '❌ ' + t('address.areaNotMatched')}\n` +
          `${selectedStreet ? '✅ ' + t('address.streetMatched') + ': ' + selectedStreet.title_en : streetName ? '⚠️ ' + t('address.streetSetManually') : '❌ ' + t('address.streetNotFound')}`,
          [{ text: t('common.ok') }]
        );
        
      } else {
        // No geocoding results
        if (!name.trim()) {
          setName(t('address.selectFromMap'));
        }
        
        Alert.alert(
          t('address.locationSelected'),
          t('address.locationSelectedNoDetails'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('❌ Reverse geocoding error:', error);
      
      // Auto-fill basic info even if geocoding fails
      if (!name.trim()) {
        setName(t('address.selectFromMap'));
      }
      
      Alert.alert(
        t('address.locationSelected'),
        t('address.locationSelectedError'),
        [{ text: t('common.ok') }]
      );
    }
  };

  useEffect(() => {
    if (isEditing && editingAddress && cities.length > 0) {
      // Find and set the existing city, area, and street
      const city = cities.find(c => c.id === editingAddress.city_id);
      if (city) {
        setSelectedCity(city);
        loadAreas(city.id, editingAddress.area_id);
      }
    }
  }, [cities, editingAddress, isEditing]);

  const loadCities = async () => {
    try {
      setLoadingCities(true);
      const response = await ApiService.getCities();
      
      if (response.success && response.data) {
        setCities(response.data);
        
        // Auto-select Amman (ID: 541) as default city since it has areas
        const ammanCity = response.data.find(city => city.id === 541);
        if (ammanCity && !selectedCity) {
          setSelectedCity(ammanCity);
          // Also load areas for Amman by default
          loadAreas(ammanCity.id);
        }
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
      Alert.alert(t('common.error'), t('address.errorLoadingCities'));
    } finally {
      setLoadingCities(false);
    }
  };

  const loadAreas = async (cityId: number, preSelectAreaId?: number) => {
    try {
      setLoadingAreas(true);
      const response = await ApiService.getAreas(cityId);
      
      if (response.success && response.data) {
        setAreas(response.data);
        
        if (preSelectAreaId) {
          const area = response.data.find(a => a.id === preSelectAreaId);
          if (area) {
            setSelectedArea(area);
            loadStreets(area.id, editingAddress?.street_id);
          }
        }
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      Alert.alert(t('common.error'), t('address.errorLoadingAreas'));
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadStreets = async (areaId: number, preSelectStreetId?: number) => {
    try {
      setLoadingStreets(true);
      setStreetsUnavailable(false);
      const response = await ApiService.getStreets(areaId);
      
      if (response.success && response.data) {
        setStreets(response.data);
        if (!response.data || response.data.length === 0) {
          setStreetsUnavailable(true);
        }
        
        if (preSelectStreetId) {
          const street = response.data.find(s => s.id === preSelectStreetId);
          if (street) {
            setSelectedStreet(street);
          }
        }
      } else {
        setStreetsUnavailable(true);
        // Don't block the flow; allow manual street input
      }
    } catch (error) {
      console.error('Error loading streets:', error);
      setStreetsUnavailable(true);
    } finally {
      setLoadingStreets(false);
    }
  };

  const onCitySelect = (city: City) => {
    setSelectedCity(city);
    setSelectedArea(null);
    setSelectedStreet(null);
    setAreas([]);
    setStreets([]);
    setShowCityModal(false);
    loadAreas(city.id);
  };

  const onAreaSelect = (area: Area) => {
    setSelectedArea(area);
    setSelectedStreet(null);
    setStreets([]);
    setShowAreaModal(false);
    loadStreets(area.id);
  };

  const onStreetSelect = (street: Street) => {
    setSelectedStreet(street);
    setShowStreetModal(false);
  };

  const validateForm = (): boolean => {
    console.log('🔍 === VALIDATE FORM DEBUG ===');
    
    // Debug current form state
    console.log('📋 Current Form Data:', {
      name: `"${name}"`,
      nameLength: name.length,
      nameTrimmed: `"${name.trim()}"`,
      nameTrimmedLength: name.trim().length,
      phone: `"${phone}"`,
      phoneLength: phone.length,
      phoneTrimmed: `"${phone.trim()}"`,
      phoneTrimmedLength: phone.trim().length,
      phoneTest: /^[0-9+\-\s()]{7,15}$/.test(phone.trim()),
      phoneEmpty: !phone.trim(),
      phoneRegexMatch: phone.trim() ? /^[0-9+\-\s()]{7,15}$/.test(phone.trim()) : false,
      useGPS,
      currentLocation,
      selectedCity: selectedCity ? { id: selectedCity.id, name: selectedCity.title_en } : null,
      selectedArea: selectedArea ? { id: selectedArea.id, name: selectedArea.title_en } : null,
      selectedStreet: selectedStreet ? { id: selectedStreet.id, name: selectedStreet.title_en } : null,
      buildingNo: `"${buildingNo}"`,
      buildingNoTrimmed: `"${buildingNo.trim()}"`,
      details: `"${details}"`,
      detailsTrimmed: `"${details.trim()}"`,
      manualStreet: `"${manualStreet}"`,
      isEditing,
      editingAddressId: editingAddress?.id
    });

    // Clear previous error states
    const validationErrors: string[] = [];
    const newFieldErrors: typeof fieldErrors = {};

    // Required field validations with specific error tracking
    if (!name.trim()) {
      console.log('❌ Validation Error: Name is empty');
      validationErrors.push(t('address.nameRequired'));
      newFieldErrors.name = t('address.nameRequired');
    } else if (name.trim().length < 2) {
      console.log('❌ Validation Error: Name too short');
      validationErrors.push(t('address.nameTooShort'));
      newFieldErrors.name = t('address.nameTooShort');
    } else {
      console.log('✅ Name validation passed');
    }

    // TEMPORARY: Relaxed phone validation for debugging
    if (!phone.trim()) {
      console.log('❌ Validation Error: Phone is empty');
      validationErrors.push(t('address.phoneRequired'));
      newFieldErrors.phone = t('address.phoneRequired');
    } else if (phone.trim().length < 7) {
      console.log('❌ Validation Error: Phone too short');
      console.log('📱 Phone value:', phone.trim());
      console.log('📱 Phone length:', phone.trim().length);
      validationErrors.push('Phone number must be at least 7 characters');
      newFieldErrors.phone = 'Phone number must be at least 7 characters';
    } else {
      console.log('✅ Phone validation passed (relaxed validation)');
      console.log('📱 Phone value accepted:', phone.trim());
    }

    // Address location validation - either GPS or traditional address required
    if (!useGPS && !currentLocation) {
      console.log('🗺️ Traditional address mode validation');
      // Traditional address validation
      if (!selectedCity) {
        console.log('❌ Validation Error: City not selected');
        validationErrors.push(t('address.cityRequired'));
        newFieldErrors.city = t('address.cityRequired');
      } else {
        console.log('✅ City selected:', selectedCity.title_en);
      }
      
      if (!selectedArea) {
        console.log('❌ Validation Error: Area not selected');
        validationErrors.push(t('address.areaRequired'));
        newFieldErrors.area = t('address.areaRequired');
      } else {
        console.log('✅ Area selected:', selectedArea.title_en);
      }
      
      // Street is optional - user can provide manual street or building details
      console.log('ℹ️ Street is optional in traditional mode');
    } else if (useGPS && !currentLocation) {
      console.log('❌ Validation Error: GPS mode but no location');
      validationErrors.push(t('address.gpsLocationRequired'));
      newFieldErrors.location = t('address.gpsLocationRequired');
    } else if (useGPS && currentLocation) {
      console.log('✅ GPS mode with location:', currentLocation);
    } else {
      console.log('ℹ️ Location validation skipped (neither traditional nor GPS mode detected)');
    }

    // Building details validation - make optional for GPS addresses
    const hasBuildingNo = buildingNo.trim().length > 0;
    const hasDetails = details.trim().length > 0;
    const hasGPSLocation = useGPS && currentLocation;
    console.log('🏢 Building validation:', { hasBuildingNo, hasDetails, hasGPSLocation });
    
    // Only require building details if not using GPS (traditional addresses need more info)
    if (!hasGPSLocation && !hasBuildingNo && !hasDetails) {
      console.log('❌ Validation Error: Traditional address needs building number or details');
      validationErrors.push(t('address.buildingOrDetailsRequired'));
      newFieldErrors.building = t('address.buildingOrDetailsRequired');
    } else {
      console.log('✅ Building/details validation passed (GPS addresses are flexible)');
    }

    // Update field errors state
    setFieldErrors(newFieldErrors);
    setShowFieldErrors(Object.keys(newFieldErrors).length > 0);

    console.log('📊 Validation Summary:', {
      totalErrors: validationErrors.length,
      errors: validationErrors,
      fieldErrors: newFieldErrors
    });

    // Show comprehensive validation errors
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed, showing alert');
      Alert.alert(
        t('address.validationErrors'),
        validationErrors.join('\n\n'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return false;
    }

    console.log('✅ All validations passed!');
    return true;
  };

  const handleSave = async () => {
    console.log('\n🚀 === HANDLE SAVE DEBUG ===');
    setSaving(true);
    
    try {
      // For guest users, we only need to provide the location data back to checkout
      if (isGuest) {
        if (useGPS && currentLocation) {
          const guestAddressData = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: details.trim() || `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`,
            name: name.trim() || 'Selected Location',
            building_no: buildingNo.trim(),
            floor_no: floorNo.trim(),
            apartment_no: apartmentNo.trim(),
            details: details.trim(),
            isGuestLocation: true
          };
          
          console.log('📍 Guest location data:', guestAddressData);
          
          if (onSave) {
            onSave(guestAddressData as any);
          }
          
          Alert.alert(
            t('common.success'),
            t('address.locationSelectedFromMap') || 'Location selected from map successfully!',
            [
              {
                text: t('common.ok'),
                onPress: () => navigation.goBack()
              }
            ]
          );
          
          setSaving(false);
          return;
        } else {
          Alert.alert(
            t('common.error'),
            'Please select a location from the map first.',
            [{ text: t('common.ok') }]
          );
          setSaving(false);
          return;
        }
      }
      
      // For registered users, continue with normal save flow
      // Run frontend validation since backend validation is removed
      console.log('🔍 Running frontend validation...');
      if (!validateForm()) {
        setSaving(false);
        return;
      }

      console.log('✅ Validation passed, proceeding with save');

      // Prepare address data with correct property mapping
      const baseAddressData = {
        name: name.trim(),
        phone: phone.trim(),
        building_no: buildingNo.trim(),
        floor_no: floorNo.trim(),
        apartment_no: apartmentNo.trim(),
        details: [details.trim(), manualStreet.trim()].filter(Boolean).join(' - '),
        is_default: isDefault,
      };

      console.log('📦 Base address data prepared:', baseAddressData);

      // Handle GPS vs traditional address modes
      const addressData = useGPS && currentLocation ? {
        ...baseAddressData,
        city_id: selectedCity?.id || 1, // Default to a valid city ID for GPS addresses
        area_id: selectedArea?.id || 1, // Default to a valid area ID for GPS addresses
        street_id: selectedStreet?.id,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      } : {
        ...baseAddressData,
        city_id: selectedCity!.id,
        area_id: selectedArea!.id,
        street_id: selectedStreet?.id,
        latitude: undefined,
        longitude: undefined,
      };

      // Enhanced logging for GPS coordinates
      if (useGPS && currentLocation) {
        console.log('🌍 GPS MODE - Coordinates being saved:');
        console.log('📍 Latitude:', currentLocation.latitude);
        console.log('📍 Longitude:', currentLocation.longitude);
        console.log('📍 Coordinate precision:', {
          lat_precision: currentLocation.latitude.toString().split('.')[1]?.length || 0,
          lng_precision: currentLocation.longitude.toString().split('.')[1]?.length || 0
        });
        
        // Final validation - ensure coordinates are valid numbers
        if (isNaN(currentLocation.latitude) || isNaN(currentLocation.longitude)) {
          throw new Error('Invalid GPS coordinates detected before saving');
        }
        if (Math.abs(currentLocation.latitude) > 90 || Math.abs(currentLocation.longitude) > 180) {
          throw new Error('GPS coordinates out of valid range');
        }
        
        console.log('✅ GPS coordinates validated successfully');
      } else {
        console.log('🏢 TRADITIONAL MODE - No coordinates');
      }

      console.log('🎯 Final address data to send:', {
        ...addressData,
        mode: useGPS ? 'GPS' : 'Traditional',
        isEditing,
        editingAddressId: editingAddress?.id,
        phoneValue: `"${addressData.phone}"`,
        phoneLength: addressData.phone ? addressData.phone.length : 0,
        phoneNotEmpty: !!addressData.phone
      });

      // API call with retry logic
      let response: any;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          console.log(`📡 API Call Attempt ${attempts + 1}/${maxAttempts}`);
          
          if (isEditing && editingAddress) {
            console.log(`🔄 Updating address ID: ${editingAddress.id}`);
            response = await ApiService.updateAddress(editingAddress.id, addressData);
          } else {
            console.log('🆕 Creating new address');
            response = await ApiService.createAddress(addressData);
          }
          
          console.log('✅ API call successful');
          console.log('📥 API Response:', response);
          
          // Confirm GPS coordinates were included in the save
          if (useGPS && currentLocation && addressData.latitude && addressData.longitude) {
            console.log('🎯 CONFIRMED: GPS coordinates saved with address');
            console.log('📍 Saved coordinates:', {
              latitude: addressData.latitude,
              longitude: addressData.longitude
            });
          }
          
          break; // Success, exit retry loop
        } catch (error: any) {
          attempts++;
          console.error(`❌ Address save attempt ${attempts} failed:`, error);
          
          // Log detailed error information for debugging
          console.log('🔍 Complete error object:', error);
          console.log('🔍 Error details:', {
            message: error?.message,
            response: error?.response,
            status: error?.status,
            data: error?.data,
            name: error?.name,
            stack: error?.stack?.slice(0, 500) // Truncate stack trace
          });

          // Check if error has response data
          if (error?.response?.data) {
            console.log('🔍 Server response data:', error.response.data);
          }
          
          // Log the data being sent
          console.log('📦 Address data that was sent:', addressData);
          
          if (attempts >= maxAttempts) {
            console.log('💥 Max attempts reached, throwing error');
            throw error; // Re-throw after max attempts
          }
          
          console.log(`⏳ Retrying in ${Math.pow(2, attempts)} seconds...`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
      }

      if (response?.success) {
        console.log('🎉 Address saved successfully!');
        console.log('📄 Saved address data:', response.data);
        
        // Enhanced success message with GPS info
        const successMessage = useGPS && currentLocation 
          ? `${isEditing ? t('address.addressUpdated') : t('address.addressCreated')}\n\n📍 ${t('address.gpsCoordinatesSaved')}`
          : isEditing ? t('address.addressUpdated') : t('address.addressCreated');
        
        Alert.alert(
          t('common.success'),
          successMessage,
          [
            {
              text: t('common.ok'),
              onPress: () => {
                if (onSave && response.data) {
                  onSave(response.data);
                }
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        console.log('❌ API returned success: false');
        console.log('📄 Response details:', response);
        
        // Handle specific API errors
        const errorMessage = response?.message || t('address.saveError');
        Alert.alert(
          t('common.error'),
          errorMessage,
          [
            { text: t('common.tryAgain'), onPress: () => handleSave() },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
      }
    } catch (error: any) {
      console.error('💥 Error saving address:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = t('address.saveError');
      let errorTitle = t('common.error');
      
      // Check for different types of errors
      if (error?.response) {
        // Server responded with error status
        const status = error.response.status;
        const responseData = error.response.data;
        
        console.log('🔍 Server error response:', {
          status,
          data: responseData,
          message: responseData?.message,
          headers: error.response.headers
        });
        
        switch (status) {
          case 400:
            errorTitle = t('address.validationFailed');
            console.log('⚠️ 400 Bad Request - Validation or data error');
            if (responseData?.message) {
              errorMessage = responseData.message;
              console.log('📝 Error message from server:', responseData.message);
            } else if (responseData?.errors) {
              // Handle validation errors array
              const validationErrors = Array.isArray(responseData.errors) 
                ? responseData.errors.join('\n') 
                : JSON.stringify(responseData.errors);
              errorMessage = `${t('address.validationErrors')}:\n${validationErrors}`;
              console.log('📝 Validation errors from server:', validationErrors);
            } else {
              errorMessage = t('address.invalidDataProvided');
              console.log('📝 Generic 400 error - invalid data');
            }
            break;
          case 401:
            errorTitle = t('auth.authRequired');
            errorMessage = t('auth.pleaseLoginAgain');
            console.log('🔐 401 Unauthorized - Authentication required');
            break;
          case 403:
            errorTitle = t('common.accessDenied');
            errorMessage = t('address.noPermissionToEdit');
            console.log('🚫 403 Forbidden - Access denied');
            break;
          case 404:
            errorTitle = t('address.notFound');
            errorMessage = isEditing ? t('address.addressNotFound') : t('address.endpointNotFound');
            console.log('🔍 404 Not Found - Resource not found');
            break;
          case 422:
            errorTitle = t('address.dataProcessingError');
            errorMessage = responseData?.message || t('address.unprocessableData');
            console.log('🔧 422 Unprocessable Entity - Data processing error');
            break;
          case 500:
            errorTitle = t('common.serverError');
            errorMessage = t('address.serverProcessingError');
            console.log('🚨 500 Internal Server Error');
            break;
          default:
            errorMessage = responseData?.message || `${t('common.serverError')} (${status})`;
            console.log(`❓ ${status} Unknown Status Code`);
        }
      } else if (error?.message) {
        // Network or other client-side errors
        console.log('🌐 Client-side error:', error.message);
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch')) {
          errorTitle = t('common.connectionError');
          errorMessage = t('address.networkError');
          console.log('📡 Network error detected');
        } else if (error.message.includes('timeout')) {
          errorTitle = t('common.timeoutError');
          errorMessage = t('address.timeoutError');
          console.log('⏱️ Timeout error detected');
        } else if (error.message.includes('JSON')) {
          errorTitle = t('address.dataFormatError');
          errorMessage = t('address.invalidResponseFormat');
          console.log('📄 JSON parsing error detected');
        } else {
          errorMessage = error.message;
          console.log('❓ Other client error:', error.message);
        }
      } else {
        console.log('❓ Unknown error type:', error);
      }
      
      console.log('📢 Showing error alert:', { errorTitle, errorMessage });
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          { text: t('common.tryAgain'), onPress: () => handleSave() },
          { text: t('common.cancel'), style: 'cancel' }
        ]
      );
    } finally {
      setSaving(false);
      console.log('🏁 Save operation completed');
    }
  };

  const renderLocationSelector = (
    label: string,
    selectedItem: { title_ar: string; title_en: string } | null,
    onPress: () => void,
    loading: boolean = false
  ) => {
    const displayText = selectedItem 
      ? (currentLanguage === 'ar' ? selectedItem.title_ar : selectedItem.title_en)
      : t('address.select');

    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isRTL && styles.rtlText]}>{label}</Text>
        <TouchableOpacity
          style={[
            styles.selector, 
            isRTL && styles.rtlSelector
          ]}
          onPress={onPress}
          disabled={loading}
        >
          <Text style={[
            styles.selectorText,
            !selectedItem && styles.placeholderText,
            isRTL && styles.rtlText
          ]}>
            {displayText}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Icon 
              name={isRTL ? "chevron-back" : "chevron-forward"} 
              size={20} 
              color="#666" 
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    items: Array<{ id: number; title_ar: string; title_en: string }>,
    onSelect: (item: any) => void,
    loading: boolean = false,
    searchValue?: string,
    onSearchChange?: (text: string) => void,
    searchPlaceholder?: string
  ) => {
    const filteredItems = (items || []).filter(item => {
      if (!searchValue) return true;
      const q = searchValue.toLowerCase();
      return (
        (item.title_en || '').toLowerCase().includes(q) ||
        (item.title_ar || '').toLowerCase().includes(q)
      );
    });
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <ScrollView style={styles.modalContent}>
              {typeof onSearchChange === 'function' && (
                <View style={styles.modalSearchContainer}>
                  <TextInput
                    style={[styles.modalSearchInput, isRTL && styles.rtlTextInput]}
                    placeholder={searchPlaceholder || t('common.search')}
                    value={searchValue}
                    onChangeText={onSearchChange}
                  />
                </View>
              )}
              {filteredItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.modalItem, isRTL && styles.rtlModalItem]}
                  onPress={() => onSelect(item)}
                >
                  <Text style={[styles.modalItemText, isRTL && styles.rtlText]}>
                    {currentLanguage === 'ar' ? item.title_ar : item.title_en}
                  </Text>
                  <Icon name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#666" />
                </TouchableOpacity>
              ))}
              {filteredItems.length === 0 && (
                <View style={styles.loadingContainer}>
                  <Text style={[styles.modalItemText, { color: '#999' }, isRTL && styles.rtlText]}>
                    {t('common.no') + ' ' + t('common.items')}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isRTLLayout && styles.rtlContainer]}>
      <View style={[styles.header, isRTLLayout && styles.rtlHeader]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Icon 
            name={isRTLLayout ? "chevron-forward" : "chevron-back"} 
            size={28} 
            color="#1c1c1e" 
          />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isRTLLayout && styles.rtlText]} numberOfLines={1}>
            {isGuest ? (t('address.selectLocation') || 'Select Location') : 
             isEditing ? t('address.editAddress') : t('address.addAddress')}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Special UI for users with saved GPS addresses */}
        {!isEditing && hasSavedGPSAddresses && (
          <View style={styles.savedAddressesSection}>
            <View style={[styles.savedAddressesHeader, isRTL && styles.rtlSavedAddressesHeader]}>
              <Icon name="location" size={20} color="#007AFF" />
              <Text style={[styles.savedAddressesTitle, isRTL && styles.rtlText]}>
                {t('address.quickStart')}
              </Text>
            </View>
            <Text style={[styles.savedAddressesSubtitle, isRTL && styles.rtlText]}>
              {t('address.copyFromSavedAddress')}
            </Text>
            
            <TouchableOpacity
              style={[styles.viewSavedAddressesButton, isRTL && styles.rtlViewSavedAddressesButton]}
              onPress={() => setShowSavedAddresses(true)}
            >
              <Icon name="copy-outline" size={18} color="#007AFF" />
              <Text style={[styles.viewSavedAddressesText, isRTL && styles.rtlText]}>
                {t('address.viewSavedAddresses')} ({savedAddresses.length})
              </Text>
              <Icon name={isRTL ? "chevron-back" : "chevron-forward"} size={16} color="#007AFF" />
            </TouchableOpacity>
            
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={[styles.orText, isRTL && styles.rtlText]}>
                {t('common.or')}
              </Text>
              <View style={styles.orLine} />
            </View>
          </View>
        )}

        {/* GPS Toggle */}
        <TouchableOpacity
          style={[
            styles.gpsToggle, 
            useGPS && styles.gpsToggleActive
          ]}
          onPress={() => {
            if (useGPS) {
              setUseGPS(false);
              setCurrentLocation(null);
              setMapLocation(null);
            } else {
              getCurrentLocation();
            }
          }}
        >
          <View style={[styles.gpsToggleContent, isRTL && styles.rtlGpsToggleContent]}>
            <Icon 
              name={useGPS ? "location" : "location-outline"} 
              size={24} 
              color={useGPS ? "#fff" : "#007AFF"} 
            />
            <Text style={[
              styles.gpsToggleText, 
              useGPS && styles.gpsToggleTextActive,
              isRTL && styles.rtlText
            ]}>
              {gpsLoading ? t('address.detectingLocation') : 
               useGPS ? t('address.usingGPSLocation') : t('address.useCurrentLocation')}
            </Text>
            {gpsLoading && <ActivityIndicator size="small" color={useGPS ? "#fff" : "#007AFF"} />}
          </View>
        </TouchableOpacity>

        {/* Map Picker Button */}
        <TouchableOpacity
          style={[styles.mapPickerButton]}
          onPress={openMapPicker}
        >
          <View style={[styles.mapPickerContent, isRTL && styles.rtlMapPickerContent]}>
            <Icon 
              name="map-outline" 
              size={24} 
              color="#007AFF" 
            />
            <Text style={[
              styles.mapPickerText,
              isRTL && styles.rtlText
            ]}>
              {mapLocation ? t('address.locationSelectedFromMap') : t('address.selectFromMap')}
            </Text>
            {gpsLoading && <ActivityIndicator size="small" color="#007AFF" />}
          </View>
        </TouchableOpacity>

        {/* Current Location Display */}
        {(currentLocation || mapLocation) && (
          <View style={[styles.locationDisplay, isRTL && styles.rtlLocationDisplay]}>
            <Icon name="location" size={16} color="#10B981" />
            <Text style={[styles.locationText, isRTL && styles.rtlText]}>
              {t('address.selectedLocation')}: {formatCoordinates((currentLocation || mapLocation)?.latitude, (currentLocation || mapLocation)?.longitude)}
            </Text>
          </View>
        )}

        {/* Address Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isRTL && styles.rtlText]}>
            {t('address.addressName')}
          </Text>
          <TextInput
            style={[
              styles.textInput, 
              isRTL && styles.rtlTextInput
            ]}
            placeholder={t('address.addressNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isRTL && styles.rtlText]}>
            {t('address.phoneNumber')}
          </Text>
          <TextInput
            style={[
              styles.textInput, 
              isRTL && styles.rtlTextInput
            ]}
            placeholder={t('address.phoneNumberPlaceholder')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          {isEditing && !phone && (
            <Text style={[styles.helperText, styles.phoneHelperText, isRTL && styles.rtlText]}>
              💡 Phone number is required for delivery
            </Text>
          )}
        </View>

        {/* Location Selectors - Optional when using GPS */}
        {!useGPS && (
          <>
            {renderLocationSelector(
              t('address.city'),
              selectedCity,
              () => setShowCityModal(true),
              loadingCities
            )}

            {renderLocationSelector(
              t('address.area'),
              selectedArea,
              () => {
                if (!selectedCity) {
                  Alert.alert(t('common.error'), t('address.selectCityFirst'));
                  return;
                }
                setShowAreaModal(true);
              },
              loadingAreas
            )}

            {selectedArea && (
              <View style={styles.deliveryFeeContainer}>
                <Text style={[styles.deliveryFeeText, isRTL && styles.rtlText]}>
                  {t('checkout.deliveryFee')}: ${(Number(selectedArea.delivery_fee) || 0).toFixed(2)}
                </Text>
              </View>
            )}

            {renderLocationSelector(
              `${t('address.street')}`,
              selectedStreet,
              () => {
                if (!selectedArea) {
                  Alert.alert(t('common.error'), t('address.selectAreaFirst'));
                  return;
                }
                setShowStreetModal(true);
              },
              loadingStreets
            )}

            {/* Manual street input fallback */}
            {(streetsUnavailable || streets.length === 0) && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.rtlText]}>
                  {t('address.street')} ({t('common.optional')})
                </Text>
                <TextInput
                  style={[styles.textInput, isRTL && styles.rtlTextInput]}
                  placeholder={t('address.street')}
                  value={manualStreet}
                  onChangeText={setManualStreet}
                  autoCapitalize="words"
                />
                <Text style={[styles.helperText, isRTL && styles.rtlText]}>
                  {t('address.selectAreaFirst')}: {t('address.street')} {t('common.optional')}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Optional location selectors when using GPS */}
        {useGPS && currentLocation && (
          <View style={styles.gpsLocationContainer}>
            <View style={[styles.gpsLocationInfo, isRTL && styles.rtlGpsLocationInfo]}>
              <Icon name="location" size={20} color="#28a745" />
              <View style={styles.gpsLocationTextContainer}>
                <Text style={[styles.gpsLocationText, isRTL && styles.rtlText]}>
                  {t('address.usingGPSLocationInfo')}
                </Text>
                <Text style={[styles.coordinatesText, isRTL && styles.rtlText]}>
                  📍 {formatCoordinates(currentLocation?.latitude, currentLocation?.longitude)}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.changeLocationButton, isRTL && styles.rtlChangeLocationButton]}
              onPress={handleOpenMapModal}
            >
              <Icon name="location-outline" size={16} color="#007AFF" />
              <Text style={[styles.changeLocationText, isRTL && styles.rtlText]}>
                {t('address.changeLocation')}
              </Text>
            </TouchableOpacity>
          </View>
        )}



        {/* Building Details */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isRTL && styles.rtlText]}>
            {t('address.buildingNumber')}
          </Text>
          <TextInput
            style={[
              styles.textInput, 
              isRTL && styles.rtlTextInput
            ]}
            placeholder={t('address.buildingNumberPlaceholder')}
            value={buildingNo}
            onChangeText={setBuildingNo}
          />
        </View>

        <View style={[styles.row, isRTL && styles.rtlRow]}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={[styles.label, isRTL && styles.rtlText]}>
              {t('address.floor')}
            </Text>
            <TextInput
              style={[styles.textInput, isRTL && styles.rtlTextInput]}
              placeholder={t('address.floorPlaceholder')}
              value={floorNo}
              onChangeText={setFloorNo}
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={[styles.label, isRTL && styles.rtlText]}>
              {t('address.apartment')}
            </Text>
            <TextInput
              style={[styles.textInput, isRTL && styles.rtlTextInput]}
              placeholder={t('address.apartmentPlaceholder')}
              value={apartmentNo}
              onChangeText={setApartmentNo}
            />
          </View>
        </View>

        {/* Additional Details */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isRTL && styles.rtlText]}>
            {t('address.additionalDetails')}
          </Text>
          <TextInput
            style={[styles.textAreaInput, isRTL && styles.rtlTextInput]}
            placeholder={t('address.additionalDetailsPlaceholder')}
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={[styles.helperText, isRTL && styles.rtlText]}>
            {t('address.buildingOrDetailsHelper')}
          </Text>
        </View>

        {/* Default Address Toggle */}
        <TouchableOpacity
          style={[styles.defaultToggle, isRTL && styles.rtlDefaultToggle]}
          onPress={() => setIsDefault(!isDefault)}
        >
          <View style={[styles.defaultToggleContent, isRTL && styles.rtlDefaultToggleContent]}>
            <Text style={[styles.defaultToggleText, isRTL && styles.rtlText]}>
              {t('address.setAsDefault')}
            </Text>
            <View style={[styles.checkbox, isDefault && styles.checkedCheckbox]}>
              {isDefault && <Icon name="checkmark" size={16} color="#fff" />}
            </View>
          </View>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      {renderModal(
        showCityModal,
        () => setShowCityModal(false),
        t('address.selectCity'),
        cities,
        onCitySelect,
        loadingCities,
        cityQuery,
        setCityQuery,
        t('common.search') + ' ' + t('address.city')
      )}

      {renderModal(
        showAreaModal,
        () => setShowAreaModal(false),
        t('address.selectArea'),
        areas,
        onAreaSelect,
        loadingAreas,
        areaQuery,
        setAreaQuery,
        t('common.search') + ' ' + t('address.area')
      )}

      {renderModal(
        showStreetModal,
        () => setShowStreetModal(false),
        t('address.selectStreet'),
        streets,
        onStreetSelect,
        loadingStreets,
        streetQuery,
        setStreetQuery,
        t('common.search') + ' ' + t('address.street')
      )}

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setMapError(null);
          setShowMapModal(false);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modalHeader, isRTL && styles.rtlModalHeader]}>
            <TouchableOpacity
              onPress={() => setShowMapModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('address.selectLocationFromMap')}
            </Text>
            <TouchableOpacity
              onPress={confirmMapLocation}
              style={[styles.modalConfirmButton, !mapLocation && { opacity: 0.5 }]}
              disabled={!mapLocation}
            >
              <Text style={styles.modalConfirmText}>{t('common.confirm')}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Map Search */}
          <View style={styles.mapSearchContainer}>
            <View style={[styles.mapSearchInputContainer, isRTL && styles.rtlMapSearchInputContainer]}>
              <Icon name="search" size={20} color="#666" style={[styles.mapSearchIcon, isRTL && styles.rtlMapSearchIcon]} />
              <TextInput
                style={[styles.mapSearchInput, isRTL && styles.rtlTextInput]}
                placeholder={t('address.searchPlaces') || 'Search places...'}
                value={mapSearchQuery}
                onChangeText={(text) => {
                  setMapSearchQuery(text);
                  searchPlaces(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {mapSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setMapSearchQuery('');
                    setMapSearchResults([]);
                  }}
                  style={[styles.mapSearchClearButton, isRTL && styles.rtlMapSearchClearButton]}
                >
                  <Icon name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Search Results */}
            {mapSearchResults.length > 0 && (
              <View style={styles.mapSearchResults}>
                <ScrollView style={styles.mapSearchResultsList} keyboardShouldPersistTaps="handled">
                  {mapSearchResults.map((result) => (
                    <TouchableOpacity
                      key={result.place}
                      style={[styles.mapSearchResultItem, isRTL && styles.rtlMapSearchResultItem]}
                      onPress={() => selectSearchResult(result)}
                    >
                      <Icon name="location" size={16} color="#007AFF" />
                      <Text style={[styles.mapSearchResultText, isRTL && styles.rtlMapSearchResultText]} numberOfLines={2}>
                        {result.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {isSearchingMap && (
              <View style={[styles.mapSearchLoading, isRTL && styles.rtlMapSearchLoading]}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={[styles.mapSearchLoadingText, isRTL && styles.rtlText]}>{t('common.searching')}</Text>
              </View>
            )}
          </View>
          
          {/* WebView Map */}
          <WebView
            style={styles.map}
            source={{
              html: `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .leaflet-control-attribution { display: none !important; }
    </style>
</head>
<body>
    <div id="map"></div>
    
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Initialize map
        var map = L.map('map').setView([${mapRegion.latitude}, ${mapRegion.longitude}], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Current marker
        var marker = null;
        
        // Set initial marker if location exists
        ${mapLocation ? `
        marker = L.marker([${mapLocation.latitude}, ${mapLocation.longitude}]).addTo(map);
        ` : ''}
        
        // Handle map clicks
        map.on('click', function(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            
            // Remove existing marker
            if (marker) {
                map.removeLayer(marker);
            }
            
            // Add new marker
            marker = L.marker([lat, lng]).addTo(map);
            
            // Send coordinates to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_selected',
                latitude: lat,
                longitude: lng
            }));
            
            console.log('Selected:', lat, lng);
        });
        
        // Handle messages from React Native
        window.addEventListener('message', function(event) {
            try {
                var data = JSON.parse(event.data);
                
                if (data.type === 'set_location') {
                    // Remove existing marker
                    if (marker) {
                        map.removeLayer(marker);
                    }
                    
                    // Add marker at specified location
                    marker = L.marker([data.latitude, data.longitude]).addTo(map);
                    map.setView([data.latitude, data.longitude], 15);
                }
                
                if (data.type === 'center_map') {
                    map.setView([data.latitude, data.longitude], data.zoom || 13);
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
        
        console.log('Map initialized successfully');
    </script>
</body>
</html>
              `
            }}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                console.log('📍 Received from map:', data);
                
                if (data.type === 'location_selected') {
                  console.log('📍 Location selected:', data.latitude, data.longitude);
                  setMapLocation({
                    latitude: data.latitude,
                    longitude: data.longitude
                  });
                }
              } catch (error) {
                console.error('❌ Error parsing map message:', error);
              }
            }}
            onError={(error) => {
              console.error('❌ WebView error:', error);
            }}
            onLoadEnd={() => {
              console.log('📍 Map loaded successfully');
              // If we have a current location, center the map on it
              if (currentLocation && webViewRef.current) {
                webViewRef.current.postMessage(JSON.stringify({
                  type: 'center_map',
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  zoom: 15
                }));
              }
            }}
            ref={webViewRef}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={{ marginTop: 10, color: '#666' }}>Loading map...</Text>
              </View>
            )}
          />

          {/* Loading overlay for map location selection */}
          {isLoadingMapLocation && (
            <View style={styles.mapLoadingOverlay}>
              <View style={styles.mapLoadingContent}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.mapLoadingText}>{t('address.loadingLocation') || 'Loading location...'}</Text>
              </View>
            </View>
          )}

          {mapError && (
            <View style={styles.mapErrorContainer}>
              <Icon name="warning" size={48} color="#ff6b6b" />
              <Text style={styles.mapErrorText}>{mapError}</Text>
              <TouchableOpacity
                style={styles.mapErrorButton}
                onPress={() => {
                  setMapError(null);
                  setShowMapModal(false);
                }}
              >
                <Text style={styles.mapErrorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.mapInstructions}>
            <Text style={[styles.mapInstructionsText, isRTL && styles.rtlText]}>
              {t('address.tapToSelectLocation')}
            </Text>
            {mapLocation && (
              <Text style={[styles.coordinatesText, isRTL && styles.rtlText]}>
                {formatCoordinates(mapLocation.latitude, mapLocation.longitude)}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Saved Addresses Modal */}
      <Modal
        visible={showSavedAddresses}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, isRTL && styles.rtlContainer]}>
          <View style={[styles.modalHeader, isRTL && styles.rtlHeader]}>
            <TouchableOpacity onPress={() => setShowSavedAddresses(false)}>
              <Icon 
                name={isRTL ? "chevron-forward" : "chevron-back"} 
                size={24} 
                color="#007AFF" 
              />
            </TouchableOpacity>
            
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {t('address.savedAddresses')}
            </Text>
            
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {savedAddresses.map((address, index) => (
              <TouchableOpacity
                key={address.id}
                style={styles.savedAddressItem}
                onPress={() => copyFromSavedAddress(address)}
              >
                <View style={styles.savedAddressMain}>
                  <View style={styles.savedAddressHeader}>
                    <Text style={[styles.savedAddressName, isRTL && styles.rtlText]}>
                      {address.name}
                    </Text>
                    {address.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>
                          {t('address.default')}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[styles.savedAddressDetails, isRTL && styles.rtlText]}>
                    {[
                      address.building_no && `${t('address.building')} ${address.building_no}`,
                      address.details
                    ].filter(Boolean).join(' • ')}
                  </Text>
                  
                  <View style={styles.savedAddressLocation}>
                    {address.latitude != null && address.longitude != null && 
                     typeof address.latitude === 'number' && typeof address.longitude === 'number' ? (
                      <>
                        <Icon name="location" size={14} color="#28a745" />
                        <Text style={[styles.savedAddressGPS, isRTL && styles.rtlText]}>
                          {t('address.gpsAvailable')}
                        </Text>
                        <Text style={[styles.savedAddressCoords, isRTL && styles.rtlText]}>
                          {formatCoordinates(address.latitude, address.longitude, 4)}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Icon name="location-outline" size={14} color="#ff9500" />
                        <Text style={[styles.savedAddressNoGPS, isRTL && styles.rtlText]}>
                          {t('address.traditionalAddress')}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                
                <Icon name="copy-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            ))}
            
            {savedAddresses.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="location-outline" size={48} color="#ccc" />
                <Text style={[styles.emptyStateText, isRTL && styles.rtlText]}>
                  {t('address.noSavedAddresses')}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1c1e',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  halfWidth: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 10,
    letterSpacing: 0.2,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#e5e5e7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1c1c1e',
    textAlign: 'left',
    writingDirection: 'ltr',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  rtlTextInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1c1c1e',
    minHeight: Platform.OS === 'ios' ? 100 : 80,
    textAlignVertical: 'top',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
      },
    }),
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    backgroundColor: '#fff',
    minHeight: Platform.OS === 'ios' ? 50 : 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
      },
    }),
  },
  rtlSelector: {
    flexDirection: 'row-reverse',
  },
  selectorText: {
    fontSize: 16,
    color: '#1c1c1e',
    flex: 1,
  },
  placeholderText: {
    color: '#8e8e93',
  },
  deliveryFeeContainer: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#28a745',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  deliveryFeeText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    letterSpacing: Platform.OS === 'ios' ? 0.1 : 0,
  },
  defaultToggle: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
      },
    }),
  },
  rtlDefaultToggle: {
    alignItems: 'flex-start',
  },
  defaultToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  rtlDefaultToggleContent: {
    flexDirection: 'row-reverse',
  },
  defaultToggleText: {
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '500',
    letterSpacing: Platform.OS === 'ios' ? 0.1 : 0,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: '#d1d1d6',
    borderRadius: Platform.OS === 'ios' ? 6 : 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkedCheckbox: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  
  // GPS Styles
  gpsToggle: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e5e5e7',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  gpsToggleActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gpsToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 24,
  },
  rtlGpsToggleContent: {
    flexDirection: 'row-reverse',
  },
  gpsToggleText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    letterSpacing: Platform.OS === 'ios' ? 0.2 : 0,
  },
  gpsToggleTextActive: {
    color: '#fff',
  },
  gpsLocationContainer: {
    marginBottom: 15,
  },
  gpsLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  rtlGpsLocationInfo: {
    flexDirection: 'row-reverse',
  },
  gpsLocationTextContainer: {
    flex: 1,
  },
  gpsLocationText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  rtlChangeLocationButton: {
    flexDirection: 'row-reverse',
  },
  changeLocationText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  
  // Map Picker Styles
  mapPickerButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#d1d1d6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mapPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 24,
  },
  rtlMapPickerContent: {
    flexDirection: 'row-reverse',
  },
  mapPickerText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    letterSpacing: Platform.OS === 'ios' ? 0.2 : 0,
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  rtlLocationDisplay: {
    flexDirection: 'row-reverse',
  },
  locationText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    flex: 1,
    letterSpacing: Platform.OS === 'ios' ? 0.1 : 0,
  },
  
  optionalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 15,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c6c6c8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  rtlModalHeader: {
    flexDirection: 'row-reverse',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    color: '#1c1c1e',
    letterSpacing: Platform.OS === 'ios' ? 0.3 : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
  },
  modalContent: {
    flex: 1,
  },
  modalSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c6c6c8',
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    backgroundColor: '#f2f2f7',
    color: '#1c1c1e',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
    minHeight: Platform.OS === 'ios' ? 50 : 44,
  },
  rtlModalItem: {
    flexDirection: 'row-reverse',
  },
  modalItemText: {
    fontSize: 16,
    color: '#1c1c1e',
    flex: 1,
    letterSpacing: Platform.OS === 'ios' ? 0.1 : 0,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: '#888',
  },
  phoneHelperText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  // Error states
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  selectorError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  gpsToggleError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  rtlErrorContainer: {
    flexDirection: 'row-reverse',
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginLeft: 6,
    flex: 1,
  },
  rtlErrorText: {
    marginLeft: 0,
    marginRight: 6,
  },
  // Validation Summary
  validationSummary: {
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 20,
    padding: 16,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rtlValidationHeader: {
    flexDirection: 'row-reverse',
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc3545',
    marginLeft: 8,
  },
  rtlValidationTitle: {
    marginLeft: 0,
    marginRight: 8,
  },
  validationList: {
    gap: 8,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rtlValidationItem: {
    flexDirection: 'row-reverse',
  },
  validationItemText: {
    fontSize: 12,
    color: '#dc3545',
    flex: 1,
    lineHeight: 16,
  },
  // Success Summary
  successSummary: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 20,
    padding: 16,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlSuccessHeader: {
    flexDirection: 'row-reverse',
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 8,
  },
  rtlSuccessTitle: {
    marginLeft: 0,
    marginRight: 8,
  },
  successText: {
    fontSize: 12,
    color: '#059669',
    lineHeight: 16,
  },
  
  // Map Modal Styles
  map: {
    flex: 1,
    minHeight: 400,
    backgroundColor: '#f8f9fa',
    borderRadius: 0,
  },
  mapInstructions: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  mapInstructionsText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Saved Addresses Section Styles
  savedAddressesSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  savedAddressesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rtlSavedAddressesHeader: {
    flexDirection: 'row-reverse',
  },
  savedAddressesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  savedAddressesSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  viewSavedAddressesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 10,
  },
  rtlViewSavedAddressesButton: {
    flexDirection: 'row-reverse',
  },
  viewSavedAddressesText: {
    flex: 1,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  orText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  
  // Saved Address Item Styles
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 12,
  },
  savedAddressMain: {
    flex: 1,
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  savedAddressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: '#ffd700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  savedAddressDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  savedAddressLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rtlSavedAddressLocation: {
    flexDirection: 'row-reverse',
  },
  savedAddressGPS: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '500',
  },
  savedAddressNoGPS: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '500',
  },
  savedAddressCoords: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },

  // Map Search Styles
  mapSearchContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mapSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rtlMapSearchInputContainer: {
    flexDirection: 'row-reverse',
  },
  mapSearchIcon: {
    marginRight: 8,
  },
  rtlMapSearchIcon: {
    marginRight: 0,
    marginLeft: 8,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  mapSearchClearButton: {
    marginLeft: 8,
  },
  rtlMapSearchClearButton: {
    marginLeft: 0,
    marginRight: 8,
  },
  mapSearchResults: {
    backgroundColor: '#fff',
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  mapSearchResultsList: {
    maxHeight: 200,
  },
  mapSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  rtlMapSearchResultItem: {
    flexDirection: 'row-reverse',
  },
  mapSearchResultText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  rtlMapSearchResultText: {
    marginLeft: 0,
    marginRight: 8,
  },
  mapSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  rtlMapSearchLoading: {
    flexDirection: 'row-reverse',
  },
  mapSearchLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },

  // Map Loading Overlay Styles
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  mapLoadingContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  // Map Error Styles
  mapErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  mapErrorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginVertical: 16,
    marginHorizontal: 20,
    lineHeight: 24,
  },
  mapErrorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  mapErrorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Location Picker Styles
  locationOption: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  locationOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  locationOptionText: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationOptionCoords: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  locationSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 4,
  },
  customCoordsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  coordInputContainer: {
    marginBottom: 12,
  },
  coordLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  coordInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  selectedLocationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  selectedLocationText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default AddressFormScreen;
