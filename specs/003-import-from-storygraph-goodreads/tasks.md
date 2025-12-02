# Tasks: Import Books from TheStoryGraph & Goodreads

**Feature**: 003-import-from-storygraph-goodreads  
**Date**: 2025-12-01  
**Status**: Ready for Implementation

**Input**: Design documents from `/specs/003-import-from-storygraph-goodreads/`
- spec.md (user stories with priorities)
- plan.md (tech stack, architecture)
- data-model.md (schema, entities, migrations)
- contracts/import-api.openapi.yaml (API specs)
- research.md (algorithm decisions, library choices)
- quickstart.md (developer guide)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

**Tests**: Not explicitly requested in spec.md - test tasks omitted per guidelines.

---

## Task Format

**Pattern**: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Parallelizable (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3, US4)
- File paths are absolute from repo root

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create project structure and install dependencies

- [ ] T001 Install NPM dependencies: csv-parse (v5.5.6), fastest-levenshtein (v1.0.16), and string-strip-html (v13.4.8) in package.json
- [ ] T002 [P] Create directory structure: data/temp-imports/ for CSV uploads
- [ ] T003 [P] Add .gitignore entry for data/temp-imports/*.csv (ignore uploaded CSV files)
- [ ] T004 [P] Create lib/utils/ directory for utility functions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

⚠️ **CRITICAL**: No user story work can begin until this phase is complete

### Database Schema & Migrations

- [ ] T005 Create Drizzle schema: lib/db/schema/import-logs.ts (importLogs table definition per data-model.md)
- [ ] T006 Create Drizzle schema: lib/db/schema/import-unmatched-records.ts (importUnmatchedRecords table definition)
- [ ] T007 Update schema index: lib/db/schema/index.ts (export new import-logs and import-unmatched-records schemas)
- [ ] T008 Generate migration: Run `bun run drizzle-kit generate` to create 0010_add_import_logs_table.sql
- [ ] T009 Generate migration: Run `bun run drizzle-kit generate` to create 0011_add_import_unmatched_records_table.sql
- [ ] T010 Apply migrations: Run `bun run drizzle-kit migrate` to create tables in data/tome.db
- [ ] T011 Add duplicate detection index: Create migration 0012_add_duplicate_check_index.sql with `CREATE INDEX idx_sessions_duplicate_check ON reading_sessions(bookId, completedDate, status);`

### Repository Layer

- [ ] T012 [P] Create ImportLogRepository: lib/repositories/import-log.repository.ts (extends BaseRepository, implements findByUserId, findFailed, updateStats, complete methods)
- [ ] T013 [P] Create UnmatchedRecordRepository: lib/repositories/unmatched-record.repository.ts (extends BaseRepository, implements findByImportLogId, bulkCreate, searchByTitle methods)

### Utility Functions

- [ ] T014 [P] Create ISBN normalizer: lib/utils/isbn-normalizer.ts (normalizeISBN function to clean Excel wrappers, validate format, convert ISBN-10 to ISBN-13)
- [ ] T015 [P] Create string similarity utilities: lib/utils/string-similarity.ts (cosineSimilarity with word bigrams, levenshteinDistance wrapper for fastest-levenshtein)
- [ ] T016 [P] Create date parser: lib/utils/date-parser.ts (parseFlexibleDate function supporting YYYY/MM/DD, YYYY-MM-DD, MM/DD/YYYY formats)
- [ ] T017 [P] Create string normalizer: lib/utils/string-normalizer.ts (normalizeTitle, normalizeAuthor, removeStopwords, extractPrimaryTitle functions)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - CSV Upload & Validation (P0 - Blocker) 🎯 MVP

**Goal**: Accept CSV files with explicit provider selection, validate format, and provide clear error messages

**Maps to**: FR-001 (File Upload & Validation), FR-002 (Data Normalization)

**Independent Test**: Upload valid/invalid Goodreads and TheStoryGraph CSVs, verify validation errors

### Implementation

- [ ] T018 [P] [US1] Create CSV parser service: lib/services/csv-parser.service.ts (parseCSV, validateProvider, normalizeRecord methods using csv-parse)
- [ ] T019 [P] [US1] Create provider validation schemas: lib/schemas/csv-provider.schema.ts (Zod schemas for Goodreads and TheStoryGraph required columns)
- [ ] T020 [US1] Implement Goodreads parser: Add parseGoodreadsRow method to csv-parser.service.ts (map columns per spec.md FR-002 Goodreads table)
- [ ] T021 [US1] Implement TheStoryGraph parser: Add parseStoryGraphRow method to csv-parser.service.ts (map columns per spec.md FR-002 TheStoryGraph table, skip "did-not-finish" status records, strip HTML from review field using string-strip-html)
- [ ] T022 [US1] Create file upload API route: app/api/import/upload/route.ts (POST handler with multipart/form-data, file size validation 10MB, provider parameter)
- [ ] T023 [US1] Add upload validation: Implement file type check (CSV only), size limit enforcement, provider selection validation in upload/route.ts
- [ ] T024 [US1] Add error responses: Implement user-friendly error handling for invalid CSV, missing columns, empty file, provider mismatch in upload/route.ts (use actionable error messages per spec.md FR-001 Error Conditions)

**Checkpoint**: US1 complete - CSV files can be uploaded, validated, and parsed

---

## Phase 4: User Story 2 - Book Matching Algorithm (P0 - Blocker)

**Goal**: Match imported records to existing Calibre books using ISBN + fuzzy matching with confidence scores

**Maps to**: FR-003 (Book Matching Algorithm)

**Independent Test**: Import records with known ISBNs, titles with typos, and unmatched books; verify confidence scores

### Implementation

- [ ] T025 [P] [US2] Create book matcher service: lib/services/book-matcher.service.ts (matchRecords, matchByISBN, fuzzyMatch, calculateConfidence methods)
- [ ] T026 [US2] Implement ISBN matching (Tier 1): Add matchByISBN method using normalized ISBN-13 lookup with title similarity validation (>60%)
- [ ] T027 [US2] Implement cosine similarity matching (Tier 2): Add cosineSimilarity method using word bigrams from string-similarity.ts (threshold ≥85%)
- [ ] T028 [US2] Implement Levenshtein fallback matching: Add levenshteinMatch method for typo handling (threshold ≥70%) in book-matcher.service.ts
- [ ] T029 [US2] Build library cache: Add buildLibraryCache method to precompute normalized titles and bigram vectors for all Calibre books
- [ ] T030 [US2] Add confidence classification: Implement classifyMatch method to categorize scores (Exact 95-100%, High 85-94%, Medium 70-84%, Unmatched <70%)
- [ ] T031 [US2] Integrate matching into upload flow: Call bookMatcherService.matchRecords in app/api/import/upload/route.ts after CSV parsing

**Checkpoint**: US2 complete - Books can be matched with confidence scores and match reasons

---

## Phase 5: User Story 3 - Import Preview & Review (P0 - Blocker)

**Goal**: Display parsed results with match confidence before committing, allow user to review and confirm/skip records

**Maps to**: FR-004 (Import Preview & Review)

**Independent Test**: Upload CSV, retrieve preview, verify match groupings and statistics

### Implementation

- [ ] T032 [P] [US3] Create import cache service: lib/services/import-cache.service.ts (store parsed results in memory with importId, TTL 30 minutes)
- [ ] T033 [P] [US3] Create preview response builder: lib/services/preview-builder.service.ts (buildPreviewResponse, groupMatchesByConfidence methods)
- [ ] T034 [US3] Store import metadata: Update app/api/import/upload/route.ts to create importLog record with status='pending'
- [ ] T035 [US3] Cache match results: Store matched/unmatched records in import-cache.service.ts keyed by importId
- [ ] T036 [US3] Create preview API route: app/api/import/[importId]/preview/route.ts (GET handler returning detailed matches per OpenAPI spec)
- [ ] T037 [US3] Implement pagination: Add limit/offset query parameters to preview route (default limit=500, max=1000)
- [ ] T038 [US3] Add confidence filtering: Implement confidenceFilter query parameter to filter by exact/high/medium/low/unmatched
- [ ] T039 [US3] Build match preview response: Format matches with importData, matchedBook, matchReason, willCreateSession, isDuplicate fields

**Checkpoint**: US3 complete - Users can review detailed preview of matches before executing import

---

## Phase 6: User Story 4 - Session Creation & History Preservation (P0 - Blocker)

**Goal**: Create reading sessions with complete history, handle re-reads, sync ratings, detect duplicates

**Maps to**: FR-005 (Session Creation), FR-006 (Rating & Review Import), FR-007 (Duplicate Detection)

**Independent Test**: Execute import with various scenarios (single read, re-read, duplicate, no date); verify sessions created correctly

### Implementation

- [ ] T040 [P] [US4] Create session importer service: lib/services/session-importer.service.ts (createSessions, detectDuplicates, handleReReads methods)
- [ ] T041 [US4] Implement duplicate detection: Add findDuplicate method to lib/repositories/session.repository.ts (SQL query with 24-hour tolerance per research.md)
- [ ] T042 [US4] Create session creation logic: Implement createSession method with status mapping (read, currently-reading, to-read), skip "did-not-finish" records to unmatched, sessionNumber increment
- [ ] T043 [US4] Handle re-reads: Add handleMultipleReadDates method to create N sessions with sequential sessionNumbers, archive old sessions (isActive=false)
- [ ] T044 [US4] Create progress logs: Add createProgressLog method to create 100% progress entry for each "read" session in session-importer.service.ts
- [ ] T045 [US4] Implement rating sync: Add syncRating method to update books.rating and call updateCalibreRating() (best-effort, log failures)
- [ ] T046 [US4] Create execute API route: app/api/import/[importId]/execute/route.ts (POST handler with transaction-based batch processing per OpenAPI spec)
- [ ] T047 [US4] Implement batch processing: Process confirmedMatches in 100-record transaction batches to prevent timeouts
- [ ] T048 [US4] Add transaction rollback: Wrap session/rating/progress creation in db.transaction with error handling and rollback
- [ ] T049 [US4] Store unmatched records: Bulk insert skipRecords into import_unmatched_records table using unmatchedRecordRepository.bulkCreate
- [ ] T050 [US4] Update import log: Set status='success'/'partial'/'failed', completedAt, sessionsCreated, sessionsSkipped, ratingsSync statistics
- [ ] T051 [US4] Add execution summary: Return ExecuteResponse with summary statistics per OpenAPI spec

**Checkpoint**: US4 complete - Full end-to-end import workflow functional (upload → preview → execute → sessions created)

---

## Phase 7: Supporting Story - Unmatched Record Export (P1 - High Priority)

**Goal**: Allow users to export unmatched records as CSV for manual review and re-import after adding to Calibre

**Maps to**: FR-008 (Import Summary & Logging) - unmatched export feature

**Independent Test**: Execute import with unmatched records, retrieve via API in JSON and CSV formats

### Implementation

- [ ] T052 [P] [SU1] Create unmatched API route: app/api/import/[importId]/unmatched/route.ts (GET handler returning unmatched records per OpenAPI spec)
- [ ] T053 [SU1] Implement JSON response: Query import_unmatched_records by importLogId, return UnmatchedResponse schema
- [ ] T054 [SU1] Implement CSV export: Add format=csv query parameter to return unmatched records as text/csv with proper headers
- [ ] T055 [SU1] Add filtering by reason: Implement optional reason query parameter to filter by no_isbn, isbn_not_found, no_title_match, etc.

**Checkpoint**: Unmatched records feature complete - Users can export and review unmatched books

---

## Phase 8: Supporting Story - Import Logging & Debugging (P1 - High Priority)

**Goal**: Provide structured logging for all import operations and store audit trail in database

**Maps to**: FR-008 (Import Summary & Logging), FR-009 (Error Handling & Recovery)

**Independent Test**: Execute imports with various outcomes (success, partial, failed), verify logs contain detailed info

### Implementation

- [ ] T056 [P] [SU2] Add import start logging: Log import start with { fileName, fileSize, provider, importId } in app/api/import/upload/route.ts using pino logger
- [ ] T057 [P] [SU2] Add matching statistics logging: Log match results with { exactMatches, highConfidence, lowConfidence, unmatched } in book-matcher.service.ts
- [ ] T058 [P] [SU2] Add execution logging: Log session creation with { sessionsCreated, sessionsSkipped, duplicatesFound } in session-importer.service.ts
- [ ] T059 [P] [SU2] Add error logging: Log all errors with structured context (importId, step, errorMessage, stack) using logger.error
- [ ] T060 [SU2] Add warning logging for Calibre sync failures: Use logger.warn with { calibreId, error } when updateCalibreRating fails (non-fatal)
- [ ] T061 [SU2] Add completion logging: Log import complete with { status, totalTimeMs, importLogId } in execute route

**Checkpoint**: Logging complete - All import operations have detailed structured logs

---

## Phase 9: Supporting Story - Duplicate Prevention & Idempotency (P1 - High Priority)

**Goal**: Allow users to re-import same CSV multiple times without creating duplicate sessions

**Maps to**: FR-007 (Duplicate Detection & Idempotency)

**Independent Test**: Import CSV, verify sessions created; re-import same CSV, verify sessions skipped with count in summary

### Implementation

- [ ] T062 [US4-EXT] Enhance duplicate detection: Update findDuplicate in session.repository.ts to check bookId + completedDate (±24h) + status + rating match
- [ ] T063 [US4-EXT] Add forceDuplicates flag: Implement forceDuplicates option in execute request to override duplicate detection
- [ ] T064 [US4-EXT] Track skipped sessions: Increment sessionsSkipped counter in import log when duplicates detected
- [ ] T065 [US4-EXT] Add duplicate indicator to preview: Set isDuplicate=true in MatchPreview when existing session found

**Checkpoint**: Idempotency complete - Re-importing CSV skips duplicates safely

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements, documentation, and production readiness

- [ ] T066 [P] Add environment variables: Document MAX_IMPORT_FILE_SIZE, IMPORT_BATCH_SIZE, MATCH_CONFIDENCE_THRESHOLD in .env.example
- [ ] T067 [P] Create import UI page (basic): app/import/page.tsx with provider selection, file upload form, basic preview display (optional - can be Phase 2)
- [ ] T068 [P] Add import cleanup cron: Create background job to delete temp CSVs older than 24 hours from data/temp-imports/
- [ ] T069 [P] Add database indexes verification: Verify idx_sessions_duplicate_check, idx_import_logs_user_created, idx_unmatched_import_log exist
- [ ] T070 Performance optimization: Add library cache warm-up on first import request to reduce initial matching latency
- [ ] T071 [P] Code cleanup: Remove any console.log statements, ensure all errors use structured logging
- [ ] T072 [P] Security review: Verify file upload limits, CSV injection prevention, SQL injection safety via Drizzle ORM
- [ ] T073 Validate quickstart.md: Run through developer setup steps in quickstart.md to verify accuracy

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL USER STORIES
    ↓
Phase 3 (US1: CSV Upload) ←┐
    ↓                       ├─ Can run in parallel after Phase 2
Phase 4 (US2: Matching)    │
    ↓                       │
Phase 5 (US3: Preview)     │
    ↓                       │
Phase 6 (US4: Execute)     │
    ↓                       │
Phase 7 (Export)           │
    ↓                       │
Phase 8 (Logging)          │
    ↓                       │
Phase 9 (Idempotency)      ┘
    ↓
Phase 10 (Polish)
```

### Critical Path (MVP - Minimum Viable Product)

**MVP Scope**: Phases 1-6 (Setup → Foundational → US1 → US2 → US3 → US4)

**MVP Delivers**: Complete import workflow from upload to session creation

1. T001-T004 (Setup)
2. T005-T017 (Foundational - BLOCKING)
3. T018-T024 (US1 - CSV Upload)
4. T025-T031 (US2 - Matching)
5. T032-T039 (US3 - Preview)
6. T040-T051 (US4 - Execute)

**Post-MVP**: Phases 7-10 can be added incrementally

### User Story Dependencies

- **US1 (CSV Upload)**: Depends on Foundational (T005-T017)
- **US2 (Matching)**: Depends on US1 (requires parsed CSV data)
- **US3 (Preview)**: Depends on US1 + US2 (requires parsed + matched data)
- **US4 (Execute)**: Depends on US1 + US2 + US3 (requires confirmed matches)
- **Supporting Stories**: Can start after US4 complete

### Within-Phase Dependencies

**Phase 2 (Foundational)**:
- T005-T007 (schemas) → T008-T010 (migrations) → T011 (indexes)
- T012-T013 (repositories) can run in parallel with schemas
- T014-T017 (utilities) can run in parallel with schemas

**Phase 3 (US1)**:
- T018-T019 (parser + schemas) can run in parallel
- T020-T021 (provider parsers) depend on T018
- T022-T024 (API route) depend on T018-T021

**Phase 4 (US2)**:
- T025 (matcher service) → T026-T030 (matching methods) → T031 (integration)
- T026-T030 can run in parallel after T025

**Phase 6 (US4)**:
- T040 (session importer) → T042-T045 (creation logic)
- T041 (duplicate detection) can run in parallel with T040
- T046-T051 (execute route) depends on T040-T045

### Parallel Opportunities

**Phase 2 Parallel Tasks** (after schemas complete):
```bash
# Can run simultaneously:
T012 [P] ImportLogRepository
T013 [P] UnmatchedRecordRepository
T014 [P] ISBN normalizer
T015 [P] String similarity
T016 [P] Date parser
T017 [P] String normalizer
```

**Phase 3 Parallel Tasks** (independent files):
```bash
T018 [P] CSV parser service
T019 [P] Provider schemas
```

**Phase 4 Parallel Tasks** (independent methods):
```bash
T026-T030 # All matching methods after service created
```

**Phase 8 Parallel Tasks** (independent logging points):
```bash
T056 [P] Start logging
T057 [P] Match statistics
T058 [P] Execution logging
T059 [P] Error logging
```

---

## Implementation Strategy

### MVP First (Phases 1-6 Only)

Recommended for fastest value delivery:

1. Complete **Phase 1** (Setup) - 4 tasks
2. Complete **Phase 2** (Foundational) - 13 tasks ← CRITICAL BLOCKER
3. Complete **Phase 3** (US1 - Upload) - 7 tasks
4. Complete **Phase 4** (US2 - Matching) - 7 tasks
5. Complete **Phase 5** (US3 - Preview) - 8 tasks
6. Complete **Phase 6** (US4 - Execute) - 12 tasks

**STOP and VALIDATE**: Test full workflow (upload → preview → execute)

**MVP Total**: 51 tasks

### Incremental Delivery After MVP

After MVP validated, add features incrementally:

7. Add **Phase 7** (Unmatched Export) - 4 tasks → Deploy
8. Add **Phase 8** (Logging) - 6 tasks → Deploy
9. Add **Phase 9** (Idempotency) - 4 tasks → Deploy
10. Add **Phase 10** (Polish) - 8 tasks → Final release

### Parallel Team Strategy

With 2+ developers:

**Developer A**: Phases 1-2 (Setup + Foundation)
**WAIT for Phase 2 completion** ← CRITICAL GATE

Then split:
- **Developer A**: Phase 3 (US1) → Phase 4 (US2)
- **Developer B**: Phase 5 (US3) → Phase 6 (US4) ← Depends on A finishing US2

After MVP:
- **Developer A**: Phase 7 + 8 (Export + Logging)
- **Developer B**: Phase 9 + 10 (Idempotency + Polish)

---

## Validation Checkpoints

### After Phase 2 (Foundation)
- [ ] Verify migrations applied: `sqlite3 data/tome.db ".schema import_logs"`
- [ ] Verify tables exist: `import_logs`, `import_unmatched_records`
- [ ] Verify indexes exist: `idx_sessions_duplicate_check`
- [ ] Verify repositories instantiate: `new ImportLogRepository()`

### After Phase 3 (US1 - CSV Upload)
- [ ] Upload valid Goodreads CSV → returns 200 with importId
- [ ] Upload invalid CSV → returns 400 with clear error
- [ ] Upload oversized file (>10MB) → returns 413
- [ ] Verify provider validation: wrong columns → error

### After Phase 4 (US2 - Matching)
- [ ] Book with ISBN matches at 100% confidence
- [ ] Book without ISBN matches via fuzzy title/author (85%+)
- [ ] Book with typo matches via Levenshtein fallback (70-84%)
- [ ] Unknown book marked as unmatched with reason

### After Phase 5 (US3 - Preview)
- [ ] GET /api/import/:id/preview returns all matches
- [ ] Matches grouped by confidence (exact/high/medium/low)
- [ ] Pagination works (limit/offset parameters)
- [ ] Unmatched records included with reasons

### After Phase 6 (US4 - Execute)
- [ ] Execute creates reading_sessions records
- [ ] Progress logs created at 100% for "read" status
- [ ] Book ratings updated and synced to Calibre
- [ ] Duplicate sessions skipped (sessionsSkipped count)
- [ ] Import log updated with final status and statistics

### After Phase 9 (Idempotency)
- [ ] Re-import same CSV skips all duplicates
- [ ] Summary shows sessionsSkipped = original sessionsCreated
- [ ] No duplicate sessions in database

---

## Notes

- **[P] tasks**: Different files, can run in parallel
- **[Story] labels**: Map tasks to user stories for traceability
- **Dependencies**: Follow critical path for MVP, add features incrementally
- **Testing**: Tests not included per spec (no explicit test requirements)
- **Commit strategy**: Commit after each completed task or logical group
- **Validation**: Stop at checkpoints to test independently before proceeding

**Total Tasks**: 73 (51 MVP + 22 Post-MVP)

**MVP Estimate**: 51 tasks × 2-4 hours = 100-200 hours (2-4 weeks for 1 developer)

---

**End of Task Breakdown**
