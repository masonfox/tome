# Tome Implementation Patterns

**Purpose**: Reusable implementation patterns extracted from production codebase

**Last Updated**: 2026-01-11

**Referenced By**: Constitution (`.specify/memory/constitution.md`)

---

## Pattern 1: Database Factory Pattern ⭐ (THE MOST IMPORTANT)

**When to Use**: Whenever creating a new database connection

**Why**: Automatically selects the right SQLite driver based on runtime environment (Bun vs Node.js)

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

**Benefits**:
- Enables automatic Calibre sync in dev mode (Node.js with better-sqlite3)
- Maintains optimal production performance (Bun with native bun:sqlite)
- Eliminates code duplication (single source of truth)
- Centralizes PRAGMA configuration

**Anti-patterns**:
```typescript
// ❌ WRONG - Import db directly
import { Database } from "bun:sqlite";
const db = new Database(path);

// ❌ WRONG - Manual runtime detection
if (typeof Bun !== 'undefined') {
  const { Database } = require('bun:sqlite');
}
```

**Files**: `lib/db/factory.ts`, `lib/db/sqlite.ts`, `lib/db/calibre.ts`

---

## Pattern 2: Test Isolation Pattern

**When to Use**: Before every test that accesses the database

**Why**: Prevents test state leakage and enables parallel test execution

```typescript
import { test, expect, beforeEach } from "bun:test";
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";
import { bookRepository } from "@/lib/repositories/book.repository";

beforeEach(async () => {
  // Switch to test database
  setDatabase(testDb);

  // Clear all test data
  resetDatabase();
});

test("should create a book", async () => {
  const book = await bookRepository.create({
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    path: "/test/path",
  });

  expect(book.title).toBe("Test Book");
});
```

**Anti-patterns**:
```typescript
// ❌ WRONG - Global module mocks leak across test files
mock.module("@/lib/streaks", () => ({
  updateStreaks: mockFn,
}));

// ❌ WRONG - Tests without database reset
test("create book", async () => {
  const book = await bookRepository.create({ ... });
  // Previous test's data still in DB!
});
```

**Files**: `lib/db/context.ts`, `__tests__/**/*.test.ts`

---

## Pattern 3: Repository Pattern (PRIMARY DATA ACCESS)

**When to Use**: ALL database access for Tome database (not Calibre)

**Why**: Centralizes queries, provides type safety, enables testing, prevents N+1 problems

```typescript
import { bookRepository } from "@/lib/repositories/book.repository";

// Find by ID
const book = await bookRepository.findById(123);

// Find with complex filters (primary pattern for list pages)
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

// Create
const newBook = await bookRepository.create({
  calibreId: 456,
  title: "New Book",
  authors: ["Author Name"],
  path: "/path/to/book",
});

// Update
await bookRepository.update(123, { rating: 5 });

// Delete
await bookRepository.delete(123);

// Custom methods
const book = await bookRepository.findByCalibreId(456);
const tags = await bookRepository.getAllTags();
```

**Anti-patterns**:
```typescript
// ❌ WRONG - Direct db access
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all();

// ❌ WRONG - Complex queries in API routes
export async function GET(request: NextRequest) {
  const books = db.select().from(books)
    .where(eq(books.status, "reading"))
    .join(sessions, ...)
    .all();
}

// ✅ CORRECT - Use repository
const books = await bookRepository.findReadingBooks();
```

**Files**: `lib/repositories/*.repository.ts`, all API routes

---

## Pattern 4: Client Service Layer Pattern (For Complex Pages)

**When to Use**: Pages with complex filtering, searching, sorting, infinite scroll

**Why**: Client-side caching reduces API calls, clear separation of concerns

**Architecture**: `Page → Hook → ClientService → API Route → Repository`

