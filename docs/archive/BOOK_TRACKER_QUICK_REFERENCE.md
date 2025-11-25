> **⚠️ DEPRECATED - Archived November 24, 2025**
>
> This document has been consolidated into [`/docs/ARCHITECTURE.md`](../ARCHITECTURE.md) and [`/.specify/memory/patterns.md`](../../.specify/memory/patterns.md).
>
> **Current Documentation:**
> - **Architecture & Patterns**: [`/docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
> - **Detailed Patterns**: [`/.specify/memory/patterns.md`](../../.specify/memory/patterns.md)
> - **Coding Standards**: [`/docs/AI_CODING_PATTERNS.md`](../AI_CODING_PATTERNS.md)
>
> This file is preserved for historical reference only.

---

# Book Tracker - Quick Reference & Code Snippets

> **Tech Stack:** SQLite + Drizzle ORM + Repository Pattern (see `docs/SQLITE_MIGRATION_STATUS.md`)

## Critical Code Sections

### 1. Database Access Patterns

#### Repository Pattern (PRIMARY)
```typescript
// Import repositories - ALL database access goes through these
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { streakRepository } from "@/lib/repositories/streak.repository";

// Find by ID
const book = await bookRepository.findById(123);

// Find all
const books = await bookRepository.findAll();

// Find with filters (complex queries)
const { books, total } = await bookRepository.findWithFilters(
  { status: "reading", search: "Harry Potter" },
  50,  // limit
  0    // skip
);

// Create
const newBook = await bookRepository.create({
  calibreId: 456,
  title: "New Book",
  authors: ["Author Name"],
  path: "/path/to/book",
});

// Update
const updated = await bookRepository.update(123, { rating: 5 });

// Delete
await bookRepository.delete(123);
```
**Key Point:** NEVER import `db` directly. Always use repositories for Tome database access.

#### Calibre DB Connection (Read-Only)
```typescript
// lib/db/calibre.ts
import { createDatabase } from "./factory";

export function getCalibreDB() {
  if (!dbInstance) {
    // Create read-only Calibre database connection using factory
    dbInstance = createDatabase({
      path: CALIBRE_DB_PATH,
      readonly: true,
      foreignKeys: false,  // Calibre manages its own schema
      wal: false,  // Don't modify journal mode on read-only DB
    });
    console.log(`Calibre DB: Using ${dbInstance.runtime === 'bun' ? 'bun:sqlite' : 'better-sqlite3'}`);
  }
  return dbInstance.sqlite;
}
```
**Key Point:** Read-only SQLite using database factory pattern for automatic driver selection

---

### 2. Syncing Flow

#### Main Sync Process (Repository-Based)
```typescript
// lib/sync-service.ts
import { bookRepository } from "@/lib/repositories/book.repository";
import { getAllBooks } from "@/lib/db/calibre";

export async function syncCalibreLibrary(): Promise<SyncResult> {
  if (isSyncing) return SYNC_IN_PROGRESS_ERROR;

  isSyncing = true;
  try {
    const calibreBooks = getAllBooks();

    for (const calibreBook of calibreBooks) {
      const bookData = {
        calibreId: calibreBook.id,
        title: calibreBook.title,
        authors: calibreBook.authors?.split(",") || [],
        isbn: calibreBook.isbn,
        totalPages: calibreBook.totalPages,
        publisher: calibreBook.publisher,
        pubDate: calibreBook.pubDate ? new Date(calibreBook.pubDate) : null,
        series: calibreBook.series,
        seriesIndex: calibreBook.seriesIndex,
        tags: calibreBook.tags || [],
        path: calibreBook.path,
        rating: calibreBook.rating,  // Synced from Calibre
        lastSynced: new Date(),
      };

      const existingBook = await bookRepository.findByCalibreId(calibreBook.id);

      if (existingBook) {
        // Update existing book
        await bookRepository.updateByCalibreId(calibreBook.id, bookData);
        updatedCount++;
      } else {
        // Create new book
        await bookRepository.create(bookData);
        syncedCount++;
      }
    }

    // Mark books not in Calibre as orphaned
    const calibreIds = calibreBooks.map(b => b.id);
    const orphanedBooks = await bookRepository.findNotInCalibreIds(calibreIds);
    for (const book of orphanedBooks) {
      await bookRepository.markAsOrphaned(book.id);
    }

    lastSyncTime = new Date();
    return { success: true, syncedCount, updatedCount, totalBooks: calibreBooks.length };
  } finally {
    isSyncing = false;  // Always reset flag
  }
}
```
**Key Pattern:** Try/finally ensures isSyncing is always reset
**Repository Methods:**
- `findByCalibreId()` - Check if book exists
- `updateByCalibreId()` - Update existing book
- `create()` - Add new book
- `findNotInCalibreIds()` - Find books removed from Calibre
- `markAsOrphaned()` - Mark removed books as orphaned

---

### 3. Auto-Sync Architecture

#### File Watcher
```typescript
// lib/calibre-watcher.ts
async start(calibreDbPath: string, onSync: SyncCallback) {
  const stats = await stat(calibreDbPath);
  this.lastModified = stats.mtimeMs;

  this.watcher = watch(calibreDbPath, async (eventType) => {
    if (eventType === "change") {
      // Debounce: clear previous timer
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      
      // Set new timer: wait 2 seconds before sync
      this.debounceTimer = setTimeout(async () => {
        const newStats = await stat(calibreDbPath);
        if (newStats.mtimeMs > this.lastModified) {
          this.lastModified = newStats.mtimeMs;
          await this.triggerSync();  // Actually sync
        }
      }, 2000);
    }
  });
  
  await this.triggerSync();  // Initial sync
}
```
**Why Debounce:** Calibre writes metadata.db multiple times during sync, 2-second debounce prevents thrashing

#### Server Instrumentation
```typescript
// instrumentation.ts - Runs on server startup
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { calibreWatcher } = await import("./lib/calibre-watcher");
    const { syncCalibreLibrary } = await import("./lib/sync-service");

    if (process.env.CALIBRE_DB_PATH) {
      await calibreWatcher.start(
        process.env.CALIBRE_DB_PATH,
        syncCalibreLibrary
      );
      
      // Graceful shutdown
      process.on("SIGTERM", () => calibreWatcher.stop());
      process.on("SIGINT", () => calibreWatcher.stop());
    }
  }
}
```
**Key Point:** Instrumentation hook runs ONCE at server startup. NEXT_RUNTIME check ensures it only runs in Node (not edge runtime)

---

### 4. Reading Progress Tracking

#### Progress Logging with Streak Update (Repository-Based)
```typescript
// app/api/books/[id]/progress/route.ts
import { bookRepository } from "@/lib/repositories/book.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { updateStreaks } from "@/lib/streaks";

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    const { currentPage, currentPercentage, notes, sessionId } = body;

    const book = await bookRepository.findById(parseInt(params.id));
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Get last progress to calculate pages read
    const lastProgress = await progressRepository.findLatestByBookId(book.id);

    // Calculate percentage from pages if needed
    let finalPercentage = currentPercentage;
    if (currentPage !== undefined && book.totalPages) {
      finalPercentage = (currentPage / book.totalPages) * 100;
    }

    const pagesRead = lastProgress
      ? Math.max(0, currentPage - (lastProgress.currentPage || 0))
      : currentPage;

    // Create progress log
    const progressLog = await progressRepository.create({
      bookId: book.id,
      sessionId,
      currentPage,
      currentPercentage: finalPercentage,
      progressDate: new Date(),
      notes,
      pagesRead,
    });

    // Auto-update streak on any progress
    await updateStreaks();

    // Auto-mark as read if 100%
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
**Key Pattern:** Progress links to specific reading session via `sessionId`
**Repository Methods:**
- `bookRepository.findById()` - Get book for page calculations
- `progressRepository.findLatestByBookId()` - Calculate pages read
- `progressRepository.create()` - Save progress log
- `sessionRepository.findActiveByBookId()` - Get active session
- `sessionRepository.update()` - Mark as read when complete

