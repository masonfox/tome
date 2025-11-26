# Data Model: Reading Streak Tracking Enhancement

**Date**: 2025-11-25
**Feature**: Reading Streak Tracking Enhancement

## Overview

This document defines the data model changes and relationships for the enhanced streak tracking feature. The feature builds upon the existing `streaks` table and leverages existing `progress_logs` table for daily activity aggregation.

## Entity Definitions

### Streak (Enhanced)

Represents a user's reading streak tracking data with personalized threshold configuration.

**Table**: `streaks`

**Schema Changes**:
```sql
-- New column to be added via migration
ALTER TABLE streaks ADD COLUMN daily_threshold INTEGER NOT NULL DEFAULT 1
  CHECK (daily_threshold >= 1 AND daily_threshold <= 9999);
```

**Complete Schema** (after migration):
```typescript
{
  id: INTEGER PRIMARY KEY AUTOINCREMENT,
  userId: INTEGER | NULL,              // Nullable for single-user mode
  currentStreak: INTEGER NOT NULL DEFAULT 0,
  longestStreak: INTEGER NOT NULL DEFAULT 0,
  lastActivityDate: INTEGER (timestamp) NOT NULL DEFAULT (unixepoch()),
  streakStartDate: INTEGER (timestamp) NOT NULL DEFAULT (unixepoch()),
  totalDaysActive: INTEGER NOT NULL DEFAULT 0,
  dailyThreshold: INTEGER NOT NULL DEFAULT 1,  // NEW: Pages required per day
  updatedAt: INTEGER (timestamp) NOT NULL DEFAULT (unixepoch())
}
```

**Validation Rules**:
- `dailyThreshold`: Must be between 1 and 9999 (inclusive)
- `currentStreak`: Cannot be negative
- `longestStreak`: Cannot be less than historical maximum
- `lastActivityDate`: Must be valid Unix timestamp
- `streakStartDate`: Must be ≤ lastActivityDate

**Indexes**:
- `idx_streak_user`: Unique index on `COALESCE(userId, -1)` (already exists)

**Relationships**:
- Implicitly related to `progress_logs` via daily aggregation queries
- No foreign key constraints (soft relationship)

---

### Daily Reading Record (Derived)

Virtual entity representing aggregated progress for a calendar day. Not stored as separate table; derived from `progress_logs` via query.

**Source Table**: `progress_logs`

**Aggregation Query**:
```sql
SELECT
  date(progress_date, 'localtime') as date,
  SUM(pages_read) as total_pages
FROM progress_logs
WHERE progress_date >= ?startDate
  AND progress_date <= ?endDate
GROUP BY date(progress_date, 'localtime')
ORDER BY date;
```

**Derived Fields**:
```typescript
{
  date: string,           // YYYY-MM-DD format
  totalPages: number,     // Sum of all progress logs for this day
  thresholdMet: boolean   // Calculated: totalPages >= streak.dailyThreshold
}
```

**Usage**:
- Chart visualization (365 days of data)
- Streak calculation (checking consecutive days)
- Activity calendar display

---

### Reading Goal (Referenced, Not Modified)

Mentioned in spec for "books ahead/behind" calculation. Assumed to exist or will exist in future.

**Assumptions**:
- Contains user's annual reading goal (e.g., 12 books per year)
- If not present, ahead/behind metrics gracefully omitted
- Not created or modified by this feature

**Expected Structure** (for future reference):
```typescript
{
  userId: number | null,
  annualGoal: number,        // Books per year
  createdAt: Date,
  updatedAt: Date
}
```

---

### Streak Analytics (Computed)

Virtual entity combining streak data with historical analytics. Not stored; computed on-demand.

**Computed Fields**:
```typescript
{
  currentStreak: number,
  longestStreak: number,
  dailyThreshold: number,
  totalDaysActive: number,
  lastActivityDate: Date,
  streakStartDate: Date,
  hoursRemainingToday: number,        // Calculated: end of day - now
  dailyReadingHistory: Array<{        // Last 365 days
    date: string,
    pagesRead: number,
    thresholdMet: boolean
  }>,
  booksAheadOrBehind?: number         // Optional: requires reading goal
}
```

## State Transitions

### Streak Lifecycle

```
[New User]
    ↓ (first progress log)
[Streak Created: currentStreak=0, threshold=1]
    ↓ (reading meets threshold)
[Active Streak: currentStreak=1]
    ↓ (consecutive day, meets threshold)
[Growing Streak: currentStreak+=1]
    ↓ (day missed, no reading)
[Broken Streak: currentStreak=0]
    ↓ (new reading activity)
[Restarted Streak: currentStreak=1]
```

### Threshold Change Impact

```
[Current threshold=10, read 15 pages today]
    ↓ (user changes threshold to 20 mid-day)
[New threshold=20, read 15 pages today]
    ↓ (midnight calculation)
[Streak broken: 15 < 20]
```

```
[Current threshold=20, read 15 pages today]
    ↓ (user changes threshold to 10 mid-day)
[New threshold=10, read 15 pages today]
    ↓ (midnight calculation)
[Streak continues: 15 >= 10]
```

## Data Integrity Constraints

### Database-Level Constraints

1. **dailyThreshold Range**: `CHECK (daily_threshold >= 1 AND daily_threshold <= 9999)`
2. **Non-Negative Streaks**: `CHECK (current_streak >= 0)` and `CHECK (longest_streak >= 0)`
3. **Unique User**: `UNIQUE INDEX idx_streak_user ON COALESCE(userId, -1)`

