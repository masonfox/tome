# Tome Architecture - AI Context

**Last Updated:** November 24, 2025
**Status:** Current - SQLite + Drizzle ORM + Repository Pattern
**Audience:** AI agents, developers

---

## Section 1: System Overview

**Tome** is a self-hosted reading progress tracker that integrates with Calibre digital libraries. It enables users to track reading progress, manage reading status (to-read, reading, read), maintain reading streaks, and view comprehensive reading statistics.

### Integration with Calibre

- **Read-only access** to Calibre's SQLite database (metadata.db)
- **Automatic sync**: File watcher monitors Calibre database for changes and syncs within 2 seconds
- **Rating sync**: Bidirectional sync with Calibre's rating system (Tome 1-5 stars ↔ Calibre 2/4/6/8/10)
- **No data export**: Calibre remains the source of truth for book metadata

### Core User Flows

1. **Setup**: Point Tome to Calibre library → Initial sync imports all books
2. **Reading Progress**: Log pages/percentage as reading → Progress tracked per session
3. **Status Management**: Change book status (to-read → reading → read)
4. **Re-reading**: Complete a book, then start a new session for same book with full history preserved
5. **Rating**: Rate books on finish → Syncs to Calibre automatically
6. **Streaks**: Daily reading activity tracked → Current and longest streak calculated

---

## Section 2: Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router, React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Client State**: React hooks + custom hooks (useLibraryData)
- **Client Service Layer**: LibraryService (singleton with caching)

### Backend
- **Runtime**: Bun (production) / Node.js (development)
- **API**: Next.js API Routes (REST)
- **Services**: Three-tier service layer (BookService, SessionService, ProgressService)
- **Data Access**: Repository Pattern (5 repositories + BaseRepository)

### Database
- **Tome Database**: SQLite + Drizzle ORM (tracking data: books, sessions, progress, streaks)
  - Location: `data/tome.db`
  - Driver: `bun:sqlite` (Bun) / `better-sqlite3` (Node.js)
  - Factory Pattern: `lib/db/factory.ts` handles runtime detection
- **Calibre Database**: SQLite (read-only, metadata.db from Calibre library)
  - Read operations: `lib/db/calibre.ts`
  - Write operations (ratings only): `lib/db/calibre-write.ts`

### Deployment
- **Containerization**: Docker + Docker Compose
- **Web Server**: Built-in Next.js server (port 3000)
- **Volume Management**: Single persistent volume for `data/tome.db`
- **Auto-migration**: Migrations run on container startup with safety features

### Key Libraries
- `drizzle-orm`: SQLite ORM with SQL-like syntax
- `zod`: Validation
- `pino`: Logging
- `chokidar`: File system watching (Calibre sync)

---

## Section 3: Data Architecture

### Tome Database (SQLite + Drizzle)

**Location:** `lib/db/schema/` (Drizzle schemas)

#### Books Table
**Purpose:** Stores metadata of books synced from Calibre

**Key Fields:**
- `calibreId` (unique) - Calibre database ID
- `title`, `authors` (JSON), `tags` (JSON)
- `totalPages`, `rating` (1-5 stars)
- `orphaned` - Marks books removed from Calibre
- Timestamps: `lastSynced`, `createdAt`, `updatedAt`

**Repository:** `bookRepository` | **Schema:** `lib/db/schema/books.ts`

---

#### Reading Sessions Table
**Purpose:** Tracks reading sessions per book (supports re-reading)

**Key Fields:**
- `bookId` (FK → books.id, CASCADE DELETE)
- `sessionNumber` - Enables re-reading (1, 2, 3...)
- `isActive` - Only one active session per book
- `status` - Enum: to-read, read-next, reading, read
- `startedDate`, `completedDate` (TEXT: YYYY-MM-DD) - Calendar days, not timestamps
- `review`

**Date Storage:** Uses YYYY-MM-DD strings (not timestamps) for semantic correctness. See [ADR-014: Date String Storage](./ADRs/ADR-014-DATE-STRING-STORAGE.md)

**Indexes:** Unique on (bookId, sessionNumber); Partial unique on (bookId) WHERE isActive=1
**Repository:** `sessionRepository` | **Schema:** `lib/db/schema/reading-sessions.ts`

