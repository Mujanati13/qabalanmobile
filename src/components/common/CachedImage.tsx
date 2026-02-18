import React, { useState, useEffect } from 'react';
import {
  Image,
  ImageProps,
  ActivityIndicator,
  View,
  StyleSheet,
  ImageStyle,
  ViewStyle,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri: string;
  style?: ImageStyle | ImageStyle[];
  containerStyle?: ViewStyle;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  loadingIndicatorSize?: 'small' | 'large';
  fallbackComponent?: React.ReactNode;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: () => void;
  cacheEnabled?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only' | undefined;
}

const CACHE_PREFIX = '@image_cache:';
const CACHE_EXPIRY_DAYS = 7; // Cache images for 7 days

const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  style,
  containerStyle,
  showLoadingIndicator = true,
  loadingIndicatorColor = '#4CAF50',
  loadingIndicatorSize = 'small',
  fallbackComponent,
  onLoadStart,
  onLoadEnd,
  onError,
  cacheEnabled = true,
  pointerEvents,
  ...imageProps
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    if (uri && cacheEnabled) {
      loadImage();
    } else if (uri) {
      setCachedUri(uri);
    }
  }, [uri, cacheEnabled]);

  const getCacheKey = (imageUri: string): string => {
    return `${CACHE_PREFIX}${imageUri}`;
  };

  const isCacheExpired = (timestamp: number): boolean => {
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryTime;
  };

  const loadImage = async () => {
    if (!uri) {
      setLoading(false);
      return;
    }

    try {
      const cacheKey = getCacheKey(uri);
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (cachedData) {
        const { cachedUri: storedUri, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is expired
        if (!isCacheExpired(timestamp)) {
          setCachedUri(storedUri);
          setLoading(false);
          onLoadEnd?.();
          return;
        } else {
          // Remove expired cache
          await AsyncStorage.removeItem(cacheKey);
        }
      }

      // If no valid cache, use the original URI and cache the metadata
      setCachedUri(uri);
      
      // Store cache metadata (we're not downloading and storing the actual image data
      // to avoid excessive storage usage, just tracking successful loads)
      const cacheData = {
        cachedUri: uri,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache loading error:', error);
      // Fallback to direct URI on cache error
      setCachedUri(uri);
    }
  };

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
    onLoadStart?.();
  };

  const handleLoadEnd = () => {
    setLoading(false);
    onLoadEnd?.();
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
    onError?.();
  };

  if (!uri) {
    return fallbackComponent ? <View style={containerStyle}>{fallbackComponent}</View> : null;
  }

  if (error && fallbackComponent) {
    return <View style={containerStyle}>{fallbackComponent}</View>;
  }

  return (
    <View style={[styles.container, containerStyle]} pointerEvents={pointerEvents || 'auto'}>
      {cachedUri && (
        <Image
          {...imageProps}
          source={{ uri: cachedUri }}
          style={style}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />
      )}
      {loading && showLoadingIndicator && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator 
            size={loadingIndicatorSize} 
            color={loadingIndicatorColor} 
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});

export default CachedImage;
