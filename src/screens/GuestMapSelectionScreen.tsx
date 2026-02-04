import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { WebView } from 'react-native-webview';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface GuestMapSelectionScreenProps {
  navigation: any;
  route: {
    params?: {
      onLocationSelect?: (location: {
        latitude: number;
        longitude: number;
        address?: string;
      }) => void;
    };
  };
}

const GuestMapSelectionScreen: React.FC<GuestMapSelectionScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isRTL = currentLanguage === 'ar';
  const { onLocationSelect } = route.params || {};

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Default location (Amman, Jordan)
  const defaultLocation = {
    latitude: 31.9539,
    longitude: 35.9106
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .info-box {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          background: white;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
          text-align: center;
          font-family: Arial, sans-serif;
          font-size: 14px;
        }
        .search-box {
          position: absolute;
          top: 60px;
          left: 10px;
          right: 10px;
          background: white;
          padding: 8px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          z-index: 1000;
        }
        .search-box input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }
      </style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    </head>
    <body>
      <div class="info-box">
        ${isRTL ? 'اضغط على الخريطة لاختيار الموقع (الأردن)' : 'Tap on the map to select your location (Jordan)'}
      </div>
      <div class="search-box">
        <input 
          type="text" 
          id="searchInput" 
          placeholder="${isRTL ? 'ابحث في الأردن...' : 'Search in Jordan...'}"
          style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
        >
      </div>
      <div id="map"></div>
      
      <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      <script>
        let map;
        let marker;
        let selectedLat, selectedLng;

        // Initialize map - ALWAYS center on Jordan
        function initMap() {
          // Force Amman, Jordan as center with zoom level 13
          map = L.map('map').setView([31.9539, 35.9106], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          // Set max bounds to keep map focused on Middle East/Jordan region
          var southWest = L.latLng(15.0, 20.0); // Southwest corner (includes Egypt, Saudi Arabia)
          var northEast = L.latLng(40.0, 50.0); // Northeast corner
          var bounds = L.latLngBounds(southWest, northEast);
          map.setMaxBounds(bounds);
          map.fitBounds(bounds);

          // Add click handler
          map.on('click', function(e) {
            selectedLat = e.latlng.lat;
            selectedLng = e.latlng.lng;
            
            if (marker) {
              map.removeLayer(marker);
            }
            
            marker = L.marker([selectedLat, selectedLng]).addTo(map);
            
            // Send location to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationSelected',
              latitude: selectedLat,
              longitude: selectedLng
            }));
          });

          // Handle search
          document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              searchLocation(this.value);
            }
          });

          // Notify React Native that map is ready
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapReady'
          }));
        }

        function searchLocation(query) {
          if (!query.trim()) return;
          
          // Search only in Jordan (countrycodes=jo)
          fetch(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query + ' Jordan')}&countrycodes=jo&limit=1\`)
            .then(r => r.json())
            .then(results => {
              if (results.length > 0) {
                const result = results[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                // Center map on search result
                map.setView([lat, lng], 15);
                
                if (marker) {
                  map.removeLayer(marker);
                }
                marker = L.marker([lat, lng]).addTo(map);
                
                selectedLat = lat;
                selectedLng = lng;
                
                // Send location to React Native
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'locationSelected',
                  latitude: lat,
                  longitude: lng
                }));
              }
            })
            .catch(e => console.error('Search error:', e));
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initMap);
      </script>
    </body>
    </html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setIsMapReady(true);
      } else if (data.type === 'locationSelected') {
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude
        });
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleConfirmLocation = async () => {
    if (!selectedLocation) {
      Alert.alert(
        t('common.error'),
        'Please select a location on the map first.',
        [{ text: t('common.ok') }]
      );
      return;
    }

    setIsConfirming(true);

    try {
      // Try to get address from coordinates
      let addressString = `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`;
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}&addressdetails=1&accept-language=${isRTL ? 'ar' : 'en'}`
        );
        const data = await response.json();
        
        if (data && data.display_name) {
          addressString = data.display_name;
        }
      } catch (error) {
        console.log('Could not get address, using coordinates');
      }

      if (onLocationSelect) {
        onLocationSelect({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          address: addressString
        });
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error confirming location:', error);
      Alert.alert(
        t('common.error'),
        'Failed to confirm location. Please try again.',
        [{ text: t('common.ok') }]
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlHeader]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon 
            name={isRTL ? "chevron-forward" : "chevron-back"} 
            size={24} 
            color="#007AFF" 
          />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('address.selectLocation') || 'Select Location'}
        </Text>
        
        <View style={styles.headerSpacer} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          key={'guest-map-jordan'} // Force reload with key to ensure Jordan view
          source={{ html: mapHTML }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={false} // Disable storage to prevent cache
          cacheEnabled={false} // Disable cache
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>{t('map.loadingMap')}</Text>
            </View>
          )}
        />
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {selectedLocation && (
          <View style={[styles.selectedLocationInfo, isRTL && styles.rtlSelectedLocationInfo]}>
            <Icon name="location" size={20} color="#28a745" />
            <Text style={[styles.coordinatesText, isRTL && styles.rtlCoordinatesText]}>
              {`${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedLocation && styles.confirmButtonDisabled,
            isRTL && styles.rtlConfirmButton
          ]}
          onPress={handleConfirmLocation}
          disabled={!selectedLocation || isConfirming}
        >
          {isConfirming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="checkmark" size={20} color="#fff" />
              <Text style={[styles.confirmButtonText, isRTL && styles.rtlText]}>
                {t('common.confirm') || 'Confirm Location'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
  },
  headerSpacer: {
    width: 24,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  bottomControls: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  selectedLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  rtlSelectedLocationInfo: {
    flexDirection: 'row-reverse',
  },
  coordinatesText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
    flex: 1,
  },
  rtlCoordinatesText: {
    marginLeft: 0,
    marginRight: 8,
    textAlign: 'right',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    gap: 8,
  },
  rtlConfirmButton: {
    flexDirection: 'row-reverse',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default GuestMapSelectionScreen;