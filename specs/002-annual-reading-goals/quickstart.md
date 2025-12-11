# Quick Start: Annual Reading Goals

**Date**: 2025-11-27
**Feature**: Annual Reading Goals (002)
**For**: Developers implementing this feature

## Overview

This guide helps you get started implementing the Annual Reading Goals feature. Follow this sequence to build the feature incrementally while maintaining working code at each step.

## Prerequisites

Before starting, ensure you have:

- ✅ Read the [feature specification](./spec.md)
- ✅ Reviewed the [data model](./data-model.md)
- ✅ Familiarized yourself with [API contracts](./contracts/api-reading-goals.yaml)
- ✅ Bun runtime installed (`bun --version` should work)
- ✅ Local Tome instance running (`bun run dev`)

## Development Sequence

### Phase 1: Database Foundation (30-45 min)

**Goal**: Create schema, migration, and repository layer

#### Step 1.1: Create Schema

Create `lib/db/schema/reading-goals.ts`:

```typescript
import { sqliteTable, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const readingGoals = sqliteTable(
  "reading_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"),
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
    userYearIdx: uniqueIndex("idx_goal_user_year").on(
      sql`COALESCE(${table.userId}, -1)`,
      table.year
    ),
    yearIdx: index("idx_goal_year").on(table.year),
    booksGoalCheck: check("books_goal_check", sql`${table.booksGoal} >= 1`),
    yearRangeCheck: check("year_range_check", sql`${table.year} >= 1900 AND ${table.year} <= 9999`),
  })
);

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type NewReadingGoal = typeof readingGoals.$inferInsert;
```

#### Step 1.2: Export from Schema Index

Add to `lib/db/schema/index.ts`:

```typescript
export * from "./reading-goals";
```

#### Step 1.3: Generate Migration

```bash
# Generate migration SQL
bun run db:generate

# Review generated SQL in drizzle/XXXX_add_reading_goals.sql
# Apply migration
bun run db:migrate

# Verify table exists
sqlite3 data/tome.db ".schema reading_goals"
```

**Checkpoint**: Database table created ✅

#### Step 1.4: Create Repository

Create `lib/repositories/reading-goals.repository.ts`:

```typescript
import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { readingGoals, readingSessions } from "@/lib/db/schema";
import type { ReadingGoal, NewReadingGoal } from "@/lib/db/schema";

export class ReadingGoalRepository extends BaseRepository<
  ReadingGoal,
  NewReadingGoal,
  typeof readingGoals
> {
  constructor() {
    super(readingGoals);
  }

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
          userId === null ? isNull(this.table.userId) : eq(this.table.userId, userId),
          eq(this.table.year, year)
        )
      )
      .get();
  }

  async findByUserId(userId: number | null): Promise<ReadingGoal[]> {
    const db = this.getDatabase();
    return await db
      .select()
      .from(this.table)
      .where(userId === null ? isNull(this.table.userId) : eq(this.table.userId, userId))
      .orderBy(desc(this.table.year))
      .all();
  }

  async getBooksCompletedInYear(userId: number | null, year: number): Promise<number> {
    const db = this.getDatabase();
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(readingSessions)
      .where(
        and(
          userId === null ? isNull(readingSessions.userId) : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate),
          sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) = ${year.toString()}`
        )
      )
      .get();
    return result?.count ?? 0;
  }

  async getYearsWithCompletedBooks(
    userId: number | null
  ): Promise<Array<{ year: number; count: number }>> {
    const db = this.getDatabase();
    return await db
      .select({
        year: sql<number>`CAST(strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch')) AS INTEGER)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(readingSessions)
      .where(
        and(
          userId === null ? isNull(readingSessions.userId) : eq(readingSessions.userId, userId),
          isNotNull(readingSessions.completedDate)
        )
      )
      .groupBy(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`)
      .orderBy(desc(sql`strftime('%Y', datetime(${readingSessions.completedDate}, 'unixepoch'))`))
      .all();
  }
}

export const readingGoalRepository = new ReadingGoalRepository();
```

Export from `lib/repositories/index.ts`:

```typescript
export * from "./reading-goals.repository";
```

**Checkpoint**: Repository layer complete ✅

#### Step 1.5: Write Repository Tests

Create `__tests__/repositories/reading-goals.repository.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { readingGoalRepository } from "@/lib/repositories";
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from "../helpers/db-setup";

let testDb;

beforeAll(async () => {
  testDb = await setupTestDatabase(__filename);
});

afterAll(async () => {
  await teardownTestDatabase(testDb);
});

afterEach(async () => {
  await clearTestDatabase(testDb);
});

