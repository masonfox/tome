> **⚠️ DEPRECATED - Archived November 24, 2025**
>
> This document has been consolidated into [`/docs/ARCHITECTURE.md`](../ARCHITECTURE.md).
>
> **Current Documentation:**
> - **Architecture & Patterns**: [`/docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
> - **Detailed Patterns**: [`/.specify/memory/patterns.md`](../../.specify/memory/patterns.md)
> - **Coding Standards**: [`/docs/AI_CODING_PATTERNS.md`](../AI_CODING_PATTERNS.md)
>
> This file is preserved for historical reference only.

---

# Book Tracker Architecture Documentation

> **📌 MIGRATION STATUS:** This project has completed migration from MongoDB to SQLite (see `docs/SQLITE_MIGRATION_STATUS.md`). The architecture below reflects the **current SQLite + Drizzle ORM + Repository Pattern implementation**. Some sections may reference MongoDB as historical context but are marked as legacy.

## Overview
Book Tracker is a full-stack reading companion application built with Next.js 14 that integrates with Calibre digital libraries. It enables users to track reading progress, maintain reading streaks, and visualize reading statistics while syncing metadata from their Calibre library.

**Tech Stack:**
- **Frontend:** Next.js 14 (React 18) with TypeScript
- **Backend:** Next.js API Routes (Node.js runtime)
- **Databases:**
  - **Tome Database:** SQLite + Drizzle ORM (tracking data: books, sessions, progress, streaks)
  - **Calibre Database:** SQLite (read-only, metadata.db from Calibre library)
- **Data Access:** Repository Pattern (lib/repositories/)
- **UI:** Tailwind CSS + Lucide React icons
- **Runtime:** Node.js (dev) / Bun (production)
- **Package Manager:** Bun
- **SQLite Adapters:** Database factory pattern (better-sqlite3 for Node.js / bun:sqlite for Bun)
- **Charts:** Recharts
- **Deployment:** Docker + Docker Compose
- **Testing:** Bun test runner (295 tests passing)

---

## 1. OVERALL ARCHITECTURE

### Directory Structure
```
/tome
├── /app                      # Next.js App Router
│   ├── /api                  # API routes (RESTful endpoints)
│   ├── page.tsx             # Dashboard home page
│   ├── /library             # Library browsing page
│   ├── /books/[id]          # Book detail page
│   ├── /stats               # Statistics and streaks page
│   ├── /settings            # Settings and Calibre configuration
│   └── layout.tsx           # Root layout with navigation
├── /lib                      # Core business logic and services
│   ├── /db                   # Database layer
│   │   ├── /schema           # Drizzle ORM schemas
│   │   │   ├── books.ts      # Books table schema
│   │   │   ├── reading-sessions.ts  # Sessions table schema
│   │   │   ├── progress-logs.ts     # Progress table schema
│   │   │   └── streaks.ts           # Streaks table schema
│   │   ├── sqlite.ts         # Tome database (Drizzle instance)
│   │   ├── calibre.ts        # Calibre SQLite reader (read-only)
│   │   ├── calibre-write.ts  # Calibre write operations (ratings only)
│   │   └── context.ts        # Database context for test isolation
│   ├── /repositories         # Repository pattern (data access layer)
│   │   ├── base.repository.ts    # Base CRUD operations
│   │   ├── book.repository.ts    # Book data access
│   │   ├── session.repository.ts # Session data access
│   │   ├── progress.repository.ts  # Progress data access
│   │   └── streak.repository.ts    # Streak data access
│   ├── sync-service.ts       # Calibre library sync logic
│   ├── calibre-watcher.ts    # File system watcher for auto-sync
│   ├── library-service.ts    # Client-side library data service
│   ├── dashboard-service.ts  # Dashboard statistics service
│   └── streaks.ts            # Reading streak calculations
├── /models                   # LEGACY - Mongoose schemas (being phased out)
├── /hooks                    # Custom React hooks
│   └── useLibraryData.ts     # Library state management hook
├── /components               # React components
├── /utils                    # Utility functions
├── /drizzle                  # Drizzle migrations
│   ├── /meta                 # Migration metadata
│   └── 000X_migration.sql    # SQL migration files
├── instrumentation.ts        # Next.js instrumentation hook
├── drizzle.config.ts         # Drizzle ORM configuration
├── package.json              # Dependencies and scripts
├── next.config.js            # Next.js configuration
├── docker-compose.yml        # Docker services definition
└── Dockerfile                # Container build instructions
```

---

## 2. DATABASE SCHEMA AND RELATIONSHIPS

> **Note:** This project uses **SQLite** with **Drizzle ORM** for the Tome database (tracking data). Calibre continues to use its own separate SQLite database.

### Tome Database (SQLite + Drizzle ORM)

**Location:** `lib/db/schema/` (Drizzle schemas)

#### Books Table (`lib/db/schema/books.ts`)
**Purpose:** Stores metadata of books synced from Calibre

**Schema:**
```typescript
export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  calibreId: integer("calibre_id").notNull().unique(),
  title: text("title").notNull(),
  authors: text("authors", { mode: "json" }).$type<string[]>(),  // JSON array
  isbn: text("isbn"),
  totalPages: integer("total_pages"),
  addedToLibrary: integer("added_to_library", { mode: "timestamp" }),
  lastSynced: integer("last_synced", { mode: "timestamp" }),
  publisher: text("publisher"),
  pubDate: integer("pub_date", { mode: "timestamp" }),
  series: text("series"),
  seriesIndex: real("series_index"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),  // JSON array
  path: text("path").notNull(),
  description: text("description"),
  rating: integer("rating"),  // 1-5 stars, synced from Calibre
  orphaned: integer("orphaned", { mode: "boolean" }),
  orphanedAt: integer("orphaned_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
```

**Indexes:**
- Unique constraint on `calibreId`

**Repository:** `bookRepository` (lib/repositories/book.repository.ts)

---

#### Reading Sessions Table (`lib/db/schema/reading-sessions.ts`)
**Purpose:** Tracks reading sessions per book (supports re-reading)

**Schema:**
```typescript
export const readingSessions = sqliteTable("reading_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),  // Nullable for single-user mode
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  sessionNumber: integer("session_number").notNull(),
  status: text("status", {
    enum: ["to-read", "read-next", "reading", "read"],
  }),
  startedDate: integer("started_date", { mode: "timestamp" }),
  completedDate: integer("completed_date", { mode: "timestamp" }),
  review: text("review"),
  isActive: integer("is_active", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
```

**Indexes:**
- Unique compound index on (bookId, sessionNumber)
- Partial unique index on (bookId) WHERE isActive=1 (only one active session per book)
- Index on bookId
- Index on status
- Index on (userId, bookId)

**Repository:** `sessionRepository` (lib/repositories/session.repository.ts)

**Re-reading Support:**
- Users can read the same book multiple times
- Each reading session has a sessionNumber (1, 2, 3...)
- Only one session can be active (isActive=1) at a time
- Previous sessions are archived (isActive=0)

---

#### Progress Logs Table (`lib/db/schema/progress-logs.ts`)
**Purpose:** Tracks individual reading progress entries per session

**Schema:**
```typescript
export const progressLogs = sqliteTable("progress_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),  // Nullable for single-user mode
  bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => readingSessions.id, { onDelete: "cascade" }),
  currentPage: integer("current_page"),
  currentPercentage: real("current_percentage"),  // 0-100
  progressDate: integer("progress_date", { mode: "timestamp" }),
  notes: text("notes"),
  pagesRead: integer("pages_read"),
  createdAt: integer("created_at", { mode: "timestamp" }),
});
```

**Indexes:**
- Index on (bookId, progressDate DESC)
- Index on (sessionId, progressDate DESC)
- Index on (userId, progressDate DESC)
- Index on progressDate DESC

**Constraints:**
- currentPage >= 0
- currentPercentage >= 0 AND currentPercentage <= 100
- pagesRead >= 0

**Repository:** `progressRepository` (lib/repositories/progress.repository.ts)

---

#### Streaks Table (`lib/db/schema/streaks.ts`)
**Purpose:** Tracks reading consistency streaks

**Schema:**
```typescript
export const streaks = sqliteTable("streaks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),  // Nullable for single-user mode
  currentStreak: integer("current_streak"),
  longestStreak: integer("longest_streak"),
  lastActivityDate: integer("last_activity_date", { mode: "timestamp" }),
  streakStartDate: integer("streak_start_date", { mode: "timestamp" }),
  totalDaysActive: integer("total_days_active"),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
```

**Indexes:**
- Unique index on COALESCE(userId, -1) (singleton pattern: one streak per user)

**Repository:** `streakRepository` (lib/repositories/streak.repository.ts)

---

### Relationship Diagram
```
Book (synced from Calibre)
├── ReadingSession (1:many per book - supports re-reading)
│   ├── sessionNumber (1, 2, 3...)
│   ├── isActive (only one active session per book)
│   ├── status, dates, review
│   └── ProgressLog (1:many per session)
│       └── sessionId links progress to specific reading session
└── Streak (global - aggregated from all ProgressLog entries across all sessions)
    └── Calculated streak metrics (all sessions count toward streaks)
```

**Key Relationships:**
- One Book can have multiple ReadingSessions (for re-reading)
- Foreign key: readingSessions.bookId → books.id (CASCADE DELETE)
- Only one ReadingSession per book can be active (isActive=1)
- Foreign key: progressLogs.bookId → books.id (CASCADE DELETE)
- Foreign key: progressLogs.sessionId → readingSessions.id (CASCADE DELETE)
- Each ProgressLog entry links to a specific ReadingSession
- Streaks are calculated from ALL progress logs across ALL sessions and books

### Repository Pattern

**All database access goes through repositories:**
- `bookRepository` - Book queries and filtering
- `sessionRepository` - Session management
- `progressRepository` - Progress tracking
- `streakRepository` - Streak calculations

**See:** `docs/REPOSITORY_PATTERN_GUIDE.md` for detailed repository documentation

---

## 3. CALIBRE INTEGRATION

### How Calibre Integration Works

#### Calibre Database Structure
- **Type:** SQLite database (metadata.db)
- **Location:** Root of Calibre library folder
- **Tables Used:**
  - `books` - Main book records
  - `books_authors_link` - Junction table
  - `authors` - Author information
  - `books_tags_link` - Junction table
  - `tags` - Tag/category information
  - `publishers` - Publisher information (optional)
  - `series` - Series information (optional)
  - `identifiers` - ISBN and other identifiers

#### Calibre Reader (`/lib/db/calibre.ts`)
**Purpose:** Read-only SQLite interface to Calibre database

**Database Factory Pattern:**
- Uses `lib/db/factory.ts` for SQLite driver abstraction
- Automatically detects runtime environment (Node.js vs Bun)
- Uses `better-sqlite3` in Node.js (dev mode)
- Uses `bun:sqlite` in Bun runtime (production)
- Centralizes driver selection and PRAGMA configuration
- Enables automatic sync in both dev and production

**Key Functions:**
- `getCalibreDB()` - Singleton connection manager (read-only)
- `getAllBooks()` - Fetch all books with metadata
- `getBookById(id)` - Get specific book details
- `searchBooks(query)` - Full-text search by title/author
- `getBookTags(bookId)` - Fetch tags for a book

**Query Strategy:**
- Uses SQL JOINs to gather related data
- Dynamically checks for optional columns (publisher, series)
- Groups results to handle many-to-many relationships
- Returns structured CalibreBook interface

**Cover Image Handling:**
- Calibre stores cover.jpg in book folders
- Cover API route (`/api/covers/[id]`) constructs paths dynamically using `calibreId`
- No cover paths stored in database - generated on-demand in UI components

---

### Sync Service (`/lib/sync-service.ts`)

**Process:**
1. Connects to both Tome database (SQLite) and Calibre database (SQLite)
2. Fetches all books from Calibre using `getAllBooks()`
3. For each book:
   - Extracts metadata (title, authors, ISBN, tags, rating, etc.)
   - Checks if book exists in Tome database (by calibreId) using `bookRepository`
   - Creates new Book or updates existing one via `bookRepository`
4. Marks books not in Calibre as "orphaned" (removed from Calibre library)
5. Tracks: syncedCount (new), updatedCount (existing), totalBooks
6. Updates lastSyncTime on success
7. Prevents concurrent syncs with isSyncing flag

**Sync Data Flow:**
```
Calibre SQLite Database
    ↓
getAllBooks() via lib/db/calibre.ts
    ↓
Book metadata with enriched data (authors, tags, rating)
    ↓
bookRepository.findByCalibreId() / create() / updateByCalibreId()
    ↓
Tome SQLite Database (books table)
    ↓
UI generates cover paths from calibreId dynamically
    ↓
UI displays books with Calibre metadata
```

---

## 4. AUTOMATIC SYNC MECHANISM

### Architecture
Two-layer automatic sync system:

#### 1. Calibre Watcher (`/lib/calibre-watcher.ts`)
**Class:** `CalibreWatcher` (Singleton)
**Purpose:** Monitor filesystem for Calibre database changes

**Features:**
- Uses Node.js `fs.watch()` API
- Tracks file modification timestamp (mtimeMs)
- Debounces rapid changes (2-second wait)
- Prevents concurrent sync operations
- Performs initial sync on startup

**Lifecycle:**
1. `start()` - Initialize watcher on server startup
2. Monitors CALIBRE_DB_PATH for changes
3. Debounce timer prevents excessive syncs when Calibre writes multiple times
4. `stop()` - Cleanup on SIGTERM/SIGINT

#### 2. Server Instrumentation (`/instrumentation.ts`)
**Hook Type:** Next.js Instrumentation Hook
**Trigger:** Server startup (Node.js runtime only)
**Works In:** Both development (Node.js) and production (Bun)

**Behavior:**
```typescript
if CALIBRE_DB_PATH is set:
    Detect runtime (Node.js or Bun)
    calibreWatcher.start(CALIBRE_DB_PATH, syncCalibreLibrary)
    Register SIGTERM/SIGINT handlers to stop watcher
    Log which SQLite adapter is being used

else:
    Log warning that auto-sync is disabled
```

**Result:** When a user adds/updates books in Calibre, the watcher detects changes and triggers `syncCalibreLibrary()` automatically. Works identically in both dev and production modes.

---

## 5. API ROUTES STRUCTURE

### Base URL: `/api`

#### Books Management

**GET /api/books**
- Fetch paginated book list
- Query params: `status`, `search`, `tags`, `limit`, `skip`, `showOrphaned`
- Returns: books array with active session status and book rating, total count
- Joins with active ReadingSession (isActive=true) for user data

**POST /api/books**
- Update book totalPages
- Body: `{ calibreId, totalPages }`
- Returns: updated book object

**GET /api/books/:id**
- Fetch single book with full details
- Returns: Book + active ReadingSession + latest ProgressLog for active session
- Includes: book metadata, current session status, current progress

**PATCH /api/books/:id**
- Update book (totalPages)
- Body: `{ totalPages }`
- Returns: updated book

---

#### Progress Tracking

**GET /api/books/:id/progress**
- Fetch progress logs for a book's active session (or specific session with `?sessionId=...`)
- Query params: `sessionId` (optional - defaults to active session)
- Sorted by progressDate descending
- Returns: array of ProgressLog entries for the session

**POST /api/books/:id/progress**
- Log reading progress for active session
- Body: `{ currentPage?, currentPercentage?, notes? }`
- Requires active ReadingSession to exist
- Calculates:
  - Final percentage from pages (if not provided)
  - Final pages from percentage (if not provided)
  - pagesRead as delta from last entry in this session
- Auto-updates active session status to "read" if 100% reached
- Links progress entry to active session via sessionId
- Triggers streak update (counts across all sessions)
- Returns: created ProgressLog

---

#### Session Management (Re-reading Support)

**GET /api/books/:id/status**
- Fetch active reading session for a book
- Returns: active ReadingSession (isActive=true) or null

**POST /api/books/:id/status**
- Update active reading session status
- Body: `{ status, rating?, review?, startedDate?, completedDate? }`
- Creates new session if none exists (auto-increments sessionNumber)
- Auto-sets dates when status changes:
  - "reading" → sets startedDate
  - "read" → sets completedDate
- Note: `rating` updates the book's rating (books.rating), not stored on session
- Returns: updated ReadingSession

**GET /api/books/:id/sessions**
- Fetch all reading sessions for a book (supports re-reading history)
- Returns: array of ReadingSession objects (sorted by sessionNumber desc)
- Each session includes:
  - Session metadata (sessionNumber, status, dates, review)
  - Progress summary (totalEntries, totalPagesRead, latestProgress, date range)

**POST /api/books/:id/reread**
- Start a new reading session for a book (re-reading)
- Requirements: active session must have status="read"
- Process:
  1. Archives current active session (sets isActive=false)
  2. Creates new session (sessionNumber++, status="reading", isActive=true)
  3. Rebuilds streak from all progress logs
- Returns: new session + archived session info

---

#### Statistics

**GET /api/stats/overview**
- Global reading statistics
- Returns:
  ```
  {
    booksRead: { total, thisYear, thisMonth },
    currentlyReading: number,
    pagesRead: { total, thisYear, thisMonth, today },
    avgPagesPerDay: number (last 30 days)
  }
  ```

**GET /api/stats/activity**
- Activity calendar and monthly breakdown
- Query params: `year`, `month` (optional)
- Returns:
  ```
  {
    calendar: [{ date: "YYYY-MM-DD", pagesRead }],
    monthly: [{ month, year, pagesRead }]
  }
  ```

---

#### Streaks

**GET /api/streaks**
- Get or create user streak record
- Returns: full Streak object
- Auto-creates if doesn't exist

---

#### Calibre Integration

**GET /api/calibre/sync**
- Manually trigger sync with Calibre
- Prevents concurrent syncs
- Returns:
  ```
  {
    success: boolean,
    message: string,
    syncedCount: number,
    updatedCount: number,
    totalBooks: number,
    lastSync: Date
  }
  ```

**GET /api/calibre/status**
- Get sync status without triggering sync
- Returns:
  ```
  {
    lastSync: Date | null,
    syncInProgress: boolean,
    autoSyncEnabled: boolean
  }
  ```

---

#### Cover Images

**GET /api/covers/:path*/**
- Stream book cover images from Calibre library
- Dynamic path based on book location in Calibre
- Security: validates path stays within library directory
- Caching: 1-year immutable cache headers
- Returns: image binary with appropriate Content-Type

---

## 6. RE-READING FEATURE

### Overview
The re-reading feature allows users to read the same book multiple times while preserving complete history of each reading session. Each re-read maintains separate progress tracking and reviews. Book ratings are stored at the book level (not per session).

### Architecture

**Reading Sessions:**
- Each book can have multiple `ReadingSession` records
- Only one session can be active (isActive=true) at a time
- Sessions are numbered sequentially (Read #1, Read #2, Read #3, etc.)
- Archived sessions preserve all historical data

**Progress Isolation:**
- Progress logs link to specific sessions via `sessionId`
- Each session has independent progress tracking
- Previous session progress remains intact when starting a new read

**Streak Continuity:**
- All progress logs from all sessions count toward reading streaks
- Re-reading doesn't reset or break streaks
- Streak is rebuilt from all progress logs when starting a re-read

### User Flow

1. **Complete First Read:**
   - User marks book as "Read" (status=read, completedDate set)
   - Can add book rating (stored on books.rating) and review (stored on session)
   - "Start Re-reading" button appears

2. **Start Re-reading:**
   - User clicks "Start Re-reading" button
   - API call to `POST /api/books/:id/reread`
   - Current session archived (isActive=false)
   - New session created (sessionNumber++, status=reading, isActive=true)
   - Streak recalculated from all progress logs

3. **Track New Progress:**
   - User logs progress as normal
   - Progress links to new active session
   - Previous session progress remains separate

4. **View History:**
   - "Reading History" section shows all archived sessions
   - Each session displays:
     - Session number (Read #1, #2, etc.)
     - Start/completion dates
     - Review (book rating shown at book level, not per session)
     - Progress summary (total logs, pages read, final %)

### Components

**ReadingHistoryTab** (`/components/ReadingHistoryTab.tsx`)
- Displays all archived reading sessions
- Fetches from `GET /api/books/:id/sessions`
- Shows session cards with metadata and progress summaries
- Only renders if archived sessions exist

**Book Detail Page** (`/app/books/[id]/page.tsx`)
- "Start Re-reading" button (visible when status=read)
- Integrates ReadingHistoryTab component
- Handles re-read initiation with toast notifications

### Migration

**Script:** `/scripts/migrateToSessions.ts`

**Process:**
1. Creates backup of ReadingSession and ProgressLog collections
2. Migrates each existing reading status to ReadingSession (sessionNumber=1, isActive=true)
3. Links all ProgressLog entries to migrated sessions
4. Verifies migration success
5. Supports rollback via backup file

**Usage:**
```bash
# Run migration
bun run scripts/migrateToSessions.ts

# Rollback if needed
bun run scripts/migrateToSessions.ts --rollback --backup=backups/migration-backup-xxxxx.json
```

### Benefits

- **Complete History:** Every read is preserved with full context
- **Separate Ratings:** Rate books differently on subsequent reads
- **Progress Isolation:** Each reading session has independent progress
- **Streak Preservation:** Re-reading maintains and contributes to streaks
- **No Data Loss:** All historical data migrated and preserved

---

## 7. FRONTEND ARCHITECTURE

### Page Structure

#### Dashboard (`/app/page.tsx`) - Server Component
- Fetches stats and streak data server-side
- Displays:
  - Currently reading books (6-book preview)
  - Key metrics cards (Books This Year, Currently Reading, Pages Today, Avg Pages/Day)
  - Streak display component
- Uses: StatsCard, StreakDisplay, BookCard components

#### Library (`/app/library/page.tsx`) - Client Component
- Full book library browsing with client service layer architecture
- **Architecture Pattern:** Page → Hook → Service → API Routes → Database
- Features:
  - Text search (title, authors)
  - Filter by status (all, to-read, reading, read)
  - Filter by tags (multiple selection)
  - Sorting (title, author, rating, recently read)
  - Infinite scroll pagination
  - Manual Calibre sync trigger
  - Responsive grid layout
- Components:
  - `LibraryHeader` - Title, book count, sync button
  - `LibraryFilters` - Search, status dropdown, tag selector
  - `BookGrid` - Book cards with loading states
- Uses: `useLibraryData` hook → `LibraryService` → `/api/books`

#### Book Detail (`/app/books/:id/page.tsx`) - Client Component
- Complete book information
- Displays:
  - Cover image, title, authors, series
  - Publisher, page count, tags
  - Reading status selector
  - Progress bar (if totalPages available)
  - Progress logging form
  - Progress history timeline
- Features:
  - Update reading status
  - Log reading sessions with notes
  - View full progress history
- Real-time updates after each action

#### Statistics (`/app/stats/page.tsx`) - Server Component
- Comprehensive reading statistics
- Displays:
  - Current and longest streaks
  - Total active days
  - Books read (all-time, this year, this month)
  - Pages read (all-time, this year, this month, today)
  - Average reading velocity (pages/day last 30 days)

#### Settings (`/app/settings/page.tsx`) - Client Component
- Configuration interface
- Displays:
  - Calibre database path (from env)
  - Auto-sync status and last sync time
  - Manual sync button with progress indicator
  - Setup instructions
  - Database configuration info
- Updates sync status every 5 seconds

---

### UI Components

**Navigation (`/components/Navigation.tsx`)**
- Header navigation with links to all pages
- Used in root layout

**BookCard (`/components/BookCard.tsx`)**
- Compact book preview component
- Shows: cover, title, authors, status badge, reading progress
- Links to detail page

**StreakDisplay (`/components/StreakDisplay.tsx`)**
- Visual representation of reading streaks
- Shows current vs. longest streak

**StatsCard (`/components/ui/StatsCard.tsx`)**
- Reusable metric display card
- Icon, title, value, subtitle
- Optional custom styling

**LibraryHeader (`/components/LibraryHeader.tsx`)**
- Library page header with book count and sync button
- Props: totalBooks, syncing state, onSync callback

**LibraryFilters (`/components/LibraryFilters.tsx`)**
- Complete filtering UI for library
- Search input with clear button
- Status dropdown (All, To Read, Read Next, Reading, Read)
- Tag search with autocomplete suggestions
- Selected tag pills with remove functionality
- Props: all filter values and change handlers

**BookGrid (`/components/BookGrid.tsx`)**
- Grid display of book cards
- Loading states (initial and "load more")
- Empty state message
- Props: books array, loading flags

---

## 7. CLIENT SERVICE LAYER ARCHITECTURE

### Overview

The library page demonstrates a clean separation of concerns using a **Client Service Layer** pattern that keeps business logic separate from UI components and provides client-side caching.

**Architecture Flow:**
```
┌─────────────────┐
│  Library Page   │ (Orchestration, URL params)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ useLibraryData  │ (State management, infinite scroll)
│     Hook        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ LibraryService  │ (Client-side caching, API abstraction)
│    (Singleton)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  /api/books     │ (Server-side DB queries)
│   API Route     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    MongoDB      │ (Data persistence)
└─────────────────┘
```

### LibraryService (`/lib/library-service.ts`)

**Purpose:** Client-side service that abstracts API calls and provides intelligent caching

**Key Features:**
- Singleton instance exported for app-wide usage
- In-memory cache with intelligent key generation
- Separate caches for books and tags
- Type-safe interfaces for all data structures

**Public Methods:**
```typescript
getBooks(filters: LibraryFilters): Promise<PaginatedBooks>
  // Fetches paginated books with filters
  // Caches results by filter combination
  // Returns: books[], total, limit, skip, hasMore

getAvailableTags(): Promise<string[]>
  // Fetches all unique tags sorted alphabetically
  // Caches results for subsequent calls

syncCalibre(): Promise<SyncResult>
  // Triggers Calibre sync via API
  // Clears all caches on success

clearCache(): void
  // Clears all cached data (books and tags)
  // Called after sync or manual refresh

invalidateCache(filters: Partial<LibraryFilters>): void
  // Selectively invalidates cache entries
  // Used for targeted cache busting
```

**Cache Strategy:**
- Cache keys generated from filter combinations (status, search, tags, pagination)
- Results cached indefinitely until explicitly cleared
- Separate tag cache for autocomplete performance
- `hasMore` calculation: `skip + books.length < total`

**Example Usage:**
```typescript
import { libraryService } from "@/lib/library-service";

const result = await libraryService.getBooks({
  status: "reading",
  search: "Harry",
  tags: ["fantasy"],
  pagination: { limit: 50, skip: 0 },
});
// Returns: { books, total, limit, skip, hasMore }

// Clear cache after sync
libraryService.clearCache();
```

### useLibraryData Hook (`/hooks/useLibraryData.ts`)

**Purpose:** Custom React hook that manages library page state and data fetching

**Key Features:**
- Encapsulates all filter state management
- Handles infinite scroll pagination
- Debounces search input
- Manages loading and error states
- Provides convenient setter functions

**Hook Interface:**
```typescript
const {
  // Data
  books,           // Current books array
  total,           // Total count from server
  hasMore,         // More pages available?
  loading,         // Loading state
  error,           // Error message
  
  // Actions
  loadMore,        // Load next page (infinite scroll)
  refresh,         // Clear cache and refetch
  updateFilters,   // Generic filter update
  
  // Specific setters
  setSearch,       // Update search query
  setStatus,       // Update status filter
  setTags,         // Update tag filters
  setLimit,        // Update page size
  setSkip,         // Update pagination offset
  
  // Current state
  filters,         // Current filter values
} = useLibraryData(initialFilters?);
```

**Smart Features:**
- Resets pagination (skip=0) when core filters change
- Cancels in-flight requests on unmount
- Memoizes service instance to prevent recreation
- Accumulates results for infinite scroll

**Example Usage:**
```typescript
const {
  books,
  total,
  hasMore,
  loading,
  loadMore,
  setSearch,
  setStatus,
} = useLibraryData({
  status: searchParams.get("status") || undefined,
});

// Filter changes automatically trigger refetch
setStatus("reading");

// Infinite scroll
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadMore();
      }
    },
    { threshold: 0.1 }
  );
  // ...
}, [loadMore, hasMore, loading]);
```

### Library Page Component Structure

**File:** `/app/library/page.tsx` (135 lines, down from 485)

**Responsibilities:**
- URL parameter handling (search, status, tags)
- Debounced search input (300ms delay)
- Infinite scroll observer setup
- Sync button handler with toast notifications
- Renders: LibraryHeader, LibraryFilters, BookGrid

**Key Pattern:**
```typescript
// Initialize hook with URL params
const { books, total, hasMore, loading, ... } = useLibraryData({
  search: searchParams.get("search") || undefined,
  status: searchParams.get("status") || undefined,
  tags: searchParams.get("tags")?.split(",") || undefined,
});

