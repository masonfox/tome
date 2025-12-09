# Data Model: Import Books from TheStoryGraph & Goodreads

**Spec**: 003  
**Date**: 2025-12-01  
**Status**: Phase 1 - Design Complete

---

## Overview

This document defines the complete data model for the book import feature, including new tables, relationships, migrations, validation rules, and state transitions. The design follows Tome's existing patterns (Drizzle ORM, repository pattern, SQLite) and adheres to constitutional principles.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [New Tables](#new-tables)
3. [Existing Table Interactions](#existing-table-interactions)
4. [Entity Relationships](#entity-relationships)
5. [Drizzle Schema Definitions](#drizzle-schema-definitions)
6. [Database Migrations](#database-migrations)
7. [Validation Rules](#validation-rules)
8. [State Transitions](#state-transitions)
9. [Indexes & Performance](#indexes--performance)
10. [Repository Methods](#repository-methods)

---

## Schema Overview

### New Tables

The import feature introduces two new tables to track import operations and unmatched records:

| Table | Purpose | Records | Relationships |
|-------|---------|---------|---------------|
| **import_logs** | Audit trail for import operations | 1 per import | 1:many with unmatched_records |
| **import_unmatched_records** | Books that couldn't be matched | 0-N per import | Many:1 with import_logs |

### Modified Tables

No schema changes to existing tables. The import feature interacts with:

| Table | Usage | Modifications |
|-------|-------|---------------|
| **books** | Match target, rating updates | None (read-only metadata, write ratings) |
| **reading_sessions** | Session creation | None (creates new records) |
| **progress_logs** | Progress creation at 100% | None (creates new records) |

---

## New Tables

### 1. import_logs

**Purpose**: Store metadata about each import operation for audit, debugging, and import history.

**Lifecycle**: Created on upload, updated during processing, finalized on completion.

**Retention**: Permanent (never deleted, used for audit trail).

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| `fileName` | TEXT | NOT NULL | Original CSV filename |
| `fileSize` | INTEGER | NOT NULL, CHECK > 0 | File size in bytes |
| `provider` | TEXT | NOT NULL, CHECK IN ('goodreads', 'storygraph') | CSV source provider |
| `totalRecords` | INTEGER | NOT NULL, DEFAULT 0 | Total rows parsed from CSV |
| `matchedRecords` | INTEGER | NOT NULL, DEFAULT 0 | Records successfully matched to books |
| `unmatchedRecords` | INTEGER | NOT NULL, DEFAULT 0 | Records that couldn't be matched |
| `sessionsCreated` | INTEGER | NOT NULL, DEFAULT 0 | Reading sessions created |
| `sessionsSkipped` | INTEGER | NOT NULL, DEFAULT 0 | Sessions skipped (duplicates) |
| `ratingsSync` | INTEGER | NOT NULL, DEFAULT 0 | Ratings synced to Calibre |
| `calibreSyncFailures` | INTEGER | NOT NULL, DEFAULT 0 | Failed Calibre rating syncs |
| `startedAt` | INTEGER (TIMESTAMP) | NOT NULL | Import execution start time (epoch) |
| `completedAt` | INTEGER (TIMESTAMP) | NULL | Import execution end time (epoch) |
| `status` | TEXT | NOT NULL, CHECK IN ('pending', 'processing', 'success', 'partial', 'failed') | Import status |
| `errorMessage` | TEXT | NULL | Error details if status=failed |
| `userId` | INTEGER | NULL | User ID (future multi-user support) |
| `createdAt` | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updatedAt` | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record update time |

#### Validation Constraints

```sql
-- File size must be positive
CHECK (fileSize > 0 AND fileSize <= 10485760)

-- Provider must be valid
CHECK (provider IN ('goodreads', 'storygraph'))

-- Status must be valid
CHECK (status IN ('pending', 'processing', 'success', 'partial', 'failed'))

-- Record counts must be non-negative
CHECK (totalRecords >= 0)
CHECK (matchedRecords >= 0)
CHECK (unmatchedRecords >= 0)
CHECK (sessionsCreated >= 0)
CHECK (sessionsSkipped >= 0)
CHECK (ratingsSync >= 0)
CHECK (calibreSyncFailures >= 0)

-- Record counts must be consistent
CHECK (totalRecords = matchedRecords + unmatchedRecords)
CHECK (sessionsCreated <= matchedRecords)

-- Completed time must be after started time
CHECK (completedAt IS NULL OR completedAt >= startedAt)

-- Error message rules
CHECK (
  (status = 'failed' AND errorMessage IS NOT NULL) OR
  (status != 'failed' AND errorMessage IS NULL)
)
```

#### Indexes

```sql
-- Primary key index (auto-created)
CREATE INDEX idx_import_logs_id ON import_logs(id);

-- Query import history by user and date
CREATE INDEX idx_import_logs_user_created 
ON import_logs(userId, createdAt DESC);

-- Query failed imports for debugging
CREATE INDEX idx_import_logs_status_created 
ON import_logs(status, createdAt DESC);

-- Query imports by provider
CREATE INDEX idx_import_logs_provider 
ON import_logs(provider, createdAt DESC);
```

#### Example Records

```json
// Successful import
{
  "id": 1,
  "fileName": "goodreads_export_2024-12-01.csv",
  "fileSize": 524288,
  "provider": "goodreads",
  "totalRecords": 234,
  "matchedRecords": 220,
  "unmatchedRecords": 14,
  "sessionsCreated": 218,
  "sessionsSkipped": 2,
  "ratingsSync": 215,
  "calibreSyncFailures": 0,
  "startedAt": 1733097600,
  "completedAt": 1733097645,
  "status": "success",
  "errorMessage": null,
  "userId": null,
  "createdAt": 1733097600,
  "updatedAt": 1733097645
}

// Failed import
{
  "id": 2,
  "fileName": "invalid_format.csv",
  "fileSize": 1024,
  "provider": "goodreads",
  "totalRecords": 0,
  "matchedRecords": 0,
  "unmatchedRecords": 0,
  "sessionsCreated": 0,
  "sessionsSkipped": 0,
  "ratingsSync": 0,
  "calibreSyncFailures": 0,
  "startedAt": 1733097700,
  "completedAt": 1733097702,
  "status": "failed",
  "errorMessage": "Invalid CSV format: Missing required columns [Date Read, My Rating]",
  "userId": null,
  "createdAt": 1733097700,
  "updatedAt": 1733097702
}
```

---

### 2. import_unmatched_records

**Purpose**: Store books from CSV that couldn't be matched to Calibre library for later manual review or re-import.

**Lifecycle**: Created during matching phase, retained permanently for reference.

**Retention**: Permanent (can be manually deleted by user after resolving).

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| `importLogId` | INTEGER | NOT NULL, FOREIGN KEY → import_logs(id) CASCADE DELETE | Parent import operation |
| `title` | TEXT | NOT NULL | Book title from CSV |
| `authors` | TEXT (JSON) | NOT NULL | Authors as JSON array |
| `isbn` | TEXT | NULL | ISBN from CSV (cleaned) |
| `isbn13` | TEXT | NULL | ISBN-13 from CSV (cleaned) |
| `rating` | INTEGER | NULL, CHECK 0-5 | User rating from CSV |
| `completedDate` | INTEGER (TIMESTAMP) | NULL | Date read from CSV (epoch) |
| `status` | TEXT | NOT NULL | Read status from CSV (read, currently-reading, to-read) |
| `review` | TEXT | NULL | User review from CSV |
| `matchAttempted` | INTEGER (BOOLEAN) | NOT NULL, DEFAULT 1 | Whether matching was attempted (1=yes, 0=skipped) |
| `matchReason` | TEXT | NOT NULL | Why no match found (see reasons below) |
| `confidence` | INTEGER | NULL, CHECK 0-100 | Highest match score achieved (if any) |
| `createdAt` | INTEGER (TIMESTAMP) | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation time |

#### Match Reasons (matchReason values)

| Reason | Description | User Action |
|--------|-------------|-------------|
| `no_isbn` | No ISBN provided in CSV | Add book to Calibre with proper ISBN |
| `isbn_not_found` | ISBN provided but not in Calibre library | Add book to Calibre |
| `no_title_match` | Title/author match failed (<70% confidence) | Check for typos, add to Calibre |
| `ambiguous_match` | Multiple possible matches with similar scores | Manually select correct book |
| `not_in_library` | Book clearly identified but not in Calibre | Add book to Calibre, re-import |
| `invalid_data` | CSV row had invalid/corrupted data | Fix CSV, re-import |

#### Validation Constraints

```sql
-- Title must not be empty
CHECK (LENGTH(TRIM(title)) > 0)

-- Authors JSON must be valid array
CHECK (json_valid(authors) AND json_array_length(authors) > 0)

-- Rating must be 0-5 if provided
CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))

-- Status must be valid
CHECK (status IN ('read', 'currently-reading', 'to-read', 'did-not-finish', 'paused'))

-- Match reason must be valid
CHECK (matchReason IN ('no_isbn', 'isbn_not_found', 'no_title_match', 'ambiguous_match', 'not_in_library', 'invalid_data'))

-- Confidence must be 0-100 if provided
CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))

-- matchAttempted must be boolean
CHECK (matchAttempted IN (0, 1))
```

#### Indexes

```sql
-- Primary key index (auto-created)
CREATE INDEX idx_unmatched_id ON import_unmatched_records(id);

-- Query unmatched records by import
CREATE INDEX idx_unmatched_import_log 
ON import_unmatched_records(importLogId);

-- Query by match reason for analysis
CREATE INDEX idx_unmatched_reason 
ON import_unmatched_records(matchReason);

-- Query by title for manual searching
CREATE INDEX idx_unmatched_title 
ON import_unmatched_records(title);

-- Foreign key constraint (enforced by SQLite)
FOREIGN KEY (importLogId) REFERENCES import_logs(id) ON DELETE CASCADE
```

#### Example Records

```json
// No ISBN, couldn't match by title
{
  "id": 1,
  "importLogId": 1,
  "title": "Obscure Indie Book Title",
  "authors": ["Unknown Author"],
  "isbn": null,
  "isbn13": null,
  "rating": 4,
  "completedDate": 1698796800,
  "status": "read",
  "review": "Great book!",
  "matchAttempted": 1,
  "matchReason": "no_isbn",
  "confidence": 45,
  "createdAt": 1733097620
}

// ISBN provided but not in library
{
  "id": 2,
  "importLogId": 1,
  "title": "The Great Novel",
  "authors": ["Famous Author"],
  "isbn": "1234567890",
  "isbn13": "9781234567890",
  "rating": 5,
  "completedDate": 1701388800,
  "status": "read",
  "review": null,
  "matchAttempted": 1,
  "matchReason": "isbn_not_found",
  "confidence": null,
  "createdAt": 1733097625
}

// Ambiguous match (multiple candidates)
{
  "id": 3,
  "importLogId": 1,
  "title": "Foundation",
  "authors": ["Isaac Asimov"],
  "isbn": null,
  "isbn13": null,
  "rating": null,
  "completedDate": null,
  "status": "to-read",
  "review": null,
  "matchAttempted": 1,
  "matchReason": "ambiguous_match",
  "confidence": 82,
  "createdAt": 1733097630
}
```

---

## Existing Table Interactions

### books (Read + Write ratings only)

**Read Operations**:
- Load all books for matching cache (`bookRepository.findAll()`)
- Query by ISBN for Tier 1 matching (`bookRepository.findByISBN()`)
- Query by title/author for Tier 2 matching (`bookRepository.search()`)

**Write Operations**:
- Update rating field (`bookRepository.update(id, { rating })`)
- Sync rating to Calibre (`updateCalibreRating(calibreId, rating)`)

**No Other Modifications**: Title, author, ISBN, totalPages remain read-only (Calibre is source of truth).

---

### reading_sessions (Create only)

**Create Operations**:
- Create new session for each matched CSV row
- Auto-increment sessionNumber (`sessionRepository.getNextSessionNumber()`)
- Set status from CSV (to-read, currently-reading, read)
- Set completedDate from CSV
- Store review from CSV

**Pattern**:
```typescript
const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);

const session = await sessionRepository.create({
  bookId,
  sessionNumber,
  status: importData.status,
  startedDate: importData.status === 'read' ? importData.completedDate : null,
  completedDate: importData.completedDate,
  review: importData.review,
  isActive: true // Most recent import is active
});
```

**Multi-Read Handling**:
- If CSV has multiple read dates for same book → create multiple sessions
- Archive previous sessions (set isActive=false)
- Only most recent session is active

---

### progress_logs (No import interaction)

**Import Policy**: **Imports do NOT create progress logs**

**Rationale**:
- Progress logs track daily reading progression (journey through a book)
- Imports only have historical completion dates, not daily progress data
- Streak calculations depend on progress logs for accuracy
- Creating "fake" 100% progress logs would:
  - Artificially inflate streak counts
  - Misrepresent reading history (no actual daily tracking occurred)
  - Confuse the purpose of progress logs (tracking vs. historical records)

**Reading History Preservation**:
- Session `completedDate` field preserves when books were finished
- Users can manually add progress entries for imported books if desired
- Future reading (post-import) can be tracked normally with progress logs

**No Operations**: Import feature does not interact with `progress_logs` table

---

## Entity Relationships

### ER Diagram

```
┌─────────────────┐
│  import_logs    │
│  (audit trail)  │
├─────────────────┤
│ id (PK)         │
│ fileName        │
│ provider        │
│ totalRecords    │
│ status          │
│ ...             │
└────────┬────────┘
         │ 1
         │
         │ N (ON DELETE CASCADE)
         │
┌────────▼────────────────────┐
│ import_unmatched_records    │
│ (failed matches)            │
├─────────────────────────────┤
│ id (PK)                     │
│ importLogId (FK)            │
│ title                       │
│ authors                     │
│ matchReason                 │
│ ...                         │
└─────────────────────────────┘

┌─────────────────┐      ┌──────────────────┐
│     books       │      │ reading_sessions │
│  (Calibre sync) │ 1:N  │   (user data)    │
├─────────────────┤──────├──────────────────┤
│ id (PK)         │      │ id (PK)          │
│ calibreId       │      │ bookId (FK)      │
│ title           │      │ sessionNumber    │
│ authors         │      │ status           │
│ rating ◄────────┼──────┤ completedDate    │
│ ...             │      │ review           │
└─────────────────┘      └────────┬─────────┘
                                  │ 1
                                  │
                                  │ N
                                  │
                         ┌────────▼──────────┐
                         │  progress_logs    │
                         │  (reading data)   │
                         ├───────────────────┤
                         │ id (PK)           │
                         │ sessionId (FK)    │
                         │ bookId (FK)       │
                         │ currentPercentage │
                         │ progressDate      │
                         │ ...               │
                         └───────────────────┘
```

### Relationship Rules

1. **import_logs → import_unmatched_records**: One-to-many
   - One import can have many unmatched records
   - Cascade delete: Deleting import_logs deletes associated unmatched records
   - Referential integrity enforced by SQLite

2. **Import → books**: Indirect via matching
   - Import doesn't create books (Calibre is source of truth)
   - Import updates existing book ratings only
   - Unmatched books stored in import_unmatched_records

3. **Import → reading_sessions**: Creates new sessions
   - Each matched CSV row → 1 new reading_session
   - Sessions link to existing books via bookId
   - Multiple imports can create sessions for same book (re-reading)

4. **reading_sessions → progress_logs**: One-to-many
   - Each session gets 1 progress log at 100% (simplified)
   - Users can add more progress logs later manually

---

## Drizzle Schema Definitions

### import-logs.ts

```typescript
import { sqliteTable, text, integer, index, check } from "drizzle-orm/sqlite-core";
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
    userId: integer("user_id"), // Nullable for single-user mode
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Indexes
    userCreatedIdx: index("idx_import_logs_user_created").on(table.userId, table.createdAt),
    statusCreatedIdx: index("idx_import_logs_status_created").on(table.status, table.createdAt),
    providerCreatedIdx: index("idx_import_logs_provider_created").on(table.provider, table.createdAt),
    
    // Check constraints
    fileSizeCheck: check("file_size_check", sql`${table.fileSize} > 0 AND ${table.fileSize} <= 10485760`),
    recordCountsCheck: check("record_counts_check", sql`${table.totalRecords} = ${table.matchedRecords} + ${table.unmatchedRecords}`),
    sessionsCreatedCheck: check("sessions_created_check", sql`${table.sessionsCreated} <= ${table.matchedRecords}`),
    completedAtCheck: check("completed_at_check", sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
    nonNegativeCountsCheck: check(
      "non_negative_counts_check",
      sql`${table.totalRecords} >= 0 AND ${table.matchedRecords} >= 0 AND ${table.unmatchedRecords} >= 0 AND ${table.sessionsCreated} >= 0 AND ${table.sessionsSkipped} >= 0 AND ${table.ratingsSync} >= 0 AND ${table.calibreSyncFailures} >= 0`
    ),
  })
);

export type ImportLog = typeof importLogs.$inferSelect;
export type NewImportLog = typeof importLogs.$inferInsert;
```

---

### import-unmatched-records.ts

```typescript
import { sqliteTable, text, integer, index, check } from "drizzle-orm/sqlite-core";
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
    // Indexes
    importLogIdx: index("idx_unmatched_import_log").on(table.importLogId),
    reasonIdx: index("idx_unmatched_reason").on(table.matchReason),
    titleIdx: index("idx_unmatched_title").on(table.title),
    
    // Check constraints
    titleNotEmptyCheck: check("title_not_empty_check", sql`LENGTH(TRIM(${table.title})) > 0`),
    ratingRangeCheck: check("rating_range_check", sql`${table.rating} IS NULL OR (${table.rating} >= 0 AND ${table.rating} <= 5)`),
    confidenceRangeCheck: check("confidence_range_check", sql`${table.confidence} IS NULL OR (${table.confidence} >= 0 AND ${table.confidence} <= 100)`),
  })
);

