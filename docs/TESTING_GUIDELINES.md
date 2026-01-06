# Tome Testing Guidelines

**Version**: 2.0.0  
**Last Updated**: 2025-01-05  
**Status**: Active

> This document defines testing standards for the Tome project, aligned with the Constitution's principle of "Trust but Verify."

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Structure](#test-structure)
4. [Naming Conventions](#naming-conventions)
5. [Writing Tests](#writing-tests)
6. [Test Types](#test-types)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Vitest-Specific Patterns](#vitest-specific-patterns)
10. [Troubleshooting](#troubleshooting)

---

## Philosophy

### Core Principles

Tome's testing philosophy derives from the Constitution:

1. **"Trust but Verify"** → Comprehensive testing with real databases
2. **"Protect User Data Above All"** → Test data integrity and migrations rigorously
3. **"Make Complexity Invisible"** → Test user-facing behavior, not implementation details

### Testing Pyramid

```
           /\
          /  \    E2E (Future)
         /____\   5% - Critical user flows
        /      \   
       /________\  Integration Tests
      /          \ 35% - API → Service → Repository
     /____________\
    /              \ Unit Tests
   /________________\ 40% - Services, Lib, Hooks
  Component Tests     20% - UI with mocked deps
```

**Distribution Target**: 40% Unit | 35% Integration | 20% Component | 5% E2E

### When to Write Tests

✅ **Always Test**:
- API endpoints (every route must have tests)
- Service layer methods (business logic)
- Data transformations (calculations, aggregations)
- Critical user flows (progress logging, status changes)
- Data migrations

⚠️ **Test Selectively**:
- UI components (focus on complex state, user interactions)
- Utility functions (test only non-trivial logic)
- Repository methods (basic CRUD covered by integration tests)

❌ **Don't Test**:
- Type definitions
- Configuration files
- Simple pass-through functions
- Third-party library functionality

---

## Test Environment Setup

### Critical: Timezone Configuration

**All tests MUST run with `TZ=UTC` to ensure consistent date/time behavior across environments.**

#### Why TZ=UTC is Required

Many tests involve date and time operations (reading sessions, streaks, journal entries, progress tracking). Without `TZ=UTC`, tests will run in your local timezone, causing:

1. **Flaky tests** - Pass on one machine but fail on another
2. **Date boundary issues** - A timestamp like `2024-01-05T23:00:00` is Jan 5 in UTC but Jan 6 in Tokyo
3. **Inconsistent test data** - Test fixtures assume UTC, but comparisons use local time

#### Example Failure Without UTC

```bash
# Running without TZ=UTC
$ NODE_ENV=test bunx vitest run __tests__/api/session-edit.test.ts
# ❌ FAIL: expected '2025-11-04' to be '2025-11-05'
# 9 tests failed due to timezone mismatch

# Running with TZ=UTC
$ TZ=UTC NODE_ENV=test bunx vitest run __tests__/api/session-edit.test.ts
# ✅ PASS: All 28 tests passed
```

#### How to Run Tests

**Recommended: Use npm scripts** (automatically sets TZ=UTC)
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Manual execution:**
```bash
TZ=UTC NODE_ENV=test bunx vitest run                    # All tests
TZ=UTC NODE_ENV=test bunx vitest run path/to/test.ts   # Specific file
TZ=UTC NODE_ENV=test bunx vitest                        # Watch mode
```

**⚠️ Warning**: Omitting `TZ=UTC` will cause date-related tests to fail intermittently depending on your system timezone.

### Test Framework: Vitest

Tome uses [Vitest](https://vitest.dev/) as its test runner, chosen for:
- **Fast**: Native ESM support, parallel execution
- **Compatible**: Jest-like API, works with existing test patterns
- **Cross-platform**: Runs in both Bun and Node.js environments
- **Better tooling**: Built-in coverage, watch mode, UI

### Database: better-sqlite3

For SQLite operations in tests, we use [better-sqlite3](https://github.com/WiseLibs/better-sqlite3):
- **Cross-platform**: Works in Node.js and Bun
- **Synchronous API**: Simpler test code, no await overhead for DB operations
- **Compatible**: Similar API to bun:sqlite for easy migration

---

## Test Structure

### Directory Organization

```
__tests__/
├── api/              # API route integration tests
│   ├── books.test.ts
│   ├── progress.test.ts
│   └── ...
├── services/         # Service layer unit tests
│   ├── book.service.test.ts
│   └── session.service.test.ts
├── lib/              # Library/utility tests
│   ├── streaks.test.ts
│   ├── sync-service.test.ts
│   └── ...
├── hooks/            # React hook tests
│   ├── useBookDetail.test.ts
│   └── useBookProgress.test.ts
├── components/       # Component tests
│   ├── BookHeader.test.tsx
│   └── BookMetadata.test.tsx
├── pages/            # Page-level tests
│   └── book-detail-page.test.tsx
├── integration/      # Cross-layer integration tests
│   └── library-service-api.test.ts
├── helpers/          # Test utilities
│   ├── db-setup.ts
│   └── performance.ts
└── fixtures/         # Shared test data
    └── test-data.ts
```

### File Naming

**Pattern**: `<feature-name>.test.ts` or `<ComponentName>.test.tsx`

✅ **Good**:
- `books.test.ts` (matches API route `/api/books`)
- `book.service.test.ts` (matches `book.service.ts`)
- `useBookDetail.test.ts` (matches `useBookDetail.ts`)
- `BookHeader.test.tsx` (matches `BookHeader.tsx`)

❌ **Bad**:
- `test-books.ts` (wrong prefix)
- `books-spec.ts` (wrong suffix)
- `book_service.test.ts` (inconsistent naming)

---

## Naming Conventions

### Test Descriptions

Use behavioral descriptions that explain **what** happens, not **how**:

✅ **Good**:
```typescript
describe("Book Status Management", () => {
  test("should mark book as read when progress reaches 100%", () => {
    // Test auto-transition logic
  });
  
  test("should prevent status change when session is archived", () => {
    // Test validation logic
  });
});
```

❌ **Bad**:
```typescript
describe("updateStatus", () => {
  test("test status update", () => {
    // Vague description
  });
  
  test("should call sessionRepository.update", () => {
    // Tests implementation, not behavior
  });
});
```

### Description Style Guide

**Structure**: `should [action] when [condition]` or `should [action]`

**Examples**:
- `should return 404 when book not found`
- `should calculate streak correctly for consecutive days`
- `should archive previous session when starting re-read`
- `should filter books by multiple tags`

**Avoid**:
- Generic: "should work correctly"
- Implementation-focused: "should call X method"
- Redundant: "should test that..." (all tests test things!)

---

## Writing Tests

### Test Structure Template

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("Feature Name", () => {
  // ✅ API, Service, Integration tests: Always use database setup
  beforeAll(async () => await setupTestDatabase(__filename));
  afterAll(async () => await teardownTestDatabase(__filename));
  beforeEach(async () => await clearTestDatabase(__filename));

  // ⚠️ Library/utility tests: Skip database if testing pure functions
  // ⚠️ React hooks/components: Add afterEach(() => cleanup()) from @testing-library/react

  test("should do X when Y happens", async () => {
    // Arrange, Act, Assert
    const book = await bookRepository.create({ calibreId: 1, title: "Test" });
    const result = await someFunction(book.id);
    expect(result).toBe(expectedValue);
  });
});
```

### Assertion Style Guide

| Type | ✅ Use | ❌ Avoid |
|------|--------|----------|
| **Primitives** | `expect(id).toBe(123)` | `expect(id).toEqual(123)` |
| **Objects** | `expect(obj).toEqual({...})` | `expect(obj).toBe({...})` |
| **Partial match** | `expect(obj).toMatchObject({id: 1})` | Full object comparison |
| **Null/undefined** | `expect(x).toBeNull()` | `expect(x).toBe(null)` |
| **Arrays** | `expect(arr).toHaveLength(3)` | `expect(arr.length).toBe(3)` |
| **Contains** | `expect(arr).toContain("x")` | Manual array search |

**HTTP Response Pattern**:
```typescript
const response = await GET(request);
expect(response.status).toBe(200);    // Check status first
const data = await response.json();    // Then parse body
expect(data.books).toHaveLength(5);   // Then assert on data
```

---

## Test Types

### 1. API Integration Tests (`__tests__/api/`)

**Purpose**: Test HTTP endpoints with real database

**Setup**: Use standard [test structure template](#test-structure-template)

**Example**:
```typescript
describe("GET /api/books", () => {
  test("should return books with status filter", async () => {
    const book = await bookRepository.create({ ... });
    const response = await GET(createMockRequest("GET", "/api/books?status=reading"));
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.books[0].status).toBe("reading");
  });
});
```

**Focus**: HTTP contract, business logic, error cases (404, 400, 500)

### 2. Service Unit Tests (`__tests__/services/`)

**Purpose**: Test business logic in isolation

**Setup**: Use standard [test structure template](#test-structure-template) + instantiate service in `beforeAll`

**Example**:
```typescript
describe("BookService", () => {
  let bookService: BookService;
  beforeAll(async () => {
    await setupTestDatabase(__filename);
    bookService = new BookService();
  });

  test("should throw error for invalid rating", async () => {
    await expect(bookService.updateRating(1, 6))
      .rejects.toThrow("Rating must be between 1 and 5");
  });
});
```

**Focus**: Business rules, validations, error handling. Mock external services (Calibre, file I/O).

### 3. Library Function Tests (`__tests__/lib/`)

**Purpose**: Test pure functions and utilities

**Setup**: No database needed for pure functions

**Example**:
```typescript
describe("Streak Calculations", () => {
  test("should detect consecutive days", () => {
    const result = calculateStreakDays(yesterday, today);
    expect(result).toBe(1);
  });
});
```

**Focus**: Mathematical correctness, edge cases, no side effects
  });
  
  test("should detect broken streak", () => {
    const lastActivity = startOfDay(new Date("2025-11-14"));
    const today = startOfDay(new Date("2025-11-17"));
    
    const result = calculateStreakDays(lastActivity, today);
    
    expect(result).toBe(3); // 3 days difference = broken
  });
});
```

**Key Principles**:
- Test pure functions without database
- Test edge cases (boundaries, null, empty)
- Test mathematical correctness
- Use descriptive test data

### 4. React Hook Tests (`__tests__/hooks/`)

**Purpose**: Test React hooks in isolation

**Setup**: Mock `global.fetch`, restore in `afterEach`

**Example**:
```typescript
import { vi } from "vitest";

describe("useBookDetail", () => {
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 123, title: "Test" }),
    })) as any;
  });
  
  afterEach(() => { 
    global.fetch = originalFetch; 
  });

  test("should fetch book data on mount", async () => {
    const { result } = renderHook(() => useBookDetail("123"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith("/api/books/123");
  });
});
```

**Focus**: Loading states, error handling, API interactions. Always restore mocks.

### 5. Component Tests (`__tests__/components/`)

**Purpose**: Test React components in isolation

**Setup**: Mock Next.js components, call `cleanup()` in `afterEach`

**Example**:
```typescript
import { vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />
}));

describe("BookHeader", () => {
  afterEach(() => cleanup());

  test("should render status dropdown", () => {
    render(<BookHeader selectedStatus="to-read" {...props} />);
    expect(screen.getByText("Want to Read")).toBeInTheDocument();
  });
});
```

**Focus**: Rendering with different props, user interactions, conditional rendering

---

## Best Practices

## Best Practices

### DO ✅

1. **Use Real Database** - Integration tests use `setupTestDatabase(__filename)`
2. **Test Behavior, Not Implementation** - Assert outcomes, not internal method calls
3. **Use Descriptive Test Data** - `bookWithoutPages` > `book` (with null pages)
4. **Test Error Cases** - Every endpoint tests 404, 400, validation errors
5. **Isolate Tests** - `clearTestDatabase(__filename)` in `beforeEach`

### DON'T ❌

1. **Don't Mock Application Code** - Use real services with test database. Exception: Mock at service boundaries for external I/O (see [Service Layer Pattern](#service-layer-testing-pattern))
2. **Don't Use `as any`** - Use proper types or helpers: `createTestBook()`
3. **Don't Test Third-Party Libraries** - Test your usage, not `parseISO()` itself
4. **Don't Share State Between Tests** - Each test creates its own data
5. **Don't Leave Commented-Out Code** - Remove or explain with comments

---

## Service Layer Testing Pattern

### Overview

When testing code that interacts with external dependencies (file systems, external databases, third-party APIs), use a **service layer abstraction** to enable clean mocking at integration boundaries while keeping unit tests pure.

This pattern solves two problems:
1. **Avoids module mock pollution** - Mocking implementation modules can leak to other tests
2. **Enables dependency injection** - Services can accept mock implementations for testing

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ API Routes / Application Code                           │
│   └─> Uses: bookService.updateRating()                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ BookService (business logic)                            │
│   └─> Depends on: calibreService (injected)            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ CalibreService (external dependency abstraction)        │
│   └─> Wraps: calibre-write module functions            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ calibre-write module (low-level implementation)         │
│   └─> Direct SQLite file I/O to Calibre database       │
└─────────────────────────────────────────────────────────┘
```

**Testing Strategy:**
- **Unit tests** (`__tests__/lib/calibre-write.test.ts`): Test actual implementation with injected test database
- **Integration tests** (`__tests__/api/rating.test.ts`): Mock service layer to isolate from file system

### Implementation Pattern

#### Step 1: Create Service Interface

```typescript
// lib/services/calibre.service.ts

/**
 * Interface for Calibre operations
 * Makes it easy to create test mocks
 */
export interface ICalibreService {
  updateRating(calibreId: number, rating: number | null): void;
  updateTags(calibreId: number, tags: string[]): void;
}

/**
 * Service class wraps low-level module functions
 */
export class CalibreService implements ICalibreService {
  updateRating(calibreId: number, rating: number | null): void {
    return updateCalibreRatingImpl(calibreId, rating);
  }

  updateTags(calibreId: number, tags: string[]): void {
    return updateCalibreTagsImpl(calibreId, tags);
  }
}

// Default singleton for production use
export const calibreService = new CalibreService();
```

#### Step 2: Use Dependency Injection in Consumers

```typescript
// lib/services/book.service.ts

export class BookService {
  private calibre?: ICalibreService;
  
  constructor(calibre?: ICalibreService) {
    this.calibre = calibre;
  }
  
  /**
   * Lazy load calibre service to support test mocking
   * Always re-imports to ensure test mocks are applied
   */
  private getCalibreService(): ICalibreService {
    if (this.calibre) {
      return this.calibre;
    }
    // Lazy import - don't cache to support test mocking
    const { calibreService } = require("@/lib/services/calibre.service");
    return calibreService;
  }
  
  async updateRating(bookId: number, rating: number | null): Promise<Book> {
    const book = await bookRepository.findById(bookId);
    
    // Use injected or lazy-loaded service
    await this.getCalibreService().updateRating(book.calibreId, rating);
    
    return bookRepository.update(bookId, { rating });
  }
}

// Default singleton for production use
export const bookService = new BookService();
```

#### Step 3: Test Implementation with Real Database

```typescript
// __tests__/lib/calibre-write.test.ts

import { Database } from "bun:sqlite";
import { updateCalibreRating, readCalibreRating } from "@/lib/db/calibre-write";

describe("Calibre Write Operations", () => {
  let testDb: Database;
  
  beforeAll(() => {
    // Create in-memory test database with Calibre schema
    testDb = new Database(":memory:");
    createCalibreSchema(testDb);
  });
  
  test("should update rating in Calibre database", () => {
    // Test actual implementation by injecting test database
    updateCalibreRating(1, 5, testDb);
    
    const rating = readCalibreRating(1, testDb);
    expect(rating).toBe(5);
  });
});
```

#### Step 4: Test Integration with Mocked Service

```typescript
// __tests__/api/rating.test.ts

import { vi } from "vitest";

// Mock the service layer (not the implementation)
const { mockUpdateRating } = vi.hoisted(() => ({
  mockUpdateRating: vi.fn(),
}));

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: (calibreId: number, rating: number | null) => {
      mockUpdateRating(calibreId, rating);
    },
  },
  CalibreService: class {},
}));

// Import after mock is set up
import { POST } from "@/app/api/books/[id]/rating/route";

test("should update book rating and sync to Calibre", async () => {
  const book = await bookRepository.create({ calibreId: 123, ... });
  
  const response = await POST(createMockRequest("POST", "/api/books/123/rating", {
    rating: 5
  }));
  
  // Verify API updated Tome database
  expect(response.status).toBe(200);
  
  // Verify API called Calibre service
  expect(mockUpdateRating).toHaveBeenCalledWith(123, 5);
});
```

### When to Use This Pattern

✅ **Use service layer abstraction when:**
- Interacting with external file systems (Calibre database)
- Calling third-party APIs (webhooks, email services)
- Performing expensive I/O operations (image processing, file uploads)
- Testing code that depends on these operations

❌ **Don't use service layer when:**
- Working with your own database (use test database instead)
- Testing pure functions (no external dependencies)
- Mocking would hide important business logic

### Benefits

1. **No Test Pollution**: Mocking service layer doesn't affect implementation tests
2. **Clean Boundaries**: Clear separation between business logic and external I/O
3. **Testable**: Can test both implementation (with test DB) and integration (with mocks)
4. **Flexible**: Easy to swap implementations (production vs. test vs. mock)
5. **Type-Safe**: Interfaces ensure mock compatibility

### Real-World Example: Calibre Integration

**Problem**: Tests for `calibre-write` module were being polluted by module mocks in API tests.

**Solution**: 
1. Created `CalibreService` to wrap `calibre-write` functions
2. `BookService` uses lazy-loaded `calibreService`
3. API tests mock `CalibreService` (service layer)
4. Unit tests test `calibre-write` directly (implementation layer)

**Result**: 
- `calibre-write.test.ts` tests actual Calibre database operations
- `rating.test.ts` verifies API behavior without file I/O
- No mock leakage between test files

---

## Common Patterns

### Pattern 1: Testing Progress with Auto-Calculations

```typescript
test("should auto-calculate percentage from pages", async () => {
  const { book, session } = await createTestBookWithSession({ totalPages: 300 });
  
  const response = await POST(
    createMockRequest("POST", `/api/books/${book.id}/progress`, {
      sessionId: session.id,
      currentPage: 150,
    })
  );
  
  const data = await response.json();
  expect(data.currentPercentage).toBe(50); // 150/300 = 50%
});
```

### Pattern 2: Testing Re-reading Flow

```typescript
test("should archive previous session when starting re-read", async () => {
  const { book, session } = await createTestBookWithSession({ 
    status: "read", 
    completedDate: new Date("2024-01-01") 
  });

  const response = await POST(createMockRequest("POST", "/api/books/reread", { bookId: book.id }));
  
  expect((await sessionRepository.findById(session.id))?.isActive).toBe(false);
  expect((await response.json()).sessionNumber).toBe(2);
});
```

### Pattern 3: Testing Filtered Lists

```typescript
test("should filter books by multiple criteria", async () => {
  const book1 = await createTestBook({ title: "Fantasy", tags: ["fantasy"] });
  const book2 = await createTestBook({ title: "Sci-Fi", tags: ["sci-fi"] });
  await sessionRepository.create({ bookId: book1.id, status: "reading" });

  const response = await GET(createMockRequest("GET", "/api/books?status=reading&tags=fantasy"));
  const data = await response.json();
  
  expect(data.books).toHaveLength(1);
  expect(data.books[0].title).toBe("Fantasy");
});
```

### Pattern 4: Testing Streak Logic

```typescript
test("should increment streak for consecutive days", async () => {
  await streakRepository.upsertStreak({
    currentStreak: 5,
    lastActivityDate: new Date("2025-11-16"),
  });
  
  const { book, session } = await createTestBookWithSession();
  await POST(createMockRequest("POST", `/api/books/${book.id}/progress`, {
    sessionId: session.id,
    currentPage: 50,
  }));

  const streak = await streakRepository.getActiveStreak();
  expect(streak?.currentStreak).toBe(6);
});
```

### Pattern 5: Testing Error Handling

```typescript
test("should return 400 for invalid input", async () => {
  const response = await POST(createMockRequest("POST", "/api/books", { title: "Test" }));
  expect(response.status).toBe(400);
});

test("should return 404 for non-existent book", async () => {
  const response = await GET(createMockRequest("GET", "/api/books/99999"));
  expect(response.status).toBe(404);
});

test("should handle database constraint violations", async () => {
  const book = await createTestBook();
  await expect(createTestBook({ calibreId: book.calibreId })).rejects.toThrow();
});
```

### Pattern 6: Testing External Dependencies (Calibre Database)

**See [Service Layer Testing Pattern](#service-layer-testing-pattern) for full architecture and implementation details.**

This pattern uses two complementary approaches:

**Approach A: Unit Tests** - Test implementation with injected test database
- File: `__tests__/lib/calibre-write.test.ts`
- Method: Inject in-memory Calibre database into production functions
- Tests: Business logic, scale conversion, database constraints

**Approach B: Integration Tests** - Mock service layer to isolate from file system
- File: `__tests__/api/rating.test.ts`, `__tests__/api/tags.test.ts`
- Method: Mock `CalibreService` at service boundary
- Tests: API contract, error handling, best-effort sync behavior

**Comparison**:

| Aspect | Unit Tests (Approach A) | Integration Tests (Approach B) |
|--------|------------------------|--------------------------------|
| **What's tested** | Low-level implementation | End-to-end API flow |
| **Database** | Calibre test schema | Tome test database |
| **Mocking** | None (real functions) | Service layer only |
| **Coverage** | Business logic, edge cases | API contract, error handling |

**Result**: Both approaches together provide confidence in implementation correctness and integration behavior without file system dependencies or test pollution.

---

## Vitest-Specific Patterns

### Mock Hoisting with vi.hoisted()

**Problem**: Variables referenced in `vi.mock()` factory functions must be hoisted to module scope.

**Solution**: Use `vi.hoisted()` to create variables accessible in mock factories:

```typescript
import { vi } from "vitest";

// ✅ CORRECT: Use vi.hoisted() for shared mock state
const { mockCalibres, resetMockCalibres } = vi.hoisted(() => {
  const calls: Array<{ id: number; rating: number }> = [];
  return {
    mockCalibres: calls,
    resetMockCalibres: () => calls.splice(0, calls.length),
  };
});

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: (id: number, rating: number) => {
      mockCalibres.push({ id, rating }); // Now accessible!
    },
  },
}));

