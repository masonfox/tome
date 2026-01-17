# Test Organization Guide

This document explains how tests are organized in the Tome project and provides guidelines for writing new tests.

## Directory Structure

Tests are organized by **test type** (not source code structure) to improve discoverability and clarify testing boundaries:

```
__tests__/
├── unit/                           # Pure unit tests (~40 files)
│   ├── utils/                      # Utility functions (no DB, no external deps)
│   ├── client/                     # HTTP client, auth (mocked fetch)
│   └── api-clients/                # API client wrappers (mocked base client)
│
├── integration/                    # Tests with real DB (~80 files)
│   ├── repositories/               # Database query tests
│   │   ├── books/                  # Book repository variants
│   │   ├── sessions/               # Session repository variants
│   │   └── *.repository.test.ts    # Other repository tests
│   ├── services/                   # Business logic + DB
│   │   ├── books/                  # Book service tests
│   │   ├── sessions/               # Session service tests
│   │   ├── shelves/                # Shelf service tests
│   │   └── *.service.test.ts       # Other service tests
│   ├── external/                   # External system integrations
│   │   ├── calibre/                # Calibre sync, watcher
│   │   └── database/               # Migrations, backups
│   ├── workflows/                  # Multi-step business processes
│   └── constraints/                # Data integrity and edge cases
│
├── e2e/                            # End-to-end API tests (~47 files)
│   ├── api/                        # Next.js API route handlers
│   │   ├── books/                  # Book API endpoints
│   │   ├── sessions/               # Session API endpoints
│   │   ├── progress/               # Progress API endpoints
│   │   ├── reading-goals/          # Reading goals API
│   │   ├── tags/                   # Tags API
│   │   ├── shelves/                # Shelves API
│   │   ├── journal/                # Journal API
│   │   ├── streaks/                # Streaks API
│   │   └── ...                     # Other API endpoints
│   └── workflows/                  # Multi-API workflow tests
│
├── component/                      # React component tests (~21 files)
│   └── (organized by component/feature)
│
├── hooks/                          # React hooks tests (~15 files)
│   └── (organized by hook)
│
├── helpers/                        # Test utilities and infrastructure
├── fixtures/                       # Test data and mocks
└── mocks/                          # Mock implementations
```

---

## Test Type Definitions

### Unit Tests

**Definition:** Pure functions with no database, filesystem, or network. All external dependencies are mocked.

**Characteristics:**
- ❌ No `setupTestDatabase()` calls
- ❌ No file I/O
- ❌ No network requests
- ✅ Pure logic testing
- ✅ External dependencies mocked
- ✅ Fast execution (< 1ms per test)

**Examples:**

```typescript
// unit/utils/progress-calculations.test.ts
describe("calculatePercentage", () => {
  it("calculates percentage for complete books", () => {
    expect(calculatePercentage(300, 300)).toBe(100);
  });
});

// unit/client/base-client.test.ts
// (mocks fetch, no real HTTP)
describe("BaseClient", () => {
  it("retries on failure", async () => {
    // Mock fetch to fail then succeed
  });
});

// unit/api-clients/book.api.test.ts
// (mocks base client, tests wrapper logic)
describe("BookAPI", () => {
  it("formats book data correctly", () => {
    // Tests transformation logic only
  });
});
```

**Location examples:**
- `__tests__/lib/progress-calculations.test.ts` → `unit/utils/progress-calculations.test.ts`
- `__tests__/lib/base-client.test.ts` → `unit/client/base-client.test.ts`

---

### Integration Tests

**Definition:** Tests that cross boundaries with **real SQLite in-memory database**. Tests repositories, services, and external integrations.

**Characteristics:**
- ✅ Uses `setupTestDatabase()` with real SQLite
- ✅ Tests multiple layers together (repository + DB, service + repository + DB)
- ✅ Verifies data persistence
- ✅ Tests business logic with state
- ⚠️ Mocks only external systems (Calibre, filesystem)

**Examples:**

```typescript
// integration/repositories/books/book-repository-tags.test.ts
describe("BookRepository.getWithTags()", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  it("filters books by tags", async () => {
    // Create books with tags in real database
    const book1 = await bookRepository.create({ tags: ["fiction"] });

    // Query using repository
    const results = await bookRepository.getWithTags(["fiction"]);

    expect(results).toHaveLength(1);
  });
});

// integration/services/books/book.service.test.ts
describe("BookService.updateTotalPages()", () => {
  // Uses real database + mocked Calibre
  it("recalculates progress percentages", async () => {
    // Tests service logic with database persistence
  });
});

// integration/workflows/complete-book-workflow.test.ts
describe("Complete Book Workflow", () => {
  it("transitions from Want to Read → Completed", async () => {
    // Multi-step test: create session, add progress, complete
  });
});
```

**Location examples:**
- `__tests__/repositories/*.test.ts` → `integration/repositories/`
- `__tests__/services/*.test.ts` → `integration/services/`
- `__tests__/lib/calibre*.test.ts` → `integration/external/calibre/`
- `__tests__/integration/*.test.ts` → `integration/workflows/`

