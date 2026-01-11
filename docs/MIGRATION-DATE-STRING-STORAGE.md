# Migration Guide: Date String Storage

**Target Audience:** Future developers, AI assistants, system administrators  
**Context:** Tome v0.5.0+ uses YYYY-MM-DD strings for calendar day storage  
**Related:** [ADR-014: Date String Storage](./ADRs/ADR-014-DATE-STRING-STORAGE.md)

---

## Overview

As of **v0.5.0 (January 10, 2026)**, Tome stores all calendar day dates as **YYYY-MM-DD strings (TEXT columns)** instead of Unix timestamps (INTEGER columns).

### What Changed

| Field | Old Type | New Type | Example Old | Example New |
|-------|----------|----------|-------------|-------------|
| `progress_logs.progressDate` | INTEGER (Unix epoch) | TEXT (YYYY-MM-DD) | `1704697200` | `"2025-01-08"` |
| `reading_sessions.startedDate` | INTEGER (Unix epoch) | TEXT (YYYY-MM-DD) | `1704697200` | `"2025-01-08"` |
| `reading_sessions.completedDate` | INTEGER (Unix epoch) | TEXT (YYYY-MM-DD) | `1704697200` | `"2025-01-08"` |

### Why This Change?

**Short answer:** Calendar days are not timestamps.

**Long answer:** When a user says "I read on January 8th," they mean a calendar day in their life, not a specific moment in time. Storing as strings ensures dates never shift when users change timezones.

