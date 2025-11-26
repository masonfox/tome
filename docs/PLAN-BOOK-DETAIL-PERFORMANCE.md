# Book Detail Page Performance Optimization Plan

**GitHub Issue:** #17 - Performance optimization for Book Detail page

## Problem Summary

The Book Detail page exhibits sluggish performance due to:

1. **Backend Query Inefficiency**: `enrichBookWithDetails()` makes 3 sequential database queries per book fetch (activeSession, latestProgress, totalReads count)
2. **Excessive Refetching**: Every user action triggers full page refetch via `router.refresh()` + `refetchBook()` + `refetchProgress()`
3. **Missing React Optimizations**: No memoization across 9 components, causing unnecessary re-renders
4. **N+1 Query Pattern**: Sessions endpoint makes 1+N queries when loading multiple sessions with progress

## Performance Impact Assessment

- **Database queries per page action**: 4-6 queries (1 book + 3 enrichment + 1 progress + optional sessions)
- **Network requests per user interaction**: 2-3 API calls
- **Component re-renders**: All 9 components re-render on any state change

## Implementation Scope

**Focus:** Phase 1 - Backend Query Optimization (HIGH IMPACT)
**Approach:** Direct replacement (no feature flags)
**Testing:** Comprehensive test suite

**Note:** Additional optimization phases (eliminating refetches, React memoization, state consolidation) are documented below for future reference but not in current scope.

## Phased Optimization Approach

---

## Phase 1: Backend Query Optimization (HIGH IMPACT)

**Objective:** Reduce database queries from 3 to 1 for book detail enrichment

**Expected Impact:**
- 66% reduction in book detail queries (3 → 1)
- 200-400ms faster page loads
- Significantly reduced database load

### Changes

#### 1.1 Create Optimized Single-Query Book Enrichment

**File:** `/home/masonfox/git/tome/lib/services/book.service.ts`

Create `getBookByIdOptimized()` method that uses a single query with LEFT JOINs and subqueries to fetch:
- Book data
- Active session (or most recent completed)
- Latest progress for that session
- Count of completed reads

**Pattern to follow:** Mirror the approach from `findWithFiltersAndRelations()` in the book list endpoint (lines 394-559 in book.repository.ts), which successfully reduced queries from 101+ to 1.

**Implementation approach:**
- Use `sql` template literals for correlated subqueries
- LEFT JOIN from books → sessions → progress_logs
- Use subqueries to select the appropriate session (active, or most recent)
- Aggregate for totalReads count
- Return structured object matching `BookWithDetails` interface

#### 1.2 Fix N+1 Pattern in Sessions Endpoint

**Files:**
- `/home/masonfox/git/tome/app/api/books/[id]/sessions/route.ts`
- `/home/masonfox/git/tome/lib/repositories/session.repository.ts`

**Current issue:** Lines 27-64 execute 1 query for sessions + N queries for progress per session

**Solution:**
- Create `SessionRepository.findAllByBookIdWithProgress()` method
- Use single query with GROUP BY and aggregates:
  - `COUNT(pl.id)` for totalEntries
  - `SUM(pl.pages_read)` for totalPagesRead
  - `MAX(pl.progress_date)` for lastProgressDate
  - Window functions or subqueries for latest progress details

#### 1.3 Implementation Strategy

**Approach:** Direct replacement of existing implementation
- Replace `enrichBookWithDetails()` method with optimized version
- Update API endpoint to use new method
- Remove old 3-query implementation after validation

### Testing (Comprehensive)

**Unit Tests:**
- Test optimized query returns correct data structure
- Test `BookWithDetails` interface compatibility
- Test edge cases:
  - Book with no sessions
  - Book with active session but no progress
  - Book with completed reads only
  - Book with multiple archived sessions
  - Book with both active and completed sessions
- Verify activeSession selection logic (prefers active, falls back to most recent)
- Verify totalReads count accuracy
- Verify latestProgress selection for active session

**Integration Tests:**
- Test full API endpoint with optimized service method
- Compare response format matches previous implementation
- Test with various book states from actual database
- Verify correct HTTP status codes (200, 404, 500)
- Test error handling for invalid book IDs

**Performance Tests:**
- Enable SQLite query logging to count queries
- Verify single query execution (not 3)
- Measure response time improvement (target: 200-400ms faster)
- Load test with multiple concurrent requests
- Test with books having large amounts of progress data

**Data Validation:**
- Run optimized query against existing books
- Compare results with current implementation
- Verify all fields match expected values
- Test data integrity after optimization

**Critical Files:**
- `/home/masonfox/git/tome/lib/services/book.service.ts:123-143`
- `/home/masonfox/git/tome/app/api/books/[id]/route.ts:8-31`
- `/home/masonfox/git/tome/lib/repositories/session.repository.ts`
- `/home/masonfox/git/tome/app/api/books/[id]/sessions/route.ts:27-64`

---

## Phase 2: Eliminate Unnecessary Refetches (HIGH IMPACT)

**Objective:** Remove full page refresh pattern and implement optimistic updates

