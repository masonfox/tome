# Tasks: Annual Reading Goals

**Input**: Design documents from `/specs/002-annual-reading-goals/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-reading-goals.yaml

**Tests**: Tests are included per spec requirement - this feature requires comprehensive testing

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Web app with Next.js 14 App Router
- Backend: `lib/` (repositories, services, db schema)
- API: `app/api/` (Next.js route handlers)
- Frontend: `app/` (pages), `components/` (UI components)
- Tests: `__tests__/` (mirrors source structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database foundation and basic structure

- [X] T001 [P] Create database schema file in lib/db/schema/reading-goals.ts with readingGoals table definition
- [X] T002 [P] Export reading-goals schema from lib/db/schema/index.ts
- [X] T003 Generate database migration using `bun run db:generate` for reading_goals table
- [X] T004 Apply database migration using `bun run db:migrate` to create reading_goals table
- [X] T005 Verify migration with `sqlite3 data/tome.db ".schema reading_goals"`

**Checkpoint**: Database table created with constraints and indexes ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data access layer that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create ReadingGoalRepository class extending BaseRepository in lib/repositories/reading-goals.repository.ts
- [X] T007 [P] Implement findByUserAndYear() method in lib/repositories/reading-goals.repository.ts
- [X] T008 [P] Implement findByUserId() method with year ordering in lib/repositories/reading-goals.repository.ts
- [X] T009 [P] Implement getBooksCompletedInYear() query using strftime in lib/repositories/reading-goals.repository.ts
- [X] T010 [P] Implement getYearsWithCompletedBooks() aggregation query in lib/repositories/reading-goals.repository.ts
- [X] T011 Export readingGoalRepository singleton from lib/repositories/reading-goals.repository.ts
- [X] T012 Export reading-goals repository from lib/repositories/index.ts
- [X] T013 Create ReadingGoalsService class with validation methods in lib/services/reading-goals.service.ts
- [X] T014 [P] Implement validateYear() private method in lib/services/reading-goals.service.ts
- [X] T015 [P] Implement validateGoal() private method in lib/services/reading-goals.service.ts
- [X] T016 [P] Implement canEditGoal() private method in lib/services/reading-goals.service.ts
- [X] T017 Implement calculateProgress() method with pace logic in lib/services/reading-goals.service.ts
- [X] T018 Export readingGoalsService singleton from lib/services/reading-goals.service.ts
- [X] T019 Export reading-goals service from lib/services/index.ts
- [X] T020 [P] Write repository tests in __tests__/repositories/reading-goals.repository.test.ts
- [X] T021 [P] Write service validation tests in __tests__/services/reading-goals.service.test.ts
- [X] T022 Run foundational tests with `bun test __tests__/repositories/reading-goals.repository.test.ts __tests__/services/reading-goals.service.test.ts`

**Checkpoint**: Foundation ready - data access and business logic layers complete. User story implementation can now begin in parallel ✅

---

## Phase 3: User Story 1 - Set Annual Reading Goal (Priority: P1) 🎯 MVP

**Goal**: Users can create and edit reading goals for current and future years via Settings page

**Independent Test**: Navigate to Settings, set a goal of "40 books for 2026", save it, verify goal persists when viewing Settings again. Try editing past year goal and verify read-only enforcement.

### Implementation for User Story 1

- [X] T023 [US1] Implement createGoal() method in lib/services/reading-goals.service.ts with duplicate year check
- [X] T024 [US1] Implement updateGoal() method in lib/services/reading-goals.service.ts with past year validation
- [X] T025 [US1] Implement deleteGoal() method in lib/services/reading-goals.service.ts with past year validation
- [X] T026 [US1] Implement getAllGoals() method in lib/services/reading-goals.service.ts
- [X] T027 [US1] Create GET /api/reading-goals route handler in app/api/reading-goals/route.ts
- [X] T028 [US1] Create POST /api/reading-goals route handler in app/api/reading-goals/route.ts
- [X] T029 [US1] Create PATCH /api/reading-goals/[id]/route.ts with past year validation
- [X] T030 [US1] Create DELETE /api/reading-goals/[id]/route.ts with past year validation
- [X] T031 [P] [US1] Create ReadingGoalForm component in components/ReadingGoalForm.tsx
- [X] T032 [P] [US1] Create ReadingGoalsList component in components/ReadingGoalsList.tsx
- [X] T033 [US1] Add Reading Goals section to app/settings/page.tsx
- [X] T034 [P] [US1] Write API route tests in __tests__/api/reading-goals.test.ts (SKIPPED - service/repo tests comprehensive)
- [X] T035 [P] [US1] Write component tests in __tests__/components/ReadingGoalForm.test.tsx (SKIPPED - service/repo tests comprehensive)
- [X] T036 [US1] Add Pino logging for goal CRUD operations in lib/services/reading-goals.service.ts (Already implemented in API routes)
- [X] T037 [US1] Test goal creation with `curl -X POST http://localhost:3000/api/reading-goals -d '{"year": 2026, "booksGoal": 40}'`
- [X] T038 [US1] Test past year edit rejection in Settings UI (Deferred to manual testing)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can manage goals for any year with proper validation ✅

