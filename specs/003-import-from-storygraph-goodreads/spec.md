# Feature Specification: Import Books from TheStoryGraph & Goodreads

**Spec ID**: 003  
**Status**: Draft  
**Created**: 2025-12-01  
**Author**: Spec-Kit AI  
**Complexity**: High  

---

## 1. Overview

### Purpose

Enable users to import their reading history from TheStoryGraph and Goodreads CSV exports into Tome, automatically matching imported books to existing Calibre library entries and preserving complete reading history with ratings and dates.

### User Value

Users switching to Tome from TheStoryGraph or Goodreads should not need to manually re-enter years of reading history. This feature provides a seamless migration path that respects Tome's commitment to complete data preservation while maintaining Calibre as the source of truth for book metadata.

### Scope

**In Scope:**
- CSV file upload and validation (Goodreads and TheStoryGraph formats)
- Deterministic book matching algorithm with fallback tiers
- Reading history import (dates, ratings, read counts, reviews)
- Import preview with match confidence indicators
- Manual match resolution for uncertain matches
- Post-import summary with statistics
- Idempotent re-import support (skip duplicates)

**Out of Scope:**
- Creating new books in Calibre (Calibre remains source of truth)
- Social features from import (followers, likes, comments)
- Importing shelves/collections as custom tags
- Real-time sync with external services
- Automatic periodic imports
- Bulk book metadata editing

---

## 2. User Stories

### Primary User Story

**As a reader migrating to Tome**, I want to upload my Goodreads or TheStoryGraph export CSV so that Tome can match my reading history to books already in my Calibre library, preserving my ratings, dates, and reviews without manual re-entry.

### Supporting Stories

1. **As a user with a large library**, I want to see a preview of matched and unmatched books before finalizing the import so I can verify the matching accuracy.

2. **As a user with ambiguous matches**, I want to manually select the correct book from multiple candidates or skip uncertain entries so I maintain data integrity.

3. **As a power user**, I want to re-import the same CSV multiple times without creating duplicate sessions so I can safely retry imports after fixing issues.

4. **As a user who re-reads books**, I want the import to create separate reading sessions for multiple read dates of the same book so my complete history is preserved.

---

## 3. Functional Requirements

### FR-001: File Upload & Validation

**Priority**: P0 (Blocker)

**Description**: System must accept CSV files with explicit provider selection and validate format/structure.

**Acceptance Criteria:**
- User must explicitly select provider (Goodreads or TheStoryGraph) before upload
- Accept CSV files up to 10 MB in size
- Validate required columns exist for selected provider
- Return clear error messages for malformed files or column mismatches
- Support UTF-8 encoding with BOM tolerance
- Handle quoted fields containing commas, newlines, and special characters

**Provider Selection:**
- User selects from dropdown/radio buttons: "Goodreads" or "TheStoryGraph"
- Selection is required before file can be uploaded
- UI shows expected column format for selected provider

**Required Columns by Provider:**
- **Goodreads**: `Book Id`, `Title`, `Author`, `My Rating`, `Date Read`, `Exclusive Shelf`
- **TheStoryGraph**: `Title`, `Authors`, `Read Status`, `Star Rating`, `Last Date Read`

**Error Conditions:**
- File exceeds size limit → "File too large (max 10 MB)"
- Missing required columns → "This file doesn't appear to be a valid {provider} export. Please check: (1) You selected the correct provider, (2) The export file hasn't been modified, (3) You exported with all data included (not a filtered export)."
- Non-CSV file type → "File must be CSV format"
- Empty file → "File is empty"
- Column mismatch → "This file doesn't match the expected {provider} export format. Try: (1) Verify you selected the correct provider (Goodreads or TheStoryGraph), (2) Re-export from {provider} and try again, (3) Check the file wasn't modified after export."

---

### FR-002: Data Normalization

**Priority**: P0 (Blocker)

**Description**: Parse and normalize CSV data into standard internal format.

