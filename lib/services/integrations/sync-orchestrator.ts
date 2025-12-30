/**
 * Sync Orchestrator - Coordinates external service integrations
 *
 * Centralizes all external sync operations (Calibre, Goodreads, etc.) to:
 * - Decouple core business logic from external services
 * - Enable multiple sync targets
 * - Provide consistent error handling
 * - Facilitate testing via mocking
 *
 * @example
 * const orchestrator = new SyncOrchestrator();
 * const result = await orchestrator.syncRating(bookId, 5);
 * if (!result.success) {
 *   console.log('Partial failure:', result.errors);
 * }
 */

import { calibreService, type ICalibreService } from "../calibre.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ component: "SyncOrchestrator" });

/**
 * Result of a single sync operation
 */
export interface SyncResult {
  service: string;
  success: boolean;
  error?: Error;
}

/**
 * Aggregated sync results
 */
export interface AggregatedSyncResult {
  success: boolean;
  results: SyncResult[];
  errors: Error[];
}

/**
 * Configuration for sync behavior
 */
export interface SyncConfig {
  /** Whether to fail fast on first error or continue (default: false) */
  failFast?: boolean;
  /** Timeout for each sync operation in ms (default: 5000) */
  timeout?: number;
}

/**
 * Sync orchestrator for coordinating external service integrations
 */
export class SyncOrchestrator {
  private calibre: ICalibreService;
  private config: Required<SyncConfig>;

  constructor(calibre?: ICalibreService, config?: SyncConfig) {
    this.calibre = calibre ?? calibreService;
    this.config = {
      failFast: config?.failFast ?? false,
      timeout: config?.timeout ?? 5000,
    };
  }

  /**
   * Sync rating to all configured external services
   *
   * @param calibreId - The Calibre book ID
   * @param rating - Rating value (1-5) or null to remove
   * @returns Aggregated result from all sync operations
   *
   * @example
   * const result = await orchestrator.syncRating(123, 5);
   * if (result.success) {
   *   console.log('All services synced successfully');
   * } else {
   *   console.log(`${result.errors.length} services failed`);
   * }
   */
  async syncRating(calibreId: number, rating: number | null): Promise<AggregatedSyncResult> {
    logger.info({ calibreId, rating }, "Starting rating sync to external services");

    const syncOperations: Promise<SyncResult>[] = [];

    // Sync to Calibre
    syncOperations.push(
      this.syncToCalibre(calibreId, rating)
        .then(() => ({ service: "calibre", success: true }))
        .catch((error) => ({ service: "calibre", success: false, error }))
    );

    // Future: Add other services here
    // syncOperations.push(this.syncToGoodreads(bookId, rating));
    // syncOperations.push(this.syncToStoryGraph(bookId, rating));

    let results: SyncResult[];

    if (this.config.failFast) {
      // Fail fast - stop on first error
      try {
        results = [];
        for (const operation of syncOperations) {
          const result = await operation;
          results.push(result);
          if (!result.success) {
            throw result.error;
          }
        }
      } catch (error) {
        const failedResults = results.filter((r) => !r.success);
        return {
          success: false,
          results,
          errors: failedResults.map((r) => r.error!),
        };
      }
    } else {
      // Best effort - continue on errors
      results = await Promise.all(syncOperations);
    }

    const errors = results.filter((r) => !r.success).map((r) => r.error!);
    const success = errors.length === 0;

    if (success) {
      logger.info({ calibreId }, "Rating synced to all services successfully");
    } else {
      logger.warn(
        { calibreId, failedServices: results.filter((r) => !r.success).map((r) => r.service) },
        `Rating sync completed with ${errors.length} failure(s)`
      );
    }

    return {
      success,
      results,
      errors,
    };
  }

  /**
   * Sync to Calibre service
   */
  private async syncToCalibre(calibreId: number, rating: number | null): Promise<void> {
    try {
      await this.withTimeout(
        this.calibre.updateRating(calibreId, rating),
        this.config.timeout
      );
      logger.debug({ calibreId, rating }, "Calibre rating sync successful");
    } catch (error) {
      logger.error({ err: error, calibreId }, "Calibre rating sync failed");
      throw error;
    }
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Sync timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Future: Sync to Goodreads
   */
  // private async syncToGoodreads(bookId: number, rating: number | null): Promise<void> {
  //   // Implementation placeholder
  //   throw new Error("Goodreads sync not yet implemented");
  // }

  /**
   * Future: Sync to StoryGraph
   */
  // private async syncToStoryGraph(bookId: number, rating: number | null): Promise<void> {
  //   // Implementation placeholder
  //   throw new Error("StoryGraph sync not yet implemented");
  // }
}

/**
 * Singleton instance for application use
 */
export const syncOrchestrator = new SyncOrchestrator();