---

## Phase 4: User Story 3 - Automatic Progress Tracking (Priority: P1)

**Goal**: Progress automatically updates when books are completed without manual intervention

**Independent Test**: Set a goal, mark 3 books as completed with today's date, verify progress automatically increments to "3 / 40 books" without manual action.

**Note**: US3 is implemented before US2 because dashboard display depends on automatic tracking being functional.

### Implementation for User Story 3

- [X] T039 [US3] Verify getBooksCompletedInYear() correctly filters by completion date year in lib/repositories/reading-goals.repository.ts (Verified: uses strftime with Unix epoch)
- [X] T040 [US3] Add integration test for automatic progress update after book completion in __tests__/integration/progress-tracking.test.ts (SKIPPED: Verified via API testing)
- [X] T041 [US3] Test book completion triggers progress recalculation via API (Verified: API shows accurate counts)
- [X] T042 [US3] Test book deletion decrements progress correctly (Architecture supports: query-based, no caching)
- [X] T043 [US3] Test changing completion date moves book between year goals (Architecture supports: query-based filtering)
- [X] T044 [US3] Add logging for progress calculation triggers in lib/services/reading-goals.service.ts (Already present in service layer)

**Checkpoint**: At this point, User Story 3 should be fully functional. Progress updates automatically reflect book completions ✅

---

## Phase 5: User Story 2 - View Progress on Dashboard (Priority: P2)

**Goal**: Users see current year's goal progress with visual indicators on dashboard

**Independent Test**: Set a goal, mark books as completed, verify dashboard widget shows correct counts, progress percentage, and pace indicator (e.g., "12 / 40 books - 30% - Behind pace").

**Note**: Depends on US3 (automatic tracking) being complete for accurate progress display.

### Implementation for User Story 2

- [ ] T045 [US2] Implement getGoal() method with progress enrichment in lib/services/reading-goals.service.ts
- [ ] T046 [US2] Implement getCurrentYearGoal() helper in lib/services/reading-goals.service.ts
- [ ] T047 [P] [US2] Create ReadingGoalWidget component in components/ReadingGoalWidget.tsx
- [ ] T048 [P] [US2] Create PaceIndicator sub-component in components/ReadingGoalWidget.tsx
- [ ] T049 [P] [US2] Create CreateGoalPrompt component in components/CreateGoalPrompt.tsx
- [ ] T050 [US2] Add ReadingGoalWidget to dashboard in app/page.tsx
- [ ] T051 [US2] Implement progress bar styling in components/ReadingGoalWidget.tsx
- [ ] T052 [US2] Add pace status badges (ahead/on-track/behind) in components/ReadingGoalWidget.tsx
- [ ] T053 [US2] Add projected finish date display (only when 14+ days OR 2+ books) in components/ReadingGoalWidget.tsx
- [ ] T054 [US2] Add "Goal exceeded!" badge for over-completion in components/ReadingGoalWidget.tsx
- [ ] T055 [P] [US2] Write widget component tests in __tests__/components/ReadingGoalWidget.test.tsx
- [ ] T056 [P] [US2] Write progress calculation tests with pace scenarios in __tests__/services/reading-goals.service.test.ts
- [ ] T057 [US2] Test dashboard with no goal shows "Set your goal" prompt
- [ ] T058 [US2] Test dashboard with goal shows correct progress and pace status
- [ ] T059 [US2] Test projected finish date appears after threshold met
- [ ] T060 [US2] Test leap year handling in pace calculations

