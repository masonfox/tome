/**
 * CalibreService - Service layer for Calibre database write operations
 * 
 * This service wraps the low-level calibre-write module functions to provide
 * a testable abstraction layer. By using a service class instead of direct
 * module imports, we avoid the need for mock.module() which is global and
 * permanent in Bun, causing test pollution.
 * 
 * Pattern: This follows the same approach as StreakService, which was created
 * to solve Bun's module caching issues (see TESTING_GUIDELINES.md).
 * 
 * Benefits:
 * - Eliminates need for mock.module() in tests
 * - Allows dependency injection in tests
 * - Prevents test pollution/leakage
 * - Makes dependencies explicit
 * - Easier to mock at the instance level
 * 
 * WRITE SAFETY:
 * ------------
 * All write operations respect Calibre database safety:
 * - Detect and handle SQLite BUSY/LOCKED errors
 * - Provide clear error messages with actionable guidance
 * - Log operations with structured context
 * - Require Calibre to be closed for tag operations
 * 
 * See docs/CALIBRE_SAFETY.md for complete safety documentation.
 * 
 * Usage in Production:
 * ```typescript
 * import { calibreService } from "@/lib/services/calibre.service";
 * 
 * await calibreService.updateRating(calibreId, 5);
 * await calibreService.updateTags(calibreId, ['Fiction', 'Fantasy']);
 * ```
 * 
 * Usage in Tests:
 * ```typescript
 * const mockCalibreService = {
 *   updateRating: mock(() => {}),
 *   updateTags: mock(() => {}),
 * };
 * 
 * const bookService = new BookService(mockCalibreService);
 * ```
 */

import { 
  updateCalibreRating as updateRatingImpl,
  updateCalibreTags as updateTagsImpl,
  batchUpdateCalibreTags as batchUpdateTagsImpl,
  readCalibreRating as readRatingImpl,
  readCalibreTags as readTagsImpl,
  type CalibreBatchResult,
} from "@/lib/db/calibre-write";

/**
 * Re-export types for convenience
 */
export type { CalibreBatchResult } from "@/lib/db/calibre-write";

/**
 * Interface for Calibre operations
 * Makes it easier to create test mocks
 */
export interface ICalibreService {
  updateRating(calibreId: number, rating: number | null): void;
  updateTags(calibreId: number, tags: string[]): void;
  batchUpdateTags(updates: Array<{ calibreId: number; tags: string[] }>): CalibreBatchResult;
  readRating(calibreId: number): number | null;
  readTags(calibreId: number): string[];
}

/**
 * CalibreService class - Wraps calibre-write module functions
 */
export class CalibreService implements ICalibreService {
  /**
   * Update book rating in Calibre database
   * 
   * @param calibreId - The Calibre book ID
   * @param rating - Rating value (1-5 stars) or null to remove rating
   * @throws Error if rating is invalid or database operation fails
   */
  updateRating(calibreId: number, rating: number | null): void {
    return updateRatingImpl(calibreId, rating);
  }

  /**
   * Update tags for a book in Calibre database
   * 
   * @param calibreId - The Calibre book ID
   * @param tags - Array of tag names to set for the book
   * @throws Error if tags are invalid or database operation fails
   */
  updateTags(calibreId: number, tags: string[]): void {
    return updateTagsImpl(calibreId, tags);
  }

  /**
   * Batch update tags for multiple books in Calibre database
   * 
   * @param updates - Array of {calibreId, tags} objects
   * @returns CalibreBatchResult with success count and detailed failure information
   * @throws Error if batch operation fails catastrophically
   */
  batchUpdateTags(updates: Array<{ calibreId: number; tags: string[] }>): CalibreBatchResult {
    return batchUpdateTagsImpl(updates);
  }

  /**
   * Read current rating from Calibre database
   * 
   * @param calibreId - The Calibre book ID
   * @returns Rating value (1-5 stars) or null if no rating
   */
  readRating(calibreId: number): number | null {
    return readRatingImpl(calibreId);
  }

  /**
   * Read current tags from Calibre database
   * 
   * @param calibreId - The Calibre book ID
   * @returns Array of tag names
   */
  readTags(calibreId: number): string[] {
    return readTagsImpl(calibreId);
  }
}

/**
 * Default service instance
 * Use this in production code
 */
export const calibreService = new CalibreService();
