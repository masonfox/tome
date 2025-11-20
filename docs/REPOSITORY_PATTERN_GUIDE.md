# Repository Pattern Guide

## Overview

The Repository Pattern is the **primary data access pattern** in the Tome project. It provides a clean abstraction layer between business logic and database operations, making code more maintainable, testable, and consistent.

**Why Repository Pattern?**
- **Centralized data access**: All database queries in one place
- **Type safety**: Full TypeScript support with Drizzle ORM
- **Testability**: Easy to mock repositories in tests
- **Consistency**: Standard CRUD operations across all tables
- **Maintainability**: Changes to data access logic stay in repositories

---

## Architecture

### Layer Structure

```
API Route / Service
       ↓
   Repository (business logic, filtering)
       ↓
   Drizzle ORM (query building)
       ↓
   SQLite Database
```

**Never bypass repositories!** Always use repositories for database access.

---

## BaseRepository

All repositories extend `BaseRepository<T, InsertT, TableT>`, which provides standard CRUD operations.

**Location:** `lib/repositories/base.repository.ts`

### Type Parameters

- **T**: The select type (returned from queries)
- **InsertT**: The insert type (for creating/updating records)
- **TableT**: The Drizzle table schema type

### Core Methods

#### `findById(id: number): Promise<T | undefined>`
Find a single record by its ID.

```typescript
const book = await bookRepository.findById(123);
if (book) {
  console.log(book.title);
}
```

#### `findAll(): Promise<T[]>`
Find all records in the table.

```typescript
const allBooks = await bookRepository.findAll();
```

#### `find(where: SQL): Promise<T[]>`
Find records matching a WHERE clause.

```typescript
import { eq } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";

const orphanedBooks = await bookRepository.find(
  eq(books.orphaned, true)
);
```

#### `findOne(where: SQL): Promise<T | undefined>`
Find a single record matching a WHERE clause.

```typescript
import { eq } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";

const book = await bookRepository.findOne(
  eq(books.calibreId, 456)
);
```

#### `create(data: InsertT): Promise<T>`
Create a new record.

```typescript
const newBook = await bookRepository.create({
  calibreId: 789,
  title: "The Great Gatsby",
  authors: ["F. Scott Fitzgerald"],
  path: "/path/to/book",
});
```

#### `update(id: number, data: Partial<InsertT>): Promise<T | undefined>`
Update a record by ID.

```typescript
const updated = await bookRepository.update(123, {
  totalPages: 350,
  rating: 5,
});
```

#### `delete(id: number): Promise<boolean>`
Delete a record by ID. Returns `true` if deleted, `false` if not found.

```typescript
const deleted = await bookRepository.delete(123);
if (deleted) {
  console.log("Book deleted");
}
```

#### `deleteWhere(where: SQL): Promise<number>`
Delete records matching a WHERE clause. Returns count of deleted records.

```typescript
import { eq } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";

const deletedCount = await bookRepository.deleteWhere(
  eq(books.orphaned, true)
);
console.log(`Deleted ${deletedCount} orphaned books`);
```

#### `count(): Promise<number>`
Count all records in the table.

```typescript
const totalBooks = await bookRepository.count();
```

#### `countWhere(where: SQL): Promise<number>`
Count records matching a WHERE clause.

```typescript
import { eq } from "drizzle-orm";
import { books } from "@/lib/db/schema/books";

const orphanedCount = await bookRepository.countWhere(
  eq(books.orphaned, true)
);
```

#### `exists(id: number): Promise<boolean>`
Check if a record exists by ID.

```typescript
if (await bookRepository.exists(123)) {
  console.log("Book exists");
}
```

---

## Specialized Repositories

Each table has its own specialized repository extending `BaseRepository` with custom methods.

### BookRepository

**Location:** `lib/repositories/book.repository.ts`
**Import:** `import { bookRepository } from "@/lib/repositories/book.repository";`

#### Custom Methods

##### `findByCalibreId(calibreId: number): Promise<Book | undefined>`
Find a book by its Calibre ID.

```typescript
const book = await bookRepository.findByCalibreId(456);
```

##### `findWithFilters(filters: BookFilter, limit: number, skip: number, sortBy?: string): Promise<{ books: Book[], total: number }>`
Find books with complex filtering, pagination, and sorting.

