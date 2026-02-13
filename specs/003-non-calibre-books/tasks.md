# Implementation Tasks: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document breaks down the multi-source book tracking feature into executable tasks organized by user story. Each phase represents an independently testable increment of functionality.

**Total Tasks**: 93 (was 77 — Phase C1 added for cover support, see Cover Image Revision below)  
**Implementation Approach**: Incremental delivery by priority (P1 → P2 → P3)  
**MVP Scope**: User Story 1 + User Story 2 (P1 stories - manual books with sync isolation)

### Architectural Revision (2026-02-13): Source vs. Metadata Provider Separation

The original spec treated Hardcover and OpenLibrary as "sources" alongside Calibre and Manual. After analysis, this conflates two distinct concepts:

- **Sources** (book ownership): Where the book record is owned/managed. `calibre` (synced from Calibre DB) and `manual` (user-created in Tome). Future: `audiobookshelf`, etc.
- **Metadata Providers** (search tools): APIs used to populate metadata when creating a manual book. `hardcover` and `openlibrary`. Completely ephemeral — no trace on the book record after creation.

**Key changes:**
1. `BookSource` type narrowed from `"calibre" | "manual" | "hardcover" | "openlibrary"` to `"calibre" | "manual"`
2. New `ProviderId` type introduced for provider infrastructure: `"calibre" | "manual" | "hardcover" | "openlibrary"`
3. `externalId` column removed from books table — no provider tracking on book records
4. Books added via federated search get `source='manual'` (they always did in practice — the service hardcoded this)
5. Phase 6 (Source Migration) eliminated entirely — was solving a problem that doesn't exist with the corrected model
6. Dedup during search uses ISBN + fuzzy title/author matching (existing duplicate detection service)

### Cover Image Revision (2026-02-13): Local Filesystem Storage

The original data model included a `coverImageUrl` column for storing external provider URLs. This was never implemented and has been replaced with a local filesystem approach:

- **No schema column**: Cover images stored at `./data/covers/{bookId}.{ext}`, not in the database
- **Provider search**: Cover URLs from Hardcover/OpenLibrary downloaded to local storage at book creation time
- **Manual upload**: Users can upload cover images via `POST /api/books/{id}/cover`
- **Unified API**: `GET /api/books/{id}/cover` serves covers for all books (manual local files, Calibre library files)
- **Graceful fallback**: Download failures don't block book creation; fallback to `cover-fallback.png`

---

## Task Summary by Phase

| Phase | User Story | Priority | Task Count | Status |
|-------|------------|----------|------------|--------|
| 1 | Setup | - | 8 | ✅ Complete (8/8) |
| 2 | Foundational | - | 12 | ✅ Complete (12/12) |
| 3 | Manual Book Addition | P1 | 18 | ✅ Complete (18/18) |
| 4 | Library Sync Isolation | P1 | 9 | ✅ Code Complete (5/9) - Needs formal tests |
| 5 | Source-Based Filtering | P2 | 8 | ✅ Complete (8/8) |
| ~~6~~ | ~~Source Migration & Duplicates~~ | ~~P2~~ | ~~12~~ | ❌ CANCELLED — See Architectural Revision |
| 7 | Federated Search | P3 | 16 | 🟡 Partial (11/16) |
| 8 | Polish & Cross-Cutting | - | 6 | ✅ Complete (6/6) |
| C1 | Cover Image Support | P2 | 16 | ❌ Not Started (0/16) |
| R1 | Source/Provider Refactor | - | 12 | ❌ Not Started (0/12) |

**Overall Progress**: 68/93 tasks code-complete (73%), 64/93 fully tested (69%)

---

## Phase 1: Setup (Infrastructure)

**Goal**: Establish database schema, migrations, and core provider infrastructure

**Prerequisites**: None (starting point)

### Database Schema & Migrations

- [X] T001 Generate Drizzle schema migration for books table (add source, externalId, make calibreId nullable) in drizzle/0022_nappy_spectrum.sql
- [X] T002 Create provider_configs schema in lib/db/schema/provider-configs.ts
- [X] T003 Create companion migration to populate source='calibre' for existing books in lib/migrations/0022_seed_provider_configs.ts
- [X] T004 Update books schema exports in lib/db/schema/books.ts (add source, externalId fields with enums and indexes)
- [X] T005 Seed provider_configs table with default Hardcover and OpenLibrary configs in migration

