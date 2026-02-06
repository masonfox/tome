# Implementation Tasks: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document breaks down the multi-source book tracking feature into executable tasks organized by user story. Each phase represents an independently testable increment of functionality.

**Total Tasks**: 89  
**Implementation Approach**: Incremental delivery by priority (P1 → P2 → P3)  
**MVP Scope**: User Story 1 + User Story 2 (P1 stories - manual books with sync isolation)

---

## Task Summary by Phase

| Phase | User Story | Priority | Task Count | Status |
|-------|------------|----------|------------|--------|
| 1 | Setup | - | 8 | ✅ Complete (8/8) |
| 2 | Foundational | - | 12 | ✅ Complete (12/12) |
| 3 | Manual Book Addition | P1 | 18 | ✅ Complete (18/18) |
| 4 | Library Sync Isolation | P1 | 9 | 🟡 Needs Testing (9/9) |
| 5 | Source-Based Filtering | P2 | 8 | ✅ Complete (8/8) |
| 6 | Source Migration & Duplicates | P2 | 12 | ❌ Not Started (0/12) |
| 7 | Federated Search | P3 | 16 | 🟡 Partial (11/16) |
| 8 | Polish & Cross-Cutting | - | 6 | ✅ Complete (6/6) |

**Overall Progress**: 64/89 tasks complete (72%)

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

- [ ] T039 [US2] Update syncCalibreLibrary() to filter by source='calibre' in lib/sync-service.ts
- [ ] T040 [US2] Update orphaned book detection to only mark Calibre books in lib/sync-service.ts
- [ ] T041 [US2] Add source='calibre' filter to book creation/update during sync in lib/sync-service.ts
- [ ] T042 [US2] Update CalibreProvider to respect source boundaries in lib/providers/calibre.provider.ts

### Testing & Validation

- [ ] T043 [P] [US2] Create integration test: manual book + Calibre sync → verify isolation in __tests__/integration/sync-isolation.test.ts
- [ ] T044 [P] [US2] Create test case: Calibre removes book → only Calibre books orphaned in __tests__/integration/sync-isolation.test.ts
- [ ] T045 [P] [US2] Create test case: Calibre adds book → manual books unchanged in __tests__/integration/sync-isolation.test.ts
- [ ] T046 [P] [US2] Create test case: same title in Calibre + manual → both exist independently in __tests__/integration/sync-isolation.test.ts

### Logging & Observability

- [ ] T047 [US2] Add Pino logging for sync operations with source filtering details in lib/sync-service.ts

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

## Phase 6: User Story 5 - Source Migration & Duplicate Handling (P2)

**Goal**: Enable upgrading manual books to external provider books with duplicate detection

**Independent Test**: Add manual book → search Hardcover → select match → verify upgrade with data preservation

**Prerequisites**: Phase 5 complete, Phase 7 (Hardcover provider) partially complete

### Backend - Migration Service

- [ ] T056 [P] [US5] Implement migrateSource() with transactional updates in lib/services/migration.service.ts
- [ ] T057 [P] [US5] Add pessimistic locking (FOR UPDATE) to migration operations in lib/services/migration.service.ts
- [ ] T058 [US5] Implement migration validation rules (only manual→external, no cross-provider) in lib/services/migration.service.ts
- [ ] T059 [US5] Add logging for migration events (FR-021b) in lib/services/migration.service.ts

### Backend - Duplicate Detection for Providers

- [ ] T060 [P] [US5] Extend duplicate detection to scope by target provider (FR-016e) in lib/services/duplicate-detection.service.ts
- [ ] T061 [P] [US5] Create POST /api/migration/[bookId] endpoint for source migration in app/api/migration/[bookId]/route.ts
- [ ] T062 [US5] Add metadata diff comparison for user confirmation in lib/services/migration.service.ts

### Frontend - Migration UI

- [ ] T063 [P] [US5] Create SourceMigrationDialog component with [Upgrade] [Create Duplicate] options in components/providers/SourceMigrationDialog.tsx
- [ ] T064 [P] [US5] Add metadata comparison view (old vs. new values) in components/providers/MetadataComparisonView.tsx
- [ ] T065 [US5] Integrate migration dialog into book detail page for manual books in app/books/[id]/page.tsx
- [ ] T066 [US5] Show migration history/log in book detail page in app/books/[id]/page.tsx

### Testing & Verification

- [ ] T067 [US5] Create integration test: manual→hardcover migration preserves all data in __tests__/integration/source-migration.test.ts

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
- [ ] T089 Create ADRs for provider architecture, circuit breakers, migration strategy in docs/ADRs/

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
Phase 6 (US5: Migration) ← Requires Phase 7 providers
  ↓
Phase 7 (US4: Federated Search) ← Can start after Phase 2
  ↓
Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends On | Reason |
|-------|------------|--------|
| US1 (Manual Books) | Phase 2 | Needs repositories and services |
| US2 (Sync Isolation) | US1 | Needs manual books to test isolation |
| US3 (Source Filtering) | US1 | Needs multiple sources to filter |
| US4 (Federated Search) | Phase 2 | Independent - only needs provider infrastructure |
| US5 (Migration) | US1, US4 | Needs manual books + external providers |

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
- ❌ Source migration (P2)
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
4. **Iterate** (Phase 5-8): Add advanced features incrementally

### Testing Strategy

- **Unit tests**: Repositories, services, providers (use `setDatabase()` pattern)
- **Integration tests**: Multi-source scenarios, sync isolation, migration
- **Manual testing**: UI flows for each user story
- **Performance tests**: Source filtering (<3s), federated search (<6s)

### Risk Mitigation

- **Migration risk**: Companion migration validates data before schema change
- **Sync isolation**: Extensive testing with mixed-source libraries
- **Provider failures**: Circuit breaker prevents cascading failures
- **Data loss**: Source migration uses transactions + pessimistic locking

---

## Validation Checklist

Before marking feature complete:

- [ ] All 89 tasks completed and checked off
- [ ] Each user story independently testable
- [ ] All existing tests still pass (2000+ tests)
- [ ] Performance benchmarks met:
  - [ ] Federated search < 6 seconds
  - [ ] Source filtering < 3 seconds (10k books)
  - [ ] Source migration < 2 seconds
  - [ ] Circuit breaker overhead < 5ms
- [ ] Constitution compliance verified:
  - [ ] Zero external dependencies
  - [ ] Repository pattern followed
  - [ ] Calibre read-only (except ratings)
  - [ ] History preserved (no deletions)
- [ ] Documentation updated (ARCHITECTURE.md, ADRs)

---

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, optional labels, file paths)
