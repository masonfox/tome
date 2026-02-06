/**
 * Search Service
 * 
 * Orchestrates federated metadata search across multiple providers.
 * Implements parallel search with Promise.allSettled for resilience.
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 4, T068-T072)
 */

import { getLogger } from "@/lib/logger";
import type { IMetadataProvider, SearchResult } from "@/lib/providers/base/IMetadataProvider";
import { hardcoverProvider } from "@/lib/providers/hardcover.provider";
import { openLibraryProvider } from "@/lib/providers/openlibrary.provider";

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
 * Provides federated metadata search across Hardcover and OpenLibrary.
 * 
 * Features:
 * - Parallel search with Promise.allSettled (T068)
 * - Per-provider 5-second timeout (T069, implemented in providers)
 * - Graceful degradation when providers fail (T072)
 * - Result sorting by provider priority (Hardcover → OpenLibrary) (T071)
 * - Search result caching with 5-minute TTL (T070)
 */
class SearchService {
  private cache = new Map<string, { response: FederatedSearchResponse; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 100; // Limit cache size

  // Hardcoded provider priority per spec (T071)
  private readonly providers: IMetadataProvider[] = [
    hardcoverProvider, // Priority 1
    openLibraryProvider, // Priority 2
  ];

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

    // Check cache first (T070)
    const cached = this.getFromCache(query);
    if (cached) {
      logger.debug({ query }, "SearchService: Cache hit");
      return cached;
    }

    const startTime = Date.now();

    // Search all providers in parallel using Promise.allSettled (T068)
    const searchPromises = this.providers.map(async (provider) => {
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
      },
      "SearchService: Federated search complete"
    );

    // Cache the response (T070)
    this.addToCache(query, response);

    return response;
  }

  /**
   * Get cached search results
   */
  private getFromCache(query: string): FederatedSearchResponse | null {
    const cached = this.cache.get(query);
    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(query);
      return null;
    }

    return cached.response;
  }

  /**
   * Add search results to cache
   */
  private addToCache(query: string, response: FederatedSearchResponse): void {
    // Enforce cache size limit (LRU - remove oldest)
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(query, {
      response,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Clear search cache
   * 
   * Used when provider configuration changes (per spec T070)
   */
  clearCache(): void {
    logger.info("SearchService: Clearing search cache");
    this.cache.clear();
  }
}

// Export singleton instance
export const searchService = new SearchService();
