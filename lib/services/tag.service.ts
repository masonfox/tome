import { bookRepository } from "@/lib/repositories";
import type { Book } from "@/lib/db/schema/books";
import type { ICalibreService } from "@/lib/services/calibre.service";

/**
 * Result of a tag operation with detailed success/failure information
 */
export interface TagOperationResult {
  totalBooks: number;
  successCount: number;
  failureCount: number;
  calibreFailures: Array<{
    calibreId: number;
    bookId?: number;
    title?: string;
    error: string;
  }>;
  tomeFailures: Array<{
    bookId: number;
    error: string;
  }>;
}

/**
 * TagService - Handles tag management and Calibre synchronization
 * 
 * Responsibilities:
 * - Tag queries (list, stats, search)
 * - Single book tag updates
 * - Bulk tag operations (merge, rename, delete)
 * - Calibre bidirectional sync with Write-Through Cache pattern
 */
export class TagService {
  private calibre?: ICalibreService;
  
  constructor(calibre?: ICalibreService) {
    this.calibre = calibre;
  }
  
  /**
   * Get the Calibre service instance (lazy loaded to support test mocking)
   * Always re-imports to ensure test mocks are applied correctly
   */
  private getCalibreService(): ICalibreService {
    if (this.calibre) {
      return this.calibre;
    }
    // Lazy import to ensure mocks are applied before the module is loaded
    // Don't cache the result - always get fresh reference to support test mocking
    const { calibreService } = require("@/lib/services/calibre.service");
    return calibreService;
  }

  /**
   * Get all unique tags from all books in the library
   * 
   * Tags are extracted from the books.tags array field and deduplicated.
   * Useful for filter dropdowns and tag clouds.
   * 
   * @returns Promise resolving to array of unique tag strings, sorted alphabetically
   * 
   * @example
   * const tags = await tagService.getAllTags();
   * // returns: ['fiction', 'non-fiction', 'sci-fi', ...]
   */
  async getAllTags(): Promise<string[]> {
    return bookRepository.getAllTags();
  }

  /**
   * Get tag statistics with book counts
   * 
   * @returns Promise resolving to array of tags with their book counts
   * @example
   * const stats = await tagService.getTagStats();
   * // returns: [{ name: "fantasy", bookCount: 23 }, ...]
   */
  async getTagStats(): Promise<Array<{ name: string; bookCount: number }>> {
    return bookRepository.getTagStats();
  }

  /**
   * Get count of unique books that have at least one tag
   * 
   * @returns Promise resolving to count of books with tags
   * @example
   * const count = await tagService.countBooksWithTags();
   * // returns: 245
   */
  async countBooksWithTags(): Promise<number> {
    return bookRepository.countBooksWithTags();
  }