// Import AFTER mock is defined
import { updateBookRating } from "@/lib/services/book.service";

describe("Book Rating", () => {
  beforeEach(() => {
    resetMockCalibres();
  });

  test("should sync rating to Calibre", async () => {
    await updateBookRating(1, 5);
    expect(mockCalibres).toHaveLength(1);
    expect(mockCalibres[0]).toEqual({ id: 1, rating: 5 });
  });
});
```

**Key Points**:
- `vi.hoisted()` ensures variables are available during mock factory execution
- Must be called before `vi.mock()`
- Returns the values that will be accessible in the mock

### better-sqlite3 API Differences

When working with SQLite in tests, use `better-sqlite3` (cross-platform) instead of `bun:sqlite`:

| Operation | better-sqlite3 | Notes |
|-----------|----------------|-------|
| **Import** | `import Database from "better-sqlite3"` | Default export |
| **Type** | `Database.Database` | Namespace type |
| **DDL statements** | `db.exec(sql)` | For CREATE, ALTER, etc. |
| **Prepared statements** | `db.prepare(sql).run()` | ✅ Same API |
| **No results** | Returns `undefined` | Use `toBeFalsy()` in assertions |
| **Readonly mode** | `new Database(path, { readonly: true })` | ✅ Same API |

**Example**:
```typescript
import Database from "better-sqlite3";