export type ImportUnmatchedRecord = typeof importUnmatchedRecords.$inferSelect;
export type NewImportUnmatchedRecord = typeof importUnmatchedRecords.$inferInsert;
```

---

### schema/index.ts (Update)

```typescript
// Existing exports
export * from "./books";
export * from "./reading-sessions";
export * from "./progress-logs";
export * from "./streaks";

// New exports for import feature
export * from "./import-logs";
export * from "./import-unmatched-records";
```

---

## Database Migrations

### Migration 0010: Create import_logs table

**File**: `drizzle/0010_add_import_logs_table.sql`

```sql
-- Create import_logs table
CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('goodreads', 'storygraph')),
  total_records INTEGER NOT NULL DEFAULT 0,
  matched_records INTEGER NOT NULL DEFAULT 0,
  unmatched_records INTEGER NOT NULL DEFAULT 0,
  sessions_created INTEGER NOT NULL DEFAULT 0,
  sessions_skipped INTEGER NOT NULL DEFAULT 0,
  ratings_sync INTEGER NOT NULL DEFAULT 0,
  calibre_sync_failures INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'partial', 'failed')),
  error_message TEXT,
  user_id INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  -- Check constraints
  CHECK (file_size > 0 AND file_size <= 10485760),
  CHECK (total_records >= 0 AND matched_records >= 0 AND unmatched_records >= 0),
  CHECK (sessions_created >= 0 AND sessions_skipped >= 0),
  CHECK (ratings_sync >= 0 AND calibre_sync_failures >= 0),
  CHECK (total_records = matched_records + unmatched_records),
  CHECK (sessions_created <= matched_records),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

