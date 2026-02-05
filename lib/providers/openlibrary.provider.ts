/**
 * OpenLibrary Provider (Stub)
 * 
 * Provider implementation for OpenLibrary.org API integration.
 * Currently a stub - full implementation to be completed in Phase 7.
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

const logger = getLogger().child({ module: "openlibrary-provider" });

/**
 * OpenLibrary Provider (Stub)
 * 
 * Stub implementation for OpenLibrary.org integration.
 * 
 * Capabilities (future):
 * - hasSearch: true (search OpenLibrary catalog)
 * - hasMetadataFetch: true (fetch book details by OpenLibrary ID)
 * - hasSync: false (no bulk sync - manual/search-based only)
 * - requiresAuth: false (public API, no authentication required)
 */
class OpenLibraryProvider implements IMetadataProvider {
  readonly id = "openlibrary" as const;
  readonly name = "OpenLibrary";

  readonly capabilities: ProviderCapabilities = {
    hasSearch: true,
    hasMetadataFetch: true,
    hasSync: false, // No bulk sync - users search and select individual books
    requiresAuth: false, // Public API
  };

  /**
   * Search OpenLibrary catalog (NOT IMPLEMENTED)
   * 
   * @throws Error - Not implemented in stub
   */
  async search(query: string): Promise<SearchResult[]> {
    logger.warn({ query }, "OpenLibrary search called but not yet implemented");
    throw new Error(
      "OpenLibrary search not implemented - placeholder for Phase 7 (User Story 4)"
    );
  }

  /**
   * Fetch book metadata from OpenLibrary (NOT IMPLEMENTED)
   * 
   * @throws Error - Not implemented in stub
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    logger.warn(
      { externalId },
      "OpenLibrary fetchMetadata called but not yet implemented"
    );
    throw new Error(
      "OpenLibrary fetchMetadata not implemented - placeholder for Phase 7 (User Story 4)"
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
