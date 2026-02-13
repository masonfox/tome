/**
 * OpenLibrary Provider
 * 
 * Provider implementation for OpenLibrary.org API integration (REST).
 * Implements search and metadata fetch capabilities.
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 4)
 */

import { getLogger } from "@/lib/logger";
import { parsePublishDate } from "@/utils/dateHelpers.server";
import type {
  IMetadataProvider,
  ProviderCapabilities,
  ProviderHealth,
  SearchResult,
  BookMetadata,
} from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "openlibrary-provider" });

/**
 * OpenLibrary Provider
 * 
 * REST API integration for OpenLibrary.org book metadata.
 * 
 * Capabilities:
 * - hasSearch: true (search OpenLibrary catalog via Solr)
 * - hasMetadataFetch: true (fetch book details by OpenLibrary work ID)
 * - hasSync: false (no bulk sync - manual/search-based only)
 * - requiresAuth: false (public API, no authentication required)
 * 
 * API Docs: https://openlibrary.org/dev/docs/api/search
 */
class OpenLibraryProvider implements IMetadataProvider {
  readonly id = "openlibrary" as const;
  readonly name = "Open Library";

  readonly capabilities: ProviderCapabilities = {
    hasSearch: true,
    hasMetadataFetch: true,
    hasSync: false, // No bulk sync - users search and select individual books
    requiresAuth: false, // Public API
  };

  private readonly baseUrl = "https://openlibrary.org";

  /**
   * Search OpenLibrary catalog via REST API
   * 
   * Uses OpenLibrary's Solr search endpoint.
   * Implements 5-second timeout per spec (T069).
   * 
   * @param query - Search string (title, author, ISBN, etc.)
   * @returns Array of search results (max 25)
   * @throws Error if API fails or times out
   */
  async search(query: string): Promise<SearchResult[]> {
    logger.debug({ query }, "OpenLibrary: Starting search");

    try {
      const params = new URLSearchParams({
        q: query,
        limit: "25",
        fields: "key,title,author_name,publish_date,isbn,publisher,cover_i,number_of_pages_median",
      });

      const response = await fetch(`${this.baseUrl}/search.json?${params}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          // User-Agent recommended by OpenLibrary API docs
          "User-Agent": "Tome/1.0 (https://github.com/masonfox/tome)",
        },
        signal: AbortSignal.timeout(5000), // 5-second timeout per spec (T069)
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn("OpenLibrary: Rate limit exceeded");
          throw new Error("Rate limit exceeded");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const docs = data.docs || [];
      
      logger.debug({ count: docs.length }, "OpenLibrary: Search complete");

      return this.parseSearchResults(docs);
    } catch (error: any) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        logger.warn({ query }, "OpenLibrary: Search timeout (>5s)");
        throw new Error("Search timeout");
      }
      logger.error({ err: error, query }, "OpenLibrary: Search failed");
      throw error;
    }
  }

  /**
   * Parse OpenLibrary search results into normalized SearchResult format
   */
  private parseSearchResults(docs: any[]): SearchResult[] {
    return docs
      .map((doc: any) => {
        try {
          // Extract work ID from key (e.g., "/works/OL27448W" -> "OL27448W")
          const workId = doc.key?.split("/").pop() || "";
          
          const searchResult: SearchResult = {
            externalId: workId,
            title: doc.title || "Untitled",
            authors: doc.author_name || [],
            isbn: doc.isbn?.[0],
            publisher: doc.publisher?.[0],
            pubDate: parsePublishDate(doc.publish_date?.[0]),
            coverImageUrl: doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : undefined,
            totalPages: doc.number_of_pages_median,
          };

          return searchResult.externalId ? searchResult : null;
        } catch (parseError) {
          logger.warn({ err: parseError, doc }, "Failed to parse search result");
          return null;
        }
      })
      .filter((r): r is SearchResult => r !== null);
  }

  /**
   * Fetch book metadata from OpenLibrary (NOT IMPLEMENTED)
   * 
   * @throws Error - Not implemented yet
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    logger.warn(
      { externalId },
      "OpenLibrary fetchMetadata called but not yet implemented"
    );
    throw new Error(
      "OpenLibrary fetchMetadata not implemented - deferred to Phase 6"
    );
  }

  /**
   * Health check (stub - always healthy)
   * 
   * In full implementation, this would check OpenLibrary API availability.
   * 
   * @returns "healthy" (stub always returns healthy)
   */
  async healthCheck(): Promise<ProviderHealth> {
    logger.debug("OpenLibrary health check (stub - always healthy)");
    return "healthy";
  }
}

// Export singleton instance
export const openLibraryProvider = new OpenLibraryProvider();