describe("Calibre Integration", () => {
  let testDb: Database.Database;

  beforeAll(() => {
    testDb = new Database(":memory:");
    
    // DDL: Use exec()
    testDb.exec(`CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT)`);
    
    // DML: Use prepare().run()
    testDb.prepare("INSERT INTO books (id, title) VALUES (?, ?)").run(1, "Test");
  });

  test("should query book", () => {
    const book = testDb.prepare("SELECT * FROM books WHERE id = ?").get(1);
    expect(book).toBeDefined();
    
    // No result returns undefined (not null)
    const missing = testDb.prepare("SELECT * FROM books WHERE id = ?").get(999);
    expect(missing).toBeFalsy(); // Works for both null and undefined
  });
});
```

### Async Test Patterns

**Waiting for state changes:**
```typescript
import { waitFor } from "@testing-library/react";

test("should update after async operation", async () => {
  const { result } = renderHook(() => useBookDetail("123"));
  
  // Wait for loading to finish
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  
  expect(result.current.data).toBeDefined();
});
```

**Testing error states:**
```typescript
test("should handle fetch errors", async () => {
  global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));
  
  const { result } = renderHook(() => useBookDetail("123"));
  
  await waitFor(() => {
    expect(result.current.error).toBeDefined();
  });
  
  expect(result.current.error?.message).toBe("Network error");
});
```

### Environment Variables in Tests

**Setting environment variables:**
```typescript
describe("Environment Config", () => {
  const originalEnv = process.env.CALIBRE_DB_PATH;

  beforeAll(() => {
    process.env.CALIBRE_DB_PATH = "/test/path/metadata.db";
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.CALIBRE_DB_PATH = originalEnv;
    } else {
      delete process.env.CALIBRE_DB_PATH;
    }
  });

  test("should use test database path", () => {
    expect(process.env.CALIBRE_DB_PATH).toBe("/test/path/metadata.db");
  });
});
```

### Spy vs Mock vs Stub

**Spy** - Track calls to real function:
```typescript
const spy = vi.spyOn(bookRepository, 'findById');
await bookService.getBook(123);
expect(spy).toHaveBeenCalledWith(123);
spy.mockRestore(); // Restore original
```

**Mock** - Replace entire module:
```typescript
vi.mock("@/lib/db/calibre", () => ({
  getCalibreDB: vi.fn(() => mockDb),
}));
```

**Stub** - Replace function implementation:
```typescript
const stub = vi.fn(() => ({ id: 1, title: "Test" }));
bookRepository.findById = stub;
```

---

## Troubleshooting

---

### Problem: Tests fail with "Database not found"

**Cause**: Forgot to call `setupTestDatabase(__filename)`

**Solution**:
```typescript
beforeAll(async () => {
  await setupTestDatabase(__filename);
});
```

### Problem: Tests pass in isolation but fail when run together

**Cause**: Missing `clearTestDatabase()` in `beforeEach`

**Solution**:
```typescript
beforeEach(async () => {
  await clearTestDatabase(__filename);
});
```

### Problem: "Cannot find module" errors

**Cause**: Import path is incorrect after test reorganization

**Solution**: Update import paths. Use `@/` for absolute imports from project root:
```typescript
import { bookRepository } from "@/lib/repositories";
```

### Problem: Mocks leak between test files

**Cause**: Using `vi.mock()` without proper hoisting or cleanup

**Symptoms**:
- Test file A mocks a module, but Test file B (which doesn't mock) is affected
- Functions return undefined or behave unexpectedly in unrelated tests
- Tests pass individually but fail when run together

**Solutions** (in order of preference):

#### 1. ✅ BEST: Use Service Layer Abstraction

Create a service layer to wrap external dependencies, then mock the service instead of the implementation:

```typescript
// ✅ Good - Mock service layer (CalibreService pattern)
// __tests__/api/rating.test.ts
import { vi } from "vitest";

