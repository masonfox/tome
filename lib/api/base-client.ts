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
 * Configuration for API client
 */
export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Base API client with common HTTP functionality
 * 
 * Provides type-safe wrappers around fetch() with:
 * - Automatic JSON serialization/deserialization
 * - Standardized error handling
 * - Timeout management
 * - Request/response logging
 * 
 * @example
 * const client = new BaseApiClient();
 * const data = await client.post<RequestType, ResponseType>('/api/books', { title: 'Test' });
 */
export class BaseApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
    this.timeout = config.timeout ?? 30000; // 30 seconds default
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
   * Core request method with error handling
   * 
   * @throws {ApiError} When request fails or returns non-2xx status
   */
  private async request<TResponse>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.defaultHeaders,
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

      // Handle timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          `Request timeout after ${this.timeout}ms`,
          408,
          endpoint
        );
      }

      // Handle network errors
      throw new ApiError(
        error instanceof Error ? error.message : "Unknown error",
        0, // Network errors have no status code
        endpoint,
        error
      );
    }
  }
}

/**
 * Singleton instance of BaseApiClient for general use
 */
export const baseApiClient = new BaseApiClient();
