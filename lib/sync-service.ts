import { getAllBooks, getBookTags } from "@/lib/db/calibre";
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

let lastSyncTime: Date | null = null;
let isSyncing = false;

export async function syncCalibreLibrary(): Promise<SyncResult> {
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
    const calibreBooks = getAllBooks();
    let syncedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    const orphanedBooks: string[] = [];

    // Track calibre IDs currently in library
    const calibreIds = calibreBooks.map((b) => b.id);

    for (const calibreBook of calibreBooks) {
      const tags = getBookTags(calibreBook.id);

      const existingBook = await bookRepository.findByCalibreId(calibreBook.id);

      const bookData = {
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

      if (existingBook) {
        await bookRepository.update(existingBook.id, bookData as any);
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

    for (const book of removedBooks) {
      orphanedBooks.push(book.id.toString());
      // Mark as orphaned but don't delete
      await bookRepository.markAsOrphaned(book.id);
      removedCount++;
    }

    lastSyncTime = new Date();

    return {
      success: true,
      syncedCount,
      updatedCount,
      removedCount,
      totalBooks: calibreBooks.length,
      orphanedBooks: orphanedBooks.length > 0 ? orphanedBooks : undefined,
    };
  } catch (error) {
    console.error("Calibre sync error:", error);
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
