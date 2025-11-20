import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { books } from "./books";

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    sessionNumber: integer("session_number").notNull(),
    status: text("status", {
      enum: ["to-read", "read-next", "reading", "read"],
    }).notNull().default("to-read"),
    startedDate: integer("started_date", { mode: "timestamp" }),
    completedDate: integer("completed_date", { mode: "timestamp" }),
    rating: integer("rating"), // 1-5
    review: text("review"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Unique constraint on bookId + sessionNumber
    bookSessionIdx: uniqueIndex("idx_book_session").on(table.bookId, table.sessionNumber),
    // Partial unique index: only one active session per book
    activeSessionIdx: uniqueIndex("idx_active_session").on(table.bookId).where(sql`${table.isActive} = 1`),
    // Regular indexes
    bookIdIdx: index("idx_sessions_book_id").on(table.bookId),
    statusIdx: index("idx_sessions_status").on(table.status),
    userBookIdx: index("idx_sessions_user_book").on(table.userId, table.bookId),
    // Check constraints
    ratingCheck: check("rating_check", sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`),
  })
);

export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;
