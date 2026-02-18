/**
 * Hardcover Provider
 * 
 * Provider implementation for Hardcover.app API integration (GraphQL).
 * Implements search and metadata fetch capabilities.
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 4)
 */

import { getLogger } from "@/lib/logger";
import { providerConfigRepository } from "@/lib/repositories/provider-config.repository";
import { parsePublishDate } from "@/utils/dateHelpers.server";
import type {
  IMetadataProvider,
  ProviderCapabilities,
  ProviderHealth,
  SearchResult,
  BookMetadata,
} from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "hardcover-provider" });

/**
 * Hardcover GraphQL API Response Types
 * 
 * Based on: https://docs.hardcover.app/api/guides/searching/
 * Backend: Typesense search index
 */

/**
 * Typesense search response wrapper (possible structure)
 * Hardcover uses Typesense for search, which may return results wrapped in metadata
 */
interface TypesenseSearchResponse {
  hits?: any[];
  documents?: any[];
  results?: any[];
  found: number;
  page: number;
  per_page?: number;
}

/**
 * Hardcover search GraphQL response
 * 
 * Note: results field can be:
 * - Array of stringified JSON objects (standard Typesense response)
 * - null/undefined (no results found)
 * - Object wrapper with nested arrays (alternative Typesense format)
 */
interface HardcoverSearchResponse {
  data: {
    search: {
      results: string[] | any[] | TypesenseSearchResponse | null;
      ids?: number[];
      query?: string;
      page?: number;
      per_page?: number;
    };
  };
  errors?: Array<{ message: string; extensions?: any }>;
}

/**
 * Hardcover book object from Typesense
 * (Subset of fields - only those we use for SearchResult mapping)
 */
