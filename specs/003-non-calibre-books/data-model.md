# Data Model: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05  
**Revised**: 2026-02-13 (Source vs. Metadata Provider Separation)

This document defines the complete data model for multi-source book tracking, including schema changes, new entities, and relationships.

### Architectural Revision (2026-02-13)

The original model treated Hardcover and OpenLibrary as "sources" stored on book records. After analysis, this conflated two distinct concepts:

- **Sources** (`BookSource`): Where the book record is owned/managed — `"calibre" | "manual"`. Stored on the book record.
- **Metadata Providers** (`ProviderId`): Search tools used to populate metadata — `"hardcover" | "openlibrary"`. Ephemeral; no trace on the book record.

Key changes from original spec:
1. `source` enum narrowed to `["calibre", "manual"]` (was 4 values)
2. `externalId` column removed entirely (was nullable TEXT)
3. `idx_books_source_external` unique index removed
4. Source migration concept eliminated
5. Books added via federated search always get `source='manual'`

---

## Schema Changes to Existing Entities

### Books Table (MODIFIED)

**Purpose**: Support books from multiple sources beyond Calibre

**New Fields**:
```typescript
{
  source: string;          // NEW: 'calibre' | 'manual'
}
```

**Removed Fields** (per 2026-02-13 revision):
```typescript
{
  // externalId: REMOVED — metadata providers are ephemeral, no tracking on book records
}
```

**Modified Fields**:
```typescript
{
  calibreId: number | null;  // CHANGED: Now nullable (was NOT NULL)
}
```

**Complete Schema**:
```typescript
// lib/db/schema/books.ts
export const books = sqliteTable('books', {
  // Identity
  id: integer('id').primaryKey({ autoIncrement: true }),
  calibreId: integer('calibre_id'),  // NULLABLE (legacy field for Calibre books)
  source: text('source', { enum: ['calibre', 'manual'] })
    .notNull()
    .default('calibre'),
  
  // Metadata (existing fields)
  title: text('title').notNull(),
  authors: text('authors', { mode: 'json' }).$type<string[]>().notNull(),
  isbn: text('isbn'),
  totalPages: integer('total_pages'),
  publisher: text('publisher'),
  publicationDate: text('publication_date'),  // YYYY-MM-DD
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  path: text('path'),  // Calibre-specific, null for non-Calibre books
  rating: integer('rating'),  // 1-5 stars
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  
  // Sync metadata
  orphaned: integer('orphaned', { mode: 'boolean' }).default(false),
  lastSynced: integer('last_synced', { mode: 'timestamp' }),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Legacy Calibre index (keep for backward compatibility)
  calibreIdIdx: uniqueIndex('idx_books_calibre_id').on(table.calibreId).where(sql`calibre_id IS NOT NULL`),
  
  // Source-based filtering
  sourceIdx: index('idx_books_source').on(table.source),
}));
```

**Constraints**:
- ✅ Unique on `calibreId` where `calibreId IS NOT NULL` (legacy compatibility)
- ❌ No cross-source duplicate prevention at schema level (handled by application logic via ISBN/title+author matching)

**Migration Notes**:
1. **Schema Migration** (`drizzle/00XX_multi_source_support.sql`):
   - Add `source` column (default 'calibre')
   - Make `calibreId` nullable
   - Add source index

2. **Companion Migration** (`lib/migrations/00XX_populate_source_field.ts`):
   - Set `source='calibre'` for all existing books
   - Validate all existing books have `calibreId` populated

---

## New Entities

### Provider Configurations Table (NEW)

**Purpose**: Store runtime configuration for metadata providers

**Schema**:
```typescript
// lib/db/schema/provider-configs.ts
export const providerConfigs = sqliteTable('provider_configs', {
  // Identity
  id: integer('id').primaryKey({ autoIncrement: true }),
  providerId: text('provider_id').notNull().unique(),  // 'hardcover', 'openlibrary'
  
  // Configuration
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  config: text('config', { mode: 'json' }).$type<ProviderConfig>(),
  credentials: text('credentials', { mode: 'json' }).$type<ProviderCredentials>(),
  
  // Health monitoring
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  healthStatus: text('health_status', { enum: ['healthy', 'unavailable'] })
    .notNull()
    .default('healthy'),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  providerIdIdx: uniqueIndex('idx_provider_configs_provider_id').on(table.providerId),
}));

// Type definitions
export type ProviderConfig = {
  timeout?: number;           // Request timeout in milliseconds
  apiEndpoint?: string;       // Override default API endpoint
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};

export type ProviderCredentials = {
  apiKey?: string;            // Plaintext (acceptable for local deployments)
  username?: string;
  password?: string;
};
```

