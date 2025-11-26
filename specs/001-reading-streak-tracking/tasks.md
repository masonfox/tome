# Implementation Tasks: Reading Streak Tracking Enhancement

**Feature**: Reading Streak Tracking Enhancement
**Branch**: `001-reading-streak-tracking`
**Status**: Ready for Implementation
**Generated**: 2025-11-25

## Overview

This document provides a complete, ordered task list for implementing the enhanced reading streak tracking feature. Tasks are organized by user story to enable independent implementation and testing.

## Task Format

Each task follows this strict format:
```
- [ ] [TaskID] [P?] [Story?] Description with file path
```

- **TaskID**: Sequential number (T001, T002, etc.)
- **[P]**: Task can be done in parallel with other [P] tasks
- **[Story]**: User story label (US1, US2, etc.) - only for story-specific tasks
- **Description**: Clear action with exact file path

## Implementation Strategy

### MVP Scope (Recommended First Release)

Implement **User Story 1 (P1)** and **User Story 2 (P1)** first for a complete, valuable MVP:
- Homepage displays enhanced streak with threshold and time remaining
- Users can configure their personal daily reading threshold
- Existing streak calculation enhanced to respect thresholds

This provides immediate user value and can be deployed independently.

### Incremental Delivery Plan

1. **Phase 1-2**: Setup and foundational tasks
2. **Phase 3**: User Story 1 (View Current Streak) - First deployable increment
3. **Phase 4**: User Story 2 (Configure Thresholds) - Complete MVP
4. **Phase 5**: User Story 3 (Detailed Analytics) - Enhancement
5. **Phase 6**: User Story 4 (Longest Streak) - Already implemented, just needs display
6. **Phase 7**: User Story 5 (Reminders) - Future enhancement (out of scope for initial release)
7. **Phase 8**: Polish and cross-cutting concerns

## Dependencies

### Story Dependency Graph

```
Setup (Phase 1) → Foundational (Phase 2)
                        ↓
    ┌───────────────────┴───────────────────┐
    ↓                   ↓                   ↓
  US1 (P1)           US2 (P1)            US4 (P2)
    ↓                   ↓                   ↓
    └───────────────────┬───────────────────┘
                        ↓
                     US3 (P2)
                        ↓
                   Polish Phase
```

**Note**: US5 (Reminders) is P3 and out of scope for initial release.

### Story Independence

- **US1**: Independent (enhances existing homepage component)
- **US2**: Independent (adds new API endpoint and settings UI)
- **US3**: Depends on US1 and US2 (builds on threshold and display foundation)
- **US4**: Independent (already implemented in existing streak logic, just needs UI display)
- **US5**: Out of scope (requires notification infrastructure)

## Phase 1: Setup and Infrastructure

**Goal**: Prepare database schema and run migrations

### Tasks

- [X] T001 Create database migration file for dailyThreshold column in migrations/XXXX_add_streak_threshold.sql
- [X] T002 Add CHECK constraint (dailyThreshold >= 1 AND dailyThreshold <= 9999) to migration in migrations/XXXX_add_streak_threshold.sql
- [X] T003 Run database migration using bun run db:migrate
- [X] T004 Verify migration success using bun run db:studio (check streaks table has daily_threshold column)

## Phase 2: Foundational Layer

**Goal**: Update core schema, repository, and service layers to support threshold functionality

### Tasks

- [X] T005 [P] Update streaks schema to include dailyThreshold field in lib/db/schema/streaks.ts
- [X] T006 [P] Add TypeScript type for dailyThreshold to Streak and NewStreak types in lib/db/schema/streaks.ts
- [X] T007 Add updateThreshold method to StreakRepository in lib/repositories/streak.repository.ts
- [X] T008 Add validation logic (1-9999 range) to updateThreshold method in lib/repositories/streak.repository.ts
- [X] T009 Create StreakService class in lib/services/streak.service.ts
- [X] T010 Implement getStreak method with hoursRemainingToday calculation in lib/services/streak.service.ts
- [X] T011 Implement updateThreshold method with validation in lib/services/streak.service.ts
- [X] T012 Update updateStreaks function to respect dailyThreshold when checking if threshold met in lib/streaks.ts
- [X] T013 Add Pino logging for threshold updates and streak calculations in lib/services/streak.service.ts

## Phase 3: User Story 1 - View Current Streak on Homepage (P1)

**Story Goal**: Display enhanced streak information on homepage with threshold and time remaining

**Independent Test**: Open homepage after logging reading progress for consecutive days. Verify current streak count, threshold, and time remaining are all displayed correctly.

### Tasks

