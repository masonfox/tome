import { sqliteTable, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const readingGoals = sqliteTable(
  "reading_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    year: integer("year").notNull(),
    booksGoal: integer("books_goal").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Unique constraint: one goal per user per year
    // COALESCE handles NULL userId in single-user mode (same pattern as streaks table)
    userYearIdx: uniqueIndex("idx_goal_user_year").on(
      sql`COALESCE(${table.userId}, -1)`,
      table.year
    ),
    // Index for year-based queries
    yearIdx: index("idx_goal_year").on(table.year),
    // Check constraint: minimum goal of 1 book
    booksGoalCheck: check("books_goal_check", sql`${table.booksGoal} >= 1`),
    // Check constraint: year must be a valid 4-digit year
    yearRangeCheck: check("year_range_check", sql`${table.year} >= 1900 AND ${table.year} <= 9999`),
  })
);

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
