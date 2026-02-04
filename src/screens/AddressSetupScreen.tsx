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
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import MapView, { Marker, Region } from 'react-native-maps';
import { Colors, Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface AddressSetupScreenProps {
  navigation: any;
  route: {
    params?: {
      isFirstTime?: boolean;
      phone?: string;
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
  delivery_fee: string;
  is_active: boolean;
}

const AddressSetupScreen: React.FC<AddressSetupScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { refreshUser } = useAuth();
  const { isFirstTime = false, phone = '' } = route.params || {};

  // Form state
  const [name, setName] = useState('');
  const [addressPhone, setAddressPhone] = useState(phone);
  const [buildingNo, setBuildingNo] = useState('');
  const [details, setDetails] = useState('');
  
  // Location state
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  
  // GPS and Map state
  const [useGPS, setUseGPS] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 31.9454, // Amman coordinates
    longitude: 35.9284,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [areasLoading, setAreasLoading] = useState(false);

  useEffect(() => {
    loadCities();
  }, []);

  useEffect(() => {
    if (selectedCityId) {
      loadAreas(selectedCityId);
    } else {
      setAreas([]);
      setSelectedAreaId(null);
    }
  }, [selectedCityId]);

  const loadCities = async () => {
    try {
      setCitiesLoading(true);
      const response = await apiService.getCities();
      if (response.success && response.data) {
        setCities(response.data);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setCitiesLoading(false);
    }
  };

  const loadAreas = async (cityId: number) => {
    try {
      setAreasLoading(true);
      const response = await apiService.getAreas(cityId);
      if (response.success && response.data) {
        setAreas(response.data);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setAreasLoading(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: t('location.permissionTitle'),
            message: t('location.permissionMessage'),
            buttonNeutral: t('common.askLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else {
      try {
        const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return result === RESULTS.GRANTED;
      } catch (error) {
        console.warn(error);
        return false;
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocationLoading(true);
    
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsLocationLoading(false);
      Alert.alert(t('common.error'), t('location.permissionDenied'));
      return;
    }

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { latitude, longitude };
        
        setCurrentLocation(location);
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setUseGPS(true);
        setIsLocationLoading(false);
      },
      (error) => {
        console.error('Location error:', error);
        setIsLocationLoading(false);
        Alert.alert(t('common.error'), t('location.errorGettingLocation'));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const handleMapPress = (event: any) => {
    if (useGPS) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setCurrentLocation({ latitude, longitude });
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('address.nameRequired'));
      return false;
    }

    if (!addressPhone.trim()) {
      Alert.alert(t('common.error'), t('address.phoneRequired'));
      return false;
    }

    if (!useGPS && (!selectedCityId || !selectedAreaId)) {
      Alert.alert(t('common.error'), t('address.locationRequired'));
      return false;
    }

    if (useGPS && !currentLocation) {
      Alert.alert(t('common.error'), t('address.gpsLocationRequired'));
      return false;
    }

    return true;
  };

  const handleSaveAddress = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const addressData = {
        name: name.trim(),
        phone: addressPhone.trim(),
        building_no: buildingNo.trim() || '',
        details: details.trim() || '',
        is_default: true, // First address is always default
        ...(useGPS && currentLocation
          ? {
              // GPS-based address
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }
          : {
              // Traditional address
              city_id: selectedCityId!,
              area_id: selectedAreaId!,
            }
        ),
      };

      const response = await apiService.createAddress(addressData);

      if (response.success) {
        if (isFirstTime) {
          // Navigate to home after successful address setup
          await refreshUser();
          navigation.reset({
            index: 0,
            routes: [{ name: 'AuthWelcome' }],
          });
        } else {
          navigation.goBack();
        }
      } else {
        Alert.alert(t('common.error'), response.message || t('address.saveFailed'));
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert(t('common.error'), t('common.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (isFirstTime) {
      Alert.alert(
        t('address.skipTitle'),
        t('address.skipMessage'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('address.skipConfirm'),
            onPress: async () => {
              await refreshUser();
              navigation.reset({
                index: 0,
                routes: [{ name: 'AuthWelcome' }],
              });
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {!isFirstTime && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon 
              name={isRTL ? 'chevron-forward' : 'chevron-back'} 
              size={24} 
              color={Colors.textPrimary} 
            />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          {isFirstTime ? t('address.setupYourAddress') : t('address.addAddress')}
        </Text>
        {isFirstTime && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, isRTL && styles.textRTL]}>
              {t('common.skip')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Message for First Time */}
        {isFirstTime && (
          <View style={styles.welcomeContainer}>
            <Icon name="location" size={40} color={Colors.primary} />
            <Text style={[styles.welcomeTitle, isRTL && styles.textRTL]}>
              {t('address.welcomeTitle')}
            </Text>
            <Text style={[styles.welcomeDescription, isRTL && styles.textRTL]}>
              {t('address.welcomeDescription')}
            </Text>
          </View>
        )}

        {/* Location Method Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {t('address.howToSetLocation')}
          </Text>
          
          <View style={styles.locationOptions}>
            <TouchableOpacity
              style={[
                styles.locationOption,
                !useGPS && styles.locationOptionActive,
              ]}
              onPress={() => setUseGPS(false)}
            >
              <Icon 
                name="list" 
                size={24} 
                color={!useGPS ? Colors.primary : Colors.textSecondary} 
              />
              <Text style={[
                styles.locationOptionText,
                !useGPS && styles.locationOptionTextActive,
                isRTL && styles.textRTL,
              ]}>
                {t('address.selectFromList')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.locationOption,
                useGPS && styles.locationOptionActive,
              ]}
              onPress={() => setUseGPS(true)}
            >
              <Icon 
                name="location" 
                size={24} 
                color={useGPS ? Colors.primary : Colors.textSecondary} 
              />
              <Text style={[
                styles.locationOptionText,
                useGPS && styles.locationOptionTextActive,
                isRTL && styles.textRTL,
              ]}>
                {t('address.useGPS')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GPS Location */}
        {useGPS && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              {t('address.yourLocation')}
            </Text>
            
            {!currentLocation && (
              <TouchableOpacity
                style={styles.getCurrentLocationButton}
                onPress={handleUseCurrentLocation}
                disabled={isLocationLoading}
              >
                {isLocationLoading ? (
                  <ActivityIndicator color={Colors.textWhite} size="small" />
                ) : (
                  <>
                    <Icon name="navigate" size={20} color={Colors.textWhite} />
                    <Text style={[styles.getCurrentLocationText, isRTL && styles.textRTL]}>
                      {t('address.getCurrentLocation')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {currentLocation && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  region={mapRegion}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                >
                  <Marker
                    coordinate={currentLocation}
                    title={t('address.yourLocation')}
                    pinColor={Colors.primary}
                  />
                </MapView>
                <Text style={[styles.mapInfo, isRTL && styles.textRTL]}>
                  {t('address.tapToAdjustLocation')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Traditional Location Selection */}
        {!useGPS && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              {t('address.selectLocation')}
            </Text>

            {/* City Selection */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                {t('address.city')} *
              </Text>
              {citiesLoading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.optionsScroll}
                >
                  {cities.map((city) => (
                    <TouchableOpacity
                      key={city.id}
                      style={[
                        styles.optionChip,
                        selectedCityId === city.id && styles.optionChipSelected,
                      ]}
                      onPress={() => setSelectedCityId(city.id)}
                    >
                      <Text style={[
                        styles.optionChipText,
                        selectedCityId === city.id && styles.optionChipTextSelected,
                        isRTL && styles.textRTL,
                      ]}>
                        {currentLanguage === 'ar' ? city.title_ar : city.title_en}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Area Selection */}
            {selectedCityId && (
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
                  {t('address.area')} *
                </Text>
                {areasLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.optionsScroll}
                  >
                    {areas.map((area) => (
                      <TouchableOpacity
                        key={area.id}
                        style={[
                          styles.optionChip,
                          selectedAreaId === area.id && styles.optionChipSelected,
                        ]}
                        onPress={() => setSelectedAreaId(area.id)}
                      >
                        <Text style={[
                          styles.optionChipText,
                          selectedAreaId === area.id && styles.optionChipTextSelected,
                          isRTL && styles.textRTL,
                        ]}>
                          {currentLanguage === 'ar' ? area.title_ar : area.title_en}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}

        {/* Address Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {t('address.addressDetails')}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('address.addressName')} *
            </Text>
            <TextInput
              style={[styles.textInput, isRTL && styles.textInputRTL]}
              value={name}
              onChangeText={setName}
              placeholder={t('address.addressNamePlaceholder')}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('address.phone')} *
            </Text>
            <TextInput
              style={[styles.textInput, isRTL && styles.textInputRTL]}
              value={addressPhone}
              onChangeText={setAddressPhone}
              placeholder={t('address.phonePlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('address.buildingNumber')}
            </Text>
            <TextInput
              style={[styles.textInput, isRTL && styles.textInputRTL]}
              value={buildingNo}
              onChangeText={setBuildingNo}
              placeholder={t('address.buildingNumberPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, isRTL && styles.textRTL]}>
              {t('address.additionalDetails')}
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea, isRTL && styles.textInputRTL]}
              value={details}
              onChangeText={setDetails}
              placeholder={t('address.additionalDetailsPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isLoading && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveAddress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.textWhite} size="small" />
          ) : (
            <Text style={[styles.saveButtonText, isRTL && styles.textRTL]}>
              {isFirstTime ? t('address.completeSetup') : t('address.saveAddress')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundLight,
  },
  headerTitle: {
    ...Typography.heading.h3,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  skipButton: {
    padding: Spacing.sm,
  },
  skipText: {
    ...Typography.body.medium,
    color: Colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  welcomeContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginVertical: Spacing.lg,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
  },
  welcomeTitle: {
    ...Typography.heading.h3,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  welcomeDescription: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginVertical: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.heading.h4,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  locationOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  locationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  locationOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  locationOptionText: {
    ...Typography.body.medium,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  locationOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  getCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  ...Shadow.sm,
  },
  getCurrentLocationText: {
    ...Typography.body.medium,
    color: Colors.textWhite,
    marginLeft: Spacing.sm,
    fontWeight: '600',
  },
  mapContainer: {
    marginTop: Spacing.md,
  },
  map: {
    height: 200,
    borderRadius: BorderRadius.md,
  },
  mapInfo: {
    ...Typography.body.small,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  optionsScroll: {
    marginTop: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    marginRight: Spacing.sm,
  },
  optionChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  optionChipText: {
    ...Typography.body.small,
    color: Colors.textSecondary,
  },
  optionChipTextSelected: {
    color: Colors.textWhite,
    fontWeight: '600',
  },
  textInput: {
    ...Typography.body.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundCard,
    color: Colors.textPrimary,
  },
  textInputRTL: {
    textAlign: 'right',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  ...Shadow.md,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  saveButtonText: {
    ...Typography.body.medium,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  textRTL: {
    textAlign: 'right',
  },
});

export default AddressSetupScreen;