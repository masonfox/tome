# Data Model: Annual Reading Goals

**Date**: 2025-11-27
**Feature**: Annual Reading Goals (002)

## Overview

This document defines the database schema, types, and relationships for the Annual Reading Goals feature. The data model follows Tome's existing patterns using Drizzle ORM with SQLite.

## Database Schema

### Table: `reading_goals`

**Purpose**: Stores user's annual book reading targets. One goal per user per calendar year.

**Schema Definition** (`lib/db/schema/reading-goals.ts`):

```typescript
import { sqliteTable, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const readingGoals = sqliteTable(
  "reading_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    year: integer("year").notNull(),
    booksGoal: integer("books_goal").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Unique constraint: one goal per user per year
    // COALESCE handles NULL userId in single-user mode (same pattern as streaks table)
    userYearIdx: uniqueIndex("idx_goal_user_year").on(
      sql`COALESCE(${table.userId}, -1)`,
      table.year
    ),
    // Index for year-based queries
    yearIdx: index("idx_goal_year").on(table.year),
    // Check constraint: minimum goal of 1 book
    booksGoalCheck: check("books_goal_check", sql`${table.booksGoal} >= 1`),
    // Check constraint: year must be a valid 4-digit year
    yearRangeCheck: check("year_range_check", sql`${table.year} >= 1900 AND ${table.year} <= 9999`),
  })
);

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
```

**Column Descriptions**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | Auto-increment | Primary key |
| `userId` | INTEGER | Yes | NULL | Foreign key to users table. NULL for single-user mode. |
| `year` | INTEGER | No | - | Calendar year (e.g., 2026). Must be 1900-9999. |
| `booksGoal` | INTEGER | No | - | Target number of books to read. Must be ≥ 1. |
| `createdAt` | INTEGER (timestamp) | No | `unixepoch()` | Unix timestamp when goal was created |
| `updatedAt` | INTEGER (timestamp) | No | `unixepoch()` | Unix timestamp when goal was last modified |

**Constraints**:

1. **Unique Index** (`idx_goal_user_year`): Enforces one goal per user per year
   - Uses `COALESCE(userId, -1)` to handle NULL userId in unique constraint
   - Prevents duplicate goals for the same year

2. **Check Constraint** (`books_goal_check`): Ensures `booksGoal >= 1`
   - Database-level validation prevents invalid data

3. **Check Constraint** (`year_range_check`): Ensures year is between 1900 and 9999
   - Prevents unrealistic year values

**Indexes**:

1. **`idx_goal_user_year`** (unique): Fast lookup for "does this user have a goal for this year?"
2. **`idx_goal_year`** (non-unique): Supports queries like "all goals for 2026"

### Existing Table Usage: `reading_sessions`

**Purpose**: Source of book completion data. No modifications to this table.

**Relevant Columns**:
- `completedDate` (INTEGER timestamp) - Used to determine which year a book was completed
- `userId` (INTEGER nullable) - Links to same user as goals

**Query Pattern**:

```sql
-- Count books completed in a specific year
SELECT COUNT(*) FROM reading_sessions
WHERE user_id IS ?
  AND completed_date IS NOT NULL
  AND strftime('%Y', datetime(completed_date, 'unixepoch')) = ?
```

**Rationale**:
- Read-only access to existing data (aligns with Data Integrity principle)
- No caching layer needed (SQLite is fast enough)
- `strftime()` extracts year from Unix timestamp

## TypeScript Types

### Domain Types

**File**: `lib/db/schema/reading-goals.ts`

```typescript
// Drizzle-inferred types (automatically generated)
export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;

// Example inferred types:
/*
type ReadingGoal = {
  id: number;
  userId: number | null;
  year: number;
  booksGoal: number;
  createdAt: Date;
  updatedAt: Date;
}

type NewReadingGoal = {
  id?: number;
  userId?: number | null;
  year: number;
  booksGoal: number;
  createdAt?: Date;
  updatedAt?: Date;
}
*/
```

### Derived Types

**File**: `lib/services/reading-goals.service.ts`