**Acceptance Criteria:**
- Parse all supported column mappings (see Data Mapping Tables below)
- Normalize author names (remove extra whitespace, handle "Last, First" format)
- Clean ISBNs (remove equals signs, quotes, dashes, and "ISBN:" prefixes)
- Parse dates in multiple formats (YYYY/MM/DD, YYYY-MM-DD, MM/DD/YYYY) as calendar dates (no timezone, day-level precision)
- Parse date ranges from TheStoryGraph "Dates Read" (format: YYYY/MM/DD-YYYY/MM/DD) to extract startedDate and completedDate
- Convert ratings to 0-5 integer scale (Goodreads 0-5 direct, TheStoryGraph 0.0-5.0 via Math.round)
- Handle multiple authors (comma-separated)

**Data Mapping Tables:**

#### Goodreads Column Mapping

| Goodreads Column | Tome Field | Required | Notes |
|-----------------|------------|----------|-------|
| Title | title | Yes | Primary matching field |
| Author | authors[0] | Yes | Primary author |
| Additional Authors | authors[1..n] | No | Comma-separated |
| ISBN | isbn | No | Remove ="..." wrapper |
| ISBN13 | isbn13 | No | Remove ="..." wrapper, preferred over ISBN |
| Number of Pages | totalPages | No | Integer validation |
| My Rating | rating | No | 0-5 scale, 0 = unrated |
| Date Added | startedDate | No | YYYY/MM/DD format |
| Date Read | completedDate | No | YYYY/MM/DD format |
| Exclusive Shelf | status | Yes | to-read, currently-reading, read |
| My Review | review | No | Free text |
| Read Count | readCount | No | Integer, creates N sessions |

#### TheStoryGraph Column Mapping

| TheStoryGraph Column | Tome Field | Required | Notes |
|---------------------|------------|----------|-------|
| Title | title | Yes | Primary matching field |
| Authors | authors | Yes | Comma-separated |
| ISBN/UID | isbn | No | May contain non-ISBN identifiers |
| Star Rating | rating | No | 0.0-5.0 scale, round to nearest integer (Math.round) |
| Read Status | status | Yes | read, currently-reading, to-read, did-not-finish, paused |
| Dates Read | startedDate, completedDate | No | YYYY/MM/DD-YYYY/MM/DD format, parsed as date range |
| Last Date Read | completedDate | No | YYYY-MM-DD format, fallback if Dates Read not available |
| Read Count | *(ignored)* | No | Not parsed (future enhancement) |
| Review | review | No | HTML content, stripped to plain text |

---

### FR-003: Book Matching Algorithm

**Priority**: P0 (Blocker)

**Description**: Match imported records to existing Calibre books using deterministic, tiered algorithm.

**Matching Tiers** (evaluated in order, first match wins):

#### Tier 1: Exact ISBN Match (Confidence: 100%)
- Match on ISBN-13 if available (preferred)
- Fall back to ISBN-10 if ISBN-13 not available
- ISBNs must be cleaned and normalized before comparison
- **Validation**: Verify title similarity >60% (catch ISBN typos)

#### Tier 2: Fuzzy Title + Author Match (Confidence: 85-95%)
- Normalize title and author strings
- Calculate similarity scores
- Accept match if:
  - Title similarity ≥ 90% AND same primary author (exact), OR
  - Title similarity ≥ 95% AND author similarity ≥ 80%

**Normalization Rules:**
```
title = lowercase(removeStopWords(removePunctuation(trim(title))))
stopWords = ["the", "a", "an", "and"]
author = lowercase(trim(author))
```

**Similarity Calculation:**
- Use Levenshtein distance for string comparison
- Similarity % = (1 - distance / max_length) * 100

#### Tier 3: Manual Resolution (Confidence: User-Confirmed)
- No match found → Present for manual review
- Multiple matches with similar scores → User selects correct match
- User options: Select match, Skip entry, Create import note

**Acceptance Criteria:**
- Tier 1 matches require no user intervention
- Tier 2 matches flagged for review if confidence <90%
- All unmatched records presented in review UI
- Match confidence displayed for all matches
- User can override any automatic match

---

### FR-004: Import Preview & Review

**Priority**: P0 (Blocker)

