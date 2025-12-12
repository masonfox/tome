import { sql, asc, eq, and, isNotNull } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { BaseRepository } from "./base.repository";

export interface SeriesInfo {
  name: string;
  bookCount: number;
  bookCoverIds: number[]; // First 3 Calibre IDs for cover display
  totalBooks?: number;
}

export interface SeriesBook {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  seriesIndex: number;
  totalPages?: number;
  rating?: number | null;
  status?: string | null;
  tags: string[];
  description?: string | null;
}

// Type definitions for repository
export type SeriesRepositorySelect = SeriesInfo | SeriesBook;
export type SeriesRepositoryInsert = never; // Read-only repository

/**
 * Repository for series-related database operations
 * Handles queries for series and books within series
 * This is a read-only repository - series data is managed through Calibre sync
 */
export class SeriesRepository extends BaseRepository<
  SeriesRepositorySelect,
  SeriesRepositoryInsert,
  typeof books
> {
  constructor() {
    super(books);
  }

  protected getTable() {
    return books;
  }

  /**
   * Get all unique series with book counts and cover IDs
   * @returns Array of series info objects
   */
  async getAllSeries(): Promise<SeriesInfo[]> {
    const db = this.getDatabase();

    // Fetch all books with series in a single query, ordered by series and seriesIndex
    const allBooks = await db
      .select({
        series: books.series,
        calibreId: books.calibreId,
        seriesIndex: books.seriesIndex,
        title: books.title,
      })
      .from(books)
      .where(
        and(
          isNotNull(books.series),
          eq(books.orphaned, false)
        )
      )
      .orderBy(asc(books.series), asc(books.seriesIndex), asc(books.title));

    // Group books by series and extract first 3 covers in-memory (much faster than N queries)
    const seriesMap = new Map<string, { bookCount: number; bookCoverIds: number[] }>();
    
    for (const book of allBooks) {
      const seriesName = book.series!;
      
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, { bookCount: 0, bookCoverIds: [] });
      }
      
      const seriesData = seriesMap.get(seriesName)!;
      seriesData.bookCount++;
      
      // Only keep first 3 cover IDs
      if (seriesData.bookCoverIds.length < 3) {
        seriesData.bookCoverIds.push(book.calibreId);
      }
    }

    // Convert map to array format
    return Array.from(seriesMap.entries()).map(([name, data]) => ({
      name,
      bookCount: data.bookCount,
      bookCoverIds: data.bookCoverIds,
    }));
  }

  /**
   * Get all books in a series, ordered by series index
   * @param seriesName - Name of the series
   * @returns Array of books in the series with their active session status
   */
  async getBooksBySeries(seriesName: string): Promise<SeriesBook[]> {
    const db = this.getDatabase();

    // Query books with their active session status
    const result = await db
      .select({
        id: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        seriesIndex: books.seriesIndex,
        totalPages: books.totalPages,
        rating: books.rating,
        tags: books.tags,
        description: books.description,
        // Get status from active session
        status: readingSessions.status,
      })
      .from(books)
      .leftJoin(
        readingSessions,
        and(
          eq(books.id, readingSessions.bookId),
          eq(readingSessions.isActive, true)
        )
      )
      .where(
        and(
          eq(books.series, seriesName),
          eq(books.orphaned, false)
        )
      )
      .orderBy(asc(books.seriesIndex), asc(books.title));

    return result.map(r => ({
      id: r.id,
      calibreId: r.calibreId,
      title: r.title,
      authors: r.authors,
      seriesIndex: r.seriesIndex ?? 0,
      totalPages: r.totalPages ?? undefined,
      rating: r.rating,
      status: r.status,
      tags: r.tags,
      description: r.description ?? undefined,
    }));
  }

  /**
   * Get series info by name
   * @param seriesName - Name of the series
   * @returns Series info or null if not found
   */
  async getSeriesByName(seriesName: string): Promise<SeriesInfo | null> {
    const db = this.getDatabase();

    const result = await db
      .select({
        name: books.series,
        bookCount: sql<number>`COUNT(*)`.as('bookCount'),
      })
      .from(books)
      .where(
        and(
          eq(books.series, seriesName),
          eq(books.orphaned, false)
        )
      )
      .groupBy(books.series)
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Get the first 3 calibre IDs for cover display
    const covers = await db
      .select({
        calibreId: books.calibreId,
      })
      .from(books)
      .where(
        and(
          eq(books.series, seriesName),
          eq(books.orphaned, false)
        )
      )
      .orderBy(asc(books.seriesIndex), asc(books.title))
      .limit(3);

    return {
      name: result[0].name!,
      bookCount: result[0].bookCount,
      bookCoverIds: covers.map(c => c.calibreId),
    };
  }
}

// Export singleton instance
export const seriesRepository = new SeriesRepository();