```typescript
// Progress calculation result
export interface ProgressCalculation {
  booksCompleted: number;        // Books finished this year
  booksRemaining: number;         // goal - completed
  completionPercentage: number;   // (completed / goal) * 100
  paceStatus: "ahead" | "on-track" | "behind";
  daysElapsed: number;            // Days since Jan 1
  projectedFinishDate: Date | null; // null if insufficient data (< 14 days AND < 2 books)
  daysAheadBehind: number;        // Positive if ahead, negative if behind, 0 if on-track
}

// Goal with enriched progress data
export interface ReadingGoalWithProgress {
  goal: ReadingGoal;
  progress: ProgressCalculation;
}

// Year summary for library filter
export interface YearSummary {
  year: number;
  booksCompleted: number;
}
```

### API Request/Response Types

**File**: `app/api/reading-goals/route.ts`

```typescript
// POST /api/reading-goals - Create goal
interface CreateGoalRequest {
  year: number;
  booksGoal: number;
}

interface CreateGoalResponse {
  success: true;
  data: ReadingGoal;
}

// PATCH /api/reading-goals/[id] - Update goal
interface UpdateGoalRequest {
  booksGoal: number;
}

interface UpdateGoalResponse {
  success: true;
  data: ReadingGoal;
}

// GET /api/reading-goals?year=2026 - Get goal(s)
interface GetGoalResponse {
  success: true;
  data: ReadingGoalWithProgress | ReadingGoalWithProgress[];
}

// GET /api/reading-goals/years - Get years with books
interface GetYearsResponse {
  success: true;
  data: YearSummary[];
}

// Error response (all endpoints)
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Entity Relationships

```
┌─────────────────┐
│     users       │ (future multi-user support)
│  (implied)      │
└────────┬────────┘
         │ 1
         │
         │ *
┌────────┴────────────┐
│  reading_goals      │
│                     │
│  id (PK)            │
│  userId (FK, NULL)  │◄─── NULL in single-user mode
│  year               │
│  booksGoal          │
│  createdAt          │
│  updatedAt          │
└─────────────────────┘
         │
         │ (no foreign key - derived relationship)
         │
         ▼
┌─────────────────────┐
│ reading_sessions    │ (existing table, read-only)
│                     │
│  id (PK)            │
│  userId             │
│  bookId (FK)        │
│  completedDate      │◄─── Used to count books per year
│  ...                │
└─────────────────────┘
```

**Relationship Notes**:

1. **No Foreign Key** between `reading_goals` and `reading_sessions`
   - Goals are independent of specific books
   - Progress is calculated by counting completedDate occurrences

2. **userId is Nullable**
   - Supports single-user mode (userId = NULL)
   - Future multi-user support (userId = actual user ID)
   - Unique constraint uses `COALESCE(userId, -1)` pattern

3. **One-to-Many** (implicit):
   - One user → Many goals (one per year)
   - One goal → Many completed books (derived via year match)

## Data Validation Rules

### Database-Level Validation

Enforced by SQLite constraints:

1. **Unique Constraint**: Prevents duplicate (userId, year) combinations
2. **Check Constraint**: `booksGoal >= 1`
3. **Check Constraint**: `1900 <= year <= 9999`
4. **NOT NULL**: year, booksGoal must have values

### Application-Level Validation

Enforced by `ReadingGoalsService`:

```typescript
class ReadingGoalsService {
  private validateYear(year: number): void {
    if (!Number.isInteger(year)) {
      throw new Error("Year must be an integer");
    }
    if (year < 1900 || year > 9999) {
      throw new Error("Year must be between 1900 and 9999");
    }
  }

  private validateGoal(booksGoal: number): void {
    if (!Number.isInteger(booksGoal)) {
      throw new Error("Goal must be an integer");
    }
    if (booksGoal < 1) {
      throw new Error("Goal must be at least 1 book");
    }
    if (booksGoal > 9999) {
      throw new Error("Goal must be less than 10,000 books");
    }
  }

  private canEditGoal(year: number): boolean {
    const currentYear = new Date().getFullYear();
    return year >= currentYear;
  }