describe("ReadingGoalRepository", () => {
  describe("findByUserAndYear()", () => {
    test("finds goal for specific year", async () => {
      const goal = await readingGoalRepository.create({
        userId: null,
        year: 2026,
        booksGoal: 40,
      });

      const found = await readingGoalRepository.findByUserAndYear(null, 2026);
      expect(found).toBeDefined();
      expect(found?.id).toBe(goal.id);
      expect(found?.year).toBe(2026);
      expect(found?.booksGoal).toBe(40);
    });

    test("returns undefined for non-existent year", async () => {
      const found = await readingGoalRepository.findByUserAndYear(null, 2099);
      expect(found).toBeUndefined();
    });
  });

  describe("getBooksCompletedInYear()", () => {
    test("counts books completed in specific year", async () => {
      // TODO: Create test books and sessions
      // const count = await readingGoalRepository.getBooksCompletedInYear(null, 2026);
      // expect(count).toBe(expectedCount);
    });
  });
});
```

Run tests:

```bash
bun test __tests__/repositories/reading-goals.repository.test.ts
```

**Checkpoint**: Repository tests passing ✅

---

### Phase 2: Service Layer (45-60 min)

**Goal**: Business logic, validation, and progress calculations

#### Step 2.1: Create Service

Create `lib/services/reading-goals.service.ts`:

```typescript
import { readingGoalRepository } from "@/lib/repositories";
import type { ReadingGoal } from "@/lib/db/schema";
import { differenceInDays, addDays } from "date-fns";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export interface ProgressCalculation {
  booksCompleted: number;
  booksRemaining: number;
  completionPercentage: number;
  paceStatus: "ahead" | "on-track" | "behind";
  daysElapsed: number;
  projectedFinishDate: Date | null;
  daysAheadBehind: number;
}

export interface ReadingGoalWithProgress {
  goal: ReadingGoal;
  progress: ProgressCalculation;
}

export class ReadingGoalsService {
  async getGoal(userId: number | null, year: number): Promise<ReadingGoalWithProgress | null> {
    const goal = await readingGoalRepository.findByUserAndYear(userId, year);
    if (!goal) return null;

    const progress = await this.calculateProgress(userId, year, goal.booksGoal);
    return { goal, progress };
  }

