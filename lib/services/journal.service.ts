import { db } from "@/lib/db/sqlite";
import { progressLogs } from "@/lib/db/schema/progress-logs";
import { books } from "@/lib/db/schema/books";
import { eq, desc, sql } from "drizzle-orm";

export interface JournalEntry {
  id: number;
  bookId: number;
  bookTitle: string;
  bookAuthors: string[];
  bookCalibreId: number;
  sessionId: number | null;
  currentPage: number;
  currentPercentage: number;
  progressDate: Date;
  notes: string | null;
  pagesRead: number;
}

export interface GroupedJournalEntry {
  date: string; // YYYY-MM-DD
  books: {
    bookId: number;
    bookTitle: string;
    bookAuthors: string[];
    bookCalibreId: number;
    entries: JournalEntry[];
  }[];
}

export class JournalService {
  /**
   * Get all progress logs grouped by date and book
   * Returns entries in descending date order (most recent first)
   * 
   * Note: Groups by the date portion of the ISO timestamp (YYYY-MM-DD),
   * matching the behavior of formatDateOnly() which extracts the date part
   * without timezone conversion.
   * 
   * @param timezone - Timezone identifier (currently unused, kept for future use)
   * @param limit - Number of progress logs to fetch (default: 50)
   * @param skip - Number of progress logs to skip for pagination (default: 0)
   */
  async getJournalEntries(
    timezone: string = 'America/New_York',
    limit: number = 50,
    skip: number = 0
  ): Promise<{ entries: GroupedJournalEntry[]; total: number; hasMore: boolean }> {
    // Get total count first
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(progressLogs)
      .innerJoin(books, eq(progressLogs.bookId, books.id))
      .get();
    
    const total = totalResult?.count ?? 0;

    // Fetch paginated progress logs with book information
    const entries = await db
      .select({
        id: progressLogs.id,
        bookId: progressLogs.bookId,
        bookTitle: books.title,
        bookAuthors: books.authors,
        bookCalibreId: books.calibreId,
        sessionId: progressLogs.sessionId,
        currentPage: progressLogs.currentPage,
        currentPercentage: progressLogs.currentPercentage,
        progressDate: progressLogs.progressDate,
        notes: progressLogs.notes,
        pagesRead: progressLogs.pagesRead,
      })
      .from(progressLogs)
      .innerJoin(books, eq(progressLogs.bookId, books.id))
      .orderBy(desc(progressLogs.progressDate))
      .limit(limit)
      .offset(skip)
      .all();

    // Group by date and book
    const grouped = new Map<string, Map<number, JournalEntry[]>>();

    for (const entry of entries) {
      // Extract date portion from ISO string (YYYY-MM-DD)
      // This matches formatDateOnly behavior which doesn't do timezone conversion
      const isoString = entry.progressDate.toISOString();
      const dateKey = isoString.split('T')[0];

      // Get or create date group
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new Map());
      }
      const dateGroup = grouped.get(dateKey)!;

      // Get or create book group within date
      if (!dateGroup.has(entry.bookId)) {
        dateGroup.set(entry.bookId, []);
      }
      const bookGroup = dateGroup.get(entry.bookId)!;

      // Add entry to book group
      bookGroup.push({
        id: entry.id,
        bookId: entry.bookId,
        bookTitle: entry.bookTitle,
        bookAuthors: entry.bookAuthors as string[],
        bookCalibreId: entry.bookCalibreId,
        sessionId: entry.sessionId,
        currentPage: entry.currentPage,
        currentPercentage: entry.currentPercentage,
        progressDate: entry.progressDate,
        notes: entry.notes,
        pagesRead: entry.pagesRead,
      });
    }

    // Convert to array format
    const result: GroupedJournalEntry[] = [];
    
    // Sort dates descending
    const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const dateGroup = grouped.get(date)!;
      const booksArray: GroupedJournalEntry['books'] = [];

      // Convert map to array for iteration
      const bookEntries = Array.from(dateGroup.entries());
      
      for (const [bookId, entries] of bookEntries) {
        booksArray.push({
          bookId,
          bookTitle: entries[0].bookTitle,
          bookAuthors: entries[0].bookAuthors,
          bookCalibreId: entries[0].bookCalibreId,
          entries: entries.sort((a: JournalEntry, b: JournalEntry) => b.progressDate.getTime() - a.progressDate.getTime()),
        });
      }

      result.push({
        date,
        books: booksArray,
      });
    }

    const hasMore = skip + limit < total;

    return {
      entries: result,
      total,
      hasMore,
    };
  }
}

export const journalService = new JournalService();
