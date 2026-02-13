# Data Model: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05  
**Revised**: 2026-02-13 (Source vs. Metadata Provider Separation)  
**Revised**: 2026-02-13 (Cover Image Storage — Local Filesystem)  
**Revised**: 2026-02-13 (Many-to-Many Book Sources Architecture)

This document defines the complete data model for multi-source book tracking, including schema changes, new entities, and relationships.

### Architectural Revision #1 (2026-02-13): Source vs. Metadata Provider

The original model treated Hardcover and OpenLibrary as "sources" stored on book records. After analysis, this conflated two distinct concepts:

- **Sources** (`BookSource`): Where the book record is owned/managed — `"calibre" | "manual"`. Stored on the book record.
- **Metadata Providers** (`ProviderId`): Search tools used to populate metadata — `"hardcover" | "openlibrary"`. Ephemeral; no trace on the book record.

Key changes from original spec:
1. `source` enum narrowed to `["calibre", "manual"]` (was 4 values)
2. `externalId` column removed entirely (was nullable TEXT)
3. `idx_books_source_external` unique index removed
4. Source migration concept eliminated
5. Books added via federated search always get `source='manual'`

### Architectural Revision #2 (2026-02-13): Many-to-Many Book Sources

To support future multi-source integrations (e.g., Audiobookshelf where audiobooks supplement Calibre ebooks), the single-source model has been refactored to many-to-many:

**Previous Model**:
```typescript
books {
  source: 'calibre' | 'manual'  // Single source per book
}
```

**New Model**:
```typescript
books {
  // source field REMOVED - no longer single-source
}

book_sources {  // NEW many-to-many table
  book_id: FK → books.id
  provider_id: 'calibre' | 'audiobookshelf' | ...
  external_id: Provider's ID
  is_primary: boolean  // Which source is metadata authority
}
```

Key changes:
1. `books.source` field removed (many-to-many relationship)
2. `book_sources` table added (tracks which providers have records for each book)
3. Books with NO `book_sources` entries are implicitly "manual" or "unconnected"
4. Books can exist in multiple sources simultaneously (e.g., Calibre + Audiobookshelf)
5. "manual" provider removed from `provider_configs` (no longer needed)
6. `books.calibre_id` temporarily kept as deprecated field during transition

**Benefits**:
- Enables multi-source books (audiobook + ebook versions)
- Clean "manual" book model (absence of sources, not a source itself)
- Future "To Get" status (books without sources that user wants to acquire)
- Audiobookshelf integration without architectural changes

---

## Schema Changes to Existing Entities

### Books Table (MODIFIED)

**Purpose**: Support books from multiple sources beyond Calibre

**Removed Fields** (per 2026-02-13 many-to-many revision):
```typescript
{
  // source: REMOVED — replaced by book_sources many-to-many table
}
```

**Modified Fields**:
```typescript
{
  calibreId: number | null;  // DEPRECATED: Will be removed in future migration
                            // Use bookSourceRepository to query sources
}
```

**Complete Schema**:
```typescript
// lib/db/schema/books.ts
export const books = sqliteTable('books', {
  // Identity
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // DEPRECATED: Legacy Calibre ID (will be removed in future migration)
  // Use bookSourceRepository to query book sources instead
  calibreId: integer('calibre_id').unique(),
  
  // Metadata (existing fields)
  title: text('title').notNull(),
  authors: text('authors', { mode: 'json' }).$type<string[]>().notNull(),
  isbn: text('isbn'),
  totalPages: integer('total_pages'),
  publisher: text('publisher'),
  publicationDate: text('publication_date'),  // YYYY-MM-DD
  description: text('description'),
  // Cover images stored on local filesystem at ./data/covers/{bookId}.{ext}
  // See "Cover Storage" section below — no coverImageUrl column in schema
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
  // Legacy Calibre index (keep for backward compatibility during transition)
  calibreIdIdx: uniqueIndex('idx_books_calibre_id').on(table.calibreId).where(sql`calibre_id IS NOT NULL`),
}));
```