  async updateGoal(goalId: number, booksGoal: number): Promise<ReadingGoal> {
    // Validate input
    this.validateGoal(booksGoal);

    // Check if goal exists and is editable
    const existing = await readingGoalRepository.findById(goalId);
    if (!existing) {
      throw new Error("Goal not found");
    }

    if (!this.canEditGoal(existing.year)) {
      throw new Error("Cannot edit goals for past years");
    }

    // Proceed with update
    return await readingGoalRepository.update(goalId, { booksGoal });
  }
}
```

## Data Access Patterns

### Repository Methods

**File**: `lib/repositories/reading-goals.repository.ts`

```typescript
export class ReadingGoalRepository extends BaseRepository<
  ReadingGoal,
  NewReadingGoal,
  typeof readingGoals
> {
  constructor() {
    super(readingGoals);
  }

  /**
   * Find goal for specific user and year
   * Returns undefined if not found
   */
  async findByUserAndYear(
    userId: number | null,
    year: number
  ): Promise<ReadingGoal | undefined> {
    const db = this.getDatabase();
    return await db
      .select()
      .from(this.table)
      .where(
        and(
          userId === null
            ? isNull(this.table.userId)
            : eq(this.table.userId, userId),
          eq(this.table.year, year)
        )
      )
      .get();
  }

  /**
   * Get all goals for a user, ordered by year descending
   */
  async findByUserId(userId: number | null): Promise<ReadingGoal[]> {
    const db = this.getDatabase();
    return await db
      .select()
      .from(this.table)
      .where(
        userId === null
          ? isNull(this.table.userId)
          : eq(this.table.userId, userId)
      )
      .orderBy(desc(this.table.year))
      .all();
  }

  /**
   * Create or update goal for user + year
   */
  async upsert(
    userId: number | null,
    year: number,
    booksGoal: number
  ): Promise<ReadingGoal> {
    const existing = await this.findByUserAndYear(userId, year);

    if (existing) {
      return await this.update(existing.id, { booksGoal });
    } else {
      return await this.create({ userId, year, booksGoal });
    }
  }

  /**
   * Count books completed in a specific year
   * Queries reading_sessions.completedDate
   */
  async getBooksCompletedInYear(
    userId: number | null,
    year: number
  ): Promise<number> {
    const db = this.getDatabase();

    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(readingSessions)
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate),
          sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) = ${year.toString()}`
        )
      )
      .get();

    return result?.count ?? 0;
  }

  /**
   * Get all years with completed books, with counts
   * Used for library year filter dropdown
   */
  async getYearsWithCompletedBooks(
    userId: number | null
  ): Promise<Array<{ year: number; count: number }>> {
    const db = this.getDatabase();

    const results = await db
      .select({
        year: sql<number>`CAST(strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(readingSessions)
      .where(
        and(
          userId === null
            ? isNull(readingSessions.userId)
            : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate)
        )
      )
      .groupBy(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      .orderBy(
        desc(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      )
      .all();

    return results;
  }
}

export const readingGoalRepository = new ReadingGoalRepository();
```

### Service Layer Queries

**File**: `lib/services/reading-goals.service.ts`

```typescript
export class ReadingGoalsService {
  /**
   * Get goal with calculated progress
   */
  async getGoal(
    userId: number | null,
    year: number
  ): Promise<ReadingGoalWithProgress | null> {
    const goal = await readingGoalRepository.findByUserAndYear(userId, year);
    if (!goal) return null;

    const progress = await this.calculateProgress(userId, year, goal.booksGoal);

    return { goal, progress };
  }