### Provider Architecture Foundation

- [X] T006 [P] Create IMetadataProvider interface with capability flags in lib/providers/base/IMetadataProvider.ts
- [X] T007 [P] Implement ProviderRegistry for provider discovery and registration in lib/providers/base/ProviderRegistry.ts
- [X] T008 [P] Create provider types and shared utilities in lib/providers/base/IMetadataProvider.ts (types integrated with interface)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Goal**: Build core services and repositories that all user stories depend on

**Prerequisites**: Phase 1 complete

### Repository Layer

- [X] T009 [P] Create ProviderConfigRepository with CRUD operations in lib/repositories/provider-config.repository.ts
- [X] T010 [P] Extend BookRepository with source filtering methods (findBySource, findBySourceAndExternalId, countBySource) in lib/repositories/book.repository.ts
- [X] T011 [P] Add source parameter to BookRepository.findWithFilters() in lib/repositories/book.repository.ts
- [X] T012 Update BookRepository.findNotInCalibreIds() to filter by source='calibre' in lib/repositories/book.repository.ts

### Service Layer Foundation

- [X] T013 [P] Create CircuitBreakerService with state machine (CLOSED/OPEN/HALF_OPEN) in lib/services/circuit-breaker.service.ts
- [X] T014 [P] Implement ProviderService for provider orchestration in lib/services/provider.service.ts
- [X] T015 [P] Create MigrationService for source migration workflows in lib/services/migration.service.ts

### Provider Implementations (Stubs)

- [X] T016 [P] Create ManualProvider stub (always enabled, no external API) in lib/providers/manual.provider.ts
- [X] T017 [P] Refactor existing Calibre sync to CalibreProvider implementation in lib/providers/calibre.provider.ts
- [X] T018 [P] Create HardcoverProvider stub with auth handling in lib/providers/hardcover.provider.ts
- [X] T019 [P] Create OpenLibraryProvider stub (public API, no auth) in lib/providers/openlibrary.provider.ts
- [X] T020 Register all providers in ProviderRegistry singleton in lib/providers/base/ProviderRegistry.ts

---

## Phase 3: User Story 1 - Manual Book Addition (P1)

**Goal**: Enable users to manually add books with validation and duplicate warnings

**Independent Test**: Add manual book via UI → log progress → view in library with source badge

**Prerequisites**: Phase 2 complete

### Backend - Manual Book Creation

- [X] T021 [P] [US1] Extend POST /api/books to accept manual book creation (source='manual', no calibreId) in app/api/books/route.ts (Commit: Spec 003 - earlier implementation)
- [X] T022 [P] [US1] Add validation for manual books (title, author, pageCount required, pageCount 1-10000) in lib/services/book.service.ts (Commit: Spec 003 - earlier implementation)
- [X] T023 [US1] Implement duplicate detection service using Levenshtein distance (>85% threshold) in lib/services/duplicate-detection.service.ts (Commit: Spec 003 - earlier implementation)
- [X] T024 [US1] Integrate duplicate check into manual book creation flow (warn but allow proceed) in lib/services/book.service.ts (Commit: Spec 003 - earlier implementation)

### Backend - Validation & Error Handling

- [X] T025 [P] [US1] Create validation schemas for manual book input using Zod in lib/validation/manual-book.schema.ts (Commit: Spec 003 - earlier implementation)
- [X] T026 [P] [US1] Add real-time validation endpoint POST /api/books/validate in app/api/books/validate/route.ts (Commit: Spec 003 - earlier implementation)
- [X] T027 [US1] Implement server-side validation for optional fields (ISBN, publisher, publicationDate, description, coverImageUrl) in lib/validation/manual-book.schema.ts (Commit: Spec 003 - earlier implementation)

### Frontend - Manual Book Form

- [X] T028 [P] [US1] Create ManualBookForm component with required fields in components/Books/ManualBookForm.tsx (Commit: Spec 003 - earlier implementation)
- [X] T029 [P] [US1] Add real-time validation UI with error messages in components/Books/ManualBookForm.tsx (Commit: Spec 003 - earlier implementation)
- [X] T030 [P] [US1] Create DuplicateWarning modal component integrated into ManualBookForm.tsx (Commit: Spec 003 - earlier implementation)
- [X] T031 [US1] Integrate duplicate detection API call on form submission in components/Books/ManualBookForm.tsx (Commit: Spec 003 - earlier implementation)
- [X] T032 [US1] Add "Add Manual Book" button to library page header in app/library/page.tsx (Commit: Spec 003 - earlier implementation)

