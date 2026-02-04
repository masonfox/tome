# ADR-013: Companion Migrations Pattern

## Status
✅ **Implemented** - January 11, 2026

## Context

### Problem: Data Transformations During Schema Changes

SQLite doesn't support `ALTER COLUMN` for type changes. When Drizzle generates migrations that change column types, it follows this pattern:

1. Create temporary table with new schema
2. Copy data AS-IS from old table
3. Drop old table
4. Rename temporary table

**Critical Gap**: Data is copied AS-IS without semantic transformation. When changing from INTEGER (Unix timestamp) to TEXT (YYYY-MM-DD), the migration copies raw integers into text columns without conversion.

### Real-World Example

**Migration 0015** (`drizzle/0015_opposite_shatterstar.sql`):
```sql
-- Changes progress_logs.progress_date from INTEGER to TEXT
CREATE TABLE `__new_progress_logs` (
  `progress_date` text NOT NULL,
  -- ...
);
INSERT INTO `__new_progress_logs` SELECT * FROM `progress_logs`;
-- Data copied AS-IS: 1732507200 → "1732507200" (wrong!)
-- Expected: 1732507200 → "2025-11-25" (semantic transformation)
```

**Migration 0016** (`drizzle/0016_outstanding_leader.sql`):
```sql
-- Changes reading_sessions.started_date and completed_date from INTEGER to TEXT
CREATE TABLE `__new_reading_sessions` (
  `started_date` text,
  `completed_date` text,
  -- ...
);
INSERT INTO `__new_reading_sessions` SELECT * FROM `reading_sessions`;
-- Same problem: timestamps copied as-is instead of converted to YYYY-MM-DD
```

### Original Workaround: "Special Migrations" Hack

**File**: `lib/db/migrate.ts` (lines 98-168)

The original solution ran custom Node.js scripts BEFORE schema migrations:

```typescript
// Run data migrations BEFORE schema migrations
if (needsProgressDateMigration) {
  logger.info("Running progress dates data migration...");
  const { migrateProgressDatesToText } = await import(
    "@/scripts/migrations/migrate-progress-dates-to-text"
  );
  await migrateProgressDatesToText();
}

if (needsSessionDateMigration) {
  logger.info("Running session dates data migration...");
  const { migrateSessions } = await import(
    "@/scripts/migrations/migrate-session-dates-to-text"
  );
  await migrateSessions();
}

// THEN run Drizzle schema migrations
migrate(db, { migrationsFolder: "./drizzle" });
```

**Problems with This Approach**:

1. ❌ **Timing paradox**: Data migration runs before tables exist on fresh databases
   - Bug: `rm -rf data && npm run db:migrate` failed
   - Fix: Added table existence checks to every data migration script (boilerplate)

2. ❌ **Ad-hoc tracking**: Each migration script implements its own completion flag
   ```typescript
   const MIGRATION_FLAG_KEY = "progress_dates_migrated_to_text";
   // Duplicated across multiple files
   ```

3. ❌ **No framework**: Every new data migration requires:
   - Table existence checks
   - Migration metadata table creation
   - Completion flag management
   - Transaction handling
   - Error logging