---

#### Progress Logs Table
**Purpose:** Tracks individual reading progress entries per session

**Key Fields:**
- `bookId`, `sessionId` (FK with CASCADE DELETE)
- `currentPage`, `currentPercentage` (0-100)
- `pagesRead` - Delta from previous entry
- `progressDate` (TEXT: YYYY-MM-DD) - Calendar day, not timestamp
- `notes`

**Date Storage:** Uses YYYY-MM-DD strings (not timestamps) for semantic correctness. See [ADR-014: Date String Storage](./ADRs/ADR-014-DATE-STRING-STORAGE.md)

**Indexes:** (bookId, progressDate DESC), (sessionId, progressDate DESC)
**Repository:** `progressRepository` | **Schema:** `lib/db/schema/progress-logs.ts`

---

#### Streaks Table
**Purpose:** Tracks reading consistency streaks with timezone-aware auto-reset

**Key Fields:**
- `currentStreak`, `longestStreak` - Consecutive days meeting threshold
- `lastActivityDate`, `streakStartDate` - Dates in UTC (interpreted in user timezone)
- `totalDaysActive` - Lifetime count of days meeting threshold
- `dailyThreshold` - Pages required per day (default: 1, configurable 1-9999)
- `userTimezone` - IANA timezone identifier (default: 'America/New_York')
- `lastCheckedDate` - Idempotency flag for daily auto-reset checks

**Pattern:** Singleton (one record per user)  
**Auto-Reset:** Check-on-read with idempotency (FR-005 from spec 001)  
**Timezone Support:** Per-user timezone with auto-detection (FR-011 from spec 001)  
**Repository:** `streakRepository` | **Schema:** `lib/db/schema/streaks.ts`  
**Service:** `streakService` | **Functions:** `lib/streaks.ts`

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

---

### Repository Pattern

**Rule:** All Tome database access goes through repositories.

**Repositories:** `bookRepository`, `sessionRepository`, `progressRepository`, `streakRepository`

**Details:** See `docs/REPOSITORY_PATTERN_GUIDE.md`

---

### Calibre Database (Read-Only + Rating Writes)

**Read Operations** (`lib/db/calibre.ts`):
- `getAllBooks()`: Fetch all books with metadata
- `getBookById(id)`: Get specific book details
- `searchBooks(query)`: Full-text search by title/author
- Handles many-to-many: books → authors, tags via junction tables

**Write Operations** (`lib/db/calibre-write.ts`) - **RATINGS ONLY**:
- `updateCalibreRating(calibreId, stars)`: Update book rating
  - Converts Tome 1-5 stars → Calibre 2/4/6/8/10 scale
  - Manages ratings and books_ratings_link tables
  - Best-effort (continues if Calibre unavailable)

### Repository Pattern

All Tome database access goes through repositories:

- **BaseRepository**: Generic CRUD (findById, create, update, delete, find, count, exists, etc.)
- **BookRepository**: findByCalibreId, findWithFilters (complex filtering), getAllTags, markAsOrphaned
- **SessionRepository**: findActiveByBookId, getNextSessionNumber, deactivateOtherSessions
- **ProgressRepository**: findBySessionId, findLatestByBookId, getUniqueDatesWithProgress
- **StreakRepository**: getActiveStreak, upsertStreak

**Key Pattern**: Repository methods coordinate with services; services orchestrate repositories.

---

## Section 4: Application Architecture

### Layer Structure

```
Routes (HTTP layer - 30-50 lines thin orchestrators)
    ↓
Services (Business logic - 3 services, 735 lines)
    ├─ BookService: Book retrieval, filtering, metadata updates, rating sync
    ├─ SessionService: Session lifecycle, status transitions, re-reading, streaks
    └─ ProgressService: Progress logging, validation, calculations, auto-completion
    ↓
Repositories (Data access - 5 specialized repos)
    ├─ BookRepository
    ├─ SessionRepository
    ├─ ProgressRepository
    ├─ StreakRepository
    └─ External access: Calibre read/write
    ↓
Database (SQLite + Drizzle ORM)
```

### Frontend Architecture

