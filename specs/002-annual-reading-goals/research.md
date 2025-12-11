# Research: Annual Reading Goals

**Date**: 2025-11-27
**Feature**: Annual Reading Goals (002)

## Overview

This document consolidates research findings for implementing the Annual Reading Goals feature in the Tome codebase. All technical unknowns from the initial planning phase have been resolved through codebase exploration.

## Technology Stack Confirmation

### Language & Runtime
- **Decision**: TypeScript 5 with Bun runtime
- **Rationale**: Entire codebase uses TypeScript. Bun is used for development (`bun run`, `bun test`) and provides faster execution than Node.js.
- **Alternatives Considered**: Node.js (rejected - project already uses Bun)

### Framework
- **Decision**: Next.js 14 App Router with React Server Components
- **Rationale**: Existing codebase uses App Router pattern. API routes handle backend logic, Server Components reduce client bundle size.
- **Alternatives Considered**: Pages Router (rejected - newer codebase standard is App Router)

### Database & ORM
- **Decision**: SQLite with Drizzle ORM 0.44
- **Rationale**:
  - SQLite aligns with constitution's "Self-Contained Deployment" principle (no external databases)
  - Drizzle provides type-safe schema definitions and query building
  - Existing infrastructure already uses this stack
- **Alternatives Considered**:
  - PostgreSQL (rejected - requires external service, violates constitution)
  - Prisma ORM (rejected - codebase uses Drizzle)

### Testing
- **Decision**: Bun test framework with isolated in-memory SQLite databases
- **Rationale**:
  - Bun test is faster than Jest/Vitest
  - In-memory databases enable parallel test execution
  - Existing `db-setup.ts` helpers support test isolation
- **Alternatives Considered**:
  - Jest (rejected - slower, requires additional configuration)
  - Shared test database (rejected - causes test interference)

## Architecture Patterns

### 1. Repository Pattern

**Decision**: Extend `BaseRepository<T, InsertT, TableT>` for data access

**Structure**:
```typescript
export class ReadingGoalRepository extends BaseRepository<
  ReadingGoal,
  NewReadingGoal,
  typeof readingGoals
> {
  // Inherited: findById, findAll, create, update, delete, exists

  // Custom methods:
  async findByUserAndYear(userId: number | null, year: number): Promise<ReadingGoal | undefined>
  async findByUserId(userId: number | null): Promise<ReadingGoal[]>
  async upsert(userId: number | null, year: number, booksGoal: number): Promise<ReadingGoal>
  async getBooksCompletedInYear(userId: number | null, year: number): Promise<number>
  async getYearsWithCompletedBooks(userId: number | null): Promise<Array<{ year: number; count: number }>>
}
```

**Rationale**:
- Follows existing pattern in `StreakRepository`, `ProgressRepository`
- `getDatabase()` method enables test database switching
- Type-safe with Drizzle's inferred types
- Centralized data access prevents SQL duplication

**Examples from Codebase**:
- `/lib/repositories/streak.repository.ts` - singleton pattern, `findByUserId()`, `getOrCreate()`
- `/lib/repositories/progress.repository.ts` - complex date queries, aggregations
- `/lib/repositories/base.repository.ts` - generic CRUD operations

### 2. Service Layer Pattern

**Decision**: Create `ReadingGoalsService` class with singleton export

**Structure**:
```typescript
export class ReadingGoalsService {
  // Goal management
  async getGoal(userId: number | null, year: number): Promise<ReadingGoalWithProgress>
  async getAllGoals(userId: number | null): Promise<ReadingGoal[]>
  async createGoal(userId: number | null, year: number, booksGoal: number): Promise<ReadingGoal>
  async updateGoal(goalId: number, booksGoal: number): Promise<ReadingGoal>
  async deleteGoal(goalId: number): Promise<void>

  // Progress calculations
  async calculateProgress(userId: number | null, year: number): Promise<ProgressCalculation>
  async getYearsWithBooks(userId: number | null): Promise<YearSummary[]>

  // Validation
  private validateYear(year: number): void
  private validateGoal(booksGoal: number): void
  private canEditGoal(year: number): boolean
}

export const readingGoalsService = new ReadingGoalsService();
```