```typescript
const { books, total } = await bookRepository.findWithFilters(
  {
    status: "reading",
    search: "Harry Potter",
    tags: ["Fantasy"],
    rating: "4+",
    showOrphaned: false,
  },
  50,  // limit
  0,   // skip
  "title"  // sortBy
);

console.log(`Found ${total} books, showing ${books.length}`);
```

**Supported Filters:**
- `status`: Filter by reading status (joins with sessions)
- `search`: Search title and authors (case-insensitive)
- `tags`: Filter by tags (JSON array contains)
- `rating`: Filter by rating ("all" | "5" | "4+" | "3+" | "2+" | "1+" | "unrated")
- `showOrphaned`: Include orphaned books
- `orphanedOnly`: Show only orphaned books

**Supported Sort Options:**
- `title` / `title_desc`
- `author` / `author_desc`
- `created` / `created_desc`
- `rating` / `rating_asc`

##### `updateByCalibreId(calibreId: number, data: Partial<NewBook>): Promise<Book | undefined>`
Update a book by Calibre ID.

```typescript
const updated = await bookRepository.updateByCalibreId(456, {
  rating: 5,
  lastSynced: new Date(),
});
```

##### `findNotInCalibreIds(calibreIds: number[]): Promise<Book[]>`
Find books not in the provided list of Calibre IDs (for orphaning).

```typescript
const currentCalibreIds = [1, 2, 3, 4, 5];
const orphanedBooks = await bookRepository.findNotInCalibreIds(currentCalibreIds);
```

##### `markAsOrphaned(id: number): Promise<Book | undefined>`
Mark a book as orphaned (removed from Calibre library).

```typescript
await bookRepository.markAsOrphaned(123);
```

##### `getAllTags(): Promise<string[]>`
Get all unique tags from all books, sorted alphabetically.

```typescript
const tags = await bookRepository.getAllTags();
// ["Fantasy", "Fiction", "Mystery", "Science Fiction"]
```

---

### SessionRepository

**Location:** `lib/repositories/session.repository.ts`
**Import:** `import { sessionRepository } from "@/lib/repositories/session.repository";`

#### Custom Methods

##### `findByBookId(bookId: number): Promise<ReadingSession[]>`
Find all sessions for a book (all read-throughs).

```typescript
const sessions = await sessionRepository.findByBookId(123);
```

##### `findActiveByBookId(bookId: number): Promise<ReadingSession | undefined>`
Find the active session for a book.

```typescript
const activeSession = await sessionRepository.findActiveByBookId(123);
if (activeSession) {
  console.log(`Currently ${activeSession.status}`);
}
```

##### `findByStatus(status: string): Promise<ReadingSession[]>`
Find all active sessions with a specific status.

```typescript
const readingSessions = await sessionRepository.findByStatus("reading");
```

##### `getNextSessionNumber(bookId: number): Promise<number>`
Get the next session number for a book (for re-reading).

```typescript
const nextNum = await sessionRepository.getNextSessionNumber(123);
// If book has sessions 1 and 2, returns 3
```

##### `deactivateOtherSessions(bookId: number, currentSessionId: number): Promise<void>`
Deactivate all sessions except the specified one.

```typescript
await sessionRepository.deactivateOtherSessions(123, 456);
```

---

### ProgressRepository

**Location:** `lib/repositories/progress.repository.ts`
**Import:** `import { progressRepository } from "@/lib/repositories/progress.repository";`

#### Custom Methods

##### `findByBookId(bookId: number, limit?: number): Promise<ProgressLog[]>`
Find progress logs for a book, ordered by date DESC.

```typescript
const logs = await progressRepository.findByBookId(123, 10);
```

##### `findBySessionId(sessionId: number, limit?: number): Promise<ProgressLog[]>`
Find progress logs for a specific session.

```typescript
const logs = await progressRepository.findBySessionId(456);
```

##### `findLatestByBookId(bookId: number): Promise<ProgressLog | undefined>`
Find the most recent progress log for a book.

```typescript
const latest = await progressRepository.findLatestByBookId(123);
if (latest) {
  console.log(`Currently on page ${latest.currentPage}`);
}
```

##### `findByDateRange(startDate: Date, endDate: Date): Promise<ProgressLog[]>`
Find progress logs within a date range.

```typescript
const startOfMonth = new Date("2024-01-01");
const endOfMonth = new Date("2024-01-31");
const logs = await progressRepository.findByDateRange(startOfMonth, endOfMonth);
```

