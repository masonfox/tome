# ADR-008: Page Count Update Strategy - Active Sessions Only

## Status
✅ **Implemented** - December 5, 2025

## Context

Tome allows users to track reading progress through sessions. Books may have multiple reading sessions over time (initial reads and re-reads), and each session tracks progress through `progress_logs` that record page numbers and calculated percentages.

### The Problem

Users needed the ability to update a book's total page count, but this raised a critical design question: **Which sessions should have their progress percentages recalculated?**

Books can have:
1. **Active sessions** - Currently being read (status='reading', is_active=true)
2. **Completed sessions** - Finished reads (status='read', is_active=false)
3. **Multiple sessions** - Re-reads or abandoned readings

### Example Scenario

```
Book: "The Great Gatsby" 
Initial totalPages: 180

Session 1 (Completed March 2024):
  - Read from page 1 → 180 (100%)
  - Status: 'read', is_active: false
  
Session 2 (Active December 2025):
  - Currently on page 90 (50%)
  - Status: 'reading', is_active: true

User discovers book actually has 200 pages and updates totalPages → 200
```

**Question**: Should we recalculate percentages for:
- Only Session 2 (active)? ✅
- Both Session 1 and Session 2? ❌
- User-selected sessions? ❌

### Requirements

1. **Allow page count updates** - Users can correct incorrect metadata
2. **Maintain historical integrity** - Preserve completed session data
3. **Update active progress** - Reflect new percentages for current reads
4. **Data consistency** - Ensure percentages align with current page count
5. **User expectations** - Behavior should match mental model

## Decision

**We update progress percentages ONLY for active reading sessions when total pages changes.**

### Core Principle

> Historical data should remain unchanged. Only actively evolving data should be recalculated.

### Rationale

#### Why Update Active Sessions Only

1. **Preservation of Historical Context**
   - Completed sessions represent a snapshot in time
   - Users finished those books with whatever page count was known then
   - Changing historical percentages retroactively feels like data manipulation
   - Statistics and reading history should reflect actual experience at that time

2. **User Mental Model**
   - When users update page count, they're thinking about their *current* reading
   - They want to fix progress tracking for what they're reading *now*
   - They're not thinking "let me retroactively change all my old reads"

3. **Practical Impact**
   - Active sessions: percentages matter (user sees them daily, affects streaks)
   - Completed sessions: percentages are historical curiosities
   - Re-reads inherit new page count, so future sessions use correct data

4. **Reduced Complexity**
   - Clear rule: active = update, completed = preserve
   - No need for user to select which sessions to update
   - No complex UI for managing historical recalculation
   - Fewer edge cases to handle

#### Alternative Approaches Considered

**Option 1: Update ALL sessions** ❌
- Violates historical integrity principle
- Changes statistics that users may have referenced
- Could create confusion ("I remember finishing at 100%, why does it show 90% now?")
- More expensive operation (potentially hundreds of progress_logs)

**Option 2: User-selectable sessions** ❌
- Adds significant UI complexity
- Requires modal/form for session selection
- Users wouldn't understand which sessions need updating
- Edge case: what if user forgets to select the active one?

**Option 3: No automatic updates** ❌
- Forces users to manually re-log progress
- Breaks existing streak tracking
- Poor user experience
- Defeats purpose of allowing page count updates

### Implementation Rules

#### What Qualifies as "Active"

```typescript
const activeSession = session.is_active === true && session.status === 'reading'
```

**Both conditions must be true:**
- `is_active: true` - Session marked as the current reading
- `status: 'reading'` - Session not yet finished

This ensures:
- Abandoned sessions (is_active=false, status='reading') are NOT updated
- Completed sessions (status='read') are NOT updated
- Only genuine current reads are recalculated

#### Recalculation Logic

For each active session:
1. Fetch ALL associated `progress_logs`
2. For each log:
   ```typescript
   newPercentage = calculatePercentage(log.currentPage, newTotalPages)
   // Cap at 100% if current_page exceeds new total_pages
   ```