**Description**: Display parsed results before committing to database.

**Acceptance Criteria:**
- Show total records parsed, matched, and unmatched counts
- Group records by match confidence (Exact, High, Medium, Unmatched)
- Display each record with:
  - Import data (title, author, rating, dates)
  - Matched Calibre book (if any) with confidence %
  - Match reason (ISBN, Title/Author, Manual)
  - Actions: Confirm, Change Match, Skip
- Allow bulk actions: Confirm All High Confidence, Skip All Unmatched
- Prevent importing until review complete

**Preview Sections:**
1. **Summary Statistics** (top of page)
   - Total records: {count}
   - Exact matches (100%): {count}
   - High confidence (85-99%): {count}
   - Low confidence (<85%): {count}
   - Unmatched: {count}

2. **Matched Records Table** (collapsible sections by confidence)
   - Columns: Import Title, Import Author, Match Title, Match Author, Confidence, Actions
   - Filterable by confidence level
   - Sortable by title, author, confidence

3. **Unmatched Records Table**
   - Columns: Title, Author, ISBN, Reason, Actions
   - Reason: "No ISBN", "No title/author match", "Multiple ambiguous matches"
   - Actions: Search Manually, Skip

---

### FR-005: Session Creation & History Preservation

**Priority**: P0 (Blocker)

**Description**: Create reading sessions with complete history for matched books.

**Acceptance Criteria:**
- Create separate `ReadingSession` for each read date in import
- Set `sessionNumber` sequentially (check existing sessions)
- Set `status` based on import data (read, currently-reading, to-read)
- Skip "did-not-finish" status (store in unmatched_records for user review)
- Set `startedDate` to null for "to-read", same as completedDate for "read"
- Set `completedDate` from import date
- **Do NOT create progress logs for imported sessions** (imports lack daily reading progression data; progress logs are for tracked reading journeys, not historical records)
- Handle re-reads: increment sessionNumber, archive previous sessions
- Link imported review to session
- Sync rating to book record (not session)

**Session Status Mapping:**

| Import Status | Tome Status | startedDate | completedDate | Progress Logs Created? | Notes |
|--------------|-------------|-------------|---------------|----------------------|-------|
| read | read | completedDate | completedDate | **No** | Session completion date preserved; no progress logs (imports lack daily tracking data) |
| currently-reading | reading | today | null | **No** | Active reading session; user can track progress going forward |
| to-read | to-read | null | null | **No** | Not started |
| did-not-finish | *(skipped)* | - | - | - | Stored in unmatched_records with reason 'dnf_not_supported' |
| paused | reading | null | null | **No** | Treated as active reading session |

**Multi-Read Handling:**
- If readCount > 1 or multiple dates provided:
  - Create N sessions with sequential sessionNumbers
  - Only most recent session set to isActive=true
  - Older sessions archived (isActive=false)
- Single date: Create one session with sessionNumber = existing + 1

---

### FR-006: Rating & Review Import

**Priority**: P1 (High)

**Description**: Import ratings and reviews, syncing ratings to Calibre.

**Acceptance Criteria:**
- Set `books.rating` to imported rating (0-5 scale, null if 0)
- Sync rating to Calibre via `updateCalibreRating()` (best effort)
- Store review text in `readingSessions.review`
- Strip HTML tags from TheStoryGraph reviews (plain text only)
- Skip rating sync if Calibre unavailable (log warning, continue import)

**Rating Conversion:**
- Goodreads: 0-5 → 0-5 (direct mapping, no conversion needed)
- TheStoryGraph: 0.0-5.0 → Round to nearest integer (0-5)
  - Algorithm: `Math.round(storyGraphRating)`
  - Examples: 
    - 4.25 → 4
    - 4.5 → 5 (rounds up at .5 threshold)
    - 4.75 → 5
    - 3.4 → 3
  - Note: 0 rating (unrated) remains 0, stored as null in database

---

### FR-007: Duplicate Detection & Idempotency

**Priority**: P1 (High)

**Description**: Prevent duplicate sessions on re-import of same CSV.