  /**
   * Calculate progress for a goal
   */
  async calculateProgress(
    userId: number | null,
    year: number,
    booksGoal: number
  ): Promise<ProgressCalculation> {
    const booksCompleted = await readingGoalRepository.getBooksCompletedInYear(
      userId,
      year
    );

    const now = new Date();
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeapYear(year) ? 366 : 365;

    const startOfYearDate = new Date(year, 0, 1);
    const daysElapsed = differenceInDays(now, startOfYearDate);

    // Expected pace
    const expectedBooks = (booksGoal / daysInYear) * daysElapsed;

    // Pace status
    let paceStatus: "ahead" | "on-track" | "behind";
    let daysAheadBehind = 0;

    if (booksCompleted >= expectedBooks + 1) {
      paceStatus = "ahead";
      daysAheadBehind = Math.floor(booksCompleted - expectedBooks);
    } else if (booksCompleted <= expectedBooks - 1) {
      paceStatus = "behind";
      daysAheadBehind = Math.floor(booksCompleted - expectedBooks); // Negative
    } else {
      paceStatus = "on-track";
    }

    // Projected finish date (only if sufficient data)
    let projectedFinishDate: Date | null = null;
    if (daysElapsed >= 14 || booksCompleted >= 2) {
      const booksPerDay = booksCompleted / daysElapsed;
      if (booksPerDay > 0) {
        const booksRemaining = booksGoal - booksCompleted;
        const daysToFinish = booksRemaining / booksPerDay;
        projectedFinishDate = addDays(now, Math.ceil(daysToFinish));
      }
    }

    return {
      booksCompleted,
      booksRemaining: Math.max(0, booksGoal - booksCompleted),
      completionPercentage: Math.round((booksCompleted / booksGoal) * 100),
      paceStatus,
      daysElapsed,
      projectedFinishDate,
      daysAheadBehind,
    };
  }
}
```

## Migration SQL

**File**: `drizzle/XXXX_add_reading_goals.sql` (generated by Drizzle Kit)

```sql
-- Create reading_goals table
CREATE TABLE `reading_goals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer,
  `year` integer NOT NULL,
  `books_goal` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  CONSTRAINT `books_goal_check` CHECK(`books_goal` >= 1),
  CONSTRAINT `year_range_check` CHECK(`year` >= 1900 AND `year` <= 9999)
);

-- Create unique index for user + year
CREATE UNIQUE INDEX `idx_goal_user_year` ON `reading_goals` (COALESCE(`user_id`, -1), `year`);

-- Create index for year lookups
CREATE INDEX `idx_goal_year` ON `reading_goals` (`year`);
```

## Sample Data

### Example Records

```json
// Goal 1: Current year goal (editable)
{
  "id": 1,
  "userId": null,
  "year": 2026,
  "booksGoal": 40,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}

// Goal 2: Future year goal (editable)
{
  "id": 2,
  "userId": null,
  "year": 2027,
  "booksGoal": 50,
  "createdAt": "2026-12-15T00:00:00.000Z",
  "updatedAt": "2026-12-15T00:00:00.000Z"
}

// Goal 3: Past year goal (read-only)
{
  "id": 3,
  "userId": null,
  "year": 2025,
  "booksGoal": 35,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-06-15T00:00:00.000Z" // Mid-year adjustment
}
```

### Example Progress Calculation

```typescript
// Scenario: Mid-year progress check
const goal = {
  id: 1,
  userId: null,
  year: 2026,
  booksGoal: 40,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

// Current date: July 1, 2026 (day 182 of 365)
// Books completed: 25

const progress = {
  booksCompleted: 25,
  booksRemaining: 15,
  completionPercentage: 63, // (25 / 40) * 100 = 62.5, rounded to 63
  paceStatus: "ahead",
  daysElapsed: 182,
  projectedFinishDate: new Date("2026-10-15"), // Based on current pace
  daysAheadBehind: 5, // 5 books ahead of expected pace
};

// Expected pace: (40 / 365) * 182 = 19.9 books
// Actual: 25 books
// Status: ahead (25 > 19.9 + 1)
```

## Summary

**Database**:
- 1 new table (`reading_goals`)
- 3 indexes (1 unique composite, 1 year, 1 implicit PK)
- 3 check constraints
- No foreign keys (derived relationships via queries)

**Types**:
- 2 base types (ReadingGoal, NewReadingGoal)
- 3 derived types (ProgressCalculation, ReadingGoalWithProgress, YearSummary)
- 5 API request/response interfaces

**Data Access**:
- Repository: 6 methods (CRUD + custom queries)
- Service: 8 methods (orchestration + business logic)

**Performance**:
- Expected queries: <200ms for year-based filters
- Index on year supports fast lookups
- No N+1 queries (single COUNT for progress)