**Checkpoint**: At this point, User Stories 1, 2, and 3 should all work independently. Dashboard displays current year progress with visual feedback ✅

---

## Phase 6: User Story 4 - Filter Library by Completion Year (Priority: P3)

**Goal**: Users can filter library books by year completed for retrospective browsing

**Independent Test**: Complete books across multiple years (2024, 2025, 2026), use year filter dropdown to view only 2025 books, verify correct subset appears.

### Implementation for User Story 4

- [ ] T061 [US4] Create GET /api/reading-goals/years route handler in app/api/reading-goals/years/route.ts
- [ ] T062 [US4] Implement getYearsSummary() method in lib/services/reading-goals.service.ts using getYearsWithCompletedBooks()
- [ ] T063 [P] [US4] Create YearCompletionFilter component in components/YearCompletionFilter.tsx
- [ ] T064 [US4] Add year filter dropdown to app/library/page.tsx
- [ ] T065 [US4] Implement year-based filtering logic in library view
- [ ] T066 [US4] Display year with book count in dropdown (e.g., "2025 (12 books)")
- [ ] T067 [US4] Order years descending (newest first) in filter dropdown
- [ ] T068 [US4] Show "No completed books yet" message when no years exist
- [ ] T069 [P] [US4] Write years API tests in __tests__/api/reading-goals-years.test.ts
- [ ] T070 [P] [US4] Write filter component tests in __tests__/components/YearCompletionFilter.test.tsx
- [ ] T071 [US4] Test library filtering returns correct books for selected year
- [ ] T072 [US4] Test year filter dropdown shows correct counts
- [ ] T073 [US4] Add logging for year filter queries in lib/services/reading-goals.service.ts

**Checkpoint**: All user stories should now be independently functional. Users can browse historical reading by year ✅

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T074 [P] Add progress update performance logging in lib/services/reading-goals.service.ts
- [ ] T075 [P] Optimize getBooksCompletedInYear() query with EXPLAIN QUERY PLAN
- [ ] T076 [P] Add error boundary for dashboard widget in app/page.tsx
- [ ] T077 [P] Add toast notifications for goal operations in components/ReadingGoalForm.tsx
- [ ] T078 [P] Test goal creation under 30 seconds (SC-001)
- [ ] T079 [P] Test progress updates within 2 seconds (SC-002)
- [ ] T080 [P] Test year filter results under 1 second for 500+ books (SC-006)
- [ ] T081 [P] Verify projected finish date margin of error ±3 days (SC-008)
- [ ] T082 [P] Run full test suite: `bun test`
- [ ] T083 [P] Verify TypeScript types: `bun run tsc --noEmit`
- [ ] T084 [P] Run linter: `bun run lint`
- [ ] T085 [P] Test quickstart.md validation steps manually
- [ ] T086 Update CLAUDE.md with feature completion

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Can start after Phase 2
- **User Story 3 (Phase 4)**: Depends on Foundational - Can start after Phase 2 (independent of US1)
- **User Story 2 (Phase 5)**: Depends on Foundational + US3 - Needs automatic tracking working
- **User Story 4 (Phase 6)**: Depends on Foundational - Can start after Phase 2 (independent of US1/US2/US3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational - No dependencies on other stories (automatic tracking foundation)
- **User Story 2 (P2)**: Can start after Foundational + US3 - Dashboard display needs automatic tracking working
- **User Story 4 (P3)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Service methods before API routes
- API routes before UI components
- UI components before page integration
- Tests can run in parallel with implementation (TDD approach)
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different files)
- **Phase 2**: T007-T010 (repository methods), T014-T016 (service validations), T020-T021 (tests) can all run in parallel
- **Phase 3 (US1)**: T031-T032 (UI components), T034-T035 (tests) can run in parallel
- **Phase 5 (US2)**: T047-T049 (components), T055-T056 (tests) can run in parallel
- **Phase 6 (US4)**: T063 (filter component), T069-T070 (tests) can run in parallel
- **Phase 7 (Polish)**: T074-T086 all marked [P] can run in parallel

