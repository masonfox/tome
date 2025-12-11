import { sql, asc } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";
import { BaseRepository } from "./base.repository";

export interface SeriesInfo {
  name: string;
  bookCount: number;
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

/**
 * Repository for series-related database operations
 * Handles queries for series and books within series
 */
export class SeriesRepository extends BaseRepository<any, any, typeof books> {
  constructor() {
    super(books);
  }

  protected getTable() {
    return books;
  }

  /**
   * Get all unique series with book counts
   * @returns Array of series info objects
   */
  async getAllSeries(): Promise<SeriesInfo[]> {
    const db = this.getDatabase();

    const result = await db
      .select({
        name: books.series,
        bookCount: sql<number>`COUNT(*)`.as('bookCount'),
      })
      .from(books)
      .where(sql`${books.series} IS NOT NULL AND ${books.orphaned} = 0`)
      .groupBy(books.series)
      .orderBy(asc(books.series));

    return result.map(r => ({
      name: r.name!,
      bookCount: r.bookCount,
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
        sql`${books.id} = ${readingSessions.bookId} AND ${readingSessions.isActive} = 1`
      )
      .where(sql`${books.series} = ${seriesName} AND ${books.orphaned} = 0`)
      .orderBy(asc(books.seriesIndex));

    return result.map(r => ({
      id: r.id,
      calibreId: r.calibreId,
      title: r.title,
      authors: r.authors,
      seriesIndex: r.seriesIndex!,
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
      .where(sql`${books.series} = ${seriesName} AND ${books.orphaned} = 0`)
      .groupBy(books.series)
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      name: result[0].name!,
      bookCount: result[0].bookCount,
    };
  }
}

// Export singleton instance
export const seriesRepository = new SeriesRepository();
