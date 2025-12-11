import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { readingGoals, readingSessions, books } from "@/lib/db/schema";
import type { ReadingGoal, NewReadingGoal, Book } from "@/lib/db/schema";

export class ReadingGoalRepository extends BaseRepository<
  ReadingGoal,
  NewReadingGoal,
  typeof readingGoals
> {
  constructor() {
    super(readingGoals);
  }

  /**
   * Find goal for specific user and year
   * Returns undefined if not found
   */
  async findByUserAndYear(
    userId: number | null,
    year: number
  ): Promise<ReadingGoal | undefined> {
    const db = this.getDatabase();
    return db
      .select()
      .from(this.table)
      .where(
        and(
          userId === null
            ? isNull(this.table.userId)
            : eq(this.table.userId, userId),
          eq(this.table.year, year)
        )
      )
      .get();
  }

  /**
   * Get all goals for a user, ordered by year descending
   */
  async findByUserId(userId: number | null): Promise<ReadingGoal[]> {
    const db = this.getDatabase();
    return db
      .select()
      .from(this.table)
      .where(
        userId === null
          ? isNull(this.table.userId)
          : eq(this.table.userId, userId)
      )
      .orderBy(desc(this.table.year))
      .all();
  }

  /**
   * Count books completed in a specific year
   * Queries reading_sessions.completedDate
   */
  async getBooksCompletedInYear(
    userId: number | null,
    year: number
  ): Promise<number> {
    const db = this.getDatabase();

    const result = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(readingSessions)
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate),
          sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) = ${year.toString()}`
        )
      )
      .get();

    return result?.count ?? 0;
  }

  /**
   * Get all years with completed books, with counts
   * Used for library year filter dropdown
   */
  async getYearsWithCompletedBooks(
    userId: number | null
  ): Promise<Array<{ year: number; count: number }>> {
    const db = this.getDatabase();

    const results = db
      .select({
        year: sql<number>`CAST(strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(readingSessions)
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate)
        )
      )
      .groupBy(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      .orderBy(
        desc(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      )
      .all();

    return results;
  }

  /**
   * Get books completed per month for a specific year
   * Returns all 12 months (1-12) with count for each
   * Months without completions return count: 0
   */
  async getBooksCompletedByMonth(
    userId: number | null,
    year: number
  ): Promise<Array<{ month: number; count: number }>> {
    const db = this.getDatabase();

    // Query for books completed in each month
    const results = db
      .select({
        month: sql<number>`CAST(strftime('%m', datetime(${readingSessions.completedDate}, 'unixepoch')) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(readingSessions)
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate),
          sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) = ${year.toString()}`
        )
      )
      .groupBy(sql`strftime('%m', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      .all();

    // Create a map of month -> count from query results
    const monthMap = new Map<number, number>();
    results.forEach((r) => {
      monthMap.set(r.month, r.count);
    });

    // Fill all 12 months (1-12) with count=0 for missing months
    const allMonths: Array<{ month: number; count: number }> = [];
    for (let month = 1; month <= 12; month++) {
      allMonths.push({
        month,
        count: monthMap.get(month) ?? 0,
      });
    }

    return allMonths;
  }

  /**
   * Get all books completed in a specific year
   * Returns books with their completion dates, ordered by completion date descending
   */
  async getBooksByCompletionYear(
    userId: number | null,
    year: number
  ): Promise<Array<Book & { completedDate: Date }>> {
    const db = this.getDatabase();

    const results = db
      .select({
        // Book fields
        id: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        isbn: books.isbn,
        totalPages: books.totalPages,
        addedToLibrary: books.addedToLibrary,
        lastSynced: books.lastSynced,
        publisher: books.publisher,
        pubDate: books.pubDate,
        series: books.series,
        seriesIndex: books.seriesIndex,
        tags: books.tags,
        path: books.path,
        description: books.description,
        rating: books.rating,
        orphaned: books.orphaned,
        orphanedAt: books.orphanedAt,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        // Completion date from session
        completedDate: readingSessions.completedDate,
      })
      .from(readingSessions)
      .innerJoin(books, eq(readingSessions.bookId, books.id))
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate),
          sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) = ${year.toString()}`
        )
      )
      .orderBy(desc(readingSessions.completedDate))
      .all();

    return results as Array<Book & { completedDate: Date }>;
  }
}

export const readingGoalRepository = new ReadingGoalRepository();