**Constraints**:
- ✅ Unique on `calibreId` where `calibreId IS NOT NULL` (legacy compatibility)
- ❌ No cross-source duplicate prevention at schema level (handled by application logic via ISBN/title+author matching)

---

### Book Sources Table (NEW)

**Purpose**: Many-to-many relationship tracking which providers have records for each book

**Schema**:
```typescript
// lib/db/schema/book-sources.ts
export const bookSources = sqliteTable('book_sources', {
  // Identity
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Relationships
  bookId: integer('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  
  // Source Provider
  providerId: text('provider_id').notNull(),  // 'calibre' | 'audiobookshelf' | ...
  externalId: text('external_id'),            // Provider's ID for this book
  
  // Metadata Authority
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  
  // Sync Metadata
  lastSynced: integer('last_synced', { mode: 'timestamp' }),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).notNull().default(true),
  
  // Provider-Specific Data
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  bookIdIdx: index('idx_book_sources_book_id').on(table.bookId),
  providerIdIdx: index('idx_book_sources_provider_id').on(table.providerId),
  externalIdIdx: index('idx_book_sources_external_id').on(table.externalId),
  isPrimaryIdx: index('idx_book_sources_is_primary').on(table.isPrimary),
  bookProviderUnique: uniqueIndex('book_sources_book_provider_unique').on(table.bookId, table.providerId),
}));

export type BookSource = typeof bookSources.$inferSelect;
export type NewBookSource = typeof bookSources.$inferInsert;
```

**Constraints**:
- ✅ Foreign key to `books.id` with CASCADE DELETE
- ✅ Unique constraint on `(book_id, provider_id)` - one entry per book-provider pair
- ✅ Indexes on `book_id`, `provider_id`, `external_id`, `is_primary` for query performance

**Key Behaviors**:
- **Books with NO entries**: Implicit "manual" or "unconnected" books (no provider badge shown)
- **Books with ONE entry**: Single-source books (e.g., only Calibre) - one badge shown
- **Books with MULTIPLE entries**: Multi-source books (e.g., Calibre + Audiobookshelf) - multiple badges shown
- **Primary source**: `is_primary = true` determines which source is metadata authority (for conflict resolution)

**Migration Notes**:
1. **Schema Migration** (`drizzle/0022_regenerated.sql`):
   - Create `book_sources` table
   - Remove `books.source` field
   - Keep `books.calibre_id` temporarily (mark deprecated)

2. **Data Migration** (`lib/migrations/0022_seed_provider_configs.ts`):
   - Populate `book_sources` from existing `books.source='calibre'` records
   - Set `is_primary=true` for all migrated entries
   - Books with `source='manual'` get NO `book_sources` entry (implicit manual)

3. **Future Migration** (Phase R2):
   - Remove `books.calibre_id` field after transition complete
   - Update all queries to use `bookSourceRepository`

---

## Removed Entities

### books.source Field (REMOVED)

**Rationale**: Single-source model inadequate for future multi-source integrations (e.g., Audiobookshelf). Many-to-many `book_sources` table provides:
- Books in multiple sources simultaneously
- Clean "manual" book model (absence of sources)
- Future "To Get" status capability
- Audiobookshelf integration without breaking changes

### "manual" Provider Config (REMOVED)

**Rationale**: "Manual" is not a provider — it's the absence of a provider. Books without `book_sources` entries are implicitly manual. This simplifies the model and removes the confusing "manual" provider from UI dropdowns.

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

### Cover Storage (Filesystem)

**Purpose**: Store and serve book cover images for all book sources using local filesystem storage

**Design Decision**: Cover images are stored on the local filesystem rather than as URLs in the database. This aligns with the constitution's self-contained deployment principle — covers work offline, don't depend on external CDN availability, and are consistent with how Calibre stores covers.