// Debounce search
useEffect(() => {
  const timer = setTimeout(() => setSearch(searchInput), 300);
  return () => clearTimeout(timer);
}, [searchInput]);

// Infinite scroll
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !loading) {
      loadMore();
    }
  });
  // ...
});
```

### Benefits of This Architecture

1. **Separation of Concerns**
   - Page: Orchestration and UI coordination
   - Hook: State management and data fetching logic
   - Service: API abstraction and caching
   - Components: Pure presentation logic

2. **Testability**
   - Service can be tested in isolation with mocked fetch
   - Hook can be tested with custom React testing utilities
   - Components can be tested with mock props
   - Integration tests validate the full flow

3. **Reusability**
   - Service can be used from any component
   - Hook can be used on other pages with similar needs
   - Components are generic and reusable

4. **Performance**
   - Client-side caching reduces API calls
   - Debounced search prevents excessive requests
   - Infinite scroll loads data progressively
   - Smart cache invalidation after mutations

5. **Maintainability**
   - Single responsibility for each layer
   - Easy to modify filtering/pagination logic
   - Clear data flow from UI to database
   - Type-safe interfaces throughout

### Testing Pattern

**Integration Tests:** `__tests__/integration/library-service-api.test.ts`

Tests the complete flow from service → API routes → database:

```typescript
// Mock fetch to call actual API handlers
global.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  
  if (url.includes("/api/books")) {
    const request = createMockRequest("GET", url);
    return await GET_BOOKS(request); // Actual handler
  }
  // ...
};

