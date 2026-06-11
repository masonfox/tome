import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { books } from './books';

/**
 * KoReader Document Mappings
 * Maps KoReader document hashes to Tome books for automatic progress log creation.
 */
export const koreaderDocumentMappings = sqliteTable('koreader_document_mappings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentHash: text('document_hash').notNull().unique(),
  bookId: integer('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  mappingSource: text('mapping_source', { 
    enum: ['auto_path', 'manual'] 
  }).notNull(),
  deviceName: text('device_name'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  bookIdIdx: index('koreader_mapping_book_id_idx').on(table.bookId),
}));

/**
 * Application Settings (Key-Value Store)
 * Stores application-wide settings including KoReader proxy configuration.
 */
export const applicationSettings = sqliteTable('application_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * KoReader Sync Events (Optional Audit Log)
 * Tracks all sync events for debugging and statistics.
 * Note: Can be omitted from MVP if audit log not needed.
 */
export const koreaderSyncEvents = sqliteTable('koreader_sync_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentHash: text('document_hash').notNull(),
  username: text('username'),
  percentage: real('percentage'),
  device: text('device'),
  upstreamStatus: integer('upstream_status'),
  tomeProcessed: integer('tome_processed', { mode: 'boolean' }).default(false),
  error: text('error'),
  syncedAt: integer('synced_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  documentHashIdx: index('koreader_events_document_hash_idx').on(table.documentHash),
  syncedAtIdx: index('koreader_events_synced_at_idx').on(table.syncedAt),
}));

// Type exports
export type KoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferSelect;
export type NewKoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferInsert;
export type ApplicationSetting = typeof applicationSettings.$inferSelect;
export type NewApplicationSetting = typeof applicationSettings.$inferInsert;
export type KoReaderSyncEvent = typeof koreaderSyncEvents.$inferSelect;
export type NewKoReaderSyncEvent = typeof koreaderSyncEvents.$inferInsert;