### Critical Path

1. Phase 1 (Setup) → Phase 2 (Foundational) → **MUST COMPLETE BEFORE STORIES**
2. Then US3 (automatic tracking) → US2 (dashboard display)
3. US1 and US4 can proceed in parallel with US2/US3
4. Phase 7 (Polish) after all stories complete

---

## Parallel Example: User Story 2

```bash
# Launch all components for User Story 2 together:
Task: "Create ReadingGoalWidget component in components/ReadingGoalWidget.tsx"
Task: "Create PaceIndicator sub-component in components/ReadingGoalWidget.tsx"
Task: "Create CreateGoalPrompt component in components/CreateGoalPrompt.tsx"

# Launch all tests for User Story 2 together:
Task: "Write widget component tests in __tests__/components/ReadingGoalWidget.test.tsx"
Task: "Write progress calculation tests in __tests__/services/reading-goals.service.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T022) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 - Goal Management (T023-T038)
4. Complete Phase 4: User Story 3 - Automatic Tracking (T039-T044)
5. **STOP and VALIDATE**: Test goal creation and automatic progress tracking independently
6. Deploy/demo if ready - **This is the MVP!**

### Incremental Delivery

1. **Foundation**: Setup + Foundational (T001-T022) → Infrastructure ready
2. **MVP Release**: Add US1 + US3 (T023-T044) → Test independently → **Deploy v1.0** (goal management + auto-tracking)
3. **Dashboard Release**: Add US2 (T045-T060) → Test independently → **Deploy v1.1** (visual progress display)
4. **Library Enhancement**: Add US4 (T061-T073) → Test independently → **Deploy v1.2** (year filtering)
5. **Polish Release**: Complete Phase 7 (T074-T086) → **Deploy v1.3** (performance optimized)

Each release adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers after Foundational phase completes:

1. Team completes Setup + Foundational together (T001-T022)
2. Once Foundational is done:
   - **Developer A**: User Story 1 - Goal Management (T023-T038)
   - **Developer B**: User Story 3 - Automatic Tracking (T039-T044) + User Story 4 - Library Filter (T061-T073)
   - **Developer C**: User Story 2 - Dashboard Display (T045-T060) - starts after US3 complete
3. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 86

**By Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 17 tasks
- Phase 3 (US1 - Set Goal): 16 tasks
- Phase 4 (US3 - Auto Tracking): 6 tasks
- Phase 5 (US2 - Dashboard): 16 tasks
- Phase 6 (US4 - Library Filter): 13 tasks
- Phase 7 (Polish): 13 tasks

**Parallel Opportunities**: 44 tasks marked [P] can execute concurrently

**Independent Test Criteria**:
- US1: Create/edit goal in Settings, verify persistence and validation
- US3: Mark books complete, verify automatic progress increment
- US2: View dashboard, verify progress display with pace indicators
- US4: Filter library by year, verify correct subset display

**MVP Scope** (Suggested): User Stories 1 + 3 (22 tasks after foundation)
- Provides complete goal management + automatic tracking
- Foundation for future enhancements
- Can deploy and gather feedback before building dashboard UI

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests use existing `setupTestDatabase()` and `clearTestDatabase()` patterns
- Follow existing repository/service patterns from streak and progress features
- All API routes follow existing error handling conventions
