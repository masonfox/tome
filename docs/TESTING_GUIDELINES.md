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
import { bookRepository } from "@/lib/repositories";

// Describe what you're testing
describe("Feature Name", () => {
  // Setup: Run once before all tests
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  // Cleanup: Run once after all tests
  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  // Reset: Run before each test for isolation
  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  // Group related tests
  describe("Specific Behavior", () => {
    test("should do X when Y happens", async () => {
      // Arrange: Set up test data
      const book = await bookRepository.create({
        calibreId: 1,
        title: "Test Book",
        authors: ["Author"],
        tags: [],
        path: "Author/Test Book (1)",
      });

      // Act: Perform the action
      const result = await someFunction(book.id);

      // Assert: Verify the outcome
      expect(result).toBe(expectedValue);
    });
  });
});
```

### Assertion Style Guide

#### Primitive Comparison

```typescript
// ✅ Use .toBe() for primitives and references
expect(book.id).toBe(123);
expect(loading).toBe(true);
expect(status).toBe("reading");

// ❌ Don't use .toEqual() for primitives
expect(loading).toEqual(true); // Wrong - unnecessary deep comparison
```

#### Object/Array Comparison

```typescript
// ✅ Use .toEqual() for deep equality
expect(book).toEqual({ id: 123, title: "Test" });
expect(tags).toEqual(["fantasy", "sci-fi"]);

// ✅ Use .toMatchObject() for partial matching
expect(book).toMatchObject({ title: "Test" }); // Ignores other properties
```

#### Null/Undefined Checks

```typescript
// ✅ Use specific matchers for clarity
expect(result).toBeNull();
expect(result).toBeUndefined();
expect(result).toBeDefined();
expect(array).toHaveLength(3);

// ❌ Don't use generic matchers
expect(result).toBe(null); // Less semantic
expect(result == null).toBe(true); // Hard to read
```

#### Array/Collection Checks

```typescript
// ✅ Use collection-specific matchers
expect(books).toHaveLength(5);
expect(tags).toContain("fantasy");
expect(tags).toEqual(["fantasy", "sci-fi"]); // Order matters
expect(tags).toEqual(expect.arrayContaining(["fantasy"])); // Order doesn't matter

// For objects in arrays
expect(books).toContainEqual({ id: 123, title: "Test" });
```

#### HTTP Response Testing

```typescript
// ✅ Test status and body separately
const response = await GET(request);
expect(response.status).toBe(200);

const data = await response.json();
expect(data.books).toHaveLength(5);
expect(data.total).toBe(5);
```

---

## Test Types

### 1. API Integration Tests (`__tests__/api/`)

**Purpose**: Test HTTP endpoints with real database

**Pattern**:
```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";
import { GET, POST } from "@/app/api/books/route";
import { createMockRequest } from "../fixtures/test-data";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("GET /api/books", () => {
  test("should return books with status filter", async () => {
    // Arrange: Create test data
    const book = await bookRepository.create({ ... });
    await sessionRepository.create({ bookId: book.id, status: "reading" });

    // Act: Call API endpoint
    const request = createMockRequest("GET", "/api/books?status=reading");
    const response = await GET(request);
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].status).toBe("reading");
  });
});
```

**Key Principles**:
- Use real database (in-memory SQLite)
- Test HTTP contract (status codes, response shape)
- Test business logic (filtering, validation)
- Test error cases (404, 400, 500)

### 2. Service Unit Tests (`__tests__/services/`)

**Purpose**: Test business logic in isolation

**Pattern**:
```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { BookService } from "@/lib/services/book.service";
import { bookRepository } from "@/lib/repositories";

