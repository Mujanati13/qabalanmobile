import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../../theme';
import Card from './Card';
import { formatCurrency } from '../../utils/currency';

interface Product {
  id: number;
  name?: string;
  title?: string;
  main_image?: string;
  base_price: number;
  sale_price?: number;
  final_price: number;
  is_featured?: boolean;
  stock_status?: string;
}

interface ProductCardProps {
  product: Product;
  onPress: (productId: number) => void;
  width?: number;
  showDiscountBadge?: boolean;
  showFeaturedBadge?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  width = 150,
  showDiscountBadge = true,
  showFeaturedBadge = true,
}) => {
  const title = product.name || product.title || 'Product';
  const hasDiscount = product.sale_price && product.sale_price < product.base_price;
  const discountPercentage = hasDiscount 
    ? Math.round(((product.base_price - product.sale_price!) / product.base_price) * 100)
    : 0;

  return (
    <TouchableOpacity onPress={() => onPress(product.id)} style={{ width }}>
      <Card style={styles.container} padding="md" elevation="base">
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: product.main_image || 'https://via.placeholder.com/150x150?text=No+Image' 
            }}
            style={styles.image}
            resizeMode="cover"
          />
          
          {/* Featured Badge */}
          {showFeaturedBadge && product.is_featured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={12} color={Colors.textWhite} />
            </View>
          )}
          
          {/* Discount Badge */}
          {showDiscountBadge && hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>
                {discountPercentage}% OFF
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>
              {formatCurrency(product.final_price)}
            </Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>
                {formatCurrency(product.base_price)}
              </Text>
            )}
          </View>

          {product.stock_status === 'out_of_stock' && (
            <Text style={styles.outOfStock}>Out of Stock</Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.star,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  discountText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textWhite,
    fontFamily: Typography.fontFamily.bold,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    minHeight: 35,
    fontFamily: Typography.fontFamily.medium,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  currentPrice: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    fontFamily: Typography.fontFamily.bold,
  },
  originalPrice: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textHint,
    textDecorationLine: 'line-through',
    marginLeft: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
  },
  outOfStock: {
    fontSize: Typography.fontSize.sm,
    color: Colors.error,
    fontWeight: Typography.fontWeight.medium,
    fontFamily: Typography.fontFamily.medium,
  },
});

export default ProductCard;