**Page-level patterns:**

1. **Dashboard** (Server Component)
   - Fetches stats and streak server-side
   - Displays: Currently reading, key metrics, streaks

2. **Library** (Client Component)
   - **Architecture**: Page → Hook → Service → API → DB
   - Page handles URL params and orchestration
   - `useLibraryData` hook manages filter state, pagination, loading
   - `LibraryService` singleton provides caching and API abstraction
   - Infinite scroll pagination with hasMore calculation
   - Features: Search, status filter, tag filter, sorting, sync trigger

3. **Book Detail** (Client Component)
   - **Architecture**: Page → Custom Hooks → Presentation Components → API
   - `useBookDetail`: Data fetching, image errors
   - `useBookStatus`: Status transitions with validation, confirmations, re-reading
   - `useBookProgress`: Progress logging, editing, deletion, temporal validation
   - `useBookRating`: Rating modal state, updates
   - Components: BookHeader, BookMetadata, BookProgress, ProgressHistory, SessionDetails
   - Refactored from 1,223 lines to ~250 lines orchestrator + 5 focused components

4. **Statistics** (Server Component)
   - Comprehensive stats: Streaks, total/year/month books, pages, velocity

5. **Settings** (Client Component)
   - Calibre path display, sync status, manual sync button

### API Routes (13 total)

#### Books Management

**GET /api/books**
- Fetch paginated book list
- Query params: `status`, `search`, `tags`, `rating`, `limit`, `skip`, `showOrphaned`, `sortBy`
- Returns: books array with active session status and book rating, total count
- Joins with active ReadingSession (isActive=true) for user data

**PATCH /api/books/:id**
- Update book (totalPages)
- Body: `{ totalPages }`
- Returns: updated book

**GET /api/books/:id**
- Fetch single book with full details
- Returns: Book + active ReadingSession + latest ProgressLog for active session
- Includes: book metadata, current session status, current progress

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

**PATCH /api/books/:id/progress/:progressId**
- Edit existing progress entry
- Body: `{ currentPage?, currentPercentage?, notes? }`
- Returns: updated ProgressLog

**DELETE /api/books/:id/progress/:progressId**
- Delete progress entry
- Returns: success message

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

**GET /api/streak**
- Get streak with hours remaining today
- Auto-calls `checkAndResetStreakIfNeeded()` before returning data
- Returns: `Streak` + `hoursRemainingToday`
- Auto-creates if doesn't exist

**GET /api/streaks**
- Get basic streak data (no computed fields)
- Auto-calls `checkAndResetStreakIfNeeded()` before returning data
- Returns: full `Streak` object
- Auto-creates if doesn't exist

**PATCH /api/streak/threshold**
- Update daily page threshold (1-9999 pages)
- Body: `{ threshold: number }`
- Returns: updated `Streak` object

**POST /api/streak/timezone**
- Auto-detect and set user's timezone (only if using default)
- Body: `{ timezone: string }` (IANA identifier, e.g., "America/New_York")
- Returns: `{ success: boolean, timezone: string, streakRebuilt: boolean }`
- Idempotent: Only updates if current timezone is default

**PATCH /api/streak/timezone**
- Manually change user's timezone
- Body: `{ timezone: string }`
- Triggers full streak rebuild with new timezone
- Returns: `{ success: boolean, timezone: string, streakRebuilt: true }`

**Streak Auto-Reset Logic**:
- Pattern: Check-on-read with idempotency
- Trigger: Called before any streak data retrieval
- Check: Runs once per day (uses `lastCheckedDate` flag)
- Condition: Resets `currentStreak` to 0 if >1 day since last activity
- Timezone: Uses user's configured timezone for day boundaries

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

**GET /api/covers/:path***
- Stream book cover images from Calibre library
- Dynamic path based on book location in Calibre
- Security: validates path stays within library directory
- Caching: 1-year immutable cache headers
- Returns: image binary with appropriate Content-Type

---

### Key Data Flows

**Progress Tracking:**
1. User logs progress → API validates and calculates delta
2. Creates ProgressLog linked to active session
3. Updates streak if consecutive day
4. Auto-marks session as "read" at 100%

