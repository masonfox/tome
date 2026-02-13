import { sql, asc, eq, and, isNotNull } from "drizzle-orm";
import { isNotOrphaned } from "@/lib/db/sql-helpers";
import { books } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { BaseRepository } from "./base.repository";
import { getLogger } from "@/lib/logger";

export interface SeriesInfo {
  name: string;
  bookCount: number;
  bookCoverIds: number[]; // Tome book IDs for cover display (up to 12)
  totalBooks?: number;
}

export interface SeriesBook {
  id: number;
  calibreId: number | null;
  title: string;
  authors: string[];
  seriesIndex: number;
  totalPages?: number;
  rating?: number | null;
  status?: string | null;
  tags: string[];
  description?: string | null;
  lastSynced?: Date | null;
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
    const logger = getLogger();
    const db = this.getDatabase();

    logger.debug("[SeriesRepository.getAllSeries] Starting query");

    // Fetch all books with series in a single query, ordered by series and seriesIndex
    const allBooks = await db
      .select({
        id: books.id,
        series: books.series,
        calibreId: books.calibreId,
        seriesIndex: books.seriesIndex,
        title: books.title,
      })
      .from(books)
      .where(
        and(
          isNotNull(books.series),
          sql`${books.series} != ''`,  // Exclude empty strings (Calibre may use '' instead of NULL)
          isNotOrphaned()
        )
      )
      .orderBy(asc(books.series), asc(books.seriesIndex), asc(books.title));

    logger.info({ bookCount: allBooks.length }, `[SeriesRepository.getAllSeries] Found ${allBooks.length} books with series`);
    if (allBooks.length > 0) {
      logger.debug({ firstBook: allBooks[0] }, "[SeriesRepository.getAllSeries] First book");
    }

    // Group books by series and extract first 12 covers in-memory (much faster than N queries)
    const seriesMap = new Map<string, { bookCount: number; bookCoverIds: number[] }>();
    
    for (const book of allBooks) {
      const seriesName = book.series!;
      
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, { bookCount: 0, bookCoverIds: [] });
      }
      
      const seriesData = seriesMap.get(seriesName)!;
      seriesData.bookCount++;
      
      // Keep first 12 cover IDs (matches FannedBookCovers maxCovers default)
      if (seriesData.bookCoverIds.length < 12) {
        seriesData.bookCoverIds.push(book.id);
      }
    }

    // Convert map to array format
    const result = Array.from(seriesMap.entries()).map(([name, data]) => ({
      name,
      bookCount: data.bookCount,
      bookCoverIds: data.bookCoverIds,
    }));

    logger.info({ seriesCount: result.length }, `[SeriesRepository.getAllSeries] Returning ${result.length} series`);
    if (result.length > 0) {
      logger.debug({ firstSeries: result[0] }, "[SeriesRepository.getAllSeries] First series");
    }

    return result;
  }

  /**
   * Get all books in a series, ordered by series index
   * @param seriesName - Name of the series
   * @returns Array of books in the series with their session status
   * 
   * Session selection logic:
   * - Prefers active session if exists
   * - Falls back to most recent archived session (for completed reads)
   * - Returns null status if no sessions exist
   */
  async getBooksBySeries(seriesName: string): Promise<SeriesBook[]> {
    const db = this.getDatabase();

    // Subquery to get the most relevant session ID for each book
    // Priority: active session > most recent archived session
    const sessionIdSubquery = sql`(
      SELECT rs.id FROM ${readingSessions} rs
      WHERE rs.book_id = ${books.id}
      ORDER BY 
        CASE WHEN rs.is_active = 1 THEN 0 ELSE 1 END,
        rs.session_number DESC
      LIMIT 1
    )`;

    // Query books with their session status
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
        lastSynced: books.lastSynced,
        // Get status from the selected session (active or most recent)
        status: readingSessions.status,
      })
      .from(books)
      .leftJoin(
        readingSessions,
        sql`${readingSessions.id} = ${sessionIdSubquery}`
      )
      .where(
        and(
          eq(books.series, seriesName),
          isNotOrphaned()
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
      lastSynced: r.lastSynced ?? undefined,
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
          isNotOrphaned()
        )
      )
      .groupBy(books.series)
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Get the first 12 book IDs for cover display (matches FannedBookCovers maxCovers default)
    const covers = await db
      .select({
        bookId: books.id,
      })
      .from(books)
      .where(
        and(
          eq(books.series, seriesName),
          isNotOrphaned()
        )
      )
      .orderBy(asc(books.seriesIndex), asc(books.title))
      .limit(12);

    return {
      name: result[0].name!,
      bookCount: result[0].bookCount,
      bookCoverIds: covers.map(c => c.bookId),
    };
  }
}

// Export singleton instance
export const seriesRepository = new SeriesRepository();