### Frontend - Source Display

- [X] T033 [P] [US1] Create ProviderBadge component for source indicators in components/Providers/ProviderBadge.tsx (Commit: Spec 003 - earlier implementation)
- [X] T034 [P] [US1] Add source badge to book cards in library view in components/Books/BookCard.tsx (Commit: Spec 003 - earlier implementation)
- [X] T035 [P] [US1] Add source badge to book detail page in app/books/[id]/page.tsx (Commit: Spec 003 - earlier implementation)

### Integration & Verification

- [X] T036 [US1] Update GET /api/books to include source field in response in app/api/books/route.ts (Commit: 1a18141 - Phase 5)
- [X] T037 [US1] Verify manual books support all existing features (progress, sessions, streaks) via existing API routes (Verified: 2026-02-06)
- [X] T038 [US1] Test manual book creation end-to-end (UI → validation → save → display) (Verified: 2026-02-06)

---

## Phase 4: User Story 2 - Library Sync Isolation (P1)

**Goal**: Ensure Calibre sync operations only affect Calibre-sourced books

**Independent Test**: Add manual books → run Calibre sync that removes books → verify manual books untouched

**Prerequisites**: Phase 3 complete (manual books exist to test isolation)

### Calibre Sync Isolation

- [X] T039 [US2] Update syncCalibreLibrary() to filter by source='calibre' in lib/sync-service.ts (Implementation: sync only processes Calibre DB books)
- [X] T040 [US2] Update orphaned book detection to only mark Calibre books in lib/sync-service.ts (Implementation: book.repository.ts:658 filters by source='calibre')
- [X] T041 [US2] Add source='calibre' filter to book creation/update during sync in lib/sync-service.ts (Implementation: line 225 sets source='calibre')
- [X] T042 [US2] Update CalibreProvider to respect source boundaries in lib/providers/calibre.provider.ts (Implementation: uses syncCalibreLibrary + findByCalibreId)

### Testing & Validation

- [ ] T043 [P] [US2] Create integration test: manual book + Calibre sync → verify isolation in __tests__/integration/sync-isolation.test.ts (Code complete, needs formal test)
- [ ] T044 [P] [US2] Create test case: Calibre removes book → only Calibre books orphaned in __tests__/integration/sync-isolation.test.ts (Code complete, needs formal test)
- [ ] T045 [P] [US2] Create test case: Calibre adds book → manual books unchanged in __tests__/integration/sync-isolation.test.ts (Code complete, needs formal test)
- [ ] T046 [P] [US2] Create test case: same title in Calibre + manual → both exist independently in __tests__/integration/sync-isolation.test.ts (Code complete, needs formal test)

### Logging & Observability

- [X] T047 [US2] Add Pino logging for sync operations with source filtering details in lib/sync-service.ts (Implementation: lines 133, 322 log source='calibre')

---

## Phase 5: User Story 3 - Source-Based Filtering (P2)

**Goal**: Allow users to filter library by book source(s)

**Independent Test**: Add books from multiple sources → apply filters → verify correct subset displayed

**Prerequisites**: Phase 4 complete (multiple source types exist)

### Backend - Filtering API

- [x] T048 [P] [US3] Extend GET /api/books to accept source[] query parameter in app/api/books/route.ts (Commit: 1a18141)
- [x] T049 [P] [US3] Update BookRepository.findWithFilters() to handle multi-source filtering in lib/repositories/book.repository.ts (Commit: 1a18141)
- [ ] T050 [US3] Add source counts to stats API GET /api/stats/overview in app/api/stats/overview/route.ts (OPTIONAL - Skip for MVP)

### Frontend - Filter UI