**Storage Location**: `./data/covers/{bookId}.{ext}` (sibling to `./data/tome.db`)

**Cover Sources**:

| Book Source | Cover Origin | Storage Mechanism |
|-------------|-------------|-------------------|
| Calibre | `{libraryPath}/{bookPath}/cover.jpg` | Served directly from Calibre library (existing behavior, unchanged) |
| Manual (provider search) | Downloaded from provider URL at creation time | Saved to `./data/covers/{bookId}.{ext}` |
| Manual (file upload) | User uploads image via multipart form | Saved to `./data/covers/{bookId}.{ext}` |
| Manual (no cover) | N/A | Fallback to `public/cover-fallback.png` |

**File Naming Convention**:
```
./data/covers/
├── 42.jpg       # Manual book ID 42, downloaded from Hardcover
├── 57.png       # Manual book ID 57, uploaded by user
└── 103.webp     # Manual book ID 103, downloaded from OpenLibrary
```

- Filename: `{tomeBookId}.{originalExtension}`
- One cover per book (uploading/downloading a new cover replaces the old one)
- Supported formats: JPEG, PNG, WebP, GIF

**Cover Resolution Flow** (`GET /api/books/{id}/cover`):
```
1. Look up book by Tome book ID
2. If source='manual':
   a. Check ./data/covers/{id}.* for local cover file
   b. If found → serve file with appropriate Content-Type
   c. If not found → serve cover-fallback.png
3. If source='calibre':
   a. Look up calibreId → Calibre book path
   b. Serve {libraryPath}/{bookPath}/cover.jpg (existing behavior)
   c. If not found → serve cover-fallback.png
```

**Cover Ingestion Flows**:

*Provider Search (Hardcover/OpenLibrary)*:
```
FederatedSearchModal selects result with coverImageUrl
  → POST /api/books (create manual book)
  → book.service.ts createManualBook() receives coverImageUrl in payload
  → After successful book creation, download cover image from URL
  → saveCover(bookId, imageBuffer, ext)
  → If download fails: book still created, no cover (graceful fallback)
```

*Manual File Upload*:
```
ManualBookForm includes file upload input
  → After book creation, POST /api/books/{id}/cover (multipart form data)
  → Validate file type and size
  → saveCover(bookId, imageBuffer, ext)
```

**Cover Utility** (`lib/utils/cover-storage.ts`):
```typescript
// Core operations
saveCover(bookId: number, buffer: Buffer, ext: string): Promise<string>  // Returns file path
getCoverPath(bookId: number): string | null  // Returns path or null if no cover
hasCover(bookId: number): boolean
deleteCover(bookId: number): void

// Directory management
ensureCoverDirectory(): void  // Create ./data/covers/ if it doesn't exist
```

**Constraints**:
- Maximum file size: 5MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Cover download timeout: 10 seconds (matches metadata fetch timeout from FR-018)
- Download failures are non-blocking — book creation succeeds regardless

**Cover URL Utility Change** (`lib/utils/cover-url.ts`):

The existing `getCoverUrl(calibreId, lastSynced)` must be replaced with a unified function that works for all books:
```typescript
// NEW: Works for all books (Calibre and manual)
getCoverUrl(bookId: number, updatedAt?: Date | string | null): string
// Returns: /api/books/{bookId}/cover?t={timestamp}
```

All frontend components (BookCard, BookHeader, BookTable, BookListItem, CurrentlyReadingList, DraggableBookTable, FannedBookCovers, journal page, series page, tag panels, shelf modals) must be updated to pass `book.id` instead of `book.calibreId`.

---

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
  // Cover image: handled separately via file upload or provider download
  // Stored on filesystem at ./data/covers/{bookId}.{ext}, NOT in the database
}
```

Note: Books added via Hardcover or OpenLibrary search use the same `source='manual'`
schema — the provider is used only to pre-populate metadata fields. Cover images from
provider search results are downloaded to local storage at book creation time.

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
