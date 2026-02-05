/**
 * Tome Integration Service
 * Bridges between Tome database (status/shelves) and Calibre database (book metadata)
 * for OPDS endpoints that need to filter by reading status or shelves
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/lib/db/sqlite';
import { readingSessions } from '@/lib/db/schema/reading-sessions';
import { books } from '@/lib/db/schema/books';
import { shelves, bookShelves } from '@/lib/db/schema/shelves';
import { getBookById, type CalibreBook } from '@/lib/db/calibre';

export type ReadingStatus = 'to-read' | 'reading' | 'read' | 'read-next' | 'dnf';

export interface ShelfInfo {
  id: number;
  name: string;
  description: string | null;
  bookCount: number;
}

/**
 * Get books filtered by reading status using Tome's reading_sessions
 * Returns Calibre book data with full metadata
 * 
 * Note: For "read" status, includes both active and archived sessions since
 * completed books are archived (is_active=false). For other statuses, only
 * active sessions are included to match the library filtering behavior.
 */
export async function getBooksByStatus(
  status: ReadingStatus,
  limit: number,
  offset: number
): Promise<{ books: CalibreBook[]; total: number }> {
  // Get book IDs with the specified status from Tome
  // For 'read-next', order by readNextOrder
  // For others, order by updated timestamp
  const sessionsQuery = db
    .select({
      calibreId: books.calibreId,
    })
    .from(readingSessions)
    .innerJoin(books, eq(readingSessions.bookId, books.id))
    .where(
      // For "read" status, include all sessions (archived + active)
      // For other statuses, only include active sessions
      status === 'read'
        ? eq(readingSessions.status, status)
        : and(
            eq(readingSessions.status, status),
            eq(readingSessions.isActive, true)
          )
    );

  // Apply ordering based on status
  if (status === 'read-next') {
    // Order by read_next_order for read-next queue
    sessionsQuery.orderBy(readingSessions.readNextOrder, readingSessions.id);
  } else if (status === 'read') {
    // Order by most recently completed for "read" status
    sessionsQuery.orderBy(desc(readingSessions.completedDate));
  } else {
    // Order by most recently updated for other statuses
    sessionsQuery.orderBy(readingSessions.updatedAt);
  }

  const allSessions = sessionsQuery.all() as Array<{ calibreId: number }>;
  const calibreIds = allSessions.map(s => s.calibreId);
  const total = calibreIds.length;

  // Apply pagination to calibre IDs
  const paginatedCalibreIds = calibreIds.slice(offset, offset + limit);

  // Fetch full Calibre book data for paginated IDs
  const calibreBooks: CalibreBook[] = [];
  for (const calibreId of paginatedCalibreIds) {
    const book = getBookById(calibreId);
    if (book) {
      calibreBooks.push(book);
    }
  }

  return { books: calibreBooks, total };
}

/**
 * Get all user shelves with book counts
 * Queries Tome's shelves and book_shelves tables
 */
export async function getAllShelves(): Promise<ShelfInfo[]> {
  // Get all shelves with book counts for single-user mode (userId = null)
  const result = db
    .select({
      id: shelves.id,
      name: shelves.name,
      description: shelves.description,
      bookCount: sql<number>`COUNT(DISTINCT ${bookShelves.bookId})`,
    })
    .from(shelves)
    .leftJoin(bookShelves, eq(shelves.id, bookShelves.shelfId))
    .where(sql`${shelves.userId} IS NULL`)
    .groupBy(shelves.id)
    .orderBy(shelves.name)
    .all();

  return result as ShelfInfo[];
}

/**
 * Get books on a specific shelf
 * Combines Calibre book data with Tome shelf membership
 */
export async function getBooksByShelf(
  shelfId: number,
  limit: number,
  offset: number
): Promise<{ books: CalibreBook[]; total: number }> {
  // Get Calibre IDs for books on this shelf (ordered by sort order)
  const booksOnShelf = db
    .select({
      calibreId: books.calibreId,
      sortOrder: bookShelves.sortOrder,
    })
    .from(bookShelves)
    .innerJoin(books, eq(bookShelves.bookId, books.id))
    .where(eq(bookShelves.shelfId, shelfId))
    .orderBy(bookShelves.sortOrder)
    .all();

  const total = booksOnShelf.length;

  // Apply pagination
  const paginatedBooks = booksOnShelf.slice(offset, offset + limit);

  // Fetch full Calibre book data for paginated IDs
  const calibreBooks: CalibreBook[] = [];
  for (const shelfBook of paginatedBooks) {
    const book = getBookById(shelfBook.calibreId);
    if (book) {
      calibreBooks.push(book);
    }
  }

  return { books: calibreBooks, total };
}
