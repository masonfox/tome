/**
 * Logging interceptor for API requests
 * 
 * Provides structured logging for API requests, responses, and errors.
 * In the browser, uses console.log for visibility. On the server, uses Pino logger.
 * Only active in development mode.
 */

import type { RequestInterceptor, RequestConfig, ApiError } from '../base-client';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Logging interceptor that logs all API requests, responses, and errors
 * 
 * Only logs in development mode to avoid noise in production.
 * Uses console.log in browser for immediate visibility.
 * 
 * @example
 * import { loggingInterceptor } from './interceptors/logging';
 * 
 * if (process.env.NODE_ENV === 'development') {
 *   baseApiClient.addInterceptor(loggingInterceptor);
 * }
 */
export const loggingInterceptor: RequestInterceptor = {
  onRequest: (config: RequestConfig) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') {
      return config;
    }

    if (isBrowser) {
      // Browser: use console.log for visibility
      console.log('[API Request]', {
        method: config.method,
        endpoint: config.endpoint,
        hasData: !!config.data,
        hasSignal: !!config.options?.signal,
        timestamp: new Date().toISOString()
      });
    } else {
      // Server: use Pino logger
      const { getLogger } = require('@/lib/logger');
      const logger = getLogger();
      logger.debug(
        { 
          method: config.method, 
          endpoint: config.endpoint, 
          hasData: !!config.data,
          hasSignal: !!config.options?.signal
        }, 
        'API request'
      );
    }
    
    return config;
  },

  onResponse: <T>(response: T) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') {
      return response;
    }

    if (isBrowser) {
      // Browser: use console.log for visibility
      console.log('[API Response]', {
        response,
        timestamp: new Date().toISOString()
      });
    } else {
      // Server: use Pino logger
      const { getLogger } = require('@/lib/logger');
      const logger = getLogger();
      logger.debug({ response }, 'API response');
    }
    
    return response;
  },

  onError: (error: ApiError) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') {
      return error;
    }

    if (isBrowser) {
      // Browser: use console.error for visibility
      console.error('[API Error]', {
        message: error.message,
        endpoint: error.endpoint,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: new Date().toISOString()
      });
    } else {
      // Server: use Pino logger
      const { getLogger } = require('@/lib/logger');
      const logger = getLogger();
      logger.error(
        { 
          err: error, 
          endpoint: error.endpoint, 
          statusCode: error.statusCode 
        }, 
        'API error'
      );
    }
    
    return error;
  },
};
