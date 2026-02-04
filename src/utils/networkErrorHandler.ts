/**
 * Network Error Handling Utilities
 * Provides comprehensive error detection and handling for network requests
 */

export interface NetworkErrorInfo {
  isNetworkError: boolean;
  isServerError: boolean;
  isTimeoutError: boolean;
  errorType: 'network' | 'server' | 'timeout' | 'unknown';
  message: string;
  shouldRetry: boolean;
}

/**
 * Analyzes an error and returns detailed error information
 */
export const analyzeError = (error: any): NetworkErrorInfo => {
  if (!error) {
    return {
      isNetworkError: false,
      isServerError: false,
      isTimeoutError: false,
      errorType: 'unknown',
      message: 'Unknown error occurred',
      shouldRetry: false,
    };
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const errorString = error.toString().toLowerCase();
  const status = error.status || error.response?.status;

  // Check for network errors
  const isNetworkError = (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('no internet') ||
    errorMessage.includes('network request failed') ||
    errorString.includes('network request failed') ||
    error.code === 'NETWORK_ERROR' ||
    error.name === 'TypeError' && errorMessage.includes('fetch') ||
    error.name === 'NetworkError'
  );

  // Check for timeout errors
  const isTimeoutError = (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    error.code === 'TIMEOUT' ||
    error.name === 'TimeoutError'
  );

  // Check for server errors (5xx status codes)
  const isServerError = (
    status >= 500 ||
    error.code === 'SERVER_ERROR' ||
    errorMessage.includes('internal server error') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('bad gateway')
  );

  // Determine error type and message
  let errorType: 'network' | 'server' | 'timeout' | 'unknown' = 'unknown';
  let message = 'An unexpected error occurred';
  let shouldRetry = false;

  if (isTimeoutError) {
    errorType = 'timeout';
    message = 'Request timed out. Please check your connection and try again.';
    shouldRetry = true;
  } else if (isNetworkError) {
    errorType = 'network';
    message = 'Network connection failed. Please check your internet connection.';
    shouldRetry = true;
  } else if (isServerError) {
    errorType = 'server';
    message = 'Server is temporarily unavailable. Please try again later.';
    shouldRetry = true;
  } else if (status >= 400 && status < 500) {
    errorType = 'unknown';
    message = error.response?.data?.message || 'Request failed. Please try again.';
    shouldRetry = false;
  }

  return {
    isNetworkError,
    isServerError,
    isTimeoutError,
    errorType,
    message,
    shouldRetry,
  };
};

/**
 * Creates a standardized error response for UI components
 */
export const createErrorResponse = (error: any) => {
  const errorInfo = analyzeError(error);
  
  return {
    success: false,
    error: true,
    errorInfo,
    message: errorInfo.message,
    data: null,
  };
};

/**
 * Network connectivity checker
 */
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // Try to fetch a small resource to check connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Retry logic with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      const errorInfo = analyzeError(error);

      // Don't retry if it's not a retryable error
      if (!errorInfo.shouldRetry) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Wraps API calls with error handling and retry logic
 */
export const withErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    showErrors?: boolean;
  } = {}
): Promise<T | null> => {
  const { maxRetries = 2, baseDelay = 1000, showErrors = false } = options;

  try {
    return await retryWithBackoff(apiCall, maxRetries, baseDelay);
  } catch (error) {
    if (showErrors) {
      console.error('API call failed:', error);
    }
    return null;
  }
};

export default {
  analyzeError,
  createErrorResponse,
  checkNetworkConnectivity,
  retryWithBackoff,
  withErrorHandling,
};