-- Create indexes
CREATE INDEX idx_import_logs_user_created 
ON import_logs(user_id, created_at DESC);

CREATE INDEX idx_import_logs_status_created 
ON import_logs(status, created_at DESC);

CREATE INDEX idx_import_logs_provider_created 
ON import_logs(provider, created_at DESC);
```

---

### Migration 0011: Create import_unmatched_records table

**File**: `drizzle/0011_add_import_unmatched_records_table.sql`

```sql
-- Create import_unmatched_records table
CREATE TABLE IF NOT EXISTS import_unmatched_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_log_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  authors TEXT NOT NULL, -- JSON array
  isbn TEXT,
  isbn13 TEXT,
  rating INTEGER,
  completed_date INTEGER,
  status TEXT NOT NULL CHECK (status IN ('read', 'currently-reading', 'to-read', 'did-not-finish', 'paused')),
  review TEXT,
  match_attempted INTEGER NOT NULL DEFAULT 1, -- Boolean: 1=true, 0=false
  match_reason TEXT NOT NULL CHECK (match_reason IN ('no_isbn', 'isbn_not_found', 'no_title_match', 'ambiguous_match', 'not_in_library', 'invalid_data')),
  confidence INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  -- Foreign key
  FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
  
  -- Check constraints
  CHECK (LENGTH(TRIM(title)) > 0),
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))
);

