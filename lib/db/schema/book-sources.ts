import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { books } from "./books";

export const bookSources = sqliteTable(
  "book_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(), // 'calibre' | 'audiobookshelf' | ...
    externalId: text("external_id"), // Provider's ID for this book
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    lastSynced: integer("last_synced", { mode: "timestamp" }),
    syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
    metadata: text("metadata"), // JSON: Provider-specific metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    bookIdIdx: index("idx_book_sources_book_id").on(table.bookId),
    providerIdIdx: index("idx_book_sources_provider_id").on(table.providerId),
    externalIdIdx: index("idx_book_sources_external_id").on(table.externalId),
    isPrimaryIdx: index("idx_book_sources_is_primary").on(table.isPrimary),
    // One entry per book-provider pair
    bookProviderUnique: uniqueIndex("book_sources_book_provider_unique").on(
      table.bookId,
      table.providerId
    ),
  })
);

export type BookSource = typeof bookSources.$inferSelect;
export type NewBookSource = typeof bookSources.$inferInsert;
