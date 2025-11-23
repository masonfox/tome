import { getAllBooks, getBookTags, CalibreBook } from "@/lib/db/calibre";
import { bookRepository, sessionRepository } from "@/lib/repositories";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  updatedCount: number;
  removedCount: number;
  totalBooks: number;
  orphanedBooks?: string[];
  error?: string;
}

/**
 * Interface for Calibre data source
 * Allows dependency injection for testing
 */
export interface CalibreDataSource {
  getAllBooks(): CalibreBook[];
  getBookTags(bookId: number): string[];
}

/**
 * Default Calibre data source using real database
 */
const defaultCalibreSource: CalibreDataSource = {
  getAllBooks,
  getBookTags,
};

let lastSyncTime: Date | null = null;
let isSyncing = false;

/**
 * Sync Calibre library with Tome database
 * 
 * @param calibreSource - Data source for Calibre books (defaults to real Calibre DB)
 * @returns SyncResult with counts and any errors
 */
export async function syncCalibreLibrary(
  calibreSource: CalibreDataSource = defaultCalibreSource
): Promise<SyncResult> {
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

  try {
    const { getLogger } = require("@/lib/logger");
    const logger = getLogger();
    logger.info("[Sync] Starting Calibre sync...");
    const calibreBooks = calibreSource.getAllBooks();
    logger.info({ calibreBooksCount: calibreBooks.length }, `[Sync] Found ${calibreBooks.length} books in Calibre database`);
    
    // SAFETY CHECK: Abort if Calibre returns no books
    // This prevents catastrophic data loss from orphaning all books
    if (calibreBooks.length === 0) {
      const { getLogger } = require("@/lib/logger");
      getLogger().error("[Sync] CRITICAL: No books found in Calibre database. Aborting sync.");
      return {
        success: false,
        syncedCount: 0,
        updatedCount: 0,
        removedCount: 0,
        totalBooks: 0,
        error: "No books found in Calibre database. This may indicate a connection issue or corrupted database. Sync aborted to prevent data loss.",
      };
    }

    let syncedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    const orphanedBooks: string[] = [];

    // Track calibre IDs currently in library
    const calibreIds = calibreBooks.map((b) => b.id);

    for (const calibreBook of calibreBooks) {
      const tags = calibreSource.getBookTags(calibreBook.id);

      const existingBook = await bookRepository.findByCalibreId(calibreBook.id);

      const bookData: any = {
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
      };

      // Always sync rating (including null) to ensure rating changes from Calibre are reflected
      // Use explicit null instead of undefined so Drizzle updates the field
      bookData.rating = calibreBook.rating !== null ? calibreBook.rating : null;

      if (existingBook) {
        await bookRepository.update(existingBook.id, bookData);
        updatedCount++;
      } else {
        const newBook = await bookRepository.create(bookData as any);
        // Auto-create "to-read" session for new books
        await sessionRepository.create({
          bookId: newBook.id,
          status: "to-read",
          sessionNumber: 1,
          isActive: true,
        });
        syncedCount++;
      }
    }

    // Detect removed books - find books whose calibreId is no longer in Calibre
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

    for (const book of removedBooks) {
      orphanedBooks.push(book.id.toString());
      // Mark as orphaned but don't delete
      await bookRepository.markAsOrphaned(book.id);
      removedCount++;
    }
    
    if (removedCount > 0) {
      logger.info({ removedCount }, `[Sync] Marked ${removedCount} books as orphaned`);
    }

    lastSyncTime = new Date();

    logger.info({ syncedCount, updatedCount, removedCount }, `[Sync] Sync completed successfully: ${syncedCount} new, ${updatedCount} updated, ${removedCount} orphaned`);

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
