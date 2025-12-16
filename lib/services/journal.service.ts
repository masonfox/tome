import { getDatabase } from "@/lib/db/context";
import { progressLogs } from "@/lib/db/schema/progress-logs";
import { books } from "@/lib/db/schema/books";
import { eq, desc, sql } from "drizzle-orm";
import { buildArchiveHierarchy, type ArchiveNode } from "@/lib/utils/archive-builder";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

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
   * Date grouping respects the user's timezone:
   * - Dates are stored in UTC in the database
   * - Converted to user's timezone for grouping
   * - Entry logged at 2024-12-16 23:30 JST → grouped as 2024-12-16
   * - Same UTC time for NYC user → grouped as 2024-12-16 09:30 EST → 2024-12-16
   * 
   * @param timezone - IANA timezone identifier (e.g., "America/New_York", "Asia/Tokyo")
   * @param limit - Number of progress logs to fetch (default: 50)
   * @param skip - Number of progress logs to skip for pagination (default: 0)
   */
  async getJournalEntries(
    timezone: string = 'America/New_York',
    limit: number = 50,
    skip: number = 0
  ): Promise<{ entries: GroupedJournalEntry[]; total: number; hasMore: boolean }> {
    const db = getDatabase();
    
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

    // Group by date and book (respecting user's timezone)
    const grouped = new Map<string, Map<number, JournalEntry[]>>();

    for (const entry of entries) {
      // Convert UTC date to user's timezone, then extract date portion
      // This ensures entries are grouped by the user's local date
      const dateInUserTz = toZonedTime(entry.progressDate, timezone);
      const dateKey = format(dateInUserTz, 'yyyy-MM-dd');

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

  /**
   * Get archive metadata (Year → Month → Week hierarchy with counts)
   * Used for archive navigation tree
   *
   * @param timezone - IANA timezone identifier (e.g., "America/New_York", "Asia/Tokyo")
   * @returns Array of year nodes with nested month and week children
   */
  async getArchiveMetadata(timezone: string = 'America/New_York'): Promise<ArchiveNode[]> {
    const db = getDatabase();
    
    // Fetch all progress log dates
    // We only need the dates, not the full entry details
    const entries = await db
      .select({
        progressDate: progressLogs.progressDate,
      })
      .from(progressLogs)
      .innerJoin(books, eq(progressLogs.bookId, books.id))
      .orderBy(desc(progressLogs.progressDate))
      .all();

    // Extract dates as Date objects
    const dates = entries.map((entry: { progressDate: Date }) => entry.progressDate);

    // Debug: Log date range and sample dates
    const { getLogger } = require("@/lib/logger");
    if (dates.length > 0) {
      const dateStrings = dates.map((d: Date) => d.toISOString().split('T')[0]);
      const uniqueMonths = Array.from(new Set(dateStrings.map((d: string) => d.substring(0, 7)))).sort();
      getLogger().debug({
        totalDates: dates.length,
        firstDate: dateStrings[0],
        lastDate: dateStrings[dateStrings.length - 1],
        uniqueMonths,
        sampleDates: dateStrings.slice(0, 10)
      }, "Archive metadata - fetched dates");
    }

    // Build and return hierarchy
    const hierarchy = buildArchiveHierarchy(dates, timezone);

    // Debug: Log built hierarchy
    getLogger().debug({
      yearCount: hierarchy.length,
      years: hierarchy.map(y => ({
        year: y.label,
        count: y.count,
        months: y.children?.length || 0
      }))
    }, "Archive metadata - built hierarchy");

    return hierarchy;
  }
}

export const journalService = new JournalService();
