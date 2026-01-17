# Test Suite

This directory contains the test suite for the book tracker application using Bun's built-in test runner.

## Running Tests

```bash
# Run all tests once
npm test
```

## ✅ Current Status

The test infrastructure is **fully functional** and comprehensive with **2740 tests passing** using Vitest with real database testing!

**Test Suite (2740 passing):**
- ✅ **Companion Migrations Framework** - 34 tests (NEW!)
  - Unit tests - 21 tests (completion tracking, table existence checks, error handling)
  - Integration tests - 13 tests (end-to-end execution, transaction rollback, idempotency, fresh database support)
  - Coverage: 80-90% of companion-migrations.ts
- ✅ **Annual Reading Goals** - 66 tests
  - `/api/reading-goals/books` - 16 tests (parameter validation, data retrieval, response structure)
  - `/api/reading-goals/[id]` PATCH/DELETE - 16 tests (validation, authorization, error handling)
  - `ReadingGoalRepository` - 8 tests (`getBooksByCompletionYear` method)
  - `/api/reading-goals` GET/POST - 10 tests (goal creation, progress tracking)
  - Monthly breakdown - 16 tests (aggregation by month)
- ✅ **Utility tests** (toast.test.ts) - 9 tests
- ✅ **Streak logic** (streaks.test.ts) - 12 comprehensive tests using real database
- ✅ **Sync service** (sync-service.test.ts) - 14 tests with real database integration
- ✅ **Calibre queries** (calibre.test.ts) - 31 tests using in-memory SQLite
- ✅ **Progress API** (progress.test.ts) - 18 tests with real database
- ✅ **Stats API** (stats.test.ts) - 20 tests for aggregation pipelines
- ✅ **Database compatibility** - 2 tests
- ✅ **Additional tests** - 2575+ tests across all features

**Key Achievements:**
- ✅ **Real database testing** - No complex mocking, uses in-memory SQLite
- ✅ **Comprehensive coverage** - All core features tested (companion migrations, goals, streaks, sync, progress, stats, queries)
- ✅ **Fast execution** - ~18.5 seconds for full suite (2740 tests)
- ✅ **Test isolation** - Proper cleanup between tests, no cross-file interference
- ✅ **Production-like testing** - Tests run against real database engines
- ✅ **Companion Migrations Framework** - Complete test coverage (80-90% coverage)
- ✅ **Annual Reading Goals** - Complete test coverage for PR #96 (0% → 79%+ coverage)

## Test Structure

```
__tests__/
├── lib/                         # Library/core functionality tests
│   └── db/
│       ├── companion-migrations.test.ts          # Unit tests (21 tests)
│       ├── companion-migrations-integration.test.ts  # Integration tests (13 tests)
│       ├── migrate.test.ts                       # Migration framework tests
│       └── ...
├── integration/                 # Integration tests (API routes)
│   └── api/
│       ├── reading-goals.test.ts        # Goal CRUD operations (26 tests)
│       └── reading-goals-books.test.ts  # Books by year endpoint (16 tests)
├── repositories/                # Repository layer tests
│   └── reading-goals.repository.test.ts # Database queries (24 tests)
├── api/                         # API route tests (legacy structure)
│   ├── progress.test.ts         # Progress logging API (18 tests)
│   └── stats.test.ts            # Statistics API (20 tests)
├── unit/                        # Unit tests for individual functions/modules
│   ├── lib/
│   │   ├── calibre.test.ts      # Calibre SQL queries (31 tests)
│   │   ├── streaks.test.ts      # Streak calculation logic (12 tests)
│   │   └── sync-service.test.ts # Calibre sync orchestration (14 tests)
│   └── utils/
│       └── toast.test.ts        # Toast notification utilities (9 tests)
├── helpers/                     # Test utilities
│   └── db-setup.ts              # Database setup/teardown helpers
├── fixtures/                    # Shared test data
│   ├── test-data.ts             # Mock data and helper functions
│   └── companion-migrations/    # Test companion migration files
├── IMPLEMENTATION_SUMMARY.md    # Detailed test implementation summary
├── TEST_COVERAGE_SUMMARY.md     # Coverage metrics and analysis
└── README.md                    # This file
```

## Test Coverage