-- Create indexes
CREATE INDEX idx_unmatched_import_log 
ON import_unmatched_records(import_log_id);

CREATE INDEX idx_unmatched_reason 
ON import_unmatched_records(match_reason);

CREATE INDEX idx_unmatched_title 
ON import_unmatched_records(title);
```

---

### Migration Commands

```bash
# Generate migration from schema changes
bun run drizzle-kit generate

# Apply migrations
bun run drizzle-kit migrate

# Verify migrations
sqlite3 data/tome.db ".schema import_logs"
sqlite3 data/tome.db ".schema import_unmatched_records"
```

---

## Validation Rules

### Application-Level Validation (Zod Schemas)

#### ImportLog Validation

```typescript
import { z } from "zod";

export const ImportLogSchema = z.object({
  id: z.number().int().positive().optional(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10 MB
  provider: z.enum(["goodreads", "storygraph"]),
  totalRecords: z.number().int().min(0),
  matchedRecords: z.number().int().min(0),
  unmatchedRecords: z.number().int().min(0),
  sessionsCreated: z.number().int().min(0),
  sessionsSkipped: z.number().int().min(0),
  ratingsSync: z.number().int().min(0),
  calibreSyncFailures: z.number().int().min(0),
  startedAt: z.date(),
  completedAt: z.date().nullable(),
  status: z.enum(["pending", "processing", "success", "partial", "failed"]),
  errorMessage: z.string().nullable(),
  userId: z.number().int().positive().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
}).refine(
  (data) => data.totalRecords === data.matchedRecords + data.unmatchedRecords,
  { message: "Total records must equal matched + unmatched" }
).refine(
  (data) => data.sessionsCreated <= data.matchedRecords,
  { message: "Sessions created cannot exceed matched records" }
).refine(
  (data) => !data.completedAt || data.completedAt >= data.startedAt,
  { message: "Completed time must be after started time" }
).refine(
  (data) => data.status === "failed" ? data.errorMessage !== null : data.errorMessage === null,
  { message: "Error message required for failed status, null otherwise" }
);

export type ImportLogInput = z.infer<typeof ImportLogSchema>;
```

#### UnmatchedRecord Validation

```typescript
export const UnmatchedRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  importLogId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  authors: z.array(z.string().min(1)).min(1),
  isbn: z.string().nullable(),
  isbn13: z.string().nullable(),
  rating: z.number().int().min(0).max(5).nullable(),
  completedDate: z.date().nullable(),
  status: z.enum(["read", "currently-reading", "to-read", "did-not-finish", "paused"]),
  review: z.string().nullable(),
  matchAttempted: z.boolean(),
  matchReason: z.enum([
    "no_isbn",
    "isbn_not_found",
    "no_title_match",
    "ambiguous_match",
    "not_in_library",
    "invalid_data",
  ]),
  confidence: z.number().int().min(0).max(100).nullable(),
  createdAt: z.date().optional(),
});

