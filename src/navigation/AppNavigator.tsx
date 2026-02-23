import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { NavigationContainer, NavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { ActivityIndicator, View, StyleSheet, Text, I18nManager, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '../theme/colors';
import { Spacing } from '../theme';
import notificationService from '../services/notificationService';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import CartScreen from '../screens/CartScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import SearchScreen from '../screens/SearchScreen';
import ProductsScreen from '../screens/ProductsScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import AddressFormScreen from '../screens/AddressFormScreen';
import GuestMapSelectionScreen from '../screens/GuestMapSelectionScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import LoyaltyPointsScreen from '../screens/LoyaltyPointsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import AddressBookScreen from '../screens/AddressBookScreen';
import AuthNavigator from './AuthNavigator';
import NotificationTestScreen from '../screens/NotificationTestScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SupportTicketsScreen from '../screens/SupportTicketsScreen';
import CreateTicketScreen from '../screens/CreateTicketScreen';
import TicketDetailsScreen from '../screens/TicketDetailsScreen';
import AboutScreen from '../screens/AboutScreen';
import OffersScreen from '../screens/OffersScreen';

// Create navigators
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type TabScreenIconProps = {
  focused: boolean;
  color: string;
  size: number;
};

type TabScreenConfig = {
  name: string;
  component: React.ComponentType<any>;
  labelKey: string;
  icon: ({ color, size, focused }: TabScreenIconProps) => React.ReactNode;
};

// Self-contained notification button — reads context itself so badge always stays in sync
const HomeNotificationButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { unreadCount } = useNotification();
  return (
    <TouchableOpacity style={styles.homeNotificationButton} onPress={onPress}>
      <Icon name="notifications-outline" size={18} color={Colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.homeNotificationBadge}>
          <Text style={styles.homeNotificationBadgeText}>
            {unreadCount > 99 ? '99+' : unreadCount.toString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Self-contained header title — renders translated text directly
const HomeHeaderTitle: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const isArabic = currentLanguage === 'ar';
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 }}>
      <Text 
        style={[
          styles.homeHeaderTitle,
          isArabic && { textAlign: 'right', writingDirection: 'rtl' }
        ]} 
        numberOfLines={1}
      >
        {t('navigation.home')}
      </Text>
    </View>
  );
};

// Self-contained header logo — switches between arabic/english
const HomeHeaderLogo: React.FC = () => {
  const { currentLanguage } = useLanguage();
  return (
    <View style={styles.homeLogoContainer}>
      <Image
        source={currentLanguage === 'ar'
          ? require('../assets/logo-arabic.png')
          : require('../assets/logo.png')
        }
        style={styles.homeLogo}
        resizeMode="contain"
      />
    </View>
  );
};

// Self-contained clear cart button for CartStack header
const CartClearButton: React.FC = () => {
  const { t } = useTranslation();
  const { items, clearCart } = useCart();
  
  if (items.length === 0) {
    return null;
  }
  
  const handleClearCart = () => {
    Alert.alert(
      t('cart.clearCart'),
      t('cart.clearCartConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => clearCart(),
        },
      ],
      { cancelable: true }
    );
  };
  
  return (
    <TouchableOpacity 
      onPress={handleClearCart}
      disabled={false}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.cartClearButton}
    >
      <Text style={styles.cartClearButtonText}>
        {t('cart.clearCart')}
      </Text>
    </TouchableOpacity>
  );
};