### Companion Migrations Framework (NEW) - 34 tests

Complete test coverage for the Companion Migrations Framework (ADR-013):

#### Unit Tests (`lib/db/companion-migrations.test.ts`) - 21 tests
- ✅ **`isCompleteMigration()`** - 6 tests
  - Returns false when `migration_metadata` table doesn't exist
  - Returns false when migration key doesn't exist
  - Returns true when migration key has value 'true'
  - Returns false when migration key has value 'false'
  - Handles database query errors gracefully
  - Handles multiple migrations independently
- ✅ **`markComplete()`** - 7 tests
  - Creates `migration_metadata` table if needed
  - Inserts completion flag for new migration
  - Updates completion flag for existing migration (INSERT OR REPLACE)
  - Stores `created_at` timestamp
  - Throws error if database write fails
  - Handles multiple migrations
  - Uses INSERT OR REPLACE semantics
- ✅ **`tablesExist()`** - 8 tests
  - Returns true when all required tables exist
  - Returns false when any required table is missing
  - Returns true for empty array (no requirements)
  - Returns false when all tables are missing
  - Handles database query errors gracefully
  - Checks multiple tables correctly
  - Case-sensitive for table names
  - Detects missing table even when others exist

#### Integration Tests (`lib/db/companion-migrations-integration.test.ts`) - 13 tests
- ✅ **Basic Execution** - 3 tests
  - Runs companions on existing database and transforms data
  - Marks companion as complete after successful run
  - Handles multiple books in single migration
- ✅ **Idempotency** - 2 tests
  - Skips companion if already marked complete
  - Handles running migrations multiple times safely
- ✅ **Fresh Database Support** - 2 tests
  - Skips companion when required tables don't exist
  - Handles empty database gracefully
- ✅ **Transaction Handling** - 2 tests
  - Rolls back transaction on companion execution error
  - Does not mark companion as complete when it fails
- ✅ **Multiple Migrations** - 2 tests
  - Runs multiple companions in numeric order
  - Marks all successful companions as complete
- ✅ **Edge Cases** - 2 tests
  - Handles empty companions directory gracefully
  - Handles companion with no data to transform

**Coverage**: 80-90% of `lib/db/companion-migrations.ts` (249 lines)

**Key Testing Patterns**:
- Uses in-memory SQLite (`:memory:`) for unit tests
- Uses temporary directories with real TypeScript files for integration tests
- Proper test isolation with cleanup (try/finally blocks)
- Tests both success and failure paths
- Validates transaction rollback behavior
- Tests idempotency and fresh database scenarios

### Annual Reading Goals (NEW - PR #96) - 66 tests

#### `/api/reading-goals/books` - 16 tests
Complete test coverage for the books by year endpoint:
- ✅ Parameter validation (year required, type checking, boundaries)
- ✅ Data retrieval (books by year, ordering, completion tracking)
- ✅ Response structure validation
- ✅ Edge cases (re-reads, empty data, multiple years)
- ✅ **Coverage: 0% → 79.31%**

#### `/api/reading-goals/[id]` PATCH/DELETE - 16 tests
Complete PATCH and DELETE endpoint validation:
- ✅ Invalid ID formats (non-numeric strings)
- ✅ Missing/invalid parameters
- ✅ Past year protection (read-only)
- ✅ Service layer validation
- ✅ Proper error responses (400, 404)
- ✅ **Coverage: 42% → 83.23%**

#### `ReadingGoalRepository.getBooksByCompletionYear()` - 8 tests
Database query method validation:
- ✅ Books by completion year
- ✅ Ordering by completion date descending
- ✅ Completion date inclusion
- ✅ Multiple sessions per book (re-reads)
- ✅ Year filtering accuracy
- ✅ **Coverage: ~50% → 98.73%**

#### Goal Creation & Progress - 26 tests (existing)
Core goal management functionality:
- ✅ Goal CRUD operations
- ✅ Progress calculation with completed books
- ✅ Monthly breakdown aggregation
- ✅ Edge cases (mid-year goals, goal exceeded, re-reads)

📚 **See `IMPLEMENTATION_SUMMARY.md` for detailed test breakdown**

### API Tests