export type UnmatchedRecordInput = z.infer<typeof UnmatchedRecordSchema>;
```

---

## State Transitions

### ImportLog Status Lifecycle

```
[File Upload] → pending
      ↓
[Start Processing] → processing
      ↓
      ├─→ [All matched/imported] → success
      ├─→ [Some failed] → partial
      └─→ [Critical error] → failed
```

**State Descriptions**:

| Status | Description | Next States | completedAt |
|--------|-------------|-------------|-------------|
| `pending` | File uploaded, not yet processed | processing, failed | NULL |
| `processing` | Actively matching/importing records | success, partial, failed | NULL |
| `success` | All records processed successfully | (terminal) | SET |
| `partial` | Some records imported, some failed | (terminal) | SET |
| `failed` | Critical error, no records imported | (terminal) | SET |

**State Transition Rules**:

```typescript
function canTransitionStatus(from: ImportStatus, to: ImportStatus): boolean {
  const validTransitions: Record<ImportStatus, ImportStatus[]> = {
    pending: ["processing", "failed"],
    processing: ["success", "partial", "failed"],
    success: [], // Terminal state
    partial: [], // Terminal state
    failed: [], // Terminal state
  };
  
  return validTransitions[from].includes(to);
}
```

**Example Status Flow**:

```typescript
// 1. Create import log on file upload
const importLog = await importLogRepository.create({
  fileName: "export.csv",
  fileSize: 524288,
  provider: "goodreads",
  startedAt: new Date(),
  status: "pending", // Initial state
});