### Layer 1: Client Service
```typescript
// lib/library-service.ts
export class LibraryService {
  private cache = new Map<string, PaginatedBooks>();

  async getBooks(filters: LibraryFilters): Promise<PaginatedBooks> {
    const cacheKey = this.buildCacheKey(filters);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const params = new URLSearchParams();
    params.set("status", filters.status || "");
    params.set("limit", filters.pagination.limit.toString());
    params.set("skip", filters.pagination.skip.toString());

    const response = await fetch(`/api/books?${params.toString()}`);
    const data = await response.json();

    const result = {
      books: data.books || [],
      total: data.total || 0,
      hasMore: filters.pagination.skip + data.books.length < data.total,
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

### Layer 2: Custom Hook
```typescript
// hooks/useLibraryData.ts
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
      pagination: {
        ...filters.pagination,
        skip: filters.pagination.skip + 50,
      },
    };
    const result = await libraryService.getBooks(nextFilters);
    setData(prev => ({
      ...result,
      books: [...(prev?.books || []), ...result.books],
    }));
    setFilters(nextFilters);
  }, [filters]);

  return {
    books: data?.books || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    loadMore,
    setSearch: (search) => setFilters({
      ...filters,
      search,
      pagination: { limit: 50, skip: 0 }
    }),
  };
}
```

### Layer 3: Page Component
```typescript
// app/library/page.tsx
"use client";

export default function LibraryPage() {
  const { books, total, hasMore, loading, loadMore, setSearch } =
    useLibraryData();

  return (
    <>
      <LibraryFilters onSearchChange={setSearch} />
      <BookGrid books={books} loading={loading} />
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </>
  );
}
```

**Anti-patterns**:
```typescript
// ❌ WRONG - Direct API calls in component (no caching)
useEffect(() => {
  fetch(`/api/books?status=${status}`)
    .then(res => res.json())
    .then(data => setBooks(data));
}, [status]);

// ❌ WRONG - Multiple service instances
const service = new LibraryService(); // New instance every render!

// ❌ WRONG - Wrong hasMore calculation
const hasMore = books.length === 50; // Breaks on last page
```

**Files**: `lib/library-service.ts`, `hooks/useLibraryData.ts`, `app/library/page.tsx`

---

## Pattern 5: Progress Tracking with Auto-Calculations

**When to Use**: Logging user activity that affects aggregated metrics

**Why**: Single operation with clear side effects, consistency guarantees

```typescript
// app/api/books/[id]/progress/route.ts
export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { currentPage, currentPercentage, notes, sessionId } = body;

    // 1. Validate book exists
    const book = await bookRepository.findById(parseInt(params.id));
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // 2. Get last progress to calculate delta
    const lastProgress = await progressRepository.findLatestByBookId(book.id);

    // 3. Calculate percentage from pages if needed
    let finalPercentage = currentPercentage;
    if (currentPage !== undefined && book.totalPages) {
      finalPercentage = (currentPage / book.totalPages) * 100;
    }

    // 4. Calculate pages read delta
    const pagesRead = lastProgress
      ? Math.max(0, currentPage - (lastProgress.currentPage || 0))
      : currentPage;

    // 5. Create progress log
    const progressLog = await progressRepository.create({
      bookId: book.id,
      sessionId,
      currentPage,
      currentPercentage: finalPercentage,
      progressDate: new Date(),
      notes,
      pagesRead,
    });

    // 6. Auto-update streak
    await updateStreaks();

    // 7. Auto-mark as read if 100%
    if (finalPercentage >= 100) {
      const activeSession = await sessionRepository.findActiveByBookId(book.id);
      if (activeSession && activeSession.status !== "read") {
        await sessionRepository.update(activeSession.id, {
          status: "read",
          completedDate: new Date(),
        });
      }
    }

    return NextResponse.json(progressLog);
  } catch (error) {
    console.error("Error creating progress:", error);
    return NextResponse.json({ error: "Failed to create progress" }, { status: 500 });
  }
}
```

**Side Effects**:
1. Calculate percentage from pages (if not provided)
2. Calculate pages delta (no frontend math)
3. Update global streak
4. Auto-transition to "read" at 100%

**Anti-patterns**:
```typescript
// ❌ WRONG - Frontend calculates delta
const pagesRead = currentPage - previousPage; // Inconsistent!