**Seeding**:
```typescript
// Default configurations inserted during migration
const defaultConfigs = [
  {
    providerId: 'hardcover',
    enabled: false,  // Requires API key
    config: { timeout: 5000 },
    credentials: null,
  },
  {
    providerId: 'openlibrary',
    enabled: true,   // Public API, no auth
    config: { timeout: 5000 },
    credentials: null,
  },
];
```

**Validation Rules**:
- `providerId` must match existing provider implementations
- `enabled=true` with `requiresAuth=true` requires non-null `credentials.apiKey`
- `config.timeout` must be between 1000-30000ms

---

## Entity Relationships

### Books ↔ Sources

```
Book
├── source: 'calibre' → synced from Calibre DB (read-only except ratings)
└── source: 'manual'  → user-created (via manual entry OR federated search)

Source Identification:
├── calibre: calibreId NOT NULL
└── manual:  calibreId NULL

Note: Books added via Hardcover/OpenLibrary search are source='manual' with
pre-populated metadata. The provider is ephemeral — no trace on the book record.
```

### Books ↔ Reading Sessions (Existing, No Changes)

```
Book (1) ──── (many) ReadingSession
  ↓
Foreign Key: readingSessions.bookId → books.id (CASCADE DELETE)
```

**Multi-Source Behavior**:
- Sessions work identically for books from any source
- No schema changes required
- Source badge displayed in UI alongside session metadata

### Books ↔ Progress Logs (Existing, No Changes)

```
Book (1) ──── (many) ProgressLog
  ↓
Foreign Key: progressLogs.bookId → books.id (CASCADE DELETE)
```

**Multi-Source Behavior**:
- Progress tracking identical across all sources
- Streaks aggregate progress from ALL sources
- No schema changes required

---

## Data Access Patterns

### Repository Extensions

#### BookRepository (EXTENDED)

**New Methods**:
```typescript
class BookRepository extends BaseRepository<Book> {
  // Existing methods...
  
  // NEW: Source-specific queries
  async findBySource(source: BookSource): Promise<Book[]>;
  async countBySource(source: BookSource): Promise<number>;
  
  // EXTENDED: Add source filter parameter
  async findWithFilters(
    filters: {
      status?: string;
      search?: string;
      tags?: string[];
      rating?: string;
      showOrphaned?: boolean;
      source?: BookSource | BookSource[];  // NEW: Filter by source(s)
    },
    limit: number,
    skip: number,
    sortBy?: string
  ): Promise<{ books: Book[]; total: number }>;
  
  // EXTENDED: Restrict to Calibre books only
  async findNotInCalibreIds(
    calibreIds: number[],
    filters?: { source: BookSource }  // NEW: Default 'calibre'
  ): Promise<Book[]>;
}
```

**Removed Methods** (per 2026-02-13 revision):
- `findBySourceAndExternalId()` — removed with `externalId` column

#### ProviderConfigRepository (NEW)

**Methods**:
```typescript
class ProviderConfigRepository extends BaseRepository<ProviderConfig> {
  async findByProviderId(providerId: string): Promise<ProviderConfig | null>;
  async findEnabled(): Promise<ProviderConfig[]>;
  async updateHealth(providerId: string, status: ProviderHealth): Promise<void>;
  async toggleEnabled(providerId: string, enabled: boolean): Promise<void>;
}
```

---

## Validation Rules

### Book Creation

**Calibre Books** (via sync):
```typescript
{
  source: 'calibre',           // Required
  calibreId: number,           // Required
  title: string,               // Required
  authors: string[],           // Required (at least 1)
  totalPages: number | null,   // Optional
}
```

**Manual Books** (via manual entry or federated search):
```typescript
{
  source: 'manual',            // Required (always 'manual', even when added via provider search)
  calibreId: null,             // Must be null
  title: string,               // Required
  authors: string[],           // Required (at least 1)
  totalPages: number,          // Required (for progress tracking)
  isbn: string | null,         // Optional
  publisher: string | null,    // Optional
  publicationDate: string | null,  // Optional (YYYY-MM-DD)
  description: string | null,  // Optional
  coverImageUrl: string | null,    // Optional (validated URL)
}
```

Note: Books added via Hardcover or OpenLibrary search use the same `source='manual'`
schema — the provider is used only to pre-populate metadata fields.

### Provider Configuration

```typescript
{
  providerId: string,          // Must match existing provider
  enabled: boolean,            // Required
  config: {
    timeout: number,           // 1000-30000ms
    apiEndpoint?: string,      // Valid URL if provided
  },
  credentials: {
    apiKey?: string,           // Required if provider.requiresAuth=true
  }
}
```

---