// 2. Start processing
await importLogRepository.update(importLog.id, {
  status: "processing",
});

// 3. Complete successfully
await importLogRepository.update(importLog.id, {
  status: "success",
  completedAt: new Date(),
  totalRecords: 234,
  matchedRecords: 220,
  unmatchedRecords: 14,
  sessionsCreated: 218,
  sessionsSkipped: 2,
  ratingsSync: 215,
});
```

---

## Indexes & Performance

### Query Patterns & Indexes

#### 1. List Import History (Most Common)

**Query**:
```sql
SELECT * FROM import_logs 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 20;
```

**Index**: `idx_import_logs_user_created` on `(user_id, created_at DESC)`

**Performance**: O(log n) lookup + sequential scan of 20 records

---

#### 2. Find Failed Imports (Debugging)

**Query**:
```sql
SELECT * FROM import_logs 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

**Index**: `idx_import_logs_status_created` on `(status, created_at DESC)`

**Performance**: O(log n) lookup + sequential scan of failed records

---

#### 3. Get Unmatched Records for Import

**Query**:
```sql
SELECT * FROM import_unmatched_records 
WHERE import_log_id = ?;
```

**Index**: `idx_unmatched_import_log` on `(import_log_id)`

**Performance**: O(log n) lookup + sequential scan of unmatched records