##### `getUniqueDatesWithProgress(): Promise<string[]>`
Get unique dates that have progress (for streak calculations).

```typescript
const activeDates = await progressRepository.getUniqueDatesWithProgress();
// ["2024-01-15", "2024-01-16", "2024-01-17"]
```

---

### StreakRepository

**Location:** `lib/repositories/streak.repository.ts`
**Import:** `import { streakRepository } from "@/lib/repositories/streak.repository";`

#### Custom Methods

##### `getActiveStreak(): Promise<Streak | undefined>`
Get the active streak (singleton for single-user mode).

```typescript
const streak = await streakRepository.getActiveStreak();
if (streak) {
  console.log(`Current streak: ${streak.currentStreak} days`);
}
```

##### `upsertStreak(data: Partial<NewStreak>): Promise<Streak>`
Create or update the active streak.

```typescript
const streak = await streakRepository.upsertStreak({
  currentStreak: 5,
  longestStreak: 10,
  lastActivityDate: new Date(),
});
```

---

## Creating Custom Repositories

### Step 1: Create Schema

First, define your Drizzle schema in `lib/db/schema/your-table.ts`:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const yourTable = sqliteTable("your_table", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type YourModel = typeof yourTable.$inferSelect;
export type NewYourModel = typeof yourTable.$inferInsert;
```

### Step 2: Create Repository

Create `lib/repositories/your.repository.ts`:

```typescript
import { BaseRepository } from "./base.repository";
import { yourTable, YourModel, NewYourModel } from "@/lib/db/schema/your-table";
import { eq } from "drizzle-orm";

export class YourRepository extends BaseRepository<
  YourModel,
  NewYourModel,
  typeof yourTable
> {
  constructor() {
    super(yourTable);
  }

  /**
   * Custom method: Find by name
   */
  async findByName(name: string): Promise<YourModel | undefined> {
    return this.findOne(eq(yourTable.name, name));
  }

  /**
   * Custom method: Search by partial name
   */
  async searchByName(query: string): Promise<YourModel[]> {
    return this.getDatabase()
      .select()
      .from(yourTable)
      .where(like(yourTable.name, `%${query}%`))
      .all();
  }
}

// Singleton instance
export const yourRepository = new YourRepository();
```

### Step 3: Use in API Routes

```typescript
// app/api/your-resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { yourRepository } from "@/lib/repositories/your.repository";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get("name");

    if (name) {
      const item = await yourRepository.findByName(name);
      if (!item) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    const all = await yourRepository.findAll();
    return NextResponse.json(all);
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## Testing with Repositories

### Test Database Isolation

Use `setDatabase()` and `resetDatabase()` from `lib/db/context.ts`:

```typescript
import { test, expect, beforeEach } from "bun:test";
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";
import { bookRepository } from "@/lib/repositories/book.repository";

beforeEach(() => {
  // Switch to test database
  setDatabase(testDb);

  // Clear all tables
  resetDatabase();
});

test("should create a book", async () => {
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    path: "/test/path",
  });

  expect(book.id).toBeDefined();
  expect(book.title).toBe("Test Book");
});

test("should find book by calibreId", async () => {
  // Arrange
  await bookRepository.create({
    calibreId: 123,
    title: "Test Book",
    authors: ["Author"],
    path: "/path",
  });

  // Act
  const found = await bookRepository.findByCalibreId(123);

  // Assert
  expect(found).toBeDefined();
  expect(found?.title).toBe("Test Book");
});
```

### Mocking Repositories

For unit tests, mock the repository:

```typescript
import { test, expect, mock } from "bun:test";
import { bookRepository } from "@/lib/repositories/book.repository";

test("should handle book not found", async () => {
  // Mock the repository method
  const mockFindById = mock(() => Promise.resolve(undefined));
  bookRepository.findById = mockFindById;

  // Test your service/API that uses the repository
  const result = await yourService.getBook(999);

  expect(result).toBeNull();
  expect(mockFindById).toHaveBeenCalledWith(999);
});
```

---

## Best Practices

### ✅ DO

**Use repositories for all database access:**
```typescript
// ✅ CORRECT
import { bookRepository } from "@/lib/repositories/book.repository";
const books = await bookRepository.findAll();
```

**Add custom methods for complex queries:**
```typescript
// ✅ CORRECT - Complex query in repository
class BookRepository extends BaseRepository<...> {
  async findReadingBooksWithProgress(): Promise<BookWithProgress[]> {
    // Complex join logic here
  }
}
```

**Handle errors properly:**
```typescript
// ✅ CORRECT
try {
  const book = await bookRepository.create(data);
  return NextResponse.json(book);
} catch (error) {
  console.error("Error creating book:", error);
  return NextResponse.json(
    { error: "Failed to create book" },
    { status: 500 }
  );
}
```

**Use type inference:**
```typescript
// ✅ CORRECT - TypeScript knows the types
const book = await bookRepository.findById(123);
if (book) {
  console.log(book.title); // TypeScript knows this exists
}
```

### ❌ DON'T

**Never bypass repositories:**
```typescript
// ❌ WRONG - Direct db access
import { db } from "@/lib/db/sqlite";
import { books } from "@/lib/db/schema/books";
const allBooks = db.select().from(books).all();
```

**Don't put business logic in API routes:**
```typescript
// ❌ WRONG - Complex logic in API route
export async function GET(request: NextRequest) {
  const db = getDatabase();
  const books = db.select().from(books)
    .where(eq(books.status, "reading"))
    .join(sessions, ...)
    .all(); // Complex query here!
}

// ✅ CORRECT - Logic in repository
export async function GET(request: NextRequest) {
  const books = await bookRepository.findReadingBooks();
}
```

**Don't skip error handling:**
```typescript
// ❌ WRONG - No error handling
export async function GET(request: NextRequest) {
  const book = await bookRepository.findById(123);
  return NextResponse.json(book); // What if it throws?
}
```

**Don't use 'any' types:**
```typescript
// ❌ WRONG
async findByName(name: string): Promise<any> {
  return this.find(eq(this.table.name, name));
}

// ✅ CORRECT
async findByName(name: string): Promise<YourModel | undefined> {
  return this.findOne(eq(this.table.name, name));
}
```

---

## Common Patterns

### Filtering Pattern

```typescript
// Build WHERE conditions dynamically
const conditions: SQL[] = [];

if (filters.status) {
  conditions.push(eq(table.status, filters.status));
}

if (filters.search) {
  conditions.push(
    or(
      like(table.title, `%${filters.search}%`),
      like(table.author, `%${filters.search}%`)
    )!
  );
}

const whereClause = conditions.length > 0
  ? and(...conditions)
  : undefined;

return this.getDatabase()
  .select()
  .from(table)
  .where(whereClause)
  .all();
```

### Pagination Pattern

```typescript
async findWithPagination(
  limit: number = 50,
  offset: number = 0
): Promise<{ items: T[], total: number }> {
  // Get total count
  const total = await this.count();

  // Get paginated results
  const items = this.getDatabase()
    .select()
    .from(this.table)
    .limit(limit)
    .offset(offset)
    .all();

  return { items, total };
}
```

### Upsert Pattern (Update or Insert)

```typescript
async upsert(uniqueField: string, data: InsertT): Promise<T> {
  const existing = await this.findOne(
    eq(this.table[uniqueField], data[uniqueField])
  );

  if (existing) {
    return this.update(existing.id, data);
  } else {
    return this.create(data);
  }
}
```

### Join Pattern (with type safety)

```typescript
async findBooksWithSessions(): Promise<BookWithSession[]> {
  return this.getDatabase()
    .select({
      // Book fields
      id: books.id,
      title: books.title,
      authors: books.authors,
      // Session fields
      sessionStatus: readingSessions.status,
      startedDate: readingSessions.startedDate,
    })
    .from(books)
    .leftJoin(
      readingSessions,
      and(
        eq(readingSessions.bookId, books.id),
        eq(readingSessions.isActive, true)
      )
    )
    .all();
}
```

---

## Related Documentation

- **AI Coding Patterns**: `docs/AI_CODING_PATTERNS.md` - Repository pattern usage in context
- **Architecture**: `docs/BOOK_TRACKER_ARCHITECTURE.md` - Overall system design
- **Base Repository**: `lib/repositories/base.repository.ts` - Source code
- **Example Repositories**:
  - `lib/repositories/book.repository.ts`
  - `lib/repositories/session.repository.ts`
  - `lib/repositories/progress.repository.ts`
  - `lib/repositories/streak.repository.ts`

---

**Last Updated:** 2025-11-20
**For:** All developers working on Tome
**Status:** Production pattern - use for all database access