### Application-Level Validation

1. **Threshold Update**: Validate 1 ≤ threshold ≤ 9999 before database write
2. **Streak Calculation**: Ensure consecutive day logic uses timezone-aware dates
3. **Longest Streak**: Never decrease (only increase when currentStreak exceeds it)
4. **Last Activity**: Update only when actual reading progress logged

## Query Patterns

### Critical Queries

1. **Get User Streak**
```sql
SELECT * FROM streaks
WHERE COALESCE(user_id, -1) = COALESCE(?, -1)
LIMIT 1;
```

2. **Update Threshold**
```sql
UPDATE streaks
SET daily_threshold = ?, updated_at = unixepoch()
WHERE id = ?;
```

3. **Get Daily Reading History** (365 days)
```sql
SELECT
  date(progress_date, 'localtime') as date,
  SUM(pages_read) as pages_read
FROM progress_logs
WHERE progress_date >= date('now', '-365 days', 'localtime')
GROUP BY date(progress_date, 'localtime')
ORDER BY date ASC;
```

4. **Check Today's Progress**
```sql
SELECT SUM(pages_read) as total
FROM progress_logs
WHERE date(progress_date, 'localtime') = date('now', 'localtime');
```

### Performance Considerations

- **Streak lookups**: O(1) via unique index on userId
- **Daily aggregation**: O(n) where n ≤ 365 (bounded by date filter)
- **No table scans**: All queries use indexes or date-filtered scans
- **Chart data**: Single aggregation query (no N+1 pattern)

## Migration Plan

### Migration File: `XXXX_add_streak_threshold.sql`

```sql
-- Add daily threshold column with default and constraints
ALTER TABLE streaks
ADD COLUMN daily_threshold INTEGER NOT NULL DEFAULT 1
CHECK (daily_threshold >= 1 AND daily_threshold <= 9999);

-- Backfill existing records (already have default via DDL)
-- No additional backfill needed - default of 1 applied automatically

-- Verify migration
SELECT COUNT(*) as streak_count,
       MIN(daily_threshold) as min_threshold,
       MAX(daily_threshold) as max_threshold
FROM streaks;
```

### Rollback Plan

```sql
-- SQLite doesn't support DROP COLUMN before version 3.35.0
-- If rollback needed, recreate table without column:

-- 1. Create new table without daily_threshold
CREATE TABLE streaks_old AS
SELECT id, user_id, current_streak, longest_streak,
       last_activity_date, streak_start_date, total_days_active, updated_at
FROM streaks;

-- 2. Drop current table
DROP TABLE streaks;

-- 3. Rename old table back
ALTER TABLE streaks_old RENAME TO streaks;

-- 4. Recreate index
CREATE UNIQUE INDEX idx_streak_user
ON streaks(COALESCE(user_id, -1));
```

## Data Flow Diagrams

### Streak Update Flow

```
Progress Log Saved
    ↓
Extract timestamp & pages
    ↓
Determine calendar day (user's local timezone)
    ↓
Aggregate today's progress (SUM pages)
    ↓
Compare against dailyThreshold
    ↓
    ├─ [Threshold met]
    │       ↓
    │   Check last activity date
    │       ↓
    │       ├─ [Same day] → No change
    │       ├─ [Consecutive day] → currentStreak++
    │       └─ [Gap > 1 day] → currentStreak=1
    │
    └─ [Threshold not met]
            ↓
        No streak update (wait for more progress)
```

### Analytics Data Flow

```
User views /streak page
    ↓
Fetch streak record (includes threshold)
    ↓
Query last 365 days of progress (aggregated by date)
    ↓
Calculate derived fields:
  - hoursRemainingToday
  - thresholdMet for each day
  - booksAheadOrBehind (if goal exists)
    ↓
Render chart + stats components
```

## Example Data

### Sample Streak Record

```json
{
  "id": 1,
  "userId": null,
  "currentStreak": 5,
  "longestStreak": 12,
  "lastActivityDate": "2025-11-25T08:00:00Z",
  "streakStartDate": "2025-11-21T08:00:00Z",
  "totalDaysActive": 45,
  "dailyThreshold": 10,
  "updatedAt": "2025-11-25T08:00:00Z"
}
```

### Sample Daily Reading History

```json
[
  { "date": "2025-11-20", "pagesRead": 15, "thresholdMet": true },
  { "date": "2025-11-21", "pagesRead": 8, "thresholdMet": false },
  { "date": "2025-11-22", "pagesRead": 12, "thresholdMet": true },
  { "date": "2025-11-23", "pagesRead": 0, "thresholdMet": false },
  { "date": "2025-11-24", "pagesRead": 20, "thresholdMet": true },
  { "date": "2025-11-25", "pagesRead": 10, "thresholdMet": true }
]
```

## Future Considerations

### Potential Schema Enhancements (Out of Scope)

1. **Threshold History**: Track threshold changes over time for analysis
2. **Multiple Thresholds**: Different thresholds for weekdays vs. weekends
3. **Streak Snapshots**: Archive streak state at milestones (7 days, 30 days, etc.)
4. **Reading Goals Table**: Formalize annual/monthly goal tracking

These enhancements deferred until user demand validated.
