# Data Model: KoReader Sync Proxy

**Feature**: 003-koreader-sync (Proxy Approach) 
**Phase**: Phase 1 - Design  
**Date**: 2026-06-10

---

## Overview

This document defines the database schema for the KoReader sync proxy. Since we're proxying to an existing sync server (not building a full server), we only need to store **document mappings** and **settings**. No user management or sync data storage required.

**Simplified Architecture**: Store only what's needed for progress log integration.

---

## Entity-Relationship Diagram

```
┌──────────────────────────────────────┐
│ koreader_document_mappings           │
├──────────────────────────────────────┤
│ id (PK)                              │
│ document_hash (UNIQUE)               │
│ book_id (FK) ─────────────────────┐ │
│ mapping_source                     │ │
│ device_name                        │ │
│ last_synced_at                     │ │
│ created_at                         │ │
│ updated_at                         │ │
└────────────────────────────────────┼─┘
                                     │
                                     ▼
                           ┌─────────────────┐
                           │ books           │
                           ├─────────────────┤
                           │ id (PK)         │
                           │ calibre_id      │
                           │ title           │
                           │ path            │
                           │ ...             │
                           └─────────────────┘

┌──────────────────────────────────────┐
│ koreader_sync_events (optional)      │
├──────────────────────────────────────┤
│ id (PK)                              │
│ document_hash                        │
│ username                             │
│ percentage                           │
│ device                               │
│ upstream_status                      │
│ tome_processed                       │
│ error                                │
│ synced_at                            │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ application_settings                 │
├──────────────────────────────────────┤
│ key (PK)                             │
│ value                                │
│ updated_at                           │
└──────────────────────────────────────┘

Settings keys:
• "koreader_proxy_enabled" → "true" | "false"
• "koreader_upstream_url" → "https://sync.koreader.rocks"
• "koreader_auto_progress_log" → "true" | "false"
• "koreader_proxy_port" → "7200"
```

---

## Table Definitions

### 1. `koreader_document_mappings` (Core Table)

**Purpose**: Map KoReader document hashes to Tome books for progress log integration.

**Schema**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique mapping ID |
| `document_hash` | TEXT | NOT NULL, UNIQUE | MD5 hash of document (32 chars) |
| `book_id` | INTEGER | NOT NULL, FOREIGN KEY → books(id) | Tome book ID |
| `mapping_source` | TEXT | NOT NULL | How mapping was created: "auto_path", "manual" |
| `device_name` | TEXT | | Last known device name (for display) |
| `last_synced_at` | DATETIME | | Last time this document synced |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Mapping creation time |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update time |

**Constraints**:
- UNIQUE constraint on `document_hash` - One mapping per document (global, not per-user)
- FOREIGN KEY `book_id` REFERENCES `books(id)` ON DELETE CASCADE
- CHECK: `mapping_source` IN ('auto_path', 'manual')

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE INDEX on `document_hash`
- INDEX on `book_id` (for reverse lookups)

**Validation Rules**:
- `document_hash`: Exactly 32 characters (MD5 hex), lowercase
- `mapping_source`: Enum: "auto_path" | "manual"

**Drizzle Schema**:
```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { books } from './books'; // Existing schema

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

export type KoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferSelect;
export type NewKoReaderDocumentMapping = typeof koreaderDocumentMappings.$inferInsert;
```

**Usage**:
- When proxy intercepts progress update:
  1. Check if `document_hash` exists in mappings
  2. If yes: Get `book_id`, create progress log
  3. If no: Queue for manual mapping (show in UI)
- When user creates manual mapping:
  1. Insert new row with `mapping_source = 'manual'`
  2. Future syncs for this document automatically create progress logs

---

### 2. `koreader_sync_events` (Optional Audit Log)

**Purpose**: Track all sync events for debugging and statistics (optional, can be omitted from MVP).