vi.mock("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: vi.fn(() => {}),
  },
}));

// __tests__/lib/calibre-write.test.ts - NOT AFFECTED
// Tests actual implementation with injected test database
import { updateCalibreRating } from "@/lib/db/calibre-write";
```

**Why this works:**
- Service layer and implementation are separate modules
- Mocking service doesn't affect implementation tests
- Clean separation of concerns
- See "Service Layer Testing Pattern" section for full details

**Real-world example:**
- Created `CalibreService` to wrap `calibre-write` functions
- API tests mock `CalibreService` (no leakage to implementation tests)
- Unit tests test `calibre-write` directly with test database

#### 2. Use vi.hoisted() for Module-Level Variables

```typescript
// ✅ Correct: Use vi.hoisted() for shared mock state
const { mockData } = vi.hoisted(() => {
  return {
    mockData: { id: 1, title: "Test" }
  };
});

vi.mock("@/lib/services/book.service", () => ({
  bookService: {
    getBook: vi.fn(() => mockData),
  },
}));
```

#### 3. Use Dependency Injection

```typescript
// Production code accepts optional dependencies
export class BookService {
  constructor(private calibre?: ICalibreService) {}
  
  private getCalibreService() {
    if (this.calibre) return this.calibre;
    return require("@/lib/services/calibre.service").calibreService;
  }
}

