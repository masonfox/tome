/**
 * Calibre Provider
 * 
 * Provider implementation for Calibre library integration.
 * Wraps existing sync-service.ts functionality into the IMetadataProvider interface.
 * 
 * See: specs/003-non-calibre-books/research.md (Decision 1: Provider Interface)
 */

import { getLogger } from "@/lib/logger";
import { syncCalibreLibrary } from "@/lib/sync-service";
import type {
  IMetadataProvider,
  ProviderCapabilities,
  ProviderHealth,
  SyncResult as ProviderSyncResult,
  BookMetadata,
} from "@/lib/providers/base/IMetadataProvider";
import { getCalibreDB } from "@/lib/db/calibre";
import { bookRepository } from "@/lib/repositories/book.repository";

const logger = getLogger().child({ module: "calibre-provider" });

/**
 * Calibre Provider
 * 
 * Integrates with local Calibre library database for book synchronization.
 * 
 * Capabilities:
 * - hasSearch: false (Calibre doesn't have search API, only full sync)
 * - hasMetadataFetch: true (can fetch book metadata by calibreId)
 * - hasSync: true (full library synchronization)
 * - requiresAuth: false (local database access)
 */
class CalibreProvider implements IMetadataProvider {
  readonly id = "calibre" as const;
  readonly name = "Calibre Library";

  readonly capabilities: ProviderCapabilities = {
    hasSearch: false, // Calibre doesn't support search - only full sync
    hasMetadataFetch: true, // Can fetch by calibreId
    hasSync: true, // Full library sync
    requiresAuth: false, // Local database
  };

  /**
   * Fetch metadata for a Calibre book by calibreId
   * 
   * @param externalId - Calibre book ID (as string)
   * @returns Book metadata
   * @throws Error if book not found or calibreId invalid
   */
  async fetchMetadata(externalId: string): Promise<BookMetadata> {
    const calibreId = parseInt(externalId, 10);
    if (isNaN(calibreId)) {
      throw new Error(`Invalid Calibre ID: ${externalId}`);
    }

    logger.debug({ calibreId }, "Fetching Calibre book metadata");

    // Fetch book from Tome database (which syncs from Calibre)
    const book = await bookRepository.findByCalibreId(calibreId);
    if (!book) {
      throw new Error(`Book with Calibre ID ${calibreId} not found`);
    }

    // Map to BookMetadata format
    const metadata: BookMetadata = {
      title: book.title,
      authors: book.authors,
      isbn: book.isbn ?? undefined,
      description: book.description ?? undefined,
      publisher: book.publisher ?? undefined,
      pubDate: book.pubDate ?? undefined,
      totalPages: book.totalPages ?? undefined,
      series: book.series ?? undefined,
      seriesIndex: book.seriesIndex ?? undefined,
      externalId: String(calibreId),
      tags: book.tags,
      rating: book.rating ?? undefined,
    };

    logger.debug(
      { calibreId, title: metadata.title },
      "Successfully fetched Calibre metadata"
    );

    return metadata;
  }

  /**
   * Sync entire Calibre library
   * 
   * Delegates to existing syncCalibreLibrary() function.
   * 
   * @returns Sync statistics
   * @throws Error if sync fails
   */
  async sync(): Promise<ProviderSyncResult> {
    logger.info("Starting Calibre library sync");

    try {
      const result = await syncCalibreLibrary();

      if (!result.success) {
        throw new Error(result.error || "Calibre sync failed");
      }

      logger.info(
        {
          added: result.syncedCount,
          updated: result.updatedCount,
          removed: result.removedCount,
        },
        "Calibre library sync completed"
      );

      return {
        added: result.syncedCount,
        updated: result.updatedCount,
        removed: result.removedCount,
        errors: 0,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err.message }, "Calibre library sync failed");
      throw err;
    }
  }

  /**
   * Check Calibre database connectivity
   * 
   * @returns "healthy" if connection succeeds, "unavailable" otherwise
   */
  async healthCheck(): Promise<ProviderHealth> {
    try {
      const calibreDb = getCalibreDB();
      // Test with a simple query
      const result = calibreDb.prepare("SELECT 1 as test").get() as { test: number };
      return result.test === 1 ? "healthy" : "unavailable";
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Calibre health check failed"
      );
      return "unavailable";
    }
  }
}

// Export singleton instance
export const calibreProvider = new CalibreProvider();
