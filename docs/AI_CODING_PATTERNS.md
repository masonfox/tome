# AI Coding Patterns for Tome

This document contains the **single source of truth** for coding patterns, styles, and guidelines that all AI coding assistants must follow when working on the Tome project.

**For AI Assistants:** This is your primary reference for how to write code in this project. Read this entire document before making code changes.

---

## 🔑 Critical Pattern: SQLite Runtime Detection

**This is THE most important pattern in the codebase.**

**Location:** `lib/db/calibre.ts:23-34`

### The Pattern

```typescript
// ALWAYS use this pattern for SQLite database access
if (typeof Bun !== 'undefined') {
  // Bun runtime - use bun:sqlite
  const { Database } = require('bun:sqlite');
  db = new Database(path, { readonly: true });
} else {
  // Node.js runtime - use better-sqlite3
  const Database = require('better-sqlite3');
  db = new Database(path, { readonly: true });
}
```

### Why This Matters

- **Enables automatic Calibre sync in dev mode** (Node.js runtime)
- **Maintains compatibility with production** (Bun runtime)
- **Aligns with documented architecture** (backend runs on Node.js)
- **Single abstraction** in `lib/db/calibre.ts` - never import SQLite directly elsewhere

### Rules

✅ **DO:**
- Use `lib/db/calibre.ts` functions for all Calibre database access
- Maintain runtime detection when modifying `getCalibreDB()`
- Keep both SQLite libraries in sync (same API calls)

❌ **DON'T:**
- Import `bun:sqlite` directly in other files
- Import `better-sqlite3` directly in other files
- Write to Calibre database (it's read-only)
- Remove or modify the runtime detection logic

---

## 🧪 Test Patterns

**Location:** `__tests__/README.md` (comprehensive guide)

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

### Test Structure

```typescript
import { test, expect, beforeAll, afterAll } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test("should do something", async () => {
  // Arrange
  const input = "test";

  // Act
  const result = await functionUnderTest(input);

  // Assert
  expect(result).toBe("expected");
});
```

### Testing Rules

✅ **DO:**
- Use mongodb-memory-server for database tests
- Keep each test file independent
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Run full test suite before completing tasks (`bun test`)

❌ **DON'T:**
- Use global mocks for application modules
- Share state between test files
- Mock the database (use mongodb-memory-server)
- Skip tests or mark as `.skip` without user approval

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
// MongoDB
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";
import ReadingSession from "@/models/ReadingSession";
import ProgressLog from "@/models/ProgressLog";
import Streak from "@/models/Streak";

// Calibre SQLite (ALWAYS use these, never direct imports)
import { getCalibreDB, getAllBooks, getBookById } from "@/lib/db/calibre";
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
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
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

## 🗄️ Database Patterns

### MongoDB Queries (via Mongoose)

```typescript
// ✅ DO: Use async/await
const book = await Book.findById(bookId);
const books = await Book.find({ status: "reading" });

// ✅ DO: Use lean() for read-only queries
const books = await Book.find().lean();

// ✅ DO: Handle errors properly
try {
  const book = await Book.findByIdAndUpdate(id, updates);
  if (!book) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(book);
} catch (error) {
  console.error("Error updating book:", error);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
```

### SQLite Queries (Calibre - Read-Only)

```typescript
// ✅ DO: Use abstraction from lib/db/calibre.ts
import { getAllBooks, getBookById, searchBooks } from "@/lib/db/calibre";

const books = getAllBooks();
const book = getBookById(123);
const results = searchBooks("Harry Potter");

// ❌ DON'T: Import SQLite directly
// import { Database } from "bun:sqlite";  // NO!
// import Database from "better-sqlite3";  // NO!

// ❌ DON'T: Write to Calibre database
// db.prepare("UPDATE books SET ...").run();  // NO! Read-only!
```

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
│   ├── db/               # Database connections
│   │   ├── mongodb.ts    # MongoDB singleton
│   │   └── calibre.ts    # SQLite with runtime detection
│   ├── sync-service.ts   # Calibre sync logic
│   └── streaks.ts        # Streak calculations
├── models/               # Mongoose schemas
│   ├── Book.ts
│   ├── ReadingSession.ts
│   └── ProgressLog.ts
└── __tests__/           # Test files
    ├── api/            # API route tests
    └── unit/           # Unit tests
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
// Import SQLite directly
import { Database } from "bun:sqlite";  // Use lib/db/calibre.ts instead

// Use global test mocks
mock.module("@/lib/streaks", () => ...);  // Causes leakage

// Write to Calibre database
db.prepare("UPDATE books...").run();  // Read-only!

// Use 'any' type
function process(data: any) { }  // Use proper types

// Create CSS files
// Use Tailwind classes instead

// Skip error handling
const book = await Book.findById(id);  // No try/catch
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

### Standard CRUD Pattern

```typescript
// app/api/books/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import Book from "@/models/Book";

// GET /api/books
export async function GET(request: NextRequest) {
  await connectDB();

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");

  const query = status ? { status } : {};
  const books = await Book.find(query).lean();

  return NextResponse.json(books);
}

// POST /api/books
export async function POST(request: NextRequest) {
  await connectDB();

  try {
    const body = await request.json();
    const book = await Book.create(body);
    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create book" },
      { status: 500 }
    );
  }
}
```

### Dynamic Route Pattern

```typescript
// app/api/books/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await connectDB();

  const book = await Book.findById(params.id);

  if (!book) {
    return NextResponse.json(
      { error: "Book not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(book);
}
```

---

## 🔄 Typical Workflows

### Adding a New Feature

1. **Read architecture** → `docs/BOOK_TRACKER_ARCHITECTURE.md`
2. **Check patterns** → This document
3. **Implement following patterns**
4. **Add tests** → Follow test patterns above
5. **Run tests** → `bun test` (all 99 tests must pass)
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
Need to access Calibre data?
  └─> Use functions from lib/db/calibre.ts

Need to query MongoDB?
  └─> Use Mongoose models from /models

Creating a new page?
  └─> Server Component by default (Next.js 14)
  └─> Client Component only if needed ("use client")

Writing a test?
  └─> Use mongodb-memory-server
  └─> No global mocks for application modules

Adding SQLite functionality?
  └─> Modify lib/db/calibre.ts
  └─> Maintain runtime detection pattern

Unsure about a pattern?
  └─> Check this document
  └─> Check docs/BOOK_TRACKER_QUICK_REFERENCE.md
  └─> Ask the user
```

---

## 📚 Related Documentation

- **Architecture**: `docs/BOOK_TRACKER_ARCHITECTURE.md` - Complete system design
- **Quick Reference**: `docs/BOOK_TRACKER_QUICK_REFERENCE.md` - Code examples
- **Testing Guide**: `__tests__/README.md` - Comprehensive testing patterns
- **Documentation Index**: `docs/README.md` - All documentation

---

**Last Updated:** 2025-11-18
**For:** All AI coding assistants working on Tome
**Status:** Single source of truth for coding patterns