#### Progress API (`api/progress.test.ts`) - 18 tests
Tests for the progress logging endpoints:
- ✅ **GET** - Fetching progress logs with sorting
- ✅ **POST** - Creating progress logs with page/percentage calculations
- ✅ Automatic status updates when books are completed
- ✅ Pages read calculation based on previous progress
- ✅ Error handling (404, 400, 500)
- ✅ Books without totalPages
- ✅ Streak integration with real database

#### Stats API (`api/stats.test.ts`) - 20 tests
Tests for statistics and aggregation endpoints:
- ✅ `/api/stats/overview` - Books read, pages read by time period
- ✅ `/api/stats/activity` - Activity calendar and monthly aggregations
- ✅ Date range filtering (today, month, year, all-time)
- ✅ Average pages per day calculations
- ✅ Zero-state handling

### Unit Tests

#### Calibre Queries (`unit/lib/calibre.test.ts`) - 31 tests
Tests for SQLite database queries using in-memory database:
- ✅ `getAllBooks()` - Complex JOIN queries with all fields
- ✅ `getBookById()` - Single book retrieval
- ✅ `searchBooks()` - Case-insensitive search
- ✅ `getBookTags()` - Tag queries with ordering
- ✅ `getCoverPath()` - API path generation
- ✅ Edge cases: missing columns, null values, multiple authors
- ✅ Schema compatibility testing

#### Sync Service (`unit/lib/sync-service.test.ts`) - 14 tests
Tests for Calibre library synchronization orchestration:
- ✅ Creating new books with auto-status creation
- ✅ Updating existing books without duplicating status
- ✅ Detecting and marking orphaned books
- ✅ Author parsing and field mapping
- ✅ Concurrent sync prevention
- ✅ Error handling

#### Streak Logic (`unit/lib/streaks.test.ts`) - 12 tests
Tests for the core streak calculation logic:
- ✅ Creating new streaks
- ✅ Initializing streaks from 0
- ✅ Same-day activity handling
- ✅ Consecutive day streak increments
- ✅ Longest streak tracking
- ✅ Broken streak detection and reset
- ✅ Total days active calculation
- ✅ `getStreak()` and `getOrCreateStreak()` functions

#### Utilities (`unit/utils/toast.test.ts`) - 9 tests
Tests for utility functions:
- ✅ Toast notification helpers
- ✅ String formatting
- ✅ Validation utilities

## Writing New Tests

### Using Bun Test

Bun provides a built-in test runner with Jest-compatible API:

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";

describe("My Feature", () => {
  beforeEach(() => {
    // Setup before each test
  });

  test("should do something", () => {
    expect(true).toBe(true);
  });
});
```

### Mocking

Use Bun's `mock()` function for mocking:

```typescript
import { mock } from "bun:test";

// Mock a function
const mockFn = mock(() => "mocked value");

// Mock a module (use sparingly - see warning below)
mock.module("@/lib/some-module", () => ({
  someFunction: mock(() => "mocked value"),
}));
```

**⚠️ Important: Avoid Module Mocking When Possible**

Module mocks created with `mock.module()` are **global** and can leak across test files, causing hard-to-debug failures. Prefer using **real databases** (mongodb-memory-server, SQLite :memory:) instead of mocking.

**Good practices:**
- ✅ Use real test databases instead of mocking database functions
- ✅ Mock only external APIs and Next.js internals (like `revalidatePath`)
- ✅ Keep mocks isolated to the test file that needs them

**Avoid:**
- ❌ Mocking internal application functions (like `updateStreaks`)
- ❌ Complex mock chains that make tests brittle
- ❌ Module mocks that affect other test files

### Test Database Helpers

Use the database setup utilities from `helpers/db-setup.ts`:

```typescript
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("My Test Suite", () => {
  beforeAll(async () => {
    await setupTestDatabase(); // Start in-memory MongoDB
  });

  afterAll(async () => {
    await teardownTestDatabase(); // Stop MongoDB and cleanup
  });

  beforeEach(async () => {
    await clearTestDatabase(); // Clear all collections between tests
  });

  test("my test", async () => {
    // Use real Mongoose models here!
    const book = await Book.create({ title: "Test" });
    expect(book).toBeDefined();
  });
});
```

### Test Fixtures

Use shared test data from `fixtures/test-data.ts`:

```typescript
import {
  mockBook1,
  mockStreakActive,
  createTestDate,
  createMockRequest
} from "@/__tests__/fixtures/test-data";
```

### Test Date Utilities

**IMPORTANT:** Calendar day dates (progress dates, session dates) are stored as YYYY-MM-DD strings in the database. Use the test utilities from `test-utils.tsx` to ensure proper date formatting:

```typescript
import { 
  toProgressDate, 
  toSessionDate,
  generateDateSequence,
  expectDateToMatch,
  createProgressSequence,
  createTestBookWithSession
} from '@/__tests__/test-utils';