**Acceptance Criteria:**
- Before creating session, check for existing session with:
  - Same bookId
  - Same completedDate (within 1 calendar day, using date comparison without timezone)
  - Same rating (if present)
- If duplicate found: Skip creation, log as "already imported"
- Display skipped records in import summary
- Allow force re-import flag to override duplicate detection

**Duplicate Detection Logic:**
```sql
-- Compare calendar dates (no timezone conversion)
-- julianday() diff < 1.0 means within same day or adjacent day
SELECT id FROM reading_sessions 
WHERE bookId = ? 
  AND status = ?
  AND ABS(julianday(completedDate) - julianday(?)) < 1.0
  AND (rating IS NULL OR rating = ?)
LIMIT 1
```

**Date Storage:**
- All dates stored as ISO 8601 date strings: "YYYY-MM-DD"
- No time component, no timezone (calendar dates only)
- Duplicate detection compares calendar dates (±1 day tolerance)

---

### FR-008: Import Summary & Logging

**Priority**: P1 (High)

**Description**: Provide detailed feedback on import results.

**Acceptance Criteria:**
- Display post-import summary with:
  - Total records processed
  - Sessions created
  - Sessions skipped (duplicates)
  - Ratings synced
  - Calibre sync failures (if any)
  - Unmatched records (count + list)
- Log all import actions with structured logging:
  - Import start/end timestamps
  - File name, size, provider
  - Match statistics
  - Errors and warnings
- Store import log in database (new `import_logs` table)
- Allow exporting unmatched records as CSV for review

---

### FR-009: Error Handling & Recovery

**Priority**: P1 (High)

**Description**: Handle errors gracefully without corrupting data.

**Acceptance Criteria:**
- Validate all data before database writes
- Use database transactions (rollback on error)
- Continue processing after non-fatal errors (log and skip record)
- Fatal errors: Rollback entire import, display error message
- Provide retry mechanism for transient failures
- Never leave partial sessions (either complete or none)

**Error Categories:**

| Error Type | Severity | Action |
|-----------|----------|--------|
| Invalid date format | Warning | Skip date, continue with other fields |
| Invalid ISBN | Warning | Skip ISBN, use title/author matching |
| Missing required field | Error | Skip record, log to unmatched |
| Database constraint violation | Error | Rollback transaction, display error |
| Calibre unavailable | Warning | Continue import, log warning |

---

## 4. Non-Functional Requirements

### NFR-001: Performance

**Description**: Import should complete within reasonable timeframe.

**Acceptance Criteria:**
- Parse and validate 1000 records in <5 seconds
- Match 1000 records against 5000-book library in <30 seconds
- Display preview UI in <2 seconds after processing
- Database insert of 1000 sessions in <10 seconds
- Total end-to-end import (1000 records) in <60 seconds

**Performance Optimizations:**
- Batch database inserts (100 records per transaction)
- Pre-load Calibre book list into memory for matching
- Use indexed queries for ISBN lookups
- Cache fuzzy match calculations

---

### NFR-002: Data Integrity

**Description**: Import must preserve data accuracy and prevent corruption.

**Acceptance Criteria:**
- No data loss during import process
- Atomic transactions (all or nothing per batch)
- Validate temporal consistency (startedDate <= completedDate)
- Validate foreign key relationships (bookId must exist)
- Prevent duplicate sessions within same import
- Log all data transformations for audit trail

---

### NFR-003: Usability

**Description**: Import process should be intuitive and transparent.

**Acceptance Criteria:**
- Single-page workflow (upload → review → confirm)
- Clear progress indicators at each step
- Helpful error messages with actionable guidance
- Preview before commit (no surprises)
- Undo/rollback option after import (within 5 minutes)
- Mobile-responsive UI (desktop-first, mobile-friendly)

---

### NFR-004: Compatibility

**Description**: Support common CSV export formats.

**Acceptance Criteria:**
- Goodreads CSV format (current as of Dec 2024)
- TheStoryGraph CSV format (current as of Dec 2024)
- Handle format variations (column order, extra columns)
- Gracefully skip unknown columns
- Warn on deprecated formats