- [x] T051 [P] [US3] Add source filter to LibraryFilters component (multi-select dropdown) in components/Library/LibraryFilters.tsx (Commit: 0e3f49f)
- [x] T052 [P] [US3] Update useLibraryData hook to handle source filters in hooks/useLibraryData.ts (Commit: 0e3f49f)
- [x] T053 [P] [US3] Persist source filter state in URL params in app/library/page.tsx (Commit: 0e3f49f)
- [x] T054 [US3] "Clear All Filters" button already exists and clears sources (Commit: 0e3f49f)

### Performance & Optimization

- [ ] T055 [US3] Verify source filtering performance with 10k book test dataset (target <3s) (OPTIONAL - Defer to post-MVP)

---

## ~~Phase 6: Source Migration & Duplicate Handling~~ — CANCELLED

> **CANCELLED (2026-02-13)**: This entire phase was eliminated as part of the Source vs. Metadata Provider architectural revision. Source migration (manual → hardcover/openlibrary) is unnecessary because books added via provider search are already `source='manual'`. Hardcover and OpenLibrary are metadata providers (search tools), not sources. There is no source to migrate to. See Architectural Revision note at top of file.
>
> All 12 tasks (T056-T067) are cancelled. The `migration.service.ts` file will be deleted as part of Phase R1 (Refactor).

- [x] ~~T056-T067~~ CANCELLED — Source migration concept eliminated

---

## Phase 7: User Story 4 - Federated Metadata Search (P3)

**Goal**: Search multiple external providers simultaneously with graceful degradation

**Independent Test**: Search for book → verify results from multiple providers → select result → book created

**Prerequisites**: Phase 2 complete (provider infrastructure ready)

### Backend - Search Service

- [x] T068 [P] [US4] Implement SearchService.federatedSearch() with Promise.allSettled in lib/services/search.service.ts (Commit: 7088ff5)
- [x] T069 [P] [US4] Add per-provider 5-second timeout using AbortSignal in lib/services/search.service.ts (Commit: 6daf21f)
- [x] T070 [P] [US4] Implement search result caching (5min TTL, invalidate on config change) in lib/services/search.service.ts (Commit: 7088ff5)
- [x] T071 [US4] Add result sorting by hardcoded priority (Hardcover → OpenLibrary) in lib/services/search.service.ts (Commit: 7088ff5)
- [x] T072 [US4] Implement graceful fallback to manual entry on all-provider failure in lib/services/search.service.ts (Commit: 7088ff5)

### Backend - Provider Search Implementation

- [x] T073 [P] [US4] Implement HardcoverProvider.search() with retry logic in lib/providers/hardcover.provider.ts (Commit: 6daf21f)
- [x] T074 [P] [US4] Implement OpenLibraryProvider.search() with error handling in lib/providers/openlibrary.provider.ts (Commit: 6daf21f)
- [ ] T075 [P] [US4] Add rate limit detection and circuit breaker integration in lib/providers/hardcover.provider.ts (OPTIONAL - Defer to post-MVP)
- [x] T076 [US4] Create POST /api/providers/search endpoint for federated search in app/api/providers/search/route.ts (Commit: 7088ff5)

### Backend - Provider Configuration

- [X] T077 [P] [US4] Create GET /api/providers endpoint to list all providers with status in app/api/providers/route.ts (Completed in Phase 8)
- [X] T078 [P] [US4] Create PATCH /api/providers/[providerId]/config for runtime configuration in app/api/providers/[providerId]/config/route.ts (Completed in Phase 8)
- [ ] T079 [US4] Implement provider enable/disable without restart (NFR-005) in lib/services/provider.service.ts (OPTIONAL - Defer to post-MVP)

### Frontend - Search UI

- [x] T080 [P] [US4] Create FederatedSearchModal component with provider results in components/providers/FederatedSearchModal.tsx (Commit: 1d244aa)
- [x] T081 [P] [US4] Add provider badges to search results in components/providers/FederatedSearchModal.tsx (Commit: 1d244aa)
- [x] T082 [P] [US4] Implement editable metadata form after result selection in components/providers/FederatedSearchModal.tsx (Commit: 1d244aa)
- [x] T083 [US4] Add fallback UI when all providers fail/timeout in components/providers/FederatedSearchModal.tsx (Commit: 1d244aa)

### Testing & Performance

- [ ] T084 [US4] Create integration test: federated search with 2 providers < 6 seconds in __tests__/integration/federated-search.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Settings UI, provider health monitoring, documentation

