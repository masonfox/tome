import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // DEPRECATED: Will be removed in future migration after transition to book_sources
    // Use bookSourceRepository to query book sources instead
    // Multi-source support: calibreId is now nullable for non-Calibre books
    calibreId: integer("calibre_id").unique(),
    title: text("title").notNull(),
    // Store authors as JSON array
    authors: text("authors", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    // Pre-computed sort value for efficient author sorting (e.g., "Sanderson, Brandon")
    authorSort: text("author_sort"),
    isbn: text("isbn"),
    totalPages: integer("total_pages"),
    addedToLibrary: integer("added_to_library", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastSynced: integer("last_synced", { mode: "timestamp" }),
    publisher: text("publisher"),
    pubDate: integer("pub_date", { mode: "timestamp" }),
    series: text("series"),
    seriesIndex: real("series_index"),
    // Store tags as JSON array
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    // Path is Calibre-specific, nullable for non-Calibre books
    path: text("path"),
    description: text("description"),
    rating: integer("rating"), // 1-5 stars, synced from Calibre or set manually
    orphaned: integer("orphaned", { mode: "boolean" }).notNull().default(false),
    orphanedAt: integer("orphaned_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for efficient author sorting
    authorSortIdx: index("idx_books_author_sort").on(table.authorSort),
  })
);

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
