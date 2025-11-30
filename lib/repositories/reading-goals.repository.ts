import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { readingGoals, readingSessions } from "@/lib/db/schema";
import type { ReadingGoal, NewReadingGoal } from "@/lib/db/schema";

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
}

export const readingGoalRepository = new ReadingGoalRepository();
