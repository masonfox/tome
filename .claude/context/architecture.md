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

**Tables & Relationships:**

```
books (synced from Calibre)
├── calibreId: unique identifier from Calibre
├── title, authors (JSON array), tags (JSON array)
├── publisher, series, seriesIndex, pubDate
├── totalPages, rating (1-5 stars, synced from Calibre)
├── orphaned flag (if removed from Calibre library)
├── path: location in Calibre library
└── lastSynced: timestamp of last sync from Calibre

reading_sessions (1:many per book - re-reading support)
├── bookId: FK → books.id (CASCADE DELETE)
├── sessionNumber: 1, 2, 3... (supports re-reading)
├── isActive: only one per book can be true
├── status: enum [to-read, read-next, reading, read]
├── startedDate, completedDate
├── review: personal notes specific to this reading
└── Indexes:
    ├── Unique (bookId, sessionNumber)
    ├── Partial unique (bookId) WHERE isActive=1
    ├── Index on status

progress_logs (1:many per session)
├── bookId: FK → books.id (CASCADE DELETE)
├── sessionId: FK → reading_sessions.id (CASCADE DELETE)
├── currentPage, currentPercentage (0-100)
├── pagesRead: delta from previous entry
├── progressDate: when progress was logged
├── notes: reader's notes/thoughts
└── Indexes:
    ├── (bookId, progressDate DESC)
    ├── (sessionId, progressDate DESC)
    ├── progressDate DESC (for activity calendar)

streaks (singleton per user)
├── currentStreak: days read consecutively
├── longestStreak: max streak ever reached
├── lastActivityDate: last progress entry
├── streakStartDate: when current streak started
├── totalDaysActive: cumulative days with activity
└── Unique index: COALESCE(userId, -1) (single-user mode)
```

**Key Constraints:**
- Foreign keys with CASCADE DELETE
- Unique constraint on books.calibreId
- CHECK constraints on ratings (1-5)
- CHECK constraints on progress percentages (0-100)
- Temporal validation: progress entries must maintain timeline consistency

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

### API Routes (10 total)

**Books:**
- `GET /api/books` - List with filters, pagination
- `GET/PATCH /api/books/:id` - Book details & updates
- `POST /api/books/:id/rating` - Update rating (Calibre sync)

**Sessions & Status:**
- `GET/POST /api/books/:id/status` - Active session, status updates
- `GET /api/books/:id/sessions` - All sessions (re-reading history)
- `POST /api/books/:id/reread` - Start new reading session

**Progress:**
- `GET/POST /api/books/:id/progress` - Logging, history
- `PATCH/DELETE /api/books/:id/progress/:progressId` - Edit/delete entries

**Calibre:**
- `GET /api/calibre/sync` - Manual trigger
- `GET /api/calibre/status` - Sync status check

**Covers:**
- `GET /api/covers/:path*` - Stream cover images from Calibre library

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

- Calculated from all progress entries (all sessions count together)
- **Metrics**: Current streak, longest streak, total days active, last activity date
- **Calculation**: Consecutive days with at least one progress entry
- **Updates**: Recalculated on progress logging, session creation
- **Persistence**: Rebuilds on re-reading (streak continues)

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

Reference `.specify/memory/patterns.md` for comprehensive patterns. Key patterns:

### Database Factory Pattern (CRITICAL)

Always use `lib/db/factory.ts` for database connections:
- Automatically detects runtime (Bun vs Node.js)
- Selects optimal SQLite driver
- Handles PRAGMA configuration
- **Never** import `bun:sqlite` or `better-sqlite3` directly in application code

### Repository Pattern (PRIMARY PATTERN)

**Rule**: All Tome database access MUST go through repositories.

```typescript
// ✅ Correct
import { bookRepository } from "@/lib/repositories/book.repository";
const books = await bookRepository.findWithFilters({ status: "reading" }, 50, 0);

// ❌ Wrong - Bypass
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all();
```

### Test Database Isolation

All tests use test-specific SQLite database:

```typescript
beforeEach(() => {
  setDatabase(testDb);  // Switch to test database
  resetDatabase();      // Clear test data
});
```

### Service Layer Pattern

