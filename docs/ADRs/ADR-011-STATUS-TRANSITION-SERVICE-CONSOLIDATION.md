# ADR-011: Status Transition Service Consolidation

**Status:** Accepted
**Date:** 2025-12-29
**Deciders:** Development Team
**Related ADRs:**
- [ADR-004: Backend Service Layer Architecture](./ADR-004-BACKEND-SERVICE-LAYER-ARCHITECTURE.md)
- [ADR-010: Hybrid API Client Architecture](./ADR-010-HYBRID-API-CLIENT-ARCHITECTURE.md)

---

## Context

The book status transition logic was duplicated across multiple layers of the application:

1. **SessionService** (`lib/services/session.service.ts`) - Used by API routes
   - Handled session lifecycle, status transitions, backward movement detection
   - Complex orchestration for marking books as read
   - Direct database access via repositories

2. **useBookStatus Hook** (`hooks/useBookStatus.ts`) - Used by React components
   - 534 lines of code including 8 helper functions
   - Orchestrated multiple API calls for status transitions
   - Duplicated business logic from SessionService
   - Made direct HTTP requests via bookApi client

3. **API Routes** (`app/api/books/[id]/*/route.ts`)
   - Status route, rating route, progress route
   - Some duplicated Calibre sync and cache invalidation logic

### Problems Identified

1. **Code Duplication**: The "mark as read" flow was implemented differently in:
   - Hook: 8 helper functions orchestrating API calls
   - Service: Similar orchestration with repository access
   - Result: Two sources of truth for the same business logic

2. **Maintenance Burden**: Changes to status transition logic required updates in multiple places:
   - SessionService for API route behavior
   - useBookStatus helpers for UI behavior
   - Risk of inconsistencies between layers

3. **Testing Complexity**:
   - Hook tests slower (React rendering overhead)
   - Business logic couldn't be tested independently of React
   - Harder to achieve comprehensive test coverage

4. **Architectural Misalignment**:
   - Hooks contained business logic (violates separation of concerns)
   - Service layer underutilized from client code
   - No clear single source of truth

### Requirements

- **Single Source of Truth**: Business logic centralized in service layer
- **Reusability**: Services usable from API routes, hooks, and future CLI tools
- **Testability**: Business logic independently testable without UI
- **Maintainability**: Changes in one place, consistent behavior everywhere
- **Type Safety**: End-to-end type safety from client to service
- **Client-Server Separation**: Hooks can't import server-side dependencies

---

## Decision

We will **consolidate all book status transition business logic into SessionService** and create a proper client-server separation via a new API endpoint.

### Architecture Changes

#### 1. Enhanced SessionService (Server-Side)

**File**: `lib/services/session.service.ts`

Added six new public methods to SessionService:

```typescript
/**
 * Ensures a book is in "reading" status, creating session if needed
 */
async ensureReadingStatus(bookId: number): Promise<ReadingSession>

/**
 * Creates 100% progress entry (triggers auto-completion to "read")
 */
async create100PercentProgress(bookId: number, totalPages: number, completedDate?: Date): Promise<void>

/**
 * Updates book rating in books table (with Calibre sync)
 */
async updateBookRating(bookId: number, rating: number | null): Promise<void>

/**
 * Updates review on a reading session
 */
async updateSessionReview(sessionId: number, review: string): Promise<ReadingSession>

/**
 * Finds most recent completed session for a book
 */
async findMostRecentCompletedSession(bookId: number): Promise<ReadingSession | null>

/**
 * Unified orchestration for marking a book as "read"
 * Handles: status transition, progress creation, rating, review
 */
async markAsRead(params: MarkAsReadParams): Promise<MarkAsReadResult>
```

**Key Design Principles**:
- **Composability**: Small, focused methods that can be combined
- **Best-Effort Error Handling**: Rating/review failures don't fail main operation
- **Intelligent Defaults**: Handles books with/without pages gracefully
- **Comprehensive Results**: Returns flags indicating what was updated

**markAsRead() Orchestration Logic**:
```typescript
interface MarkAsReadParams {
  bookId: number;
  rating?: number;
  review?: string;
  completedDate?: Date;
}

interface MarkAsReadResult {
  session: ReadingSession;
  ratingUpdated: boolean;
  reviewUpdated: boolean;
  progressCreated: boolean;
}
```

Flow:
1. Get book and check current status
2. If NOT already read:
   - If has totalPages AND no 100% progress: Create 100% progress (auto-completes)
   - If has totalPages AND has 100% progress: Direct status update to "read"
   - If no totalPages: Direct status update (bypasses validation)
