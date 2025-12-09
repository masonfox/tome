# Implementation Plan: Import Books from TheStoryGraph & Goodreads

**Branch**: `003-import-from-storygraph-goodreads` | **Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-import-from-storygraph-goodreads/spec.md`

## Summary

Enable users to import their complete reading history from Goodreads and TheStoryGraph CSV exports into Tome. The system will automatically match imported books to existing Calibre library entries using a tiered matching algorithm (ISBN → fuzzy title/author → manual resolution), create reading sessions with preserved history, sync ratings bidirectionally with Calibre, and handle edge cases like re-reads, duplicates, and unmatched books. The feature maintains Tome's constitutional principles by treating Calibre as the source of truth for books while preserving complete user reading history.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14 (App Router), Bun runtime (production), Node.js (development)  
**Primary Dependencies**: 
- `papaparse` (CSV parsing with proper quote/escape handling)
- `fastest-levenshtein` (string similarity calculation for fuzzy matching)
- `string-strip-html` (strip HTML tags from TheStoryGraph reviews)
- `drizzle-orm` (database access via repository pattern)
- `zod` (validation for import data structures)
- `pino` (structured logging for import operations)

**Storage**: 
- Tome database: SQLite (`data/tome.db`) via Drizzle ORM with new tables: `import_logs`, `import_unmatched_records`
- Calibre database: Read-only access (`metadata.db`) for book matching, write access for ratings only via `updateCalibreRating()`

**Testing**: 
- Unit tests: `__tests__/lib/` for CSV parsing, matching algorithms, data normalization
- Integration tests: `__tests__/integration/api/` for end-to-end import workflow with real databases
- Contract tests: `__tests__/api/import/` for API endpoint validation

**Target Platform**: Linux server (Docker), macOS/Linux development, self-hosted deployment  

**Project Type**: Web application (Next.js frontend + API backend)

**Performance Goals**: 
- Parse 1000 CSV records in <5 seconds
- Match 1000 records against 5000-book library in <30 seconds
- Database insert 1000 sessions in <10 seconds
- Total end-to-end import time: <60 seconds for 1000 records

**Constraints**: 
- File upload size limit: 10 MB (prevents memory issues)
- No external API dependencies (CSV-only, no Goodreads/TheStoryGraph APIs)
- Atomic transactions (rollback on error to prevent partial imports)
- Sequential import processing (no concurrent imports to prevent race conditions)
- Read-only Calibre access except for rating writes

**Scale/Scope**: 
- Target: 100-5000 records per import (typical user export)
- Support: 10,000+ books in Calibre library
- Match rate target: >90% automatic matches
- False positive rate: <5% incorrect matches

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with principles from `.specify/memory/constitution.md`:

- [x] **Data Integrity First**: 
  - ✅ Calibre writes limited to ratings via `updateCalibreRating()` (existing pattern)
  - ✅ Uses Drizzle migrations for new tables (`import_logs`, `import_unmatched_records`)
  - ✅ Uses database factory pattern (`createDatabase()`) for Tome DB access
  - ✅ All Tome DB access through repositories (bookRepository, sessionRepository, progressRepository)
  - ✅ Transaction-based imports with rollback on error
  - ✅ Validation before writes (duplicate detection, temporal consistency)

- [x] **Layered Architecture Pattern**: 
  - ✅ Follows Routes → Services → Repositories pattern
  - ✅ API routes: `app/api/import/` (thin orchestrators, 30-50 lines)
  - ✅ Business logic: `lib/services/import.service.ts` (matching, normalization, session creation)
  - ✅ Data access: Extends existing repositories, adds `lib/repositories/import-log.repository.ts`
  - ✅ No repository bypassing (all DB access via repositories)

- [x] **Self-Contained Deployment**: 
  - ✅ No external services (CSV parsing is local, no APIs)
  - ✅ Works with SQLite only (no Redis, no queues)
  - ✅ File uploads handled by Next.js built-in (no cloud storage)
  - ✅ Matching algorithm runs in-memory (no ML service dependencies)

- [x] **User Experience Standards**: 
  - ✅ Explicit provider selection (no auto-detection ambiguity)
  - ✅ Smart defaults: ISBN-first matching, intelligent fuzzy matching
  - ✅ Validates temporal relationships (startedDate <= completedDate)
  - ✅ Preserves history: Creates new sessions, never overwrites or deletes
  - ✅ Preview before commit (user reviews matches before executing)
  - ✅ Clear error messages with actionable guidance

- [x] **Observability & Testing**: 
  - ✅ Structured logging with Pino for all import operations
  - ✅ Logs: Import start/end, match statistics, errors, warnings
  - ✅ Tests use real databases via `setDatabase(testDb)` pattern
  - ✅ Integration tests cover full import workflow
  - ✅ Test isolation with `resetDatabase()` between tests

**Violations**: None. Feature fully compliant with constitutional principles.

## Project Structure

### Documentation (this feature)

```text
specs/003-import-from-storygraph-goodreads/
├── plan.md              # This file
├── spec.md              # Feature specification (complete)
├── research.md          # Phase 0: Matching algorithms, CSV parsing libraries
├── data-model.md        # Phase 1: New tables, relationships, migrations
├── quickstart.md        # Phase 1: Developer guide for import feature
└── contracts/           # Phase 1: OpenAPI specs for import endpoints
    ├── upload.yaml      # POST /api/import/upload
    ├── preview.yaml     # GET /api/import/:id/preview
    └── execute.yaml     # POST /api/import/:id/execute
