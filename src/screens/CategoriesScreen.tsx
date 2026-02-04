import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import ApiService, { Category } from '../services/apiService';

// Extended interface for UI display
interface CategoryWithColor extends Category {
  color: string;
}

const CategoriesScreen: React.FC = () => {
  const { t, currentLanguage } = useLanguage();
  const isRTL = false; // Override to force LTR
  const [categories, setCategories] = useState<CategoryWithColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default colors for categories (cycle through them)
  const categoryColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch categories ordered by sort_order
      const response = await ApiService.getCategories({ 
        parent_id: 'null' // Get top-level categories only
      });
      
      if (response.success && response.data) {
        // Add color to each category for UI purposes
        const categoriesWithColors = response.data.map((category, index) => ({
          ...category,
          color: categoryColors[index % categoryColors.length]
        }));
        
        setCategories(categoriesWithColors);
      } else {
        setError(response.message || 'Failed to load categories');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (category: Category) => {
    return currentLanguage === 'ar' ? category.title_ar : category.title_en;
  };

  const renderCategoryCard = (category: CategoryWithColor) => (
    <TouchableOpacity 
      key={category.id} 
      style={[styles.categoryCard, { borderLeftColor: category.color }]}
    >
      <View style={styles.categoryContent}>
        <View style={[styles.categoryIcon, { backgroundColor: category.color }]} />
        <View style={[styles.categoryInfo, isRTL && styles.rtlCategoryInfo]}>
          <Text style={[styles.categoryName, isRTL && styles.rtlText]}>
            {getCategoryName(category)}
          </Text>
          <Text style={[styles.categoryCount, isRTL && styles.rtlText]}>
            {category.sort_order || 0} sort order
          </Text>
        </View>
      </View>
      <Text style={[styles.arrow, isRTL && styles.rtlArrow]}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={[styles.loadingText, isRTL && styles.rtlText]}>
            {t('categories.loadingCategories')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, isRTL && styles.rtlText]}>
            {error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadCategories}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlHeader]}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {t('navigation.categories')}
        </Text>
        <TouchableOpacity style={styles.searchButton}>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Popular Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            Popular Categories
          </Text>
          <View style={styles.popularGrid}>
            {categories.slice(0, 4).map((category) => (
              <TouchableOpacity 
                key={category.id} 
                style={[styles.popularCard, { backgroundColor: category.color + '20' }]}
              >
                <View style={[styles.popularIcon, { backgroundColor: category.color }]} />
                <Text style={[styles.popularName, isRTL && styles.rtlText]}>
                  {getCategoryName(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* All Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            All Categories
          </Text>
          <View style={styles.categoriesList}>
            {categories.map(renderCategoryCard)}
          </View>
        </View>

        {/* Featured Banner */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.featuredBanner}>
            <Text style={[styles.bannerTitle, isRTL && styles.rtlText]}>
              Discover New Products
            </Text>
            <Text style={[styles.bannerSubtitle, isRTL && styles.rtlText]}>
              Explore our latest arrivals and trending items
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  rtlContainer: {
    direction: 'rtl',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  rtlHeader: {
    flexDirection: 'row-reverse',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchButton: {
    padding: 8,
  },
  searchIcon: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  popularCard: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  popularIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  popularName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  categoriesList: {
    marginTop: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 15,
  },
  categoryInfo: {
    flex: 1,
  },
  rtlCategoryInfo: {
    alignItems: 'flex-end',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 14,
    color: '#666',
  },
  arrow: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 10,
  },
  rtlArrow: {
    transform: [{ rotate: '180deg' }],
    marginLeft: 0,
    marginRight: 10,
  },
  featuredBanner: {
    backgroundColor: '#007bff',
    padding: 20,
    borderRadius: 15,
    marginTop: 10,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#e3f2fd',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CategoriesScreen;