// Tests inject mocks
const mockCalibre = { updateRating: vi.fn(() => {}) };
const bookService = new BookService(mockCalibre);
```

#### 4. Add Test-Specific Behavior in Production Code

```typescript
// lib/db/calibre-write.ts
function getLoggerSafe() {
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {} }; // No-op logger
  }
  return getLogger();
}
```

**Related sections:**
- See "Service Layer Testing Pattern" for architecture details
- See Pattern 6 for testing external dependencies examples
- See "Vitest-Specific Patterns" for vi.hoisted() usage

### Problem: Component tests fail with "ReferenceError: document is not defined"

**Cause**: Missing test setup for DOM environment

**Solution**: Ensure `test-setup.ts` is configured in `vitest.config.ts`:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test-setup.ts'],
    environment: 'jsdom',
    globals: true,
  },
});
```

### Problem: Async tests timeout

**Cause**: Missing `await` on async operations

**Solution**: Ensure all async operations are awaited:
```typescript
// ❌ Bad
test("should update book", () => {
  bookRepository.update(1, { title: "New Title" }); // Missing await!
});

// ✅ Good
test("should update book", async () => {
  await bookRepository.update(1, { title: "New Title" });
});
```

### Problem: "Type 'X' is not assignable" errors

**Cause**: Test data doesn't match schema types exactly