---

## 5. Data Model

### New Tables

#### import_logs

Stores metadata about each import operation for audit and debugging.

```typescript
{
  id: integer (PK, auto-increment)
  fileName: string
  fileSize: integer (bytes)
  provider: 'goodreads' | 'storygraph'
  totalRecords: integer
  matchedRecords: integer
  unmatchedRecords: integer
  sessionsCreated: integer
  sessionsSkipped: integer
  ratingsSync: integer
  startedAt: timestamp
  completedAt: timestamp
  status: 'success' | 'partial' | 'failed'
  errorMessage: string | null
  userId: integer | null
  createdAt: timestamp
}
```

#### import_unmatched_records

Stores unmatched records for later manual review/matching.

```typescript
{
  id: integer (PK, auto-increment)
  importLogId: integer (FK -> import_logs.id)
  title: string
  authors: string[] (JSON)
  isbn: string | null
  rating: integer | null
  completedDate: timestamp | null
  status: string
  review: string | null
  matchAttempted: boolean
  reason: string // "no_isbn", "no_title_match", "ambiguous", "dnf_not_supported"
  createdAt: timestamp
}
```

---

## 6. API Design

### POST /api/import/upload

**Description**: Upload and validate CSV file with explicit provider selection.

**Request:**
```typescript
Content-Type: multipart/form-data
Body: { 
  file: File,
  provider: 'goodreads' | 'storygraph'
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "importId": "uuid-v4",
  "provider": "goodreads",
  "totalRecords": 234,
  "preview": {
    "exactMatches": 180,
    "highConfidenceMatches": 32,
    "lowConfidenceMatches": 8,
    "unmatchedRecords": 14
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid CSV format",
  "details": "Missing required columns: Date Read, My Rating"
}
```

---

### GET /api/import/:importId/preview

**Description**: Get detailed preview of matched/unmatched records.

**Response (200 OK):**
```json
{
  "success": true,
  "import": {
    "id": "uuid",
    "provider": "goodreads",
    "totalRecords": 234,
    "fileName": "goodreads_export.csv"
  },
  "matches": [
    {
      "id": "match-1",
      "confidence": 100,
      "importData": {
        "title": "Dune",
        "author": "Frank Herbert",
        "isbn13": "9780441013593",
        "rating": 5,
        "completedDate": "2023-05-21",
        "status": "read",
        "review": "Amazing world-building..."
      },
      "matchedBook": {
        "id": 42,
        "calibreId": 123,
        "title": "Dune (Dune #1)",
        "authors": ["Frank Herbert"],
        "totalPages": 883
      },
      "matchReason": "ISBN-13 exact match"
    }
  ],
  "unmatched": [
    {
      "id": "unmatched-1",
      "title": "Obscure Book Title",
      "author": "Unknown Author",
      "reason": "No ISBN and no title/author match in library"
    }
  ]
}
```

---

### POST /api/import/:importId/execute

**Description**: Execute import after user confirms preview.

**Request:**
```json
{
  "confirmedMatches": ["match-1", "match-2"],
  "skipRecords": ["unmatched-1"],
  "forceDuplicates": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "summary": {
    "sessionsCreated": 220,
    "sessionsSkipped": 10,
    "ratingsSync": 215,
    "calibreSyncFailures": 0,
    "unmatchedRecords": 4
  },
  "importLogId": 15
}
```

---

### GET /api/import/:importId/unmatched

**Description**: Retrieve unmatched records for export or manual matching.

**Response (200 OK):**
```json
{
  "success": true,
  "unmatched": [
    {
      "title": "Book Title",
      "authors": ["Author Name"],
      "isbn": null,
      "reason": "no_title_match"
    }
  ]
}
```

---

## 7. UI Design

### Import Workflow (3 Steps)

#### Step 1: File Upload

**Components:**
- Provider selection (required):
  - Radio buttons or dropdown: "Goodreads" / "TheStoryGraph"
  - Help text showing expected columns for each provider
