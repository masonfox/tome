import { getAllBooks, getBookTags, getAllBookTags, CalibreBook } from "@/lib/db/calibre";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import type { NewBook } from "@/lib/db/schema/books";
import type { NewReadingSession } from "@/lib/db/schema/reading-sessions";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  updatedCount: number;
  removedCount: number;
  totalBooks: number;
  orphanedBooks?: string[];
  error?: string;
}

export interface SyncOptions {
  /**
   * Whether to detect and mark orphaned books (books removed from Calibre)
   * Default: true
   * Set to false to skip orphan detection for faster syncs
   */
  detectOrphans?: boolean;
}

/**
 * Interface for Calibre data source
 * Allows dependency injection for testing
 */
export interface CalibreDataSource {
  getAllBooks(): CalibreBook[];
  getBookTags(bookId: number): string[];
  getAllBookTags?(): Map<number, string[]>;
}

/**
 * Default Calibre data source using real database
 */
const defaultCalibreSource: CalibreDataSource = {
  getAllBooks,
  getBookTags,
  getAllBookTags,
};

let lastSyncTime: Date | null = null;
let isSyncing = false;

/**
 * Sync Calibre library with Tome database using batch processing for performance
 * 
 * Performance optimizations:
 * - Fetches all tags in single query (150k queries → 1 query)
 * - Fetches all existing books in single query (150k queries → 1 query)
 * - Bulk upserts books in batches of 1000 (150k operations → ~150 operations)
 * - Bulk creates sessions in batches of 1000 (150k operations → ~150 operations)
 * - Progress logging every 5000 books
 * 
 * @param calibreSource - Data source for Calibre books (defaults to real Calibre DB)
 * @param options - Sync options (detectOrphans: default true)
 * @returns SyncResult with counts and any errors
 */