  /**
   * Get all books with a specific tag
   * 
   * @param tagName - The tag name to filter by
   * @param limit - Maximum number of books to return (default: 50)
   * @param skip - Number of books to skip for pagination (default: 0)
   * @returns Promise resolving to object with books array and total count
   */
  async getBooksByTag(
    tagName: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<{ books: Book[]; total: number }> {
    return bookRepository.findByTag(tagName, limit, skip);
  }

  /**
   * Update tags for a book and sync to Calibre
   * 
   * Uses Write-Through Cache pattern: Write to Calibre FIRST (source of truth),
   * then update Tome to match. This prevents race conditions where the watcher
   * might sync stale data back from Calibre.
   * 
   * @param bookId - The Tome book ID
   * @param tags - Array of tag names to set for the book
   * @returns Promise resolving to the updated book
   * @throws {Error} If book not found or sync fails (including Calibre write failure)
   * 
   * @example
   * const book = await tagService.updateBookTags(123, ["Fiction", "Fantasy"]);
   */
  async updateBookTags(bookId: number, tags: string[]): Promise<Book> {
    // Validate tags
    if (!Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    logger.info({ bookId, tags }, "[UPDATE_TAGS] Starting tag update operation");

    // Get book to find calibreId
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    // Use write-through cache helper to ensure consistency
    await this.syncWithCalibreWriteThrough(
      "UPDATE_TAGS",
      [book],
      (books: Book[]) => books.map((b: Book) => ({ calibreId: b.calibreId, tags })),
      async () => {
        const updated = await bookRepository.update(bookId, { tags });
        if (!updated) {
          throw new Error("Failed to update tags in Tome database");
        }
        return updated;
      }
    );

    // Re-fetch to return the updated book
    const updated = await bookRepository.findById(bookId);
    if (!updated) {
      throw new Error("Book not found after update");
    }

    logger.info({ bookId, tags }, "[UPDATE_TAGS] Tag update completed successfully");
    return updated;
  }

  /**
   * Merge multiple source tags into a target tag and sync to Calibre
   * 
   * Uses Write-Through Cache pattern: Write to Calibre FIRST (source of truth),
   * then update Tome to match. This prevents race conditions where the watcher
   * might sync stale data back from Calibre.
   * 
   * @param sourceTags - Array of tag names to merge from
   * @param targetTag - The tag name to merge into
   * @returns Promise resolving to detailed operation result
   * @throws {Error} Only if operation completely fails (0 successes)
   */
  async mergeTags(sourceTags: string[], targetTag: string): Promise<TagOperationResult> {
    // Validate inputs
    if (!Array.isArray(sourceTags) || sourceTags.length === 0) {
      throw new Error("Source tags must be a non-empty array");
    }

    if (!targetTag) {
      throw new Error("Target tag cannot be empty");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    logger.info({ sourceTags, targetTag }, "[MERGE] Starting tag merge operation");

    // Suspend the Calibre watcher during merge to prevent interference
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    logger.info("[MERGE] Calibre watcher suspended");
    
    try {
      // STEP 1: Get affected books BEFORE making any changes (fetch books with any of the source tags)
      logger.info({ sourceTags }, "[MERGE] Finding books with source tags");
      const affectedBooksMap = new Map<number, Book>();
      
      for (const sourceTag of sourceTags) {
        const result = await bookRepository.findByTag(sourceTag, 1000, 0);
        for (const book of result.books) {
          affectedBooksMap.set(book.id, book);
        }
      }
      
      const affectedBooks = Array.from(affectedBooksMap.values());
      logger.info({ bookCount: affectedBooks.length, sourceTags }, "[MERGE] Found books to update");

      if (affectedBooks.length === 0) {
        logger.info({ sourceTags }, "[MERGE] No books found with source tags, nothing to merge");
        return {
          totalBooks: 0,
          successCount: 0,
          failureCount: 0,
          calibreFailures: [],
          tomeFailures: []
        };
      }

      // STEP 2: Calculate new tags for each book (merge logic)
      const calibreUpdates = affectedBooks.map(book => {
        const currentTags = book.tags || [];
        // Remove source tags and add target tag
        let newTags = currentTags.filter(tag => !sourceTags.includes(tag));
        // Add target tag if not already present (deduplication)
        if (!newTags.includes(targetTag)) {
          newTags.push(targetTag);
        }
        return {
          calibreId: book.calibreId,
          tags: newTags
        };
      });

      // STEP 3: Write to Calibre FIRST (source of truth)
      logger.info({ bookCount: calibreUpdates.length }, "[MERGE] Writing merged tags to Calibre (source of truth)");
      const calibreResult = this.getCalibreService().batchUpdateTags(calibreUpdates);
      
      logger.info(
        { 
          successCount: calibreResult.successCount, 
          failureCount: calibreResult.failures.length 
        }, 
        "[MERGE] Calibre batch update completed"
      );

      // Create a map of calibreId to book for enriching failure details
      const calibreIdToBook = new Map(affectedBooks.map(b => [b.calibreId, b]));
      
      // Enrich failure details with book titles
      const calibreFailures = calibreResult.failures.map(f => {
        const book = calibreIdToBook.get(f.calibreId);
        return {
          calibreId: f.calibreId,
          bookId: book?.id,
          title: book?.title,
          error: f.error
        };
      });

      // If all Calibre updates failed, throw error
      if (calibreResult.successCount === 0) {
        logger.error({ calibreFailures }, "[MERGE] All Calibre updates failed - aborting");
        throw new Error(
          `Failed to merge tags in Calibre: All ${calibreResult.totalAttempted} books failed. ` +
          `First error: ${calibreFailures[0]?.error || 'Unknown error'}`
        );
      }

      // STEP 4: Update Tome database to match Calibre (even with partial success)
      logger.info({ sourceTags, targetTag }, "[MERGE] Updating Tome database to match Calibre");
      
      let booksUpdated = 0;
      const tomeFailures: Array<{ bookId: number; error: string }> = [];
      
      try {
        booksUpdated = await bookRepository.mergeTags(sourceTags, targetTag);
        logger.info({ sourceTags, targetTag, booksUpdated }, "[MERGE] Updated Tome database");
      } catch (error) {
        logger.error({ err: error, sourceTags, targetTag }, "[MERGE] Failed to update Tome database");
        // If Tome update fails but Calibre succeeded, log but don't fail the whole operation
        // The watcher will eventually sync this back
        tomeFailures.push({
          bookId: 0, // Bulk operation, can't identify specific book
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const result: TagOperationResult = {
        totalBooks: affectedBooks.length,
        successCount: calibreResult.successCount,
        failureCount: calibreFailures.length,
        calibreFailures,
        tomeFailures
      };

      if (calibreFailures.length > 0) {
        logger.warn(
          { 
            successCount: result.successCount,
            failureCount: result.failureCount 
          }, 
          "[MERGE] Tag merge completed with partial success"
        );
      } else {
        logger.info({ booksUpdated }, "[MERGE] Tag merge completed successfully");
      }

      return result;
    } finally {
      // Resume with ignore period to prevent watcher from re-syncing our own changes
      calibreWatcher.resumeWithIgnorePeriod(3000);
      logger.info("[MERGE] Calibre watcher resumed with 3s ignore period");
    }
  }

  /**
   * Rename a tag across all books and sync to Calibre
   * 
   * Uses Write-Through Cache pattern: Write to Calibre FIRST (source of truth),
   * then update Tome to match. This prevents race conditions where the watcher
   * might sync stale data back from Calibre.
   * 
   * @param oldName - The current tag name
   * @param newName - The new tag name
   * @returns Promise resolving to detailed operation result
   * @throws {Error} Only if operation completely fails (0 successes)
   */
  async renameTag(oldName: string, newName: string): Promise<TagOperationResult> {
    // Validate inputs
    if (!oldName || !newName) {
      throw new Error("Tag names cannot be empty");
    }

    if (oldName === newName) {
      throw new Error("Old and new tag names must be different");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    logger.info({ oldName, newName }, "[RENAME] Starting tag rename operation");

    // Suspend the Calibre watcher during rename to prevent race conditions
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    logger.info("[RENAME] Calibre watcher suspended");
    
    try {
      // STEP 1: Get affected books BEFORE making any changes
      logger.info({ oldName }, "[RENAME] Finding books with old tag name");
      const booksWithTag = await bookRepository.findByTag(oldName, 1000, 0);
      logger.info({ bookCount: booksWithTag.books.length }, "[RENAME] Found books to update");

      if (booksWithTag.books.length === 0) {
        logger.info({ oldName }, "[RENAME] No books found with old tag, nothing to rename");
        return {
          totalBooks: 0,
          successCount: 0,
          failureCount: 0,
          calibreFailures: [],
          tomeFailures: []
        };
      }

      // STEP 2: Calculate new tags for each book (rename logic)
      const calibreUpdates = booksWithTag.books.map(book => {
        const currentTags = book.tags || [];
        // Replace old tag with new tag
        const newTags = currentTags.map(tag => tag === oldName ? newName : tag);
        return {
          calibreId: book.calibreId,
          tags: newTags
        };
      });

      // STEP 3: Write to Calibre FIRST (source of truth)
      logger.info({ bookCount: calibreUpdates.length }, "[RENAME] Writing renamed tags to Calibre (source of truth)");
      const calibreResult = this.getCalibreService().batchUpdateTags(calibreUpdates);
      
      logger.info(
        { 
          successCount: calibreResult.successCount, 
          failureCount: calibreResult.failures.length 
        }, 
        "[RENAME] Calibre batch update completed"
      );

      // Create a map of calibreId to book for enriching failure details
      const calibreIdToBook = new Map(booksWithTag.books.map(b => [b.calibreId, b]));
      
      // Enrich failure details with book titles
      const calibreFailures = calibreResult.failures.map(f => {
        const book = calibreIdToBook.get(f.calibreId);
        return {
          calibreId: f.calibreId,
          bookId: book?.id,
          title: book?.title,
          error: f.error
        };
      });

      // If all Calibre updates failed, throw error
      if (calibreResult.successCount === 0) {
        logger.error({ calibreFailures }, "[RENAME] All Calibre updates failed - aborting");
        throw new Error(
          `Failed to rename tag in Calibre: All ${calibreResult.totalAttempted} books failed. ` +
          `First error: ${calibreFailures[0]?.error || 'Unknown error'}`
        );
      }

      // STEP 4: Update Tome database to match Calibre (even with partial success)
      logger.info({ oldName, newName }, "[RENAME] Updating Tome database to match Calibre");
      
      let booksUpdated = 0;
      const tomeFailures: Array<{ bookId: number; error: string }> = [];
      
      try {
        booksUpdated = await bookRepository.renameTag(oldName, newName);
        logger.info({ oldName, newName, booksUpdated }, "[RENAME] Updated Tome database");
      } catch (error) {
        logger.error({ err: error, oldName, newName }, "[RENAME] Failed to update Tome database");
        tomeFailures.push({
          bookId: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const result: TagOperationResult = {
        totalBooks: booksWithTag.books.length,
        successCount: calibreResult.successCount,
        failureCount: calibreFailures.length,
        calibreFailures,
        tomeFailures
      };

      if (calibreFailures.length > 0) {
        logger.warn(
          { 
            successCount: result.successCount,
            failureCount: result.failureCount 
          }, 
          "[RENAME] Tag rename completed with partial success"
        );
      } else {
        logger.info({ booksUpdated }, "[RENAME] Tag rename completed successfully");
      }

      return result;
    } finally {
      // Resume with ignore period to prevent watcher from re-syncing our own changes
      calibreWatcher.resumeWithIgnorePeriod(3000);
      logger.info("[RENAME] Calibre watcher resumed with 3s ignore period");
    }
  }

  /**
   * Delete a tag from all books and sync to Calibre
   * 
   * Uses Write-Through Cache pattern: Write to Calibre FIRST (source of truth),
   * then update Tome to match. This prevents race conditions where the watcher
   * might sync stale data back from Calibre.
   * 
   * @param tagName - The tag name to delete
   * @returns Promise resolving to detailed operation result
   * @throws {Error} Only if operation completely fails (0 successes)
   */
  async deleteTag(tagName: string): Promise<TagOperationResult> {
    // Validate input
    if (!tagName) {
      throw new Error("Tag name cannot be empty");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    logger.info({ tagName }, "[DELETE] Starting tag deletion");

    // Suspend the Calibre watcher during delete to prevent interference
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    logger.info("[DELETE] Calibre watcher suspended");

    try {
      // STEP 1: Get books with this tag before deletion
      logger.info({ tagName }, "[DELETE] Fetching books with tag");
      const booksWithTag = await bookRepository.findByTag(tagName, 1000, 0);
      logger.info({ tagName, bookCount: booksWithTag.books.length }, "[DELETE] Found books with tag");

      if (booksWithTag.books.length === 0) {
        logger.info({ tagName }, "[DELETE] No books found with tag, nothing to delete");
        return {
          totalBooks: 0,
          successCount: 0,
          failureCount: 0,
          calibreFailures: [],
          tomeFailures: []
        };
      }

      // STEP 2: Calculate new tags for each book (remove the tag)
      const calibreUpdates = booksWithTag.books.map(book => {
        const currentTags = book.tags || [];
        const newTags = currentTags.filter(tag => tag !== tagName);
        return {
          calibreId: book.calibreId,
          tags: newTags
        };
      });

      // STEP 3: Write to Calibre FIRST (source of truth)
      logger.info({ bookCount: calibreUpdates.length }, "[DELETE] Writing tag deletion to Calibre (source of truth)");
      const calibreResult = this.getCalibreService().batchUpdateTags(calibreUpdates);
      
      logger.info(
        { 
          successCount: calibreResult.successCount, 
          failureCount: calibreResult.failures.length 
        }, 
        "[DELETE] Calibre batch update completed"
      );

      // Create a map of calibreId to book for enriching failure details
      const calibreIdToBook = new Map(booksWithTag.books.map(b => [b.calibreId, b]));
      
      // Enrich failure details with book titles
      const calibreFailures = calibreResult.failures.map(f => {
        const book = calibreIdToBook.get(f.calibreId);
        return {
          calibreId: f.calibreId,
          bookId: book?.id,
          title: book?.title,
          error: f.error
        };
      });

      // If all Calibre updates failed, throw error
      if (calibreResult.successCount === 0) {
        logger.error({ calibreFailures }, "[DELETE] All Calibre updates failed - aborting");
        throw new Error(
          `Failed to delete tag in Calibre: All ${calibreResult.totalAttempted} books failed. ` +
          `First error: ${calibreFailures[0]?.error || 'Unknown error'}`
        );
      }

      // STEP 4: Update Tome database to match Calibre (even with partial success)
      logger.info({ tagName }, "[DELETE] Updating Tome database to match Calibre");
      
      let booksUpdated = 0;
      const tomeFailures: Array<{ bookId: number; error: string }> = [];
      
      try {
        booksUpdated = await bookRepository.deleteTag(tagName);
        logger.info({ tagName, booksUpdated }, "[DELETE] Updated Tome database");
      } catch (error) {
        logger.error({ err: error, tagName }, "[DELETE] Failed to update Tome database");
        tomeFailures.push({
          bookId: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const result: TagOperationResult = {
        totalBooks: booksWithTag.books.length,
        successCount: calibreResult.successCount,
        failureCount: calibreFailures.length,
        calibreFailures,
        tomeFailures
      };

      if (calibreFailures.length > 0) {
        logger.warn(
          { 
            successCount: result.successCount,
            failureCount: result.failureCount 
          }, 
          "[DELETE] Tag deletion completed with partial success"
        );
      } else {
        logger.info({ booksUpdated }, "[DELETE] Tag deletion completed successfully");
      }

      return result;
    } finally {
      // Resume with ignore period to prevent watcher from re-syncing our own changes
      calibreWatcher.resumeWithIgnorePeriod(3000);
      logger.info("[DELETE] Calibre watcher resumed with 3s ignore period");
    }
  }

  /**
   * Bulk delete multiple tags
   * Suspends the Calibre watcher during deletion to prevent sync interference
   * 
   * Uses Write-Through Cache pattern: Write to Calibre FIRST (source of truth),
   * then update Tome to match. This prevents race conditions where the watcher
   * might sync stale data back from Calibre.
   * 
   * @param tagNames - Array of tag names to delete
   * @returns Promise resolving to detailed operation result and tags deleted count
   * @throws {Error} Only if operation completely fails (0 successes)
   * 
   * @example
   * const result = await tagService.bulkDeleteTags(["Tag1", "Tag2", "Tag3"]);
   * console.log(`${result.successCount} of ${result.totalBooks} books updated`);
   */
  async bulkDeleteTags(tagNames: string[]): Promise<TagOperationResult & { tagsDeleted: number }> {
    // Validate inputs
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
      throw new Error("Tag names must be a non-empty array");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    logger.info({ tagNames, count: tagNames.length }, "[BULK_DELETE] Starting bulk tag deletion");

    // Suspend the Calibre watcher during bulk delete to prevent interference
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    logger.info("[BULK_DELETE] Calibre watcher suspended");
    
    try {
      // STEP 1: Collect all affected books for all tags
      logger.info({ tagNames }, "[BULK_DELETE] Collecting all affected books");
      const affectedBooksMap = new Map<number, Book>();
      
      for (const tagName of tagNames) {
        const result = await bookRepository.findByTag(tagName, 1000, 0);
        for (const book of result.books) {
          affectedBooksMap.set(book.id, book);
        }
      }
      
      const affectedBooks = Array.from(affectedBooksMap.values());
      logger.info({ bookCount: affectedBooks.length, tagCount: tagNames.length }, "[BULK_DELETE] Found books affected by tag deletions");

      if (affectedBooks.length === 0) {
        logger.info({ tagNames }, "[BULK_DELETE] No books found with any of the tags, nothing to delete");
        return {
          totalBooks: 0,
          successCount: 0,
          failureCount: 0,
          calibreFailures: [],
          tomeFailures: [],
          tagsDeleted: 0
        };
      }

      // STEP 2: Calculate new tags for each book (remove all specified tags)
      const calibreUpdates = affectedBooks.map(book => {
        const currentTags = book.tags || [];
        const newTags = currentTags.filter(tag => !tagNames.includes(tag));
        return {
          calibreId: book.calibreId,
          tags: newTags
        };
      });

      // STEP 3: Write to Calibre FIRST (source of truth)
      logger.info({ bookCount: calibreUpdates.length, tagCount: tagNames.length }, "[BULK_DELETE] Writing tag deletions to Calibre (source of truth)");
      const calibreResult = this.getCalibreService().batchUpdateTags(calibreUpdates);
      
      logger.info(
        { 
          successCount: calibreResult.successCount, 
          failureCount: calibreResult.failures.length 
        }, 
        "[BULK_DELETE] Calibre batch update completed"
      );

      // Create a map of calibreId to book for enriching failure details
      const calibreIdToBook = new Map(affectedBooks.map(b => [b.calibreId, b]));
      
      // Enrich failure details with book titles
      const calibreFailures = calibreResult.failures.map(f => {
        const book = calibreIdToBook.get(f.calibreId);
        return {
          calibreId: f.calibreId,
          bookId: book?.id,
          title: book?.title,
          error: f.error
        };
      });

      // If all Calibre updates failed, throw error
      if (calibreResult.successCount === 0) {
        logger.error({ calibreFailures }, "[BULK_DELETE] All Calibre updates failed - aborting");
        throw new Error(
          `Failed to delete tags in Calibre: All ${calibreResult.totalAttempted} books failed. ` +
          `First error: ${calibreFailures[0]?.error || 'Unknown error'}`
        );
      }

      // STEP 4: Update Tome database to match Calibre (even with partial success)
      logger.info({ tagNames }, "[BULK_DELETE] Updating Tome database to match Calibre");
      let tagsDeleted = 0;
      const tomeFailures: Array<{ bookId: number; error: string }> = [];

      for (const tagName of tagNames) {
        try {
          const booksUpdated = await bookRepository.deleteTag(tagName);
          tagsDeleted++;
          logger.info({ tagName, booksUpdated }, "[BULK_DELETE] Deleted tag from Tome database");
        } catch (error) {
          logger.error({ err: error, tagName }, "[BULK_DELETE] Failed to delete tag from Tome database");
          tomeFailures.push({
            bookId: 0, // Bulk operation
            error: `Failed to delete tag "${tagName}": ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }

      const result = {
        totalBooks: affectedBooks.length,
        successCount: calibreResult.successCount,
        failureCount: calibreFailures.length,
        calibreFailures,
        tomeFailures,
        tagsDeleted
      };

      if (calibreFailures.length > 0 || tomeFailures.length > 0) {
        logger.warn(
          { 
            successCount: result.successCount,
            failureCount: result.failureCount,
            tagsDeleted: result.tagsDeleted,
            totalTags: tagNames.length
          }, 
          "[BULK_DELETE] Bulk deletion completed with partial success"
        );
      } else {
        logger.info({ tagsDeleted, totalBooks: result.successCount }, "[BULK_DELETE] Bulk deletion completed successfully");
      }

      return result;
    } finally {
      // Resume with ignore period to prevent watcher from re-syncing our own changes
      calibreWatcher.resumeWithIgnorePeriod(3000);
      logger.info("[BULK_DELETE] Calibre watcher resumed with 3s ignore period");
    }
  }

  /**
   * Bulk update tags for multiple books and sync to Calibre
   * 
   * @param bookIds - Array of book IDs to update
   * @param action - Action to perform: "add" or "remove"
   * @param tags - Array of tag names to add or remove
   * @returns Promise resolving to object with number of books updated
   * @throws {Error} If bulk update fails
   */
  async bulkUpdateTags(
    bookIds: number[],
    action: "add" | "remove",
    tags: string[]
  ): Promise<{ booksUpdated: number }> {
    // Validate inputs
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      throw new Error("Book IDs must be a non-empty array");
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error("Tags must be a non-empty array");
    }

    if (action !== "add" && action !== "remove") {
      throw new Error("Action must be 'add' or 'remove'");
    }

    const { getLogger } = require("../logger");
    const logger = getLogger();

    // Bulk update in Tome database
    const tagsToAdd = action === "add" ? tags : [];
    const tagsToRemove = action === "remove" ? tags : [];
    
    const booksUpdated = await bookRepository.bulkUpdateBookTags(
      bookIds,
      tagsToAdd,
      tagsToRemove
    );

    // Sync to Calibre for all affected books in batch (best effort)
    try {
      const updatedBooks = await bookRepository.findByIds(bookIds);
      
      const updates = updatedBooks.map(book => ({
        calibreId: book.calibreId,
        tags: book.tags
      }));

      await this.batchSyncTagsToCalibre(updates);
    } catch (error) {
      logger.error({ err: error, bookIds, action, tags }, "Failed to sync bulk tag updates to Calibre");
    }

    logger.info({ bookIds, action, tags, booksUpdated }, "Bulk updated tags");

    return { booksUpdated };
  }

  /**
   * Batch sync tags to Calibre for multiple books (best effort)
   * 
   * This method syncs tags for multiple books in a single operation,
   * providing significant performance improvements over individual syncs.
   * Errors are logged but don't stop the batch operation.
   * 
   * @param books - Array of books with their tags to sync
   */
  private async batchSyncTagsToCalibre(books: Array<{ calibreId: number; tags: string[] }>): Promise<void> {
    if (books.length === 0) return;

    const { getLogger } = require("../logger");
    const logger = getLogger();

    try {
      const result = this.getCalibreService().batchUpdateTags(books);
      logger.info(
        { totalBooks: books.length, successCount: result.successCount, failureCount: result.failures.length },
        "[TagService] Batch synced tags to Calibre"
      );
    } catch (error) {
      logger.error({ err: error, bookCount: books.length }, "[TagService] Failed to batch sync tags to Calibre");
      // Don't throw - this is best effort
    }
  }

  /**
   * Execute a tag operation using Write-Through Cache pattern
   * 
   * This helper method extracts the common pattern used across all tag operations:
   * 1. Suspend Calibre watcher
   * 2. Write to Calibre FIRST (source of truth)
   * 3. Update Tome database to match
   * 4. Resume watcher with ignore period
   * 
   * @param operationName - Name of the operation for logging (e.g., "MERGE", "RENAME", "DELETE")
   * @param affectedBooks - Books that will be affected by this operation
   * @param calculateCalibreUpdates - Function to calculate what tags each book should have
   * @param updateTomeDatabase - Function to update the Tome database after Calibre succeeds
   * @returns Promise resolving to the result of the Tome database update
   * @throws {Error} If Calibre write fails or Tome update fails
   */
  private async syncWithCalibreWriteThrough<T>(
    operationName: string,
    affectedBooks: Book[],
    calculateCalibreUpdates: (books: Book[]) => Array<{ calibreId: number; tags: string[] }>,
    updateTomeDatabase: () => Promise<T>
  ): Promise<T> {
    const { getLogger } = require("../logger");
    const logger = getLogger();

    // Suspend the Calibre watcher during operation to prevent race conditions
    const { calibreWatcher } = require("@/lib/calibre-watcher");
    calibreWatcher.suspend();
    logger.info(`[${operationName}] Calibre watcher suspended`);
    
    try {
      if (affectedBooks.length === 0) {
        logger.info(`[${operationName}] No books affected, skipping Calibre sync`);
        return await updateTomeDatabase();
      }

      // Calculate new tags for each book
      const calibreUpdates = calculateCalibreUpdates(affectedBooks);

      // Write to Calibre FIRST (source of truth - required, not best effort)
      logger.info({ bookCount: calibreUpdates.length }, `[${operationName}] Writing to Calibre (source of truth)`);
      try {
        const result = this.getCalibreService().batchUpdateTags(calibreUpdates);
        
        if (result.successCount !== calibreUpdates.length) {
          throw new Error(
            `Calibre sync incomplete: ${result.successCount}/${calibreUpdates.length} books updated. ` +
            `Aborting to maintain consistency.`
          );
        }
        
        logger.info({ successCount: result.successCount }, `[${operationName}] Successfully wrote to Calibre`);
      } catch (error) {
        logger.error({ err: error }, `[${operationName}] FAILED to write to Calibre - aborting operation`);
        throw new Error(`Failed to update Calibre: ${error instanceof Error ? error.message : error}`);
      }

      // Update Tome database to match Calibre (now the source of truth)
      logger.info(`[${operationName}] Updating Tome database to match Calibre`);
      const result = await updateTomeDatabase();
      logger.info(`[${operationName}] Updated Tome database successfully`);

      return result;
    } finally {
      // Resume with ignore period to prevent watcher from re-syncing our own changes
      calibreWatcher.resumeWithIgnorePeriod(3000);
      logger.info(`[${operationName}] Calibre watcher resumed with 3s ignore period`);
    }
  }
}

/**
 * Default TagService instance
 * Use this in API routes and other application code
 */
export const tagService = new TagService();