- File input (drag-drop or browse)
- File format guide (link to help docs)
- Size limit indicator (10 MB max)
- Upload button (disabled until provider selected)

**Validation:**
- Provider must be selected before upload
- Real-time file size check
- Validate columns match selected provider format
- Error display for invalid files or column mismatches

---

#### Step 2: Preview & Review

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Import Summary                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 234 total • 212 matched • 22 unmatched  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Matched Records (212)         [Expand All] │
│ ┌─────────────────────────────────────────┐ │
│ │ ✓ Exact Matches (180)                   │ │
│ │   • Dune → Dune (ISBN match) [Confirm] │ │
│ │   • 1984 → 1984 (ISBN match) [Confirm] │ │
│ │                                          │ │
│ │ ⚠ High Confidence (32)                  │ │
│ │   • Book Title → Similar Title (90%)    │ │
│ │     [Confirm] [Change] [Skip]           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Unmatched Records (22)         [Expand]    │
│ ┌─────────────────────────────────────────┐ │
│ │ • Obscure Book (No match found)         │ │
│ │   [Search Manually] [Skip]              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Cancel]              [Confirm Import]     │
└─────────────────────────────────────────────┘
```

**Features:**
- Collapsible sections by match confidence
- Inline actions per record
- Bulk actions (Confirm All, Skip All)
- Search within preview
- Pagination for large imports

---

#### Step 3: Import Summary

**Components:**
- Success message
- Statistics cards:
  - Sessions created
  - Sessions skipped
  - Ratings synced
  - Unmatched records
- Download unmatched CSV button
- View import log link
- Return to library button

---

## 8. Edge Cases & Error Scenarios

### EC-001: Invalid Date Formats

**Scenario**: CSV contains non-standard date formats.

**Handling**:
- Attempt parsing with common formats (YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY)
- If unparseable: Log warning, skip date field, continue import
- Display warning in preview with "No date" indicator

---

### EC-002: Multiple Editions of Same Book

**Scenario**: User's Calibre library has multiple editions (hardcover, ebook, audiobook).

**Handling**:
- ISBN match will find correct edition
- Title/author match may find multiple candidates
- Present all candidates in manual resolution UI
- User selects correct edition or skips

---

### EC-003: Books Not in Calibre Library

**Scenario**: Import contains books not yet added to Calibre.

**Handling**:
- Mark as unmatched with reason "Not in library"
- Store in `import_unmatched_records` table
- Provide export of unmatched titles
- User can add to Calibre, then re-import

---

### EC-004: Duplicate ISBNs in Calibre

**Scenario**: Multiple books in Calibre share same ISBN (rare but possible).

**Handling**:
- Return first match by title similarity
- Log warning about duplicate ISBNs
- Allow manual resolution in review UI

---

### EC-005: Calibre Unavailable During Import

**Scenario**: Calibre database locked or moved during import.

**Handling**:
- Import proceeds without rating sync
- Log warnings for failed syncs
- Display summary: "15 ratings synced, 5 failed"
- Background job retries failed syncs later

---

### EC-006: Extremely Large CSV Files

**Scenario**: User uploads 10,000+ record CSV.

**Handling**:
- Reject files >10 MB at upload
- Suggest splitting into multiple files
- Provide guidance in error message

---

### EC-007: Re-reading with Conflicting Dates

**Scenario**: Import shows read dates 2020, 2023 for same book; existing session shows 2021.

**Handling**:
- Import all three as separate sessions
- Order by completedDate ascending
- Session numbers: 1 (2020), 2 (2021 existing), 3 (2023)
- Most recent session set as active

---

## 9. Testing Strategy

### Unit Tests

- CSV parser with various formats
- ISBN normalization logic
- Title/author similarity calculations
- Date parsing with edge cases
- Rating conversion (Goodreads/TheStoryGraph → Tome)
- Duplicate detection logic

### Integration Tests

- End-to-end import workflow
- Database transaction rollback on error
- Calibre rating sync with mock database
- Session creation with existing sessions
- Unmatched record storage

### User Acceptance Tests

- Import 100-record Goodreads CSV
- Import 100-record TheStoryGraph CSV
- Handle CSV with missing columns
- Review and confirm matches
- Skip unmatched records
- Re-import same CSV (duplicates skipped)

---

## 10. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- CSV parsing library integration
- Data normalization utilities
- Database schema (import_logs, import_unmatched_records)
- File upload API endpoint

### Phase 2: Matching Algorithm (Week 1-2)

- ISBN matching logic
- Fuzzy title/author matching
- Match confidence calculation
- Unmatched record storage

### Phase 3: Import Execution (Week 2)

- Session creation logic
- Duplicate detection
- Rating sync integration
- Transaction management

### Phase 4: UI Implementation (Week 3)

- File upload page
- Preview/review interface
- Manual matching UI
- Import summary page

### Phase 5: Testing & Refinement (Week 3-4)

- Unit test coverage
- Integration testing
- User acceptance testing
- Performance optimization

---

## 11. Open Questions

### Q1: Matching Algorithm Sophistication

**Question**: Should we implement ML-based fuzzy matching or stick with Levenshtein distance?

**Options**:
- **Simple**: Levenshtein distance (faster, deterministic, good enough for 90%+ cases)
- **Complex**: ML similarity model (slower, requires training data, potentially more accurate)

**Recommendation**: Start with Levenshtein, iterate to ML if match rates <85%.

---

### Q2: Unmatched Record Resolution

**Question**: Should users be able to manually match unmatched records after import?

**Options**:
- **Yes**: Provide post-import UI to search and match unmatched records
- **No**: Users must add books to Calibre and re-import

**Recommendation**: Yes (Phase 2 feature) - improves UX significantly.

---

### Q3: Import History & Rollback

**Question**: Should users be able to undo/rollback imports?

**Options**:
- **Full Rollback**: Delete all sessions created by import (complex, requires tracking)
- **No Rollback**: Permanent import, user manually deletes unwanted sessions
- **Time-Limited Rollback**: Allow rollback within 5 minutes of import

**Recommendation**: Time-limited rollback (good balance of safety and complexity).

---

### Q4: Concurrent Imports

**Question**: Should multiple imports be allowed simultaneously?

**Options**:
- **Yes**: Allow parallel imports (complex locking, potential race conditions)
- **No**: Queue imports, process one at a time

**Recommendation**: No - queue imports for simplicity and data integrity.

---

## 12. Success Metrics

### Primary Metrics

- **Match Rate**: >90% of records matched automatically (Tier 1 + Tier 2)
- **Import Speed**: 1000 records processed in <60 seconds
- **Data Integrity**: 0% data loss or corruption
- **User Satisfaction**: >80% users successfully import on first attempt

### Secondary Metrics

- **False Positive Rate**: <5% incorrect automatic matches
- **Manual Review Time**: <30 seconds per unmatched record
- **Duplicate Detection Accuracy**: 100% duplicates caught
- **Calibre Sync Success**: >95% ratings synced successfully

---

## 13. Dependencies

### Internal Dependencies

- Calibre database access (read-only, existing)
- Repository pattern (bookRepository, sessionRepository, progressRepository)
- Rating sync service (updateCalibreRating, existing)
- Drizzle ORM and migrations

### External Dependencies

- CSV parsing library (Papa Parse or similar)
- String similarity library (fastest-levenshtein or similar)
- File upload handling (Next.js built-in or multer)

---

## 14. Risks & Mitigations

### Risk 1: Low Match Rates

**Risk**: Matching algorithm fails to find >10% of books.

**Likelihood**: Medium  
**Impact**: High  

**Mitigation**:
- Extensive testing with real export files
- Tunable match thresholds
- Clear manual resolution UI
- Provide CSV of unmatched for offline review

---

### Risk 2: Data Corruption

**Risk**: Import creates invalid sessions or duplicate data.

**Likelihood**: Low  
**Impact**: Critical  

**Mitigation**:
- Comprehensive validation before database writes
- Database transactions with rollback
- Extensive integration testing
- Time-limited rollback feature

---

### Risk 3: Performance Degradation

**Risk**: Large imports (1000+ records) timeout or crash.

**Likelihood**: Medium  
**Impact**: Medium  

**Mitigation**:
- Batch processing (100 records per transaction)
- Progress indicators and async processing
- File size limits (10 MB max)
- Performance testing with large datasets

---

### Risk 4: Format Changes

**Risk**: Goodreads/TheStoryGraph change CSV format.

**Likelihood**: Low  
**Impact**: High  

**Mitigation**:
- Version detection in CSV parser
- Graceful degradation for unknown columns
- Clear error messages for unsupported formats
- Community-driven format updates

---

## 15. Alternatives Considered

### Alternative 1: API Integration

**Description**: Direct API integration with Goodreads/TheStoryGraph instead of CSV.

**Pros**:
- Real-time sync
- No file upload required
- Automatic format handling

**Cons**:
- Goodreads deprecated public API (2020)
- TheStoryGraph no public API
- Adds external service dependency (violates Constitution)
- Requires OAuth and user authentication

**Decision**: Rejected - CSV export is universal, no API dependencies.

---

### Alternative 2: Automatic Book Creation

**Description**: Automatically create books in Calibre if not found.

**Pros**:
- 100% match rate
- No unmatched records
- Seamless user experience

**Cons**:
- Violates Constitution principle "Respect Calibre as Source of Truth"
- Calibre metadata quality issues
- Duplicate books with different metadata
- Not Tome's responsibility

**Decision**: Rejected - Users must add books to Calibre first.

---

### Alternative 3: No Preview/Review Step

**Description**: Automatically import all matches without user review.

**Pros**:
- Faster workflow
- Simpler UI

**Cons**:
- No chance to catch incorrect matches
- User loses control
- Higher risk of bad data
- Violates usability principles

**Decision**: Rejected - Preview essential for data integrity and user trust.

---

## 16. Constitutional Compliance

### Principle I: Protect User Data Above All

**Compliance**: ✅
- Preview before commit prevents bad data
- Transaction rollback on errors
- Duplicate detection prevents data duplication
- No deletion of existing data

### Principle II: Respect Calibre as Source of Truth

**Compliance**: ✅
- No book creation in Calibre
- Only rating writes to Calibre (existing pattern)
- Read-only access to book metadata
- Unmatched books must be added to Calibre first

### Principle III: Preserve Complete History

**Compliance**: ✅
- Imports create new sessions, never overwrite
- Multiple read dates create multiple sessions
- Reviews preserved per session
- Import logs stored permanently

### Principle IV: Make Complexity Invisible

**Compliance**: ✅
- Single-page workflow
- Automatic format detection
- Clear match confidence indicators
- Sensible defaults with manual overrides

### Principle V: Trust but Verify

**Compliance**: ✅
- Extensive validation at each step
- Structured logging for all operations
- Integration tests with real databases
- Match confidence scoring for transparency

---

## 17. Appendix

### Appendix A: Sample CSV Structures

#### Goodreads CSV (Abbreviated)

```csv
Book Id,Title,Author,ISBN13,My Rating,Date Read,Exclusive Shelf
43419431,Dune,Frank Herbert,9780441172719,5,2023/05/21,read
40097951,The Silent Patient,Alex Michaelides,9781250301697,5,2023/05/09,read
```

#### TheStoryGraph CSV (Abbreviated)

```csv
Title,Authors,ISBN/UID,Star Rating,Read Status,Last Date Read,Dates Read
Dune,Frank Herbert,9780593098233,5.0,read,2023-05-21,2023-05-09-2023-05-21
The Silent Patient,Alex Michaelides,9781250301697,5.0,read,2023-05-09,2023-04-20-2023-05-09
```

---

### Appendix B: Glossary

- **Session**: A single read-through of a book (supports re-reading)
- **Match Confidence**: Percentage indicating likelihood of correct book match
- **ISBN-10/13**: International Standard Book Numbers (unique identifiers)
- **Levenshtein Distance**: Edit distance between two strings
- **Idempotency**: Ability to perform same operation multiple times with same result

---

**End of Specification**