**Prerequisites**: All user stories complete

### Provider Management UI

- [X] T085 [P] Create provider settings page in app/settings/providers/page.tsx
- [X] T086 [P] Add provider enable/disable toggles in components/settings/ProviderToggles.tsx
- [X] T087 [P] Create API key configuration form for Hardcover in components/settings/ProviderCredentials.tsx

### Documentation

- [ ] T088 Update ARCHITECTURE.md with multi-source support details in docs/ARCHITECTURE.md
- [ ] T089 Create ADRs for provider architecture, circuit breakers in docs/ADRs/

---

## Phase C1: Cover Image Support

**Goal**: Enable cover images for manual books via local filesystem storage, provider download, and manual upload. Unify the cover API to serve covers for all book sources.

**Prerequisites**: Phase 3 (Manual Books) and Phase 7 (Federated Search) — covers from provider search require the search flow to exist

**Context**: The original data model specified a `coverImageUrl` database column that was never implemented. Cover images for manual books are instead stored on the local filesystem at `./data/covers/{bookId}.{ext}`. This matches Calibre's filesystem-based approach and aligns with the constitution's self-contained deployment principle. See research.md Section 10 and data-model.md Cover Storage section.

### Backend — Cover Storage Infrastructure

- [ ] TC01 [P] Create cover storage utility (`lib/utils/cover-storage.ts`) with `saveCover(bookId, buffer, ext)`, `getCoverPath(bookId)`, `hasCover(bookId)`, `deleteCover(bookId)`, `ensureCoverDirectory()` functions
- [ ] TC02 [P] Create cover download utility (`lib/utils/cover-download.ts`) — download image from URL, validate MIME type/size, return buffer + content type. 10-second timeout, 5MB max.
- [ ] TC03 Ensure `./data/covers/` directory is created at startup — integrate into preflight checks (`lib/db/preflight-checks.ts`) or entrypoint (`scripts/entrypoint.ts`)

### Backend — Cover API Endpoints

- [ ] TC04 [P] Modify `GET /api/books/[id]/cover` route to accept Tome book ID (not Calibre ID), look up the book, and route to local file (manual) or Calibre library path (calibre). Update caching accordingly.
- [ ] TC05 [P] Create `POST /api/books/[id]/cover` endpoint for manual cover upload — accept multipart form data, validate file type (JPEG/PNG/WebP/GIF) and size (5MB max), save via cover-storage utility
- [ ] TC06 Handle cover deletion when a book is deleted — extend book deletion logic to call `deleteCover(bookId)`

### Backend — Provider Search Cover Download

- [ ] TC07 [P] Extend `book.service.ts` `createManualBook()` to accept `coverImageUrl` from provider payload (pass-through from `FederatedSearchModal`), download cover after successful book creation, save to local storage. Non-blocking — download failure does not fail book creation.
- [ ] TC08 Add `coverImageUrl` as optional field to `manualBookSchema` in `lib/validation/manual-book.schema.ts` — validated as URL string, used only for provider download trigger (not stored in DB)

### Frontend — Unified Cover Display

- [ ] TC09 [P] Update `getCoverUrl()` utility (`lib/utils/cover-url.ts`) to generate URLs using Tome book ID instead of Calibre ID: `/api/books/{bookId}/cover?t={timestamp}`. Accept `bookId: number` and `updatedAt?: Date | string | null`.
- [ ] TC10 [P] Update all frontend components that display covers to use unified `getCoverUrl(book.id, book.updatedAt)` instead of conditionally checking `calibreId`. Components: `BookCard.tsx`, `BookHeader.tsx`, `BookTable.tsx`, `BookListItem.tsx`, `CurrentlyReadingList.tsx`, `DraggableBookTable.tsx`, `FannedBookCovers.tsx`, `app/journal/page.tsx`, `app/series/[name]/page.tsx`, `TagDetailPanel.tsx`, `TagDetailBottomSheet.tsx`, `AddBooksToShelfModal.tsx`
- [ ] TC11 Remove conditional `calibreId` checks for cover rendering — all books now get a cover URL, the API handles fallbacks server-side

### Frontend — Cover Upload