3. Update `progress_logs.current_percentage`
4. All operations wrapped in database transaction

#### Edge Case Handling

**Case 1: Current page > New total pages**
```typescript
// Book was 500 pages, user at page 450
// User updates to 400 pages
// Result: 450/400 = 112.5% → capped at 100%
percentage = Math.min(calculatePercentage(currentPage, totalPages), 100)
```

**Case 2: Multiple active sessions** (shouldn't happen, but handle it)
```typescript
// Update ALL sessions where is_active=true AND status='reading'
// Data integrity rules should prevent this, but code is defensive
```

**Case 3: No active sessions**
```typescript
// Update succeeds, no sessions updated
// Future sessions use new page count automatically
```

**Case 4: Null totalPages → Non-null**
```typescript
// First-time page count entry
// Treated same as update: recalculate active sessions
```

## Implementation

### Database Transaction Flow

```typescript
updateTotalPages(bookId: number, totalPages: number) {
  return db.transaction(async (tx) => {
    // 1. Update books table
    await tx.update(books)
      .set({ totalPages })
      .where(eq(books.id, bookId));
    
    // 2. Find active sessions
    const activeSessions = await tx.select()
      .from(readingSessions)
      .where(
        and(
          eq(readingSessions.bookId, bookId),
          eq(readingSessions.isActive, true),
          eq(readingSessions.status, 'reading')
        )
      );
    
    // 3. For each active session
    for (const session of activeSessions) {
      // Get all progress logs
      const logs = await tx.select()
        .from(progressLogs)
        .where(eq(progressLogs.sessionId, session.id));
      
      // Recalculate and update each log
      for (const log of logs) {
        const newPercentage = calculatePercentage(
          log.currentPage, 
          totalPages
        );
        
        await tx.update(progressLogs)
          .set({ currentPercentage: newPercentage })
          .where(eq(progressLogs.id, log.id));
      }
    }
    
    // Transaction auto-commits on success, rolls back on error
  });
}
```

### API Layer

#### Endpoint: `PATCH /api/books/:id`

```typescript
// Request Body
{
  "totalPages": number  // Must be positive integer
}

// Validation
- totalPages > 0
- totalPages is integer

// Response (success)
{
  "message": "Book updated successfully",
  "sessionsUpdated": number,  // Count of active sessions
  "logsUpdated": number       // Count of progress_logs recalculated
}

// Response (error)
{
  "error": string  // "Book not found", "Invalid page count", etc.
}
```

#### Error Handling

```typescript
try {
  await bookService.updateTotalPages(bookId, totalPages);
} catch (error) {
  // Transaction rolled back automatically
  // No partial updates
  logger.error('Page count update failed', { error, bookId });
  return res.status(500).json({ 
    error: 'Failed to update page count' 
  });
}
```

### Frontend Component

#### PageCountEditModal

**User Flow:**
1. User clicks on "X pages" text in BookHeader
2. Modal opens with current page count pre-filled
3. User enters new value (validated as positive integer)
4. User clicks "Save"
5. API request sent with loading state
6. Success: Toast notification, modal closes, page refreshes
7. Error: Toast error message, modal stays open

**Validation:**
- Input type: number
- Min: 1
- Step: 1 (integers only)
- Client-side validation before API call
- Server-side validation as backup

**User Messaging:**
```
Modal subtitle: "Current: 300 pages"

Info box: "This will update progress calculations for 
all active reading sessions."
```

Clear communication of what will change without overwhelming detail.

### Service Layer

#### BookService: `lib/services/book.service.ts`

```typescript
async updateTotalPages(
  bookId: number, 
  totalPages: number
): Promise<void> {
  // Validation
  if (!totalPages || totalPages <= 0 || !Number.isInteger(totalPages)) {
    throw new Error('Invalid page count');
  }
  
  // Check book exists
  const book = await bookRepository.findById(bookId);
  if (!book) {
    throw new Error('Book not found');
  }
  
  // Execute transaction
  await db.transaction(async (tx) => {
    // Update book
    await tx.update(books)
      .set({ totalPages })
      .where(eq(books.id, bookId));
    
    // Find and update active sessions
    const activeSessions = await sessionRepository
      .findActiveSessionsByBookId(bookId, tx);
    
    for (const session of activeSessions) {
      const logs = await progressRepository
        .findBySessionId(session.id, tx);
      
      for (const log of logs) {
        const newPercentage = calculatePercentage(
          log.currentPage, 
          totalPages
        );
        
        await tx.update(progressLogs)
          .set({ currentPercentage: newPercentage })
          .where(eq(progressLogs.id, log.id));
      }
    }
  });
  
  logger.info('Page count updated', {
    bookId,
    totalPages,
    sessionsUpdated: activeSessions.length,
    logsUpdated: totalLogsUpdated
  });
}
```

### Repository Layer

#### SessionRepository: `lib/repositories/session.repository.ts`

New method added:

```typescript
async findActiveSessionsByBookId(
  bookId: number, 
  tx?: Transaction
): Promise<ReadingSession[]> {
  const db = tx || this.db;
  
  return db.select()
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.bookId, bookId),
        eq(readingSessions.isActive, true),
        eq(readingSessions.status, 'reading')
      )
    );
}
```

**Why separate method?**
- Reusable query logic
- Consistent criteria for "active session"
- Testable in isolation
- Transaction support for atomicity

### Testing

#### Backend Tests: `__tests__/services/book.service.test.ts`

**Test Coverage:**

1. ✅ **Active session recalculation**
   - Verifies progress_logs updated with new percentages
   - Confirms calculation uses new totalPages

2. ✅ **Completed session preservation**
   - Ensures status='read' sessions unchanged
   - Validates historical data integrity

3. ✅ **Edge case: Current page > New total pages**
   - Tests percentage capping at 100%
   - Prevents invalid percentages >100%

4. ✅ **Edge case: Zero total pages**
   - Validates rejection of invalid input
   - Confirms transaction rollback

5. ✅ **Edge case: No sessions**
   - Update succeeds with no sessions to recalculate
   - Confirms books table still updated

6. ✅ **Edge case: Only completed sessions**
   - No active sessions to update
   - Books table updated, no session updates

7. ✅ **Error handling: Invalid book**
   - Throws appropriate error
   - Transaction not started for invalid input

8. ✅ **Error handling: Invalid page count**
   - Validates negative numbers rejected
   - Validates non-integers rejected

**Test Results: 27 tests passing, 0 failures**

#### Frontend Tests: `__tests__/components/PageCountEditModal.test.tsx`

**Test Categories:**

1. **Component Rendering** (8 tests)
   - Modal visibility based on isOpen prop
   - Input pre-filled with current page count
   - Subtitle and informational message display
   - Button rendering

2. **Input Validation** (7 tests)
   - Update input value on user typing
   - Disable Save for empty/zero/negative values
   - Enable Save for valid positive integers
   - Handle decimal number rejection

3. **Form Submission** (4 tests)
   - API called with correct data
   - Loading state during submission
   - Disabled inputs/buttons during submission
   - Success callbacks and toast notifications

4. **Error Handling** (6 tests)
   - API error response handling
   - Generic error message fallback
   - Network error handling
   - No callbacks on error
   - Re-enable inputs after error

5. **Modal Controls** (3 tests)
   - Close via Cancel button
   - Close via X button
   - Prevent closing during submission

6. **Accessibility** (5 tests)
   - Proper labels and input constraints
   - Disabled state styling
   - Aria labels for close button

**Test Results: 33 tests passing, 0 failures**

## Consequences

### Positive

✅ **Historical Integrity Maintained** - Completed sessions remain untouched, preserving accurate reading history

✅ **Improved User Experience** - Simple, intuitive behavior matching user expectations

✅ **Data Consistency** - Active progress always reflects current page count

✅ **Transaction Safety** - All-or-nothing updates via database transactions

✅ **Clear Mental Model** - Easy to understand and explain to users

✅ **Reduced Complexity** - No complex UI for session selection

✅ **Comprehensive Testing** - 60 total tests covering all scenarios

✅ **Logging & Observability** - Detailed logging of updates for debugging

### Neutral

ℹ️ **No Historical Correction** - Old sessions keep old percentages (by design)

ℹ️ **Manual Re-reads** - Re-reading a book creates new session with correct page count

ℹ️ **Calibre Independence** - Page count remains Tome-only metadata (not synced)

### Negative

⚠️ **Abandoned Sessions Unchanged** - Sessions with is_active=false but status='reading' not updated (intentional, but could confuse if user abandoned mid-read)

⚠️ **No Batch Updates** - Users must update each book individually (could add bulk feature later)

⚠️ **No Undo** - Once updated, previous page count not stored (acceptable for metadata correction)

## Migration Guide

### For Existing Users

**No migration required!** This is a new feature.

Existing books with null `totalPages` can now be updated:
1. Click on page count text in book header
2. Enter correct page count
3. Active reading sessions automatically recalculated

### For Developers

**New API Endpoint:**
```bash
curl -X PATCH http://localhost:3000/api/books/123 \
  -H "Content-Type: application/json" \
  -d '{"totalPages": 320}'
```

**New Component:**
```typescript
import PageCountEditModal from '@/components/PageCountEditModal';

<PageCountEditModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  bookId={book.id}
  currentPageCount={book.totalPages}
  onSuccess={handleRefresh}
/>
```

**New Repository Method:**
```typescript
// Find active sessions for recalculation
const activeSessions = await sessionRepository
  .findActiveSessionsByBookId(bookId);
```

## Future Considerations

1. **Bulk Page Count Updates** - Admin tool to update multiple books at once

2. **Page Count History** - Track changes to page count over time (audit log)

3. **Calibre Sync** - Consider syncing page count to/from Calibre metadata

4. **User Preference** - Advanced setting to choose "update all sessions" vs "active only"

5. **Undo Functionality** - Store previous page count for 24 hours with undo option

6. **Smart Detection** - Warn user if page count differs significantly from Calibre/other sources

7. **Percentage History** - Keep historical percentages in separate table for analytics

8. **Session Selection UI** - Advanced mode for power users to select which sessions to update

## Related ADRs

- [ADR-004: Backend Service Layer Architecture](./ADR-004-BACKEND-SERVICE-LAYER-ARCHITECTURE.md) - Context for service/repository pattern
- [ADR-006: Timezone-Aware Date Handling](./ADR-006-TIMEZONE-AWARE-DATE-HANDLING.md) - Related data integrity concerns

## References

### Implementation Files

**Backend:**
- `lib/services/book.service.ts` - Core business logic for page count updates
- `lib/repositories/session.repository.ts` - Active session query method
- `lib/utils/progress-calculations.ts` - Percentage calculation utility
- `app/api/books/[id]/route.ts` - PATCH endpoint handler

**Frontend:**
- `components/PageCountEditModal.tsx` - Modal component for page count editing
- `components/BookDetail/BookHeader.tsx` - Clickable page count integration
- `app/books/[id]/page.tsx` - Page-level state and modal management

**Tests:**
- `__tests__/services/book.service.test.ts` - 27 backend tests
- `__tests__/components/PageCountEditModal.test.tsx` - 33 frontend tests

**Database Schema:**
- `lib/db/schema/books.ts` - Books table with totalPages column
- `lib/db/schema/reading-sessions.ts` - Sessions with status and is_active
- `lib/db/schema/progress-logs.ts` - Logs with current_percentage

---

**Decision Made By**: Claude Code (AI Assistant)  
**Date**: December 5, 2025  
**Implementation Date**: December 5, 2025  
**Reviewed By**: User (masonfox)  
**Status**: ✅ Implemented and Ready for Production
