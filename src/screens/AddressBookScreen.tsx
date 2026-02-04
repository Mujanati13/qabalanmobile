import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
import apiService from '../services/apiService';

interface Address {
  id: number;
  name: string;
  phone: string;
  city_name?: string;
  area_name?: string;
  street_name?: string;
  building_no?: string;
  floor_no?: string;
  apartment_no?: string;
  details?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  is_active: boolean;
}

interface AddressBookScreenProps {
  navigation: any;
}

const AddressBookScreen: React.FC<AddressBookScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      console.log('📍 Loading addresses...');
      const response = await apiService.getUserAddresses();
      console.log('📍 Addresses response:', response);
      
      if (response.success) {
        setAddresses(response.data || []);
        console.log('📍 Loaded addresses:', response.data?.length || 0);
      } else {
        console.log('❌ Failed to load addresses:', response.message);
        setAddresses([]);
      }
    } catch (error) {
      console.error('❌ Error loading addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAddresses();
  };

  const handleSetDefault = async (addressId: number) => {
    try {
      const response = await apiService.setDefaultAddress(addressId);
      if (response.success) {
        loadAddresses(); // Reload to update default status
        Alert.alert(t('common.success'), t('address.defaultAddressSet'));
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error setting default address:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const handleDeleteAddress = (address: Address) => {
    Alert.alert(
      t('address.deleteAddress'),
      t('address.deleteConfirmation', { name: address.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteAddress(address.id),
        },
      ]
    );
  };

  const deleteAddress = async (addressId: number) => {
    try {
      const response = await apiService.deleteAddress(addressId);
      if (response.success) {
        loadAddresses(); // Reload addresses
        Alert.alert(t('common.success'), t('address.addressDeleted'));
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const formatAddress = (address: Address) => {
    const parts = [];
    
    if (address.building_no) parts.push(`${t('address.building')} ${address.building_no}`);
    if (address.floor_no) parts.push(`${t('address.floor')} ${address.floor_no}`);
    if (address.apartment_no) parts.push(`${t('address.apartment')} ${address.apartment_no}`);
    if (address.street_name) parts.push(address.street_name);
    if (address.area_name) parts.push(address.area_name);
    if (address.city_name) parts.push(address.city_name);
    if (address.details) parts.push(address.details);
    
    return parts.join(' • ');
  };

  const renderAddressItem = ({ item }: { item: Address }) => (
    <View style={styles.addressItem}>
      <View style={styles.addressHeader}>
        <View style={styles.addressTitleRow}>
          <Text style={styles.addressName}>{item.name}</Text>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>{t('address.default')}</Text>
            </View>
          )}
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddressForm', { address: item })}
          >
            <Icon name="pencil" size={16} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteAddress(item)}
          >
            <Icon name="trash" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.addressPhone}>{item.phone}</Text>
      
      <Text style={styles.addressDetails}>{formatAddress(item)}</Text>
      
      {item.latitude && item.longitude && (
        <View style={styles.gpsIndicator}>
          <Icon name="location" size={14} color="#28a745" />
          <Text style={styles.gpsText}>{t('address.gpsAvailable')}</Text>
        </View>
      )}
      
      {!item.is_default && (
        <TouchableOpacity
          style={styles.setDefaultButton}
          onPress={() => handleSetDefault(item.id)}
        >
          <Text style={styles.setDefaultText}>{t('address.setDefault')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t('address.loadingAddresses')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {addresses.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="location-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>{t('address.noAddresses')}</Text>
          <Text style={styles.emptyStateDescription}>
            {t('address.noAddressesDescription')}
          </Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => navigation.navigate('AddressForm')}
          >
            <Icon name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>{t('address.addNewAddress')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={addresses}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
          <TouchableOpacity 
            style={styles.floatingAddButton} 
            onPress={() => navigation.navigate('AddressForm')}
          >
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  addressItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  addressPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressDetails: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsText: {
    fontSize: 12,
    color: '#28a745',
    marginLeft: 4,
    fontWeight: '500',
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setDefaultText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AddressBookScreen;
