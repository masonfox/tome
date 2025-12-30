/**
 * Base API Client with error handling and type safety
 */

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Request/Response interceptor interface
 */
export interface RequestInterceptor {
  /** Called before making the request */
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  /** Called after receiving a successful response */
  onResponse?: <T>(response: T) => T | Promise<T>;
  /** Called when an error occurs */
  onError?: (error: ApiError) => ApiError | Promise<ApiError>;
}

/**
 * Request configuration
 */
export interface RequestConfig {
  method: string;
  endpoint: string;
  data?: any;
  headers: Record<string, string>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses: number[];
  /** Initial backoff delay in milliseconds (default: 1000) */
  initialBackoffMs: number;
  /** Whether to use exponential backoff (default: true) */
  useExponentialBackoff: boolean;
}

/**
 * Configuration for API client
 */
export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: Partial<RetryConfig>;
}

/**
 * Base API client with common HTTP functionality
 *
 * Provides type-safe wrappers around fetch() with:
 * - Automatic JSON serialization/deserialization
 * - Standardized error handling
 * - Timeout management
 * - Request/response interceptors
 * - Automatic retry with exponential backoff
 *
 * @example
 * const client = new BaseApiClient();
 * const data = await client.post<RequestType, ResponseType>('/api/books', { title: 'Test' });
 *
 * @example
 * // With interceptors
 * const client = new BaseApiClient();
 * client.addInterceptor({
 *   onRequest: (config) => {
 *     config.headers['X-Request-ID'] = generateId();
 *     return config;
 *   }
 * });
 */
export class BaseApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private interceptors: RequestInterceptor[] = [];
  private retryConfig: RetryConfig;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
    this.timeout = config.timeout ?? 30000; // 30 seconds default
    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 3,
      retryableStatuses: config.retry?.retryableStatuses ?? [408, 429, 500, 502, 503, 504],
      initialBackoffMs: config.retry?.initialBackoffMs ?? 1000,
      useExponentialBackoff: config.retry?.useExponentialBackoff ?? true,
    };
  }

  /**
   * Add an interceptor for request/response/error handling
   *
   * @param interceptor - The interceptor to add
   *
   * @example
   * client.addInterceptor({
   *   onRequest: (config) => {
   *     console.log('Request:', config.endpoint);
   *     return config;
   *   },
   *   onError: (error) => {
   *     console.error('Error:', error.message);
   *     return error;
   *   }
   * });
   */
  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
  }

  /**
   * Remove all interceptors
   */
  clearInterceptors(): void {
    this.interceptors = [];
  }

  /**
   * Make a typed GET request
   */
  protected async get<TResponse>(endpoint: string): Promise<TResponse> {
    return this.request<TResponse>("GET", endpoint);
  }

  /**
   * Make a typed POST request
   */
  protected async post<TRequest, TResponse>(
    endpoint: string,
    data?: TRequest
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", endpoint, data);
  }

  /**
   * Make a typed PATCH request
   */
  protected async patch<TRequest, TResponse>(
    endpoint: string,
    data?: TRequest
  ): Promise<TResponse> {
    return this.request<TResponse>("PATCH", endpoint, data);
  }

  /**
   * Make a typed DELETE request
   */
  protected async delete<TResponse>(endpoint: string): Promise<TResponse> {
    return this.request<TResponse>("DELETE", endpoint);
  }

  /**
   * Core request method with error handling, retries, and interceptors
   *
   * @throws {ApiError} When request fails or returns non-2xx status
   */
  private async request<TResponse>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<TResponse> {
    return this.requestWithRetry<TResponse>(method, endpoint, data, 0);
  }

  /**
   * Request with retry logic
   */
  private async requestWithRetry<TResponse>(
    method: string,
    endpoint: string,
    data: any,
    attemptNumber: number
  ): Promise<TResponse> {
    try {
      // Run request interceptors
      let config: RequestConfig = {
        method,
        endpoint,
        data,
        headers: { ...this.defaultHeaders },
      };

      for (const interceptor of this.interceptors) {
        if (interceptor.onRequest) {
          config = await interceptor.onRequest(config);
        }
      }

      // Execute the actual HTTP request
      const response = await this.executeRequest<TResponse>(
        config.method,
        config.endpoint,
        config.data,
        config.headers
      );

      // Run response interceptors
      let finalResponse = response;
      for (const interceptor of this.interceptors) {
        if (interceptor.onResponse) {
          finalResponse = await interceptor.onResponse(finalResponse);
        }
      }

      return finalResponse;
    } catch (error) {
      // Run error interceptors
      let finalError = error instanceof ApiError ? error : this.convertToApiError(error, endpoint);

      for (const interceptor of this.interceptors) {
        if (interceptor.onError) {
          finalError = await interceptor.onError(finalError);
        }
      }

      // Determine if we should retry
      const shouldRetry = this.shouldRetryRequest(finalError, attemptNumber);

      if (shouldRetry) {
        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attemptNumber);
        await this.sleep(delay);

        // Retry the request
        return this.requestWithRetry<TResponse>(method, endpoint, data, attemptNumber + 1);
      }

      throw finalError;
    }
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<TResponse>(
    method: string,
    endpoint: string,
    data: any,
    headers: Record<string, string>
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        let errorDetails;
        const contentType = response.headers.get("content-type");

        try {
          if (contentType?.includes("application/json")) {
            errorDetails = await response.json();
          } else {
            errorDetails = await response.text();
          }
        } catch {
          // If parsing fails, use status text
          errorDetails = response.statusText;
        }

        throw new ApiError(
          errorDetails?.error || `Request failed with status ${response.status}`,
          response.status,
          endpoint,
          errorDetails
        );
      }

      // Parse successful response
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      // Return empty object for 204 No Content
      if (response.status === 204) {
        return {} as TResponse;
      }

      // Return text for non-JSON responses
      return (await response.text()) as TResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      throw this.convertToApiError(error, endpoint);
    }
  }

  /**
   * Convert any error to ApiError
   */
  private convertToApiError(error: any, endpoint: string): ApiError {
    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return new ApiError(
        `Request timeout after ${this.timeout}ms`,
        408,
        endpoint
      );
    }

    // Handle network errors
    return new ApiError(
      error instanceof Error ? error.message : "Unknown error",
      0, // Network errors have no status code
      endpoint,
      error
    );
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetryRequest(error: ApiError, attemptNumber: number): boolean {
    // Don't retry if we've exhausted attempts
    if (attemptNumber >= this.retryConfig.maxRetries) {
      return false;
    }

    // Retry on specific status codes
    if (error.statusCode && this.retryConfig.retryableStatuses.includes(error.statusCode)) {
      return true;
    }

    // Retry on network errors (statusCode = 0)
    if (error.statusCode === 0) {
      return true;
    }

    return false;
  }

  /**
   * Calculate backoff delay based on attempt number
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    if (this.retryConfig.useExponentialBackoff) {
      // Exponential backoff: initialDelay * 2^attemptNumber
      return this.retryConfig.initialBackoffMs * Math.pow(2, attemptNumber);
    }

    // Linear backoff
    return this.retryConfig.initialBackoffMs;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance of BaseApiClient for general use
 */
export const baseApiClient = new BaseApiClient();
