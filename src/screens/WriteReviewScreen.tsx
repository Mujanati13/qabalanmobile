import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, ImagePickerResponse, MediaType, ImageLibraryOptions } from 'react-native-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import ApiService, { ProductReview, ReviewableOrderItem } from '../services/apiService';
import Colors from '../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../theme';
import { Button, Card, Header } from '../components/common';
import { rtlStyles } from '../utils/rtlUtils';
import { analyzeError, NetworkErrorInfo } from '../utils/networkErrorHandler';

interface WriteReviewScreenProps {
  route: {
    params: {
      productId: number;
      orderItemId?: number;
      existingReview?: ProductReview;
      reviewableItem?: ReviewableOrderItem;
    };
  };
}

interface ReviewImage {
  id?: number;
  uri: string;
  type: string;
  name: string;
}

const WriteReviewScreen: React.FC<WriteReviewScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentLanguage, t } = useLanguage();
  const { user } = useAuth();

  const { productId, orderItemId, existingReview, reviewableItem } = route.params as WriteReviewScreenProps['route']['params'];

  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [reviewText, setReviewText] = useState(existingReview?.review_text || '');
  const [pros, setPros] = useState(existingReview?.pros || '');
  const [cons, setCons] = useState(existingReview?.cons || '');
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [imagesToRemove, setImagesToRemove] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    // Load existing review images if editing
    if (existingReview?.images) {
      const existingImages = existingReview.images.map(img => ({
        id: img.id,
        uri: ApiService.getImageUrl(img.image_url),
        type: 'image/jpeg',
        name: `review-image-${img.id}.jpg`
      }));
      setImages(existingImages);
    }

    // Request camera permissions
    requestPermissions();
  }, [existingReview]);

  // Enhanced error logging function
  const logError = (context: string, error: any, additionalData?: any) => {
    const timestamp = new Date().toISOString();
    const userId = user?.id || 'anonymous';
    const productInfo = reviewableItem ? {
      productId,
      orderItemId,
      productTitle: reviewableItem.product_title_en
    } : { productId };

    console.group(`🚨 [WriteReviewScreen Error] ${context} - ${timestamp}`);
    console.error('Context:', context);
    console.error('User ID:', userId);
    console.error('Product Info:', productInfo);
    console.error('Error Details:', error);
    console.error('Error Type:', typeof error);
    console.error('Error Name:', error?.name);
    console.error('Error Message:', error?.message);
    console.error('Error Stack:', error?.stack);
    if (additionalData) {
      console.error('Additional Data:', additionalData);
    }
    console.groupEnd();
  };

  // Enhanced error display function
  const showErrorAlert = (context: string, error: any, fallbackMessage?: string) => {
    const errorInfo = analyzeError(error);
    let title = t('error') || 'Error';
    let message = fallbackMessage || t('common.somethingWentWrong') || 'Something went wrong';

    // Set network error state for UI
    if (errorInfo.isNetworkError) {
      setNetworkError(true);
      title = t('common.connectionError') || 'Connection Error';
      message = t('common.checkInternetConnection') || 'Please check your internet connection and try again.';
    } else if (errorInfo.isServerError) {
      title = t('common.serverError') || 'Server Error';
      message = t('common.serverTemporarilyUnavailable') || 'Server is temporarily unavailable. Please try again later.';
    } else if (errorInfo.isTimeoutError) {
      title = t('common.timeoutError') || 'Request Timeout';
      message = t('common.requestTimedOut') || 'Request timed out. Please try again.';
    }

    // Log the error for debugging
    logError(context, error, { errorInfo, userFacingMessage: message });

    // Show user-friendly alert
    Alert.alert(
      title,
      message,
      [
        {
          text: t('common.ok') || 'OK',
          onPress: () => {
            setError(null);
            setNetworkError(false);
          }
        }
      ]
    );
  };

  const requestPermissions = async () => {
    // For React Native CLI, permissions are handled at build time
    // Camera and photo library permissions are set in android/ios manifests
    console.log('Permissions handled at build time for React Native CLI');
  };

  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const pickImage = async () => {
    try {
      if (images.length >= 5) {
        Alert.alert(
          t('error') || 'Error',
          t('reviews.maxImagesReached')
        );
        return;
      }

      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 0.8,
      };

      launchImageLibrary(options, (response: ImagePickerResponse) => {
        try {
          if (response.didCancel) {
            console.log('📷 User cancelled image picker');
            return;
          }

          if (response.errorMessage) {
            logError('Image Picker Error', new Error(response.errorMessage), { response });
            Alert.alert(
              t('error') || 'Error',
              t('imagePickerError') || 'Failed to select image. Please try again.'
            );
            return;
          }

          if (response.assets && response.assets[0]) {
            const asset = response.assets[0];
            
            if (!asset.uri) {
              logError('Invalid Image Asset', new Error('No URI in selected asset'), { asset });
              Alert.alert(
                t('error') || 'Error',
                t('invalidImageSelected') || 'Invalid image selected. Please try another image.'
              );
              return;
            }

            if (!asset.type) {
              logError('Invalid Image Type', new Error('No type in selected asset'), { asset });
              Alert.alert(
                t('error') || 'Error',
                t('unsupportedImageFormat') || 'Unsupported image format. Please select a JPEG or PNG image.'
              );
              return;
            }

            // Check file size (limit to 10MB)
            if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
              Alert.alert(
                t('error') || 'Error',
                t('imageTooLarge') || 'Image is too large. Please select an image smaller than 10MB.'
              );
              return;
            }

            const newImage: ReviewImage = {
              uri: asset.uri,
              type: asset.type,
              name: asset.fileName || `review-image-${Date.now()}.jpg`,
            };

            setImages(prev => [...prev, newImage]);
            console.log('✅ Image added successfully:', { name: newImage.name, type: newImage.type });
          } else {
            logError('No Image Asset', new Error('No assets in image picker response'), { response });
            Alert.alert(
              t('error') || 'Error',
              t('noImageSelected') || 'No image was selected. Please try again.'
            );
          }
        } catch (processingError) {
          logError('Image Processing Error', processingError, { response });
          Alert.alert(
            t('error') || 'Error',
            t('imageProcessingError') || 'Failed to process selected image. Please try again.'
          );
        }
      });
    } catch (error) {
      logError('Image Picker Launch Error', error);
      showErrorAlert('Image Picker', error, t('imagePickerLaunchError') || 'Failed to open image picker. Please check app permissions.');
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    
    // If it's an existing image (has ID), mark it for removal
    if (imageToRemove.id) {
      setImagesToRemove(prev => [...prev, imageToRemove.id!]);
    }
    
    // Remove from display
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    try {
      // Clear previous errors
      setError(null);

      if (rating === 0) {
        const errorMsg = t('reviews.ratingRequired');
        setError(errorMsg);
        Alert.alert(
          t('validation_error') || 'Validation Error',
          errorMsg,
          [{ text: t('common.ok') || 'OK' }]
        );
        logError('Validation Error', new Error('Rating is required'), { rating });
        return false;
      }

      const trimmedTitle = title.trim();
      const trimmedReview = reviewText.trim();

      if (!trimmedReview && !trimmedTitle) {
        const errorMsg = t('review_content_required') || 'Please provide either a review title or review details.';
        setError(errorMsg);
        Alert.alert(
          t('validation_error') || 'Validation Error',
          errorMsg,
          [{ text: t('common.ok') || 'OK' }]
        );
        logError('Validation Error', new Error('Review content is required'), { 
          titleLength: trimmedTitle.length,
          reviewLength: trimmedReview.length 
        });
        return false;
      }

      // Additional validations
      if (trimmedTitle.length > 200) {
        const errorMsg = t('title_too_long') || 'Review title must be 200 characters or less.';
        setError(errorMsg);
        Alert.alert(
          t('validation_error') || 'Validation Error',
          errorMsg,
          [{ text: t('common.ok') || 'OK' }]
        );
        return false;
      }

      if (trimmedReview.length > 2000) {
        const errorMsg = t('review_too_long') || 'Review details must be 2000 characters or less.';
        setError(errorMsg);
        Alert.alert(
          t('validation_error') || 'Validation Error',
          errorMsg,
          [{ text: t('common.ok') || 'OK' }]
        );
        return false;
      }

      console.log('✅ Form validation passed:', {
        rating,
        titleLength: trimmedTitle.length,
        reviewLength: trimmedReview.length,
        imageCount: images.length
      });

      return true;
    } catch (error) {
      logError('Form Validation Error', error);
      const errorMsg = t('validation_failed') || 'Form validation failed. Please try again.';
      setError(errorMsg);
      Alert.alert(
        t('error') || 'Error',
        errorMsg,
        [{ text: t('common.ok') || 'OK' }]
      );
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);
    setNetworkError(false);

    try {
      console.log('🚀 Starting review submission:', {
        productId,
        orderItemId,
        rating,
        hasTitle: !!title.trim(),
        hasReview: !!reviewText.trim(),
        hasPros: !!pros.trim(),
        hasCons: !!cons.trim(),
        imageCount: images.length,
        isUpdate: !!existingReview
      });

      const reviewData = {
        product_id: productId,
        order_item_id: orderItemId,
        rating,
        title: title.trim() || undefined,
        review_text: reviewText.trim() || undefined,
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
      };

      // Prepare new images (exclude existing ones)
      const newImages = images.filter(img => !img.id);
      const imageFiles: File[] = [];

      // Convert image URIs to File objects for new images
      if (newImages.length > 0) {
        console.log('📷 Processing images:', newImages.length);
        for (const img of newImages) {
          try {
            const response = await fetch(img.uri);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const file = new File([blob], img.name, { 
              type: img.type,
              lastModified: Date.now()
            });
            imageFiles.push(file);
            console.log('✅ Image processed:', img.name, `${Math.round(blob.size / 1024)}KB`);
          } catch (imageError) {
            logError('Image Processing Error', imageError, { image: img });
            throw new Error(t('imageProcessingFailed') || `Failed to process image: ${img.name}`);
          }
        }
      }

      let response;
      if (existingReview) {
        console.log('🔄 Updating existing review:', existingReview.id);
        // Update existing review
        response = await ApiService.updateProductReview(
          existingReview.id,
          reviewData,
          imageFiles.length > 0 ? imageFiles : undefined,
          imagesToRemove.length > 0 ? imagesToRemove : undefined
        );
      } else {
        console.log('📝 Creating new review');
        // Create new review
        response = await ApiService.createProductReview(reviewData, imageFiles);
      }

      console.log('📡 API Response:', {
        success: response?.success,
        hasData: !!response?.data,
        message: response?.message
      });

      if (response && response.success) {
        console.log('✅ Review submission successful');
        Alert.alert(
          t('success') || 'Success',
          existingReview 
            ? (t('review_updated_successfully') || 'Your review has been updated successfully.')
            : (t('review_submitted_successfully') || 'Your review has been submitted successfully.'),
          [
            {
              text: t('ok') || 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        const errorMessage = response?.message || 
          (existingReview 
            ? (t('failed_to_update_review') || 'Failed to update review. Please try again.')
            : (t('failed_to_submit_review') || 'Failed to submit review. Please try again.')
          );
        
        logError('API Response Error', new Error(errorMessage), { response });
        Alert.alert(
          t('error') || 'Error', 
          errorMessage,
          [{ text: t('common.ok') || 'OK' }]
        );
      }
    } catch (error) {
      console.error('💥 Review submission error:', error);
      logError('Review Submission Error', error, {
        productId,
        rating,
        imageCount: images.length,
        isUpdate: !!existingReview
      });
      
      showErrorAlert('Review Submission', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarPress(star)}
            style={styles.starButton}
          >
            <Icon
              name={star <= rating ? 'star' : 'star-outline'}
              size={32}
              color={star <= rating ? '#FFD700' : '#DDD'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderProductInfo = () => {
    if (reviewableItem) {
      return (
        <View style={styles.productInfo}>
          {reviewableItem.product_image && (
            <Image
              source={{ uri: ApiService.getImageUrl(reviewableItem.product_image) }}
              style={styles.productImage}
            />
          )}
          <View style={styles.productDetails}>
            <Text style={styles.productTitle}>
              {currentLanguage === 'ar' 
                ? (reviewableItem.product_title_ar || '') 
                : (reviewableItem.product_title_en || '')}
            </Text>
            <Text style={styles.orderInfo}>
              {t('order')} #{reviewableItem.order_number || ''}
            </Text>
            <Text style={styles.verifiedPurchase}>
              <Text style={styles.checkmark}>✓ </Text>
              <Text>{t('verified_purchase') || 'Verified Purchase'}</Text>
            </Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const renderImagePicker = () => {
    return (
      <View style={styles.imageSection}>
        <Text style={styles.sectionTitle}>{t('add_photos')}</Text>
        <Text style={styles.sectionSubtitle}>{t('photos_help_others')}</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {images.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image.uri }} style={styles.reviewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(index)}
              >
                <Icon name="close-circle" size={24} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
          
          {images.length < 5 && (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Icon name="camera" size={32} color="#666" />
              <Text style={styles.addImageText}>{t('add_photo')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderErrorBanner = () => {
    if (!error && !networkError) return null;

    return (
      <View style={styles.errorBanner}>
        <Icon 
          name={networkError ? "cloud-offline" : "alert-circle"} 
          size={20} 
          color="#fff" 
          style={styles.errorIcon} 
        />
        <Text style={styles.errorText}>
          {error || (networkError 
            ? (t('common.connectionIssues') || 'Connection issues detected')
            : (t('common.errorOccurred') || 'An error occurred')
          )}
        </Text>
        <TouchableOpacity 
          onPress={() => {
            setError(null);
            setNetworkError(false);
          }} 
          style={styles.errorCloseButton}
        >
          <Icon name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={existingReview ? t('edit_review') : t('write_review')}
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        backgroundColor={Colors.background}
        textColor={Colors.textPrimary}
      />

      {renderErrorBanner()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderProductInfo()}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('overall_rating')}</Text>
          {renderStars()}
          <Text style={styles.ratingText}>
            {rating > 0 ? (t(`rating_${rating}_stars`) || t('tap_to_rate') || '') : (t('tap_to_rate') || '')}
          </Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('review_title')} ({t('optional')})</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('review_title_placeholder') || 'Enter review title...'}
            maxLength={200}
            multiline={false}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('review_details')}</Text>
          <TextInput
            style={styles.textAreaInput}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder={t('review_details_placeholder') || 'Share your thoughts about this product...'}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={2000}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('what_you_liked')} ({t('optional')})</Text>
          <TextInput
            style={styles.textAreaInput}
            value={pros}
            onChangeText={setPros}
            placeholder={t('pros_placeholder') || 'What did you like about this product?'}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={1000}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{t('what_could_be_better')} ({t('optional')})</Text>
          <TextInput
            style={styles.textAreaInput}
            value={cons}
            onChangeText={setCons}
            placeholder={t('cons_placeholder') || 'What could be improved?'}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={1000}
          />
        </Card>

        {renderImagePicker()}

        <View style={styles.guidelinesSection}>
          <Text style={styles.guidelinesTitle}>{t('review_guidelines')}</Text>
          <View style={styles.guidelinesContent}>
            <Text style={styles.guidelinesText}>
              <Text style={styles.bulletPoint}>• </Text>
              <Text>{t('guideline_honest') || 'Be honest and helpful'}</Text>
            </Text>
            <Text style={styles.guidelinesText}>
              <Text style={styles.bulletPoint}>• </Text>
              <Text>{t('guideline_relevant') || 'Keep it relevant to the product'}</Text>
            </Text>
            <Text style={styles.guidelinesText}>
              <Text style={styles.bulletPoint}>• </Text>
              <Text>{t('guideline_respectful') || 'Be respectful and constructive'}</Text>
            </Text>
            <Text style={styles.guidelinesText}>
              <Text style={styles.bulletPoint}>• </Text>
              <Text>{t('guideline_no_personal_info') || 'Don\'t include personal information'}</Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={existingReview ? t('update_review') : t('submit_review')}
          onPress={handleSubmit}
          disabled={!rating || submitting}
          loading={submitting}
          fullWidth
          size="large"
        />
      </View>
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
    marginVertical: Spacing.sm,
  },
  productInfo: {
    ...rtlStyles.row,
    padding: Spacing.base,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.base,
    ...Shadow.sm,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    ...rtlStyles.marginEnd(Spacing.md),
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.medium,
    ...rtlStyles.textStart,
  },
  orderInfo: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontFamily: Typography.fontFamily.regular,
    ...rtlStyles.textStart,
  },
  verifiedPurchase: {
    fontSize: Typography.fontSize.xs,
    color: Colors.success,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.medium,
    ...rtlStyles.textStart,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.medium,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontFamily: Typography.fontFamily.regular,
  },
  starsContainer: {
    ...rtlStyles.row,
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  starButton: {
    padding: Spacing.xs,
    marginHorizontal: Spacing.xs,
  },
  ratingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    backgroundColor: Colors.backgroundCard,
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.regular,
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.md,
    backgroundColor: Colors.backgroundCard,
    color: Colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: Typography.fontFamily.regular,
  },
  imageSection: {
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  imageScroll: {
    marginTop: Spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    ...rtlStyles.marginEnd(Spacing.md),
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.full,
    ...Shadow.base,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundLight,
  },
  addImageText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.regular,
  },
  guidelinesSection: {
    paddingVertical: Spacing.base,
    marginBottom: Spacing.lg,
  },
  guidelinesTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  guidelinesText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.lineHeight.md,
    fontFamily: Typography.fontFamily.regular,
    marginBottom: Spacing.xs,
  },
  guidelinesContent: {
    gap: Spacing.xs,
  },
  bulletPoint: {
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.medium,
  },
  checkmark: {
    color: Colors.success,
    fontWeight: Typography.fontWeight.bold,
  },
  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.backgroundCard,
    ...Shadow.sm,
  },
  errorBanner: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
  },
  errorIcon: {
    marginRight: Spacing.sm,
  },
  errorText: {
    flex: 1,
    color: '#fff',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    lineHeight: Typography.lineHeight.sm,
  },
  errorCloseButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
});

export default WriteReviewScreen;