test("should handle pagination correctly", async () => {
  // Create test data
  await Book.create({ /* ... */ });
  
  // Test via service (which calls API which queries DB)
  const page1 = await service.getBooks({
    pagination: { limit: 5, skip: 0 },
  });
  
  expect(page1.books).toHaveLength(5);
  expect(page1.hasMore).toBe(true);
});
```

**Key Testing Principles:**
- Don't mock the layer being tested
- Use actual API handlers (not mocked fetch responses)
- Validate complete data flow
- Test cache behavior with real API responses
- Cover edge cases (pagination boundaries, filters, etc.)

---

## 8. DATA FLOW EXAMPLES

### Reading Progress Workflow
```
User Action: Log progress on book detail page
    ↓
handleLogProgress() - POST /api/books/:id/progress
    ↓
Backend:
  - Find last progress entry
  - Calculate pagesRead delta
  - Create new ProgressLog
  - Check if 100% complete
    ├─ If yes: Update ReadingSession to "read"
  - Call updateStreaks()
    ├─ Update Streak record
    ├─ Check if consecutive day
    ├─ Update currentStreak/longestStreak
    ↓
Response: ProgressLog created
    ↓
Frontend:
  - Clear form
  - Refetch book details
  - Refetch progress history
  - Display updated progress bar