```

### Source Code (repository root)

```text
# Backend API Routes
app/api/import/
├── upload/
│   └── route.ts         # POST /api/import/upload (file upload, validation, parsing)
├── [importId]/
│   ├── preview/
│   │   └── route.ts     # GET /api/import/:id/preview (match results)
│   ├── execute/
│   │   └── route.ts     # POST /api/import/:id/execute (commit import)
│   └── unmatched/
│       └── route.ts     # GET /api/import/:id/unmatched (export unmatched)

# Business Logic Services
lib/services/
├── import.service.ts    # Core import orchestration
├── csv-parser.service.ts # CSV parsing and normalization
├── book-matcher.service.ts # ISBN + fuzzy matching algorithms
└── session-importer.service.ts # Session creation from import data

# Data Access Repositories
lib/repositories/
├── import-log.repository.ts # CRUD for import_logs table
└── unmatched-record.repository.ts # CRUD for import_unmatched_records

# Database Schema
lib/db/schema/
├── import-logs.ts       # Import operation metadata
└── unmatched-records.ts # Unmatched book records

# Utilities
lib/utils/
├── isbn-normalizer.ts   # ISBN cleaning and validation
├── string-similarity.ts # Levenshtein distance wrapper
└── date-parser.ts       # Multi-format date parsing

# Frontend Pages & Components
app/import/
└── page.tsx             # Import workflow page (upload → preview → execute)

components/import/
├── FileUploadForm.tsx   # Drag-drop file upload
├── ImportPreview.tsx    # Match review table
├── MatchConfidence.tsx  # Match confidence indicator
├── UnmatchedRecords.tsx # Unmatched records list
└── ImportSummary.tsx    # Post-import results

# Database Migrations
drizzle/
├── 0010_add_import_logs.sql # Create import_logs table
└── 0011_add_unmatched_records.sql # Create import_unmatched_records table

# Tests
__tests__/
├── lib/
│   ├── csv-parser.test.ts # CSV parsing edge cases
│   ├── book-matcher.test.ts # Matching algorithm accuracy
│   ├── isbn-normalizer.test.ts # ISBN cleaning
│   └── string-similarity.test.ts # Levenshtein calculations
├── integration/api/
│   └── import.test.ts   # End-to-end import workflow
└── repositories/
    ├── import-log.repository.test.ts
    └── unmatched-record.repository.test.ts