---

### 5. Streak Calculation Logic (Repository-Based)

```typescript
// lib/streaks.ts
import { streakRepository } from "@/lib/repositories/streak.repository";
import { differenceInDays, startOfDay } from "date-fns";

export async function updateStreaks(userId?: string): Promise<Streak> {
  let streak = await streakRepository.getActiveStreak();

  if (!streak) {
    // Create initial streak
    streak = await streakRepository.upsertStreak({
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      streakStartDate: new Date(),
      totalDaysActive: 1,
    });
    return streak;
  }

  const today = startOfDay(new Date());
  const lastActivity = startOfDay(new Date(streak.lastActivityDate));

  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day: no change
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day: increment
    const updatedStreak = await streakRepository.upsertStreak({
      currentStreak: streak.currentStreak + 1,
      longestStreak: Math.max(
        streak.longestStreak,
        streak.currentStreak + 1
      ),
      totalDaysActive: streak.totalDaysActive + 1,
      lastActivityDate: today,
    });
    return updatedStreak;
  } else if (daysDiff > 1) {
    // Streak broken: reset
    const updatedStreak = await streakRepository.upsertStreak({
      currentStreak: 1,
      streakStartDate: today,
      totalDaysActive: streak.totalDaysActive + 1,
      lastActivityDate: today,
      longestStreak: streak.longestStreak,  // Keep longest
    });
    return updatedStreak;
  }

  return streak;
}
```
**Key Logic:** Uses `startOfDay()` to normalize dates - activity at any time on Day 1 + any time on Day 2 = consecutive streak
**Repository Methods:**
- `streakRepository.getActiveStreak()` - Get current streak (singleton)
- `streakRepository.upsertStreak()` - Create or update streak