**See ADR-014 for the complete rationale**, including:
- Semantic correctness (dates don't shift with timezone changes)
- Reduced complexity (-242 lines of conversion code)
- Better performance (60-100x faster)
- Industry alignment (Goodreads, Calibre, Todoist all use text dates)

---

## For End Users

### Automatic Migration

**No action required.** The migration runs automatically when you upgrade to v0.5.0+.

1. **Backup** (recommended): Before upgrading, backup your database:
   ```bash
   cp data/tome.db data/tome.db.backup
   ```

2. **Upgrade**: Pull latest code and restart container:
   ```bash
   git pull origin main
   docker-compose down && docker-compose up -d
   ```

3. **First Startup**: May take 1-2 seconds longer (one-time data conversion)
4. **Subsequent Startups**: Normal speed (migration skipped)

### What You'll Notice

✅ **Dates remain stable**: A date logged as "Jan 8" stays "Jan 8" forever  
✅ **Faster UI**: Progress tracking and stats load 60-100x faster  
✅ **Human-readable database**: Inspect with `sqlite3 data/tome.db`  
✅ **No configuration needed**: No TZ environment variable required  

### Troubleshooting

**If migration fails:**

1. Check logs for error messages
2. Restore from backup: `cp data/tome.db.backup data/tome.db`
3. Report issue with logs to GitHub

**If dates look wrong after migration:**

This is extremely unlikely (migration uses your timezone from `streaks` table), but if it happens:
1. Check your timezone setting in Settings → Streak Settings
2. If incorrect, update it (does NOT trigger re-migration)
3. Report issue to GitHub with:
   - Your timezone before/after upgrade
   - Example of date that looks wrong
   - Expected vs actual value

---

## For Developers

### Working with Date Strings

#### Creating Date Strings

**Pattern 1: UTC Conversion (Most Common)**

Use when converting Date objects for database queries:

```typescript
import { toDateString } from "@/utils/dateHelpers.server";

const today = new Date();
const dateStr = toDateString(today); // "2025-01-10"
await progressRepository.findAfterDate(dateStr);
```

**Pattern 2: Timezone-Aware Conversion**

Use when timezone matters semantically (e.g., "today" in user's timezone):

```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { getCurrentUserTimezone } from '@/utils/dateHelpers.server';

const userTimezone = await getCurrentUserTimezone();
const todayInUserTz = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');
```

**Rule of Thumb:** If you're thinking "what time is it in the user's timezone?", use Pattern 2. Otherwise, use Pattern 1.

#### Validating Date Strings

Use `validateDateString()` for API inputs:

```typescript
import { validateDateString } from "@/lib/utils/date-validation";

if (!validateDateString(dateStr)) {
  throw new Error("Invalid date format. Expected YYYY-MM-DD");
}
```

Validates:
- Format: `/^\d{4}-\d{2}-\d{2}$/`
- Calendar validity: No Feb 31, Month 13, etc.
- Leap years: Feb 29 only in leap years

#### Repository Methods

All repository methods now accept/return strings:

```typescript
// ✅ CORRECT
const dateStr = "2025-01-08";
const logs = await progressRepository.findAfterDate(dateStr);

// ❌ WRONG (will cause type error)
const date = new Date("2025-01-08");
const logs = await progressRepository.findAfterDate(date);
```

#### Comparing Dates

**Lexicographic comparison works** because YYYY-MM-DD sorts correctly:

```typescript
"2025-01-08" > "2025-01-07"  // true
"2025-12-31" > "2025-01-01"  // true
"2026-01-01" > "2025-12-31"  // true
```

**SQLite queries:**

```sql
-- ✅ Works correctly
SELECT * FROM progress_logs WHERE progressDate >= '2025-01-08';

-- ✅ Sorting works correctly  
SELECT * FROM progress_logs ORDER BY progressDate DESC;

-- ✅ Date ranges work
SELECT * FROM progress_logs 
WHERE progressDate BETWEEN '2025-01-01' AND '2025-01-31';
```

### Common Mistakes

#### ❌ Mistake 1: Passing Date objects to repositories

```typescript
// ❌ WRONG
const today = new Date();
await progressRepository.findAfterDate(today); // Type error!

// ✅ CORRECT
const dateStr = toDateString(new Date());
await progressRepository.findAfterDate(dateStr);
```

#### ❌ Mistake 2: Using timestamps in new code

```typescript
// ❌ WRONG (old pattern)
const timestamp = Math.floor(Date.now() / 1000);
await db.insert(progressLogs).values({ progressDate: timestamp });

// ✅ CORRECT
const dateStr = toDateString(new Date());
await progressRepository.create({ progressDate: dateStr, ... });
```

#### ❌ Mistake 3: Storing time-of-day in date field

```typescript
// ❌ WRONG (trying to store time)
const dateTimeStr = "2025-01-08T14:30:00";
await progressRepository.create({ progressDate: dateTimeStr });

// ✅ CORRECT (date only)
const dateStr = "2025-01-08";
await progressRepository.create({ progressDate: dateStr });
```

**Note:** If you need time-of-day, add a separate `progressTime TEXT` column (see ADR-014 Future Considerations).

### Test Patterns

#### Unit Tests

```typescript
import { toProgressDate } from "@/test-utils";

it("should create progress log", async () => {
  const dateStr = toProgressDate(new Date("2025-01-08"));
  const log = await progressRepository.create({
    bookId: 1,
    sessionId: 1,
    progressDate: dateStr,
    currentPage: 100
  });
  
  expect(log.progressDate).toBe("2025-01-08");
});
```

#### Integration Tests

```typescript
import { getTodayLocalDate } from "@/utils/dateHelpers";

it("should log progress for today", async () => {
  const today = getTodayLocalDate(); // Returns YYYY-MM-DD string
  
  const response = await fetch('/api/books/1/progress', {
    method: 'POST',
    body: JSON.stringify({
      progressDate: today,
      currentPage: 50
    })
  });
  
  const data = await response.json();
  expect(data.progressDate).toBe(today);
});
```

---

## Migration Details

### How It Works

The migration runs in two phases:

**Phase 1: Data Migration** (TypeScript script)
```typescript
// scripts/migrations/migrate-progress-dates-to-text.ts
// 1. Get user timezone from streaks table
// 2. For each progress log:
//    - Convert Unix timestamp → Date object
//    - Format in user's timezone → YYYY-MM-DD string
//    - UPDATE progress_date with string value
// 3. Mark migration complete in migration_metadata
```

**Phase 2: Schema Migration** (Drizzle)
```sql
-- drizzle/0015_opposite_shatterstar.sql
-- Rebuild table with TEXT column (SQLite pattern)
CREATE TABLE __new_progress_logs (..., progress_date TEXT NOT NULL);
INSERT INTO __new_progress_logs SELECT ... FROM progress_logs;
DROP TABLE progress_logs;
ALTER TABLE __new_progress_logs RENAME TO progress_logs;
```

**Key Insight:** SQLite's flexible typing allows storing TEXT values in INTEGER columns. So Phase 1 stores strings, then Phase 2 changes the column type.

### Idempotency

The migration is **idempotent** (safe to run multiple times):

```typescript
// Check if already migrated
const metadata = await migrationMetadataRepository.findByKey(
  'progress_dates_migrated_to_text'
);
if (metadata?.value === 'true') {
  return; // Skip migration
}
```

### Manual Migration (Advanced)

If you need to run the migration manually (rare):

```bash
cd /path/to/tome
npm run db:migrate
```

This runs:
1. Pre-migration data conversion (Phase 1)
2. Drizzle schema migrations (Phase 2)
3. Manual execution of migrations 0015 & 0016 (workaround for Drizzle bug)

**See `lib/db/migrate.ts` for implementation details.**

---

## Rollback (Emergency Only)

If you need to rollback (extremely rare):

### Option 1: Restore from Backup

```bash
# Stop application
docker-compose down

# Restore backup
cp data/tome.db.backup data/tome.db

# Revert code
git checkout v0.4.x  # Last version before string storage

# Start application
docker-compose up -d
```

### Option 2: Manual SQL Conversion (Not Recommended)

**Warning:** This loses timezone information and assumes UTC.

```sql
-- Convert progress_logs back to timestamps
UPDATE progress_logs
SET progress_date = strftime('%s', progress_date);

-- Convert reading_sessions back to timestamps
UPDATE reading_sessions
SET started_date = strftime('%s', started_date),
    completed_date = strftime('%s', completed_date);
```

**Better:** Restore from backup and report the issue.

---

## FAQs

### Q: Will my historical data be lost?

**A:** No. The migration converts all existing timestamps to strings using your configured timezone. All data is preserved.

### Q: What if I changed timezones in the past?

**A:** The migration uses your **current** timezone from the `streaks` table. Historical dates will be interpreted in that timezone. This is correct for most users (timezone represents your "home" timezone where you physically read).

### Q: Can I add time-of-day later?

**A:** Yes. Add a separate `progress_time TEXT` column (HH:MM format). Don't change `progressDate` back to timestamps. See ADR-014 "Future Considerations" section.

### Q: Will sorting still work?

**A:** Yes. YYYY-MM-DD format sorts lexicographically correct. `"2025-12-31" > "2025-01-01"` works as expected.

### Q: How do I inspect dates in the database?

**A:** Use sqlite3:

```bash
sqlite3 data/tome.db
sqlite> SELECT progressDate, currentPage FROM progress_logs LIMIT 5;
2025-01-08|100
2025-01-09|150
2025-01-10|200
```

Dates are human-readable!

### Q: Will this affect my API clients?

**A:** No. The API contract is unchanged. Dates are sent/received as YYYY-MM-DD strings (same as before).

---

## Resources

- **ADR-014**: Complete architectural decision with rationale
- **Implementation Plan**: `docs/plans/server-side-date-handling-refactor.md`
- **Migration Scripts**: `scripts/migrations/migrate-*-dates-to-text.ts`
- **Validation Tests**: `__tests__/api/progress-date-validation.test.ts` (85 tests)
- **Architecture Guide**: `docs/ARCHITECTURE.md` (Section 6: Date Handling Patterns)

---

**Questions?** Open an issue on GitHub or consult the ADR-014 documentation.

**Last Updated:** January 10, 2026  
**Applies To:** Tome v0.5.0 and later