```

### Calibre Sync Workflow
```
Scenario 1: Automatic (Background)
  Calibre database file modified
    ↓
  fs.watch() detects change
    ↓
  Debounce 2 seconds
    ↓
  calibreWatcher.triggerSync()
    ↓
  syncCalibreLibrary()
    ↓
  MongoDB Book collection updated

Scenario 2: Manual (User-Initiated)
  User clicks "Sync Calibre" button
    ↓
  Frontend: POST /api/calibre/sync
    ↓
  Backend checks isSyncInProgress()
    ├─ If true: Return error
    ├─ If false: Proceed
    ↓
  syncCalibreLibrary()
    ├─ Connect to both DBs
    ├─ getAllBooks() from Calibre
    ├─ For each book: create or update in MongoDB
    ├─ Update lastSyncTime
    ↓
  Return sync results (syncedCount, updatedCount, totalBooks)
    ↓
  Frontend: Show success message, refetch book list
```

### Reading Status Update Workflow
```
User Action: Change status to "Reading"
    ↓
handleUpdateStatus() - POST /api/books/:id/status
    ↓
Backend:
  - Validate status value
  - Find or create ReadingSession
  - Set status = "reading"
  - Auto-set startedDate if not exists
  - Update rating if provided
  - Save to MongoDB
    ↓
  Response: ReadingSession object
    ↓