**Solution**: Create properly typed test data or use type helpers:
```typescript
// Option 1: Inline with all required fields
const book = await bookRepository.create({
  calibreId: 1,
  title: "Test",
  authors: ["Author"],
  tags: [],
  path: "Author/Test (1)",
  // Include all required fields
});

// Option 2: Create a type helper (in fixtures/test-data.ts)
function createTestBook(overrides?: Partial<NewBook>): NewBook {
  return {
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    path: "Test Author/Test Book (1)",
    orphaned: false,
    ...overrides,
  };
}
```

---

## Quick Reference

### Test File Template

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

describe("Feature Name", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  test("should do something", async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Common Imports

```typescript
// Test framework
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// Database helpers
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";

// Repositories
import { bookRepository, sessionRepository, progressRepository, streakRepository } from "@/lib/repositories";

// Test data
import { createMockRequest } from "@/__tests__/fixtures/test-data";

// React testing
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
```

### Useful Commands

```bash
# Run all tests (automatically sets TZ=UTC via package.json script)
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
TZ=UTC NODE_ENV=test bunx vitest run __tests__/api/books.test.ts

# Run tests matching pattern
TZ=UTC NODE_ENV=test bunx vitest run -t "should filter books"

# Run with UI
TZ=UTC NODE_ENV=test bunx vitest --ui

# Run with coverage
npm run test:coverage

# Debug a specific test
TZ=UTC NODE_ENV=test bunx vitest run __tests__/api/books.test.ts --reporter=verbose
```

---

## Version History

- **2.0.0** (2025-01-05): Vitest migration
  - Migrated from Bun Test to Vitest test runner
  - Added TZ=UTC environment requirement and explanation in "Test Environment Setup" section
  - Updated all code examples to use Vitest syntax (`vi.mock`, `vi.hoisted`, `vi.fn`)
  - Replaced `bun:sqlite` with `better-sqlite3` in examples and actual tests
  - Added comprehensive "Vitest-Specific Patterns" section covering:
    - Mock hoisting with `vi.hoisted()`
    - better-sqlite3 API differences table
    - Async test patterns with `waitFor()`
    - Environment variable handling
    - Spy vs Mock vs Stub patterns
  - Removed Bun-specific troubleshooting (module caching issue - lines 961-1053)
  - Updated test commands to use npm scripts with automatic TZ=UTC handling
  - Updated test setup references from `bunfig.toml` to `vitest.config.ts`
  - Updated mock leakage troubleshooting with `vi.hoisted()` patterns
  - All 103 test files passing in Vitest with cross-platform compatibility
- **1.2.0** (2025-12-28): Optimized for AI consumption (19% reduction)
  - Condensed Pattern 6 to cross-reference Service Layer section (removed 140 lines of duplication)
  - Consolidated test structure templates into single authoritative template (removed 90 lines)
  - Converted Assertion Style Guide to table format (removed 35 lines)
  - Streamlined Test Types section with references to main template (removed 60 lines)
  - Created `test-data-helpers.ts` to support condensed examples
  - Reduced from 1,578 to 1,275 lines (303 lines saved)
- **1.1.0** (2025-12-28): Added service layer testing pattern
  - Documented CalibreService abstraction pattern for external dependencies
  - Added Pattern 6: Testing External Dependencies (Calibre Database)
  - Updated mock leakage troubleshooting with service layer solution
  - Clarified when to mock at service boundaries vs. testing with real databases
  - Added lazy loading pattern for dependency injection in services
- **1.0.0** (2025-11-26): Initial version based on codebase analysis

---

**Questions or Suggestions?**  
Open an issue with the `testing` label on GitHub.