- [ ] TC12 [P] Add file upload input to `ManualBookForm.tsx` for cover image — accept JPEG/PNG/WebP/GIF, 5MB max, with preview
- [ ] TC13 Handle cover upload after book creation in manual form submission flow — after `POST /api/books` succeeds, `POST /api/books/{id}/cover` with the selected file

### Testing

- [ ] TC14 [P] Unit tests for cover storage utility (`lib/utils/cover-storage.ts`) — save, get, has, delete, ensure directory
- [ ] TC15 [P] Unit tests for cover download utility (`lib/utils/cover-download.ts`) — successful download, timeout, invalid MIME type, oversized file, network error
- [ ] TC16 API tests for cover endpoints — `GET /api/books/{id}/cover` for manual book (with and without cover), `POST /api/books/{id}/cover` upload, cover served after provider search book creation

---

## Phase R1: Source vs. Metadata Provider Refactor

**Goal**: Formalize the separation between sources (book ownership) and metadata providers (search tools). Remove dead code from the original model.

**Prerequisites**: Understanding of architectural revision (see top of file)

**Context**: The original spec treated Hardcover/OpenLibrary as "sources" like Calibre. In practice, the code already creates all provider-searched books as `source='manual'`. This phase formalizes that reality in the type system, schema, and UI.

### Type System Refactor

- [ ] TR01 Introduce `ProviderId` type in `lib/providers/base/IMetadataProvider.ts` — `"calibre" | "manual" | "hardcover" | "openlibrary"` (for provider infrastructure)
- [ ] TR02 Narrow `BookSource` type to `"calibre" | "manual"` in `lib/providers/base/IMetadataProvider.ts` (for book records)
- [ ] TR03 Change `IMetadataProvider.id` from `BookSource` to `ProviderId` and update `ProviderRegistry` accordingly
- [ ] TR04 Update `ProviderBadge` to accept `BookSource | ProviderId` (unified component)

### Schema & Database

- [ ] TR05 Remove `externalId` column, narrow source enum, remove `sourceExternalIdx` index in `lib/db/schema/books.ts`
- [ ] TR06 Generate Drizzle migration and create companion migration (update any `source='hardcover'`/`source='openlibrary'` rows to `source='manual'`)

### Service & Repository Cleanup

- [ ] TR07 Delete `lib/services/migration.service.ts` (source migration eliminated)
- [ ] TR08 Remove `findBySourceAndExternalId()` and `externalId` references from `lib/repositories/book.repository.ts`
- [ ] TR09 Remove `externalId` from book creation in `lib/services/book.service.ts`

### API & UI Updates

- [ ] TR10 Update `FederatedSearchModal.tsx` — remove `source`/`externalId` from submission payload; update `LibraryFilters.tsx` — remove hardcover/openlibrary source filter options
- [ ] TR11 Update API routes (`app/api/books/route.ts`, `app/api/providers/`) — narrow source types, update `BookSource` → `ProviderId` casts
- [ ] TR12 Update `BookCard.tsx`, `BookGrid.tsx`, `app/books/[id]/page.tsx` — source prop types narrowed to `BookSource`

---

## Dependencies & Execution Order

### Critical Path (Must Complete in Order)

```
Phase 1 (Setup) 
  ↓
Phase 2 (Foundational)
  ↓
Phase 3 (US1: Manual Books) 
  ↓
Phase 4 (US2: Sync Isolation)
  ↓
Phase 5 (US3: Source Filtering) ← Can start after Phase 3
  ↓
Phase 7 (US4: Federated Search) ← Can start after Phase 2
  ↓
Phase 8 (Polish)
  ↓
Phase C1 (Cover Image Support) ← Can start after Phase 3; full value after Phase 7
  ↓
Phase R1 (Source/Provider Refactor) ← Can start anytime after Phase 7
```

Note: Phase 6 (Source Migration) has been CANCELLED. See Architectural Revision.

### User Story Dependencies

| Story | Depends On | Reason |
|-------|------------|--------|
| US1 (Manual Books) | Phase 2 | Needs repositories and services |
| US2 (Sync Isolation) | US1 | Needs manual books to test isolation |
| US3 (Source Filtering) | US1 | Needs multiple sources to filter |
| US4 (Federated Search) | Phase 2 | Independent - only needs provider infrastructure |
| ~~US5 (Migration)~~ | ~~CANCELLED~~ | ~~Eliminated in architectural revision~~ |