Frontend:
  - Update selected status button UI
  - Refetch book details
  - Update display
```

---

## 8. KEY CONFIGURATION FILES

### Environment Variables (`.env`)
```
CALIBRE_DB_PATH=/path/to/calibre/library/metadata.db
MONGODB_URI=mongodb://localhost:27017/book-tracker
PORT=3000
NODE_ENV=development
ENABLE_AUTH=false
```

### Next.js Config (`next.config.js`)
```javascript
{
  output: 'standalone',              // Optimized for Docker
  experimental: {
    instrumentationHook: true         // Enable instrumentation.ts
  },
  images: {
    unoptimized: true                // Local file system images
  }
}
```

### TypeScript Config (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "jsx": "preserve",
    "paths": {
      "@/*": ["./*"]                // Module alias
    }
  }
}
```

---

## 9. DEPLOYMENT

### Docker Architecture

**Image Build Stages:**
1. **base** - Bun runtime
2. **deps** - Install dependencies
3. **builder** - Build Next.js app
4. **runner** - Production image

**Production Image Features:**
- Non-root user (nextjs:nodejs)
- Standalone output (minimal size)
- Next.js static assets included
- Port 3000 exposed

### Docker Compose

**Services:**
- **MongoDB** (mongo:7)
  - Container: book-tracker-mongodb
  - Port: 27017
  - Volume: mongodb_data (persistent)
  - Health check: MongoDB ping
  - Restart policy: unless-stopped