interface HardcoverBook {
  id: number;
  title: string;
  author_names?: string[];
  isbns?: string[];
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
  release_year?: number;        // Year only (used as fallback)
  release_date?: string;        // Release date as string (YYYY-MM-DD format)
  pages?: number;
  contributions?: Array<{
    publisher?: {
      name: string;
    };
  }>;
}

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
   * Get API key from provider_configs database
   * 
   * Loads credentials at runtime for hot-reload capability.
   * No server restart required when API key is updated.
   */
  private async getApiKey(): Promise<string | null> {
    try {
      const config = await providerConfigRepository.findByProvider("hardcover");
      if (!config?.credentials) {
        return null;
      }
      
      // credentials is a JSON object: { apiKey: "..." }
      const credentials = config.credentials as Record<string, string>;
      return credentials.apiKey || null;
    } catch (error) {
      logger.error({ err: error }, "Failed to load Hardcover credentials");
      return null;
    }
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

    // Check for API key from database
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      logger.warn("Hardcover: API key not configured in provider settings");
      throw new Error("API key required. Configure in Settings → Providers → Hardcover.");
    }

    try {
      // GraphQL search query
      // Request additional fields for better debugging and validation
      const graphqlQuery = `
        query SearchBooks($query: String!) {
          search(query: $query, query_type: "Book", per_page: 25, page: 1) {
            results
            ids
            query
            page
            per_page
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

      const data: HardcoverSearchResponse = await response.json();

      if (data.errors) {
        logger.error({ errors: data.errors }, "Hardcover: GraphQL errors");
        throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
      }

      // Diagnostic logging to understand actual API response structure
      const searchResponseRaw = data.data?.search?.results;
      logger.debug({ 
        hasData: !!data.data,
        hasSearch: !!data.data?.search,
        resultsType: typeof searchResponseRaw,
        resultsIsArray: Array.isArray(searchResponseRaw),
        resultsLength: Array.isArray(searchResponseRaw) 
          ? searchResponseRaw.length 
          : 'N/A',
        sampleResult: Array.isArray(searchResponseRaw) && searchResponseRaw.length > 0 
          ? searchResponseRaw[0] 
          : null,
      }, "Hardcover: Raw API response structure");

      // Extract results with defensive type checking
      // Hardcover API returns Typesense response structure:
      // results: { hits: [{ document: {...} }], found: N, page: M }
      let results: any[] = [];
      const searchResponse = data.data?.search?.results;

      if (searchResponse === null || searchResponse === undefined) {
        logger.debug("Hardcover: Search returned null/undefined results");
        results = [];
      } else if (Array.isArray(searchResponse)) {
        // Legacy: results is directly an array (shouldn't happen with current API)
        results = searchResponse;
      } else if (typeof searchResponse === 'object') {
        // Standard Typesense wrapper: { hits: [{document: ...}], found: N }
        const hits = (searchResponse as any).hits || [];
        if (Array.isArray(hits)) {
          // Extract documents from hits
          results = hits.map((hit: any) => hit.document || hit);
          logger.debug({ 
            found: (searchResponse as any).found,
            hitsCount: hits.length,
            extractedCount: results.length 
          }, "Hardcover: Extracted results from Typesense wrapper");
        } else {
          // Fallback: check other possible array properties
          results = (searchResponse as any).documents || (searchResponse as any).results || [];
        }
      } else if (typeof searchResponse === 'string') {
        // Unexpected: entire results field is stringified
        try {
          const parsed = JSON.parse(searchResponse);
          results = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          logger.warn({ searchResponse }, "Hardcover: Failed to parse stringified results");
          results = [];
        }
      } else {
        logger.error({ 
          resultsType: typeof searchResponse,
          results: searchResponse 
        }, "Hardcover: Unexpected results type");
        results = [];
      }

      logger.debug({ 
        count: results.length,
        responseType: typeof searchResponse,
        isArray: Array.isArray(searchResponse)
      }, "Hardcover: Search complete");

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
   * 
   * Handles stringified JSON from Typesense and validates input is an array.
   */
  private parseSearchResults(results: any[]): SearchResult[] {
    // Safety check: ensure results is actually an array
    if (!Array.isArray(results)) {
      logger.error({ 
        resultsType: typeof results,
        results 
      }, "Hardcover: parseSearchResults called with non-array");
      return [];
    }

    if (results.length === 0) {
      logger.debug("Hardcover: No results to parse");
      return [];
    }

    return results
      .map((result: any) => {
        try {
          // Hardcover returns parsed objects (not stringified JSON)
          // but handle both cases for robustness
          const book = typeof result === "string" ? JSON.parse(result) : result;

          // Parse publication date:
          // 1. Try release_date (YYYY-MM-DD string format)
          // 2. Fall back to release_year (year only)
          const pubDate = parsePublishDate(book.release_date) 
            || (book.release_year ? parsePublishDate(book.release_year.toString()) : undefined);

          const searchResult: SearchResult = {
            externalId: book.id?.toString() || "",
            title: book.title || "Untitled",
            authors: book.author_names || [],
            isbn: book.isbns?.[0],
            publisher: book.contributions?.[0]?.publisher?.name,
            pubDate,
            coverImageUrl: book.image?.url,
            totalPages: book.pages,
          };
          
          return searchResult.externalId ? searchResult : null;
        } catch (parseError) {
          logger.warn({ 
            err: parseError, 
            result,
            resultType: typeof result 
          }, "Failed to parse search result");
          return null;
        }
      })
      .filter((r): r is SearchResult => r !== null);
  }

  /**
   * Fetch book metadata from Hardcover by book ID
   * 
   * Retrieves complete book details including description, tags, and publisher.
   * Implements 5-second timeout per spec (T069).
   * 
   * @param externalId - Hardcover book ID (numeric string)
   * @returns Complete book metadata
   * @throws Error if API fails, times out, API key missing, or book not found
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    logger.debug({ externalId }, "Hardcover: Fetching book metadata");

    // Check for API key from database
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      logger.warn("Hardcover: API key not configured in provider settings");
      throw new Error("API key required. Configure in Settings → Providers → Hardcover.");
    }

    try {
      // GraphQL query for complete book details
      const graphqlQuery = `
        query GetBook($id: Int!) {
          books(where: {id: {_eq: $id}}, limit: 1) {
            id
            title
            description
            pages
            release_date
            release_year
            image {
              url
            }
            contributions {
              author {
                name
              }
            }
            taggings {
              tag {
                tag
              }
            }
            editions(limit: 1, order_by: {users_count: desc}) {
              isbn_13
              publisher {
                name
              }
            }
            book_series(where: {featured: {_eq: true}}, limit: 1) {
              position
              series {
                name
              }
            }
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
          variables: { id: parseInt(externalId, 10) },
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

      const data: any = await response.json();

      if (data.errors) {
        logger.error({ errors: data.errors }, "Hardcover: GraphQL errors");
        throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown error"}`);
      }

      const books = data.data?.books;
      if (!books || !Array.isArray(books) || books.length === 0) {
        logger.warn({ externalId }, "Hardcover: Book not found");
        throw new Error(`Book not found: ${externalId}`);
      }

      const book = books[0];
      logger.debug({ externalId, bookId: book.id }, "Hardcover: Book metadata fetched");

      return this.mapToBookMetadata(book);
    } catch (error: any) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        logger.warn({ externalId }, "Hardcover: Fetch timeout (>5s)");
        throw new Error("Fetch timeout");
      }
      logger.error({ err: error, externalId }, "Hardcover: Fetch metadata failed");
      throw error;
    }
  }

  /**
   * Map Hardcover book data to BookMetadata format
   * 
   * Handles missing fields gracefully by returning undefined for optional fields.
   */
  private mapToBookMetadata(book: any): BookMetadata {
    // Parse publication date (prefer release_date, fallback to release_year)
    const pubDate = parsePublishDate(book.release_date) 
      || (book.release_year ? parsePublishDate(book.release_year.toString()) : undefined);

    // Parse tags from taggings relationship (limit to 50 tags, max 50 chars each)
    let tags: string[] | undefined;
    if (book.taggings && Array.isArray(book.taggings)) {
      const extractedTags = book.taggings
        .map((tagging: any) => tagging.tag?.tag)
        .filter((tag: any) => tag)
        .map((tag: string) => tag.substring(0, 50)) // Truncate to 50 chars
        .slice(0, 50); // Limit to 50 tags
      
      if (extractedTags.length < book.taggings.length) {
        logger.warn(`Tags truncated from ${book.taggings.length} to ${extractedTags.length} for book: ${book.title}`);
      }
      
      tags = extractedTags.length > 0 ? extractedTags : undefined;
    }

    // Extract publisher from editions (most popular edition)
    const publisher = book.editions?.[0]?.publisher?.name;

    // Extract ISBN from editions
    const isbn = book.editions?.[0]?.isbn_13;

    // Extract authors from contributions
    const authors = book.contributions && Array.isArray(book.contributions)
      ? book.contributions
          .map((contrib: any) => contrib.author?.name)
          .filter((name: any) => name)
      : [];

    // Extract series information from book_series (featured series only)
    let series: string | undefined;
    let seriesIndex: number | undefined;
    if (book.book_series && Array.isArray(book.book_series) && book.book_series.length > 0) {
      const featuredSeries = book.book_series[0]; // Already filtered by featured=true in query
      series = featuredSeries.series?.name;
      seriesIndex = featuredSeries.position ?? undefined;
      
      if (series) {
        logger.debug({ 
          bookId: book.id, 
          series, 
          seriesIndex 
        }, "Hardcover: Series information extracted");
      }
    }

    return {
      title: book.title || "Untitled",
      authors,
      isbn,
      description: book.description || undefined,
      publisher: publisher || undefined,
      pubDate,
      totalPages: book.pages,
      series,
      seriesIndex,
      tags,
      coverImageUrl: book.image?.url,
      externalId: book.id?.toString(),
    };
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
