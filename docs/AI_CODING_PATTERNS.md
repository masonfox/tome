# AI Coding Patterns for Tome

This document contains the **single source of truth** for coding patterns, styles, and guidelines that all AI coding assistants must follow when working on the Tome project.

**For AI Assistants:** This is your primary reference for how to write code in this project. Read this entire document before making code changes.

---

## 🔑 Critical Pattern: Database Factory Pattern

**This is THE most important pattern in the codebase.**

**Location:** `lib/db/factory.ts`

### The Pattern

The database factory abstracts SQLite driver selection based on runtime (Bun vs Node.js):

```typescript
// ALWAYS use the factory for database connections
import { createDatabase } from "@/lib/db/factory";

const { db, sqlite, runtime } = createDatabase({
  path: DATABASE_PATH,
  schema,
  wal: true,
  foreignKeys: true,
  readonly: false,
});

console.log(`Using ${runtime === 'bun' ? 'bun:sqlite' : 'better-sqlite3'}`);
```

### Why This Matters

- **Enables automatic Calibre sync in dev mode** (Node.js runtime with better-sqlite3)
- **Maintains optimal production performance** (Bun runtime with native bun:sqlite)
- **Eliminates code duplication** (single source of truth for driver selection)
- **Type-safe configuration** (DatabaseConfig interface with full TypeScript support)

### Rules

✅ **DO:**
- Use `createDatabase()` factory for new database connections
- Use existing abstractions: `lib/db/calibre.ts`, `lib/db/calibre-write.ts`, `lib/db/sqlite.ts`
- Import `detectRuntime()` if you need runtime detection elsewhere
- Trust the factory to handle driver selection and PRAGMA configuration

❌ **DON'T:**
- Import `bun:sqlite` or `better-sqlite3` directly in application code
- Bypass the factory pattern with manual runtime detection
- Duplicate the `typeof Bun !== 'undefined'` pattern
- Modify the factory without understanding both drivers' APIs

---

## 🧪 Test Patterns

**Location:** `__tests__/README.md` (comprehensive guide)

### Test Database Isolation Pattern

**CRITICAL:** Use dedicated test databases to prevent state leakage.

**Location:** `lib/db/context.ts`

✅ **PATTERN - Test Database Switching:**
```typescript
import { test, expect, beforeEach } from "bun:test";
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";
import { bookRepository } from "@/lib/repositories/book.repository";

beforeEach(async () => {
  // Switch to test database for this test
  setDatabase(testDb);

  // Clear test data
  resetDatabase();
});

test("should create a book", async () => {
  // Arrange
  const newBook = {
    calibreId: 1,
    title: "Test Book",
    authors: "Test Author",
  };

  // Act
  const book = await bookRepository.create(newBook);

  // Assert
  expect(book.title).toBe("Test Book");
});
```

### Test Isolation

**CRITICAL:** Never use global module mocks that leak across test files.

❌ **BAD - Causes test leakage:**
```typescript
// This mock affects ALL test files that run after this one
mock.module("@/lib/streaks", () => ({
  updateStreaks: () => mockUpdateStreaks(),
}));
```

✅ **GOOD - Isolated mocking:**
```typescript
// Mock only Next.js internals, not application modules
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));

// Let real application functions run with test database
```

### Testing Rules

✅ **DO:**
- Use `setDatabase()` to switch to test database
- Call `resetDatabase()` in `beforeEach()` to clear test data
- Keep each test file independent
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Run full test suite before completing tasks (`bun test`)

❌ **DON'T:**
- Use global mocks for application modules
- Share state between test files
- Skip tests or mark as `.skip` without user approval
- Use production database in tests

---

## 🎨 Code Style Guidelines

### TypeScript

```typescript
// ✅ DO: Use strict types
interface Book {
  id: string;
  title: string;
  authors: string[];
}

async function getBook(id: string): Promise<Book | null> {
  return await Book.findById(id);
}

// ✅ DO: Use const for immutable values
const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH;

// ✅ DO: Use async/await over .then()
const result = await asyncFunction();

// ❌ DON'T: Use 'any' type
function processData(data: any) { } // BAD
```

### React Components

