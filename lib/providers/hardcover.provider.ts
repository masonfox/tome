/**
 * Hardcover Provider
 * 
 * Provider implementation for Hardcover.app API integration (GraphQL).
 * Implements search and metadata fetch capabilities.
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 4)
 */

import { getLogger } from "@/lib/logger";
import type {
  IMetadataProvider,
  ProviderCapabilities,
  ProviderHealth,
  SearchResult,
  BookMetadata,
} from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "hardcover-provider" });

/**
 * Hardcover Provider
 * 
 * GraphQL API integration for Hardcover.app book metadata.
 * 
 * Capabilities:
 * - hasSearch: true (search Hardcover catalog via Typesense)
 * - hasMetadataFetch: true (fetch book details by Hardcover ID)
 * - hasSync: false (no bulk sync - manual/search-based only)
 * - requiresAuth: false (public API, no auth required)
 * 
 * API Docs: https://docs.hardcover.app/api/getting-started
 */
class HardcoverProvider implements IMetadataProvider {
  readonly id = "hardcover" as const;
  readonly name = "Hardcover.app";

  readonly capabilities: ProviderCapabilities = {
    hasSearch: true,
    hasMetadataFetch: true,
    hasSync: false, // No bulk sync - users search and select individual books
    requiresAuth: true, // API key recommended for higher rate limits and full features
  };

  private readonly baseUrl = "https://api.hardcover.app/v1/graphql";

  /**
   * Get API key from environment or provider config
   * 
   * For now, checks process.env.HARDCOVER_API_KEY
   * TODO: Load from provider_configs table in future iteration
   */
  private getApiKey(): string | null {
    return process.env.HARDCOVER_API_KEY || null;
  }

  /**
   * Search Hardcover catalog via GraphQL API
   * 
   * Uses Hardcover's search endpoint with Typesense backend.
   * Implements 5-second timeout per spec (T069).
   * 
   * @param query - Search string (title, author, ISBN, etc.)
   * @returns Array of search results (max 25 per page)
   * @throws Error if API fails, times out, or API key is missing
   */
  async search(query: string): Promise<SearchResult[]> {
    logger.debug({ query }, "Hardcover: Starting search");

    // Check for API key
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn("Hardcover: API key not configured (set HARDCOVER_API_KEY environment variable)");
      throw new Error("API key required. Set HARDCOVER_API_KEY environment variable.");
    }

    try {
      // GraphQL search query
      const graphqlQuery = `
        query SearchBooks($query: String!) {
          search(query: $query, query_type: "Book", per_page: 25, page: 1) {
            results
          }
        }
      `;

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: { query },
        }),
        signal: AbortSignal.timeout(5000), // 5-second timeout per spec (T069)
      });

      if (!response.ok) {
        if (response.status === 401) {
          logger.error("Hardcover: Invalid API key");
          throw new Error("Invalid API key. Please check your HARDCOVER_API_KEY.");
        }
        if (response.status === 429) {
          logger.warn("Hardcover: Rate limit exceeded");
          throw new Error("Rate limit exceeded");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        logger.error({ errors: data.errors }, "Hardcover: GraphQL errors");
        throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
      }

      const results = data.data?.search?.results || [];
      logger.debug({ count: results.length }, "Hardcover: Search complete");

      return this.parseSearchResults(results);
    } catch (error: any) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        logger.warn({ query }, "Hardcover: Search timeout (>5s)");
        throw new Error("Search timeout");
      }
      logger.error({ err: error, query }, "Hardcover: Search failed");
      throw error;
    }
  }

  /**
   * Parse Hardcover search results into normalized SearchResult format
   */
  private parseSearchResults(results: any[]): SearchResult[] {
    return results
      .map((result: any) => {
        try {
          // Parse the JSON string (Typesense returns stringified JSON)
          const book = typeof result === "string" ? JSON.parse(result) : result;

          const searchResult: SearchResult = {
            externalId: book.id?.toString() || "",
            title: book.title || "Untitled",
            authors: book.author_names || [],
            isbn: book.isbns?.[0],
            publisher: book.contributions?.[0]?.publisher?.name,
            pubDate: book.release_year ? new Date(book.release_year, 0, 1) : undefined,
            coverImageUrl: book.image?.url,
          };
          
          return searchResult.externalId ? searchResult : null;
        } catch (parseError) {
          logger.warn({ err: parseError, result }, "Failed to parse search result");
          return null;
        }
      })
      .filter((r): r is SearchResult => r !== null);
  }

  /**
   * Fetch book metadata from Hardcover (NOT IMPLEMENTED)
   * 
   * @throws Error - Not implemented in stub
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    logger.warn(
      { externalId },
      "Hardcover fetchMetadata called but not yet implemented"
    );
    throw new Error(
      "Hardcover fetchMetadata not implemented - deferred to Phase 6"
    );
  }

  /**
   * Health check (stub - always healthy)
   * 
   * In full implementation, this would check Hardcover API availability.
   * 
   * @returns "healthy" (stub always returns healthy)
   */
  async healthCheck(): Promise<ProviderHealth> {
    logger.debug("Hardcover health check (stub - always healthy)");
    return "healthy";
  }
}

// Export singleton instance
export const hardcoverProvider = new HardcoverProvider();