**Environment:**
- Application connects to `mongodb://localhost:27017/book-tracker` by default

---

## 10. IMPORTANT PATTERNS AND CONCEPTS

### Singleton Patterns
- **MongoDB Connection** (`lib/db/mongodb.ts`): Global cached connection
- **Calibre Database** (`lib/db/calibre.ts`): Singleton read-only connection
- **Calibre Watcher** (`lib/calibre-watcher.ts`): Single instance monitoring

### Concurrency Control
- `isSyncing` flag prevents concurrent Calibre syncs
- `syncing` flag in CalibreWatcher prevents duplicate operations
- Debounce timer prevents file watcher thrashing

### Data Consistency
- ProgressLog automatically calculates pagesRead delta
  - ReadingSession auto-updated when progress reaches 100%
- Streak calculations based on date boundaries (start-of-day)
- lastSynced timestamp tracks MongoDB data freshness

### Security
- Cover image serving validates path stays within library
- Read-only access to Calibre database
- Input validation on API endpoints
- No direct file system access from frontend

### Multi-User Support (Infrastructure)
  - ReadingSession and ProgressLog have optional userId field
- Streak model has optional userId with unique constraint
- Future: Add authentication and user context middleware

---

## 11. COMMON WORKFLOWS

### Adding a New Metric
1. Create MongoDB query in `/lib` or API route
2. Add endpoint: `/api/stats/[new-metric]`
3. Create page or update existing page to fetch and display
4. Use StatsCard component for consistent styling