```typescript
// ✅ DO: Server Component (default in Next.js 14)
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// ✅ DO: Client Component when needed
"use client";

import { useState } from "react";

export default function InteractiveComponent() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// ✅ DO: Small, focused components
export function BookCard({ book }: { book: Book }) {
  return (
    <div className="p-4">
      <h3>{book.title}</h3>
    </div>
  );
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `BookCard.tsx`, `StatsCard.tsx` |
| Functions | camelCase | `getAllBooks`, `updateStreak` |
| Constants | UPPER_SNAKE_CASE | `CALIBRE_DB_PATH`, `MAX_RETRIES` |
| Interfaces | PascalCase | `CalibreBook`, `ReadingSession` |
| Files (routes) | kebab-case | `sync-service.ts`, `calibre-watcher.ts` |
| Files (utilities) | camelCase | `dateUtils.ts`, `formatters.ts` |

---

## 📦 Common Imports

### Database Operations

```typescript
// Repository Pattern (PRIMARY - use this for Tome database)
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { streakRepository } from "@/lib/repositories/streak.repository";

// Calibre SQLite (ALWAYS use these, never direct imports)
import { getCalibreDB, getAllBooks, getBookById } from "@/lib/db/calibre";

// Calibre Write Operations (ONLY for ratings)
import { updateCalibreRating } from "@/lib/db/calibre-write";

// Test Database Context (for tests only)
import { setDatabase, resetDatabase, getDatabase } from "@/lib/db/context";
```

### Next.js API Routes

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const data = await fetchData();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Process...
  return NextResponse.json({ success: true });
}
```

### Client Service Layer

```typescript
// Client-side service for API abstraction with caching
import { libraryService } from "@/lib/library-service";

// Custom hook for state management
import { useLibraryData } from "@/hooks/useLibraryData";

// In components:
const { books, total, hasMore, loading, loadMore } = useLibraryData({
  status: "reading",
  pagination: { limit: 50, skip: 0 },
});
```

### Testing

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";
```

---

## 🏗️ Client Service Layer Pattern

**Location:** Library page (`/app/library/page.tsx`, `/lib/library-service.ts`, `/hooks/useLibraryData.ts`)

### The Pattern

Use a **three-layer architecture** for complex client-side data management:

```
Page Component → Custom Hook → Client Service → API Route → Database
```

**Layer Responsibilities:**
1. **Page Component**: Orchestration, URL params, user interactions
2. **Custom Hook**: State management, filter coordination, loading states
3. **Client Service**: API abstraction, caching, data transformation
4. **API Route**: Server-side queries, business logic
5. **Database**: Data persistence

### When to Use

✅ **Use this pattern when:**
- Page has complex filtering/searching/sorting
- Need client-side caching to reduce API calls
- Want to share data fetching logic across components
- Implementing infinite scroll or pagination
- Managing multiple interdependent filters

❌ **Don't use this pattern for:**
- Simple pages with one API call
- Server components (use direct API calls)
- Pages with no filtering or state management

### Implementation Example

**1. Client Service (`/lib/library-service.ts`):**
```typescript
export class LibraryService {
  private cache = new Map<string, PaginatedBooks>();
  
  async getBooks(filters: LibraryFilters): Promise<PaginatedBooks> {
    const cacheKey = this.buildCacheKey(filters);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const response = await fetch(`/api/books?${params}`);
    const data = await response.json();
    
    const result = {
      books: data.books || [],
      total: data.total || 0,
      hasMore: skip + data.books.length < data.total,
    };
    
    this.cache.set(cacheKey, result);
    return result;
  }
  
  clearCache(): void {
    this.cache.clear();
  }
}

export const libraryService = new LibraryService(); // Singleton
```

**2. Custom Hook (`/hooks/useLibraryData.ts`):**
```typescript
export function useLibraryData(initialFilters?: Partial<LibraryFilters>) {
  const [filters, setFilters] = useState<LibraryFilters>({
    pagination: { limit: 50, skip: 0 },
    ...initialFilters,
  });
  const [data, setData] = useState<PaginatedBooks | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const result = await libraryService.getBooks(filters);
      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [filters]);
  
  const loadMore = useCallback(async () => {
    const nextFilters = {
      ...filters,
      pagination: { ...filters.pagination, skip: filters.pagination.skip + 50 },
    };
    const result = await libraryService.getBooks(nextFilters);
    setData(prev => ({
      ...result,
      books: [...(prev?.books || []), ...result.books],
    }));
    setFilters(nextFilters);
  }, [filters]);
  
  return { books: data?.books || [], total: data?.total || 0, loadMore };
}
```

**3. Page Component (`/app/library/page.tsx`):**
```typescript
"use client";