```

**Structure Decision**: Web application pattern (Next.js App Router). Import is a full-stack feature with API backend (CSV processing, matching, DB writes) and React frontend (file upload, preview UI, summary). Uses existing Tome architecture: Routes → Services → Repositories.

## Complexity Tracking

> **No violations identified.** Feature fully compliant with constitutional principles.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research & Planning

**Objective**: Resolve all technical unknowns from specification before design.

### Research Tasks

1. **CSV Parsing Libraries** (FR-001)
   - **Question**: Which library best handles Goodreads/TheStoryGraph format quirks?
   - **Requirements**: 
     - Handle quoted fields with commas, newlines
     - UTF-8 with BOM support
     - Large file streaming (10 MB)
     - TypeScript types
   - **Candidates**: Papa Parse, csv-parse, fast-csv
   - **Decision Criteria**: Reliability, performance, bundle size, maintenance

2. **String Similarity Algorithms** (FR-003)
   - **Question**: Which algorithm provides best balance of accuracy and performance?
   - **Requirements**:
     - Sub-second matching for 1000 records against 5000 books
     - Configurable threshold
     - Unicode support
   - **Candidates**: Levenshtein, Jaro-Winkler, Cosine similarity
   - **Decision Criteria**: Accuracy on book titles, speed, implementation complexity

3. **ISBN Validation & Normalization** (FR-002)
   - **Question**: How to handle Goodreads' ISBN formatting (`="..."` wrappers)?
   - **Requirements**:
     - Remove Excel formula wrappers
     - Validate ISBN-10 and ISBN-13 checksums
     - Convert ISBN-10 ↔ ISBN-13
   - **Research**: ISBN specification, validation algorithms, existing libraries

4. **File Upload Handling** (FR-001)
   - **Question**: Next.js built-in file upload vs third-party library?
   - **Requirements**:
     - Multipart form data
     - 10 MB size limit enforcement
     - Memory-efficient (no full file in memory)
     - Progress indicators
   - **Candidates**: Next.js API routes (built-in), multer, formidable

5. **Transaction Management Patterns** (NFR-002)
   - **Question**: How to handle batch inserts with rollback on error?
   - **Requirements**:
     - Drizzle ORM transaction API
     - Batch size optimization (100 records per transaction)
     - Partial rollback on validation errors
   - **Research**: Drizzle transaction examples, error handling patterns

6. **Duplicate Detection Strategy** (FR-007)
   - **Question**: How to detect duplicates efficiently with date tolerance?
   - **Requirements**:
     - Check existing sessions before insert
     - 24-hour date tolerance (same book read on consecutive days)
     - Fast query (indexed)
   - **Research**: SQL query optimization, index design

### Research Output

Deliverable: `research.md` with sections:
- **CSV Parsing**: Recommended library with code examples
- **String Similarity**: Algorithm choice with benchmark results
- **ISBN Handling**: Normalization function design
- **File Upload**: Implementation approach
- **Transactions**: Batch insert pattern with error handling
- **Duplicate Detection**: SQL query design with indexes

**Completion Criteria**: All NEEDS CLARIFICATION items resolved with concrete decisions.

---

## Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

### 1.1 Data Model Design

**Deliverable**: `data-model.md`

#### New Entities

**ImportLog** (import_logs table)
- **Purpose**: Audit trail for import operations
- **Fields**:
  - id (PK, auto-increment)
  - fileName (string, NOT NULL)
  - fileSize (integer bytes, NOT NULL)
  - provider (enum: 'goodreads' | 'storygraph', NOT NULL)
  - totalRecords (integer, NOT NULL)
  - matchedRecords (integer, NOT NULL)
  - unmatchedRecords (integer, NOT NULL)
  - sessionsCreated (integer, NOT NULL)
  - sessionsSkipped (integer, NOT NULL)
  - ratingsSync (integer, NOT NULL)
  - startedAt (timestamp, NOT NULL)
  - completedAt (timestamp, NULL)
  - status (enum: 'success' | 'partial' | 'failed', NOT NULL)
  - errorMessage (text, NULL)
  - userId (integer, NULL, FK to users if multi-user)
  - createdAt (timestamp, NOT NULL, default now)
- **Indexes**:
  - Primary: id
  - Index: (userId, createdAt DESC) for user import history
  - Index: (status, createdAt DESC) for failed import queries
- **Relationships**:
  - One-to-many with UnmatchedRecord (importLogId FK)

**UnmatchedRecord** (import_unmatched_records table)
- **Purpose**: Store books that couldn't be matched for later review
- **Fields**:
  - id (PK, auto-increment)
  - importLogId (integer, NOT NULL, FK to import_logs, CASCADE DELETE)
  - title (text, NOT NULL)
  - authors (JSON array, NOT NULL)
  - isbn (text, NULL)
  - rating (integer 0-5, NULL)
  - completedDate (timestamp, NULL)
  - status (text, NOT NULL) - from CSV
  - review (text, NULL)
  - matchAttempted (boolean, NOT NULL, default true)
  - reason (text, NOT NULL) - 'no_isbn', 'no_title_match', 'ambiguous'
  - createdAt (timestamp, NOT NULL, default now)
- **Indexes**:
  - Primary: id
  - Foreign key: (importLogId) with CASCADE DELETE
  - Index: (importLogId, reason) for filtering by failure reason
- **Relationships**:
  - Many-to-one with ImportLog (importLogId FK)

#### Modified Entities

**ReadingSession** (no schema changes)
- **Usage**: Import creates new sessions with:
  - Incremented sessionNumber (max existing + 1)
  - completedDate from import
  - review from import
  - status mapped from import (read, currently-reading, to-read)

**Book** (no schema changes)
- **Usage**: Import updates existing books:
  - rating synced from import (if provided)
  - No metadata updates (Calibre is source of truth)

#### Validation Rules

**ImportLog Validation**:
- fileSize > 0 and ≤ 10,485,760 bytes (10 MB)
- provider must be 'goodreads' or 'storygraph'
- totalRecords = matchedRecords + unmatchedRecords
- sessionsCreated ≤ matchedRecords (duplicates skipped)
- completedAt ≥ startedAt (if not null)
- status 'success' → errorMessage must be null
- status 'failed' → errorMessage must be set

**UnmatchedRecord Validation**:
- title not empty (min 1 character)
- authors array not empty
- isbn must match ISBN-10 or ISBN-13 format (if provided)
- rating must be 0-5 (if provided)
- reason must be one of: 'no_isbn', 'no_title_match', 'ambiguous', 'not_in_library', 'dnf_not_supported'

#### State Transitions

**Import Workflow States**:
```
[Uploaded] → [Parsing] → [Matching] → [Preview] → [Executing] → [Complete/Failed]
   ↓            ↓           ↓            ↓           ↓              ↓
  fileName   provider    matches     user confirms  sessions     ImportLog
                        calculated   or skips       created      status set