---

### 6. API Route Patterns (Repository-Based)

#### Books with Filters and Pagination
```typescript
// app/api/books/route.ts - GET
import { NextRequest, NextResponse } from "next/server";
import { bookRepository } from "@/lib/repositories/book.repository";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      tags: searchParams.get("tags")?.split(",") || undefined,
      rating: searchParams.get("rating") || undefined,
      showOrphaned: searchParams.get("showOrphaned") === "true",
    };

    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");
    const sortBy = searchParams.get("sortBy") || undefined;

    // Single repository call with all filters
    const { books, total } = await bookRepository.findWithFilters(
      filters,
      limit,
      skip,
      sortBy
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
**Performance:** Repository handles complex filtering and joining internally, avoiding N+1 queries

#### Update Book Status
```typescript
// app/api/books/[id]/status/route.ts - POST
import { sessionRepository } from "@/lib/repositories/session.repository";

export async function POST(request: NextRequest, { params }) {
  try {
    const body = await request.json();
    const { status, review, startedDate, completedDate } = body;

    const bookId = parseInt(params.id);

    // Get or create active session
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

    // Auto-set dates based on status
    const updateData: any = { status };

    if (status === "reading" && !session.startedDate) {
      updateData.startedDate = startedDate || new Date();
    }

    if (status === "read") {
      if (!session.startedDate) {
        updateData.startedDate = startedDate || new Date();
      }
      updateData.completedDate = completedDate || new Date();
    }

    if (review !== undefined) {
      updateData.review = review;
    }

    const updated = await sessionRepository.update(session.id, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating status:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
```
**Repository Methods:**
- `findActiveByBookId()` - Get active session
- `getNextSessionNumber()` - For re-reading support
- `create()` - Create new session
- `update()` - Update session data

---

### 7. Calibre Metadata Extraction

#### SQL Query Pattern with Optional Columns
```typescript
// lib/db/calibre.ts - getAllBooks()
const columns = db.prepare("PRAGMA table_info(books)").all();
const columnNames = columns.map(c => c.name);

const hasPublisher = columnNames.includes('publisher');
const hasSeries = columnNames.includes('series');

// Conditionally include columns in query
const query = `
  SELECT
    b.id,
    b.title,
    b.timestamp,
    ${hasSeries ? 'b.series_index,' : 'NULL as series_index,'}
    ${hasPublisher ? 'p.name' : 'NULL'} as publisher,
    ${hasSeries ? 's.name' : 'NULL'} as series,
    GROUP_CONCAT(DISTINCT a.name) as authors,
    GROUP_CONCAT(DISTINCT i.val) as isbn
  FROM books b
  LEFT JOIN books_authors_link bal ON b.id = bal.book
  LEFT JOIN authors a ON bal.author = a.id
  ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
  ${hasSeries ? 'LEFT JOIN series s ON b.series = s.id' : ''}
  LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
  GROUP BY b.id
`;

return db.prepare(query).all();
```
**Why Dynamic Columns:** Different Calibre versions have different schema. Check first, then include in query.

---

### 8. Serve Cover Images Securely

```typescript
// app/api/covers/[...path]/route.ts
export async function GET(request, { params }) {
  const libraryPath = path.dirname(CALIBRE_DB_PATH);
  const filePath = path.join(libraryPath, ...params.path);

  // SECURITY: Validate path stays in library
  const resolvedPath = path.resolve(filePath);
  const resolvedLibrary = path.resolve(libraryPath);

  if (!resolvedPath.startsWith(resolvedLibrary)) {
    return NextResponse.json(
      { error: "Invalid path" },
      { status: 403 }
    );
  }

  if (!existsSync(resolvedPath)) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: 404 }
    );
  }

  const imageBuffer = readFileSync(resolvedPath);
  
  // Determine MIME type
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }[ext] || 'image/jpeg';

  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```
**Security:** Path normalization check prevents directory traversal attacks

---

### 9. Reading Status State Machine (Repository-Based)

```typescript
// app/api/books/[id]/status/route.ts - POST
import { sessionRepository } from "@/lib/repositories/session.repository";
import { bookRepository } from "@/lib/repositories/book.repository";
import { updateCalibreRating } from "@/lib/db/calibre-write";