  async calculateProgress(
    userId: number | null,
    year: number,
    booksGoal: number
  ): Promise<ProgressCalculation> {
    const booksCompleted = await readingGoalRepository.getBooksCompletedInYear(userId, year);

    const now = new Date();
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const startOfYearDate = new Date(year, 0, 1);
    const daysElapsed = differenceInDays(now, startOfYearDate);
    const expectedBooks = (booksGoal / daysInYear) * daysElapsed;

    let paceStatus: "ahead" | "on-track" | "behind";
    let daysAheadBehind = 0;

    if (booksCompleted >= expectedBooks + 1) {
      paceStatus = "ahead";
      daysAheadBehind = Math.floor(booksCompleted - expectedBooks);
    } else if (booksCompleted <= expectedBooks - 1) {
      paceStatus = "behind";
      daysAheadBehind = Math.floor(booksCompleted - expectedBooks);
    } else {
      paceStatus = "on-track";
    }

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

  async createGoal(userId: number | null, year: number, booksGoal: number): Promise<ReadingGoal> {
    this.validateYear(year);
    this.validateGoal(booksGoal);

    const existing = await readingGoalRepository.findByUserAndYear(userId, year);
    if (existing) {
      throw new Error(`You already have a goal for ${year}. Edit your existing goal instead.`);
    }

    logger.info({ userId, year, booksGoal }, "Creating reading goal");
    return await readingGoalRepository.create({ userId, year, booksGoal });
  }

  async updateGoal(goalId: number, booksGoal: number): Promise<ReadingGoal> {
    this.validateGoal(booksGoal);

    const existing = await readingGoalRepository.findById(goalId);
    if (!existing) {
      throw new Error("Goal not found");
    }

    if (!this.canEditGoal(existing.year)) {
      throw new Error("Cannot edit goals for past years");
    }

    logger.info({ goalId, booksGoal }, "Updating reading goal");
    return await readingGoalRepository.update(goalId, { booksGoal });
  }

  private validateYear(year: number): void {
    if (!Number.isInteger(year) || year < 1900 || year > 9999) {
      throw new Error("Year must be between 1900 and 9999");
    }
  }

  private validateGoal(booksGoal: number): void {
    if (!Number.isInteger(booksGoal) || booksGoal < 1) {
      throw new Error("Goal must be at least 1 book");
    }
    if (booksGoal > 9999) {
      throw new Error("Goal must be less than 10,000 books");
    }
  }

  private canEditGoal(year: number): boolean {
    return year >= new Date().getFullYear();
  }
}

export const readingGoalsService = new ReadingGoalsService();
```

Export from `lib/services/index.ts`:

```typescript
export * from "./reading-goals.service";
```

**Checkpoint**: Service layer complete ✅

#### Step 2.2: Write Service Tests

Create `__tests__/services/reading-goals.service.test.ts` with tests for validation, progress calculation, and business logic.

```bash
bun test __tests__/services/reading-goals.service.test.ts
```

**Checkpoint**: Service tests passing ✅

---

### Phase 3: API Routes (30-45 min)

**Goal**: REST API endpoints

#### Step 3.1: Create API Route

Create `app/api/reading-goals/route.ts`:

> **Security Note**: This application uses `null` as the userId throughout because it's designed for single-user deployment with cookie-based authentication at the middleware level. The middleware (see `middleware.ts`) currently allows all `/api/*` routes to pass through, relying on the cookie check for page-level access control. For multi-user deployments, you would need to:
> 1. Extract the authenticated user ID from the request (e.g., from a session or JWT)
> 2. Pass the actual userId instead of `null` to all service methods
> 3. Add per-user authorization checks in the API routes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { readingGoalsService } from "@/lib/services";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get("year");

    if (yearParam) {
      const year = parseInt(yearParam);
      if (isNaN(year)) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_YEAR", message: "Year must be a number" } },
          { status: 400 }
        );
      }

      // Note: userId is null for single-user deployments
      // For multi-user, extract authenticated userId from request
      const goalData = await readingGoalsService.getGoal(null, year);
      if (!goalData) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: `No goal found for year ${year}` } },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: goalData });
    } else {
      // Return all goals
      // TODO: Implement getAllGoals in service
      return NextResponse.json({ success: true, data: [] });
    }
  } catch (error) {
    logger.error({ error }, "Failed to get reading goals");
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, booksGoal } = body;

    if (!year || !booksGoal) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELD", message: "year and booksGoal are required" } },
        { status: 400 }
      );
    }

    // Note: userId is null for single-user deployments
    // For multi-user, extract authenticated userId from request
    const goal = await readingGoalsService.createGoal(null, year, booksGoal);
    return NextResponse.json({ success: true, data: goal }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes("already have a goal")) {
      return NextResponse.json(
        { success: false, error: { code: "GOAL_EXISTS", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message.includes("must be")) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: error.message } },
        { status: 400 }
      );
    }

    logger.error({ error }, "Failed to create reading goal");
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
```

**Checkpoint**: Basic API routes working ✅

#### Step 3.2: Test API Routes

```bash
# Start dev server
bun run dev

# Test in another terminal
curl http://localhost:3000/api/reading-goals

# Create goal
curl -X POST http://localhost:3000/api/reading-goals \
  -H "Content-Type: application/json" \
  -d '{"year": 2026, "booksGoal": 40}'

# Get goal
curl http://localhost:3000/api/reading-goals?year=2026
```

**Checkpoint**: API endpoints tested manually ✅

---

### Phase 4: UI Components (60-90 min)

**Goal**: Dashboard widget and Settings form

See `data-model.md` for component examples. Start with:

1. `components/ReadingGoalWidget.tsx` (dashboard display)
2. `components/ReadingGoalForm.tsx` (Settings form)
3. Update `app/dashboard/page.tsx`
4. Update `app/settings/page.tsx`

---

## Testing Strategy

### Unit Tests

```bash
# Test repository
bun test __tests__/repositories/reading-goals.repository.test.ts

# Test service
bun test __tests__/services/reading-goals.service.test.ts
```

### Integration Tests

```bash
# Test API routes
bun test __tests__/api/reading-goals.test.ts
```

### Manual Testing

1. Create goal for current year
2. Verify dashboard shows widget
3. Complete a book, verify progress updates
4. Try editing past year goal (should fail)
5. Create goal for future year
6. Delete a goal

---

## Common Issues

### Migration Fails

**Symptom**: `db:migrate` errors
**Fix**: Check for syntax errors in schema, ensure `db:generate` ran successfully

### Tests Failing with "Database is locked"

**Symptom**: Tests fail intermittently
**Fix**: Ensure `clearTestDatabase()` is in `afterEach()`, not `beforeEach()`

### Progress Not Updating

**Symptom**: Dashboard shows stale data
**Fix**: Check that `completedDate` exists on reading_sessions

### Validation Errors Not Showing

**Symptom**: API returns generic errors
**Fix**: Ensure service validation throws Error with specific messages

---

## Next Steps

After completing this quickstart:

1. Review [tasks.md](./tasks.md) for detailed implementation checklist
2. Run full test suite: `bun test`
3. Check TypeScript types: `bun run tsc --noEmit`
4. Lint code: `bun run lint`
5. Create pull request

---

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Bun Test Framework](https://bun.sh/docs/cli/test)
- [Date-fns Documentation](https://date-fns.org/docs/)
