import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const importLogs = sqliteTable(
  "import_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    provider: text("provider", {
      enum: ["goodreads", "storygraph"],
    }).notNull(),
    totalRecords: integer("total_records").notNull().default(0),
    matchedRecords: integer("matched_records").notNull().default(0),
    unmatchedRecords: integer("unmatched_records").notNull().default(0),
    sessionsCreated: integer("sessions_created").notNull().default(0),
    sessionsSkipped: integer("sessions_skipped").notNull().default(0),
    ratingsSync: integer("ratings_sync").notNull().default(0),
    calibreSyncFailures: integer("calibre_sync_failures").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    status: text("status", {
      enum: ["pending", "processing", "success", "partial", "failed"],
    }).notNull().default("pending"),
    errorMessage: text("error_message"),
    matchResults: text("match_results", { mode: "json" }), // JSON storage for match results to survive server restarts
    userId: integer("user_id"), // Nullable for single-user mode
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Query import history by user and date
    userCreatedIdx: index("idx_import_logs_user_created").on(table.userId, table.createdAt),
    // Query failed imports for debugging
    statusCreatedIdx: index("idx_import_logs_status_created").on(table.status, table.createdAt),
    // Query imports by provider
    providerCreatedIdx: index("idx_import_logs_provider_created").on(table.provider, table.createdAt),
  })
);

export type ImportLog = typeof importLogs.$inferSelect;
export type NewImportLog = typeof importLogs.$inferInsert;