4. ❌ **Confusing execution order**: Data migrations run BEFORE schema migrations
   - Counter-intuitive (DDL before DML makes more sense)
   - Hard to reason about (schema doesn't exist yet but data does?)

5. ❌ **Scattered code**: Migration logic lives in `scripts/migrations/` instead of `lib/migrations/`
   - Not part of core library structure
   - Harder to discover for future developers

### Requirements

1. **Separation of concerns**: Schema changes (DDL) vs semantic transformations (DML)
2. **Fresh database support**: Must work when no tables exist yet
3. **Existing database support**: Must convert old INTEGER data to TEXT format
4. **Idempotency**: Safe to run multiple times
5. **Timezone awareness**: Date conversions must use user's timezone
6. **Framework**: Centralize boilerplate (table checks, completion tracking, transactions)
7. **Discoverability**: Clear location and naming convention
8. **Testability**: Easy to test transformation logic in isolation

## Decision

Implement **Companion Migrations Pattern** - a framework that separates schema migrations from semantic data transformations.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              COMPANION MIGRATIONS ARCHITECTURE               │
└─────────────────────────────────────────────────────────────┘

Schema Migrations (Drizzle-generated)
┌──────────────────────────────────────────────────────────────┐
│ drizzle/0015_opposite_shatterstar.sql                        │
│ - Changes progress_date from INTEGER to TEXT                 │
│ - Copies data AS-IS (no transformation)                      │
└──────────────────────────────────────────────────────────────┘

Companion Migration (Hand-written)
┌──────────────────────────────────────────────────────────────┐
│ lib/migrations/0015_progress_dates_timezone.ts               │
│ - Converts INTEGER timestamps → TEXT YYYY-MM-DD             │
│ - Uses user's timezone for conversion                        │
│ - Handles NULL values, validates format                      │
└──────────────────────────────────────────────────────────────┘

Execution Flow
┌──────────────────────────────────────────────────────────────┐
│ runMigrations()                                              │
│   ↓                                                           │
│ 1. Apply Drizzle schema migrations                           │
│    → migrate(db, { migrationsFolder: "./drizzle" })         │
│    → Creates/modifies tables (DDL)                           │
│   ↓                                                           │
│ 2. Discover companions in lib/migrations/                    │
│    → Find *.ts files matching pattern {number}_*.ts         │
│    → Sort by migration number                                │
│   ↓                                                           │
│ 3. Run companions in schema migration order                  │
│    FOR EACH companion:                                        │
│      → Check if already complete (migration_metadata)        │
│      → Check if required tables exist                        │
│      → Execute transformation in transaction (DML)           │
│      → Mark complete                                          │
└──────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Schema First, Then Data**
   - Schema migrations create/modify tables (DDL)
   - Companion migrations transform existing data (DML)
   - Execution order: DDL → DML (intuitive and correct)

2. **One Companion Per Schema Migration**
   - Not every schema migration needs a companion
   - Only create companions when semantic transformation is needed
   - Naming convention links them: `drizzle/0015_*.sql` → `lib/migrations/0015_*.ts`

3. **Framework Handles Boilerplate**
   - Discovery (find companions in directory)
   - Ordering (execute in same order schema migrations were applied)
   - Table existence checks
   - Completion tracking (using `migration_metadata` table)
   - Transaction management
   - Error handling and logging

4. **Companions Are Idempotent**
   - Check if already complete before running
   - Check if required tables exist (fresh database = skip)
   - Safe to run multiple times (won't duplicate work)

### Directory Structure

```
lib/migrations/
├── 0015_progress_dates_timezone.ts    # Companion for migration 0015
├── 0016_session_dates_timezone.ts     # Companion for migration 0016
├── _template.ts                       # Template for new companions
└── README.md                          # Documentation
```

### Companion Migration Interface

```typescript
/**
 * Companion migration interface
 * 
 * Companions are hand-written data transformations that run after
 * schema migrations to convert existing data when semantic changes
 * are needed (e.g., INTEGER timestamps → TEXT date strings).
 */
export interface CompanionMigration {
  /** Unique name for tracking completion */
  name: string;
  
  /** Tables that must exist for this migration to run */
  requiredTables: string[];
  
  /** Optional description of what this migration does */
  description?: string;
  
  /** Transformation logic - receives database instance */
  execute: (db: Database) => Promise<void>;
}
```

### Framework Implementation

**File**: `lib/db/companion-migrations.ts`

```typescript
/**
 * Discover companion migrations in lib/migrations/
 * Returns migrations sorted by number
 */
function discoverCompanions(): CompanionMigration[] {
  const migrationsDir = path.join(process.cwd(), 'lib/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.match(/^\d{4}_.*\.ts$/) || f.match(/^\d{4}_.*\.js$/))
    .sort(); // Alphabetical = numeric order
  
  return files.map(file => {
    const { default: companion } = require(path.join(migrationsDir, file));
    return companion;
  });
}

/**
 * Check if companion has already been run
 */
function isCompleteMigration(db: Database, name: string): boolean {
  const result = db.prepare(
    "SELECT value FROM migration_metadata WHERE key = ?"
  ).get(name);
  
  return result?.value === "true";
}

/**
 * Check if required tables exist
 */
function tablesExist(db: Database, tables: string[]): boolean {
  for (const table of tables) {
    const result = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table);
    
    if (!result) return false;
  }
  return true;
}

/**
 * Run all companion migrations
 */
export async function runCompanionMigrations(db: Database): Promise<void> {
  const logger = getLogger().child({ module: "companion-migrations" });
  
  // Discover companions
  const companions = discoverCompanions();
  logger.info({ count: companions.length }, "Discovered companion migrations");
  
  for (const companion of companions) {
    // Check if already complete
    if (isCompleteMigration(db, companion.name)) {
      logger.debug({ name: companion.name }, "Companion already complete");
      continue;
    }
    
    // Check if tables exist (fresh database)
    if (!tablesExist(db, companion.requiredTables)) {
      logger.info({ name: companion.name }, "Required tables don't exist, marking complete");
      markComplete(db, companion.name);
      continue;
    }
    
    // Execute transformation
    logger.info({ name: companion.name }, "Running companion migration");
    
    try {
      db.exec("BEGIN TRANSACTION");
      await companion.execute(db);
      markComplete(db, companion.name);
      db.exec("COMMIT");
      
      logger.info({ name: companion.name }, "Companion migration complete");
    } catch (error) {
      db.exec("ROLLBACK");
      logger.error({ name: companion.name, error }, "Companion migration failed");
      throw error;
    }
  }
}
```

### Example Companion Migration

**File**: `lib/migrations/0015_progress_dates_timezone.ts`

```typescript
import { CompanionMigration } from "@/lib/db/companion-migrations";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0015_progress_dates_timezone" });

/**
 * Companion for migration 0015 (progress_date INTEGER → TEXT)
 * 
 * Converts existing Unix timestamps to YYYY-MM-DD strings using
 * the user's configured timezone from the streaks table.
 */
const migration: CompanionMigration = {
  name: "0015_progress_dates_timezone",
  requiredTables: ["progress_logs"],
  description: "Convert progress_date from Unix timestamps to YYYY-MM-DD strings",
  
  async execute(db) {
    // Get user timezone
    const streaksTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='streaks'"
    ).get();
    
    let timezone = "America/New_York";
    if (streaksTable) {
      const streak = db.prepare("SELECT user_timezone FROM streaks LIMIT 1").get();
      timezone = streak?.user_timezone || timezone;
    }
    
    logger.info({ timezone }, "Using timezone for conversion");
    
    // Get all progress logs with INTEGER timestamps
    const logs = db.prepare(
      "SELECT id, progress_date FROM progress_logs WHERE typeof(progress_date) = 'integer'"
    ).all();
    
    logger.info({ count: logs.length }, "Found progress logs to convert");
    
    if (logs.length === 0) {
      logger.info("No INTEGER timestamps found, nothing to convert");
      return;
    }
    
    // Convert timestamps to date strings
    const updateStmt = db.prepare(
      "UPDATE progress_logs SET progress_date = ? WHERE id = ?"
    );
    
    let converted = 0;
    for (const log of logs) {
      const date = new Date(log.progress_date * 1000); // Unix seconds → milliseconds
      const dateString = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      
      updateStmt.run(dateString, log.id);
      converted++;
      
      if (converted % 100 === 0) {
        logger.info({ converted, total: logs.length }, "Progress");
      }
    }
    
    logger.info({ converted }, "Conversion complete");
  }
};

export default migration;
```

### Integration Point

**File**: `lib/db/migrate.ts` (simplified)

```typescript
// BEFORE (215 lines with special migrations hack)
import { migrateProgressDatesToText, isMigrationComplete as isProgressComplete } from "@/scripts/migrations/migrate-progress-dates-to-text";
import { migrateSessions, isMigrationComplete as isSessionComplete } from "@/scripts/migrations/migrate-session-dates-to-text";

// Check if special migrations needed
const needsProgressDateMigration = !isProgressComplete();
const needsSessionDateMigration = !isSessionComplete();

// Run special migrations BEFORE schema migrations
if (needsProgressDateMigration) {
  await migrateProgressDatesToText();
}
if (needsSessionDateMigration) {
  await migrateSessions();
}

// Then run schema migrations
migrate(db, { migrationsFolder: "./drizzle" });

// AFTER (80 lines with companion framework)
import { runCompanionMigrations } from "@/lib/db/companion-migrations";

// Run schema migrations first (DDL)
migrate(db, { migrationsFolder: "./drizzle" });

// Then run companion migrations (DML)
await runCompanionMigrations(db);
```

**Result**: ~135 lines removed, boilerplate centralized in framework.

## Implementation

### Phase 1: Framework ✅ (This ADR)
- Create `lib/db/companion-migrations.ts` framework
- Design CompanionMigration interface
- Implement discovery, ordering, execution logic

### Phase 2: Companions ✅
- Extract `scripts/migrations/migrate-progress-dates-to-text.ts` → `lib/migrations/0015_progress_dates_timezone.ts`
- Extract `scripts/migrations/migrate-session-dates-to-text.ts` → `lib/migrations/0016_session_dates_timezone.ts`
- Create `lib/migrations/_template.ts` for future companions
- Create `lib/migrations/README.md` documentation

### Phase 3: Integration ✅
- Simplify `lib/db/migrate.ts` (remove special migrations hack)
- Add `runCompanionMigrations()` call after schema migrations
- Delete old scripts in `scripts/migrations/`

### Phase 4: Testing ✅
- Unit tests: `__tests__/lib/db/companion-migrations.test.ts` (15-20 tests)
- Integration tests: `__tests__/lib/db/companion-migrations-integration.test.ts` (8-10 tests)
- Update `__tests__/lib/db/migrate.test.ts` (remove special migration tests)

### Phase 5: Documentation ✅
- Update `docs/AI_CODING_PATTERNS.md` (add companion migrations section)
- Add Pattern 11 to `.specify/memory/patterns.md`
- Update `AGENTS.md` (reference new pattern)

## Consequences

### Positive

✅ **Separation of concerns**: Schema (DDL) and data (DML) clearly separated  
✅ **Fresh database support**: Works correctly when no tables exist  
✅ **Framework eliminates boilerplate**: Discovery, tracking, transactions centralized  
✅ **Intuitive execution order**: Schema first, then data (DDL → DML)  
✅ **Clear naming convention**: `{migration_number}_{description}.ts` links to schema migration  
✅ **Idempotent**: Safe to run multiple times  
✅ **Testable**: Easy to test transformation logic in isolation  
✅ **Discoverable**: All companions in `lib/migrations/` with README  
✅ **Scalable**: Adding new companions requires minimal code (framework handles rest)

### Neutral

ℹ️ **Two sources of migration truth**: Drizzle generates schema migrations, developers write companions  
ℹ️ **Ordering dependency**: Companions execute in schema migration order (not filename sort)  
ℹ️ **Manual companion creation**: Developers must remember to create companions when needed

### Negative

⚠️ **Not automatic**: Drizzle doesn't know about companions (developer must create them)  
⚠️ **Breaking change**: Existing migrations must be refactored  
⚠️ **File system coupling**: Discovery relies on directory structure and filename patterns

## Alternatives Considered

### Alternative 1: Drizzle Custom Migrations

**Idea**: Use Drizzle's `sql` migration files instead of generating separate companions

```typescript
// drizzle/0015_custom.sql
-- Schema change
ALTER TABLE progress_logs ...;

-- Data transformation
UPDATE progress_logs SET progress_date = date(progress_date, 'unixepoch', 'localtime');
```

**Rejected Because**:
- ❌ No timezone support (SQLite's localtime uses server timezone)
- ❌ Can't access JavaScript libraries (date-fns-tz)
- ❌ Limited error handling in SQL
- ❌ Hard to test SQL transformations in isolation

### Alternative 2: Python Migration Scripts

**Idea**: Use Python for data transformations (Calibre uses Python)

```python
# scripts/migrations/migrate_dates.py
import sqlite3
from datetime import datetime

def migrate():
    conn = sqlite3.connect('data/tome.db')
    # ... transformation logic
```

**Rejected Because**:
- ❌ Introduces Python dependency to TypeScript project
- ❌ Can't reuse TypeScript utilities (logger, date helpers)
- ❌ Harder to integrate with existing test suite
- ❌ Two languages = more complexity

### Alternative 3: Seed-Based Approach

**Idea**: Store data in seed files, drop and recreate tables

```typescript
// scripts/seed-from-backup.ts
const oldData = JSON.parse(fs.readFileSync('backup.json'));
await db.delete(progressLogs); // Drop all
await db.insert(progressLogs).values(transformed); // Re-insert
```

**Rejected Because**:
- ❌ Destructive (drop/recreate is risky)
- ❌ No partial migration support
- ❌ Requires full data backup before each migration
- ❌ Doesn't scale for large datasets

### Alternative 4: Leave Data AS-IS

**Idea**: Store both INTEGER and TEXT formats, detect at query time

```typescript
const date = typeof row.progress_date === 'number'
  ? formatTimestamp(row.progress_date)
  : row.progress_date;
```

**Rejected Because**:
- ❌ Technical debt accumulates
- ❌ Every query needs type checking
- ❌ Inconsistent data formats in database
- ❌ Makes future schema changes harder

## Migration Guide

### For Developers: Creating a New Companion

**Scenario**: You're adding a migration that changes column type and needs data transformation

**Steps**:

1. **Generate schema migration** (as usual):
   ```bash
   bunx drizzle-kit generate
   # Creates drizzle/0017_something.sql
   ```

2. **Identify migration number** (e.g., `0017`)

3. **Create companion file**:
   ```bash
   cp lib/migrations/_template.ts lib/migrations/0017_my_transformation.ts
   ```

4. **Implement transformation logic**:
   ```typescript
   import { CompanionMigration } from "@/lib/db/companion-migrations";
   
   const migration: CompanionMigration = {
     name: "0017_my_transformation",
     requiredTables: ["my_table"],
     description: "Convert foo from X to Y",
     
     async execute(db) {
       // Your transformation logic here
       const rows = db.prepare("SELECT * FROM my_table WHERE ...").all();
       const updateStmt = db.prepare("UPDATE my_table SET foo = ? WHERE id = ?");
       
       for (const row of rows) {
         const transformed = transformValue(row.foo);
         updateStmt.run(transformed, row.id);
       }
     }
   };
   
   export default migration;
   ```

5. **Test locally**:
   ```bash
   # Fresh database
   rm -rf data/tome.db
   npm run db:migrate
   
   # Existing database
   npm run db:migrate
   ```

6. **Commit both files**:
   ```bash
   git add drizzle/0017_something.sql lib/migrations/0017_my_transformation.ts
   git commit -m "feat: add migration 0017 with companion"
   ```

### For Users: Upgrading Existing Installation

**No action required** - companions run automatically during `npm run db:migrate`.

**Expected behavior**:
1. Pull latest code
2. Run `npm run db:migrate`
3. Schema migrations apply (DDL)
4. Companion migrations run (DML)
5. Data is transformed correctly

## Testing Strategy

### Unit Tests (`companion-migrations.test.ts`)

1. **Discovery**: Verify companions found in `lib/migrations/`
2. **Ordering**: Verify companions sorted by migration number
3. **Completion tracking**: Verify `migration_metadata` used correctly
4. **Table existence**: Verify skips when tables don't exist
5. **Idempotency**: Verify doesn't re-run completed companions
6. **Error handling**: Verify transaction rollback on failure
7. **Logging**: Verify appropriate log messages

### Integration Tests (`companion-migrations-integration.test.ts`)

1. **Fresh database**: Run migrations on empty database, verify no errors
2. **Existing database**: Create old-format data, run migrations, verify conversion
3. **Partial migration**: Run some companions, restart, verify continues correctly
4. **Failed migration**: Simulate error, verify rollback and state
5. **Multiple companions**: Verify all companions run in order

### Test Fixtures (`migration-test-data.ts`)

- Helper functions to create test databases
- Sample data in old formats (INTEGER timestamps)
- Expected transformed data (TEXT date strings)
- Timezone variations (EST, UTC, JST)

## Related ADRs

- [ADR-006: Timezone-Aware Date Handling](./ADR-006-TIMEZONE-AWARE-DATE-HANDLING.md) - Context for date conversion requirements
- [ADR-014: Date String Storage](./ADR-014-DATE-STRING-STORAGE.md) - Decision to use TEXT YYYY-MM-DD format

## References

### Documentation
- [SQLite Data Types](https://www.sqlite.org/datatype3.html)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [date-fns-tz formatInTimeZone](https://date-fns.org/v2.29.3/docs/formatInTimeZone)

### Implementation Files

**Framework**:
- `lib/db/companion-migrations.ts` - Framework implementation
- `lib/db/migrate.ts` - Integration point
- `lib/migrations/README.md` - Documentation

**Companions**:
- `lib/migrations/0015_progress_dates_timezone.ts` - Progress date conversion
- `lib/migrations/0016_session_dates_timezone.ts` - Session date conversion
- `lib/migrations/_template.ts` - Template for new companions

**Tests**:
- `__tests__/lib/db/companion-migrations.test.ts` - Unit tests
- `__tests__/lib/db/companion-migrations-integration.test.ts` - Integration tests
- `__tests__/fixtures/migration-test-data.ts` - Test fixtures

**Old Files (Deleted)**:
- `scripts/migrations/migrate-progress-dates-to-text.ts` - Replaced by 0015 companion
- `scripts/migrations/migrate-session-dates-to-text.ts` - Replaced by 0016 companion

### Commits
- TBD: Initial companion migrations framework
- TBD: Refactor existing migrations to use companions
- TBD: Add comprehensive test coverage

---

**Decision Made By**: Claude Code (AI Assistant)  
**Date**: January 11, 2026  
**Implementation Date**: January 11, 2026  
**Reviewed By**: User (masonfox)  
**Status**: ✅ Implemented