3. If already read: Find most recent completed session
4. Update rating (best-effort, syncs to Calibre)
5. Update review (best-effort)
6. Return detailed result

#### 2. New API Endpoint (Server-Side)

**File**: `app/api/books/[id]/mark-as-read/route.ts`

Created dedicated endpoint for "mark as read" orchestration:
- **Method**: POST
- **Path**: `/api/books/:id/mark-as-read`
- **Request**: `{ rating?: number, review?: string, completedDate?: Date }`
- **Response**: `MarkAsReadResult`

Handles:
- Input validation (rating 1-5, whole number)
- Calls `sessionService.markAsRead()`
- Error handling and logging
- Cache invalidation (via SessionService)

#### 3. Extended bookApi Client (Client-Side)

**File**: `lib/api/domains/book/api.ts`

Added new method to bookApi:
```typescript
markAsRead(
  bookId: string | number,
  request: MarkAsReadRequest
): Promise<MarkAsReadResponse>
```

With corresponding types in `lib/api/domains/book/types.ts`:
```typescript
interface MarkAsReadRequest {
  rating?: number;
  review?: string;
  completedDate?: Date | string;
}

interface MarkAsReadResponse {
  session: ReadingSession;
  ratingUpdated: boolean;
  reviewUpdated: boolean;
  progressCreated: boolean;
}
```

#### 4. Simplified useBookStatus Hook (Client-Side)

**File**: `hooks/useBookStatus.ts`

Refactored from 534 lines to 270 lines (49% reduction):

**Removed** (moved to SessionService):
- 8 helper functions with business logic
- Direct service imports (caused bundling issues)

**Kept** (React-specific concerns):
- UI state management (confirmations, pending states)
- Optimistic updates
- Query cache invalidation
- Toast notifications

**Updated mutations** to use bookApi:
```typescript
// Before: Direct service import (❌ causes bundling issues)
import { sessionService } from "@/lib/services";
await sessionService.markAsRead({ bookId, rating, review });

// After: HTTP API call (✅ proper client-server separation)
import { bookApi } from "@/lib/api";
await bookApi.markAsRead(bookId, { rating, review });
```

#### 5. Simplified API Routes

**File**: `app/api/books/[id]/rating/route.ts`

