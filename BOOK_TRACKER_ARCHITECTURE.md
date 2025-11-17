# Book Tracker Architecture Documentation

## Overview
Book Tracker is a full-stack reading companion application built with Next.js 14 that integrates with Calibre digital libraries. It enables users to track reading progress, maintain reading streaks, and visualize reading statistics while syncing metadata from their Calibre library.

**Tech Stack:**
- Frontend: Next.js 14 (React 18) with TypeScript
- Backend: Next.js API Routes (Node.js)
- Databases: MongoDB (tracking data) + SQLite (Calibre library)
- UI: Tailwind CSS + Lucide React icons
- Runtime: Bun (package manager)
- Charts: Recharts
- Deployment: Docker + Docker Compose

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
├── /models                   # Mongoose schemas
├── /lib                      # Core business logic and services
│   ├── /db
│   │   ├── mongodb.ts       # MongoDB connection manager
│   │   └── calibre.ts       # Calibre SQLite reader
│   ├── sync-service.ts      # Calibre library sync logic
│   ├── calibre-watcher.ts   # File system watcher for auto-sync
│   └── streaks.ts           # Reading streak calculations
├── /components              # React components
├── /utils                   # Utility functions
├── instrumentation.ts       # Next.js instrumentation hook
├── package.json            # Dependencies and scripts
├── next.config.js          # Next.js configuration
├── docker-compose.yml      # Docker services definition
└── Dockerfile             # Container build instructions
```

---

## 2. DATABASE MODELS AND RELATIONSHIPS

### MongoDB Collections (via Mongoose)

#### Book Model (`/models/Book.ts`)
**Purpose:** Stores metadata of books synced from Calibre
**Fields:**
- `calibreId` (Number, unique) - ID from Calibre database
- `title` (String) - Book title
- `authors` (String[]) - Author names
- `isbn` (String, optional)
- `coverPath` (String, optional) - API route to cover image
- `totalPages` (Number, optional) - Total page count
- `publisher` (String, optional)
- `pubDate` (Date, optional) - Publication date
- `series` (String, optional) - Series name
- `seriesIndex` (Number, optional)
- `tags` (String[]) - Calibre tags/categories
- `path` (String) - File path in Calibre library
- `addedToLibrary` (Date) - When added to Calibre
- `lastSynced` (Date) - Last sync time
- `timestamps` - createdAt, updatedAt auto-managed

**Indexes:**
- Full-text search on `title` and `authors`
- Unique constraint on `calibreId`

---

#### ReadingStatus Model (`/models/ReadingStatus.ts`)
**Purpose:** Tracks current reading status per book
**Fields:**
- `userId` (ObjectId, optional) - For multi-user support
- `bookId` (ObjectId, required, ref: Book) - References Book
- `status` (String, enum: "to-read" | "reading" | "read")
- `startedDate` (Date, optional) - When user started reading
- `completedDate` (Date, optional) - When user finished
- `rating` (Number 1-5, optional) - User's rating
- `review` (String, optional) - User's review
- `timestamps` - createdAt, updatedAt

**Indexes:**
- Unique compound index on (userId, bookId)
- Index on `bookId`
- Index on `status`

---

#### ProgressLog Model (`/models/ProgressLog.ts`)
**Purpose:** Tracks individual reading sessions and page progress
**Fields:**
- `userId` (ObjectId, optional, ref: User) - For multi-user support
- `bookId` (ObjectId, required, ref: Book) - References Book
- `currentPage` (Number) - Current page user is on
- `currentPercentage` (Number, 0-100) - Completion percentage
- `progressDate` (Date) - When this update was recorded
- `notes` (String, optional) - Session notes
- `pagesRead` (Number) - Pages read in this session
- `timestamps` - createdAt, updatedAt

**Indexes:**
- Composite index on (bookId, progressDate DESC)
- Composite index on (userId, progressDate DESC)
- Index on progressDate DESC

---

#### Streak Model (`/models/Streak.ts`)
**Purpose:** Tracks reading consistency streaks
**Fields:**
- `userId` (ObjectId, optional, unique, ref: User) - For multi-user support
- `currentStreak` (Number) - Consecutive days of activity
- `longestStreak` (Number) - All-time longest streak
- `lastActivityDate` (Date) - Last day with reading activity
- `streakStartDate` (Date) - When current streak started
- `totalDaysActive` (Number) - Total number of active reading days
- `timestamps` - createdAt, updatedAt

---

### Relationship Diagram
```
Book (from Calibre)
├── ReadingStatus (1:1 per user/book)
│   └── userId, status, dates, rating, review
├── ProgressLog (1:many)
│   └── Each progress entry for tracking
└── Streak (aggregated from ProgressLog)
    └── Calculated streak metrics