// Convert Date to YYYY-MM-DD for progress logs
const log = await progressRepository.create({
  bookId: book.id,
  sessionId: session.id,
  currentPage: 100,
  currentPercentage: 50,
  pagesRead: 50,
  progressDate: toProgressDate(new Date("2024-11-15T10:30:00Z")), // "2024-11-15"
});

// Convert Date to YYYY-MM-DD for session dates
const session = await sessionRepository.create({
  bookId: book.id,
  sessionNumber: 1,
  status: "reading",
  startedDate: toSessionDate(new Date("2024-01-01")), // "2024-01-01"
  completedDate: toSessionDate(new Date("2024-01-15")), // "2024-01-15"
});

// Generate sequential dates for testing streaks
const dates = generateDateSequence("2024-11-01", 5);
// ["2024-11-01", "2024-11-02", "2024-11-03", "2024-11-04", "2024-11-05"]

// Assert dates match expected values
expectDateToMatch(session.completedDate, "2024-11-15");

// Create bulk progress logs for testing
await createProgressSequence(progressRepository, {
  bookId: book.id,
  sessionId: session.id,
  startDate: "2024-01-01",
  startPage: 0,
  pageIncrement: 10,
  count: 12,
  totalPages: 120,
});
```

**Why these utilities?**
- All calendar day dates are stored as YYYY-MM-DD strings (not timestamps)
- The database uses UTC date parts (extracts year, month, day from UTC Date)
- These utilities ensure consistent date formatting across all tests
- They're used in 150+ test files - follow the pattern!

**Pattern:** `toProgressDate()` and `toSessionDate()` are aliases (same format), but named semantically for clarity.

## Adding More Tests

Core functionality is well-tested! Here are areas that could benefit from additional coverage:

1. **Component Tests** - React component rendering and interactions
2. **Reading Status API** - Status transition logic
3. **Book Model Validation** - Mongoose schema validation edge cases
4. **Error Boundaries** - Error handling in UI components
5. **Activity Calendar** - `getActivityCalendar()` aggregation logic

## Dependencies

### Test Infrastructure
- **Bun's built-in test runner** - No installation needed, Jest-compatible API
- **mongodb-memory-server** - In-memory MongoDB for integration testing
- **Bun's native SQLite** - Built-in :memory: database for Calibre query tests

### Optional (for component testing)
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - DOM assertion matchers
- `@types/bun` - TypeScript types for Bun APIs

### Database Approach
We use **real databases** instead of mocks:
- MongoDB tests → `mongodb-memory-server` (real MongoDB instance)
- SQLite tests → `bun:sqlite` with `:memory:` (real SQLite engine)
- This provides production-like testing without mocking complexity

---

## Summary

✅ **2740 tests passing** across 132 test files  
⚡ **~18.5 seconds** execution time  
🎯 **Comprehensive coverage** of core features  
🏗️ **Production-like** testing with real databases  
🔒 **Test isolation** with proper cleanup  
📝 **Well documented** with examples and best practices  
🎊 **NEW: Companion Migrations Framework fully tested** (80-90% coverage)  
🎊 **NEW: Annual Reading Goals feature fully tested** (PR #96)

The test suite is production-ready and provides confidence in the application's core functionality!

---

## Quick Commands

```bash
# Run all tests
npm test

# Run only companion migration tests
npm test __tests__/lib/db/companion-migrations

# Run only reading goals tests
npm test __tests__/integration/api/reading-goals*.test.ts __tests__/repositories/reading-goals.repository.test.ts

# Run individual test file
npm test __tests__/lib/db/companion-migrations-integration.test.ts
```