Updated to use SessionService for rating updates:
```typescript
// Before: Manual Calibre sync and error handling
await bookRepository.update(bookId, { rating });
try {
  await calibreService.updateRating(book.calibreId, rating);
} catch (error) { /* ... */ }

// After: Service handles sync and errors
await sessionService.updateBookRating(bookId, rating);
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser)                   │
├─────────────────────────────────────────────────────────────┤
│  React Components                                            │
│    └─> useBookStatus Hook (270 lines, UI concerns only)     │
│          ├─> bookApi.updateStatus()                          │
│          ├─> bookApi.markAsRead()         ← NEW             │
│          └─> bookApi.startReread()                           │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP Requests
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  POST /api/books/:id/status                                  │
│    └─> sessionService.updateStatus()                         │
│                                                               │
│  POST /api/books/:id/mark-as-read        ← NEW              │
│    └─> sessionService.markAsRead()       ← NEW              │
│                                                               │
│  POST /api/books/:id/reread                                  │
│    └─> sessionService.startReread()                          │
│                                                               │
│  PATCH /api/books/:id/rating                                 │
│    └─> sessionService.updateBookRating() ← UPDATED          │
└──────────────────────┬──────────────────────────────────────┘
                       │ Method Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                Service Layer (Business Logic)                │
├─────────────────────────────────────────────────────────────┤
│  SessionService (Single Source of Truth)                     │
│    ├─> updateStatus()             [existing]                │
│    ├─> markAsRead()               ← NEW (main orchestration)│
│    ├─> ensureReadingStatus()      ← NEW (helper)            │
│    ├─> create100PercentProgress() ← NEW (helper)            │
│    ├─> updateBookRating()         ← NEW (extracted)         │
│    ├─> updateSessionReview()      ← NEW (helper)            │
│    ├─> findMostRecentCompletedSession() ← NEW (helper)      │
│    └─> startReread()               [existing]                │
│                                                               │
│  ProgressService                                             │
│    └─> logProgress() [auto-completes at 100%]               │
└──────────────────────┬──────────────────────────────────────┘
                       │ Database Operations
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Repository Layer (Data Access)                  │
├─────────────────────────────────────────────────────────────┤
│  bookRepository, sessionRepository, progressRepository       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Enhance SessionService ✅

**Files Modified**:
- `lib/services/session.service.ts` (271 → 782 lines)
- `lib/services/progress.service.ts` (exported singleton)

**Changes**:
- Added 6 new public methods with full JSDoc
- Extracted `updateBookRating()` from `updateStatus()`
- Implemented `markAsRead()` orchestration with decision tree
- Special handling for books without totalPages
- Best-effort error handling for rating/review

**Tests Added**:
- `__tests__/services/session-service-mark-as-read.test.ts` (30 tests)
- Coverage: 100% functions, 93.90% lines

**Commit**: `feat: enhance SessionService with reusable status transition methods`

### Phase 2: Refactor useBookStatus Hook ✅

**Files Modified**:
- `hooks/useBookStatus.ts` (534 → 270 lines, -49%)
- `__tests__/hooks/useBookStatus.test.ts`

**Changes**:
- Removed 8 helper functions (moved to SessionService)
- Removed direct sessionService import
- Updated mutations to use bookApi
- Kept UI-specific logic only

**Initial Issue**: Hook imported sessionService directly
- Caused "Module not found: Can't resolve 'fs'" error
- Server dependencies (better-sqlite3) bundled for client

**Fix**: Client-Server Separation
- Created new API endpoint: `/api/books/:id/mark-as-read`
- Added `bookApi.markAsRead()` method
- Hook now makes HTTP calls, not service imports

**Tests Updated**:
- Removed sessionService mocks
- Updated to check global.fetch calls
- All 14 tests passing

**Commits**:
- `refactor: simplify useBookStatus hook by moving business logic to SessionService`
- `fix: resolve client-side bundling issue by using API instead of direct service imports`

### Phase 3: Update API Routes ✅

**Files Modified**:
- `app/api/books/[id]/rating/route.ts`

**Changes**:
- Use `sessionService.updateBookRating()` instead of manual Calibre sync
- Eliminated code duplication (14 lines removed)
- Simplified error handling

**Tests**:
- All 29 rating API tests passing
- No behavior changes, just consolidation

**Commit**: `refactor: simplify rating API route using SessionService`

### Phase 4: Comprehensive Testing & Documentation ✅

**Files Added**:
- `__tests__/api/mark-as-read.test.ts` (18 tests)
- `docs/ADRs/ADR-011-STATUS-TRANSITION-SERVICE-CONSOLIDATION.md` (this document)

**Test Coverage**:
- Mark-as-read endpoint: 18 tests
  - Basic scenarios (with/without rating, review, both)
  - Already-read books (updating rating/review)
  - Custom completion dates
  - Validation and error cases
  - Edge cases (multiple sessions, idempotency)
- SessionService methods: 30 tests
- Hook: 14 tests
- **Total**: 62 new/updated tests

**Commit**: `docs: add comprehensive tests and ADR for status transition consolidation`

---

## Consequences

### Positive

1. **Single Source of Truth**
   - All book status transition logic in SessionService
   - Consistent behavior across UI and API
   - Changes in one place automatically propagate

2. **Code Reduction**
   - useBookStatus: 534 → 270 lines (-49%)
   - Rating route: -14 lines of duplication
   - Total: ~280 lines removed

3. **Testability**
   - Business logic testable without React (faster)
   - Service tests: 30 comprehensive tests
   - Hook tests: Simplified to UI concerns only
   - Coverage: SessionService 100% functions, 93.90% lines

4. **Reusability**
   - API routes use same logic as UI
   - Future features (CLI tools, batch operations) can use services
   - Methods composable for complex workflows

5. **Maintainability**
   - Clear separation: Service = business, Hook = UI
   - Changes to status logic in one location
   - Less cognitive load for developers

6. **Type Safety**
   - End-to-end types from client to service
   - Compiler catches breaking changes
   - bookApi provides type-safe interface

7. **Proper Architecture**
   - Client → HTTP API → Services → Repositories
   - No server dependencies in client bundle
   - Follows Next.js best practices

### Negative

1. **Additional API Endpoint**
   - New `/api/books/:id/mark-as-read` endpoint
   - More routes to maintain
   - *Mitigation*: Well-documented, comprehensive tests

2. **HTTP Overhead for Hooks**
   - Hooks now make HTTP calls instead of direct service calls
   - Minimal performance impact (sub-100ms)
   - *Trade-off*: Proper architecture worth slight overhead

3. **Migration Effort**
   - 4 phases of refactoring required
   - 15-20 hours of development time
   - *Outcome*: All tests passing, no regressions

### Neutral

1. **Service Layer Growth**
   - SessionService: 271 → 782 lines
   - More methods to understand
   - *Mitigation*: Excellent JSDoc, clear naming, composable design

2. **Test Suite Growth**
   - 62 new/updated tests
   - Longer test execution time (+1-2 seconds)
   - *Trade-off*: Higher confidence, better coverage

---

## Alternatives Considered

### Alternative 1: Create New BookStatusTransitionService

**Approach**: Create entirely new service for status transitions

**Pros**:
- Clean slate design
- No changes to existing SessionService

**Cons**:
- Three places with status logic (SessionService, new service, hook)
- Doesn't solve duplication problem
- Additional complexity without clear benefit

**Decision**: ❌ Rejected - Enhancing SessionService better aligns with existing architecture

### Alternative 2: Create Thin Orchestrator Service

**Approach**: New service that coordinates SessionService + ProgressService + BookService calls

**Pros**:
- Doesn't modify existing services
- Clear separation of orchestration logic

**Cons**:
- Another layer of indirection
- Doesn't eliminate duplication, just moves it
- Complicates error handling

**Decision**: ❌ Rejected - Added complexity without sufficient benefit

### Alternative 3: Keep Hook-Based Orchestration

**Approach**: Leave business logic in hooks, improve existing implementation

**Pros**:
- No major refactoring required
- Familiar pattern for React developers

**Cons**:
- Business logic remains coupled to UI
- Can't test independently of React
- Not reusable from API routes or future CLI tools
- Two sources of truth (hook and service)

**Decision**: ❌ Rejected - Doesn't address core architectural issues

---

## Related Patterns

### Service Layer Pattern
SessionService acts as the **Service Layer** between API routes/hooks and repositories.

**Responsibilities**:
- Business logic and validation
- Transaction coordination
- Error handling and logging
- Cache invalidation
- External service integration (Calibre)

**Benefits**:
- Testable independently of HTTP and UI layers
- Reusable across different interfaces
- Single location for business rules

### Facade Pattern
The `markAsRead()` method acts as a **Facade** for complex status transition workflows.

**Simplifies**:
- Multiple conditional paths
- Error handling across operations
- Coordination of services and repositories

**Client Code**:
```typescript
// Instead of:
await ensureReadingStatus(bookId);
await create100PercentProgress(bookId, totalPages);
await updateRating(bookId, rating);
await updateReview(sessionId, review);