const updateData: any = { status };

// Auto-set dates based on status transitions
if (status === "reading" && !session?.startedDate) {
  updateData.startedDate = startedDate || new Date();
}

if (status === "read") {
  if (!session?.startedDate) {
    updateData.startedDate = startedDate || new Date();
  }
  updateData.completedDate = completedDate || new Date();
}

if (review !== undefined) {
  updateData.review = review;
}

// Rating is stored on book (not session)
if (rating !== undefined) {
  // Update Tome database
  await bookRepository.update(bookId, { rating });

  // Sync to Calibre database (ratings only)
  const book = await bookRepository.findById(bookId);
  if (book?.calibreId) {
    await updateCalibreRating(book.calibreId, rating);
  }
}

// Update or create session
if (session) {
  const updated = await sessionRepository.update(session.id, updateData);
  return updated;
} else {
  const nextNumber = await sessionRepository.getNextSessionNumber(bookId);
  const created = await sessionRepository.create({
    bookId,
    sessionNumber: nextNumber,
    isActive: true,
    ...updateData,
  });
  return created;
}
```
**State Logic:**
- "to-read" → no dates
- "reading" → startedDate set (if not already)
- "read" → both startedDate and completedDate set

**Rating Logic:**
- Ratings stored on book (books.rating), not session
- Ratings synced to Calibre database via updateCalibreRating()
- Reviews stored on session

---

### 10. Client-Side Data Fetching Patterns

#### Server Component (Cached Data)
```typescript
// app/page.tsx
async function getStats() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/stats/overview`, {
      cache: "no-store",  // Always fresh, no caching
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return null;
  }
}

export default async function Dashboard() {
  const stats = await getStats();
  // Render with stats
}
```
**Pattern:** Server components fetch during SSR, no loading states needed

