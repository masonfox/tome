/**
 * Logging interceptor for API requests
 * 
 * Provides structured logging for API requests, responses, and errors
 * using the project's Pino-based logger. Only active in development mode.
 */

import { getLogger } from '@/lib/logger';
import type { RequestInterceptor, RequestConfig, ApiError } from '../base-client';

/**
 * Logging interceptor that logs all API requests, responses, and errors
 * 
 * Only logs in development mode to avoid noise in production.
 * Follows the project's LOGGING_GUIDE.md conventions.
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
    
    return config;
  },

  onResponse: <T>(response: T) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') {
      return response;
    }

    const logger = getLogger();
    logger.debug({ response }, 'API response');
    
    return response;
  },

  onError: (error: ApiError) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'development') {
      return error;
    }

    const logger = getLogger();
    logger.error(
      { 
        err: error, 
        endpoint: error.endpoint, 
        statusCode: error.statusCode 
      }, 
      'API error'
    );
    
    return error;
  },
};