**Calibre Sync:**
- **Automatic**: File watcher detects change → 2s debounce → sync via repository
- **Manual**: User triggers → sync via repository → update UI

See implementation details in `lib/sync-service.ts` and `lib/streaks.ts`

---

## Section 5: Key Features

### Reading Sessions & Re-reading Support

- Each book can have multiple `ReadingSession` records (sessionNumber 1, 2, 3...)
- Only one session active per book (isActive=true)
- Previous sessions archived (isActive=false) with full history preserved
- Progress isolated per session (sessionId foreign key)
- Streaks accumulate across all sessions

**User Flow:**
1. Mark book as "reading" → Creates new session
2. Log progress → Links to active session
3. Mark as "read" → Archives session, triggers streak update
4. Click "Start Re-reading" → Creates session #2, archives previous
5. View "Reading History" → All archived sessions with summaries

### Progress Tracking

- **Supports two input modes**: Pages or percentage
- **Temporal validation**: Enforces timeline consistency (no backward progress without backdating)
- **Auto-completion**: 100% progress auto-marks session as "read"
- **Calculations**: Automatic page/percentage conversion, pagesRead delta
- **Notes**: User notes attached to each entry
- **Backdating**: Can add historical entries for book club scenarios

### Reading Streaks

**Overview**: Timezone-aware streak tracking with configurable thresholds and automatic reset detection.

**Core Metrics**:
- `currentStreak`: Consecutive days meeting daily threshold (timezone-aware)
- `longestStreak`: All-time best streak
- `totalDaysActive`: Lifetime count of days meeting threshold
- `dailyThreshold`: Pages required per day (default: 1, range: 1-9999)
- `userTimezone`: IANA timezone identifier (default: 'America/New_York')

**Key Features**:
1. **Per-User Timezone Support** (FR-011):
   - Auto-detection: Frontend detects device timezone on first visit
   - Manual override: Timezone selector in Settings
   - Day boundaries: All calculations use user's local midnight, not UTC
   - DST handling: Automatic handling of daylight saving transitions

2. **Configurable Thresholds** (FR-012):
   - Users set personal daily goals (1-9999 pages)
   - Validation: Must be positive integer in range
   - Immediate application: New threshold applies to current day
   - Historical preservation: Past days evaluated with their original threshold

3. **Auto-Reset Detection** (FR-005):
   - Pattern: Check-on-read with idempotency (no cron jobs)
   - Trigger: Called before any streak data retrieval
   - Check: Runs once per day (uses `lastCheckedDate` flag)
   - Condition: Resets to 0 if >1 day since last activity
   - Timezone-aware: Uses user's configured timezone for gap detection

4. **Timezone-Aware Calculation**:
   - All progress aggregated by LOCAL calendar day (not UTC day)
   - Uses `date-fns-tz` for timezone conversions
   - Pattern: Store UTC, calculate in user timezone
   - Example: 8 AM EST progress counts toward "today" (not "yesterday UTC")

**Architecture**:
```
User Logs Progress → API → checkAndResetStreakIfNeeded() → updateStreaks()
                              ↓ (idempotent daily check)
                         Reset if >1 day gap → Aggregate by local day → Update streak
```

**Timezone Pattern**:
```typescript
// Convert UTC to user timezone
const todayInUserTz = startOfDay(toZonedTime(new Date(), userTimezone));

// Perform calculations in user timezone
const daysSinceLastActivity = differenceInDays(todayInUserTz, lastActivity);

// Convert back to UTC for storage  
const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
```

