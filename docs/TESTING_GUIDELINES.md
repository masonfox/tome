# Tome Testing Guidelines

**Version**: 1.0.0  
**Last Updated**: 2025-11-26  
**Status**: Active

> This document defines testing standards for the Tome project, aligned with the Constitution's principle of "Trust but Verify."

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Test Structure](#test-structure)
3. [Naming Conventions](#naming-conventions)
4. [Writing Tests](#writing-tests)
5. [Test Types](#test-types)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

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
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
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
describe("useBookDetail", () => {
  beforeEach(() => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 123, title: "Test" }),
    }));
  });
  afterEach(() => { global.fetch = originalFetch; });

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
mock.module("next/image", () => ({
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
1. **Avoids `mock.module()` pollution** - Mocking implementation modules can leak to other tests
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

import { mock } from "bun:test";

// Mock the service layer (not the implementation)
let mockUpdateRating = mock(() => {});

mock.module("@/lib/services/calibre.service", () => ({
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

**Problem**: Tests for `calibre-write` module were being polluted by `mock.module()` calls in API tests.

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

## Troubleshooting

### Problem: Tests fail in CI but pass locally (Bun Module Caching Bug)

**Symptoms**:
- Tests pass 100% locally
- Tests fail in CI after 40+ serial test runs
- Functions return `undefined` or use stale implementations
- Dynamic `await import()` doesn't help

**Cause**: Bun's transpiler cache returns stale/cached versions of ES6 module exports after many serial test runs in CI environments. This affects direct function imports from library modules.

**Example**:
```typescript
// ❌ PROBLEMATIC: Direct function import (can be cached)
import { rebuildStreak, updateStreaks } from "@/lib/streaks";

// In CI after 40+ tests:
const result = await rebuildStreak(); // Returns undefined (stale version)
```

**Solution**: Use service layer pattern with inline implementations

**Step 1**: Create service class with inline method implementations
```typescript
// lib/services/streak.service.ts
export class StreakService {
  /**
   * Rebuild streak from all progress data
   * Inline implementation to avoid Bun module caching issues in tests
   */
  async rebuildStreak(userId: number | null = null): Promise<Streak> {
    // Full implementation here (not delegating to another module)
    const existingStreak = await streakRepository.findByUserId(userId);
    const allProgress = await progressRepository.getAllProgressOrdered();
    // ... rest of implementation
  }
}

export const streakService = new StreakService();
```

**Step 2**: Update tests to use service layer
```typescript
// ❌ Before (direct import - susceptible to caching)
import { rebuildStreak } from "@/lib/streaks";
await rebuildStreak();

// ✅ After (service layer - cache-immune)
import { streakService } from "@/lib/services/streak.service";
await streakService.rebuildStreak();
```

**Why this works**:
- Class methods are not affected by ES6 module caching
- Test imports service once at start (method is "live")
- Methods execute current code, not cached transpiled versions
- Complete isolation from Bun's module cache

**When to apply this pattern**:
- Functions that are called in many tests (40+ cumulative calls)
- Functions that fail in CI but work locally
- Functions that return `undefined` in CI
- Integration/unit tests that run after many other tests

**Reference**: See `docs/archive/CI-STREAK-TEST-FAILURE-INVESTIGATION.md` for full investigation details and the 7-phase debugging process that led to this solution.

**Alternative Solution**: Import service layer instead of direct functions

For functions where inlining is not practical, use service layer imports instead of direct function imports:

```typescript
// ❌ PROBLEMATIC: Direct function import
import { rebuildStreak } from "@/lib/streaks";
await rebuildStreak();

// ✅ SOLUTION: Service layer import (bypasses module cache)
import { streakService } from "@/lib/services/streak.service";
await streakService.rebuildStreak();
```

This works because:
- Service layer is imported once, class methods remain "live"
- Methods bypass ES6 module export caching
- No need to inline entire implementation
- Original library functions remain unchanged

**Real-world example**:
After 40+ tests in CI, `ProgressService.updateStreakSystem()` was calling `rebuildStreak()` which returned `undefined` due to stale cached exports. Changing to `streakService.rebuildStreak()` resolved all 4 failing tests.

**Related commits**:
- `cd0c6b6` - Fix CI test failures by using StreakService instead of direct rebuildStreak import
- `4910da0` - Fix Bun module caching by inlining rebuildStreak in StreakService
- `d7a72ce` - Add updateStreaks and getStreakBasic to service layer for cache isolation

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

**Cause**: Using `mock.module()` which is global and permanent in Bun

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
mock.module("@/lib/services/calibre.service", () => ({
  calibreService: {
    updateRating: mock(() => {}),
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

#### 2. Use Dependency Injection

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
const mockCalibre = { updateRating: mock(() => {}) };
const bookService = new BookService(mockCalibre);
```

#### 3. Add Test-Specific Behavior in Production Code

```typescript
// lib/db/calibre-write.ts
function getLoggerSafe() {
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {} }; // No-op logger
  }
  return getLogger();
}
```

#### 4. Control Test Execution Order (Last Resort)

If you must use `mock.module()`:
- Tests that DON'T mock should run first (prefix with `000-`)
- Tests that DO mock run later (their mocks won't affect earlier tests)
- Example: `__tests__/000-calibre-write.test.ts` runs before API tests
- Always run tests serially (`concurrency = 1` in bunfig.toml)

**⚠️ Warning**: This is fragile and should be avoided. Use service layer pattern instead.

**Related sections:**
- See "Service Layer Testing Pattern" for architecture details
- See Pattern 6 for testing external dependencies examples

### Problem: Component tests fail with "ReferenceError: document is not defined"

**Cause**: Missing test setup for DOM environment

**Solution**: Ensure `test-setup.ts` is configured in `bunfig.toml`:
```toml
[test]
preload = ["./test-setup.ts"]
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
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
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
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";

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
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test __tests__/api/books.test.ts

# Run tests matching pattern
bun test --grep "should filter books"

# Run with coverage (if configured)
bun test --coverage
```

---

## Version History

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