---

### E2E/API Tests

**Definition:** Full API route handler tests. Tests complete HTTP request/response cycle.

**Characteristics:**
- ✅ Imports actual route handlers: `GET, POST, PATCH, DELETE from @/app/api/.../route`
- ✅ Uses `createMockRequest()` to simulate HTTP requests
- ✅ Tests complete API contracts (validation, responses, status codes)
- ✅ Uses real database for persistence
- ✅ Tests authentication, error handling, response formatting

**Examples:**

```typescript
// e2e/api/books/books.test.ts
import { GET, POST } from "@/app/api/books/route";

describe("GET /api/books", () => {
  beforeAll(async () => {
    await setupTestDatabase(__filename);
  });

  it("filters books by status", async () => {
    // Setup test data
    const book = await bookRepository.create({ ... });
    await sessionRepository.create({ status: "reading" });

    // Make API request
    const request = createMockRequest("GET", "/api/books?status=reading");
    const response = await GET(request);

    // Verify response
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.books).toHaveLength(1);
  });
});

// e2e/api/sessions/read-next/move-to-top.test.ts
import { PATCH } from "@/app/api/sessions/read-next/move-to-top/route";

describe("PATCH /api/sessions/read-next/move-to-top", () => {
  it("moves session to top of read next queue", async () => {
    // Tests full API endpoint
  });
});
```

**Location examples:**
- `__tests__/api/books.test.ts` → `e2e/api/books/books.test.ts`
- `__tests__/api/sessions/read-next/move-to-top.test.ts` → `e2e/api/sessions/read-next/move-to-top.test.ts`

---

### Component Tests

**Definition:** React component rendering and user interaction tests using React Testing Library.

**Characteristics:**
- ✅ Uses `@testing-library/react`
- ✅ Tests component rendering
- ✅ Tests user interactions
- ✅ Verifies DOM output

**Examples:**

```typescript
// component/book-detail/BookProgress.test.tsx
describe("BookProgress", () => {
  it("displays current page and percentage", () => {
    render(<BookProgress currentPage={150} totalPages={300} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
```

**Location:** `__tests__/component/` (mirrors `components/` in source)

---

### Hook Tests

**Definition:** React hooks tests using React Testing Library.

**Examples:**

```typescript
// hooks/useBookProgress.test.tsx
describe("useBookProgress", () => {
  it("calculates percentage correctly", () => {
    const { result } = renderHook(() => useBookProgress(150, 300));
    expect(result.current.percentage).toBe(50);
  });
});
```

**Location:** `__tests__/hooks/` (mirrors custom hooks)

---

## Decision Tree: Where Should My Test Go?

```
┌─────────────────────────────────────────────────┐
│ Where should I put this test?                   │
└─────────────────────────────────────────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ Does it render a React       │
      │ component or hook?           │
      └──────────────────────────────┘
                │          │
               YES        NO
                │          │
                ▼          ▼
      ┌──────────────┐  ┌──────────────────────────────┐
      │ component/   │  │ Does it import an API route  │
      │ or hooks/    │  │ handler from app/api/?       │
      └──────────────┘  └──────────────────────────────┘
                                  │          │
                                 YES        NO
                                  │          │
                                  ▼          ▼
                        ┌──────────────┐  ┌──────────────────────────────┐
                        │ e2e/api/     │  │ Does it use                  │
                        └──────────────┘  │ setupTestDatabase()?         │
                                          └──────────────────────────────┘
                                                    │          │
                                                   NO         YES
                                                    │          │
                                                    ▼          ▼
                                          ┌──────────────┐  ┌─────────────────────┐
                                          │ unit/        │  │ What layer does it  │
                                          │              │  │ primarily test?     │
                                          │ (utils,      │  └─────────────────────┘
                                          │  client,     │            │
                                          │  api-clients)│            ▼
                                          └──────────────┘  ┌───────────────────────────┐
                                                            │ • Repository (DB queries) │
                                                            │   → integration/          │
                                                            │      repositories/        │
                                                            │                           │
                                                            │ • Service (business logic)│
                                                            │   → integration/          │
                                                            │      services/            │
                                                            │                           │
                                                            │ • External system         │
                                                            │   → integration/          │
                                                            │      external/            │
                                                            │                           │
                                                            │ • Multi-step workflow     │
                                                            │   → integration/          │
                                                            │      workflows/           │
                                                            └───────────────────────────┘
```

---

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests by type
```bash
npm run test:unit           # Unit tests only (~40 files, <1s)
npm run test:integration    # Integration tests only (~80 files, ~8s)
npm run test:e2e            # E2E tests only (~47 files, ~8s)
npm run test:component      # Component + hook tests (~36 files)
```

### Run specific test file
```bash
npm test __tests__/unit/utils/progress-calculations.test.ts
npm test __tests__/e2e/api/books/books.test.ts
```

### Watch mode
```bash
npm run test:watch          # Watch all tests
vitest __tests__/unit       # Watch unit tests only
```

### Coverage
```bash
npm run test:coverage       # Generate coverage report
```

---

## Testing Pyramid

