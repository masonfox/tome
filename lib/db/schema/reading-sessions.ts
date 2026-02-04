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
      enum: ["to-read", "read-next", "reading", "read", "dnf"],
    }).notNull().default("to-read"),
    startedDate: text("started_date"), // YYYY-MM-DD format
    completedDate: text("completed_date"), // YYYY-MM-DD format - when reading ended (for both "read" and "dnf" status)
    review: text("review"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    readNextOrder: integer("read_next_order").notNull().default(0),
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
    // Partial index for read-next ordering (only WHERE status = 'read-next')
    readNextOrderIdx: index("idx_sessions_read_next_order").on(table.readNextOrder, table.id).where(sql`${table.status} = 'read-next'`),
  })
);

export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;