```

**ImportLog Status Lifecycle**:
- Initial: Status not set (upload in progress)
- Parsing complete: Set provider, totalRecords
- Matching complete: Set matchedRecords, unmatchedRecords
- Execute start: Set startedAt
- Execute complete: Set completedAt, sessionsCreated, sessionsSkipped, ratingsSync
- Success: status = 'success'
- Partial: status = 'partial' (some records imported, some failed)
- Failure: status = 'failed', errorMessage set

---

### 1.2 API Contract Design

**Deliverable**: `contracts/` directory with OpenAPI YAML specs

#### Endpoint 1: POST /api/import/upload

**File**: `contracts/upload.yaml`

**Purpose**: Accept CSV file, validate format, parse and match books.

**Request**:
```yaml
requestBody:
  required: true
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          file:
            type: string
            format: binary
            description: CSV file from Goodreads or TheStoryGraph
        required:
          - file
```

**Response 200 OK**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: true
        importId:
          type: string
          format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        provider:
          type: string
          enum: [goodreads, storygraph]
          example: "goodreads"
        totalRecords:
          type: integer
          example: 234
        preview:
          type: object
          properties:
            exactMatches:
              type: integer
              example: 180
            highConfidenceMatches:
              type: integer
              example: 32
            lowConfidenceMatches:
              type: integer
              example: 8
            unmatchedRecords:
              type: integer
              example: 14
```

**Response 400 Bad Request**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "Invalid CSV format"
        details:
          type: string
          example: "This file doesn't appear to be a valid Goodreads export. Please check: (1) You selected the correct provider, (2) The export file hasn't been modified, (3) You exported with all data included (not a filtered export)."
```

**Response 413 Payload Too Large**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "File too large"
        details:
          type: string
          example: "Maximum file size is 10 MB"
```

---

#### Endpoint 2: GET /api/import/:importId/preview

**File**: `contracts/preview.yaml`

**Purpose**: Retrieve detailed match preview for user review.

**Parameters**:
```yaml
parameters:
  - name: importId
    in: path
    required: true
    schema:
      type: string
      format: uuid
```