**Expected Impact:**
- 40-60% reduction in API calls per user action
- <50ms time to visual feedback (from 150-300ms)
- Immediate UI responsiveness

### Changes

#### 2.1 Remove router.refresh() Calls

**File:** `/home/masonfox/git/tome/app/books/[id]/page.tsx`

- Remove `router.refresh()` from `handleRefresh()` function (line 83)
- Remove `router.refresh()` from `handleTotalPagesSubmit()` (line 109)
- Keep only targeted refetches where necessary

#### 2.2 Implement Optimistic Updates

**Files:**
- `/home/masonfox/git/tome/hooks/useBookProgress.ts`
- `/home/masonfox/git/tome/hooks/useBookStatus.ts`
- `/home/masonfox/git/tome/hooks/useBookRating.ts`

**Pattern for each hook:**
1. Update local state immediately when user acts (optimistic update)
2. Make API call in background
3. On success: replace optimistic with server response
4. On failure: rollback to previous state + show error toast

**Example for progress logging (useBookProgress.ts:189-213):**
```typescript
// Before API call - optimistic update:
const optimisticEntry = {
  id: Date.now(), // temp ID
  currentPage: parseInt(currentPage),
  currentPercentage: parseFloat(currentPercentage),
  progressDate,
  notes,
  pagesRead: 0 // will be calculated by server
};
setProgress([optimisticEntry, ...progress]);

// Make API call
const response = await fetch(`/api/books/${bookId}/progress`, {...});

if (response.ok) {
  const actualEntry = await response.json();
  setProgress(prev => [actualEntry, ...prev.slice(1)]); // Replace temp with real
} else {
  setProgress(progress); // Rollback on error
  toast.error(errorData.error || "Failed to log progress");
}
```

#### 2.3 Add Partial Update Method

**File:** `/home/masonfox/git/tome/hooks/useBookDetail.ts`

Add method to update specific book fields without full refetch:
```typescript
updateBookPartial(updates: Partial<Book>) {
  setBook(prev => prev ? { ...prev, ...updates } : null);
}
```

Use for rating changes, status changes, totalPages updates instead of refetching entire book.

### Testing

- Verify immediate UI feedback (<50ms)
- Test network failure scenarios and rollback
- Test rapid successive updates
- Count API calls per action (should be 1, not 3+)
- Functional testing for all user interactions

**Critical Files:**
- `/home/masonfox/git/tome/app/books/[id]/page.tsx:80-84,102-110`
- `/home/masonfox/git/tome/hooks/useBookProgress.ts:189-213`
- `/home/masonfox/git/tome/hooks/useBookStatus.ts`
- `/home/masonfox/git/tome/hooks/useBookRating.ts`

---

## Phase 3: React Component Optimization (MEDIUM IMPACT)

**Objective:** Prevent unnecessary component re-renders with memoization

**Expected Impact:**
- 30-50% reduction in component re-renders
- Smoother UI interactions
- Better performance on lower-end devices

### Changes

#### 3.1 Memoize BookDetail Sub-Components

**Files in `/home/masonfox/git/tome/components/BookDetail/`:**
- `BookHeader.tsx` - Wrap with React.memo + custom comparison
- `BookMetadata.tsx` - Wrap with React.memo
- `BookProgress.tsx` - Wrap with React.memo
- `ProgressHistory.tsx` - Wrap with React.memo
- `SessionDetails.tsx` - Wrap with React.memo

**Pattern:**
```typescript
import React from 'react';

const BookHeader = React.memo(({ book, selectedStatus, ... }: Props) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for complex props
  return prevProps.book.id === nextProps.book.id &&
         prevProps.selectedStatus === nextProps.selectedStatus &&
         prevProps.rating === nextProps.rating;
});

export default BookHeader;
```

#### 3.2 Memoize Derived Values

**File:** `/home/masonfox/git/tome/app/books/[id]/page.tsx`

Add useMemo for computed values:
```typescript
const progressPercentage = useMemo(() => {
  if (!book?.totalPages || bookProgressHook.progress.length === 0) return 0;
  const latest = bookProgressHook.progress[0];
  return Math.round((latest.currentPage / book.totalPages) * 100);
}, [book?.totalPages, bookProgressHook.progress]);

const hasActiveProgress = useMemo(() => {
  return selectedStatus === "reading" &&
         book?.activeSession &&
         bookProgressHook.progress.length > 0;
}, [selectedStatus, book?.activeSession, bookProgressHook.progress.length]);
```

Locations that calculate values repeatedly:
- Lines 258-263: Progress percentage calculation
- Lines 269-271: Progress bar width calculation

#### 3.3 Wrap Page-Level Callbacks with useCallback

**File:** `/home/masonfox/git/tome/app/books/[id]/page.tsx`

Ensure callbacks passed to child components are stable:
```typescript
const handleRefresh = useCallback(() => {
  refetchBook();
  bookProgressHook.refetchProgress();
  // router.refresh() removed in Phase 2
}, [refetchBook, bookProgressHook.refetchProgress]);

const handleTotalPagesSubmit = useCallback(async (e: React.FormEvent) => {
  e.preventDefault();
  if (!totalPagesInput || parseInt(totalPagesInput) <= 0) return;
  await updateTotalPages(parseInt(totalPagesInput));
  setTotalPagesInput("");
  toast.success("Pages updated");
}, [totalPagesInput, updateTotalPages]);
```

