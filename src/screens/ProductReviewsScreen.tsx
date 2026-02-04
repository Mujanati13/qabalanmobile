import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/apiService';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';

interface ProductReviewsScreenProps {
  navigation: any;
  route: {
    params: {
      productId: number;
      productTitle: string;
    };
  };
}

interface Review {
  id: number;
  user_id: number;
  rating: number;
  title: string;
  review_text: string;
  pros: string;
  cons: string;
  is_verified_purchase: boolean;
  is_featured: boolean;
  helpful_count: number;
  not_helpful_count: number;
  reviewer_name: string;
  created_at: string;
  review_images: Array<{
    id: number;
    image_url: string;
    alt_text: string;
  }>;
}

interface RatingSummary {
  total_reviews: number;
  average_rating: number;
  rating_distribution: {
    rating_5: number;
    rating_4: number;
    rating_3: number;
    rating_2: number;
    rating_1: number;
  };
  verified_purchase_count: number;
}

const ProductReviewsScreen: React.FC<ProductReviewsScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isRTL = false; // Override to force LTR
  const { user } = useAuth();
  const { productId, productTitle } = route.params;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState('newest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    loadReviews(true);
    loadRatingSummary();
  }, [selectedRating, sortBy, verifiedOnly]);

  const loadRatingSummary = async () => {
    try {
      const response = await ApiService.getProductRatingSummary(productId);
      if (response.success && response.data) {
        setRatingSummary(response.data);
      }
    } catch (error) {
      console.error('Error loading rating summary:', error);
    }
  };

  const loadReviews = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setCurrentPage(1);
      } else {
        setLoadingMore(true);
      }

      const page = reset ? 1 : currentPage;
      const response = await ApiService.getProductReviews(productId, {
        page,
        limit: 10,
        rating: selectedRating,
        verified_only: verifiedOnly,
        sort_by: sortBy,
      });

      if (response.success && response.data) {
        const newReviews = response.data.reviews;
        
        if (reset) {
          setReviews(newReviews);
        } else {
          setReviews(prev => [...prev, ...newReviews]);
        }

        setHasMorePages(response.data.pagination.has_next_page);
        setCurrentPage(page + 1);
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      Alert.alert(t('common.error'), t('reviews.errorLoading'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReviews(true);
    loadRatingSummary();
  }, [selectedRating, sortBy, verifiedOnly]);

  const loadMoreReviews = () => {
    if (!loadingMore && hasMorePages) {
      loadReviews(false);
    }
  };

  const handleVoteReview = async (reviewId: number, voteType: 'helpful' | 'not_helpful') => {
    if (!user) {
      Alert.alert(t('auth.loginRequired'), t('reviews.loginToVote'));
      return;
    }

    try {
      const response = await ApiService.voteOnReview(reviewId, voteType);
      if (response.success) {
        // Refresh the specific review or reload all
        loadReviews(true);
      } else {
        Alert.alert(t('common.error'), response.message);
      }
    } catch (error) {
      console.error('Error voting on review:', error);
      Alert.alert(t('common.error'), t('reviews.errorVoting'));
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStars = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color={i <= rating ? '#FFD700' : '#DDD'}
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const renderRatingDistribution = () => {
    if (!ratingSummary) return null;

    const { rating_distribution, total_reviews } = ratingSummary;

    return (
      <View style={styles.ratingDistribution}>
        {[5, 4, 3, 2, 1].map(rating => {
          const count = rating_distribution[`rating_${rating}` as keyof typeof rating_distribution];
          const percentage = total_reviews > 0 ? (count / total_reviews) * 100 : 0;

          return (
            <TouchableOpacity
              key={rating}
              style={[styles.ratingBar, isRTL && styles.rtlRatingBar]}
              onPress={() => setSelectedRating(selectedRating === rating ? null : rating)}
            >
              <Text style={[styles.ratingNumber, isRTL && styles.rtlText]}>
                {rating}
              </Text>
              <Icon name="star" size={14} color="#FFD700" />
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { width: `${percentage}%` },
                    selectedRating === rating && styles.selectedProgressBar
                  ]} 
                />
              </View>
              <Text style={[styles.ratingCount, isRTL && styles.rtlText]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderFilterBar = () => {
    return (
      <View style={[styles.filterBar, isRTL && styles.rtlFilterBar]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedRating === null && styles.activeFilterButton
            ]}
            onPress={() => setSelectedRating(null)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedRating === null && styles.activeFilterButtonText
            ]}>
              {t('reviews.allReviews')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              verifiedOnly && styles.activeFilterButton
            ]}
            onPress={() => setVerifiedOnly(!verifiedOnly)}
          >
            <Icon name="checkmark-circle" size={16} color={verifiedOnly ? Colors.textWhite : Colors.primary} />
            <Text style={[
              styles.filterButtonText,
              verifiedOnly && styles.activeFilterButtonText,
              { marginLeft: 4 }
            ]}>
              {t('reviews.verifiedOnly')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            // Show sort options modal or action sheet
            Alert.alert(
              t('reviews.sortBy'),
              '',
              [
                { text: t('reviews.newest'), onPress: () => setSortBy('newest') },
                { text: t('reviews.oldest'), onPress: () => setSortBy('oldest') },
                { text: t('reviews.highestRated'), onPress: () => setSortBy('highest_rated') },
                { text: t('reviews.lowestRated'), onPress: () => setSortBy('lowest_rated') },
                { text: t('reviews.mostHelpful'), onPress: () => setSortBy('most_helpful') },
                { text: t('common.cancel'), style: 'cancel' },
              ]
            );
          }}
        >
          <Icon name="funnel" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReview = ({ item: review }: { item: Review }) => {
    return (
      <View style={[styles.reviewCard, isRTL && styles.rtlReviewCard]}>
        {/* Review Header */}
        <View style={[styles.reviewHeader, isRTL && styles.rtlReviewHeader]}>
          <View style={styles.reviewerInfo}>
            <Text style={[styles.reviewerName, isRTL && styles.rtlText]}>
              {review.reviewer_name}
            </Text>
            {review.is_verified_purchase && (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle" size={12} color="#27ae60" />
                <Text style={styles.verifiedText}>
                  {t('reviews.verifiedPurchase')}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.reviewDate, isRTL && styles.rtlText]}>
            {formatDate(review.created_at)}
          </Text>
        </View>

        {/* Rating and Title */}
        <View style={[styles.reviewRating, isRTL && styles.rtlReviewRating]}>
          {renderStars(review.rating)}
          {review.title && (
            <Text style={[styles.reviewTitle, isRTL && styles.rtlText]}>
              {review.title}
            </Text>
          )}
        </View>

        {/* Review Text */}
        {review.review_text && (
          <Text style={[styles.reviewText, isRTL && styles.rtlText]}>
            {review.review_text}
          </Text>
        )}

        {/* Pros and Cons */}
        {(review.pros || review.cons) && (
          <View style={styles.prosConsContainer}>
            {review.pros && (
              <View style={styles.prosContainer}>
                <Text style={[styles.prosConsTitle, { color: '#27ae60' }, isRTL && styles.rtlText]}>
                  {t('reviews.pros')}:
                </Text>
                <Text style={[styles.prosConsText, isRTL && styles.rtlText]}>
                  {review.pros}
                </Text>
              </View>
            )}
            {review.cons && (
              <View style={styles.consContainer}>
                <Text style={[styles.prosConsTitle, { color: '#e74c3c' }, isRTL && styles.rtlText]}>
                  {t('reviews.cons')}:
                </Text>
                <Text style={[styles.prosConsText, isRTL && styles.rtlText]}>
                  {review.cons}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Review Images */}
        {review.review_images && review.review_images.length > 0 && (
          <ScrollView horizontal style={styles.reviewImages}>
            {review.review_images.map(image => (
              <Image
                key={image.id}
                source={{ uri: ApiService.getImageUrl(image.image_url) }}
                style={styles.reviewImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        {/* Helpfulness Voting */}
        <View style={[styles.helpfulnessContainer, isRTL && styles.rtlHelpfulnessContainer]}>
          <Text style={[styles.helpfulnessText, isRTL && styles.rtlText]}>
            {t('reviews.wasHelpful')}
          </Text>
          <View style={styles.voteButtons}>
            <TouchableOpacity
              style={styles.voteButton}
              onPress={() => handleVoteReview(review.id, 'helpful')}
            >
              <Icon name="thumbs-up-outline" size={16} color={Colors.primary} />
              <Text style={styles.voteCount}>{review.helpful_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voteButton}
              onPress={() => handleVoteReview(review.id, 'not_helpful')}
            >
              <Icon name="thumbs-down-outline" size={16} color="#666" />
              <Text style={styles.voteCount}>{review.not_helpful_count}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    if (!ratingSummary) return null;

    return (
      <View style={styles.header}>
        {/* Overall Rating */}
        <View style={[styles.overallRating, isRTL && styles.rtlOverallRating]}>
          <View style={styles.ratingScore}>
            <Text style={styles.averageRating}>
              {ratingSummary.average_rating.toFixed(1)}
            </Text>
            {renderStars(Math.round(ratingSummary.average_rating), 24)}
          </View>
          <Text style={[styles.totalReviews, isRTL && styles.rtlText]}>
            {t('reviews.basedOnReviews', { count: ratingSummary.total_reviews })}
          </Text>
        </View>

        {/* Rating Distribution */}
        {renderRatingDistribution()}

        {/* Write Review Button */}
        {user && (
          <TouchableOpacity
            style={styles.writeReviewButton}
            onPress={() => navigation.navigate('WriteReview', { 
              productId, 
              productTitle 
            })}
          >
            <Icon name="create-outline" size={20} color="#fff" />
            <Text style={styles.writeReviewButtonText}>
              {t('reviews.writeReview')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Filter Bar */}
        {renderFilterBar()}
      </View>
    );
  };

  const renderLoadingFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="chatbubble-outline" size={80} color="#ccc" />
        <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
          {t('reviews.noReviews')}
        </Text>
        <Text style={[styles.emptySubtitle, isRTL && styles.rtlText]}>
          {t('reviews.beFirstToReview')}
        </Text>
        {user && (
          <TouchableOpacity
            style={styles.writeFirstReviewButton}
            onPress={() => navigation.navigate('WriteReview', { 
              productId, 
              productTitle 
            })}
          >
            <Text style={styles.writeFirstReviewButtonText}>
              {t('reviews.writeFirstReview')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isRTL && styles.rtlContainer]}>
      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderLoadingFooter}
        ListEmptyComponent={renderEmptyState}
        onEndReached={loadMoreReviews}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={reviews.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rtlContainer: {
    direction: 'rtl',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  emptyContentContainer: {
    flexGrow: 1,
  },
  
  // Header Styles
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 20,
    marginBottom: 10,
  },
  overallRating: {
    alignItems: 'center',
    marginBottom: 20,
  },
  rtlOverallRating: {
    alignItems: 'center',
  },
  ratingScore: {
    alignItems: 'center',
    marginBottom: 5,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalReviews: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  
  // Rating Distribution
  ratingDistribution: {
    marginBottom: 20,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rtlRatingBar: {
    flexDirection: 'row-reverse',
  },
  ratingNumber: {
    fontSize: 14,
    color: '#333',
    width: 15,
    textAlign: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  selectedProgressBar: {
    backgroundColor: Colors.primary,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    width: 30,
    textAlign: 'center',
  },
  
  // Write Review Button
  writeReviewButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  writeReviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rtlFilterBar: {
    flexDirection: 'row-reverse',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  sortButton: {
    padding: 8,
  },
  
  // Review Card
  reviewCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rtlReviewCard: {
    alignItems: 'flex-end',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  rtlReviewHeader: {
    flexDirection: 'row-reverse',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 12,
    color: '#27ae60',
    marginLeft: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewRating: {
    marginBottom: 10,
  },
  rtlReviewRating: {
    alignItems: 'flex-end',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 5,
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 10,
  },
  
  // Pros and Cons
  prosConsContainer: {
    marginBottom: 10,
  },
  prosContainer: {
    marginBottom: 8,
  },
  consContainer: {
    marginBottom: 8,
  },
  prosConsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  prosConsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  
  // Review Images
  reviewImages: {
    marginBottom: 10,
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  
  // Helpfulness
  helpfulnessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  rtlHelpfulnessContainer: {
    flexDirection: 'row-reverse',
  },
  helpfulnessText: {
    fontSize: 14,
    color: '#666',
  },
  voteButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  voteCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  
  // Loading Footer
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  writeFirstReviewButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  writeFirstReviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductReviewsScreen;