export default function LibraryPage() {
  const { books, total, hasMore, loading, loadMore, setSearch, setStatus } = 
    useLibraryData({ status: searchParams.get("status") || undefined });
  
  return (
    <LibraryHeader totalBooks={total} />
    <LibraryFilters onSearchChange={setSearch} onStatusChange={setStatus} />
    <BookGrid books={books} loading={loading} />
  );
}
```

### Key Principles

✅ **DO:**
- Use singleton service instances
- Cache results with smart key generation
- Calculate `hasMore` as: `skip + books.length < total`
- Clear cache after mutations (create, update, delete)
- Reset pagination when filters change
- Debounce search input (300ms)
- Cancel in-flight requests on unmount

❌ **DON'T:**
- Access MongoDB directly from client service (security risk!)
- Use fetch mocks in integration tests (test real API handlers)
- Put business logic in hooks (belongs in service or API)
- Forget to handle loading and error states

### Testing Integration

```typescript
// Integration test: Service → API → Database
global.fetch = async (input, init) => {
  if (url.includes("/api/books")) {
    return await GET_BOOKS(createMockRequest("GET", url)); // Real handler
  }
};

test("should handle pagination correctly", async () => {
  await Book.create({ /* test data */ });
  
  const page1 = await service.getBooks({ pagination: { limit: 5, skip: 0 } });
  expect(page1.hasMore).toBe(true);
  
  const page2 = await service.getBooks({ pagination: { limit: 5, skip: 5 } });
  expect(page2.hasMore).toBe(false);
});
```

---

## 🔑 Query Key Factory Pattern

**Location:** `lib/query-keys.ts`

### The Pattern

Use a **centralized query key factory** for all TanStack Query (React Query) keys to prevent collisions and enable type-safe invalidations.

**Why This Matters:**
- **Prevents key collisions**: PR #395 found two components using `'streak-analytics'` with different data structures
- **Fixes invalidation bugs**: `useStreak.ts` was invalidating `['streak-analytics']` but actual key was `['streak-analytics-full', 7]`
- **Type safety**: Catch typos at compile time
- **Easier refactoring**: Change key structure in one place
- **Consistent patterns**: Hierarchical keys enable wildcard invalidation

### Rules

✅ **DO: Use the query key factory for ALL queries:**

```typescript
import { queryKeys } from '@/lib/query-keys';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// In queries
const { data } = useQuery({
  queryKey: queryKeys.book.detail(bookId),
  queryFn: () => bookApi.get(bookId)
});

// In queries with parameters
const { data } = useQuery({
  queryKey: queryKeys.streak.analytics(7),
  queryFn: () => fetch('/api/streak/analytics?days=7')
});

// In mutations - invalidate specific query
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: updateBook,
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.book.detail(bookId) 
    });
  }
});

// Wildcard invalidation - invalidate ALL book queries
queryClient.invalidateQueries({ 
  queryKey: queryKeys.book.base() 
});

// Wildcard invalidation - invalidate ALL streak queries
queryClient.invalidateQueries({ 
  queryKey: queryKeys.streak.base() 
});
```

❌ **DON'T: Use hardcoded query key strings:**

```typescript
// ❌ WRONG - Hardcoded strings (collision risk, no type safety)
useQuery({
  queryKey: ['book', bookId],
  queryFn: () => bookApi.get(bookId)
});

// ❌ WRONG - Will cause invalidation bugs
queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
// Actual key might be ['streak-analytics-full', 7] - invalidation fails!

// ❌ WRONG - Collision risk (two components, different data structures)
useQuery({ queryKey: ['streak-analytics', 7], ... });
useQuery({ queryKey: ['streak-analytics', 365], ... });
```

### Key Structure

Keys follow a **hierarchical pattern** for collision avoidance:

```typescript
// Base keys (for wildcard invalidation)
queryKeys.book.base()           // ['book']
queryKeys.streak.base()         // ['streak']

// Specific queries
queryKeys.book.detail(123)      // ['book', 123]
queryKeys.sessions.byBook(456)  // ['sessions', 456]

// Nested hierarchies (prevents collisions)
queryKeys.streak.analytics(7)   // ['streak', 'analytics', 7]
queryKeys.streak.heatmap(365)   // ['streak', 'analytics', 'heatmap', 365]
```

### When to Add New Keys

When adding new TanStack Query queries:

1. **Check if key exists** in `lib/query-keys.ts`
2. **Add to appropriate domain** (book, streak, session, etc.)
3. **Use hierarchical structure** to avoid collisions
4. **Add JSDoc comments** describing what the key represents
5. **Use `as const`** for type safety

**Example - Adding a new key:**

```typescript
export const queryKeys = {
  // ... existing keys ...
  
  book: {
    base: () => ['book'] as const,
    detail: (id: number) => ['book', id] as const,
    
    // NEW: Add book reviews key
    /** Book reviews: ['book', bookId, 'reviews'] */
    reviews: (bookId: number) => ['book', bookId, 'reviews'] as const,
  },
};
```

### Handling Nullable IDs

When query parameters can be `null` (disabled queries), use conditional keys:

```typescript
// Handle nullable sessionId
export function useSessionProgress(sessionId: number | null) {
  return useQuery({
    queryKey: sessionId 
      ? queryKeys.sessions.progress(sessionId)
      : ['session-progress-empty'], // Placeholder when disabled
    queryFn: async () => {
      if (!sessionId) return [];
      return fetchProgress(sessionId);
    },
    enabled: !!sessionId, // Only fetch when sessionId exists
  });
}

