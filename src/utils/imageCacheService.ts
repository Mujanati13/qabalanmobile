import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@image_cache:';
const CACHE_EXPIRY_DAYS = 7;

/**
 * Image cache service for managing cached images
 */
class ImageCacheService {
  /**
   * Get the cache key for an image URI
   */
  private getCacheKey(uri: string): string {
    return `${CACHE_PREFIX}${uri}`;
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(timestamp: number): boolean {
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryTime;
  }

  /**
   * Get all cache keys
   */
  async getAllCacheKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys.filter(key => key.startsWith(CACHE_PREFIX));
    } catch (error) {
      console.error('Error getting cache keys:', error);
      return [];
    }
  }

  /**
   * Clear all expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    try {
      const cacheKeys = await this.getAllCacheKeys();
      let clearedCount = 0;

      for (const key of cacheKeys) {
        try {
          const cachedData = await AsyncStorage.getItem(key);
          if (cachedData) {
            const { timestamp } = JSON.parse(cachedData);
            if (this.isCacheExpired(timestamp)) {
              await AsyncStorage.removeItem(key);
              clearedCount++;
            }
          }
        } catch (error) {
          // Skip invalid cache entries
          await AsyncStorage.removeItem(key);
          clearedCount++;
        }
      }

      console.log(`✅ Cleared ${clearedCount} expired cache entries`);
      return clearedCount;
    } catch (error) {
      console.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  /**
   * Clear all image cache
   */
  async clearAllCache(): Promise<number> {
    try {
      const cacheKeys = await this.getAllCacheKeys();
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`✅ Cleared ${cacheKeys.length} cache entries`);
      return cacheKeys.length;
    } catch (error) {
      console.error('Error clearing all cache:', error);
      return 0;
    }
  }

  /**
   * Get cache size (number of cached items)
   */
  async getCacheSize(): Promise<number> {
    try {
      const cacheKeys = await this.getAllCacheKeys();
      return cacheKeys.length;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    total: number;
    expired: number;
    valid: number;
  }> {
    try {
      const cacheKeys = await this.getAllCacheKeys();
      let expiredCount = 0;

      for (const key of cacheKeys) {
        try {
          const cachedData = await AsyncStorage.getItem(key);
          if (cachedData) {
            const { timestamp } = JSON.parse(cachedData);
            if (this.isCacheExpired(timestamp)) {
              expiredCount++;
            }
          }
        } catch (error) {
          expiredCount++;
        }
      }

      return {
        total: cacheKeys.length,
        expired: expiredCount,
        valid: cacheKeys.length - expiredCount,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { total: 0, expired: 0, valid: 0 };
    }
  }
}

export default new ImageCacheService();