- [X] T014 [US1] Update StreakDisplay component props interface to include dailyThreshold and hoursRemainingToday in components/StreakDisplay.tsx
- [X] T015 [US1] Add threshold display section to StreakDisplay component in components/StreakDisplay.tsx
- [X] T016 [US1] Add time remaining display section to StreakDisplay component in components/StreakDisplay.tsx
- [X] T017 [US1] Update homepage to fetch enhanced streak data including threshold in app/page.tsx
- [X] T018 [US1] Pass dailyThreshold and hoursRemainingToday props to StreakDisplay in app/page.tsx
- [X] T019 [US1] Add encouraging message logic for zero streak in StreakDisplay component in components/StreakDisplay.tsx
- [ ] T020 [US1] Verify streak display shows correct data after reading activities (manual test)

**Parallel Opportunities**:
- T014-T016 (component updates) can be done in parallel
- T017-T018 (homepage integration) sequential after component updates

## Phase 4: User Story 2 - Configure Personal Streak Thresholds (P1)

**Story Goal**: Allow users to set and update their daily reading threshold with validation

**Independent Test**: Navigate to settings, change threshold to different values (valid and invalid), verify changes persist and streak calculation respects new threshold.

### Tasks

- [X] T021 [P] [US2] Create GET /api/streak endpoint to fetch current streak in app/api/streak/route.ts
- [X] T022 [P] [US2] Create PATCH /api/streak/threshold endpoint to update threshold in app/api/streak/route.ts
- [X] T023 [US2] Add request body validation for PATCH endpoint (check dailyThreshold field) in app/api/streak/route.ts
- [X] T024 [US2] Add range validation (1-9999) with error responses in app/api/streak/route.ts
- [X] T025 [US2] Add error handling for missing streak record (404) in app/api/streak/route.ts
- [X] T026 [US2] Create StreakSettings client component in components/StreakSettings.tsx
- [X] T027 [US2] Add form with number input (min=1, max=9999) in components/StreakSettings.tsx
- [X] T028 [US2] Implement threshold update handler with fetch to PATCH endpoint in components/StreakSettings.tsx
- [X] T029 [US2] Add toast notifications for success/error states using sonner in components/StreakSettings.tsx
- [X] T030 [US2] Add loading state during threshold update in components/StreakSettings.tsx
- [X] T031 [US2] Integrate StreakSettings component into settings page in app/settings/page.tsx
- [X] T032 [US2] Verify invalid thresholds (0, 10000, negative) show appropriate error messages (manual test)
- [X] T033 [US2] Verify threshold updates persist across page refreshes (manual test)
- [X] T034 [US2] Verify streak calculation respects new threshold after mid-day change (manual test)

**Parallel Opportunities**:
- T021-T022 (API endpoints) can be done in parallel
- T026-T030 (component creation) can be done in parallel with API endpoints
- T023-T025 (validation logic) sequential after T022

## Phase 5: User Story 3 - View Detailed Streak Analytics (P2)

**Story Goal**: Provide comprehensive analytics page with charts and historical data

**Independent Test**: Access analytics page, verify chart displays 365 days of data, threshold line is visible, and books ahead/behind calculation is accurate (if reading goal exists).

**Dependencies**: Requires US1 and US2 foundation (threshold in place, basic display working)

### Tasks

- [X] T035 [P] [US3] Create GET /api/streak/analytics endpoint in app/api/streak/analytics/route.ts
- [X] T036 [P] [US3] Add days query parameter validation (1-365 range) in app/api/streak/analytics/route.ts
- [X] T037 [US3] Fetch daily reading history using progressRepository.getActivityCalendar in app/api/streak/analytics/route.ts
- [X] T038 [US3] Enrich history data with thresholdMet boolean flag in app/api/streak/analytics/route.ts
- [X] T039 [US3] Add books ahead/behind calculation (optional, only if reading goal exists) in app/api/streak/analytics/route.ts
- [X] T040 [US3] Create streak analytics page in app/streak/page.tsx
- [X] T041 [US3] Fetch analytics data from API in app/streak/page.tsx
- [X] T042 [P] [US3] Create StreakChart component using Recharts in components/StreakChart.tsx
- [X] T043 [P] [US3] Configure BarChart or LineChart for daily pages visualization in components/StreakChart.tsx
- [X] T044 [US3] Add threshold reference line to chart in components/StreakChart.tsx
- [X] T045 [US3] Add responsive chart sizing and tooltips in components/StreakChart.tsx
- [X] T046 [US3] Create StreakAnalytics component for stats display in components/StreakAnalytics.tsx
- [X] T047 [US3] Add current streak, longest streak, and total days active display in components/StreakAnalytics.tsx
- [X] T048 [US3] Add conditional books ahead/behind display in components/StreakAnalytics.tsx
- [X] T049 [US3] Integrate StreakChart and StreakAnalytics in analytics page in app/streak/page.tsx
- [X] T050 [US3] Add clickable link from homepage StreakDisplay to analytics page in components/StreakDisplay.tsx
- [X] T051 [US3] Add encouraging message for new users with < 7 days of data in components/StreakAnalytics.tsx
- [X] T052 [US3] Verify chart displays correctly with varying amounts of data (3 days, 30 days, 365 days) (manual test)
- [X] T053 [US3] Verify books ahead/behind calculation accuracy (manual test with known goal)