// ❌ WRONG - Forgot streak update
// Progress created but streak not updated (data inconsistency)
```

**Files**: `app/api/books/[id]/progress/route.ts`

---

## Pattern 6: Streak Calculation with Date Normalization

**When to Use**: Calculating metrics based on consecutive days

**Why**: Prevents time-boundary issues (11:59 PM → 12:01 AM should count as consecutive)

```typescript
// lib/streaks.ts
import { differenceInDays, startOfDay } from "date-fns";
import { streakRepository } from "@/lib/repositories/streak.repository";

export async function updateStreaks(userId?: string): Promise<Streak> {
  let streak = await streakRepository.getActiveStreak();

  if (!streak) {
    // Create initial streak
    return await streakRepository.upsertStreak({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      streakStartDate: new Date(),
      totalDaysActive: 1,
    });
  }

  // Normalize dates to start-of-day (CRITICAL!)
  const today = startOfDay(new Date());
  const lastActivity = startOfDay(new Date(streak.lastActivityDate));

  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day: no change
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day: increment
    return await streakRepository.upsertStreak({
      currentStreak: streak.currentStreak + 1,
      longestStreak: Math.max(streak.longestStreak, streak.currentStreak + 1),
      totalDaysActive: streak.totalDaysActive + 1,
      lastActivityDate: today,
    });
  } else {
    // Streak broken: reset current but keep longest
    return await streakRepository.upsertStreak({
      currentStreak: 1,
      streakStartDate: today,
      totalDaysActive: streak.totalDaysActive + 1,
      lastActivityDate: today,
      longestStreak: streak.longestStreak, // Preserve!
    });
  }
}
```

**Key Logic**:
- `daysDiff === 0`: Same day, no change
- `daysDiff === 1`: Consecutive, increment
- `daysDiff > 1`: Broken, reset to 1

**Anti-patterns**:
```typescript
// ❌ WRONG - Raw timestamps (breaks on time boundaries)
const daysDiff = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));
// Activity at 11:59 PM + 12:01 AM = 1 second difference!

// ❌ WRONG - Not preserving longest streak
currentStreak = 1; // Forgot longestStreak!
```

**Files**: `lib/streaks.ts`

---

## Pattern 7: Calibre Sync Service

**When to Use**: Syncing data from external sources

**Why**: Try/finally ensures cleanup, handles create/update, preserves history

```typescript
// lib/sync-service.ts
import { bookRepository } from "@/lib/repositories/book.repository";
import { getAllBooks } from "@/lib/db/calibre";

export async function syncCalibreLibrary(): Promise<SyncResult> {
  if (isSyncing) return SYNC_IN_PROGRESS_ERROR;

  isSyncing = true;
  try {
    const calibreBooks = getAllBooks();
    let syncedCount = 0;
    let updatedCount = 0;

    for (const calibreBook of calibreBooks) {
      const bookData = {
        calibreId: calibreBook.id,
        title: calibreBook.title,
        authors: calibreBook.authors?.split(",") || [],
        isbn: calibreBook.isbn,
        totalPages: calibreBook.totalPages,
        path: calibreBook.path,
        rating: calibreBook.rating,
        lastSynced: new Date(),
      };

      const existingBook = await bookRepository.findByCalibreId(calibreBook.id);

      if (existingBook) {
        await bookRepository.updateByCalibreId(calibreBook.id, bookData);
        updatedCount++;
      } else {
        await bookRepository.create(bookData);
        syncedCount++;
      }
    }

    // Mark books not in Calibre as orphaned (preserve history!)
    const calibreIds = calibreBooks.map(b => b.id);
    const orphanedBooks = await bookRepository.findNotInCalibreIds(calibreIds);
    for (const book of orphanedBooks) {
      await bookRepository.markAsOrphaned(book.id);
    }

    lastSyncTime = new Date();
    return {
      success: true,
      syncedCount,
      updatedCount,
      totalBooks: calibreBooks.length,
    };
  } finally {
    isSyncing = false;  // CRITICAL: Always reset
  }
}
```

**Key Points**:
- Try/finally ensures flag reset even on error
- Handles both create and update cases
- Marks removed books as orphaned (never delete!)
- Prevents concurrent syncs

**Anti-patterns**:
```typescript
// ❌ WRONG - No try/finally
try {
  // sync logic
} catch (error) {
  return error; // Flag left as true!
}

