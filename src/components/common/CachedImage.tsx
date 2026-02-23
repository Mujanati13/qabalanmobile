import React, { useState, useCallback, memo } from 'react';
import {
  Image,
  ImageProps,
  ActivityIndicator,
  View,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  Platform,
} from 'react-native';

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

// React Native's Image component already handles HTTP caching natively on both platforms.
// On iOS, NSURLCache handles disk/memory caching automatically.
// On Android, OkHttp handles HTTP caching automatically.
// No need for AsyncStorage-based metadata tracking — it only added overhead.

const CachedImage: React.FC<CachedImageProps> = memo(({
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

  const handleLoadStart = useCallback(() => {
    setLoading(true);
    setError(false);
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
    onError?.();
  }, [onError]);

  if (!uri) {
    return fallbackComponent ? <View style={containerStyle}>{fallbackComponent}</View> : null;
  }

  if (error && fallbackComponent) {
    return <View style={containerStyle}>{fallbackComponent}</View>;
  }

  return (
    <View style={[styles.container, containerStyle]} pointerEvents={pointerEvents || 'auto'}>
      <Image
        {...imageProps}
        source={{ uri, cache: 'default' }}
        style={style}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        {...(Platform.OS === 'ios' ? { progressiveRenderingEnabled: true } : { fadeDuration: 200 })}
      />
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
});

CachedImage.displayName = 'CachedImage';

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