// Stack navigator for each tab
const HomeStack = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
        options={({ navigation }) => ({
          headerTitle: () => <HomeHeaderTitle />,
          headerLeft: () => <HomeHeaderLogo />,
          headerRight: () => <HomeNotificationButton onPress={() => navigation.navigate('Notifications')} />,
          headerStyle: {
            backgroundColor: Colors.backgroundCard,
            borderBottomWidth: 1,
            borderBottomColor: Colors.borderLight,
          },
        })}
      />
      <Stack.Screen 
        name="ProductDetails" 
        component={ProductDetailsScreen} 
        options={{ 
          title: t('products.productDetails'),
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ title: t('common.search') }}
      />
      <Stack.Screen 
        name="Products" 
        component={ProductsScreen} 
        options={{ 
          title: t('products.products'),
          headerShown: false
        }}
      />
      <Stack.Screen
        name="Offers"
        component={OffersScreen}
        options={{ title: t('offers.title', 'Exclusive offers') }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: t('orders.orderDetails') }}
      />
      <Stack.Screen 
        name="CreateTicket" 
        component={CreateTicketScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const CategoriesStack = () => {
  const { t } = useTranslation();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="CategoriesMain" 
        component={CategoriesScreen} 
        options={{ title: t('navigation.categories') }}
      />
      <Stack.Screen 
        name="CategoryProducts" 
        component={ProductsScreen} 
        options={({ route }) => ({ 
          title: (route.params as any)?.categoryName || t('products.products'),
          headerShown: false
        })}
      />
      <Stack.Screen 
        name="ProductDetails" 
        component={ProductDetailsScreen} 
        options={{ 
          title: t('products.productDetails'),
          headerShown: false
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: t('orders.orderDetails') }}
      />
      <Stack.Screen 
        name="CreateTicket" 
        component={CreateTicketScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const CartStack = () => {
  const { t } = useTranslation();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="CartMain" 
        component={CartScreen} 
        options={{ 
          title: t('navigation.cart'),
          headerRight: () => <CartClearButton />
        }}
      />
      <Stack.Screen 
        name="Checkout" 
        component={CheckoutScreen} 
        options={{ title: t('checkout.title') }}
      />
      <Stack.Screen 
        name="AddressForm" 
        component={AddressFormScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="GuestMapSelection" 
        component={GuestMapSelectionScreen} 
        options={{ title: 'Select Location' }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: t('orders.orderDetails') }}
      />
      <Stack.Screen 
        name="CreateTicket" 
        component={CreateTicketScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const OrdersStack = () => {
  const { t } = useTranslation();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="OrdersMain" 
        component={OrdersScreen} 
        options={{ title: t('orders.title') }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: t('orders.orderDetails') }}
      />
      <Stack.Screen 
        name="CreateTicket" 
        component={CreateTicketScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="SupportTickets" 
        component={SupportTicketsScreen} 
        options={{ title: 'Support Tickets' }}
      />
      <Stack.Screen 
        name="TicketDetails" 
        component={TicketDetailsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const { t } = useTranslation();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{ title: t('profile.title') }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ title: t('profile.editProfile') }}
      />
      <Stack.Screen 
        name="LoyaltyPoints" 
        component={LoyaltyPointsScreen} 
        options={{ title: t('profile.loyaltyPoints') }}
      />
      <Stack.Screen 
        name="ChangePassword" 
        component={ChangePasswordScreen} 
        options={{ title: t('profile.changePassword') }}
      />
      <Stack.Screen 
        name="AddressBook" 
        component={AddressBookScreen} 
        options={{ title: t('profile.addressBook') }}
      />
      <Stack.Screen 
        name="AddressForm" 
        component={AddressFormScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: t('settings.title') }}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen} 
        options={{ title: 'About' }}
      />
      <Stack.Screen 
        name="NotificationTest" 
        component={NotificationTestScreen} 
        options={{ title: 'Notification Test' }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="OrderDetails" 
        component={OrderDetailsScreen} 
        options={{ title: t('orders.orderDetails') }}
      />
      <Stack.Screen 
        name="SupportTickets" 
        component={SupportTicketsScreen} 
        options={{ title: 'Support Tickets' }}
      />
      <Stack.Screen 
        name="CreateTicket" 
        component={CreateTicketScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="TicketDetails" 
        component={TicketDetailsScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

// Custom cart icon with badge component (moved outside to avoid hook violations)
const CartIcon = ({ color, size, itemCount }: { color: string; size: number; itemCount: number }) => (
  <View style={styles.cartIconContainer}>
    <Icon name="basket" color={color} size={size} />
    {itemCount > 0 && (
      <View style={styles.cartBadge}>
        <Text style={styles.cartBadgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
      </View>
    )}
  </View>
);

// Main bottom tab navigator
interface AppNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<any>>;
}

const AppNavigator: React.FC<AppNavigatorProps> = ({ navigationRef: externalNavRef }) => {
  const { t } = useTranslation();
  const { currentLanguage, isLanguageLoaded } = useLanguage();
  const isRTL = false; // Override to force LTR
  const { isAuthenticated, isLoading, isGuest, pendingProfileCompletion, setPendingProfileCompletion } = useAuth();
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();
  const internalNavRef = useRef<NavigationContainerRef<any>>(null);

  // Combine internal and external refs; also keep notificationService in sync
  const setNavRef = useCallback((ref: NavigationContainerRef<any> | null) => {
    (internalNavRef as any).current = ref;
    if (externalNavRef && 'current' in externalNavRef) {
      (externalNavRef as any).current = ref;
    }
    // Always inform the notification service of the current navigation ref so
    // deep-links from push notifications work even after the container is
    // recreated (e.g. on language change).
    notificationService.setNavigationRef(ref);
  }, [externalNavRef]);

  // Handle pending profile completion navigation after Tab.Navigator mounts
  useEffect(() => {
    if (isAuthenticated && pendingProfileCompletion && internalNavRef.current) {
      // Small delay to ensure navigation tree is fully ready
      const timeout = setTimeout(() => {
        if (internalNavRef.current) {
          internalNavRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: 'Profile',
                  state: {
                    routes: [
                      { name: 'ProfileMain' },
                      { name: 'EditProfile', params: { isFirstTime: true } },
                    ],
                    index: 1,
                  },
                },
              ],
            })
          );
          setPendingProfileCompletion(false);
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, pendingProfileCompletion, setPendingProfileCompletion]);

  const tabScreens = useMemo<TabScreenConfig[]>(
    () => [
      {
        name: 'Home',
        component: HomeStack,
        labelKey: 'navigation.home',
        icon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
      },
      {
        name: 'Cart',
        component: CartStack,
        labelKey: 'navigation.cart',
        icon: ({ color, size }) => <CartIcon color={color} size={size} itemCount={itemCount} />,
      },
      {
        name: 'Orders',
        component: OrdersStack,
        labelKey: 'navigation.orders',
        icon: ({ color, size }) => <Icon name="receipt" color={color} size={size} />,
      },
      {
        name: 'Profile',
        component: ProfileStack,
        labelKey: 'navigation.profile',
        icon: ({ color, size }) => <Icon name="person" color={color} size={size} />,
      },
    ],
    [itemCount]
  );

  const orderedTabScreens = useMemo(
    () => (isRTL ? [...tabScreens].reverse() : tabScreens),
    [isRTL, tabScreens]
  );

  // Show loading spinner while checking authentication OR loading language
  if (isLoading || !isLanguageLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log('[AppNavigator] Rendering with language:', currentLanguage, 'RTL:', isRTL);
  console.log('[AppNavigator] I18nManager.isRTL:', I18nManager.isRTL);

  return (
    <NavigationContainer 
      key={currentLanguage} 
      ref={setNavRef}
    >
      {(isAuthenticated || isGuest) ? (
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: {
              paddingBottom: 5 + insets.bottom,
              paddingTop: 5,
              height: 60 + insets.bottom,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
              writingDirection: isRTL ? 'rtl' : 'ltr',
              textAlign: 'center',
            },
            tabBarItemStyle: {
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          }}
        >
          {orderedTabScreens.map((screen) => (
            <Tab.Screen
              key={screen.name}
              name={screen.name}
              component={screen.component}
              options={{
                tabBarLabel: t(screen.labelKey),
                tabBarIcon: screen.icon,
              }}
            />
          ))}
        </Tab.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4757',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Home header styles
  homeHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  homeLogoContainer: {
    paddingLeft: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: { paddingVertical: 2 },
      ios: {},
    }),
  },
  homeLogo: {
    width: Platform.OS === 'android' ? 100 : 90,
    height: Platform.OS === 'android' ? 38 : 35,
  },
  homeNotificationButton: {
    position: 'relative',
    paddingRight: Spacing.md,
    paddingLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeNotificationBadge: {
    position: 'absolute',
    top: -6,
    right: Platform.OS === 'android' ? 2 : Spacing.xs,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1,
  },
  homeNotificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Cart header styles
  cartClearButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartClearButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppNavigator;