```

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

**Key Functions:**
- `getCalibreDB()` - Singleton connection manager (read-only)
- `getAllBooks()` - Fetch all books with metadata
- `getBookById(id)` - Get specific book details
- `searchBooks(query)` - Full-text search by title/author
- `getBookTags(bookId)` - Fetch tags for a book
- `getCoverPath(bookPath)` - Generate cover image API path

**Query Strategy:**
- Uses SQL JOINs to gather related data
- Dynamically checks for optional columns (publisher, series)
- Groups results to handle many-to-many relationships
- Returns structured CalibreBook interface

**Cover Image Handling:**
- Calibre stores cover.jpg in book folders
- Returns API path: `/api/covers/{bookPath}/cover.jpg`
- Actual file serving handled by covers route

---

### Sync Service (`/lib/sync-service.ts`)

**Process:**
1. Connects to both MongoDB and Calibre database
2. Fetches all books from Calibre
3. For each book:
   - Extracts metadata (title, authors, ISBN, tags, etc.)
   - Constructs cover path
   - Checks if book exists in MongoDB (by calibreId)
   - Creates new Book or updates existing one
4. Tracks: syncedCount (new), updatedCount (existing), totalBooks
5. Updates lastSyncTime on success
6. Prevents concurrent syncs with isSyncing flag

**Sync Data Flow:**
```
Calibre SQLite
    ↓
getAllBooks() + getBookTags() + getCoverPath()
    ↓
Book metadata with enriched data
    ↓
MongoDB Book collection
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

**Behavior:**
```typescript
if CALIBRE_DB_PATH is set:
    calibreWatcher.start(CALIBRE_DB_PATH, syncCalibreLibrary)
    Register SIGTERM/SIGINT handlers to stop watcher

else:
    Log warning that auto-sync is disabled
```

**Result:** When a user adds/updates books in Calibre, the watcher detects changes and triggers `syncCalibreLibrary()` automatically.

---

## 5. API ROUTES STRUCTURE

### Base URL: `/api`

#### Books Management

**GET /api/books**
- Fetch paginated book list
- Query params: `status`, `search`, `limit`, `skip`
- Returns: books array with status and rating, total count
- Joins with ReadingStatus for user data

**POST /api/books**
- Update book totalPages
- Body: `{ calibreId, totalPages }`
- Returns: updated book object

**GET /api/books/:id**
- Fetch single book with full details
- Returns: Book + ReadingStatus + latest ProgressLog
- Includes: book metadata, status, current progress

**PATCH /api/books/:id**
- Update book (totalPages)
- Body: `{ totalPages }`
- Returns: updated book

---

#### Progress Tracking

**GET /api/books/:id/progress**
- Fetch all progress logs for a book
- Sorted by progressDate descending
- Returns: array of ProgressLog entries

**POST /api/books/:id/progress**
- Log reading progress
- Body: `{ currentPage?, currentPercentage?, notes? }`
- Calculates:
  - Final percentage from pages (if not provided)
  - Final pages from percentage (if not provided)
  - pagesRead as delta from last entry
- Auto-updates ReadingStatus if 100% reached
- Triggers streak update
- Returns: created ProgressLog

---

#### Status Management

**GET /api/books/:id/status**
- Fetch reading status for a book
- Returns: ReadingStatus or null

**POST /api/books/:id/status**
- Update reading status
- Body: `{ status, rating?, review?, startedDate?, completedDate? }`
- Auto-sets dates when status changes:
  - "reading" → sets startedDate
  - "read" → sets completedDate
- Returns: updated ReadingStatus

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

## 6. FRONTEND ARCHITECTURE

### Page Structure

#### Dashboard (`/app/page.tsx`) - Server Component
- Fetches stats and streak data server-side
- Displays:
  - Currently reading books (6-book preview)
  - Key metrics cards (Books This Year, Currently Reading, Pages Today, Avg Pages/Day)
  - Streak display component
- Uses: StatsCard, StreakDisplay, BookCard components

#### Library (`/app/library/page.tsx`) - Client Component
- Full book library browsing
- Features:
  - Text search (title, authors)
  - Filter by status (all, to-read, reading, read)
  - Manual Calibre sync trigger
  - Responsive grid layout
- Uses: BookCard component for display

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

---

## 7. DATA FLOW EXAMPLES

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
    ├─ If yes: Update ReadingStatus to "read"
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
  - Find or create ReadingStatus
  - Set status = "reading"
  - Auto-set startedDate if not exists
  - Update rating if provided
  - Save to MongoDB
    ↓
Response: ReadingStatus object
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
- ReadingStatus auto-updated when progress reaches 100%
- Streak calculations based on date boundaries (start-of-day)
- lastSynced timestamp tracks MongoDB data freshness

### Security
- Cover image serving validates path stays within library
- Read-only access to Calibre database
- Input validation on API endpoints
- No direct file system access from frontend

### Multi-User Support (Infrastructure)
- ReadingStatus and ProgressLog have optional userId field
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
3. **Book Ratings/Reviews**: Already in ReadingStatus schema
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
