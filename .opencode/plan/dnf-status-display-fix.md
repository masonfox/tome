# Plan: Fix DNF Book Status Display Bug

**Created:** 2026-01-12  
**Status:** Planning Complete - Ready for Implementation

---

## Problem Summary

Books marked as "DNF" (Did Not Finish) show as "Want To Read" in the UI after a page refresh, even though the database correctly stores them as DNF. This is a **UI display issue**, not a sync overwriting issue.

### Root Cause

1. **API Fetching**: `findByIdWithDetails` only fetches sessions where `is_active = 1`
2. **Terminal States Archive**: When books are marked as "read" or "dnf", sessions are archived (`is_active = 0`)
3. **UI Default Logic**: `useBookStatus.ts` falls back to "to-read" when no active session exists and `hasCompletedReads = false`

### Affected Books (Current State)

- Book #1 (The Laws of Human Nature) - 1 DNF session (inactive)
- Book #4 (Ten Arguments...) - 3 sessions (2 DNF, 1 read - all inactive)
- Book #698 (The Faces of a Martyr) - 1 DNF session (inactive)
- Book #703 (Technopoly) - 1 read session (works by coincidence via `hasCompletedReads`)
- Book #706 (Norwegian Wood) - 2 sessions (DNF→read, both inactive)

---

## Agreed Solution: Smart Active Session Management

### Core Principle
**Only ONE active session per book at a time.** `is_active = 1` means "this is the book's current state."

### Semantic Change
- **Before**: `is_active = 0` means "this reading session is complete/archived"
- **After**: `is_active = 0` means "this session was replaced by a newer one (re-read)"

### New Rules
1. **Terminal states keep session active**: "read" and "dnf" sessions stay `is_active = 1`
2. **Archive only when starting new session**: When starting re-read, archive the previous session
3. **Re-read button logic**: Show for books in ANY "finished" state (read OR dnf) - uses same text "Start Re-reading"

---

## Implementation Phases

### Phase 1: Code Changes - Stop Auto-Archiving Terminal States ✅ READY

**Objective**: Prevent automatic archiving when marking books as "read" or "dnf"

#### Task 1.1: Update Session Service - Remove Auto-Archive for "Read" Status
- **File**: `lib/services/session.service.ts`
- **Line**: 340
- **Change**: Remove `updateData.isActive = false;` when status becomes "read"
- **Rationale**: Terminal "read" state should keep session active
- **Status**: [ ] Not Started

#### Task 1.2: Update Session Service - Remove Auto-Archive for DNF Status
- **File**: `lib/services/session.service.ts`
- **Line**: 1064
- **Change**: Remove `isActive: false` when marking as DNF
- **Rationale**: Terminal "dnf" state should keep session active
- **Status**: [ ] Not Started

---

### Phase 2: Code Changes - Support Re-reading DNF Books ✅ READY

**Objective**: Allow users to re-read books that were marked as DNF (not just completed reads)

#### Task 2.1: Create Repository Method - Check for Finished Sessions (Read OR DNF)
- **File**: `lib/repositories/session.repository.ts`
- **Action**: Add new method `hasFinishedSessions(bookId: number): Promise<boolean>`
- **Logic**: Check for sessions with `status IN ('read', 'dnf')`
- **Place After**: Line 379 (after `hasCompletedReads` method)
- **Code**:
  ```typescript
  /**
   * Check if a book has any finished sessions (read or DNF)
   * Used for re-read validation
   */
  async hasFinishedSessions(bookId: number, tx?: any): Promise<boolean> {
    const database = tx || this.getDatabase();
    const result = database
      .select({ count: sql<number>`count(*)` })
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.bookId, bookId),
          or(
            eq(readingSessions.status, "read"),
            eq(readingSessions.status, "dnf")
          )
        )
      )
      .get();

    return (result?.count ?? 0) > 0;
  }
  ```
- **Status**: [ ] Not Started