**Rationale**:
- Services orchestrate repositories and contain business logic
- Validation rules (1 ≤ booksGoal, past years read-only) belong here
- Progress calculations (pace, projection) are domain logic, not data access
- Singleton pattern matches existing services

**Examples from Codebase**:
- `/lib/services/streak.service.ts` - validation in `updateThreshold()`, enrichment in `getStreak()`
- `/lib/services/book.service.ts` - private helpers, repository orchestration

### 3. API Route Structure

**Decision**: RESTful API at `/api/reading-goals` with standard error handling

**Endpoints**:
```
GET    /api/reading-goals                 # List all goals for current user
GET    /api/reading-goals?year=2026       # Get goal for specific year
POST   /api/reading-goals                 # Create new goal
PATCH  /api/reading-goals/[id]            # Update goal
DELETE /api/reading-goals/[id]            # Delete goal
GET    /api/reading-goals/years           # Get years with completed books
```

**Error Response Format**:
```typescript
{
  success: false,
  error: {
    code: "INVALID_YEAR" | "GOAL_EXISTS" | "PAST_YEAR_READONLY" | "MISSING_FIELD",
    message: "Human-readable error message",
    details?: { /* Additional context */ }
  }
}
```

**Rationale**:
- Matches existing pattern in `/app/api/streak/route.ts`
- Structured error codes enable client-side error handling
- Logging with Pino at every endpoint
- Validation errors return 400, not found returns 404, internal errors return 500

**Examples from Codebase**:
- `/app/api/streak/route.ts` - PATCH with validation layers, structured errors
- `/app/api/books/route.ts` - GET with query params, pagination
- `/app/api/books/[id]/route.ts` - dynamic routes, parameter validation

### 4. Database Schema Pattern

**Decision**: Drizzle TypeScript schema with constraints and indexes

**Schema Definition**:
```typescript
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
    userYearIdx: uniqueIndex("idx_goal_user_year").on(
      sql`COALESCE(${table.userId}, -1)`,
      table.year
    ),
    // Index for year-based queries
    yearIdx: index("idx_goal_year").on(table.year),
    // Check constraint: minimum goal of 1
    booksGoalCheck: check("books_goal_check", sql`${table.booksGoal} >= 1`),
  })
);

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
```

**Rationale**:
- Unique constraint prevents duplicate goals for same user+year
- `COALESCE(userId, -1)` handles NULL userId in single-user mode (pattern from `streaks.ts`)
- Check constraint enforces minimum goal at database level
- Timestamp columns use SQLite's `unixepoch()` for consistency
- Inferred types eliminate manual type definitions

**Examples from Codebase**:
- `/lib/db/schema/streaks.ts` - unique index with COALESCE for nullable userId
- `/lib/db/schema/progress-logs.ts` - check constraints, multiple indexes
- `/lib/db/schema/books.ts` - JSON columns for arrays, unique constraints

### 5. Migration Strategy

**Decision**: Use Drizzle Kit to generate SQL migrations from schema changes

**Process**:
```bash
# 1. Add schema file: lib/db/schema/reading-goals.ts
# 2. Export from lib/db/schema/index.ts
# 3. Generate migration
bun run db:generate

# 4. Review generated SQL in drizzle/XXXX_add_reading_goals.sql
# 5. Apply migration
bun run db:migrate
```

**Rationale**:
- Drizzle Kit generates migrations from TypeScript schema diffs
- Avoids manual SQL writing and potential errors
- Migration files are version-controlled and repeatable
- Existing `lib/db/migrate.ts` handles migration execution

**Examples from Codebase**:
- `drizzle.config.ts` - configuration for schema path and output directory
- `package.json` - scripts for `db:generate`, `db:push`, `db:migrate`

### 6. Testing Strategy

**Decision**: Unit tests for services/repositories, integration tests for API routes

**Test Structure**:
```typescript
// __tests__/services/reading-goals.service.test.ts
describe("ReadingGoalsService", () => {
  beforeAll(async () => {
    testDb = await setupTestDatabase(__filename);
  });

  afterEach(async () => {
    await clearTestDatabase(testDb);
  });

  afterAll(async () => {
    await teardownTestDatabase(testDb);
  });

  describe("createGoal()", () => {
    test("creates goal with valid input", async () => { /* ... */ });
    test("rejects goal < 1", async () => { /* ... */ });
    test("rejects duplicate year", async () => { /* ... */ });
  });
});
```