**Parallel Opportunities**:
- T035-T036 (API endpoint setup) can be done in parallel
- T042-T045 (chart component) can be done in parallel with T046-T048 (analytics component)
- T037-T039 (data fetching logic) sequential after API setup

## Phase 6: User Story 4 - Track Longest Streak Achievement (P2)

**Story Goal**: Display all-time longest streak alongside current streak with celebration for new records

**Independent Test**: Maintain a streak for N days, break it, start new streak. Verify longest streak still shows N and celebration appears when surpassing old record.

**Note**: Longest streak tracking already exists in database schema and streak update logic. This phase focuses on display enhancements only.

### Tasks

- [X] T054 [US4] Verify longestStreak field is populated correctly in existing updateStreaks function in lib/streaks.ts
- [X] T055 [US4] Add celebration message logic when currentStreak >= longestStreak in components/StreakDisplay.tsx
- [X] T056 [US4] Add celebration animation or visual indicator for new record in components/StreakDisplay.tsx
- [X] T057 [US4] Display longest streak prominently on analytics page in components/StreakAnalytics.tsx
- [ ] T058 [US4] Verify celebration shows when surpassing previous longest streak (manual test)
- [ ] T059 [US4] Verify longest streak persists after current streak is broken (manual test)

**Parallel Opportunities**:
- T054 (verification) can be done first
- T055-T056 (celebration logic) can be done in parallel with T057 (analytics display)

## Phase 7: User Story 5 - Receive Streak Maintenance Reminders (P3)

**Story Goal**: Send gentle reminders to maintain streak

**Status**: OUT OF SCOPE for initial release. Requires notification infrastructure not currently in Tome.

**Future Considerations**:
- Requires notification system (browser notifications or email)
- Requires user preference management for notification timing
- Requires background job scheduler for timed reminders
- Recommended as post-MVP enhancement after user adoption validated

### Tasks (Deferred)

- [ ] [US5] [DEFERRED] Design notification permission flow
- [ ] [US5] [DEFERRED] Implement browser notification API integration
- [ ] [US5] [DEFERRED] Create notification preferences in user settings
- [ ] [US5] [DEFERRED] Build reminder scheduling logic
- [ ] [US5] [DEFERRED] Add reminder timing configuration (e.g., 8 PM default)

## Phase 8: Polish and Cross-Cutting Concerns

**Goal**: Testing, error handling, logging, and final refinements

### Tasks

- [ ] T060 [P] Create unit tests for StreakService validation logic in tests/unit/streak.service.test.ts
- [ ] T061 [P] Create integration tests for StreakRepository.updateThreshold in tests/integration/streak.repository.test.ts
- [ ] T062 [P] Add component tests for StreakSettings form validation in tests/component/streak-settings.test.tsx
- [ ] T063 [P] Add tests for streak calculation with threshold in tests/integration/streaks.test.ts
- [ ] T064 Add error boundary for streak components in app/page.tsx and app/streak/page.tsx
- [ ] T065 Add fallback UI for when streak data fails to load in components/StreakDisplay.tsx
- [ ] T066 Review all logging statements for consistency with Pino patterns in lib/services/streak.service.ts
- [ ] T067 Add TypeScript strict mode compliance checks for new files
- [ ] T068 Run full test suite and fix any failures (bun test)
- [ ] T069 Run TypeScript compiler and fix any type errors (bun run build)
- [ ] T070 Perform manual end-to-end testing of all user stories
- [ ] T071 Update README or docs with streak threshold feature description
- [ ] T072 Create database backup before final deployment (bun run db:backup)

**Parallel Opportunities**:
- T060-T063 (all test files) can be written in parallel
- T064-T067 (polish tasks) can be done in parallel

## Task Summary

### Total Task Count

- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 9 tasks
- **Phase 3 (US1 - View Streak)**: 7 tasks
- **Phase 4 (US2 - Configure Threshold)**: 14 tasks
- **Phase 5 (US3 - Analytics)**: 19 tasks
- **Phase 6 (US4 - Longest Streak)**: 6 tasks
- **Phase 7 (US5 - Reminders)**: Deferred (out of scope)
- **Phase 8 (Polish)**: 13 tasks

**Total**: 72 tasks (excluding deferred US5)

### Tasks Per User Story

- **US1**: 7 tasks (enhancing homepage display)
- **US2**: 14 tasks (threshold configuration)
- **US3**: 19 tasks (detailed analytics)
- **US4**: 6 tasks (longest streak display)
- **US5**: Deferred (future enhancement)

### Parallel Opportunities

**17 tasks marked [P]** can be executed in parallel:
- Phase 2: T005, T006 (schema updates)
- Phase 4: T021, T022 (API endpoints)
- Phase 5: T035, T036, T042, T043 (API + chart component)
- Phase 8: T060, T061, T062, T063 (all tests)

## Independent Test Criteria by Story

### US1: View Current Streak on Homepage
**Test**: Open homepage → Verify streak count, threshold, and hours remaining display correctly after consecutive days of reading.

### US2: Configure Personal Streak Thresholds
**Test**: Navigate to settings → Change threshold → Verify validation works, changes persist, and streak calculation respects new threshold.

### US3: View Detailed Streak Analytics
**Test**: Access analytics page → Verify chart shows historical data, threshold line visible, books ahead/behind accurate.

### US4: Track Longest Streak Achievement
**Test**: Build streak of N days → Break it → Start new streak → Verify longest still shows N and celebration triggers on new record.

### US5: Receive Streak Maintenance Reminders
**Status**: Deferred - out of scope for initial release.

## Execution Examples

### MVP Implementation (US1 + US2)

```bash
# Phase 1: Setup
Execute T001-T004 (sequential)

# Phase 2: Foundational
Execute T005, T006 in parallel
Execute T007-T013 (sequential)

# Phase 3: US1
Execute T014, T015, T016 in parallel
Execute T017-T020 (sequential)

# Phase 4: US2
Execute T021, T022 in parallel
Execute T023-T025 (sequential)
Execute T026-T030 in parallel
Execute T031-T034 (sequential)

# Phase 8: Polish (subset)
Execute T060-T063 in parallel
Execute T068-T070 (sequential)
```

### Full Feature Implementation

```bash
# After MVP (above):

# Phase 5: US3
Execute T035, T036 in parallel
Execute T037-T041 (sequential)
Execute T042-T045 in parallel with T046-T048
Execute T049-T053 (sequential)

# Phase 6: US4
Execute T054 first
Execute T055-T057 in parallel
Execute T058-T059 (manual tests)

# Phase 8: Full Polish
Execute all Phase 8 tasks
```

## Notes

### File Modifications vs. New Files

**Modified Files** (enhance existing):
- `lib/db/schema/streaks.ts` (add dailyThreshold)
- `lib/repositories/streak.repository.ts` (add updateThreshold method)
- `lib/streaks.ts` (enhance updateStreaks with threshold logic)
- `components/StreakDisplay.tsx` (add threshold and time remaining)
- `app/page.tsx` (pass new props to StreakDisplay)
- `app/settings/page.tsx` (integrate StreakSettings)

**New Files** (create from scratch):
- `migrations/XXXX_add_streak_threshold.sql`
- `lib/services/streak.service.ts`
- `app/api/streak/route.ts`
- `app/api/streak/analytics/route.ts`
- `app/streak/page.tsx`
- `components/StreakSettings.tsx`
- `components/StreakChart.tsx`
- `components/StreakAnalytics.tsx`
- `tests/unit/streak.service.test.ts`
- `tests/integration/streak.repository.test.ts`

### Technology References

- **Database**: SQLite via better-sqlite3, Drizzle ORM for migrations
- **API**: Next.js 14 App Router API routes
- **UI**: React 18.3, Tailwind CSS (existing patterns)
- **Charts**: Recharts 2.12.0 (already in dependencies)
- **Dates**: date-fns 3.3.0 for timezone calculations
- **Logging**: Pino 9.3.1 for structured logging
- **Testing**: Bun test framework

### Validation Checklist

- [x] All tasks follow strict checklist format (checkbox + ID + labels + file path)
- [x] Tasks organized by user story (Phase 3-7)
- [x] Story labels ([US1], [US2], etc.) applied correctly
- [x] Parallel tasks marked with [P]
- [x] Dependencies clearly documented
- [x] Independent test criteria defined per story
- [x] MVP scope identified (US1 + US2)
- [x] File paths are absolute and specific
- [x] Out-of-scope stories (US5) explicitly marked as deferred