#### Task 2.2: Update Repository Method - Find Most Recent Finished Session
- **File**: `lib/repositories/session.repository.ts`
- **Action**: Add new method `findMostRecentFinishedByBookId(bookId: number): Promise<ReadingSession | undefined>`
- **Logic**: Find most recent session with status "read" OR "dnf"
- **Place After**: Line 348 (after `findMostRecentCompletedByBookId` method)
- **Code**:
  ```typescript
  /**
   * Get most recent finished session (read or DNF) for a book
   * Used when starting a re-read to inherit userId
   */
  async findMostRecentFinishedByBookId(bookId: number): Promise<ReadingSession | undefined> {
    return this.getDatabase()
      .select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.bookId, bookId),
          or(
            eq(readingSessions.status, "read"),
            eq(readingSessions.status, "dnf")
          )
        )
      )
      .orderBy(desc(readingSessions.completedDate), desc(readingSessions.sessionNumber))
      .limit(1)
      .get();
  }
  ```
- **Status**: [ ] Not Started

#### Task 2.3: Update Session Service - Use hasFinishedSessions for Re-read Validation
- **File**: `lib/services/session.service.ts`
- **Line**: 385-387
- **Change**: Replace `hasCompletedReads` with `hasFinishedSessions`
- **Code**:
  ```typescript
  // OLD:
  const hasCompletedReads = await sessionRepository.hasCompletedReads(bookId);
  if (!hasCompletedReads) {
    throw new Error("Cannot start re-read: no completed reads found");
  }

  // NEW:
  const hasFinishedSessions = await sessionRepository.hasFinishedSessions(bookId);
  if (!hasFinishedSessions) {
    throw new Error("Cannot start re-read: book has not been finished");
  }
  ```
- **Status**: [ ] Not Started

#### Task 2.4: Update Session Service - Use findMostRecentFinishedByBookId
- **File**: `lib/services/session.service.ts`
- **Line**: 390
- **Change**: Replace `findMostRecentCompletedByBookId` with `findMostRecentFinishedByBookId`
- **Code**:
  ```typescript
  // OLD:
  const previousSession = await sessionRepository.findMostRecentCompletedByBookId(bookId);

  // NEW:
  const previousSession = await sessionRepository.findMostRecentFinishedByBookId(bookId);
  ```
- **Status**: [ ] Not Started

#### Task 2.5: Update API Route - Use hasFinishedSessions for Re-read Validation
- **File**: `app/api/books/[id]/reread/route.ts`
- **Lines**: 23-37
- **Change**: Replace `hasCompletedReads` with `hasFinishedSessions`, update error messages
- **Code**:
  ```typescript
  // OLD:
  const hasCompletedReads = await sessionRepository.hasCompletedReads(bookId);
  if (!hasCompletedReads) {
    // ... error messages about "completed reads"
  }

  // NEW:
  const hasFinishedSessions = await sessionRepository.hasFinishedSessions(bookId);
  if (!hasFinishedSessions) {
    if (existingActiveSession && (existingActiveSession.status === "to-read" || existingActiveSession.status === "read-next")) {
      return NextResponse.json(
        { error: "Can only re-read books that have been finished" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Cannot start re-read: book has not been finished" },
      { status: 400 }
    );
  }
  ```
- **Status**: [ ] Not Started

---

### Phase 3: Code Changes - Archive Previous Session During Re-read ✅ READY

**Objective**: Archive the previous finished session when starting a new re-read session

#### Task 3.1: Update Session Service - Archive Previous Session in startReread
- **File**: `lib/services/session.service.ts`
- **Lines**: 390-404
- **Change**: Add logic to archive the previous finished session before creating new session
- **Code**:
  ```typescript
  // Get most recent finished session to preserve userId
  const previousSession = await sessionRepository.findMostRecentFinishedByBookId(bookId);

  // Archive the previous finished session (NEW LOGIC)
  if (previousSession && previousSession.isActive) {
    await sessionRepository.update(previousSession.id, {
      isActive: false,
    } as any);
  }

  // Get next session number
  const sessionNumber = await sessionRepository.getNextSessionNumber(bookId);

  // Create new reading session (preserve userId from previous session)
  const newSession = await sessionRepository.create({
    bookId,
    sessionNumber,
    status: "reading",
    isActive: true,
    startedDate: await this.getTodayDateString(),
    userId: previousSession?.userId ?? null,
  });
  ```
- **Status**: [ ] Not Started

---

### Phase 4: Data Migration - Fix Existing Books ✅ READY

**Objective**: Reactivate the most recent finished session for books that currently have no active session

