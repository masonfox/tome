/**
 * Hardcover Provider (Stub)
 * 
 * Provider implementation for Hardcover.app API integration.
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

const logger = getLogger().child({ module: "hardcover-provider" });

/**
 * Hardcover Provider (Stub)
 * 
 * Stub implementation for Hardcover.app integration.
 * 
 * Capabilities (future):
 * - hasSearch: true (search Hardcover catalog)
 * - hasMetadataFetch: true (fetch book details by Hardcover ID)
 * - hasSync: false (no bulk sync - manual/search-based only)
 * - requiresAuth: false (public API, no auth required initially)
 * 
 * Note: requiresAuth may become true if we need API keys for higher rate limits
 */
class HardcoverProvider implements IMetadataProvider {
  readonly id = "hardcover" as const;
  readonly name = "Hardcover.app";

  readonly capabilities: ProviderCapabilities = {
    hasSearch: true,
    hasMetadataFetch: true,
    hasSync: false, // No bulk sync - users search and select individual books
    requiresAuth: false, // May change to true if API keys needed
  };

  /**
   * Search Hardcover catalog (NOT IMPLEMENTED)
   * 
   * @throws Error - Not implemented in stub
   */
  async search(query: string): Promise<SearchResult[]> {
    logger.warn({ query }, "Hardcover search called but not yet implemented");
    throw new Error(
      "Hardcover search not implemented - placeholder for Phase 7 (User Story 4)"
    );
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
      "Hardcover fetchMetadata not implemented - placeholder for Phase 7 (User Story 4)"
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