**Response 200 OK**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
        import:
          type: object
          properties:
            id:
              type: string
              format: uuid
            provider:
              type: string
              enum: [goodreads, storygraph]
            totalRecords:
              type: integer
            fileName:
              type: string
        matches:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
                description: Unique match identifier
              confidence:
                type: integer
                minimum: 0
                maximum: 100
                description: Match confidence percentage
              importData:
                type: object
                properties:
                  title:
                    type: string
                  author:
                    type: string
                  isbn13:
                    type: string
                  rating:
                    type: integer
                    minimum: 0
                    maximum: 5
                  completedDate:
                    type: string
                    format: date
                  status:
                    type: string
                    enum: [read, currently-reading, to-read]
                  review:
                    type: string
              matchedBook:
                type: object
                properties:
                  id:
                    type: integer
                  calibreId:
                    type: integer
                  title:
                    type: string
                  authors:
                    type: array
                    items:
                      type: string
                  totalPages:
                    type: integer
              matchReason:
                type: string
                description: Explanation of match (e.g., "ISBN-13 exact match", "Title 95% + Author match")
        unmatched:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              title:
                type: string
              author:
                type: string
              reason:
                type: string
                description: Why no match found
```

**Response 404 Not Found**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "Import not found"
```

---

#### Endpoint 3: POST /api/import/:importId/execute

**File**: `contracts/execute.yaml`

**Purpose**: Execute import after user confirms matches.

**Parameters**:
```yaml
parameters:
  - name: importId
    in: path
    required: true
    schema:
      type: string
      format: uuid
```

**Request**:
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        properties:
          confirmedMatches:
            type: array
            items:
              type: string
            description: Array of match IDs to import
          skipRecords:
            type: array
            items:
              type: string
            description: Array of unmatched IDs to skip
          forceDuplicates:
            type: boolean
            default: false
            description: Import even if duplicates detected
```

**Response 200 OK**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
        summary:
          type: object
          properties:
            sessionsCreated:
              type: integer
            sessionsSkipped:
              type: integer
            ratingsSync:
              type: integer
            calibreSyncFailures:
              type: integer
            unmatchedRecords:
              type: integer
        importLogId:
          type: integer
          description: Database ID for import log record
```

**Response 400 Bad Request**:
```yaml
content:
  application/json:
    schema:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "Invalid import state"
        details:
          type: string
          example: "Import already executed"
```

---

### 1.3 Quickstart Guide

**Deliverable**: `quickstart.md`

**Contents**:
1. **Developer Setup**
   - Dependencies to install (papaparse, fastest-levenshtein)
   - Database migration commands
   - Test data generation

2. **Import Workflow Walkthrough**
   - API call sequence with curl examples
   - Expected responses at each step
   - Common error scenarios

3. **Testing Guide**
   - Running unit tests for matching algorithm
   - Integration test setup (sample CSV files)
   - Manual testing checklist

4. **Debugging Tips**
   - Structured logging queries
   - Match confidence tuning
   - Performance profiling

---

### 1.4 Agent Context Update

**Action**: Run `.specify/scripts/bash/update-agent-context.sh opencode`

**Purpose**: Add import-related technologies and patterns to `.specify/memory/patterns.md` or similar context file.

**New Patterns to Document**:
1. CSV parsing with papaparse (streaming, error handling)
2. String similarity calculation with fastest-levenshtein
3. Batch database transactions with Drizzle (insert multiple sessions)
4. File upload handling in Next.js API routes
5. Import state management: **Database storage** (see Architecture Decision below)

**Architecture Decision - Match Results Storage (2025-12-03):**
- **Initial Design:** In-memory cache with 30-minute TTL for preview/execute workflow
- **Issue Discovered:** Dev server hot-reloads cleared cache between upload and execute
- **Final Implementation:** Store match results in `import_logs.matchResults` JSON column
- **Benefits:** Survives server restarts, provides audit trail, enables resume after errors
- **Trade-off:** ~50-500KB per import stored in DB vs pure memory efficiency
- **Result:** Import flow is resilient to server restarts in both dev and production

---

## Phase 2: Task Breakdown (Not Generated by /speckit.plan)

**Note**: Task breakdown is generated by separate `/speckit.tasks` command.

**Expected Output**: `tasks.md` with:
- Granular implementation tasks (2-4 hour chunks)
- Dependency ordering
- Acceptance criteria per task
- Test requirements