**Key Patterns**:
1. Use `readingGoalsService.method()` instead of direct imports (Bun caching workaround)
2. Isolated in-memory database per test file (`__filename` key)
3. Clear database between tests for isolation
4. Test real SQL queries, not mocks

**Rationale**:
- Existing `db-setup.ts` provides proven test database isolation
- Service layer tests verify business logic and validation
- Repository tests verify SQL correctness
- Integration tests verify HTTP contracts

**Examples from Codebase**:
- `__tests__/lib/streaks.test.ts` - service layer tests, clearTestDatabase in afterEach
- `__tests__/api/books.test.ts` - API integration tests, mock request helper
- `__tests__/helpers/db-setup.ts` - setupTestDatabase, clearTestDatabase

## Progress Calculation Algorithm

### Decision: Calculate on-demand from `reading_sessions.completedDate`

**Query Pattern**:
```sql
SELECT COUNT(*) FROM reading_sessions
WHERE user_id IS ?
  AND completed_date IS NOT NULL
  AND strftime('%Y', datetime(completed_date, 'unixepoch')) = ?
```

**Pace Calculation**:
```typescript
const daysInYear = isLeapYear(year) ? 366 : 365;
const daysElapsed = differenceInDays(now, startOfYear(year));
const expectedBooks = (goal / daysInYear) * daysElapsed;
const actualBooks = booksCompleted;

// Pace status
if (actualBooks >= expectedBooks + 1) return "ahead";
if (actualBooks <= expectedBooks - 1) return "behind";
return "on-track";
```

**Projected Finish Date**:
```typescript
// Only show if: 14+ days elapsed OR 2+ books completed
if (daysElapsed < 14 && booksCompleted < 2) return null;

const booksPerDay = booksCompleted / daysElapsed;
const daysToFinish = (goal - booksCompleted) / booksPerDay;
return addDays(now, Math.ceil(daysToFinish));
```

**Rationale**:
- No caching avoids data staleness (clarification: direct query preferred)
- `completedDate` is source of truth (existing field, no new tracking)
- SQLite's `strftime()` extracts year from Unix timestamp
- Edge case: projection threshold (14 days OR 2 books) prevents unreliable early predictions

