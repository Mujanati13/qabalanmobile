import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { Button, Card, SearchBar, Header } from '../components/common';

interface UIShowcaseScreenProps {
  navigation: any;
}

const UIShowcaseScreen: React.FC<UIShowcaseScreenProps> = ({ navigation }) => {
  const [searchValue, setSearchValue] = useState('');

  const mockProduct = {
    id: 1,
    name: 'Sample Product',
    main_image: 'https://via.placeholder.com/150x150?text=Product',
    base_price: 29.99,
    sale_price: 19.99,
    final_price: 19.99,
    is_featured: true,
    stock_status: 'in_stock',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="UI Showcase"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Color Palette Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Color Palette</Text>
          <View style={styles.colorGrid}>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.primary }]}>
              <Text style={styles.colorLabel}>Primary</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.secondary }]}>
              <Text style={styles.colorLabel}>Secondary</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.success }]}>
              <Text style={styles.colorLabel}>Success</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.warning }]}>
              <Text style={styles.colorLabel}>Warning</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.error }]}>
              <Text style={styles.colorLabel}>Error</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: Colors.accent }]}>
              <Text style={styles.colorLabel}>Accent</Text>
            </View>
          </View>
        </Card>

        {/* Typography Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Typography</Text>
          <Text style={[styles.heading1, { color: Colors.textPrimary }]}>
            Heading 1 - Large Title
          </Text>
          <Text style={[styles.heading2, { color: Colors.textPrimary }]}>
            Heading 2 - Medium Title
          </Text>
          <Text style={[styles.heading3, { color: Colors.textPrimary }]}>
            Heading 3 - Small Title
          </Text>
          <Text style={[styles.bodyText, { color: Colors.textPrimary }]}>
            Body text - This is regular paragraph text that would be used throughout the app.
          </Text>
          <Text style={[styles.captionText, { color: Colors.textSecondary }]}>
            Caption text - Smaller text for details and descriptions.
          </Text>
        </Card>

        {/* Search Bar Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Search Components</Text>
          <SearchBar
            placeholder="Search products..."
            value={searchValue}
            onChangeText={setSearchValue}
            style={styles.searchExample}
          />
          <SearchBar
            placeholder="Search with filter..."
            showFilterButton={true}
            onFilterPress={() => console.log('Filter pressed')}
            style={styles.searchExample}
          />
        </Card>

        {/* Button Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Buttons</Text>
          
          <View style={styles.buttonGroup}>
            <Button
              title="Primary Button"
              onPress={() => console.log('Primary pressed')}
              variant="primary"
              style={styles.buttonExample}
            />
            
            <Button
              title="Secondary Button"
              onPress={() => console.log('Secondary pressed')}
              variant="secondary"
              style={styles.buttonExample}
            />
            
            <Button
              title="Outline Button"
              onPress={() => console.log('Outline pressed')}
              variant="outline"
              style={styles.buttonExample}
            />
            
            <Button
              title="Text Button"
              onPress={() => console.log('Text pressed')}
              variant="text"
              style={styles.buttonExample}
            />
          </View>

          <View style={styles.buttonRow}>
            <Button
              title="Small"
              onPress={() => {}}
              size="small"
              style={styles.buttonSize}
            />
            <Button
              title="Medium"
              onPress={() => {}}
              size="medium"
              style={styles.buttonSize}
            />
            <Button
              title="Large"
              onPress={() => {}}
              size="large"
              style={styles.buttonSize}
            />
          </View>

          <Button
            title="Loading Button"
            onPress={() => {}}
            loading={true}
            style={styles.buttonExample}
          />
        </Card>

        {/* Cards Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Card Variations</Text>
          
          <Card style={styles.cardExample} elevation="sm">
            <Text style={styles.cardTitle}>Small Shadow Card</Text>
            <Text style={styles.cardContent}>This card has a small shadow elevation.</Text>
          </Card>

          <Card style={styles.cardExample} elevation="md">
            <Text style={styles.cardTitle}>Medium Shadow Card</Text>
            <Text style={styles.cardContent}>This card has a medium shadow elevation.</Text>
          </Card>

          <Card style={styles.cardExample} elevation="lg">
            <Text style={styles.cardTitle}>Large Shadow Card</Text>
            <Text style={styles.cardContent}>This card has a large shadow elevation.</Text>
          </Card>
        </Card>

        {/* Icons Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Icons & Colors</Text>
          <View style={styles.iconGrid}>
            <View style={styles.iconItem}>
              <Icon name="heart" size={24} color={Colors.error} />
              <Text style={styles.iconLabel}>Heart</Text>
            </View>
            <View style={styles.iconItem}>
              <Icon name="star" size={24} color={Colors.star} />
              <Text style={styles.iconLabel}>Star</Text>
            </View>
            <View style={styles.iconItem}>
              <Icon name="cart" size={24} color={Colors.primary} />
              <Text style={styles.iconLabel}>Cart</Text>
            </View>
            <View style={styles.iconItem}>
              <Icon name="location" size={24} color={Colors.secondary} />
              <Text style={styles.iconLabel}>Location</Text>
            </View>
            <View style={styles.iconItem}>
              <Icon name="notifications" size={24} color={Colors.warning} />
              <Text style={styles.iconLabel}>Notification</Text>
            </View>
            <View style={styles.iconItem}>
              <Icon name="person" size={24} color={Colors.info} />
              <Text style={styles.iconLabel}>Profile</Text>
            </View>
          </View>
        </Card>

        {/* Spacing at bottom */}
        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.base,
  },
  section: {
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    fontFamily: Typography.fontFamily.bold,
  },
  
  // Color Palette Styles
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorSwatch: {
    width: '48%',
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  colorLabel: {
    color: Colors.textWhite,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
  },

  // Typography Styles
  heading1: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.bold,
  },
  heading2: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.medium,
  },
  heading3: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.medium,
  },
  bodyText: {
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.lineHeight.md,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
  },
  captionText: {
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.lineHeight.sm,
    fontFamily: Typography.fontFamily.regular,
  },

  // Search Styles
  searchExample: {
    marginBottom: Spacing.md,
  },

  // Button Styles
  buttonGroup: {
    marginBottom: Spacing.lg,
  },
  buttonExample: {
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  buttonSize: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },

  // Card Styles
  cardExample: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  cardContent: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.md,
    fontFamily: Typography.fontFamily.regular,
  },

  // Icon Styles
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  iconItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },
});

export default UIShowcaseScreen;