#### Task 4.1: Create Migration SQL Script
- **File**: `migrations/fix-dnf-active-sessions.sql` (new file)
- **Purpose**: Reactivate most recent session for books without active sessions
- **SQL**:
  ```sql
  -- Reactivate most recent session for books without active session
  UPDATE reading_sessions
  SET is_active = 1
  WHERE id IN (
    SELECT rs.id FROM reading_sessions rs
    WHERE rs.book_id IN (
      -- Books with no active session
      SELECT b.id FROM books b
      WHERE NOT EXISTS (
        SELECT 1 FROM reading_sessions WHERE book_id = b.id AND is_active = 1
      )
      AND b.orphaned = 0
    )
    AND rs.session_number = (
      SELECT MAX(session_number) FROM reading_sessions WHERE book_id = rs.book_id
    )
  );
  ```
- **Status**: [ ] Not Started

#### Task 4.2: Review Duplicate Sessions (Manual Cleanup Required)
- **Books**: #4 (Ten Arguments), #706 (Norwegian Wood)
- **Issue**: Multiple sessions with same final status
- **Action**: Manual review to decide which sessions to keep
- **Approach**: Keep most recent session, delete older duplicates
- **Status**: [ ] Not Started

#### Task 4.3: Run Migration
- **Command**: `sqlite3 /data/tome.db < migrations/fix-dnf-active-sessions.sql`
- **Verification**: Query to check all books have exactly one active session
- **Status**: [ ] Not Started

---

### Phase 5: Testing - Verify All Scenarios Work ✅ READY

**Objective**: Ensure the fix works for all affected books and doesn't break existing functionality

#### Task 5.1: Test DNF Display After Page Refresh
- **Test Books**: #1, #4, #698
- **Steps**:
  1. Navigate to book detail page
  2. Verify status shows "dnf"
  3. Refresh page
  4. Verify status still shows "dnf" (not "to-read")
- **Expected**: Status persists correctly
- **Status**: [ ] Not Started

#### Task 5.2: Test Read Display After Page Refresh
- **Test Books**: #703, #706
- **Steps**: Same as 5.1 but for "read" status
- **Expected**: Status persists correctly
- **Status**: [ ] Not Started

#### Task 5.3: Test Re-reading DNF Books
- **Test Books**: #1, #698
- **Steps**:
  1. Navigate to DNF book
  2. Click "Start Re-reading" button
  3. Verify new session created with status "reading"
  4. Verify previous DNF session is archived (is_active = 0)
  5. Mark new session as DNF or read
  6. Verify status persists after refresh
- **Expected**: Re-read workflow works for DNF books
- **Status**: [ ] Not Started

#### Task 5.4: Test Re-reading Completed Books
- **Test Books**: #703, #706
- **Steps**: Same as 5.3 but starting from "read" status
- **Expected**: Re-read workflow still works for completed books
- **Status**: [ ] Not Started

#### Task 5.5: Test Backward Movement (Reading → To-Read)
- **Create Test**: New book, start reading, add progress, move back to "to-read"
- **Expected**: Session archived, new session created
- **Status**: [ ] Not Started

#### Task 5.6: Run Full Test Suite
- **Command**: `npm test`
- **Expected**: All existing tests pass (2000+ tests)
- **Status**: [ ] Not Started

---

### Phase 6: Update Tests - Cover New DNF Re-read Scenarios 🔄 BLOCKED BY PHASE 1-3

**Objective**: Add test coverage for re-reading DNF books

#### Task 6.1: Add Test - hasFinishedSessions with DNF
- **File**: `__tests__/repositories/session.repository.test.ts`
- **Test Case**: Verify `hasFinishedSessions` returns true for DNF sessions
- **Status**: [ ] Not Started

#### Task 6.2: Add Test - Re-read DNF Book
- **File**: `__tests__/api/reread.test.ts`
- **Test Case**: Verify re-reading a DNF book creates new session and archives previous
- **Status**: [ ] Not Started

#### Task 6.3: Add Test - findMostRecentFinishedByBookId with DNF
- **File**: `__tests__/repositories/session.repository.test.ts`
- **Test Case**: Verify method returns most recent finished session (read or DNF)
- **Status**: [ ] Not Started

#### Task 6.4: Update Existing Tests - Fix Assertions on isActive
- **Files**: `__tests__/services/session/*.test.ts`
- **Action**: Update tests that assert `isActive = false` for "read" or "dnf" status
- **Status**: [ ] Not Started