The test suite follows the testing pyramid principle:

```
       /\
      /  \      E2E/API Tests (47 files)
     /    \     ↑ Slowest, highest confidence
    /______\    ↑ Full request/response cycle
   /        \
  /          \  Integration Tests (80 files)
 /            \ ↑ Medium speed
/______________\↑ Real database, cross-layer
/              \
/                \ Unit Tests (40 files)
/__________________\↓ Fastest, most granular
                   ↓ Pure functions, no DB
```

**Guidelines:**
- Prefer unit tests for pure logic
- Use integration tests for data persistence and business logic
- Use e2e tests to verify API contracts
- Avoid testing the same thing at multiple levels

---

## Best Practices

### 1. Test Isolation
Every test should be independent and not depend on other tests:

```typescript
beforeEach(async () => {
  await clearTestDatabase(__filename);  // Clean slate for each test
});
```

### 2. Real Database Testing
We use **real SQLite in-memory databases** instead of mocks:

```typescript
// ✅ Good - Real database
beforeAll(async () => {
  await setupTestDatabase(__filename);
});

// ❌ Avoid - Mocking database
vi.mock("@/lib/db/sqlite", () => ({ ... }));
```

### 3. Test Data Utilities
Use shared test utilities from `test-utils.tsx` and `fixtures/test-data.ts`:

```typescript
import { toProgressDate, createTestBook } from '../test-utils';
import { createMockRequest } from '../fixtures/test-data';
```

### 4. Descriptive Test Names
Use clear, descriptive test names:

```typescript
// ✅ Good
it("should return 404 when book does not exist", async () => { ... });

// ❌ Avoid
it("test1", () => { ... });
```

### 5. Arrange-Act-Assert Pattern
Structure tests clearly:

```typescript
it("filters books by status", async () => {
  // Arrange: Setup test data
  const book = await bookRepository.create({ ... });
  await sessionRepository.create({ status: "reading" });

  // Act: Execute the code being tested
  const results = await bookRepository.findByStatus("reading");

  // Assert: Verify the results
  expect(results).toHaveLength(1);
  expect(results[0].id).toBe(book.id);
});
```

---

## Examples by Test Type

### Unit Test Example

```typescript
// __tests__/unit/utils/progress-calculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePercentage } from "@/lib/utils/progress-calculations";

describe("calculatePercentage", () => {
  it("calculates percentage for complete books", () => {
    expect(calculatePercentage(300, 300)).toBe(100);
  });

  it("uses Math.floor to prevent premature completion", () => {
    expect(calculatePercentage(299, 300)).toBe(99);
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/repositories/books/book-repository-tags.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository } from "@/lib/repositories";

beforeAll(async () => {
  await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe("BookRepository.getWithTags()", () => {
  test("filters books by single tag", async () => {
    // Arrange
    const book1 = await bookRepository.create({
      calibreId: 1,
      path: "test/path",
      title: "Fiction Book",
      authors: ["Author"],
      tags: ["fiction"],
      totalPages: 300,
    });

    const book2 = await bookRepository.create({
      calibreId: 2,
      path: "test/path2",
      title: "Non-Fiction Book",
      authors: ["Author"],
      tags: ["non-fiction"],
      totalPages: 400,
    });

    // Act
    const results = await bookRepository.getWithTags(["fiction"]);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Fiction Book");
  });
});
```

### E2E Test Example

```typescript
// __tests__/e2e/api/books/books.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "@/__tests__/helpers/db-setup";
import { bookRepository, sessionRepository } from "@/lib/repositories";
import { GET } from "@/app/api/books/route";
import { createMockRequest } from "@/__tests__/fixtures/test-data";

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
  test("should filter books by status", async () => {
    // Arrange: Create test data
    const book = await bookRepository.create({
      calibreId: 1,
      path: "test/path",
      title: "Reading Book",
      authors: ["Author"],
      tags: [],
      totalPages: 300,
    });

    await sessionRepository.create({
      bookId: book.id,
      sessionNumber: 1,
      status: "reading",
      isActive: true,
    });

    // Act: Make API request
    const request = createMockRequest("GET", "/api/books?status=reading");
    const response = await GET(request);
    const data = await response.json();

    // Assert: Verify response
    expect(response.status).toBe(200);
    expect(data.books).toHaveLength(1);
    expect(data.books[0].title).toBe("Reading Book");
  });
});
```

---

## Migration Status

This test organization was implemented in [January 2026] to improve test discoverability and clarify testing boundaries.

**Migration phases:**
- ✅ Phase 1: Setup and documentation
- 🔄 Phase 2: Unit tests
- ⏳ Phase 3: Integration/repositories
- ⏳ Phase 4: Integration/services
- ⏳ Phase 5: Integration/external & workflows
- ⏳ Phase 6: E2E/API tests
- ⏳ Phase 7: Cleanup

---

## Questions?

If you're unsure where a test should go:
1. Refer to the decision tree above
2. Look for similar existing tests
3. Ask the team for guidance

**Remember:** When in doubt, prefer testing at the lowest level possible (unit > integration > e2e).