// Single call:
const result = await sessionService.markAsRead({
  bookId,
  rating,
  review,
});
```

### Repository Pattern
SessionService uses **Repository Pattern** for data access:
- `bookRepository`, `sessionRepository`, `progressRepository`
- Abstracts database operations
- Enables testing with mock repositories

---

## Metrics

### Code Quality

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| useBookStatus LOC | 534 | 270 | -49% |
| Helper Functions in Hook | 8 | 0 | -100% |
| Business Logic Locations | 2 (service + hook) | 1 (service) | Consolidated |
| SessionService Public Methods | 8 | 14 | +6 new methods |

### Test Coverage

| Component | Tests | Functions | Lines |
|-----------|-------|-----------|-------|
| SessionService.markAsRead() | 30 | 100% | 93.90% |
| Mark-as-read API | 18 | 100% | 87.23% |
| useBookStatus | 14 | 93.10% | 85.37% |
| **Total New Tests** | **62** | - | - |

### Performance

| Operation | Before | After | Impact |
|-----------|--------|-------|--------|
| Hook tests | ~600ms | ~450ms | 25% faster (less React overhead) |
| Service tests | N/A | ~380ms | New, fast unit tests |
| Runtime overhead | Direct call | HTTP call | <100ms (acceptable) |

---

## Future Considerations

### 1. CLI Tool Integration

The consolidated service layer enables future CLI tools:
```bash
# Example future CLI commands
tome mark-read --book-id 123 --rating 5
tome bulk-status --status reading --tag "sci-fi"
```

**Benefits**:
- Reuse SessionService methods directly
- Same business logic as UI and API
- No code duplication

### 2. Batch Operations

Service methods enable batch status updates:
```typescript
// Future batch endpoint
for (const bookId of bookIds) {
  await sessionService.markAsRead({ bookId, rating: 5 });
}
```

### 3. Additional Orchestration Methods

Pattern established for future complex workflows:
- `bulkMarkAsRead(bookIds: number[])`
- `markAsAbandoned(bookId: number, reason?: string)`
- `transferProgress(fromBookId: number, toBookId: number)`

### 4. Service Layer Documentation

Consider adding:
- Service method catalog (auto-generated from JSDoc)
- Workflow diagrams for complex operations
- Integration guide for new features

---

## References

### Related ADRs
- [ADR-004: Backend Service Layer Architecture](./ADR-004-BACKEND-SERVICE-LAYER-ARCHITECTURE.md) - Established service layer pattern
- [ADR-010: Hybrid API Client Architecture](./ADR-010-HYBRID-API-CLIENT-ARCHITECTURE.md) - bookApi client used in this refactoring

### Documentation
- Testing Guidelines: `docs/TESTING_GUIDELINES.md`
  - Service Layer Testing Pattern (lines 379-591)
  - React Hook Testing Pattern (lines 308-329)

### Code References
- SessionService: `lib/services/session.service.ts:595-725` (markAsRead method)
- useBookStatus: `hooks/useBookStatus.ts` (simplified hook)
- Mark-as-read API: `app/api/books/[id]/mark-as-read/route.ts`
- bookApi: `lib/api/domains/book/api.ts:176-184` (markAsRead method)

### External Resources
- [Martin Fowler - Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html)
- [Facade Pattern](https://refactoring.guru/design-patterns/facade)
- [Next.js: Client and Server Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)

---

## Approval

**Status**: ✅ Accepted
**Date**: 2025-12-29
**Implementation**: Complete (all 4 phases)
**Tests**: All passing (1830 total, 62 new/updated)
**Production Ready**: Yes

**Sign-off**:
- Architecture Review: ✅ Approved
- Code Review: ✅ Approved
- Test Coverage: ✅ 100% functions, 93.90% lines
- Documentation: ✅ Complete

---

## Appendix A: Implementation Checklist

- [x] Phase 1: Enhance SessionService with reusable methods
  - [x] Add ensureReadingStatus()
  - [x] Add create100PercentProgress()
  - [x] Extract updateBookRating()
  - [x] Add updateSessionReview()
  - [x] Add findMostRecentCompletedSession()
  - [x] Implement markAsRead() orchestration
  - [x] Add comprehensive tests (30 tests)
  - [x] Export progressService singleton

- [x] Phase 2: Refactor useBookStatus hook
  - [x] Remove 8 helper functions
  - [x] Update mutations to use bookApi
  - [x] Fix client-side bundling issue
  - [x] Create mark-as-read API endpoint
  - [x] Add bookApi.markAsRead() method
  - [x] Update hook tests

- [x] Phase 3: Update API routes
  - [x] Simplify rating route with SessionService
  - [x] Verify all tests pass

- [x] Phase 4: Tests and documentation
  - [x] Add mark-as-read API tests (18 tests)
  - [x] Create ADR document
  - [x] Verify full test suite passes (1830 tests)

---

## Appendix B: Migration Guide

### For Developers Adding Status Transitions

**Before** (old pattern):
```typescript
// In hook: Orchestrate multiple API calls
const result1 = await bookApi.updateStatus(bookId, { status: 'reading' });
const result2 = await bookApi.createProgress(bookId, { currentPercentage: 100 });
const result3 = await bookApi.updateRating(bookId, { rating: 5 });
```

**After** (new pattern):
```typescript
// In hook: Single API call
const result = await bookApi.markAsRead(bookId, {
  rating: 5,
});
// Result includes: { session, ratingUpdated, reviewUpdated, progressCreated }
```

### For API Routes

**Before** (duplicated logic):
```typescript
// Manual Calibre sync
await bookRepository.update(bookId, { rating });
try {
  await calibreService.updateRating(book.calibreId, rating);
} catch (error) {
  logger.error(error);
}
```

**After** (use service):
```typescript
// Service handles sync and errors
await sessionService.updateBookRating(bookId, rating);
```

### For Testing

**Before** (service mocks in hook tests):
```typescript
mock.module("@/lib/services", () => ({
  sessionService: { markAsRead: mockMarkAsRead },
}));
```

**After** (HTTP mocks in hook tests):
```typescript
global.fetch = mock(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ session: {...}, ratingUpdated: true }),
}));
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-29 | Development Team | Initial document - all phases complete |