### Adding Calibre Metadata Field
1. Update CalibreBook interface in `calibre.ts`
2. Add to SQL query to fetch column
3. Update Book schema if needed
4. Include in sync process
5. Display in book detail page

### Adding New Page
1. Create `/app/[page-name]/page.tsx`
2. Decide: Server component (SSR, for data) vs Client component (interactivity)
3. Import components and fetch data as needed
4. Add navigation link in Navigation.tsx
5. Update root layout if new layout needed

---

## 12. DEVELOPMENT WORKFLOW

### Running Locally
```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your Calibre path and MongoDB URI

# Start MongoDB (if local)
docker-compose up -d

# Development server
bun run dev

# Build for production
bun run build
bun start

# Linting
bun run lint
```

### Sync Manual Script
- Command: `bun run sync-calibre`
- Defined in package.json
- Runs sync-calibre.ts script (location not shown but follows sync-service.ts pattern)

---

## 13. FUTURE EXPANSION POINTS

1. **User Authentication**: Implement with next-auth
2. **User-Specific Data**: Filter by userId in queries
  3. **Book Ratings/Reviews**: Planned for ReadingSession schema
4. **Reading Goals**: New model for goal tracking
5. **Export Features**: CSV/PDF exports of reading data
6. **Mobile App**: API is REST-friendly for mobile clients
7. **Social Features**: Share reading achievements
8. **Advanced Analytics**: More detailed charts with Recharts
9. **Calibre 2-Way Sync**: Update Calibre with app changes
10. **Recommendations**: ML-based book suggestions

---

## Summary

**Book Tracker** is a well-architected application that bridges the gap between Calibre library management and reading progress tracking. Its main strength is the seamless integration with Calibre through:
- Real-time file system monitoring
- Smart metadata extraction
- Automatic synchronization

The MongoDB layer tracks user reading activity independently, enabling personal statistics, streaks, and progress monitoring. The Next.js framework provides both the API backend and React frontend in a single deployment unit, with Docker enabling consistent environments across development and production.

The codebase is structured for future expansion, particularly toward multi-user support and additional features like reading goals, social sharing, and advanced analytics.
