import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { importLogs } from "./import-logs";

export const importUnmatchedRecords = sqliteTable(
  "import_unmatched_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    importLogId: integer("import_log_id")
      .notNull()
      .references(() => importLogs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Store authors as JSON array
    authors: text("authors", { mode: "json" }).$type<string[]>().notNull(),
    isbn: text("isbn"),
    isbn13: text("isbn13"),
    rating: integer("rating"),
    completedDate: integer("completed_date", { mode: "timestamp" }),
    status: text("status", {
      enum: ["read", "currently-reading", "to-read", "did-not-finish", "paused"],
    }).notNull(),
    review: text("review"),
    matchAttempted: integer("match_attempted", { mode: "boolean" }).notNull().default(true),
    matchReason: text("match_reason", {
      enum: ["no_isbn", "isbn_not_found", "no_title_match", "ambiguous_match", "not_in_library", "invalid_data"],
    }).notNull(),
    confidence: integer("confidence"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Query unmatched records by import
    importLogIdx: index("idx_unmatched_import_log").on(table.importLogId),
    // Query by match reason for analysis
    reasonIdx: index("idx_unmatched_reason").on(table.matchReason),
    // Query by title for manual searching
    titleIdx: index("idx_unmatched_title").on(table.title),
  })
);

export type ImportUnmatchedRecord = typeof importUnmatchedRecords.$inferSelect;
export type NewImportUnmatchedRecord = typeof importUnmatchedRecords.$inferInsert;