---

## Key Implementation Notes

### Match Confidence Calculation

```typescript
function calculateMatchConfidence(
  importBook: { title: string; author: string; isbn?: string },
  calibreBook: { title: string; authors: string[]; isbn?: string }
): { confidence: number; reason: string } {
  // Tier 1: ISBN exact match
  if (importBook.isbn && calibreBook.isbn && 
      normalizeISBN(importBook.isbn) === normalizeISBN(calibreBook.isbn)) {
    // Validate title similarity to catch ISBN typos
    const titleSim = similarity(
      normalizeTitle(importBook.title),
      normalizeTitle(calibreBook.title)
    );
    if (titleSim > 60) {
      return { confidence: 100, reason: 'ISBN exact match' };
    }
  }
  
  // Tier 2: Fuzzy title + author match
  const titleSim = similarity(
    normalizeTitle(importBook.title),
    normalizeTitle(calibreBook.title)
  );
  const authorSim = similarity(
    normalizeAuthor(importBook.author),
    normalizeAuthor(calibreBook.authors[0])
  );
  
  if (titleSim >= 90 && authorSim === 100) {
    return { confidence: 95, reason: 'Title 90%+ and exact author match' };
  }
  if (titleSim >= 95 && authorSim >= 80) {
    return { confidence: 90, reason: 'Title 95%+ and author 80%+ match' };
  }
  if (titleSim >= 85) {
    return { confidence: 85, reason: 'Title 85%+ match' };
  }
  
  // No match
  return { confidence: 0, reason: 'No match found' };
}
```

### Duplicate Detection Query

```sql
-- Check for existing session with same book, date, and rating
SELECT id FROM reading_sessions 
WHERE bookId = ?
  AND status = ?
  AND ABS(julianday(completedDate) - julianday(?)) < 1.0
  AND (rating IS NULL OR rating = ?)
LIMIT 1;
```

### Batch Insert Pattern

```typescript
// Process imports in batches of 100 to avoid transaction timeouts
const BATCH_SIZE = 100;
const batches = chunk(confirmedMatches, BATCH_SIZE);

for (const batch of batches) {
  await db.transaction(async (tx) => {
    for (const match of batch) {
      // Create session (no progress logs - imports are historical records, not tracked reading)
      const session = await sessionRepository.create(tx, {
        bookId: match.matchedBookId,
        sessionNumber: match.sessionNumber,
        status: match.status,
        completedDate: match.completedDate,
        review: match.review
      });
      
      // Note: We do NOT create progress logs for imports because:
      // - Progress logs track daily reading progression (the journey)
      // - Imports only have completion dates (no daily granularity)
      // - Streak calculations depend on progress logs for accuracy
      // - Session completedDate already preserves "when finished"
      
      // Update book rating
      if (match.rating) {
        await bookRepository.update(tx, match.matchedBookId, {
          rating: match.rating
        });
        
        // Best-effort Calibre sync
        try {
          await updateCalibreRating(match.calibreId, match.rating);
        } catch (err) {
          logger.warn({ calibreId: match.calibreId, error: err }, 
            'Calibre rating sync failed, continuing import');
        }
      }
    }
  });
}
```

---

## Success Criteria

Phase 0 complete when:
- [x] All NEEDS CLARIFICATION items in Technical Context resolved
- [ ] research.md generated with library choices and benchmark results

Phase 1 complete when:
- [ ] data-model.md generated with complete schema definitions
- [ ] contracts/ directory contains OpenAPI specs for all 3 endpoints
- [ ] quickstart.md provides clear developer onboarding
- [ ] Agent context updated with new patterns

Phase 2 planning complete when:
- [ ] tasks.md generated with granular implementation tasks
- [ ] Dependencies mapped (no circular dependencies)
- [ ] Each task <4 hours with clear acceptance criteria

---

## Next Steps

1. **Execute Phase 0**: Run `/speckit.plan` research command to generate `research.md`
2. **Execute Phase 1**: Run `/speckit.plan` design command to generate data model, contracts, and quickstart
3. **Execute Phase 2**: Run `/speckit.tasks` command to generate implementation task breakdown
4. **Begin Implementation**: Follow task order from `tasks.md`

---

**End of Implementation Plan**
