import { connectDB } from "@/lib/db/mongodb";
import { getAllBooks, getBookTags, getCoverPath } from "@/lib/db/calibre";
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";

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
    await connectDB();

    const calibreBooks = getAllBooks();
    let syncedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    const orphanedBooks: string[] = [];

    // Track calibre IDs currently in library
    const calibreIds = new Set(calibreBooks.map(b => b.id));

    for (const calibreBook of calibreBooks) {
      const tags = getBookTags(calibreBook.id);
      const coverPath = calibreBook.has_cover
        ? getCoverPath(calibreBook.id)
        : undefined;

      const existingBook = await Book.findOne({
        calibreId: calibreBook.id,
      });

      const bookData = {
        calibreId: calibreBook.id,
        title: calibreBook.title,
        authors: calibreBook.authors
          ? calibreBook.authors.split(",").map((a) => a.trim())
          : [],
        isbn: calibreBook.isbn || undefined,
        publisher: calibreBook.publisher || undefined,
        pubDate: calibreBook.pubdate
          ? new Date(calibreBook.pubdate)
          : undefined,
        series: calibreBook.series || undefined,
        seriesIndex: calibreBook.series_index || undefined,
        tags,
        path: calibreBook.path,
        coverPath,
        lastSynced: new Date(),
        addedToLibrary: calibreBook.timestamp
          ? new Date(calibreBook.timestamp)
          : new Date(),
      };

      if (existingBook) {
        await Book.findByIdAndUpdate(existingBook._id, bookData);
        updatedCount++;
      } else {
        const newBook = await Book.create(bookData);
        // Auto-create "to-read" status for new books
        await ReadingStatus.create({
          bookId: newBook._id,
          status: "to-read",
        });
        syncedCount++;
      }
    }

    // Detect removed books - find books whose calibreId is no longer in Calibre
    const removedBooks = await Book.find({
      calibreId: { $nin: Array.from(calibreIds) },
      orphaned: { $ne: true },
    });

    for (const book of removedBooks) {
      orphanedBooks.push((book._id as any).toString());
      // Mark as orphaned but don't delete
      await Book.findByIdAndUpdate(book._id, {
        orphaned: true,
        orphanedAt: new Date(),
      });
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