// ❌ WRONG - Delete books not in Calibre
await bookRepository.delete(book.id); // Lose user history!
```

**Files**: `lib/sync-service.ts`

---

## Pattern 8: File Watcher with Debounce

**When to Use**: Monitoring external files that change rapidly

**Why**: Debounce prevents thrashing when source writes multiple times

```typescript
// lib/calibre-watcher.ts
async start(calibreDbPath: string, onSync: SyncCallback) {
  const stats = await stat(calibreDbPath);
  this.lastModified = stats.mtimeMs;

  this.watcher = watch(calibreDbPath, async (eventType) => {
    if (eventType === "change") {
      // Clear previous timer (debounce)
      if (this.debounceTimer) clearTimeout(this.debounceTimer);

      // Wait 2 seconds before sync
      this.debounceTimer = setTimeout(async () => {
        const newStats = await stat(calibreDbPath);

        // Only sync if file actually changed
        if (newStats.mtimeMs > this.lastModified) {
          this.lastModified = newStats.mtimeMs;
          await this.triggerSync();
        }
      }, 2000);  // 2-second debounce
    }
  });

  // Initial sync on startup
  await this.triggerSync();
}
```

**Debounce Times**:
- 2000ms (2s): Database file changes
- 300ms: User input (search, filters)
- 500ms: Window resize events

**Files**: `lib/calibre-watcher.ts`

---

## Pattern 9: Status State Machine with Auto-Dates

**When to Use**: State transitions with automatic side effects

**Why**: Auto-sets dates based on status, coordinates multi-field updates

```typescript
// app/api/books/[id]/status/route.ts
export async function POST(request: NextRequest, { params }) {
  try {
    const { status, rating, review, startedDate, completedDate } = await request.json();
    const bookId = parseInt(params.id);

    let session = await sessionRepository.findActiveByBookId(bookId);

    if (!session) {
      const nextNumber = await sessionRepository.getNextSessionNumber(bookId);
      session = await sessionRepository.create({
        bookId,
        sessionNumber: nextNumber,
        status,
        isActive: true,
      });
    }

    const updateData: any = { status };

    // Auto-set startedDate when moving to "reading"
    if (status === "reading" && !session.startedDate) {
      updateData.startedDate = startedDate || new Date();
    }

    // Auto-set both dates when marking as "read"
    if (status === "read") {
      if (!session.startedDate) {
        updateData.startedDate = startedDate || new Date();
      }
      updateData.completedDate = completedDate || new Date();
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    // Rating stored on book (not session!)
    if (rating !== undefined) {
      await bookRepository.update(bookId, { rating });

      // Sync to Calibre (ratings only)
      const book = await bookRepository.findById(bookId);
      if (book?.calibreId) {
        await updateCalibreRating(book.calibreId, rating);
      }
    }

    const updated = await sessionRepository.update(session.id, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
```

**State Transitions**:
- `to-read` → no dates
- `reading` → auto-set startedDate
- `read` → auto-set both dates

**Key Insight**: Rating on book level, review on session level

**Files**: `app/api/books/[id]/status/route.ts`

---

## Pattern 10: Standard CRUD API Routes

**When to Use**: Creating RESTful endpoints

**Why**: Consistent error handling, input validation, proper HTTP codes

### GET (List with Filters)
```typescript
// app/api/books/route.ts
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      showOrphaned: searchParams.get("showOrphaned") === "true",
    };

    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    const { books, total } = await bookRepository.findWithFilters(
      filters,
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
```

### POST (Create with Validation)
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.calibreId || !body.title) {
      return NextResponse.json(
        { error: "Missing required fields: calibreId, title" },
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

### PATCH (Update by ID)
```typescript
// app/api/books/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const bookId = parseInt(params.id);

    const book = await bookRepository.update(bookId, body);

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

**HTTP Status Codes**:
- 200: Success (GET, PATCH, DELETE)
- 201: Created (POST)
- 400: Bad Request (validation error)
- 404: Not Found
- 500: Server Error

**Files**: `app/api/**/*.ts`

---

## Pattern 11: Companion Migrations Pattern

**When to Use**: Schema migrations that require semantic data transformations

**Why**: SQLite doesn't support `ALTER COLUMN` for type changes. Drizzle copies data AS-IS, which breaks when converting INTEGER timestamps → TEXT date strings.

**Problem**: When changing column types, data needs transformation:
```sql
-- Drizzle migration copies raw integers
INSERT INTO __new_progress_logs SELECT * FROM progress_logs;
-- Result: 1732507200 → "1732507200" (WRONG!)
-- Expected: 1732507200 → "2025-11-25" (semantic transformation)
```

**Solution**: Companion Migrations - hand-written transformations that run after schema migrations

### Architecture
```typescript
// Schema migrations (Drizzle-generated DDL)
drizzle/0015_opposite_shatterstar.sql
  ↓
// Companion migrations (hand-written DML)
lib/migrations/0015_progress_dates_timezone.ts
```

### Companion Migration Interface
```typescript
export interface CompanionMigration {
  name: string;                          // Unique name for tracking
  requiredTables: string[];              // Tables that must exist
  description?: string;                  // Optional description
  execute: (db: Database) => Promise<void>;  // Transformation logic
}
```

### Example Companion
```typescript
// lib/migrations/0015_progress_dates_timezone.ts
import { CompanionMigration } from "@/lib/db/companion-migrations";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0015_progress_dates_timezone" });

const migration: CompanionMigration = {
  name: "0015_progress_dates_timezone",
  requiredTables: ["progress_logs"],
  description: "Convert progress_date from Unix timestamps to YYYY-MM-DD strings",
  
  async execute(db) {
    // Get user timezone
    let timezone = "America/New_York";
    const streaksTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='streaks'"
    ).get();
    
    if (streaksTable) {
      const streak = db.prepare("SELECT user_timezone FROM streaks LIMIT 1").get();
      timezone = streak?.user_timezone || timezone;
    }
    
    logger.info({ timezone }, "Using timezone for conversion");
    
    // Get all progress logs with INTEGER timestamps
    const logs = db.prepare(
      "SELECT id, progress_date FROM progress_logs WHERE typeof(progress_date) = 'integer'"
    ).all();
    
    logger.info({ count: logs.length }, "Found progress logs to convert");
    
    if (logs.length === 0) {
      logger.info("No INTEGER timestamps found, nothing to convert");
      return;
    }
    
    // Convert timestamps to date strings
    const updateStmt = db.prepare(
      "UPDATE progress_logs SET progress_date = ? WHERE id = ?"
    );
    
    let converted = 0;
    for (const log of logs) {
      const date = new Date(log.progress_date * 1000); // Unix seconds → milliseconds
      const dateString = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      
      updateStmt.run(dateString, log.id);
      converted++;
      
      if (converted % 100 === 0) {
        logger.info({ converted, total: logs.length }, "Progress");
      }
    }
    
    logger.info({ converted }, "Conversion complete");
  }
};

export default migration;
```

### Framework Integration
```typescript
// lib/db/migrate.ts (simplified from 215 → 80 lines)
import { runCompanionMigrations } from "@/lib/db/companion-migrations";

// 1. Apply schema migrations (DDL)
migrate(db, { migrationsFolder: "./drizzle" });

// 2. Run companion migrations (DML)
await runCompanionMigrations(db);
```

### Execution Flow
```
runMigrations()
  ↓
1. Apply Drizzle schema migrations (DDL)
   → Creates/modifies tables
  ↓
2. Discover companions in lib/migrations/
   → Find files matching {number}_*.ts
   → Sort by migration number
  ↓
3. For each companion:
   → Check if already complete (migration_metadata)
   → Check if required tables exist (fresh DB = skip)
   → Execute transformation in transaction
   → Mark complete
```

### Framework Features
- **Discovery**: Automatically finds companions in `lib/migrations/`
- **Ordering**: Executes in same order schema migrations were applied
- **Idempotency**: Tracks completion in `migration_metadata` table
- **Fresh database support**: Skips if required tables don't exist
- **Transaction safety**: Rolls back on error
- **Logging**: Comprehensive progress reporting

### Directory Structure
```
lib/migrations/
├── 0015_progress_dates_timezone.ts    # Companion for migration 0015
├── 0016_session_dates_timezone.ts     # Companion for migration 0016
├── _template.ts                       # Template for new companions
└── README.md                          # Documentation
```

### Naming Convention
- Schema migration: `drizzle/0015_opposite_shatterstar.sql`
- Companion: `lib/migrations/0015_progress_dates_timezone.ts`
- Pattern: `{migration_number}_{description}.ts`

### When to Create a Companion
✅ **Create companion when**:
- Changing column type (INTEGER → TEXT, TEXT → INTEGER)
- Semantic transformation needed (timestamps → date strings)
- Data format changes (JSON structure updates)
- Complex data migrations (multi-table transformations)

❌ **Don't create companion when**:
- Simple schema changes (add column, drop column)
- Rename operations (Drizzle handles)
- Index creation/deletion
- Constraint changes

### Anti-patterns
```typescript
// ❌ WRONG - Data migration BEFORE schema migration
// (Old "special migrations" hack)
await migrateProgressDatesToText();  // Run before tables exist!
migrate(db, { migrationsFolder: "./drizzle" });

// ❌ WRONG - Direct db imports
import { db } from "@/lib/db/sqlite";
// Always use Database Factory Pattern (Pattern 1)

// ❌ WRONG - No table existence check
const logs = db.prepare("SELECT * FROM progress_logs").all();
// Fresh database will error! Check if table exists first.

// ❌ WRONG - No completion tracking
// Migration runs every time! Use migration_metadata table.
```

### Creating a New Companion (Developer Guide)
1. **Generate schema migration**: `bunx drizzle-kit generate`
2. **Identify migration number**: e.g., `0017`
3. **Create companion file**: `cp lib/migrations/_template.ts lib/migrations/0017_my_transformation.ts`
4. **Implement transformation logic** (see template)
5. **Test locally**: Fresh DB + existing DB scenarios
6. **Commit both files**: Schema migration + companion

### Benefits
✅ **Separation of concerns**: Schema (DDL) vs data (DML)  
✅ **Intuitive order**: Schema first, then data  
✅ **Fresh database support**: Skips when no tables exist  
✅ **Framework eliminates boilerplate**: Discovery, tracking, transactions  
✅ **Idempotent**: Safe to run multiple times  
✅ **Testable**: Easy to test transformation logic  
✅ **Discoverable**: Clear location and naming convention  
✅ **Scalable**: Minimal code for new companions

**Files**: `lib/db/companion-migrations.ts`, `lib/migrations/*.ts`, `docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md`

---

## Summary Reference Table

| Pattern | Location | Primary Use | Critical For |
|---------|----------|-------------|--------------|
| Database Factory | `lib/db/factory.ts` | All DB connections | Runtime detection |
| Test Isolation | `lib/db/context.ts` | All tests | Clean test state |
| Repository Pattern | `lib/repositories/` | All Tome DB access | Data layer |
| Client Service Layer | `lib/*-service.ts` + hooks | Complex pages | Caching + UX |
| Progress Tracking | `/api/books/[id]/progress` | Activity logging | Auto-calculations |
| Streak Calculation | `lib/streaks.ts` | Consecutive days | Date normalization |
| Sync Service | `lib/sync-service.ts` | Calibre integration | Data consistency |
| File Watcher | `lib/calibre-watcher.ts` | Auto-sync | Debouncing |
| State Machine | `/api/books/[id]/status` | Status transitions | Auto-dates |
| CRUD Routes | `/api/**/*.ts` | REST endpoints | Error handling |
| Companion Migrations | `lib/migrations/*.ts` | Data transformations | Type conversions |

**All patterns are production-tested with actual working code from the Tome codebase.**