---

#### 4. Search Unmatched by Title (Manual Matching)

**Query**:
```sql
SELECT * FROM import_unmatched_records 
WHERE title LIKE '%search term%';
```

**Index**: `idx_unmatched_title` on `(title)`

**Performance**: O(n) full scan (LIKE with leading wildcard cannot use index efficiently)

**Optimization**: For Phase 2, consider FTS5 virtual table for full-text search.

---

#### 5. Analyze Match Failure Reasons

**Query**:
```sql
SELECT match_reason, COUNT(*) as count 
FROM import_unmatched_records 
GROUP BY match_reason 
ORDER BY count DESC;
```

**Index**: `idx_unmatched_reason` on `(match_reason)`

**Performance**: O(n) scan with index-assisted grouping

---

### Index Size Estimates

Assuming 1000 imports with 10 unmatched records each:

| Table | Records | Index Count | Estimated Size |
|-------|---------|-------------|----------------|
| import_logs | 1,000 | 3 indexes | ~500 KB |
| import_unmatched_records | 10,000 | 3 indexes | ~5 MB |

**Total**: ~5.5 MB for 1000 imports (negligible impact on database size)

---

## Repository Methods

### ImportLogRepository

**File**: `lib/repositories/import-log.repository.ts`

```typescript
import { BaseRepository } from "./base.repository";
import { importLogs, ImportLog, NewImportLog } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

class ImportLogRepository extends BaseRepository<ImportLog, NewImportLog> {
  constructor() {
    super(importLogs);
  }
  
  /**
   * Find import logs by user ID, ordered by most recent first
   */
  async findByUserId(userId: number | null, limit: number = 20): Promise<ImportLog[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importLogs)
      .where(eq(importLogs.userId, userId))
      .orderBy(desc(importLogs.createdAt))
      .limit(limit);
  }
  
  /**
   * Find failed imports for debugging
   */
  async findFailed(limit: number = 50): Promise<ImportLog[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importLogs)
      .where(eq(importLogs.status, "failed"))
      .orderBy(desc(importLogs.createdAt))
      .limit(limit);
  }
  
  /**
   * Find imports by provider
   */
  async findByProvider(
    provider: "goodreads" | "storygraph",
    limit: number = 20
  ): Promise<ImportLog[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importLogs)
      .where(eq(importLogs.provider, provider))
      .orderBy(desc(importLogs.createdAt))
      .limit(limit);
  }
  
  /**
   * Update import statistics
   */
  async updateStats(
    id: number,
    stats: Partial<Pick<
      ImportLog,
      | "totalRecords"
      | "matchedRecords"
      | "unmatchedRecords"
      | "sessionsCreated"
      | "sessionsSkipped"
      | "ratingsSync"
      | "calibreSyncFailures"
    >>
  ): Promise<void> {
    await this.update(id, {
      ...stats,
      updatedAt: new Date(),
    });
  }
  
  /**
   * Mark import as completed
   */
  async complete(
    id: number,
    status: "success" | "partial" | "failed",
    errorMessage?: string
  ): Promise<void> {
    await this.update(id, {
      status,
      completedAt: new Date(),
      errorMessage: errorMessage || null,
      updatedAt: new Date(),
    });
  }
  
  /**
   * Get import with unmatched records count
   */
  async findByIdWithUnmatchedCount(id: number): Promise<ImportLog & { unmatchedCount: number } | null> {
    const db = this.getDatabase();
    const { importUnmatchedRecords } = await import("@/lib/db/schema");
    
    const result = await db
      .select({
        importLog: importLogs,
        unmatchedCount: sql<number>`COUNT(${importUnmatchedRecords.id})`,
      })
      .from(importLogs)
      .leftJoin(importUnmatchedRecords, eq(importUnmatchedRecords.importLogId, importLogs.id))
      .where(eq(importLogs.id, id))
      .groupBy(importLogs.id)
      .limit(1);
    
    if (result.length === 0) return null;
    
    return {
      ...result[0].importLog,
      unmatchedCount: result[0].unmatchedCount,
    };
  }
}

export const importLogRepository = new ImportLogRepository();
```

