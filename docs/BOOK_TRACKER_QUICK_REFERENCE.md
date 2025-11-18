# Book Tracker - Quick Reference & Code Snippets

## Critical Code Sections

### 1. Database Connection Patterns

#### MongoDB Connection (Singleton)
```typescript
// lib/db/mongodb.ts
export async function connectDB() {
  if (cached.conn) {
    return cached.conn;  // Return cached connection
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
```
**Key Point:** Always call `await connectDB()` before Mongoose queries in API routes

#### Calibre DB Connection
```typescript
// lib/db/calibre.ts
export function getCalibreDB() {
  if (!db) {
    db = new Database(CALIBRE_DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
  }
  return db;
}
```
**Key Point:** Read-only SQLite with path validation essential

---

### 2. Syncing Flow

#### Main Sync Process
```typescript
// lib/sync-service.ts
export async function syncCalibreLibrary(): Promise<SyncResult> {
  if (isSyncing) return SYNC_IN_PROGRESS_ERROR;
  
  isSyncing = true;
  try {
    await connectDB();
    const calibreBooks = getAllBooks();
    
    for (const calibreBook of calibreBooks) {
      const tags = getBookTags(calibreBook.id);

      const existingBook = await Book.findOne({ 
        calibreId: calibreBook.id 
      });

      if (existingBook) {
        // Update existing
        await Book.findByIdAndUpdate(existingBook._id, bookData);
        updatedCount++;
      } else {
        // Create new
        await Book.create(bookData);
        syncedCount++;
      }
    }
    
    lastSyncTime = new Date();
    return { success: true, syncedCount, updatedCount, totalBooks };
  } finally {
    isSyncing = false;  // Always reset flag
  }
}
```
**Key Pattern:** Try/finally ensures isSyncing is always reset
**Note:** Cover paths are now generated dynamically in UI components using `calibreId`

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

#### Progress Logging with Streak Update
```typescript
// app/api/books/[id]/progress/route.ts
export async function POST(request, { params }) {
  const body = await request.json();
  const { currentPage, currentPercentage, notes } = body;
  
  const book = await Book.findById(params.id);
  const lastProgress = await ProgressLog.findOne({ bookId: params.id })
    .sort({ progressDate: -1 });

  // Calculate percentage from pages if needed
  let finalPercentage = currentPercentage;
  if (currentPage !== undefined && book.totalPages) {
    finalPercentage = (currentPage / book.totalPages) * 100;
  }

  const pagesRead = lastProgress 
    ? Math.max(0, currentPage - (lastProgress.currentPage || 0))
    : currentPage;

  const progressLog = await ProgressLog.create({
    bookId: params.id,
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
    const status = await ReadingStatus.findOne({ bookId: params.id });
    if (status && status.status !== "read") {
      status.status = "read";
      status.completedDate = new Date();
      await status.save();
    }
  }

  return NextResponse.json(progressLog);
}
```
**Important:** Always update streak when progress is logged, even same-day logs trigger streak updates

---

### 5. Streak Calculation Logic

```typescript
// lib/streaks.ts
export async function updateStreaks(userId?: string): Promise<IStreak> {
  let streak = await Streak.findOne({ userId: userId || null });
  
  const today = startOfDay(new Date());
  const lastActivity = startOfDay(new Date(streak.lastActivityDate));
  
  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day: no change
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day: increment
    streak.currentStreak += 1;
    streak.longestStreak = Math.max(
      streak.longestStreak,
      streak.currentStreak
    );
    streak.totalDaysActive += 1;
  } else if (daysDiff > 1) {
    // Streak broken: reset
    streak.currentStreak = 1;
    streak.streakStartDate = today;
    streak.totalDaysActive += 1;
  }

  streak.lastActivityDate = today;
  await streak.save();
  return streak;
}
```
**Key Logic:** Uses `startOfDay()` to normalize dates - activity at any time on Day 1 + any time on Day 2 = consecutive streak

---

### 6. API Route Patterns

#### Query Joining Pattern (Books with Status)
```typescript
// app/api/books/route.ts - GET
const statusRecords = await ReadingStatus.find({ status }).select("bookId");
const bookIds = statusRecords.map(s => s.bookId);
const books = await Book.find({ _id: { $in: bookIds } });

// Enrich with status data
const booksWithStatus = await Promise.all(
  books.map(async (book) => {
    const status = await ReadingStatus.findOne({ bookId: book._id });
    return {
      ...book.toObject(),
      status: status?.status || null,
      rating: status?.rating,
    };
  })
);
```
**Performance Note:** This requires N+1 queries (N books need N status lookups). For large libraries, consider using MongoDB aggregate pipeline instead.

#### Aggregation Pipeline (Stats)
```typescript
// app/api/stats/overview/route.ts
const pagesReadTotal = await ProgressLog.aggregate([
  {
    $group: {
      _id: null,
      total: { $sum: "$pagesRead" },
    },
  },
]);

const pagesReadThisYear = await ProgressLog.aggregate([
  {
    $match: { progressDate: { $gte: yearStart } },
  },
  {
    $group: {
      _id: null,
      total: { $sum: "$pagesRead" },
    },
  },
]);
```
**Better for large data:** Aggregation pipelines perform calculations on database side, reducing data transfer

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

### 9. Reading Status State Machine

```typescript
// app/api/books/[id]/status/route.ts - POST
const updateData: any = { status };

if (status === "reading" && !readingStatus?.startedDate) {
  updateData.startedDate = startedDate || new Date();
}

if (status === "read") {
  if (!updateData.startedDate && !readingStatus?.startedDate) {
    updateData.startedDate = startedDate || new Date();
  }
  updateData.completedDate = completedDate || new Date();
}

if (rating !== undefined) {
  updateData.rating = rating;
}

if (readingStatus) {
  readingStatus = await ReadingStatus.findByIdAndUpdate(
    readingStatus._id,
    updateData,
    { new: true }
  );
} else {
  readingStatus = await ReadingStatus.create({
    bookId: params.id,
    ...updateData,
  });
}
```
**State Logic:**
- "to-read" → no dates
- "reading" → startedDate set (if not already)
- "read" → both startedDate and completedDate set

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

### ReadingStatus Collection
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

