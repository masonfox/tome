import { getAllBooks, getBookTags, getAllBookTags, getBooksCount, CalibreBook, PaginationOptions } from "@/lib/db/calibre";
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
  
  /**
   * Chunk size for processing books in batches
   * Default: 5000 books per chunk
   * Smaller chunks = lower memory usage, more frequent progress updates
   * Larger chunks = faster sync, higher memory usage
   */
  chunkSize?: number;
}

/**
 * Interface for Calibre data source
 * Allows dependency injection for testing
 */
export interface CalibreDataSource {
  getAllBooks(options?: PaginationOptions): CalibreBook[];
  getBooksCount?(): number;
  getBookTags(bookId: number): string[];
  getAllBookTags?(bookIds?: number[]): Map<number, string[]>;
}

/**
 * Default Calibre data source using real database
 */
const defaultCalibreSource: CalibreDataSource = {
  getAllBooks,
  getBooksCount,
  getBookTags,
  getAllBookTags,
};

let lastSyncTime: Date | null = null;
let isSyncing = false;

/**
 * Sync Calibre library with Tome database using chunked batch processing
 * 
 * Performance optimizations (Phase 1 + Phase 2):
 * - Phase 1: Batch processing to reduce ~600k queries to ~50-100
 * - Phase 2: Chunked processing for constant memory usage (~50MB regardless of library size)
 * 
 * How it works:
 * 1. Counts total books in Calibre
 * 2. Processes books in chunks (default: 5000 books per chunk)
 * 3. For each chunk:
 *    - Fetches books with pagination
 *    - Fetches tags for those books only
 *    - Bulk upserts books in batches of 1000
 *    - Creates sessions for new books
 * 4. After all chunks: Detects and marks orphaned books (optional)
 * 
 * @param calibreSource - Data source for Calibre books (defaults to real Calibre DB)
 * @param options - Sync options (detectOrphans: default true, chunkSize: default 5000)
 * @returns SyncResult with counts and any errors
 */