**Schema**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique event ID |
| `document_hash` | TEXT | NOT NULL | MD5 hash of synced document |
| `username` | TEXT | | Username from x-auth-user header |
| `percentage` | REAL | | Progress percentage (0.0 to 1.0) |
| `device` | TEXT | | Device name from sync request |
| `upstream_status` | INTEGER | | HTTP status from upstream server |
| `tome_processed` | BOOLEAN | DEFAULT FALSE | Did Tome create progress log? |
| `error` | TEXT | | Error message if processing failed |
| `synced_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Event timestamp |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `document_hash` (for querying by document)
- INDEX on `synced_at` (for recent events)

**Drizzle Schema**:
```typescript
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

export type KoReaderSyncEvent = typeof koreaderSyncEvents.$inferSelect;
```

**Usage**:
- Log every sync request (success or failure)
- Display in Management UI for debugging
- Calculate statistics (documents synced, success rate)

**Note**: Can be omitted from MVP if audit log not needed. Progress logs already track reading activity.

---

### 3. `application_settings` (Settings Storage)

**Purpose**: Store application-wide settings as key-value pairs.

**Schema**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | Setting key (e.g., "koreader_proxy_enabled") |
| `value` | TEXT | NOT NULL | Setting value (JSON-encoded for complex values) |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes**:
- PRIMARY KEY on `key`

**KoReader Proxy Settings Keys**:

| Key | Value | Default | Description |
|-----|-------|---------|-------------|
| `koreader_proxy_enabled` | `"true"` \| `"false"` | `"false"` | Enable/disable proxy server |
| `koreader_upstream_url` | URL string | `"https://sync.koreader.rocks"` | Upstream sync server |
| `koreader_auto_progress_log` | `"true"` \| `"false"` | `"true"` | Auto-create progress logs |
| `koreader_proxy_port` | Number string | `"7200"` | Proxy listen port |

**Drizzle Schema**:
```typescript
export const applicationSettings = sqliteTable('application_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type ApplicationSetting = typeof applicationSettings.$inferSelect;
```

**Usage Example**:
```typescript
// Get setting
const enabled = await settingsRepository.get('koreader_proxy_enabled');
const isEnabled = enabled === 'true';

// Update setting
await settingsRepository.set('koreader_proxy_enabled', 'true');

// Get upstream URL
const upstreamUrl = await settingsRepository.get('koreader_upstream_url') || 'https://sync.koreader.rocks';
```

---

## Simplified Architecture (vs. Full Server)

### What We Removed:

**No Longer Needed**:
- ❌ `koreader_users` table (upstream handles auth)
- ❌ `koreader_sync_records` table (upstream stores progress)
- ❌ User authentication logic (passthrough to upstream)
- ❌ Password hashing/validation
- ❌ Per-user data isolation (mappings are global)

**Why Removed**:
- Proxy forwards auth headers to upstream (we never validate)
- Upstream server stores actual sync data
- Mappings are document-to-book (independent of user)

### What We Kept:

**Still Needed**:
- ✅ `koreader_document_mappings` - Core functionality (progress logs)
- ✅ `application_settings` - Proxy configuration
- ⚠️ `koreader_sync_events` - Optional audit log

**Data Reduction**: 3 tables → 2 tables (or 3 with audit log)

---

## State Transitions

### Mapping Lifecycle

```
[KoReader Device Syncs Unknown Document]
      │
      │ PUT /syncs/progress (document hash: "a1b2c3...")
      ▼
[Proxy Intercepts]
      │
      │ Check: document_hash in mappings?
      ├─ YES → Get book_id, create progress log ✅
      │        Update last_synced_at
      │
      └─ NO  → Queue for manual mapping ⚠️
               Store in unmapped_documents list (UI)
               
[User Views Unmapped Documents in UI]
      │
      │ User selects document + book
      ▼
[CREATE mapping]
      │ mapping_source = "manual"
      │ book_id = selected book
      │
      ▼
[Future Syncs] → Auto-create progress logs ✅
```

**Key Points**:
- Mappings are permanent (don't expire)
- One mapping per document hash (global)
- Users can edit/delete mappings if incorrect

---

## Validation Rules Summary

### At Database Level (Constraints)
- `koreader_document_mappings.document_hash`: UNIQUE, NOT NULL
- `koreader_document_mappings.book_id`: FOREIGN KEY (CASCADE DELETE)
- `koreader_document_mappings.mapping_source`: CHECK IN ('auto_path', 'manual')

### At Application Level (Zod Schemas)
```typescript
// Document mapping creation
const mappingSchema = z.object({
  documentHash: z.string()
    .length(32, 'Document hash must be 32 characters')
    .regex(/^[a-f0-9]{32}$/, 'Document hash must be MD5 hex string'),
  bookId: z.number().int().positive(),
  mappingSource: z.enum(['auto_path', 'manual']),
  deviceName: z.string().optional(),
});

// Settings update
const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

// Upstream URL validation
const upstreamUrlSchema = z.string()
  .url('Must be valid URL')
  .refine(url => url.startsWith('http://') || url.startsWith('https://'), 
    'Must be HTTP or HTTPS URL');
```

---

## Migration Strategy

### Migration File: `drizzle/XXXX_koreader_proxy_tables.sql`

```sql
-- Create koreader_document_mappings table
CREATE TABLE IF NOT EXISTS koreader_document_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_hash TEXT NOT NULL UNIQUE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  mapping_source TEXT NOT NULL CHECK(mapping_source IN ('auto_path', 'manual')),
  device_name TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX koreader_mapping_book_id_idx ON koreader_document_mappings(book_id);

-- Create koreader_sync_events table (OPTIONAL - can be omitted)
CREATE TABLE IF NOT EXISTS koreader_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_hash TEXT NOT NULL,
  username TEXT,
  percentage REAL,
  device TEXT,
  upstream_status INTEGER,
  tome_processed INTEGER DEFAULT 0,
  error TEXT,
  synced_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX koreader_events_document_hash_idx ON koreader_sync_events(document_hash);
CREATE INDEX koreader_events_synced_at_idx ON koreader_sync_events(synced_at);

-- Create application_settings table (if doesn't exist)
CREATE TABLE IF NOT EXISTS application_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert default settings
INSERT OR IGNORE INTO application_settings (key, value) VALUES 
  ('koreader_proxy_enabled', 'false'),
  ('koreader_upstream_url', 'https://sync.koreader.rocks'),
  ('koreader_auto_progress_log', 'true'),
  ('koreader_proxy_port', '7200');
```

---

## Repository Method Requirements

### `koreaderMappingRepository`

```typescript
interface KoReaderMappingRepository {
  // Core mapping operations
  findByDocumentHash(documentHash: string): Promise<KoReaderDocumentMapping | null>;
  create(data: NewKoReaderDocumentMapping): Promise<KoReaderDocumentMapping>;
  update(id: number, data: Partial<KoReaderDocumentMapping>): Promise<KoReaderDocumentMapping>;
  delete(id: number): Promise<void>;
  
  // Management UI
  findAll(filters?: { mapped?: boolean }): Promise<KoReaderDocumentMapping[]>;
  findByBookId(bookId: number): Promise<KoReaderDocumentMapping[]>;
  
  // Sync operations
  updateLastSynced(documentHash: string, syncedAt: Date): Promise<void>;
  
  // Auto-mapping
  findUnmappedDocuments(): Promise<string[]>; // Returns document hashes
  
  // Statistics
  count(): Promise<number>;
  countBySource(source: 'auto_path' | 'manual'): Promise<number>;
}
```

### `koreaderSyncEventRepository` (Optional)

```typescript
interface KoReaderSyncEventRepository {
  // Audit logging
  create(event: NewKoReaderSyncEvent): Promise<KoReaderSyncEvent>;
  
  // Management UI
  findRecent(limit?: number): Promise<KoReaderSyncEvent[]>;
  findByDocumentHash(documentHash: string): Promise<KoReaderSyncEvent[]>;
  
  // Statistics
  countSuccess(): Promise<number>;
  countErrors(): Promise<number>;
}
```

### `settingsRepository` (Reusable)

```typescript
interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<ApplicationSetting[]>;
  delete(key: string): Promise<void>;
}
```

---

## Data Integrity Rules

1. **Cascade Deletes**:
   - Deleting a `books` row deletes associated `koreader_document_mappings`
   - Sync events are independent (not cascade deleted)

2. **Unique Constraints**:
   - One mapping per document hash (global uniqueness)

3. **Validation Constraints**:
   - Document hashes must be 32-character MD5 hex strings
   - Mapping source must be 'auto_path' or 'manual'

4. **Temporal Consistency**:
   - `last_synced_at` updated on every sync event
   - `updated_at` automatically updated on mapping changes

---

## Security Considerations

1. **No Credential Storage**:
   - Proxy never stores KoReader passwords (passed through)
   - Username logged for audit (x-auth-user header)

2. **Mapping Privacy**:
   - Document hashes are one-way (can't reverse to filename)
   - Book mappings are local-only (not synced upstream)

3. **Input Validation**:
   - Document hashes validated as MD5 format
   - Upstream URLs validated as HTTP/HTTPS
   - Book IDs verified to exist before mapping

---

## Performance Considerations

### Index Strategy
- **Primary Keys**: Auto-indexed
- **Document lookups**: Index on `document_hash` (frequent, during every sync)
- **Book reverse lookups**: Index on `book_id` (less frequent, management UI)

### Expected Query Patterns
1. **Mapping lookup** (high frequency): `SELECT * FROM koreader_document_mappings WHERE document_hash = ?`
2. **Update last synced** (high frequency): `UPDATE koreader_document_mappings SET last_synced_at = ? WHERE document_hash = ?`
3. **List all mappings** (low frequency): `SELECT * FROM koreader_document_mappings ORDER BY last_synced_at DESC`

### Scalability
- Expected dataset: <10,000 mapped documents per user
- Index ensures <5ms query times
- No expensive joins or aggregations in hot path

---

## Testing Data

### Seed Data for Development

```typescript
// __tests__/fixtures/koreader-seed-data.ts
export const testMappings = [
  {
    documentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    bookId: 1,
    mappingSource: 'auto_path',
    deviceName: 'Kindle Paperwhite',
    lastSyncedAt: new Date('2026-06-10T10:30:00Z'),
  },
  {
    documentHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    bookId: 2,
    mappingSource: 'manual',
    deviceName: 'Kobo Libra',
    lastSyncedAt: new Date('2026-06-09T15:45:00Z'),
  },
];

export const testSettings = {
  koreader_proxy_enabled: 'true',
  koreader_upstream_url: 'http://localhost:8080', // Mock upstream for tests
  koreader_auto_progress_log: 'true',
  koreader_proxy_port: '7200',
};
```

---

## Summary: Simplified vs. Full Server Schema

| Aspect | Full Server | Proxy Approach |
|--------|-------------|----------------|
| **Tables** | 4 (users, sync_records, mappings, settings) | 2-3 (mappings, settings, optional events) |
| **Rows (typical)** | 10k+ users, 100k+ sync records | 1k-10k mappings |
| **Foreign Keys** | 3 (user → sync, user → mapping, book → mapping) | 1 (book → mapping) |
| **Indexes** | 6+ | 3 |
| **Auth Logic** | Complex (MD5 validation) | None (passthrough) |
| **Data Volume** | ~10MB per 1000 users | ~100KB per 1000 mappings |

**Reduction**: ~70% less database complexity

---

## Next Steps

1. ✅ Research complete (Phase 0)
2. ✅ Data model defined (Phase 1, this document)
3. ⏭️ Define proxy API behavior (Phase 1, next)
4. ⏭️ Create developer quickstart (Phase 1, next)
5. ⏭️ Generate migration files (Implementation)
6. ⏭️ Implement repositories (Implementation)