Keep route handlers thin (30-50 lines):
1. Parse request
2. Validate input
3. Call service method
4. Format response

Business logic lives in services, not routes.

### Client Service Layer (LibraryService Pattern)

For complex client-side filtering:
- Page → Hook → Service → API → Database
- Service provides caching and API abstraction
- Hook manages state and pagination
- Page orchestrates interactions

---

## Section 7: File Organization

```
tome/
├── lib/                         # Business logic
│   ├── db/
│   │   ├── factory.ts          # Runtime detection, driver selection
│   │   ├── sqlite.ts           # Tome database (Drizzle)
│   │   ├── calibre.ts          # Calibre read-only access
│   │   ├── calibre-write.ts    # Calibre write (ratings only)
│   │   ├── context.ts          # Test database switching
│   │   └── schema/             # Drizzle schemas
│   ├── repositories/           # Repository pattern
│   │   ├── base.repository.ts
│   │   ├── book.repository.ts
│   │   ├── session.repository.ts
│   │   ├── progress.repository.ts
│   │   ├── streak.repository.ts
│   │   └── index.ts
│   ├── services/               # Business logic layer
│   │   ├── book.service.ts
│   │   ├── session.service.ts
│   │   ├── progress.service.ts
│   │   └── index.ts
│   ├── sync-service.ts         # Calibre sync logic
│   ├── calibre-watcher.ts      # File system watcher
│   └── library-service.ts      # Client-side caching service
├── hooks/                      # Custom React hooks
│   ├── useLibraryData.ts
│   ├── useBookDetail.ts
│   ├── useBookStatus.ts
│   ├── useBookProgress.ts
│   └── useBookRating.ts
├── components/                 # React components
│   ├── BookDetail/            # Refactored book detail components
│   │   ├── BookHeader.tsx
│   │   ├── BookMetadata.tsx
│   │   ├── BookProgress.tsx
│   │   ├── ProgressHistory.tsx
│   │   └── SessionDetails.tsx
│   ├── BookCard.tsx
│   ├── Navigation.tsx
│   └── ... other components
├── app/                        # Next.js App Router
│   ├── api/                   # API routes
│   │   └── books/
│   │       ├── route.ts
│   │       └── [id]/
│   │           ├── route.ts
│   │           ├── rating/
│   │           ├── status/
│   │           ├── progress/
│   │           ├── sessions/
│   │           └── reread/
│   ├── library/page.tsx        # Library page
│   ├── books/[id]/page.tsx     # Book detail page
│   ├── dashboard/page.tsx      # Stats page
│   ├── settings/page.tsx       # Settings page
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home/dashboard
├── __tests__/                  # Tests (99+ passing)
│   ├── unit/
│   │   ├── hooks/             # Hook tests
│   │   ├── services/          # Service tests (77 tests)
│   │   └── ...
│   ├── api/                   # API integration tests
│   ├── ui/components/         # Component tests
│   └── integration/           # End-to-end tests
├── drizzle/                    # Database migrations
├── docs/                       # Documentation
│   ├── AI_CODING_PATTERNS.md
│   ├── REPOSITORY_PATTERN_GUIDE.md
│   └── ADRs/
│       ├── ADR-001-MONGODB-TO-SQLITE-MIGRATION.md
│       ├── ADR-002-RATING-ARCHITECTURE.md
│       ├── ADR-003-BOOK-DETAIL-FRONTEND-ARCHITECTURE.md
│       └── ADR-004-BACKEND-SERVICE-LAYER-ARCHITECTURE.md
└── docker-compose.yml          # Docker services
```

---

## Section 8: Important References

### Architecture Decision Records (ADRs)

- **ADR-001**: MongoDB → SQLite migration (completed Nov 19, 2025)
- **ADR-002**: Book rating system (completed Nov 20, 2025)
- **ADR-003**: Book detail page refactoring (in progress)
- **ADR-004**: Backend service layer (completed Nov 21, 2025)

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
- Architecture: `docs/BOOK_TRACKER_ARCHITECTURE.md`
- Coding Patterns: `docs/AI_CODING_PATTERNS.md`
- Repositories: `docs/REPOSITORY_PATTERN_GUIDE.md`
- ADRs: `docs/ADRs/`
