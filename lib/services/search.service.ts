/**
 * Search Service
 * 
 * Orchestrates federated metadata search across multiple providers.
 * Implements parallel search with Promise.allSettled for resilience.
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 4, T068-T072)
 */

import { getLogger } from "@/lib/logger";
import { providerService } from "@/lib/services/provider.service";
import type { IMetadataProvider, SearchResult } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "search-service" });

/**
 * Provider search result with metadata
 */
export interface ProviderSearchResult {
  provider: string; // 'hardcover' | 'openlibrary'
  results: SearchResult[];
  status: "success" | "error" | "timeout";
  error?: string;
  duration?: number; // milliseconds
}

/**
 * Federated search response
 */
export interface FederatedSearchResponse {
  query: string;
  results: ProviderSearchResult[];
  totalResults: number;
  successfulProviders: number;
  failedProviders: number;
}

/**
 * Search Service
 * 
 * Provides federated metadata search across enabled providers.
 * 
 * Features:
 * - Parallel search with Promise.allSettled (T068)
 * - Per-provider 5-second timeout (T069, implemented in providers)
 * - Graceful degradation when providers fail (T072)
 * - Result sorting by provider priority from database (T071)
 * - Search result caching with 5-minute TTL (T070)
 * - Respects provider enabled state from settings
 */
class SearchService {
  private cache = new Map<string, { response: FederatedSearchResponse; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 100; // Limit cache size

  /**
   * Federated search across all enabled providers
   * 
   * Searches multiple providers in parallel using Promise.allSettled.
   * Returns results even if some providers fail or timeout.
   * 
   * @param query - Search query string
   * @returns Federated search results with per-provider status
   */
  async federatedSearch(query: string): Promise<FederatedSearchResponse> {
    logger.info({ query }, "SearchService: Starting federated search");

    // Get enabled search providers (respects DB enabled state + priority)
    const providers = await providerService.getProvidersByCapability('hasSearch');
    
    // Create cache key that includes enabled provider IDs
    const cacheKey = this.getCacheKey(query, providers);

    // Check cache first (T070)
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug({ query, providers: providers.map(p => p.id) }, "SearchService: Cache hit");
      return cached;
    }

    if (providers.length === 0) {
      logger.warn({ query }, "SearchService: No enabled search providers");
      return {
        query,
        results: [],
        totalResults: 0,
        successfulProviders: 0,
        failedProviders: 0,
      };
    }

    const startTime = Date.now();

    // Search all enabled providers in parallel using Promise.allSettled (T068)
    const searchPromises = providers.map(async (provider) => {
      const providerStartTime = Date.now();
      
      try {
        logger.debug({ provider: provider.id }, "SearchService: Starting provider search");
        
        const results = await provider.search!(query);
        const duration = Date.now() - providerStartTime;
        
        logger.info(
          { provider: provider.id, count: results.length, duration },
          "SearchService: Provider search succeeded"
        );

        const providerResult: ProviderSearchResult = {
          provider: provider.id,
          results,
          status: "success",
          duration,
        };
        return providerResult;
      } catch (error: any) {
        const duration = Date.now() - providerStartTime;
        const isTimeout = error.message?.includes("timeout");
        
        logger.warn(
          { provider: provider.id, error: error.message, duration },
          "SearchService: Provider search failed"
        );

        const providerResult: ProviderSearchResult = {
          provider: provider.id,
          results: [],
          status: isTimeout ? "timeout" : "error",
          error: error.message || "Unknown error",
          duration,
        };
        return providerResult;
      }
    });

    // Wait for all providers (graceful degradation - T072)
    const settledResults = await Promise.allSettled(searchPromises);

    // Extract results (all should be fulfilled since we catch errors inside)
    const providerResults: ProviderSearchResult[] = settledResults.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      // This should never happen since we catch inside, but handle it anyway
      const errorResult: ProviderSearchResult = {
        provider: "unknown",
        results: [],
        status: "error",
        error: "Unexpected promise rejection",
      };
      return errorResult;
    });

    // Calculate statistics
    const totalResults = providerResults.reduce((sum, pr) => sum + pr.results.length, 0);
    const successfulProviders = providerResults.filter((pr) => pr.status === "success").length;
    const failedProviders = providerResults.filter((pr) => pr.status !== "success").length;

    const response: FederatedSearchResponse = {
      query,
      results: providerResults,
      totalResults,
      successfulProviders,
      failedProviders,
    };

    const totalDuration = Date.now() - startTime;
    logger.info(
      {
        query,
        totalResults,
        successfulProviders,
        failedProviders,
        totalDuration,
        enabledProviders: providers.map(p => p.id),
      },
      "SearchService: Federated search complete"
    );

    // Cache the response (T070)
    this.addToCache(cacheKey, response);

    return response;
  }

  /**
   * Generate cache key that includes query and enabled providers
   * 
   * This ensures cache is automatically invalidated when provider
   * enabled state changes (FR-011d-1)
   */
  private getCacheKey(query: string, providers: IMetadataProvider[]): string {
    const providerIds = providers.map(p => p.id).sort().join(',');
    return `${query}:${providerIds}`;
  }

  /**
   * Get cached search results
   */
  private getFromCache(cacheKey: string): FederatedSearchResponse | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  /**
   * Add search results to cache
   */
  private addToCache(cacheKey: string, response: FederatedSearchResponse): void {
    // Enforce cache size limit (LRU - remove oldest)
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, {
      response,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Clear search cache
   * 
   * Called when provider configuration changes (per spec FR-011d-1)
   */
  clearCache(): void {
    logger.info("SearchService: Clearing search cache");
    this.cache.clear();
  }
}

// Export singleton instance
export const searchService = new SearchService();