---

## Technical Analysis Reference

### Key Findings from Codebase Exploration

#### 1. `is_active` Field Usage
- **Schema**: Unique index ensures only ONE active session per book (`is_active = 1`)
- **Current Semantics**: 
  - `is_active = 1` → Current/active session
  - `is_active = 0` → Archived/historical session (completed reads, DNF, or replaced)
- **Critical**: No code assumes `is_active = 0` means only "completed" - all code uses BOTH `isActive` and `status` to identify session type
- **Low Risk**: Changing archival logic won't break existing queries

#### 2. `hasCompletedReads` Field Usage
- **Definition**: Only checks for `status = 'read'`, not DNF
- **Usage**: 15 files (repos, services, API, UI, tests)
- **Decision**: Keep as-is, add separate `hasFinishedSessions` method
- **Rationale**: "Completed reads" has specific meaning (successfully finished), while "finished sessions" includes both completed and DNF

#### 3. Re-read Workflow
- **Prerequisites**: Book must have completed read (currently), no active session
- **Current Limitation**: DNF books cannot be re-read (button hidden)
- **Fix**: Use `hasFinishedSessions` instead of `hasCompletedReads` for re-read button visibility
- **Archival**: Currently, previous sessions are ALREADY archived when marked "read" - this will change to archive during re-read start

---

## Deployment Notes

### Pre-Deployment Checklist
- [ ] All code changes committed
- [ ] Full test suite passes (`npm test`)
- [ ] Migration SQL script reviewed
- [ ] Backup database before migration
- [ ] Manual review of duplicate sessions (books #4, #706)

### Post-Deployment Verification
- [ ] Verify affected books (5 books) show correct status
- [ ] Test re-reading DNF book
- [ ] Test re-reading completed book
- [ ] Check database: all non-orphaned books have exactly 1 active session

### Rollback Plan
If issues occur:
1. Restore database from backup
2. Revert code changes (4 files in Phase 1-3)
3. Investigate and adjust migration logic

---

## Open Questions & Decisions Made

### ✅ Resolved
1. **Q**: Should DNF books show "Start Re-reading" or "Try Reading Again"?  
   **A**: Use same text "Start Re-reading" (consistent UI)

2. **Q**: Should we rename `hasCompletedReads` to `hasFinishedSessions`?  
   **A**: Keep `hasCompletedReads`, add new `hasFinishedSessions` method

3. **Q**: When should sessions be archived?  
   **A**: Only when starting a new session (re-read), not when marking as terminal state

### ⚠️ Pending
1. **Q**: How to handle duplicate sessions (books #4, #706)?  
   **A**: Manual review during Phase 4 - need user input on which sessions to keep

---

## Files Modified

### Code Changes (3 files)
1. `lib/services/session.service.ts` - 5 changes (Tasks 1.1, 1.2, 2.3, 2.4, 3.1)
2. `lib/repositories/session.repository.ts` - 2 new methods (Tasks 2.1, 2.2)
3. `app/api/books/[id]/reread/route.ts` - 1 change (Task 2.5)

### New Files (1 file)
4. `migrations/fix-dnf-active-sessions.sql` - Migration script (Task 4.1)

### Test Updates (3+ files)
5. `__tests__/repositories/session.repository.test.ts` - New tests (Tasks 6.1, 6.3)
6. `__tests__/api/reread.test.ts` - New test (Task 6.2)
7. `__tests__/services/session/*.test.ts` - Update assertions (Task 6.4)

---

## Estimated Effort

| Phase | Complexity | Time Estimate |
|-------|-----------|---------------|
| Phase 1 | Low | 15 minutes |
| Phase 2 | Medium | 30 minutes |
| Phase 3 | Low | 15 minutes |
| Phase 4 | Medium | 30 minutes (includes manual review) |
| Phase 5 | Medium | 45 minutes |
| Phase 6 | Medium | 1 hour |
| **Total** | | **~3 hours** |

---

## Success Criteria

✅ All 5 affected books show correct status after page refresh  
✅ DNF books show "Start Re-reading" button  
✅ Re-reading DNF books creates new session and archives previous  
✅ All 2000+ tests pass  
✅ No books have multiple active sessions (database integrity)  
✅ Backward movement (reading → to-read) still works correctly