// For mutations with nullable IDs, guard invalidations
const mutation = useMutation({
  onSuccess: () => {
    if (shelfId !== null) {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.shelf.detail(shelfId) 
      });
    }
  }
});
```

### Critical Bugs Fixed

This pattern fixes two critical bugs found during implementation:

**Bug 1: Invalidation Failure** (`hooks/useStreak.ts`)
```typescript
// ❌ BEFORE: Invalidation did nothing
queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
// Actual key was ['streak-analytics-full', 7] - mismatch!

// ✅ AFTER: Correct wildcard invalidation
queryClient.invalidateQueries({ queryKey: queryKeys.streak.base() });
// Invalidates ALL streak queries: analytics, heatmap, settings
```

**Bug 2: Key Collision** (PR #395)
```typescript
// ❌ BEFORE: Two components, same key, different data
// Component A: useStreakQuery.ts
queryKey: ['streak-analytics', 7]  // Returns full analytics

// Component B: StreakChartSection.tsx  
queryKey: ['streak-analytics', 365]  // Returns heatmap data
// Collision! Same prefix, different data structures

// ✅ AFTER: Hierarchical keys prevent collision
queryKey: queryKeys.streak.analytics(7)    // ['streak', 'analytics', 7]
queryKey: queryKeys.streak.heatmap(365)    // ['streak', 'analytics', 'heatmap', 365]
```

---

## 🗄️ Database Patterns

### Repository Pattern (PRIMARY PATTERN)

**CRITICAL:** All Tome database access MUST go through repositories.

**Location:** `lib/repositories/` (BaseRepository + specialized repos)

✅ **DO: Use repositories for all database operations:**

```typescript
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";

// Find by ID
const book = await bookRepository.findById(123);

// Find with filters
const { books, total } = await bookRepository.findWithFilters(
  { status: "reading", search: "Harry Potter" },
  50,  // limit
  0    // skip
);

// Create new record
const newBook = await bookRepository.create({
  calibreId: 456,
  title: "New Book",
  authors: "Author Name",
});

// Update record
const updated = await bookRepository.update(123, {
  rating: 5,
});

// Delete record
await bookRepository.delete(123);

// Custom repository methods
const book = await bookRepository.findByCalibreId(456);
const tags = await bookRepository.getAllTags();
```

❌ **DON'T: Import db directly in API routes or services:**

```typescript
// ❌ WRONG - Never do this
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all(); // NO!

