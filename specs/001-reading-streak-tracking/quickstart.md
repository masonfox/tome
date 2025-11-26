# Quickstart: Reading Streak Tracking Enhancement

**Date**: 2025-11-25
**Feature**: Reading Streak Tracking Enhancement

## Overview

This quickstart guide helps developers understand and implement the enhanced streak tracking feature. It covers setup, key concepts, implementation flow, and testing.

## Prerequisites

- Tome development environment set up
- Bun installed (`bun --version` should work)
- Existing codebase cloned on branch `001-reading-streak-tracking`
- Familiarity with Next.js 14, Drizzle ORM, and TypeScript

## Key Concepts

### Daily Threshold

The number of pages a user must read each day to maintain their streak. Configurable from 1-9999 pages per user.

**Default**: 1 page (low barrier to entry)

**User Control**: Can be updated anytime; applies immediately to current day.

### Streak Calculation

Streaks are calculated based on **calendar days** (not 24-hour periods). Days are determined using the user's **device timezone**.

**Example**:
- User reads 10 pages on Nov 24 at 11:59 PM PST
- User reads 5 pages on Nov 25 at 12:01 AM PST
- These count as consecutive days (Nov 24 and Nov 25)

### Timezone Awareness

All streak calculations use the device's **current timezone** at the time of the progress log:
- Supports travelers across timezones
- "Today" always means the user's local calendar day
- Timestamps stored as UTC, timezone applied at calculation time

### Streak Reset Behavior

When a user breaks their streak (misses a day):
- Current streak resets to 0
- When they read again, streak immediately shows 1
- Longest streak remains unchanged (preserved history)

## Architecture Overview

```
User Action (Log Progress)
    ↓
API Route (/api/books/[id]/progress)
    ↓
Progress Service (save progress log)
    ↓
Streak Service (updateStreak)
    ↓
Streak Repository (database operations)
    ↓
SQLite Database (streaks table)
```

## Implementation Flow

### Phase 1: Database Migration

1. **Create Migration File**

```bash
# Create new migration
bun run db:generate

# File created: migrations/XXXX_add_streak_threshold.sql
```

2. **Migration Content**

```sql
-- Add daily threshold column
ALTER TABLE streaks
ADD COLUMN daily_threshold INTEGER NOT NULL DEFAULT 1
CHECK (daily_threshold >= 1 AND daily_threshold <= 9999);
```

3. **Run Migration**

```bash
bun run db:migrate
```

4. **Verify Migration**

```bash
bun run db:studio  # Opens Drizzle Studio
# Check: streaks table has daily_threshold column
```

### Phase 2: Enhance Schema & Repository

1. **Update Schema** (`lib/db/schema/streaks.ts`)

```typescript
export const streaks = sqliteTable(
  "streaks",
  {
    // ... existing fields ...
    dailyThreshold: integer("daily_threshold")
      .notNull()
      .default(1),  // NEW FIELD
    // ... rest of fields ...
  }
);
```

2. **Add Repository Methods** (`lib/repositories/streak.repository.ts`)

```typescript
async updateThreshold(
  streakId: number,
  threshold: number
): Promise<Streak | null> {
  // Validation
  if (threshold < 1 || threshold > 9999) {
    throw new Error("Threshold must be between 1 and 9999");
  }

  // Update
  const [updated] = await this.db
    .update(streaks)
    .set({ dailyThreshold: threshold, updatedAt: new Date() })
    .where(eq(streaks.id, streakId))
    .returning();

  return updated || null;
}
```

### Phase 3: Create Streak Service

1. **New File** (`lib/services/streak.service.ts`)

```typescript
import { streakRepository } from "@/lib/repositories";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export class StreakService {
  async getStreak(userId?: number | null) {
    const streak = await streakRepository.findByUserId(userId || null);
    if (!streak) {
      logger.warn({ userId }, "No streak found for user");
      return null;
    }

    // Add computed field: hours remaining today
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const hoursRemaining = Math.ceil(
      (endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    return {
      ...streak,
      hoursRemainingToday: hoursRemaining,
    };
  }

  async updateThreshold(
    userId: number | null,
    newThreshold: number
  ) {
    // Validate
    if (!Number.isInteger(newThreshold)) {
      throw new Error("Threshold must be an integer");
    }
    if (newThreshold < 1 || newThreshold > 9999) {
      throw new Error("Threshold must be between 1 and 9999");
    }

    // Get existing streak
    const streak = await streakRepository.findByUserId(userId);
    if (!streak) {
      throw new Error("No streak record found");
    }

    // Update threshold
    logger.info(
      { userId, oldThreshold: streak.dailyThreshold, newThreshold },
      "Updating streak threshold"
    );
    return await streakRepository.updateThreshold(streak.id, newThreshold);
  }
}

export const streakService = new StreakService();
```