## State Transitions

### Book Source

**Source is immutable after creation**:
```
calibre → calibre  (synced via Calibre, never changes)
manual  → manual   (user-created, never changes)
```

Source migration (manual → hardcover/openlibrary) has been eliminated from this spec.
Books added via federated search are always `source='manual'` — the metadata provider
is ephemeral and does not affect the book's source.

---

## Index Strategy

### Performance Targets

| Query Pattern | Index | Expected Performance |
|--------------|-------|---------------------|
| Filter by source | `idx_books_source` | <50ms for 10k books |
| Find Calibre book by calibreId | `idx_books_calibre_id` | <10ms (unique lookup) |
| Library with source filter | Composite filter + sort | <3s for 10k books |

### Index Definitions

```sql
-- Source filtering (non-unique, many books per source)
CREATE INDEX idx_books_source ON books(source);

-- Legacy Calibre lookups (unique, backward compatibility)
CREATE UNIQUE INDEX idx_books_calibre_id
  ON books(calibre_id)
  WHERE calibre_id IS NOT NULL;
```

---

## Data Integrity Rules

### Constraint Enforcement

1. **Duplicate Detection** (application-level):
   - Uses ISBN matching + fuzzy title/author matching (existing duplicate detection service)
   - No schema-level cross-source duplicate prevention
   - Warns user but allows proceeding

2. **Source-Specific Field Requirements**:
   ```typescript
   if (source === 'calibre') {
     assert(calibreId !== null, 'Calibre books require calibreId');
   }
   
   if (source === 'manual') {
     assert(calibreId === null, 'Manual books must not have calibreId');
   }
   ```

3. **Sync Isolation**:
   - Calibre sync queries always include `WHERE source = 'calibre'`
   - Prevents accidental modification of non-Calibre books

---

## Migration Strategy

### Phase 1: Schema Changes (Drizzle Migration)

```sql
-- drizzle/00XX_multi_source_support.sql

-- 1. Add source column (default 'calibre' for existing books)
ALTER TABLE books ADD COLUMN source TEXT NOT NULL DEFAULT 'calibre';

-- 2. Make calibre_id nullable (requires table copy in SQLite)
-- (Drizzle generates appropriate ALTER TABLE or table recreation)

-- 3. Create new index
CREATE INDEX idx_books_source ON books(source);

-- 4. Seed provider_configs table
INSERT INTO provider_configs (provider_id, enabled, config, health_status)
VALUES 
  ('hardcover', 0, '{"timeout": 5000}', 'healthy'),
  ('openlibrary', 1, '{"timeout": 5000}', 'healthy');
```

### Phase 2: Data Migration (Companion Migration)

```typescript
// lib/migrations/00XX_populate_source_field.ts

const migration: CompanionMigration = {
  name: "00XX_populate_source_field",
  requiredTables: ["books"],
  description: "Set source='calibre' for all existing books",
  
  async execute(db) {
    // 1. Verify all existing books have calibreId
    const booksWithoutCalibreId = db.prepare(
      "SELECT id FROM books WHERE calibre_id IS NULL"
    ).all();
    
    if (booksWithoutCalibreId.length > 0) {
      throw new Error(`Found ${booksWithoutCalibreId.length} books without calibreId before migration`);
    }
    
    // 2. Set source='calibre' for all books (already done by DEFAULT)
    const result = db.prepare(
      "UPDATE books SET source = 'calibre' WHERE source IS NULL"
    ).run();
    
    logger.info({ updatedCount: result.changes }, "Migration complete");
  }
};
```

### Phase 3: Rollback Plan

**Rollback SQL**:
```sql
-- Remove new column (data loss for manual books!)
ALTER TABLE books DROP COLUMN source;

-- Restore calibre_id NOT NULL constraint
-- (Requires table copy in SQLite)

-- Drop new table
DROP TABLE provider_configs;
```

**Note**: Rollback causes data loss for manual books. Only use for failed migrations on empty databases.

---

## Summary

### Schema Impact
- 1 table modified (`books`: added `source`, made `calibreId` nullable)
- 1 table added (`provider_configs`)
- 2 indexes added (`idx_books_source`, `idx_books_calibre_id` partial)
- 0 tables dropped
- Backward compatible (existing Calibre books work unchanged)

### Repository Impact
- 1 repository extended (`bookRepository`: source filtering, removed `findBySourceAndExternalId`)
- 1 repository added (`providerConfigRepository`)
- Existing repositories unchanged

### Migration Risk
- **Medium**: Requires table copy for nullable calibreId (SQLite limitation)
- **Mitigated**: Companion migration validates data integrity
- **Tested**: Fresh database + existing database scenarios
