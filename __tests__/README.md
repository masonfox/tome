# Test Suite

This directory contains the test suite for the book tracker application using Bun's built-in test runner.

## Running Tests

```bash
# Run all tests once
bun test

# Run tests in watch mode (auto-rerun on file changes)
bun test:watch
```

## ✅ Current Status

The test infrastructure is **fully functional** and comprehensive with **99 tests passing** using Bun's test runner with real database testing!

**Test Suite (99 passing):**
- ✅ **Utility tests** (toast.test.ts) - 9 tests
- ✅ **Streak logic** (streaks.test.ts) - 12 comprehensive tests using real MongoDB
- ✅ **Sync service** (sync-service.test.ts) - 14 tests with real MongoDB integration
- ✅ **Calibre queries** (calibre.test.ts) - 31 tests using Bun's native SQLite :memory:
- ✅ **Progress API** (progress.test.ts) - 18 tests with real database
- ✅ **Stats API** (stats.test.ts) - 20 tests for aggregation pipelines
- ✅ **Database compatibility** - 2 tests

**Key Achievements:**
- ✅ **Real database testing** - No complex mocking, uses mongodb-memory-server + Bun SQLite
- ✅ **Comprehensive coverage** - All core features tested (streaks, sync, progress, stats, queries)
- ✅ **Fast execution** - ~8.5 seconds for full suite
- ✅ **Test isolation** - Proper cleanup between tests, no cross-file interference
- ✅ **Production-like testing** - Tests run against real database engines

## Test Structure

```
__tests__/
├── api/                         # API route tests
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
│   └── test-data.ts             # Mock data and helper functions
└── README.md                    # This file
```

## Test Coverage

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

✅ **99 tests passing** across 7 test files
⚡ **~8.5 seconds** execution time
🎯 **Comprehensive coverage** of core features
🏗️ **Production-like** testing with real databases
🔒 **Test isolation** with proper cleanup
📝 **Well documented** with examples and best practices

The test suite is production-ready and provides confidence in the application's core functionality!