describe("BookService", () => {
  let bookService: BookService;

  beforeAll(async () => {
    await setupTestDatabase(__filename);
    bookService = new BookService();
  });

  afterAll(async () => {
    await teardownTestDatabase(__filename);
  });

  beforeEach(async () => {
    await clearTestDatabase(__filename);
  });

  describe("updateRating", () => {
    test("should throw error for invalid rating", async () => {
      const book = await bookRepository.create({ ... });
      
      await expect(
        bookService.updateRating(book.id, 6)
      ).rejects.toThrow("Rating must be between 1 and 5");
    });
  });
});
```

**Key Principles**:
- Test business rules and validations
- Test error handling
- Use real database for complex queries
- Mock external services (Calibre sync, file I/O)

### 3. Library Function Tests (`__tests__/lib/`)

**Purpose**: Test pure functions and utilities

**Pattern**:
```typescript
import { describe, test, expect } from "bun:test";
import { calculateStreakDays } from "@/lib/streaks";
import { startOfDay } from "date-fns";

describe("Streak Calculations", () => {
  test("should detect consecutive days", () => {
    const today = startOfDay(new Date("2025-11-17"));
    const yesterday = startOfDay(new Date("2025-11-16"));
    
    const result = calculateStreakDays(yesterday, today);
    
    expect(result).toBe(1); // 1 day difference = consecutive
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

**Pattern**:
```typescript
import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useBookDetail } from "@/hooks/useBookDetail";

// Mock fetch globally
const originalFetch = global.fetch;

describe("useBookDetail", () => {
  beforeEach(() => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 123, title: "Test Book" }),
    } as Response));
  });

  afterEach(() => {
    global.fetch = originalFetch; // Always restore!
  });

  test("should fetch book data on mount", async () => {
    const { result } = renderHook(() => useBookDetail("123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.book).toEqual({ id: 123, title: "Test Book" });
    expect(global.fetch).toHaveBeenCalledWith("/api/books/123");
  });
});
```

**Key Principles**:
- Mock API calls (hooks should not hit real database)
- Test loading states
- Test error handling
- Test refetch/retry logic
- **ALWAYS restore mocks in afterEach**

### 5. Component Tests (`__tests__/components/`)

**Purpose**: Test React components in isolation

**Pattern**:
```typescript
import { test, expect, describe, afterEach, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import BookHeader from "@/components/BookDetail/BookHeader";

// Mock Next.js Image (no real implementation available)
mock.module("next/image", () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

afterEach(() => {
  cleanup(); // Always cleanup after each test
});

describe("BookHeader", () => {
  test("should render status dropdown", () => {
    render(
      <BookHeader
        book={{ calibreId: 1, totalPages: 300 }}
        selectedStatus="to-read"
        onStatusChange={() => {}}
        // ... other required props
      />
    );

    expect(screen.getByText("Want to Read")).toBeInTheDocument();
  });
  
  test("should show rating when book is rated", () => {
    render(
      <BookHeader
        book={{ calibreId: 1, totalPages: 300 }}
        selectedStatus="read"
        rating={4}
        // ... other required props
      />
    );

    expect(screen.getByText("4 stars")).toBeInTheDocument();
  });
});
```

**Key Principles**:
- Mock Next.js components (Image, Link)
- Test rendering with different props
- Test user interactions (clicks, form inputs)
- Test conditional rendering
- **ALWAYS call cleanup() in afterEach**

---

## Best Practices

### DO ✅

1. **Use Real Database for Integration Tests**
   ```typescript
   // ✅ Good - Real database, real queries
   await setupTestDatabase(__filename);
   const book = await bookRepository.create({ ... });
   ```

2. **Test Behavior, Not Implementation**
   ```typescript
   // ✅ Good - Tests the outcome
   test("should mark book as read when progress reaches 100%", () => {
     // Assert that status changed to "read"
   });
   
   // ❌ Bad - Tests how it's done
   test("should call sessionRepository.update with status='read'", () => {
     // Fragile - breaks if implementation changes
   });
   ```

3. **Use Descriptive Test Data**
   ```typescript
   // ✅ Good - Clear intent
   const bookWithoutPages = await bookRepository.create({
     title: "Book Without Total Pages",
     totalPages: null,
   });
   
   // ❌ Bad - Magic values
   const book = await bookRepository.create({ totalPages: null });
   ```

4. **Test Error Cases**
   ```typescript
   // ✅ Good - Tests validation
   test("should return 404 when book not found", async () => {
     const response = await GET(createMockRequest("GET", "/api/books/99999"));
     expect(response.status).toBe(404);
   });
   ```

5. **Isolate Tests**
   ```typescript
   // ✅ Good - Each test is independent
   beforeEach(async () => {
     await clearTestDatabase(__filename);
   });
   ```

### DON'T ❌

1. **Don't Mock Application Code**
   ```typescript
   // ❌ Bad - Mocking your own services
   mock.module("@/lib/services/book.service", () => ({
     BookService: class { ... }
   }));
   
   // ✅ Good - Use real service with test database
   const bookService = new BookService();
   ```

2. **Don't Use `as any` for Type Assertions**
   ```typescript
   // ❌ Bad - Defeats type safety
   const book = await bookRepository.create(mockBook1 as any);
   
   // ✅ Good - Use proper types or create type helper
   const book = await bookRepository.create({
     calibreId: 1,
     title: "Test",
     authors: ["Author"],
     tags: [],
     path: "Author/Test (1)",
   });
   ```

3. **Don't Test Third-Party Libraries**
   ```typescript
   // ❌ Bad - Testing date-fns
   test("should parse date correctly", () => {
     const result = parseISO("2025-11-17");
     expect(result).toBeInstanceOf(Date);
   });
   
   // ✅ Good - Test your usage of the library
   test("should calculate streak based on dates", () => {
     const result = calculateStreakDays(date1, date2);
     expect(result).toBe(1);
   });
   ```

4. **Don't Share State Between Tests**
   ```typescript
   // ❌ Bad - Tests depend on order
   let book: Book;
   
   test("create book", async () => {
     book = await bookRepository.create({ ... });
   });
   
   test("update book", async () => {
     await bookRepository.update(book.id, { ... }); // Fails if first test skipped!
   });
   
   // ✅ Good - Each test is self-contained
   test("should update book", async () => {
     const book = await bookRepository.create({ ... });
     await bookRepository.update(book.id, { ... });
     // Assert...
   });
   ```

5. **Don't Leave Commented-Out Code**
   ```typescript
   // ❌ Bad - Dead code
   // expect(data.books[0].rating).toBe(5);
   
   // ✅ Good - Remove or add explanation
   // Note: Rating moved from sessions to books table
   expect(data.books[0].rating).toBeNull(); // Not set in this test
   ```

---

## Common Patterns

### Pattern 1: Testing Progress with Auto-Calculations

```typescript
test("should auto-calculate percentage from pages", async () => {
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Author"],
    tags: [],
    path: "Author/Test Book (1)",
    totalPages: 300, // Important for calculation
  });

  const session = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "reading",
    isActive: true,
  });

  const request = createMockRequest("POST", `/api/books/${book.id}/progress`, {
    sessionId: session.id,
    currentPage: 150, // 50% of 300
  });

  const response = await POST(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.currentPage).toBe(150);
  expect(data.currentPercentage).toBe(50); // Auto-calculated
});
```

### Pattern 2: Testing Re-reading Flow

```typescript
test("should archive previous session when starting re-read", async () => {
  const book = await bookRepository.create({ ... });

  // First read (completed)
  const session1 = await sessionRepository.create({
    bookId: book.id,
    sessionNumber: 1,
    status: "read",
    isActive: true,
    completedDate: new Date("2024-01-01"),
  });

  // Start re-reading
  const request = createMockRequest("POST", "/api/books/reread", {
    bookId: book.id,
  });
  const response = await POST(request);

  // Assert session1 is archived
  const archivedSession = await sessionRepository.findById(session1.id);
  expect(archivedSession?.isActive).toBe(false);

  // Assert new session created
  const data = await response.json();
  expect(data.sessionNumber).toBe(2);
  expect(data.isActive).toBe(true);
});
```

### Pattern 3: Testing Filtered Lists

```typescript
test("should filter books by multiple criteria", async () => {
  // Create test books with different attributes
  const book1 = await bookRepository.create({
    calibreId: 1,
    title: "Fantasy Book",
    authors: ["Author 1"],
    tags: ["fantasy", "magic"],
    path: "Author 1/Fantasy Book (1)",
  });

  const book2 = await bookRepository.create({
    calibreId: 2,
    title: "Sci-Fi Book",
    authors: ["Author 2"],
    tags: ["sci-fi", "space"],
    path: "Author 2/Sci-Fi Book (2)",
  });

  await sessionRepository.create({
    bookId: book1.id,
    sessionNumber: 1,
    status: "reading",
    isActive: true,
  });

  // Filter by status + tags
  const request = createMockRequest(
    "GET",
    "/api/books?status=reading&tags=fantasy"
  );
  const response = await GET(request);
  const data = await response.json();

  expect(data.books).toHaveLength(1);
  expect(data.books[0].title).toBe("Fantasy Book");
});
```

### Pattern 4: Testing Streak Logic

```typescript
test("should increment streak for consecutive days", async () => {
  // Create initial streak
  await streakRepository.upsertStreak({
    currentStreak: 5,
    longestStreak: 10,
    lastActivityDate: new Date("2025-11-16"),
    streakStartDate: new Date("2025-11-11"),
    totalDaysActive: 15,
  });

  // Log progress (triggers streak update)
  const book = await bookRepository.create({ ... });
  const session = await sessionRepository.create({ ... });
  
  const request = createMockRequest("POST", `/api/books/${book.id}/progress`, {
    sessionId: session.id,
    currentPage: 50,
  });
  await POST(request);

  // Verify streak incremented (assuming test runs on 2025-11-17)
  const streak = await streakRepository.getActiveStreak();
  expect(streak?.currentStreak).toBe(6); // Was 5, now 6
  expect(streak?.lastActivityDate).toEqual(new Date("2025-11-17"));
});
```

### Pattern 5: Testing Error Handling

```typescript
describe("Error Handling", () => {
  test("should return 400 for invalid input", async () => {
    const request = createMockRequest("POST", "/api/books", {
      // Missing required field: calibreId
      title: "Test Book",
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toContain("Missing required fields");
  });
  
  test("should return 404 for non-existent book", async () => {
    const request = createMockRequest("GET", "/api/books/99999");
    const response = await GET(request);
    
    expect(response.status).toBe(404);
  });
  
  test("should handle database errors gracefully", async () => {
    // Force a constraint violation
    const book = await bookRepository.create({ ... });
    
    // Try to create duplicate calibreId
    const result = bookRepository.create({
      calibreId: book.calibreId, // Duplicate!
      title: "Another Book",
      authors: ["Author"],
      tags: [],
      path: "Author/Book (2)",
    });
    
    await expect(result).rejects.toThrow();
  });
});
```

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

**Cause**: Using `mock.module()` which is global in Bun

**Solution**:
1. **Preferred**: Avoid `mock.module()` entirely
   - Use dependency injection in production code
   - Add test-specific behavior in production code (e.g., `if (process.env.NODE_ENV === 'test')`)
   - Example: `lib/db/calibre-write.ts` uses `getLoggerSafe()` to return no-op logger in tests

2. **If unavoidable**: Control test execution order
   - Tests that DON'T mock should run first (prefix with `000-`)
   - Tests that DO mock run later (their mocks won't affect earlier tests)
   - Example: `__tests__/000-calibre-write.test.ts` runs before API tests that mock calibre-write

3. **Always**: Run tests serially (`concurrency = 1` in bunfig.toml)

**Reference**: See `docs/CALIBRE_WRITE_TEST_FIX.md` for detailed case study

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

- **1.0.0** (2025-11-26): Initial version based on codebase analysis

---

**Questions or Suggestions?**  
Open an issue with the `testing` label on GitHub.