**Streak Rebuild**:
- Triggered by: Progress logging, re-reading, timezone changes
- Process: 
  1. Get all progress logs across all sessions
  2. Group by local date (YYYY-MM-DD in user's timezone)
  3. Filter days meeting threshold
  4. Calculate consecutive sequences
  5. Check for broken streaks (>1 day gap from today)
- Timezone-aware: All date comparisons use user's timezone

**Database Dependencies**:
- Calculated from ALL progress logs across ALL sessions and books
- Single `streaks` record per user (singleton pattern)
- Timezone metadata: `userTimezone`, `lastCheckedDate`
- Progress date storage: UTC epoch, interpreted in user timezone

**Frontend Integration**:
- `TimezoneDetector`: Auto-detects and sets timezone on first visit
- `StreakSettings`: Manual timezone picker with common timezones
- `StreakDisplay`: Shows current/longest streak with visual indicators
- Goal completion: Dynamic UI based on `todayPagesRead` vs `threshold`

**Edge Cases Tested**:
- DST transitions (Spring Forward / Fall Back)
- Timezone changes (user moves or changes settings)
- Cross-timezone midnight (11:59 PM → 12:01 AM)
- UTC vs local day boundaries
- Multi-log aggregation within same day

**Implementation**:
- Service: `lib/services/streak.service.ts` (preferred, repository pattern)
- Functions: `lib/streaks.ts` (production, direct imports)
- Repository: `lib/repositories/streak.repository.ts`
- API: `app/api/streak/` (timezone endpoints, threshold updates)

**Specification**: See `specs/001-reading-streak-tracking/` for full requirements and acceptance criteria

### Rating System

- **Stored**: books.rating (1-5 stars only, NULL for unrated)
- **Not stored per session**: reading_sessions.review (personal notes, no rating per session)
- **Calibre sync**:
  - Write: Tome update → Calibre (best effort, continues if unavailable)
  - Read: Calibre → Tome on sync
  - Scale: 1-5 ↔ 2/4/6/8/10
- **Filtering**: Library supports exact/range/unrated filters with URL persistence
- **Sorting**: By rating high-to-low or low-to-high (unrated last)

### Automatic Sync

- **Mechanism**: File watcher (`lib/calibre-watcher.ts`) + Node.js instrumentation hook
- **Trigger**: Calibre metadata.db file modification detected
- **Debounce**: 2-second delay prevents thrashing on rapid changes
- **Works in**: Both dev (Node.js + better-sqlite3) and production (Bun + bun:sqlite)
- **Concurrency**: isSyncing flag prevents concurrent syncs
- **Process**:
  1. Connect to both Tome and Calibre SQLite databases
  2. Fetch all books from Calibre via getAllBooks()
  3. For each book: Create or update in Tome database
  4. Mark removed books as orphaned
  5. Update sync timestamp

---

## Section 6: Development Patterns

**Critical Patterns** (see `.specify/memory/patterns.md` for code examples):

1. **Database Factory** - Automatic runtime detection (Bun/Node), never import drivers directly
2. **Repository Pattern** (PRIMARY) - All database access through repositories, never bypass
3. **Service Layer** - Thin routes (30-50 lines), business logic in services
4. **Test Isolation** - Use `setDatabase(testDb)` and `resetDatabase()`, no global mocks
5. **Client Service Layer** - Page → Hook → Service → API pattern for complex pages

### Date Handling Patterns

**Storage Format**: All calendar day dates (progress dates, session dates) are stored as **YYYY-MM-DD strings** (TEXT columns) in the database, representing calendar days independent of timezone.

**Why Strings?** Calendar days are semantically different from timestamps. When a user logs "I read on January 8th," they mean a calendar day in their life, not a specific moment in time. Storing as strings ensures dates never shift when users change timezones.

**Key Principle:** What the user logs is what they see. A date logged as "2025-01-08" remains "2025-01-08" regardless of timezone changes.

**See:** [ADR-014: Date String Storage](./ADRs/ADR-014-DATE-STRING-STORAGE.md) for complete rationale and migration details.

**Two Patterns for Creating Date Strings:**

#### Pattern 1: UTC Conversion (Database Queries)

Use `toDateString(date)` from `utils/dateHelpers.server.ts` when:
- Converting Date objects for database queries
- Working with dates already in UTC
- Comparing calendar days at UTC midnight

```typescript
import { toDateString } from "@/utils/dateHelpers.server";

// Example: Converting Date for database query
const dateStr = toDateString(new Date()); // "2025-01-10"
await progressRepository.findAfterDate(dateStr);
```

**Used in:**
- `lib/repositories/progress.repository.ts` (10 usages) - Date range queries
- `lib/dashboard-service.ts` (2 usages) - Year/month start calculations

#### Pattern 2: Timezone-Aware Conversion

Use `formatInTimeZone()` from `date-fns-tz` when:
- Getting "today" in user's timezone
- Converting dates for display or comparison in user's local context
- Timezone matters semantically (e.g., "today's progress")

```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { getCurrentUserTimezone } from '@/utils/dateHelpers.server';

// Example: Getting today in user's timezone
const userTimezone = await getCurrentUserTimezone();
const todayInUserTz = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
```

**Used in:**
- `lib/services/progress.service.ts` (1 usage) - Getting today's date
- `lib/services/streak.service.ts` (2 usages) - Date comparisons with timezone awareness

**Rule of Thumb:** If timezone matters semantically, use `formatInTimeZone()`. Otherwise, use `toDateString()`.

**Historical Note:** Before v0.5.0, dates were stored as INTEGER timestamps and required a complex timezone conversion layer (242 lines). This was removed in favor of string storage for semantic correctness and simplicity. See migrations in `scripts/migrations/migrate-*-dates-to-text.ts` and [ADR-014: Date String Storage](./ADRs/ADR-014-DATE-STRING-STORAGE.md).

---

## Section 7: File Organization

**Key Directories:**
- **`lib/`** - Business logic: db (schemas, factory), repositories, services
- **`app/`** - Next.js App Router: pages and API routes
- **`hooks/`** - Custom React hooks for state management
- **`components/`** - Reusable React components
- **`__tests__/`** - Test suites (99+ tests)
- **`drizzle/`** - Database migrations
- **`docs/`** - Architecture docs and ADRs

**Architecture Layers:**
- Routes (`app/api/`) - HTTP handlers
- Services (`lib/services/`) - Business logic
- Repositories (`lib/repositories/`) - Data access
- Database (`lib/db/`) - Drizzle schemas + factory pattern

---

## Section 8: Important References

### Code Examples and Implementation Patterns

For detailed code examples and implementation patterns, see:
- **`.specify/memory/patterns.md`** - 10 production-tested patterns with complete code
- **`docs/AI_CODING_PATTERNS.md`** - Critical patterns and code styles
- **`docs/REPOSITORY_PATTERN_GUIDE.md`** - Complete repository documentation with examples

---

## Section 9: Architecture Decisions

### Architecture Decision Records (ADRs)

- **ADR-001**: MongoDB → SQLite migration (completed Nov 19, 2025)
- **ADR-002**: Book rating system (completed Nov 20, 2025)
- **ADR-003**: Book detail page refactoring (in progress)
- **ADR-004**: Backend service layer (completed Nov 21, 2025)
- **ADR-006**: Timezone-aware date handling (superseded Jan 10, 2026)
- **ADR-014**: Date string storage for calendar days (completed Jan 10, 2026)

### Documentation Files

- **AI_CODING_PATTERNS.md**: Single source of truth for coding patterns
- **REPOSITORY_PATTERN_GUIDE.md**: Complete repository documentation
- **patterns.md** (`.specify/memory/`): Extracted reusable implementation patterns

---

## Section 9: Quick Decision Guide

```
Need Tome database access?
  └─ Use repositories (lib/repositories/)

Need Calibre read access?
  └─ Use lib/db/calibre.ts functions

Need to write to Calibre?
  └─ Use updateCalibreRating() ONLY

Adding business logic?
  └─ Put in appropriate service
     ├─ BookService (book operations)
     ├─ SessionService (session lifecycle)
     └─ ProgressService (progress tracking)

Testing database code?
  └─ Use setDatabase(testDb) + resetDatabase()

Complex client-side filtering?
  └─ Use Page → Hook → Service pattern

Need client-side caching?
  └─ Use LibraryService singleton pattern

Unsure about a pattern?
  └─ Check .specify/memory/patterns.md (with code examples)
```

---

**For comprehensive details, see:**
- Constitution: `.specify/memory/constitution.md`
- Patterns: `.specify/memory/patterns.md`
- Coding Standards: `docs/AI_CODING_PATTERNS.md`
- Repositories: `docs/REPOSITORY_PATTERN_GUIDE.md`
- ADRs: `docs/ADRs/`
- Logging Guide: `docs/LOGGING_GUIDE.md`
