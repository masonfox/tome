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

    // First, get all series with book counts
    const seriesList = await db
      .select({
        name: books.series,
        bookCount: sql<number>`COUNT(*)`.as('bookCount'),
      })
      .from(books)
      .where(
        and(
          isNotNull(books.series),
          eq(books.orphaned, false)
        )
      )
      .groupBy(books.series)
      .orderBy(asc(books.series));

    // For each series, get the first 3 calibre IDs
    const seriesWithCovers = await Promise.all(
      seriesList.map(async (series) => {
        const covers = await db
          .select({
            calibreId: books.calibreId,
          })
          .from(books)
          .where(
            and(
              eq(books.series, series.name!),
              eq(books.orphaned, false)
            )
          )
          .orderBy(asc(books.seriesIndex), asc(books.title))
          .limit(3);

        return {
          name: series.name!,
          bookCount: series.bookCount,
          bookCoverIds: covers.map(c => c.calibreId),
        };
      })
    );

    return seriesWithCovers;
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