export async function syncCalibreLibrary(
  calibreSource: CalibreDataSource = defaultCalibreSource,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { detectOrphans = true } = options;

  // Prevent concurrent syncs
  if (isSyncing) {
    return {
      success: false,
      syncedCount: 0,
      updatedCount: 0,
      removedCount: 0,
      totalBooks: 0,
      error: "Sync already in progress",
    };
  }

  isSyncing = true;
  const startTime = Date.now();

  try {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();
    logger.info("[Sync] Starting Calibre sync with batch processing...");
    
    // Step 1: Fetch all books from Calibre
    const calibreBooks = calibreSource.getAllBooks();
    logger.info({ calibreBooksCount: calibreBooks.length }, `[Sync] Found ${calibreBooks.length} books in Calibre database`);
    
    // SAFETY CHECK: Abort if Calibre returns no books
    // This prevents catastrophic data loss from orphaning all books
    if (calibreBooks.length === 0) {
      logger.error("[Sync] CRITICAL: No books found in Calibre database. Aborting sync.");
      return {
        success: false,
        syncedCount: 0,
        updatedCount: 0,
        removedCount: 0,
        totalBooks: 0,
        error: "No books found in Calibre database. This may indicate a connection issue or corrupted database. Sync aborted to prevent data loss.",
      };
    }

    // Step 2: Fetch ALL tags in a single query (optimization)
    logger.info("[Sync] Fetching all book tags...");
    let allTagsMap: Map<number, string[]>;
    
    if (calibreSource.getAllBookTags) {
      // Use optimized bulk fetch if available
      allTagsMap = calibreSource.getAllBookTags();
    } else {
      // Fallback: build map using individual getBookTags calls (for tests/backward compatibility)
      allTagsMap = new Map<number, string[]>();
      for (const book of calibreBooks) {
        const tags = calibreSource.getBookTags(book.id);
        allTagsMap.set(book.id, tags);
      }
    }
    logger.info("[Sync] Tags fetched successfully");

    // Step 3: Fetch ALL existing books in a single query (optimization)
    logger.info("[Sync] Fetching existing books from Tome database...");
    const calibreIds = calibreBooks.map((b) => b.id);
    const existingBooksMap = await bookRepository.findAllByCalibreIds(calibreIds);
    logger.info({ existingBooksCount: existingBooksMap.size }, `[Sync] Found ${existingBooksMap.size} existing books`);

    // Step 4: Build arrays of books to insert and update
    const booksToUpsert: NewBook[] = [];
    const sessionsToCreate: NewReadingSession[] = [];
    let syncedCount = 0;
    let updatedCount = 0;

    logger.info("[Sync] Processing books...");
    const PROGRESS_INTERVAL = 5000;
    
    for (let i = 0; i < calibreBooks.length; i++) {
      const calibreBook = calibreBooks[i];
      
      // Progress logging every 5000 books
      if ((i + 1) % PROGRESS_INTERVAL === 0) {
        const progress = ((i + 1) / calibreBooks.length * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(0);
        const remaining = Math.ceil((calibreBooks.length - i - 1) / parseFloat(rate));
        logger.info(
          { processed: i + 1, total: calibreBooks.length, progress, elapsedSec: elapsed, booksPerSec: rate, etaSec: remaining },
          `[Sync] Progress: ${i + 1}/${calibreBooks.length} (${progress}%) - ${rate} books/sec - ETA: ${remaining}s`
        );
      }

      // Get tags from the pre-fetched map
      const tags = allTagsMap.get(calibreBook.id) || [];

      const existingBook = existingBooksMap.get(calibreBook.id);

      const bookData: NewBook = {
        calibreId: calibreBook.id,
        title: calibreBook.title,
        authors: calibreBook.authors
          ? calibreBook.authors
              .split(/\s*[,|]\s*/)
              .map((a) => a.trim())
              .filter((a) => a)
          : [],
        isbn: calibreBook.isbn || undefined,
        publisher: calibreBook.publisher || undefined,
        pubDate: calibreBook.pubdate ? new Date(calibreBook.pubdate) : undefined,
        series: calibreBook.series || undefined,
        seriesIndex: calibreBook.series_index || undefined,
        tags,
        path: calibreBook.path,
        description: calibreBook.description || undefined,
        lastSynced: new Date(),
        addedToLibrary: calibreBook.timestamp ? new Date(calibreBook.timestamp) : new Date(),
        // Always sync rating (including null) to ensure rating changes from Calibre are reflected
        rating: calibreBook.rating !== null ? calibreBook.rating : null,
      };

      booksToUpsert.push(bookData);

      if (existingBook) {
        updatedCount++;
      } else {
        syncedCount++;
        // Queue session creation for new books (will be created after books are inserted)
        // Note: We'll create sessions after bulk upsert since we need the book IDs
      }
    }

    // Step 5: Bulk upsert all books
    logger.info({ booksToUpsert: booksToUpsert.length }, `[Sync] Bulk upserting ${booksToUpsert.length} books...`);
    await bookRepository.bulkUpsert(booksToUpsert);
    logger.info("[Sync] Books upserted successfully");

    // Step 6: Create sessions for new books
    // We need to fetch the newly created books to get their IDs
    if (syncedCount > 0) {
      logger.info({ newBooksCount: syncedCount }, `[Sync] Creating sessions for ${syncedCount} new books...`);
      
      // Get the newly created book IDs
      const newCalibreIds = booksToUpsert
        .filter((_, index) => !existingBooksMap.has(calibreBooks[index].id))
        .map(book => book.calibreId);
      
      const newBooksMap = await bookRepository.findAllByCalibreIds(newCalibreIds);
      
      for (const book of Array.from(newBooksMap.values())) {
        sessionsToCreate.push({
          bookId: book.id,
          status: "to-read",
          sessionNumber: 1,
          isActive: true,
        });
      }

      await sessionRepository.bulkCreate(sessionsToCreate);
      logger.info("[Sync] Sessions created successfully");
    }

    let removedCount = 0;
    const orphanedBooks: string[] = [];

    // Step 7: Detect orphaned books (optional)
    if (detectOrphans) {
      logger.info("[Sync] Detecting orphaned books...");
      const removedBooks = await bookRepository.findNotInCalibreIds(calibreIds);
      logger.info({ removedBooksCount: removedBooks.length }, `[Sync] Found ${removedBooks.length} books to potentially orphan`);

      // SAFETY CHECK: Prevent mass orphaning (>10% of library)
      // This catches edge cases where sync logic might incorrectly orphan many books
      if (removedBooks.length > 0) {
        const totalBooksInDb = await bookRepository.count();
        const orphanPercentage = (removedBooks.length / totalBooksInDb) * 100;
        
        logger.info({ orphanPercentage, removedBooks: removedBooks.length, totalBooksInDb }, `[Sync] Orphaning would affect ${removedBooks.length}/${totalBooksInDb} books (${orphanPercentage.toFixed(1)}%)`);
        
        if (orphanPercentage > 10) {
          logger.error({ orphanPercentage, removedBooks: removedBooks.length }, `[Sync] CRITICAL: Sync would orphan ${removedBooks.length} books (${orphanPercentage.toFixed(1)}% of library). Aborting.`);
          return {
            success: false,
            syncedCount,
            updatedCount,
            removedCount: 0,
            totalBooks: calibreBooks.length,
            error: `Sync would orphan ${removedBooks.length} books (${orphanPercentage.toFixed(1)}% of your library). This may indicate a sync error or Calibre database issue. Please verify your Calibre library is accessible and contains all expected books.`,
          };
        }
      }

      // Mark books as orphaned
      for (const book of removedBooks) {
        orphanedBooks.push(book.id.toString());
        await bookRepository.markAsOrphaned(book.id);
        removedCount++;
      }
      
      if (removedCount > 0) {
        logger.info({ removedCount }, `[Sync] Marked ${removedCount} books as orphaned`);
      }
    } else {
      logger.info("[Sync] Skipping orphan detection (disabled via options)");
    }

    lastSyncTime = new Date();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.info(
      { syncedCount, updatedCount, removedCount, durationSec: duration },
      `[Sync] Sync completed successfully in ${duration}s: ${syncedCount} new, ${updatedCount} updated, ${removedCount} orphaned`
    );

    return {
      success: true,
      syncedCount,
      updatedCount,
      removedCount,
      totalBooks: calibreBooks.length,
      orphanedBooks: orphanedBooks.length > 0 ? orphanedBooks : undefined,
    };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "Calibre sync error");
    return {
      success: false,
      syncedCount: 0,
      updatedCount: 0,
      removedCount: 0,
      totalBooks: 0,
      error: error instanceof Error ? error.message : "Failed to sync with Calibre database",
    };
  } finally {
    isSyncing = false;
  }
}

export function getLastSyncTime(): Date | null {
  return lastSyncTime;
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}