---

### UnmatchedRecordRepository

**File**: `lib/repositories/unmatched-record.repository.ts`

```typescript
import { BaseRepository } from "./base.repository";
import { importUnmatchedRecords, ImportUnmatchedRecord, NewImportUnmatchedRecord } from "@/lib/db/schema";
import { eq, like, and } from "drizzle-orm";

class UnmatchedRecordRepository extends BaseRepository<ImportUnmatchedRecord, NewImportUnmatchedRecord> {
  constructor() {
    super(importUnmatchedRecords);
  }
  
  /**
   * Find unmatched records by import log ID
   */
  async findByImportLogId(importLogId: number): Promise<ImportUnmatchedRecord[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.importLogId, importLogId));
  }
  
  /**
   * Find unmatched records by match reason
   */
  async findByReason(reason: ImportUnmatchedRecord["matchReason"]): Promise<ImportUnmatchedRecord[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importUnmatchedRecords)
      .where(eq(importUnmatchedRecords.matchReason, reason));
  }
  
  /**
   * Search unmatched records by title (case-insensitive)
   */
  async searchByTitle(searchTerm: string, limit: number = 50): Promise<ImportUnmatchedRecord[]> {
    const db = this.getDatabase();
    
    return db
      .select()
      .from(importUnmatchedRecords)
      .where(like(importUnmatchedRecords.title, `%${searchTerm}%`))
      .limit(limit);
  }
  
  /**
   * Bulk create unmatched records
   */
  async bulkCreate(records: NewImportUnmatchedRecord[]): Promise<void> {
    const db = this.getDatabase();
    
    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await db.insert(importUnmatchedRecords).values(batch);
    }
  }
  
  /**
   * Get count of unmatched records by import
   */
  async countByImportLogId(importLogId: number): Promise<number> {
    return this.count({ importLogId });
  }
  
  /**
   * Get statistics by match reason
   */
  async getReasonStats(): Promise<{ reason: string; count: number }[]> {
    const db = this.getDatabase();
    
    const results = await db
      .select({
        reason: importUnmatchedRecords.matchReason,
        count: sql<number>`COUNT(*)`,
      })
      .from(importUnmatchedRecords)
      .groupBy(importUnmatchedRecords.matchReason)
      .orderBy(desc(sql<number>`COUNT(*)`));
    
    return results;
  }
}

export const unmatchedRecordRepository = new UnmatchedRecordRepository();
```

---

## Testing Checklist

### Unit Tests (Repository Layer)

- [ ] ImportLogRepository.create() - Creates with valid data
- [ ] ImportLogRepository.findByUserId() - Returns user's imports
- [ ] ImportLogRepository.findFailed() - Returns only failed imports
- [ ] ImportLogRepository.updateStats() - Updates statistics correctly
- [ ] ImportLogRepository.complete() - Sets completion status and time
- [ ] UnmatchedRecordRepository.bulkCreate() - Inserts multiple records
- [ ] UnmatchedRecordRepository.findByImportLogId() - Returns associated records
- [ ] UnmatchedRecordRepository.searchByTitle() - Finds by title substring

### Integration Tests (Database Constraints)

- [ ] ImportLog: File size validation (rejects > 10 MB)
- [ ] ImportLog: Record counts consistency (totalRecords = matched + unmatched)
- [ ] ImportLog: Sessions created <= matched records
- [ ] ImportLog: completedAt >= startedAt
- [ ] ImportLog: Error message required when status=failed
- [ ] UnmatchedRecord: Title not empty
- [ ] UnmatchedRecord: Rating 0-5 range
- [ ] UnmatchedRecord: Confidence 0-100 range
- [ ] UnmatchedRecord: Cascade delete on import_logs deletion

### Performance Tests

- [ ] Query 1000 import logs by user in <100ms
- [ ] Bulk insert 1000 unmatched records in <500ms
- [ ] Search unmatched records by title in <200ms

---

## Summary

This data model provides:

✅ **Complete audit trail** via import_logs table  
✅ **Unmatched record storage** for manual review  
✅ **Constitutional compliance** (no book creation, Calibre source of truth)  
✅ **Referential integrity** with foreign keys and cascade deletes  
✅ **Performance optimization** with strategic indexes  
✅ **Type safety** with Drizzle ORM and Zod validation  
✅ **Clear state management** with defined status lifecycle  

**Next Steps**: Proceed to API contract generation (OpenAPI specs).

---

**End of Data Model Document**
