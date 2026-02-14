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
   * Fetch book metadata from OpenLibrary by work ID
   * 
   * Retrieves complete book details including description, tags (subjects), and publisher.
   * Uses Works API for core metadata and Editions API for publisher.
   * Implements 5-second timeout per spec (T069).
   * 
   * @param externalId - OpenLibrary work ID (e.g., "OL27448W")
   * @returns Complete book metadata
   * @throws Error if API fails, times out, or work not found
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    logger.debug({ externalId }, "OpenLibrary: Fetching book metadata");

    try {
      // Fetch from Works API for description and subjects (tags)
      const workResponse = await fetch(`${this.baseUrl}/works/${externalId}.json`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Tome/1.0 (https://github.com/masonfox/tome)",
        },
        signal: AbortSignal.timeout(5000), // 5-second timeout per spec (T069)
      });

      if (!workResponse.ok) {
        if (workResponse.status === 404) {
          logger.warn({ externalId }, "OpenLibrary: Work not found");
          throw new Error(`Work not found: ${externalId}`);
        }
        if (workResponse.status === 429) {
          logger.warn("OpenLibrary: Rate limit exceeded");
          throw new Error("Rate limit exceeded");
        }
        throw new Error(`HTTP ${workResponse.status}: ${workResponse.statusText}`);
      }

      const workData = await workResponse.json();

      // Fetch editions to get publisher information
      const editionsResponse = await fetch(`${this.baseUrl}/works/${externalId}/editions.json`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Tome/1.0 (https://github.com/masonfox/tome)",
        },
        signal: AbortSignal.timeout(5000),
      });

      let publisher: string | undefined;
      if (editionsResponse.ok) {
        const editionsData = await editionsResponse.json();
        const firstEdition = editionsData.entries?.[0];
        if (firstEdition?.publishers?.[0]) {
          publisher = firstEdition.publishers[0];
        }
      } else {
        logger.warn({ externalId }, "OpenLibrary: Failed to fetch editions for publisher");
      }

      logger.debug({ externalId }, "OpenLibrary: Book metadata fetched");

      return this.mapToBookMetadata(workData, publisher, externalId);
    } catch (error: any) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        logger.warn({ externalId }, "OpenLibrary: Fetch timeout (>5s)");
        throw new Error("Fetch timeout");
      }
      logger.error({ err: error, externalId }, "OpenLibrary: Fetch metadata failed");
      throw error;
    }
  }

  /**
   * Map OpenLibrary work data to BookMetadata format
   * 
   * Handles missing fields gracefully by returning undefined for optional fields.
   * OpenLibrary description can be a string or an object with {type, value}.
   */
  private mapToBookMetadata(work: any, publisher: string | undefined, externalId: string): BookMetadata {
    // Parse description (can be string or object with value property)
    let description: string | undefined;
    if (work.description) {
      if (typeof work.description === 'string') {
        description = work.description;
      } else if (typeof work.description === 'object' && work.description.value) {
        description = work.description.value;
      }
    }

    // Extract subjects as tags
    const tags = work.subjects && Array.isArray(work.subjects) 
      ? work.subjects 
      : undefined;

    // Extract authors (they're references, need to extract names)
    let authors: string[] = [];
    if (work.authors && Array.isArray(work.authors)) {
      authors = work.authors
        .map((author: any) => author.name || author.author?.name)
        .filter((name: any) => name);
    }

    // Extract cover image from covers array
    let coverImageUrl: string | undefined;
    if (work.covers && Array.isArray(work.covers) && work.covers[0]) {
      coverImageUrl = `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`;
    }

    return {
      title: work.title || "Untitled",
      authors,
      isbn: undefined, // ISBN is in editions, not works
      description,
      publisher,
      pubDate: undefined, // Publish date is in editions, not works
      totalPages: undefined, // Page count is in editions, not works
      tags,
      coverImageUrl,
      externalId,
    };
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
