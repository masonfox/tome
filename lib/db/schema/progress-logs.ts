import { sqliteTable, text, integer, real, index, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { books } from "./books";
import { readingSessions } from "./reading-sessions";

export const progressLogs = sqliteTable(
  "progress_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => readingSessions.id, {
      onDelete: "cascade",
    }),
    currentPage: integer("current_page").notNull().default(0),
    currentPercentage: real("current_percentage").notNull().default(0),
    progressDate: text("progress_date").notNull(),
    notes: text("notes"),
    pagesRead: integer("pages_read").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    bookDateIdx: index("idx_progress_book_date").on(table.bookId, table.progressDate),
    sessionDateIdx: index("idx_progress_session_date").on(table.sessionId, table.progressDate),
    userDateIdx: index("idx_progress_user_date").on(table.userId, table.progressDate),
    dateIdx: index("idx_progress_date").on(table.progressDate),
    // Check constraints
    currentPageCheck: check("current_page_check", sql`${table.currentPage} >= 0`),
    currentPercentageCheck: check("current_percentage_check", sql`${table.currentPercentage} >= 0 AND ${table.currentPercentage} <= 100`),
    pagesReadCheck: check("pages_read_check", sql`${table.pagesRead} >= 0`),
  })
);

export type ProgressLog = typeof progressLogs.$inferSelect;
export type NewProgressLog = typeof progressLogs.$inferInsert;