Note: Hook callbacks in useBookProgress.ts already use useCallback ✓

#### 3.4 Optimize ReadingHistoryTab

**File:** `/home/masonfox/git/tome/components/ReadingHistoryTab.tsx`

- Extract session card as separate memoized component
- Only re-render changed sessions
- Memoize session list rendering

### Testing

- Use React DevTools Profiler to measure render counts
- Before/after flame graphs
- Verify no functional regressions
- Test that only affected components re-render per action

**Critical Files:**
- `/home/masonfox/git/tome/components/BookDetail/*.tsx` (5 components)
- `/home/masonfox/git/tome/components/ReadingHistoryTab.tsx`
- `/home/masonfox/git/tome/app/books/[id]/page.tsx`

---

## Phase 4: State Consolidation (OPTIONAL - MEDIUM-LOW IMPACT)

**Objective:** Reduce state duplication through centralized state management

**Expected Impact:**
- Cleaner architecture
- Fewer synchronization bugs
- 10-20% reduction in memory usage
- Easier future maintenance

### Approach

Create React Context to consolidate state from multiple hooks:

**Current State Distribution:**
- `useBookDetail`: book, loading, imageError
- `useBookProgress`: progress array, form state
- `useBookStatus`: selectedStatus, confirmation modals
- `useBookRating`: showRatingModal
- `useSessionDetails`: session editing state

**Proposed Architecture:**
- Create `BookDetailContext.tsx` with unified state
- Wrap page in context provider
- Hooks consume context instead of managing independent state
- Reduces prop drilling (page passes 10+ props to BookProgress)
- Maintains hook API for minimal refactoring

### Changes

**New File:** `/home/masonfox/git/tome/contexts/BookDetailContext.tsx`

**Modified Files:**
- `/home/masonfox/git/tome/app/books/[id]/page.tsx` - Wrap in provider
- All hooks - Consume context
- All BookDetail components - Read from context instead of props

### Risks

- Large refactoring with potential for bugs
- Should only be done AFTER Phases 1-3 are stable
- Requires comprehensive testing
- Consider feature flag for gradual migration

### Testing

- All existing functionality must work identically
- Test state propagation across components
- Verify no synchronization issues
- Integration tests for context provider

**Note:** This phase is optional and can be deferred. Phases 1-3 provide the majority of performance gains.

---

## Phase 1 Success Metrics

**Performance Targets:**
- Database queries for book detail: 3 → 1 (66% reduction)
- Database queries for sessions endpoint: 1+N → 1 (eliminates N+1 pattern)
- Initial page load time: 200-400ms faster
- Sessions endpoint response: Faster with multiple sessions

**Measurement Approach:**
- Enable SQLite query logging: Add logging to repository methods
- Before/after query count comparison
- Response time benchmarks with `performance.now()`
- Test with various book states (0, 1, 5, 10+ sessions)

**Validation Criteria:**
- All existing tests pass
- New tests achieve >90% coverage on optimized methods
- Performance benchmarks show expected improvements
- Manual testing confirms UI functions identically
- No data inconsistencies in responses

## Phase 1 Risk Mitigation

**Primary Risk:** Complex JOIN query returns incorrect data for edge cases

**Mitigation Strategies:**
1. **Comprehensive test coverage** - Test all edge cases listed above
2. **Side-by-side validation** - During development, temporarily run both queries and compare results
3. **Data validation script** - Create a validation script to test optimized query against random sample of books
4. **Manual verification** - Test with actual books from database in all states
5. **Incremental implementation** - Implement and test each part of the query separately before combining

**Secondary Risk:** Query performance regression with large datasets

**Mitigation:**
- Test with books having many sessions and progress entries
- Verify indexes are utilized (use EXPLAIN QUERY PLAN)
- Monitor query execution time during testing

## Implementation Timeline

**Estimated Duration:** 3-5 days

**Day 1-2:** Implementation
- Create optimized query for book enrichment
- Create optimized query for sessions endpoint
- Update service and repository methods
- Update API endpoints to use new methods

**Day 3:** Testing
- Write comprehensive unit tests
- Write integration tests
- Run full test suite
- Fix any issues discovered

**Day 4:** Validation & Performance
- Performance benchmarking
- Data validation against existing implementation
- Manual testing of all book states
- Query logging and verification

**Day 5:** Cleanup & Documentation
- Remove old implementation code
- Update any related documentation
- Code review
- Final validation

---

## Future Optimization Phases (Reference Only)

The following phases are documented for future consideration but are **not in current scope**:

- **Phase 2:** Eliminate Unnecessary Refetches (HIGH IMPACT) - Remove router.refresh(), add optimistic updates
- **Phase 3:** React Component Optimization (MEDIUM IMPACT) - Add React.memo and useMemo
- **Phase 4:** State Consolidation (OPTIONAL) - Refactor to React Context

See sections above for detailed plans on these future phases.