export async function syncCalibreLibrary(
  calibreSource: CalibreDataSource = defaultCalibreSource,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { detectOrphans = true, chunkSize = 5000 } = options;

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
  const { getLogger } = require("@/lib/logger");
  const logger = getLogger();

  try {
    // ========================================
    // PHASE 0: Initialization & Count
    // ========================================
    logger.info(
      { chunkSize, detectOrphans },
      "╔════════════════════════════════════════════════════════════════════════╗"
    );
    logger.info("║ CALIBRE SYNC START - Phase 2: Chunked Batch Processing            ║");
    logger.info("╚════════════════════════════════════════════════════════════════════════╝");
    logger.info({ chunkSize, detectOrphans }, "[Sync:Init] Starting with chunked processing...");
    
    // Get total count of books from Calibre
    let totalBooks: number;
    if (calibreSource.getBooksCount) {
      totalBooks = calibreSource.getBooksCount();
    } else {
      // Fallback: fetch all books to count (for backward compatibility with tests)
      const allBooks = calibreSource.getAllBooks();
      totalBooks = allBooks.length;
    }
    
    logger.info({ totalBooks, chunkSize }, `[Sync:Init] Found ${totalBooks} books in Calibre database`);
    
    // SAFETY CHECK: Abort if Calibre returns no books
    if (totalBooks === 0) {
      logger.error("[Sync:Init] CRITICAL: No books found in Calibre database. Aborting sync.");
      return {
        success: false,
        syncedCount: 0,
        updatedCount: 0,
        removedCount: 0,
        totalBooks: 0,
        error: "No books found in Calibre database. This may indicate a connection issue or corrupted database. Sync aborted to prevent data loss.",
      };
    }

    const numChunks = Math.ceil(totalBooks / chunkSize);
    logger.info({ totalBooks, chunkSize, numChunks }, `[Sync:Init] Will process ${numChunks} chunk(s) of ${chunkSize} books each`);

    // ========================================
    // PHASE 1: Chunked Processing
    // ========================================
    logger.info("─────────────────────────────────────────────────────────────────────────");
    logger.info("║ PHASE 1: Chunked Book Processing                                    ║");
    logger.info("─────────────────────────────────────────────────────────────────────────");
    
    let syncedCount = 0;
    let updatedCount = 0;
    const allCalibreIds: number[] = []; // Track all Calibre IDs for orphan detection

    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStartTime = Date.now();
      const offset = chunkIndex * chunkSize;
      const chunkNumber = chunkIndex + 1;
      
      logger.info(
        { chunk: chunkNumber, totalChunks: numChunks, offset, chunkSize },
        `┌─ [Sync:Chunk ${chunkNumber}/${numChunks}] Starting chunk at offset ${offset}`
      );

      // Step 1: Fetch chunk of books from Calibre
      logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Fetching books ${offset + 1}-${Math.min(offset + chunkSize, totalBooks)}...`);
      
      let calibreBooks: CalibreBook[];
      if (calibreSource.getBooksCount) {
        // Use pagination (Phase 2 optimization)
        calibreBooks = calibreSource.getAllBooks({ limit: chunkSize, offset });
      } else {
        // Fallback: slice from full list (for backward compatibility)
        const allBooks = calibreSource.getAllBooks();
        calibreBooks = allBooks.slice(offset, offset + chunkSize);
      }
      
      logger.info(
        { chunk: chunkNumber, booksInChunk: calibreBooks.length },
        `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Fetched ${calibreBooks.length} books`
      );

      if (calibreBooks.length === 0) {
        logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] No books in chunk, skipping...`);
        continue;
      }

      // Track Calibre IDs for orphan detection
      const chunkCalibreIds = calibreBooks.map(b => b.id);
      allCalibreIds.push(...chunkCalibreIds);

      // Step 2: Fetch tags for this chunk of books
      logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Fetching tags...`);
      
      let allTagsMap: Map<number, string[]>;
      if (calibreSource.getAllBookTags) {
        // Use optimized bulk fetch with book IDs (Phase 2 optimization)
        allTagsMap = calibreSource.getAllBookTags(chunkCalibreIds);
      } else {
        // Fallback: build map using individual getBookTags calls (for tests/backward compatibility)
        allTagsMap = new Map<number, string[]>();
        for (const book of calibreBooks) {
          const tags = calibreSource.getBookTags(book.id);
          allTagsMap.set(book.id, tags);
        }
      }
      
      logger.info(
        { chunk: chunkNumber, booksWithTags: allTagsMap.size },
        `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Fetched tags for ${allTagsMap.size} books`
      );

      // Step 3: Fetch existing books from Tome database for this chunk
      logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Checking for existing books in Tome database...`);
      const existingBooksMap = await bookRepository.findAllByCalibreIds(chunkCalibreIds);
      logger.info(
        { chunk: chunkNumber, existingBooks: existingBooksMap.size, newBooks: calibreBooks.length - existingBooksMap.size },
        `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Found ${existingBooksMap.size} existing, ${calibreBooks.length - existingBooksMap.size} new`
      );

      // Step 4: Build arrays of books to insert/update
      logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Processing book data...`);
      const booksToUpsert: NewBook[] = [];
      let chunkSyncedCount = 0;
      let chunkUpdatedCount = 0;

      for (const calibreBook of calibreBooks) {
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
          rating: calibreBook.rating !== null ? calibreBook.rating : null,
        };

        booksToUpsert.push(bookData);

        if (existingBook) {
          chunkUpdatedCount++;
        } else {
          chunkSyncedCount++;
        }
      }

      // Step 5: Bulk upsert books for this chunk
      logger.info(
        { chunk: chunkNumber, booksToUpsert: booksToUpsert.length },
        `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Upserting ${booksToUpsert.length} books...`
      );
      await bookRepository.bulkUpsert(booksToUpsert);
      logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] ✓ Books upserted`);

      // Step 6: Create sessions for new books
      if (chunkSyncedCount > 0) {
        logger.info(
          { chunk: chunkNumber, newBooks: chunkSyncedCount },
          `│  [Sync:Chunk ${chunkNumber}/${numChunks}] Creating sessions for ${chunkSyncedCount} new books...`
        );
        
        const newCalibreIds = booksToUpsert
          .filter((_, index) => !existingBooksMap.has(calibreBooks[index].id))
          .map(book => book.calibreId);
        
        const newBooksMap = await bookRepository.findAllByCalibreIds(newCalibreIds);
        const sessionsToCreate: NewReadingSession[] = [];
        
        for (const book of Array.from(newBooksMap.values())) {
          sessionsToCreate.push({
            bookId: book.id,
            status: "to-read",
            sessionNumber: 1,
            isActive: true,
          });
        }

        await sessionRepository.bulkCreate(sessionsToCreate);
        logger.info({ chunk: chunkNumber }, `│  [Sync:Chunk ${chunkNumber}/${numChunks}] ✓ Sessions created`);
      }

      // Update totals
      syncedCount += chunkSyncedCount;
      updatedCount += chunkUpdatedCount;

      // Chunk summary
      const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
      const overallProgress = ((chunkNumber / numChunks) * 100).toFixed(1);
      const booksProcessed = Math.min(offset + chunkSize, totalBooks);
      const overallElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const estimatedRemaining = numChunks > chunkNumber 
        ? (((Date.now() - startTime) / chunkNumber) * (numChunks - chunkNumber) / 1000).toFixed(0)
        : 0;
      
      logger.info(
        {
          chunk: chunkNumber,
          chunkDurationSec: chunkDuration,
          chunkNew: chunkSyncedCount,
          chunkUpdated: chunkUpdatedCount,
          overallProgress,
          booksProcessed,
          totalBooks,
          elapsedSec: overallElapsed,
          etaSec: estimatedRemaining,
        },
        `└─ [Sync:Chunk ${chunkNumber}/${numChunks}] ✓ Chunk complete in ${chunkDuration}s (${chunkSyncedCount} new, ${chunkUpdatedCount} updated) | Overall: ${booksProcessed}/${totalBooks} (${overallProgress}%) | ETA: ${estimatedRemaining}s`
      );
    }

    logger.info({ totalNew: syncedCount, totalUpdated: updatedCount }, "[Sync:Phase1] ✓ All chunks processed successfully");

    // ========================================
    // PHASE 2: Orphan Detection (Optional)
    // ========================================
    let removedCount = 0;
    const orphanedBooks: string[] = [];

    if (detectOrphans) {
      logger.info("─────────────────────────────────────────────────────────────────────────");
      logger.info("║ PHASE 2: Orphan Detection                                           ║");
      logger.info("─────────────────────────────────────────────────────────────────────────");
      logger.info("[Sync:Orphans] Detecting books removed from Calibre...");
      
      const removedBooks = await bookRepository.findNotInCalibreIds(allCalibreIds);
      logger.info(
        { potentialOrphans: removedBooks.length },
        `[Sync:Orphans] Found ${removedBooks.length} book(s) not in Calibre`
      );

      // SAFETY CHECK: Prevent mass orphaning (>10% of library)
      if (removedBooks.length > 0) {
        const totalBooksInDb = await bookRepository.count();
        const orphanPercentage = (removedBooks.length / totalBooksInDb) * 100;
        
        logger.info(
          { orphanPercentage: orphanPercentage.toFixed(1), removedBooks: removedBooks.length, totalBooksInDb },
          `[Sync:Orphans] Would orphan ${removedBooks.length}/${totalBooksInDb} books (${orphanPercentage.toFixed(1)}%)`
        );
        
        if (orphanPercentage > 10) {
          logger.error(
            { orphanPercentage: orphanPercentage.toFixed(1), removedBooks: removedBooks.length },
            `[Sync:Orphans] CRITICAL: Would orphan ${orphanPercentage.toFixed(1)}% of library. Aborting.`
          );
          return {
            success: false,
            syncedCount,
            updatedCount,
            removedCount: 0,
            totalBooks,
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
        logger.info({ removedCount }, `[Sync:Orphans] ✓ Marked ${removedCount} book(s) as orphaned`);
      } else {
        logger.info("[Sync:Orphans] ✓ No books to orphan");
      }
    } else {
      logger.info("─────────────────────────────────────────────────────────────────────────");
      logger.info("[Sync:Orphans] Skipping orphan detection (disabled via options)");
    }

    // ========================================
    // COMPLETION
    // ========================================
    lastSyncTime = new Date();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const booksPerSecond = (totalBooks / parseFloat(duration)).toFixed(0);

    logger.info("═════════════════════════════════════════════════════════════════════════");
    logger.info("║ CALIBRE SYNC COMPLETE                                                ║");
    logger.info("═════════════════════════════════════════════════════════════════════════");
    logger.info(
      {
        totalBooks,
        syncedCount,
        updatedCount,
        removedCount,
        durationSec: duration,
        booksPerSec: booksPerSecond,
      },
      `[Sync:Complete] ✓ Synced ${totalBooks} books in ${duration}s (${booksPerSecond} books/sec)`
    );
    logger.info(
      { syncedCount, updatedCount, removedCount },
      `[Sync:Complete] Summary: ${syncedCount} new, ${updatedCount} updated, ${removedCount} orphaned`
    );

    return {
      success: true,
      syncedCount,
      updatedCount,
      removedCount,
      totalBooks,
      orphanedBooks: orphanedBooks.length > 0 ? orphanedBooks : undefined,
    };
  } catch (error) {
    const { getLogger } = require("@/lib/logger");
    getLogger().error({ err: error }, "[Sync:Error] Calibre sync failed");
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