### Parallel Execution Opportunities

**Within Phase 2 (Foundational)**:
- Tasks T009-T012 (repositories) can run in parallel
- Tasks T013-T015 (services) can run in parallel
- Tasks T016-T020 (provider stubs) can run in parallel

**Within Phase 3 (US1)**:
- Tasks T021-T022 (backend creation) parallel
- Tasks T025-T027 (validation) parallel to T021-T022
- Tasks T028-T032 (frontend forms) parallel after T021 complete
- Tasks T033-T035 (frontend badges) parallel to T028-T032

**Within Phase 7 (US4)**:
- Tasks T068-T072 (search service) parallel
- Tasks T073-T076 (provider implementations) parallel to T068-T072
- Tasks T077-T079 (provider config) parallel to T073-T076
- Tasks T080-T083 (frontend) parallel after T076 complete

**Within Phase C1 (Cover Image Support)**:
- Tasks TC01-TC03 (infrastructure) parallel
- Tasks TC04-TC06 (API endpoints) after TC01 complete
- Task TC07 (provider download) after TC02 + TC04 complete
- Tasks TC09-TC11 (frontend display) after TC04 complete, parallel to TC07
- Tasks TC12-TC13 (upload UI) after TC05 complete
- Tasks TC14-TC16 (testing) after implementation tasks complete

---

## MVP Definition (Minimum Viable Product)

**Scope**: Phase 1 + Phase 2 + Phase 3 + Phase 4

**Delivers**:
- ✅ Manual book addition with validation
- ✅ Duplicate warnings (but allow proceed)
- ✅ Source badges in UI
- ✅ Calibre sync isolation (data integrity)
- ✅ All existing Tome features work for manual books

**Out of MVP**:
- ❌ Source filtering (P2)
- ❌ Federated search (P3)
- ❌ External providers (Hardcover, OpenLibrary)

**MVP Testing**: After Phase 4, user can:
1. Add manual book via UI
2. Log progress for manual book
3. Run Calibre sync
4. Verify manual book untouched by sync
5. View manual books alongside Calibre books with clear source indicators

---

## Implementation Strategy

### Phase-Based Delivery

1. **Complete Phase 1** (Setup): Database ready for multi-source
2. **Complete Phase 2** (Foundational): Services and repositories ready
3. **Ship MVP** (Phase 3 + Phase 4): Manual books + sync isolation
4. **Iterate** (Phase 5, 7, 8): Add advanced features incrementally
5. **Cover Support** (Phase C1): Unified covers for all book sources
6. **Refactor** (Phase R1): Formalize source vs. provider type separation

### Testing Strategy

- **Unit tests**: Repositories, services, providers (use `setDatabase()` pattern)
- **Integration tests**: Multi-source scenarios, sync isolation
- **Manual testing**: UI flows for each user story
- **Performance tests**: Source filtering (<3s), federated search (<6s)

### Risk Mitigation

- **Migration risk**: Companion migration validates data before schema change
- **Sync isolation**: Extensive testing with mixed-source libraries
- **Provider failures**: Circuit breaker prevents cascading failures

---

## Validation Checklist

Before marking feature complete:

- [ ] All 93 tasks completed and checked off (12 cancelled tasks excluded)
- [ ] Each user story independently testable
- [ ] All existing tests still pass (2000+ tests)
- [ ] Performance benchmarks met:
  - [ ] Federated search < 6 seconds
  - [ ] Source filtering < 3 seconds (10k books)
  - [ ] Circuit breaker overhead < 5ms
- [ ] Constitution compliance verified:
  - [ ] Zero external dependencies
  - [ ] Repository pattern followed
  - [ ] Calibre read-only (except ratings)
  - [ ] History preserved (no deletions)
- [ ] Source/Provider type separation clean (BookSource vs ProviderId)
- [ ] No `externalId` references remain on book records
- [ ] No `coverImageUrl` column in database schema
- [ ] Cover images stored locally at `./data/covers/` (not external URLs)
- [ ] Cover API serves covers for both manual and Calibre books via Tome book ID
- [ ] All frontend components use unified `getCoverUrl(bookId)` (not `calibreId`)
- [ ] Documentation updated (ARCHITECTURE.md, ADRs)

---

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, optional labels, file paths)
