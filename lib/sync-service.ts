import { getAllBooks, getBookTags, getAllBookTags, getBooksCount, CalibreBook, PaginationOptions } from "@/lib/db/calibre";
import { bookRepository, sessionRepository, bookSourceRepository } from "@/lib/repositories";
import type { NewBook } from "@/lib/db/schema/books";
import type { NewReadingSession } from "@/lib/db/schema/reading-sessions";
import { SessionService } from "@/lib/services/session.service";
import { getLogger } from "@/lib/logger";
import { generateAuthorSort } from "@/lib/utils/author-sort";
import { clearCoverCache, clearBookPathCache, getCoverCacheStats, getBookPathCacheStats } from "@/lib/cache/cover-cache";

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
  const logger = getLogger();

  try {
    // ========================================
    // PHASE 0: Initialization & Count
    // ========================================
    
    // Get total count of books from Calibre
    let totalBooks: number;
    if (calibreSource.getBooksCount) {
      totalBooks = calibreSource.getBooksCount();
    } else {
      // Fallback: fetch all books to count (for backward compatibility with tests)
      const allBooks = calibreSource.getAllBooks();
      totalBooks = allBooks.length;
    }
    
    // SAFETY CHECK: Abort if Calibre returns no books
    if (totalBooks === 0) {
      logger.error("[Sync] Error: No books found in Calibre database. Aborting sync.");
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
    logger.info(
      { totalBooks, chunkSize, numChunks, detectOrphans, source: 'calibre' }, // T047: Log source filtering
      `[Sync] Starting: ${totalBooks} books (source=calibre), ${numChunks} chunk(s), orphan detection ${detectOrphans ? 'enabled' : 'disabled'}`
    );

    // ========================================
    // PHASE 1: Chunked Processing
    // ========================================
    let syncedCount = 0;
    let updatedCount = 0;
    const allCalibreIds: number[] = []; // Track all Calibre IDs for orphan detection

    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStartTime = Date.now();
      const offset = chunkIndex * chunkSize;
      const chunkNumber = chunkIndex + 1;
      
      logger.debug(
        { chunk: chunkNumber, totalChunks: numChunks, offset, size: chunkSize },
        `[Sync:Chunk] Starting chunk ${chunkNumber}/${numChunks} at offset ${offset}`
      );

      // Step 1: Fetch chunk of books from Calibre
      
      let calibreBooks: CalibreBook[];
      if (calibreSource.getBooksCount) {
        // Use pagination (Phase 2 optimization)
        calibreBooks = calibreSource.getAllBooks({ limit: chunkSize, offset });
      } else {
        // Fallback: slice from full list (for backward compatibility)
        const allBooks = calibreSource.getAllBooks();
        calibreBooks = allBooks.slice(offset, offset + chunkSize);
      }
      
      logger.debug(
        { chunk: chunkNumber, booksInChunk: calibreBooks.length },
        `[Sync:Chunk] Fetched ${calibreBooks.length} books from Calibre`
      );

      if (calibreBooks.length === 0) {
        logger.debug({ chunk: chunkNumber }, `[Sync:Chunk] No books in chunk, skipping...`);
        continue;
      }

      // Track Calibre IDs for orphan detection
      const chunkCalibreIds = calibreBooks.map(b => b.id);
      allCalibreIds.push(...chunkCalibreIds);

      // Step 2: Fetch tags for this chunk of books
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
      
      logger.debug(
        { chunk: chunkNumber, booksWithTags: allTagsMap.size },
        `[Sync:Chunk] Fetched tags for ${allTagsMap.size} books`
      );

      // Step 3: Fetch existing books from Tome database for this chunk
      const existingBooksMap = await bookRepository.findAllByCalibreIds(chunkCalibreIds);
      logger.debug(
        { chunk: chunkNumber, existingBooks: existingBooksMap.size, newBooks: calibreBooks.length - existingBooksMap.size },
        `[Sync:Chunk] Found ${existingBooksMap.size} existing, ${calibreBooks.length - existingBooksMap.size} new in Tome database`
      );

      // Step 4: Build arrays of books to insert/update
      const booksToInsert: NewBook[] = [];
      const booksToUpdate: NewBook[] = [];
      let chunkSyncedCount = 0;
      let chunkUpdatedCount = 0;

      for (const calibreBook of calibreBooks) {
        const tags = allTagsMap.get(calibreBook.id) || [];
        const existingBook = existingBooksMap.get(calibreBook.id);

        // Parse authors from Calibre
        const authors = calibreBook.authors
          ? calibreBook.authors
              .split(/\s*[,|]\s*/)
              .map((a) => a.trim())
              .filter((a) => a)
          : [];

        const bookData: NewBook = {
          calibreId: calibreBook.id,
          title: calibreBook.title,
          authors,
          authorSort: generateAuthorSort(authors),
          isbn: calibreBook.isbn || undefined,
          publisher: calibreBook.publisher || undefined,
          pubDate: calibreBook.pubdate ? new Date(calibreBook.pubdate) : undefined,
          series: calibreBook.series || null,
          seriesIndex: calibreBook.series_index || null,
          tags,
          path: calibreBook.path,
          description: calibreBook.description || undefined,
          lastSynced: new Date(),
          addedToLibrary: calibreBook.timestamp ? new Date(calibreBook.timestamp) : new Date(),
          rating: calibreBook.rating !== null ? calibreBook.rating : null,
        };

        if (existingBook) {
          booksToUpdate.push(bookData);
          chunkUpdatedCount++;
        } else {
          booksToInsert.push(bookData);
          chunkSyncedCount++;
        }
      }

      // Step 5: Bulk insert new books and update existing books
      // This approach prevents AUTOINCREMENT sequence leak by separating operations:
      // - INSERT advances sequence (correct behavior)
      // - UPDATE does not advance sequence (correct behavior)
      if (booksToInsert.length > 0) {
        logger.debug(
          { chunk: chunkNumber, booksToInsert: booksToInsert.length },
          `[Sync:Chunk] Inserting ${booksToInsert.length} new books`
        );
        await bookRepository.bulkInsert(booksToInsert);
      }
      
      if (booksToUpdate.length > 0) {
        logger.debug(
          { chunk: chunkNumber, booksToUpdate: booksToUpdate.length },
          `[Sync:Chunk] Updating ${booksToUpdate.length} existing books`
        );
        await bookRepository.bulkUpdate(booksToUpdate);
      }

      // Step 6: Create sessions for new books
      if (chunkSyncedCount > 0) {
        logger.debug(
          { chunk: chunkNumber, newBooks: chunkSyncedCount },
          `[Sync:Chunk] Creating sessions for ${chunkSyncedCount} new books`
        );
        
        // Get calibreIds of newly inserted books
        const newCalibreIds = booksToInsert.map(book => book.calibreId!);
        
        const newBooksMap = await bookRepository.findAllByCalibreIds(newCalibreIds);
        
        // Use SessionService's canonical data structure for consistency
        // Bulk operation for performance (5000+ books per sync)
        const sessionsToCreate = Array.from(newBooksMap.values()).map(book =>
          SessionService.buildInitialSessionData(book.id)
        );

        await sessionRepository.bulkCreate(sessionsToCreate);
        logger.debug({ chunk: chunkNumber }, `[Sync:Chunk] Sessions created`);
      }

      // Step 7: Upsert book_sources entries for all books in this chunk
      logger.debug(
        { chunk: chunkNumber, booksToLink: calibreBooks.length },
        `[Sync:Chunk] Upserting book_sources entries`
      );
      
      // Get all books from this chunk to ensure we have their IDs
      const calibreIdsInChunk = calibreBooks
        .map(book => book.id)
        .filter((id): id is number => id !== null && id !== undefined);
      
      const booksInChunk = await bookRepository.findAllByCalibreIds(calibreIdsInChunk);
      
      // Upsert book_sources entries for each book
      for (const [calibreId, book] of booksInChunk.entries()) {
        await bookSourceRepository.upsert({
          bookId: book.id,
          providerId: 'calibre',
          externalId: calibreId.toString(),
          isPrimary: true,
          lastSynced: new Date(),
          syncEnabled: true,
        });
      }
      
      logger.debug(
        { chunk: chunkNumber, sourcesUpserted: booksInChunk.size },
        `[Sync:Chunk] Book sources upserted`
      );

      // Update totals
      syncedCount += chunkSyncedCount;
      updatedCount += chunkUpdatedCount;

      // Chunk progress (only log for multi-chunk syncs)
      if (numChunks > 1) {
        const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
        const overallProgress = ((chunkNumber / numChunks) * 100).toFixed(1);
        const booksProcessed = Math.min(offset + chunkSize, totalBooks);
        const estimatedRemaining = numChunks > chunkNumber 
          ? (((Date.now() - startTime) / chunkNumber) * (numChunks - chunkNumber) / 1000).toFixed(0)
          : 0;
        
        logger.info(
          {
            chunk: chunkNumber,
            chunkNew: chunkSyncedCount,
            chunkUpdated: chunkUpdatedCount,
            booksProcessed,
            totalBooks,
            percentComplete: overallProgress,
            etaSec: estimatedRemaining,
          },
          `[Sync:Progress] Chunk ${chunkNumber}/${numChunks} complete (${chunkSyncedCount} new, ${chunkUpdatedCount} updated) | ${booksProcessed}/${totalBooks} (${overallProgress}%) | ETA: ${estimatedRemaining}s`
        );
      }
    }

    const bookProcessingDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(
      { 
        booksProcessed: syncedCount + updatedCount, 
        totalBooks, 
        durationSec: bookProcessingDuration, 
        newBooks: syncedCount, 
        updatedBooks: updatedCount,
        source: 'calibre' // T047: Log source filtering
      },
      `[Sync:Books] Processed ${syncedCount + updatedCount}/${totalBooks} books (source=calibre) in ${bookProcessingDuration}s (${syncedCount} new, ${updatedCount} updated)`
    );

    // ========================================
    // PHASE 2: Orphan Detection (Optional)
    // T040: Only detect orphaned books from Calibre source (handled in repository)
    // ========================================
    let removedCount = 0;
    const orphanedBooks: string[] = [];

    if (detectOrphans) {
      // Repository already filters by source='calibre' - see book.repository.ts:658
      const removedBooks = await bookRepository.findNotInCalibreIds(allCalibreIds);

      // SAFETY CHECK: Prevent mass orphaning (>10% of library)
      if (removedBooks.length > 0) {
        const totalBooksInDb = await bookRepository.count();
        const orphanPercentage = (removedBooks.length / totalBooksInDb) * 100;
        
        logger.warn(
          { orphanPercentage: orphanPercentage.toFixed(1), potentialOrphans: removedBooks.length, totalBooksInDb },
          `[Sync:Safety] High orphan rate detected: would orphan ${removedBooks.length}/${totalBooksInDb} books (${orphanPercentage.toFixed(1)}%)`
        );
        
        if (orphanPercentage > 10) {
          logger.error(
            { orphanPercentage: orphanPercentage.toFixed(1), removedBooks: removedBooks.length },
            `[Sync] Error: Sync aborted - would orphan ${orphanPercentage.toFixed(1)}% of library`
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
        const totalBooksInDb = await bookRepository.count();
        const orphanPercentage = ((removedCount / totalBooksInDb) * 100).toFixed(2);
        logger.info(
          { removedCount, orphanPercentage, source: 'calibre' }, // T047: Log source filtering
          `[Sync:Orphans] Marked ${removedCount} Calibre book(s) as orphaned (${orphanPercentage}% of library)`
        );
      } else {
        logger.info({ potentialOrphans: 0, removedCount: 0, source: 'calibre' }, `[Sync:Orphans] No orphaned Calibre books found`);
      }
    } else {
      // Orphan detection disabled - skip this phase
    }

    // ========================================
    // COMPLETION
    // ========================================
    lastSyncTime = new Date();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const booksPerSecond = (totalBooks / parseFloat(duration)).toFixed(0);

    logger.info(
      {
        totalBooks,
        syncedCount,
        updatedCount,
        removedCount,
        durationSec: duration,
        booksPerSec: booksPerSecond,
      },
      `[Sync] Complete: ${totalBooks} books in ${duration}s (${booksPerSecond} books/sec) - ${syncedCount} new, ${updatedCount} updated, ${removedCount} orphaned`
    );

    // Clear cover caches after successful sync
    // Ensures fresh covers are fetched if they were updated in Calibre
    const coverCacheStats = getCoverCacheStats();
    const pathCacheStats = getBookPathCacheStats();
    
    clearCoverCache();
    clearBookPathCache();
    
    logger.info(
      {
        coverCacheSize: coverCacheStats.size,
        pathCacheSize: pathCacheStats.size,
        coverCacheHitRate: coverCacheStats.size > 0 ? ((coverCacheStats.size / totalBooks) * 100).toFixed(1) + '%' : '0%',
      },
      `[Sync] Cleared cover caches (${coverCacheStats.size} covers, ${pathCacheStats.size} paths cached)`
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
    getLogger().error({ err: error }, "[Sync] Error: Calibre sync failed");
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