**Alternatives Considered**:
- Cached counts in `reading_goals` table (rejected - adds complexity, risk of desync)
- Nightly batch recalculation (rejected - violates constitution's "no external services")

## UI Component Patterns

### Dashboard Widget

**Decision**: Server Component that fetches goal data, Client Component for interactivity

```typescript
// components/ReadingGoalWidget.tsx (Client Component)
"use client";

export function ReadingGoalWidget({ goal, progress }: Props) {
  return (
    <div className="card">
      <h3>{goal.year} Reading Goal</h3>
      <div className="progress-bar">
        <div style={{ width: `${progress.percentage}%` }} />
      </div>
      <p>{progress.booksCompleted} / {goal.booksGoal} books</p>
      <PaceIndicator status={progress.paceStatus} />
      {progress.projectedFinishDate && (
        <p>Projected finish: {formatDate(progress.projectedFinishDate)}</p>
      )}
    </div>
  );
}

// app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const goalData = await readingGoalsService.getGoal(null, currentYear);

  return (
    <div>
      {goalData ? (
        <ReadingGoalWidget goal={goalData.goal} progress={goalData.progress} />
      ) : (
        <CreateGoalPrompt year={currentYear} />
      )}
    </div>
  );
}
```

**Rationale**:
- Server Components reduce client bundle size (data fetching on server)
- Client Components for interactive elements (forms, dropdowns)
- Existing dashboard uses this pattern

### Settings Form

**Decision**: Client Component with form validation and optimistic updates

```typescript
"use client";

export function ReadingGoalForm({ goal, onSave }: Props) {
  const [booksGoal, setBooksGoal] = useState(goal?.booksGoal ?? "");
  const [year, setYear] = useState(goal?.year ?? new Date().getFullYear());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Validation
    if (booksGoal < 1) {
      toast.error("Goal must be at least 1 book");
      return;
    }

    // API call
    const response = await fetch("/api/reading-goals", {
      method: goal ? "PATCH" : "POST",
      body: JSON.stringify({ year, booksGoal }),
    });

    if (response.ok) {
      toast.success("Goal saved!");
      onSave();
    } else {
      const { error } = await response.json();
      toast.error(error.message);
    }
  }

  return <form onSubmit={handleSubmit}>{ /* ... */ }</form>;
}
```

**Rationale**:
- Client-side validation for immediate feedback
- Sonner toast notifications (existing dependency)
- Form matches existing patterns in book/progress forms

## Deployment Considerations

### Database Migration

**Decision**: Automatic migration on application startup

**Implementation**:
```typescript
// lib/db/migrate.ts (existing file)
await runMigrations(); // Runs on server start
```

**Rationale**:
- Existing migrate.ts runs all pending migrations automatically
- New table is created on first deployment
- No manual intervention required (aligns with constitution's "Make Complexity Invisible")

### Backwards Compatibility

**Decision**: New feature, no breaking changes

**Considerations**:
- New table doesn't modify existing schemas
- Existing functionality unaffected
- Users without goals see "Set your goal" prompt

## Performance Benchmarks

### Expected Performance

Based on success criteria and SQLite benchmarks:

| Operation | Target | Expected Actual |
|-----------|--------|-----------------|
| Dashboard load | <2s | ~500ms (single query + calculation) |
| Progress update reflection | <2s | <1s (in-memory calculation) |
| Year filter results | <1s | ~200ms (indexed year extraction) |
| Goal creation | N/A | ~50ms (single INSERT) |

**Rationale**:
- SQLite handles 500+ books without indexing issues
- Year extraction uses `strftime()` which is indexed
- Progress calculation is arithmetic, not complex SQL
- No network requests (local database)

### Optimization Notes

**Not Needed for MVP**:
- Caching (database is fast enough)
- Materialized views (premature optimization)
- Background jobs (violates constitution)

**Future Optimizations** (if scale exceeds expectations):
- Add composite index on `(userId, completedDate)` if year filter slows
- Denormalize book counts if calculations exceed 100ms

## Logging Strategy

### Decision: Pino structured logging with operation tracking

**Log Points**:
```typescript
// Goal creation
logger.info({ userId, year, booksGoal }, "Creating reading goal");

// Progress calculation
logger.debug({ year, booksCompleted, daysElapsed }, "Calculating pace");

// Validation errors
logger.warn({ year, currentYear }, "Cannot edit past year goal");

// Errors
logger.error({ err, goalId }, "Failed to update goal");
```

**Rationale**:
- Existing codebase uses Pino throughout
- Structured logs enable filtering and debugging
- Debug-level for calculations, info for CRUD, error for failures

## Rejected Alternatives

### 1. Separate Progress Tracking Table

**Rejected**: Creating `goal_progress` table to cache book counts

**Rationale**:
- Clarification session confirmed: query existing data directly
- Caching adds complexity (sync logic, potential desync)
- SQLite is fast enough for on-demand calculation
- Violates "Make Complexity Invisible" (users shouldn't worry about sync)

### 2. GraphQL API

**Rejected**: Using GraphQL instead of REST

**Rationale**:
- Entire codebase uses REST API routes
- No existing GraphQL infrastructure
- REST is simpler for CRUD operations
- Would introduce inconsistency

### 3. Real-time Updates with WebSockets

**Rejected**: Push updates to dashboard when books completed

**Rationale**:
- Violates constitution's "Self-Contained Deployment" (requires persistent connections)
- Adds complexity without clear user benefit
- Current pattern: user refreshes page or navigates
- Future enhancement if requested, not MVP

### 4. Multiple Goal Types

**Rejected**: Support page-based goals, time-based goals, genre-specific goals

**Rationale**:
- Spec explicitly scopes to "books read" only
- Feature creep for MVP
- Listed in spec's "Future/Out-of-Scope Enhancements"

## Open Questions: RESOLVED

All technical unknowns have been resolved through codebase exploration:

- ✅ Repository pattern: Extend BaseRepository with custom methods
- ✅ Service layer: Singleton class with business logic
- ✅ API routes: RESTful with structured errors
- ✅ Database schema: Drizzle TypeScript with constraints
- ✅ Testing: Bun test with isolated in-memory databases
- ✅ Progress calculation: On-demand SQL query
- ✅ Migration: Drizzle Kit generates SQL from schema

No blockers remain for Phase 1 (Design & Contracts).