// ✅ CORRECT - Use repository
import { bookRepository } from "@/lib/repositories/book.repository";
const books = await bookRepository.findAll();
```

### Repository Pattern Rules

✅ **DO:**
- Use repositories for ALL Tome database access
- Extend `BaseRepository` when creating new repositories
- Keep business logic in repositories (filtering, transformations)
- Use Drizzle ORM within repositories
- Handle errors properly with try/catch

❌ **DON'T:**
- Import `db` directly in API routes or components
- Bypass repositories with direct SQL
- Put repository logic in API routes
- Create ad-hoc database connections

**See:** `docs/REPOSITORY_PATTERN_GUIDE.md` for complete guide

---

### Companion Migrations Pattern (Data Transformations)

**CRITICAL:** When Drizzle migrations change column types, they copy data AS-IS without semantic transformation. Use companion migrations for data transformations.

**Location:** `lib/db/companion-migrations.ts` (framework), `lib/migrations/*.ts` (companions)

**The Problem:**
```typescript
// Before: INTEGER column (Unix timestamp: 1732507200)
progress_date: integer('progress_date', { mode: 'number' })

// After: TEXT column (YYYY-MM-DD: "2024-11-25")
progress_date: text('progress_date', { mode: 'text' })

// ❌ Drizzle copies data AS-IS: "1732507200" (WRONG - integer as string)
// ✅ Companion migration: "2024-11-25" (CORRECT - formatted date)
```

**The Solution - Companion Migrations:**

Companion migrations are TypeScript files that run AFTER schema migrations to transform data semantically.

✅ **DO: Create companion migration for type changes:**

```typescript
// lib/migrations/0015_progress_dates_timezone.ts
import { CompanionMigration } from "@/lib/db/companion-migrations";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const migration: CompanionMigration = {
  name: "0015_progress_dates_timezone",
  description: "Convert progress_logs.progress_date from INTEGER to TEXT with timezone awareness",
  requiredTables: ["progress_logs"],  // Skip if table doesn't exist (fresh DB)
  
  execute: async (db) => {
    // Get user timezone (defaults to UTC)
    const timezone = process.env.TZ || "UTC";
    
    // Find records with old INTEGER format
    const oldRows = db.prepare(`
      SELECT id, progress_date 
      FROM progress_logs 
      WHERE typeof(progress_date) = 'integer' 
         OR (typeof(progress_date) = 'text' AND length(progress_date) > 10)
    `).all();
    
    if (oldRows.length === 0) return;  // Already migrated
    
    // Transform: INTEGER → TEXT with timezone awareness
    const update = db.prepare(`
      UPDATE progress_logs 
      SET progress_date = ? 
      WHERE id = ?
    `);
    
    for (const row of oldRows) {
      const timestamp = parseInt(String(row.progress_date), 10);
      const date = new Date(timestamp);
      const formattedDate = formatInTimeZone(date, timezone, "yyyy-MM-dd");
      update.run(formattedDate, row.id);
    }
  },
};
```

**Companion Migration Rules:**

✅ **DO:**
- Create companions for ALL type changes requiring semantic transformation
- Use `requiredTables` to skip on fresh databases
- Use timezone-aware date conversions (`date-fns-tz`)
- Check data type before transforming (`typeof(column) = 'integer'`)
- Make idempotent (safe to run multiple times)
- Add descriptive `description` field
- Follow naming: `{migration_number}_{table}_{column}_{transformation}.ts`
- Return early if no transformation needed
- Use `_template.ts` as starting point

❌ **DON'T:**
- Put data transformations in Drizzle schema migrations (they run DDL only)
- Forget `requiredTables` check (causes errors on fresh DBs)
- Hardcode timezones (use `process.env.TZ` with fallback)
- Transform data without checking current type
- Run transformations on already-transformed data

**Framework Features:**
- **Auto-discovery**: Finds `lib/migrations/{number}_*.ts` files
- **Completion tracking**: Stores status in `migration_metadata` table
- **Ordering**: Runs in same order as schema migrations
- **Transaction safety**: Rolls back on error
- **Fresh DB support**: Skips if required tables don't exist
- **Idempotency**: Tracks completion, won't re-run

**Template:**
```typescript
// lib/migrations/_template.ts
import { CompanionMigration } from "@/lib/db/companion-migrations";

export const migration: CompanionMigration = {
  name: "XXXX_descriptive_name",
  description: "What this migration does",
  requiredTables: ["table_name"],
  
  execute: async (db) => {
    // 1. Query records needing transformation
    const rows = db.prepare(`SELECT id, column FROM table WHERE condition`).all();
    
    // 2. Early return if no work needed
    if (rows.length === 0) return;
    
    // 3. Transform data
    const update = db.prepare(`UPDATE table SET column = ? WHERE id = ?`);
    for (const row of rows) {
      const transformed = transformData(row.column);
      update.run(transformed, row.id);
    }
  },
};
```

**Integration:**
```typescript
// lib/db/migrate.ts
import { runCompanionMigrations } from "@/lib/db/companion-migrations";

export async function runMigrations() {
  await runSchemaCheck();
  
  // Phase 1: Schema migrations (Drizzle DDL)
  migrate(db, { migrationsFolder: "./drizzle" });
  
  // Phase 2: Companion migrations (Data transformations)
  await runCompanionMigrations(sqlite);
}
```

**See:**
- `docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md` - Complete architecture decision record
- `.specify/memory/patterns.md` - Pattern 11: Companion Migrations
- `lib/migrations/README.md` - Usage guide with examples

---

### SQLite Queries (Calibre - Read-Only)

```typescript
// ✅ DO: Use abstraction from lib/db/calibre.ts for reads
import { getAllBooks, getBookById, searchBooks } from "@/lib/db/calibre";

const books = getAllBooks();
const book = getBookById(123);
const results = searchBooks("Harry Potter");

```

---

### Calibre Write Operations (RESTRICTED)

**Location:** `lib/db/calibre-write.ts`

**CRITICAL:** Calibre database is READ-ONLY by default. Only specific approved operations can write.

✅ **ONLY Approved Write Operation - Ratings:**

```typescript
import { updateCalibreRating } from "@/lib/db/calibre-write";

// Set book rating (1-5 stars)
await updateCalibreRating(calibreId, 5); // ✅ ALLOWED

// Remove rating
await updateCalibreRating(calibreId, null); // ✅ ALLOWED
```

❌ **NEVER Write to Other Calibre Tables:**

```typescript
// ❌ NEVER modify book metadata
db.prepare("UPDATE books SET title = ?").run("New Title"); // FORBIDDEN!

// ❌ NEVER modify authors
db.prepare("INSERT INTO authors (name) VALUES (?)").run("Author"); // FORBIDDEN!

// ❌ NEVER modify series, tags, or any other tables
// Only ratings are approved for writes!
```

**Why This Restriction:**
- Calibre manages all book metadata (titles, authors, series, tags)
- Writing to wrong tables can corrupt Calibre's database
- Only ratings are safe because Calibre expects external updates
- Calibre has complex FK constraints and triggers

**Critical Safety Rules:**
1. **Only write to**: `ratings` and `books_ratings_link` tables (via `updateCalibreRating()`)
2. **Never modify**: `books`, `authors`, `series`, `tags`, or any other tables
3. **Always validate**: Rating must be 1-5 stars or null
4. **Use the abstraction**: `updateCalibreRating()` handles all the complexity
5. **Rating scale**: UI shows 1-5 stars, Calibre stores 2/4/6/8/10

**See:** `lib/db/calibre-write.ts` for implementation details

---

## 📁 File Organization

```
tome/
├── app/                     # Next.js App Router
│   ├── api/                # API routes
│   │   └── books/
│   │       └── route.ts   # Export GET, POST, etc.
│   ├── library/           # /library page
│   │   └── page.tsx       # Default export
│   └── page.tsx           # Home page
├── components/             # React components
│   ├── BookCard.tsx       # Reusable components
│   └── ui/                # UI primitives
├── lib/                   # Business logic
│   ├── db/               # Database layer
│   │   ├── schema/       # Drizzle schemas
│   │   ├── sqlite.ts     # Tome database (Drizzle)
│   │   ├── calibre.ts    # Calibre DB (read-only)
│   │   ├── calibre-write.ts  # Calibre writes (ratings only)
│   │   └── context.ts    # Test database switching
│   ├── repositories/     # Repository pattern
│   │   ├── base.repository.ts      # Base CRUD operations
│   │   ├── book.repository.ts      # Book queries
│   │   ├── session.repository.ts   # Reading sessions
│   │   ├── progress.repository.ts  # Progress logs
│   │   └── streak.repository.ts    # Streak management
│   ├── sync-service.ts   # Calibre sync logic
│   └── streaks.ts        # Streak calculations
├── models/               # (LEGACY - being phased out)
└── __tests__/           # Test files (295 passing)
    ├── api/            # API route tests
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

---

## 🚫 What NOT to Do

### File Creation

❌ **DON'T create new markdown files in `/docs` without explicit user request**

This includes:
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `CODE_OF_CONDUCT.md`
- New feature docs
- New guide docs

**Why:** Documentation structure is intentional. Update existing docs instead.

### Code Anti-Patterns

❌ **DON'T:**

```typescript
// Import db directly (bypass repository pattern)
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all();  // Use bookRepository instead!

// Import SQLite directly
import { Database } from "bun:sqlite";  // Use lib/db/calibre.ts instead

// Import Mongoose models (legacy)
import Book from "@/models/Book";  // Use bookRepository instead!

// Use global test mocks
mock.module("@/lib/streaks", () => ...);  // Causes leakage

// Write to Calibre database (except ratings)
db.prepare("UPDATE books...").run();  // Use updateCalibreRating() or read-only!

// Use 'any' type
function process(data: any) { }  // Use proper types

// Create CSS files
// Use Tailwind classes instead

// Skip error handling
const book = await bookRepository.findById(id);  // Add try/catch

// Suggest MongoDB for new features
// We use SQLite + Drizzle + Repository pattern now!
```

### Dependencies

❌ **DON'T add dependencies without considering:**
- Bundle size impact
- Maintenance burden
- Whether built-in solution exists
- Security implications

**Ask the user before adding new dependencies.**

---

## ✅ What TO Do

### Best Practices

```typescript
// ✅ Proper error handling
try {
  const result = await riskyOperation();
  return NextResponse.json(result);
} catch (error) {
  console.error("Operation failed:", error);
  return NextResponse.json(
    { error: "Operation failed" },
    { status: 500 }
  );
}

// ✅ Input validation
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.bookId || !body.currentPage) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Process...
}

// ✅ Use TypeScript interfaces
interface CreateBookRequest {
  title: string;
  authors: string[];
  isbn?: string;
}

export async function POST(request: NextRequest) {
  const data: CreateBookRequest = await request.json();
  // TypeScript knows what fields exist
}

// ✅ Revalidate cache after mutations
import { revalidatePath } from "next/cache";

await Book.create(bookData);
revalidatePath("/library");
```

---

## 🎯 API Route Patterns

### Standard CRUD Pattern (Repository-Based)

```typescript
// app/api/books/route.ts
import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories/book.repository";

// GET /api/books
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    const { books, total } = await bookRepository.findWithFilters(
      { status, search },
      limit,
      skip
    );

    return NextResponse.json({ books, total });
  } catch (error) {
    console.error("Error fetching books:", error);
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}

// POST /api/books
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.calibreId || !body.title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const book = await bookRepository.create(body);
    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    console.error("Error creating book:", error);
    return NextResponse.json(
      { error: "Failed to create book" },
      { status: 500 }
    );
  }
}
```

### Dynamic Route Pattern (Repository-Based)

```typescript
// app/api/books/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories/book.repository";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const book = await bookRepository.findById(parseInt(params.id));

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error("Error fetching book:", error);
    return NextResponse.json(
      { error: "Failed to fetch book" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const book = await bookRepository.update(parseInt(params.id), body);

    if (!book) {
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(book);
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Failed to update book" },
      { status: 500 }
    );
  }
}
```

---

## 🔄 Typical Workflows

### Adding a New Feature

1. **Read architecture** → `docs/ARCHITECTURE.md`
2. **Check patterns** → This document
3. **Implement following patterns** → Use repositories for database access
4. **Add tests** → Follow test patterns above (use `setDatabase()`)
5. **Run tests** → `bun test` (all 295 tests must pass)
6. **Update docs if needed** → Architecture or Quick Reference

### Fixing a Bug

1. **Locate in architecture** → Which component is affected?
2. **Understand how it works** → Read relevant docs
3. **Fix following patterns** → Use patterns from this document
4. **Add regression test** → Prevent it from happening again
5. **Run tests** → `bun test`

### Refactoring Code

1. **Ensure alignment with architecture** → No surprise changes
2. **Maintain backward compatibility** → Unless explicitly changing
3. **Follow patterns** → Use patterns from this document
4. **Update tests if needed**
5. **Run tests** → `bun test`

---

## 🧭 Quick Decision Guide

```
Need to access Tome database (books, sessions, progress, streaks)?
  └─> Use repositories from lib/repositories/
      ├─ bookRepository.findWithFilters()
      ├─ sessionRepository.findActiveByBookId()
      ├─ progressRepository.findBySession()
      └─ streakRepository.getActiveStreak()

Need to access Calibre data (read-only)?
  └─> Use functions from lib/db/calibre.ts
      ├─ getAllBooks()
      ├─ getBookById()
      └─ searchBooks()

Need to write to Calibre (ratings only)?
  └─> Use lib/db/calibre-write.ts
      └─ updateCalibreRating(calibreId, rating)

Creating a new page?
  └─> Server Component by default (Next.js 14)
  └─> Client Component only if needed ("use client")

Writing a test?
  └─> Use setDatabase(testDb) to switch to test database
  └─> Use resetDatabase() in beforeEach()
  └─> No global mocks for application modules

Need a new database table?
  └─> Add schema to lib/db/schema/
  └─> Create migration with drizzle-kit
  └─> Create repository extending BaseRepository
  └─> Run migrations and update tests

Adding Calibre functionality?
  └─> Modify lib/db/calibre.ts (read-only operations)
  └─> Maintain runtime detection pattern (Bun vs Node.js)

Unsure about a pattern?
  └─> Check this document (AI_CODING_PATTERNS.md)
  └─> Check .specify/memory/patterns.md
  └─> Check docs/REPOSITORY_PATTERN_GUIDE.md
  └─> Ask the user
```

---

## ⚠️ Common AI Mistakes to Avoid

AI assistants frequently make these mistakes. **Double-check before suggesting:**

### ❌ Mistake 1: Bypassing Repository Pattern
```typescript
// ❌ WRONG
import { db } from "@/lib/db/sqlite";
import { books } from "@/lib/db/schema/books";
const allBooks = db.select().from(books).all();

// ✅ CORRECT
import { bookRepository } from "@/lib/repositories/book.repository";
const allBooks = await bookRepository.findAll();
```

### ❌ Mistake 2: Suggesting MongoDB/Mongoose
```typescript
// ❌ WRONG - We don't use MongoDB anymore!
import Book from "@/models/Book";
const book = await Book.findById(id);

// ✅ CORRECT - We use SQLite + Drizzle + Repositories
import { bookRepository } from "@/lib/repositories/book.repository";
const book = await bookRepository.findById(id);
```

### ❌ Mistake 3: Writing to Calibre Without Approval
```typescript
// ❌ WRONG - Never modify Calibre book metadata!
db.prepare("UPDATE books SET title = ?").run("New Title");
db.prepare("INSERT INTO authors (name) VALUES (?)").run("Author");

// ✅ CORRECT - Only ratings are approved
import { updateCalibreRating } from "@/lib/db/calibre-write";
updateCalibreRating(calibreId, 5); // Only this is allowed!
```

### ❌ Mistake 4: Forgetting Test Database Isolation
```typescript
// ❌ WRONG - Tests will interfere with each other
test("create book", async () => {
  const book = await bookRepository.create({ ... });
  expect(book).toBeDefined();
});

// ✅ CORRECT - Use test database
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";

beforeEach(() => {
  setDatabase(testDb);
  resetDatabase();
});

test("create book", async () => {
  const book = await bookRepository.create({ ... });
  expect(book).toBeDefined();
});
```

### ❌ Mistake 5: Importing SQLite Directly
```typescript
// ❌ WRONG - Bypasses factory pattern
import { Database } from "bun:sqlite";
import Database from "better-sqlite3";
const db = new Database(path);

// ❌ WRONG - Manual runtime detection
if (typeof Bun !== 'undefined') {
  const { Database } = require('bun:sqlite');
  // ...
}

// ✅ CORRECT - Use factory for new connections
import { createDatabase } from "@/lib/db/factory";
const { db, sqlite } = createDatabase({ path, schema });

// ✅ CORRECT - Use existing abstractions
import { getCalibreDB, getAllBooks } from "@/lib/db/calibre";  // For Calibre
import { bookRepository } from "@/lib/repositories/book.repository";  // For Tome DB
```

### ❌ Mistake 6: Using Global Test Mocks
```typescript
// ❌ WRONG - Leaks across test files
mock.module("@/lib/streaks", () => ({
  updateStreaks: mockFn,
}));

// ✅ CORRECT - Mock only framework internals
mock.module("next/cache", () => ({
  revalidatePath: () => {},
}));
```

### ❌ Mistake 7: Referencing Outdated Tech Stack
```text
❌ WRONG: "Let's update the MongoDB connection..."
❌ WRONG: "Add this to your Mongoose schema..."
❌ WRONG: "Query using Book.find()..."

✅ CORRECT: "Let's update the repository..."
✅ CORRECT: "Add this to your Drizzle schema..."
✅ CORRECT: "Query using bookRepository.findWithFilters()..."
```

### Quick Validation Checklist

Before suggesting code, verify:
- [ ] Using repositories (not direct db access)
- [ ] Using SQLite/Drizzle (not MongoDB/Mongoose)
- [ ] Only writing to Calibre ratings (if applicable)
- [ ] Using test database in tests (`setDatabase()`)
- [ ] Using database factory pattern (not manual runtime detection)
- [ ] Not importing `bun:sqlite` or `better-sqlite3` directly
- [ ] Not using global mocks in tests
- [ ] Error handling with try/catch
- [ ] Type safety (no `any` types)

---

## 📚 Related Documentation

- **Architecture**: `docs/ARCHITECTURE.md` - Complete system design
- **Repository Pattern**: `docs/REPOSITORY_PATTERN_GUIDE.md` - Repository pattern deep dive
- **Code Patterns**: `.specify/memory/patterns.md` - Production-tested implementation patterns
- **Migration Status**: `docs/SQLITE_MIGRATION_STATUS.md` - Current migration state
- **Testing Guide**: `__tests__/README.md` - Comprehensive testing patterns
- **Documentation Index**: `docs/README.md` - All documentation

---

**Last Updated:** 2025-11-22
**Tech Stack:** SQLite + Drizzle ORM + Repository Pattern + Database Factory (post-MongoDB migration)
**For:** All AI coding assistants working on Tome
**Status:** Single source of truth for coding patterns
