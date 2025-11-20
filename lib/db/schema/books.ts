import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  calibreId: integer("calibre_id").notNull().unique(),
  title: text("title").notNull(),
  // Store authors as JSON array
  authors: text("authors", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  isbn: text("isbn"),
  totalPages: integer("total_pages"),
  addedToLibrary: integer("added_to_library", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  lastSynced: integer("last_synced", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  publisher: text("publisher"),
  pubDate: integer("pub_date", { mode: "timestamp" }),
  series: text("series"),
  seriesIndex: real("series_index"),
  // Store tags as JSON array
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  path: text("path").notNull(),
  description: text("description"),
  orphaned: integer("orphaned", { mode: "boolean" }).notNull().default(false),
  orphanedAt: integer("orphaned_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