#### Client Component (Reactive)
```typescript
// app/library/page.tsx
"use client";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooks();
  }, [statusFilter]);  // Re-fetch when filter changes

  async function fetchBooks() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/books?${params.toString()}`);
      const data = await response.json();
      setBooks(data.books || []);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Render with loading state, show books
  );
}
```
**Pattern:** Client components manage loading state, respond to user interactions

#### Client Service Layer Pattern (Library Page)
```typescript
// lib/library-service.ts - Client-side service with caching
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
}

export const libraryService = new LibraryService(); // Singleton

// hooks/useLibraryData.ts - State management hook
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
      pagination: { skip: filters.pagination.skip + 50, limit: 50 },
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
    setSearch,
    setStatus,
    setTags,
  };
}

// app/library/page.tsx - Page orchestration (135 lines, down from 485)
"use client";

export default function LibraryPage() {
  const { books, total, hasMore, loading, loadMore, setSearch, setStatus } = 
    useLibraryData({ status: searchParams.get("status") || undefined });
  
  return (
    <>
      <LibraryHeader totalBooks={total} />
      <LibraryFilters onSearchChange={setSearch} onStatusChange={setStatus} />
      <BookGrid books={books} loading={loading} />
    </>
  );
}
```

**Architecture:** Page → Hook → Service → API → Database

**Key Points:**
- **Singleton Service:** Single instance with in-memory cache
- **Smart hasMore:** `skip + books.length < total` (not `books.length === limit`)
- **Cache Invalidation:** Clear after sync or mutations
- **Pagination Reset:** Reset skip=0 when filters change
- **Integration Tests:** Mock fetch to call actual API handlers

---

## Re-Reading Feature Implementation

### Overview
The re-reading feature allows users to read books multiple times with separate tracking for each reading session.

### Key Patterns

#### 1. Creating a New Reading Session (Re-read)
```typescript
// POST /api/books/:id/reread
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

  // 1. Find and validate active session
  const activeSession = await ReadingSession.findOne({
    bookId: params.id,
    isActive: true,
  });

  if (!activeSession || activeSession.status !== "read") {
    return NextResponse.json({ error: "Can only re-read completed books" }, { status: 400 });
  }

  // 2. Archive current session
  activeSession.isActive = false;
  await activeSession.save();

  // 3. Create new session
  const newSession = new ReadingSession({
    userId: activeSession.userId,
    bookId: params.id,
    sessionNumber: activeSession.sessionNumber + 1,
    status: "reading",
    startedDate: new Date(),
    isActive: true,
  });
  await newSession.save();

  // 4. Rebuild streak from all progress logs
  await rebuildStreak();

  return NextResponse.json({ session: newSession });
}
```

#### 2. Linking Progress to Active Session
```typescript
// POST /api/books/:id/progress
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

  // Get active session (critical for re-reading)
  const activeSession = await ReadingSession.findOne({
    bookId: params.id,
    isActive: true,
  });

  if (!activeSession) {
    return NextResponse.json(
      { error: "No active reading session found" },
      { status: 400 }
    );
  }

  // Link progress to active session
  const progressLog = await ProgressLog.create({
    bookId: params.id,
    sessionId: activeSession._id,  // Critical link
    currentPage,
    currentPercentage,
    progressDate: new Date(),
    notes,
    pagesRead,
  });

  // Update streak (counts all sessions)
  await updateStreaks();

  return NextResponse.json(progressLog);
}
```

#### 3. Fetching Session-Specific Progress
```typescript
// GET /api/books/:id/progress?sessionId=...
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  await connectDB();

  const sessionId = request.nextUrl.searchParams.get("sessionId");

  let query: any = { bookId: params.id };

  if (sessionId) {
    // Get progress for specific session
    query.sessionId = sessionId;
  } else {
    // Get progress for active session only
    const activeSession = await ReadingSession.findOne({
      bookId: params.id,
      isActive: true,
    });

    if (activeSession) {
      query.sessionId = activeSession._id;
    }
  }

  const progressLogs = await ProgressLog.find(query).sort({ progressDate: -1 });
  return NextResponse.json(progressLogs);
}
```

#### 4. Rebuilding Streaks After Re-read
```typescript
// lib/streaks.ts
export async function rebuildStreak(userId?: string): Promise<IStreak> {
  await connectDB();

  // Get ALL progress logs (across all sessions and books)
  const progressLogs = await ProgressLog.find({ userId: userId || null })
    .sort({ progressDate: 1 })
    .lean();

  // Extract unique dates
  const uniqueDatesSet = new Set<string>();
  progressLogs.forEach((log) => {
    const dateStr = startOfDay(new Date(log.progressDate)).toISOString();
    uniqueDatesSet.add(dateStr);
  });

  const uniqueDates = Array.from(uniqueDatesSet)
    .map((dateStr) => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());

  // Calculate current streak (backwards from most recent)
  let currentStreak = 0;
  const today = startOfDay(new Date());
  const lastActivityDate = uniqueDates[uniqueDates.length - 1];
  const daysSinceLastActivity = differenceInDays(today, lastActivityDate);

  if (daysSinceLastActivity <= 1) {
    currentStreak = 1;
    // Walk backwards to find consecutive days
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const diff = differenceInDays(uniqueDates[i + 1], uniqueDates[i]);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = currentStreak;
  let tempStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const diff = differenceInDays(uniqueDates[i], uniqueDates[i - 1]);
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  // Update streak record
  const streak = await Streak.findOneAndUpdate(
    { userId: userId || null },
    {
      currentStreak,
      longestStreak,
      lastActivityDate,
      totalDaysActive: uniqueDates.length,
    },
    { upsert: true, new: true }
  );

  return streak;
}
```

#### 5. Displaying Reading History (Frontend)
```typescript
// components/ReadingHistoryTab.tsx
export default function ReadingHistoryTab({ bookId }: { bookId: string }) {
  const [sessions, setSessions] = useState<ReadingSession[]>([]);

  useEffect(() => {
    async function fetchSessions() {
      const response = await fetch(`/api/books/${bookId}/sessions`);
      const data = await response.json();

      // Filter to show only archived sessions
      const archivedSessions = data.filter((s: ReadingSession) => !s.isActive);
      setSessions(archivedSessions);
    }

    fetchSessions();
  }, [bookId]);

  if (sessions.length === 0) return null;

  return (
    <div>
      <h2>Reading History</h2>
      {sessions.map((session) => (
        <div key={session._id}>
          <h3>Read #{session.sessionNumber}</h3>
          <p>Started: {session.startedDate}</p>
          <p>Completed: {session.completedDate}</p>
          <p>Review: {session.review}</p>
          <p>Total Progress Entries: {session.progressSummary.totalEntries}</p>
        </div>
      ))}
    </div>
  );
}
```

### Data Migration Pattern
```bash
# scripts/migrateToSessions.ts

# 1. Create backup
const backup = {
  timestamp: new Date().toISOString(),
  readingSessions: await ReadingSession.find({}).lean(),
  progressLogs: await ProgressLog.find({}).lean(),
};
fs.writeFileSync(backupFile, JSON.stringify(backup));

# 2. Migrate each status to session
for (const status of readingStatuses) {
  const session = new ReadingSession({
    userId: status.userId,
    bookId: status.bookId,
    sessionNumber: 1,  // First read
    status: status.status,
    startedDate: status.startedDate,
    completedDate: status.completedDate,
    rating: status.rating,
    review: status.review,
    isActive: true,
  });
  await session.save();

  # 3. Link progress logs to new session
  await ProgressLog.updateMany(
    { bookId: status.bookId },
    { $set: { sessionId: session._id } }
  );
}
```

### Important Constraints
1. **Only one active session per book:** Enforced by partial unique index on `(bookId, isActive=true)`
2. **Progress requires active session:** Progress logging fails if no active session exists
3. **Re-read requires completed session:** Can only start re-read when active session status is "read"
4. **Streak continuity:** All progress logs count toward streaks regardless of which session they belong to

---

## Environment Variables Reference

```bash
# REQUIRED: Calibre Integration
CALIBRE_DB_PATH=/path/to/calibre/library/metadata.db

# REQUIRED: MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/tome
# For Docker Compose: mongodb://mongodb:27017/tome

# OPTIONAL: Application Config
PORT=3000
NODE_ENV=development|production
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# OPTIONAL: Features (Future)
ENABLE_AUTH=false
NEXT_PUBLIC_CALIBRE_DB_PATH=  # Expose path to frontend if needed
NEXT_PUBLIC_MONGODB_URI=      # Only safe if no auth required
```

**Note:** NEXT_PUBLIC_* variables are exposed to browser. Never put secrets here.

---

## Database Indexes Quick Reference

### Book Collection
```
- unique: calibreId
- text search: title, authors
- implicit index on _id
```

### ReadingSession Collection
```
- unique compound: (userId, bookId)
- index: bookId
- index: status
```

### ProgressLog Collection
```
- compound: (bookId, progressDate DESC)
- compound: (userId, progressDate DESC)
- index: progressDate DESC
```

### Streak Collection
```
- unique: userId
```

**Index Strategy:** Covers query patterns used in filters and sorts. Avoid index explosion.

---

## Common Issues & Solutions

### Issue: "CALIBRE_DB_PATH not configured"
**Cause:** Environment variable not set
**Solution:** 
```bash
cp .env.example .env
# Edit .env and set CALIBRE_DB_PATH
# Restart server (changes to .env require restart)
```

### Issue: Sync hangs or takes very long
**Cause:** Large library or concurrent sync attempts
**Solution:**
- Check `isSyncInProgress()` - only one sync at a time
- Check file watcher debounce isn't interfering
- Monitor database performance during sync

### Issue: Progress logs not updating streak
**Cause:** `updateStreaks()` not called
**Solution:** Verify POST /api/books/:id/progress calls `await updateStreaks()`

### Issue: Cover images 404
**Cause:** Incorrect path construction or security check failing
**Solution:**
1. Verify CALIBRE_DB_PATH points to metadata.db (not library folder)
2. Check library folder permissions
3. Look at server logs for path resolution debugging

### Issue: Streak not resetting on gap
**Cause:** `startOfDay()` normalization or date boundary issue
**Solution:** Verify `differenceInDays()` is comparing normalized dates

---

## Performance Optimization Tips

1. **Use MongoDB Aggregation:** For stats/analytics, use aggregation pipeline instead of client-side processing
2. **Add Pagination:** Limit results with skip/limit for large datasets
3. **Cache Calibre Data:** LastSynced timestamp indicates freshness
4. **Lazy Load Book Details:** Don't fetch full book data in list views
5. **Batch Operations:** Use bulkWrite for multiple sync operations
6. **Query Optimization:** Use projection to fetch only needed fields

---

## Testing Checklist

### Manual Testing
- [ ] Sync works with Calibre library
- [ ] Books appear after sync
- [ ] Can change reading status
- [ ] Progress logging updates percentage correctly
- [ ] Streak increments on consecutive days
- [ ] Stats show correct numbers
- [ ] Cover images load
- [ ] Search/filter works
- [ ] Multiple progress entries show in history
- [ ] Pagination works on library page

### Deployment Testing
- [ ] Docker build succeeds
- [ ] Volumes mounted correctly
- [ ] MongoDB connection works
- [ ] CALIBRE_DB_PATH accessible from container
- [ ] Auto-sync runs on startup
- [ ] File changes trigger sync
- [ ] Graceful shutdown works