### Phase 4: Create API Routes

1. **Main Streak Route** (`app/api/streak/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { getLogger } from "@/lib/logger";

const logger = getLogger();

export async function GET(request: NextRequest) {
  try {
    const streak = await streakService.getStreak();

    if (!streak) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STREAK_NOT_FOUND",
            message: "No streak record found for user"
          }
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: streak });
  } catch (error) {
    logger.error({ error }, "Failed to get streak");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { dailyThreshold } = body;

    if (dailyThreshold === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_FIELD",
            message: "dailyThreshold is required"
          }
        },
        { status: 400 }
      );
    }

    const updated = await streakService.updateThreshold(null, dailyThreshold);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ error }, "Failed to update threshold");

    if (error.message.includes("must be between")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_THRESHOLD",
            message: error.message
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      },
      { status: 500 }
    );
  }
}
```

2. **Analytics Route** (`app/api/streak/analytics/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { streakService } from "@/lib/services/streak.service";
import { progressRepository } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "365");

    if (days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PARAMETER",
            message: "days parameter must be between 1 and 365"
          }
        },
        { status: 400 }
      );
    }

    const streak = await streakService.getStreak();
    if (!streak) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "STREAK_NOT_FOUND", message: "No streak found" }
        },
        { status: 404 }
      );
    }

    // Get daily reading history
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const history = await progressRepository.getActivityCalendar(
      startDate,
      new Date()
    );

    // Enrich with thresholdMet flag
    const enriched = history.map((day: any) => ({
      ...day,
      thresholdMet: day.pagesRead >= streak.dailyThreshold,
    }));

    return NextResponse.json({
      success: true,
      data: {
        streak: {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          dailyThreshold: streak.dailyThreshold,
          totalDaysActive: streak.totalDaysActive,
        },
        dailyReadingHistory: enriched,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Unexpected error" }
      },
      { status: 500 }
    );
  }
}
```

### Phase 5: Enhance UI Components

1. **Update StreakDisplay** (`components/StreakDisplay.tsx`)

```typescript
interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;        // NEW
  hoursRemainingToday: number;   // NEW
}

export function StreakDisplay(props: StreakDisplayProps) {
  return (
    <div className="...">
      {/* Existing streak display */}

      {/* NEW: Show threshold and time remaining */}
      <div className="mt-4 text-sm text-gray-600">
        <p>Daily goal: {props.dailyThreshold} pages</p>
        <p>{props.hoursRemainingToday} hours left today</p>
      </div>
    </div>
  );
}
```

2. **Create Settings Component** (`components/StreakSettings.tsx`)

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";

export function StreakSettings({ initialThreshold }: { initialThreshold: number }) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/streak/threshold", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyThreshold: threshold }),
      });

      if (res.ok) {
        toast.success("Threshold updated!");
      } else {
        const error = await res.json();
        toast.error(error.error.message);
      }
    } catch (error) {
      toast.error("Failed to update threshold");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label>Daily Reading Goal (pages)</label>
      <input
        type="number"
        min="1"
        max="9999"
        value={threshold}
        onChange={(e) => setThreshold(parseInt(e.target.value))}
      />
      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
```

### Phase 6: Update Streak Calculation Logic

Modify `lib/streaks.ts` to respect `dailyThreshold`:

```typescript
export async function updateStreaks(userId?: number | null): Promise<Streak> {
  const streak = await streakRepository.findByUserId(userId || null);

  // Get today's progress
  const today = startOfDay(new Date());
  const todayProgress = await progressRepository.getProgressForDate(today);

  // Calculate total pages read today
  const todayPages = todayProgress?.pagesRead || 0;

  // Check if threshold met
  const thresholdMet = todayPages >= (streak?.dailyThreshold || 1);

  if (!thresholdMet) {
    // Threshold not met, return existing streak
    return streak || createDefaultStreak();
  }

  // Threshold met, continue with existing logic...
  // (Check consecutive days, update streak, etc.)
}
```

## Testing

### Unit Tests

```typescript
// tests/unit/streak.service.test.ts
import { describe, test, expect } from "bun:test";
import { StreakService } from "@/lib/services/streak.service";

describe("StreakService", () => {
  test("validates threshold range", async () => {
    const service = new StreakService();

    expect(async () => {
      await service.updateThreshold(null, 0);
    }).toThrow("must be between 1 and 9999");

    expect(async () => {
      await service.updateThreshold(null, 10000);
    }).toThrow("must be between 1 and 9999");
  });
});
```

### Integration Tests

```typescript
// tests/integration/streak.repository.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { createDatabase } from "@/lib/db/factory";
import { setDatabase } from "@/lib/db/context";
import { streakRepository } from "@/lib/repositories";

describe("Streak Repository", () => {
  beforeEach(() => {
    const db = createDatabase(":memory:");
    setDatabase(db);
    // Run migrations...
  });

  test("updates threshold successfully", async () => {
    // Create streak
    const streak = await streakRepository.create({
      userId: null,
      currentStreak: 5,
      longestStreak: 10,
      dailyThreshold: 10,
    });

    // Update threshold
    const updated = await streakRepository.updateThreshold(streak.id, 20);

    expect(updated?.dailyThreshold).toBe(20);
  });
});
```

### Manual Testing

```bash
# 1. Start dev server
bun run dev

# 2. Test GET streak
curl http://localhost:3000/api/streak

# 3. Test PATCH threshold
curl -X PATCH http://localhost:3000/api/streak/threshold \
  -H "Content-Type: application/json" \
  -d '{"dailyThreshold": 15}'

# 4. Test analytics
curl "http://localhost:3000/api/streak/analytics?days=30"
```

## Common Pitfalls

### 1. Timezone Confusion

**Problem**: Streak calculation uses UTC instead of local timezone

**Solution**: Always use `date-fns` functions with timezone awareness:
```typescript
import { startOfDay } from "date-fns";
const today = startOfDay(new Date());  // Uses local timezone
```

### 2. Missing Threshold Validation

**Problem**: User sets threshold to 0 or negative

**Solution**: Validate at both API and database level:
- API: Check in request handler
- Database: CHECK constraint ensures integrity

### 3. Incorrect Streak Reset Logic

**Problem**: Streak shows 0 when user reads after breaking

**Solution**: Immediately increment to 1 when threshold met:
```typescript
if (daysDiff > 1) {
  // Streak broken, start fresh
  currentStreak = thresholdMet ? 1 : 0;
}
```

## Debugging Tips

### Enable Debug Logging

```bash
# Set log level to debug
DEBUG_DB_CONTEXT=1 bun run dev
```

### Check Streak Calculation

```typescript
// Add to streak update function
logger.debug({
  todayPages,
  threshold: streak.dailyThreshold,
  thresholdMet,
  daysDiff,
}, "Streak calculation details");
```

### Inspect Database

```bash
# Open Drizzle Studio
bun run db:studio

# Or use SQLite CLI
sqlite3 data/tome.db
sqlite> SELECT * FROM streaks;
```

## Deployment Checklist

- [ ] Migration file created and tested
- [ ] Schema updated with dailyThreshold
- [ ] Repository methods added for threshold operations
- [ ] Service layer implements business logic
- [ ] API routes created and tested
- [ ] UI components enhanced
- [ ] Streak calculation logic updated
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Logging added for debugging
- [ ] Error handling implemented
- [ ] Documentation updated

## Next Steps

After implementing this feature:

1. **Run full test suite**: `bun test`
2. **Check for TypeScript errors**: `bun run build`
3. **Test locally**: Manual testing workflow
4. **Create pull request**: Follow Tome PR guidelines
5. **Deploy**: After approval and merge

## Support & Resources

- **Spec**: `specs/001-reading-streak-tracking/spec.md`
- **Data Model**: `specs/001-reading-streak-tracking/data-model.md`
- **API Contracts**: `specs/001-reading-streak-tracking/contracts/api.md`
- **Research**: `specs/001-reading-streak-tracking/research.md`

## Questions?

If you encounter issues during implementation, check:
1. Existing streak logic in `lib/streaks.ts`
2. Repository patterns in `lib/repositories/`
3. Similar API routes in `app/api/`
4. Test examples in `tests/`
