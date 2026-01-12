# Companion Migrations

**Purpose**: Hand-written data transformations that run after Drizzle schema migrations to handle semantic changes that require more than simple DDL operations.

**Pattern**: See [Pattern 11 in .specify/memory/patterns.md](../../.specify/memory/patterns.md)  
**Architecture Decision**: See [ADR-013: Companion Migrations](../../docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md)

---

## What Are Companion Migrations?

SQLite doesn't support `ALTER COLUMN` for type changes. When Drizzle generates migrations that change column types, it creates a new table, copies data AS-IS, and drops the old table. This works for structural changes but **fails for semantic transformations**.

**Example Problem**:
```sql
-- Migration changes progress_date from INTEGER to TEXT
CREATE TABLE __new_progress_logs (progress_date text NOT NULL, ...);
INSERT INTO __new_progress_logs SELECT * FROM progress_logs;
-- Result: 1732507200 → "1732507200" (WRONG! Should be "2025-11-25")
```

**Solution**: Companion migrations run AFTER schema migrations to transform the data:
```typescript
// lib/migrations/0015_progress_dates_timezone.ts
const timestamp = 1732507200;
const dateString = formatInTimeZone(new Date(timestamp * 1000), timezone, 'yyyy-MM-dd');
// Result: "2025-11-25" ✓
```

---

## When to Create a Companion

✅ **Create a companion when**:
- Changing column type (INTEGER → TEXT, TEXT → INTEGER)
- Semantic transformation needed (timestamps → date strings)
- Data format changes (JSON structure updates)
- Complex data migrations (multi-table transformations)

❌ **Don't create a companion when**:
- Simple schema changes (add column, drop column, rename)
- Index creation/deletion
- Constraint changes
- Drizzle can handle it automatically

---

## Execution Flow

```
runMigrations()
  ↓
1. Apply Drizzle schema migrations (DDL)
   → Creates/modifies tables
  ↓
2. Discover companions in lib/migrations/
   → Find files matching {number}_*.ts
   → Sort by migration number
  ↓
3. For each companion:
   → Check if already complete (migration_metadata table)
   → Check if required tables exist (fresh DB = skip)
   → Execute transformation in transaction
   → Mark complete
```

---

## Directory Structure

```
lib/migrations/
├── 0015_progress_dates_timezone.ts    # Companion for migration 0015
├── 0016_session_dates_timezone.ts     # Companion for migration 0016
├── _template.ts                       # Template for new companions
└── README.md                          # This file
```

---

## Creating a New Companion

### Step 1: Generate Schema Migration

```bash
# Make schema changes in lib/db/schema/
bunx drizzle-kit generate
# Creates drizzle/0017_something.sql
```

### Step 2: Identify Migration Number

Look at the generated filename: `drizzle/0017_something.sql` → migration number is `0017`

### Step 3: Create Companion File

```bash
cp lib/migrations/_template.ts lib/migrations/0017_my_transformation.ts
```

### Step 4: Implement Transformation

Edit `0017_my_transformation.ts`:

```typescript
import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0017_my_transformation" });

const migration: CompanionMigration = {
  name: "0017_my_transformation",
  requiredTables: ["my_table"],
  description: "Convert foo from X to Y",
  
  async execute(db) {
    // Get rows that need transformation
    const rows = db.prepare(
      "SELECT id, foo FROM my_table WHERE typeof(foo) = 'integer'"
    ).all();
    
    logger.info({ count: rows.length }, "Found rows to transform");
    
    if (rows.length === 0) return;
    
    // Transform data
    const updateStmt = db.prepare("UPDATE my_table SET foo = ? WHERE id = ?");
    
    for (const row of rows) {
      const transformed = transformValue(row.foo);
      updateStmt.run(transformed, row.id);
    }
    
    logger.info("Transformation complete");
  }
};

export default migration;
```

### Step 5: Test Locally

```bash
# Test with fresh database
rm -rf data/tome.db
npm run db:migrate

# Test with existing database (should convert old format)
# (Assumes you have test data in old format)
npm run db:migrate
```

### Step 6: Commit Both Files

```bash
git add drizzle/0017_something.sql lib/migrations/0017_my_transformation.ts
git commit -m "feat: add migration 0017 with companion"
```

---

## Framework Features

The companion migrations framework (in `lib/db/companion-migrations.ts`) provides:

### Discovery
- Automatically finds `*.ts` files in `lib/migrations/`
- Matches pattern: `{4-digit number}_{description}.ts`
- Sorts by migration number (same order as schema migrations)
- Excludes `_template.ts`

### Idempotency
- Tracks completion in `migration_metadata` table
- Each companion has a unique name (used as completion flag)
- Safe to run multiple times (skips if already complete)

### Fresh Database Support
- Checks if required tables exist before running
- Skips companion if tables don't exist (nothing to transform)
- Marks as complete to avoid future attempts

### Transaction Safety
- Each companion runs in a transaction
- Rolls back on error
- Marks complete only after successful execution

### Logging
- Comprehensive progress reporting with Pino
- Preview of transformations (first 5 records)
- Progress updates every 100 records
- Error details for debugging

---

## Companion Migration Interface

```typescript
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

---

## Example: Timezone-Aware Date Conversion

See `0015_progress_dates_timezone.ts` for a complete example:

1. **Get user timezone** from streaks table (or use default)
2. **Find INTEGER timestamps** using `typeof(column) = 'integer'`
3. **Preview conversions** (log first 5 for verification)
4. **Transform in loop** with progress logging
5. **Use date-fns-tz** for timezone-aware conversion

```typescript
const timestamp = 1732507200; // Unix seconds
const date = new Date(timestamp * 1000); // Convert to milliseconds
const dateString = formatInTimeZone(date, userTimezone, 'yyyy-MM-dd');
// Result: "2025-11-25" in user's timezone
```

---

## Testing Strategy

### Unit Tests
- Framework discovery mechanism
- Completion tracking logic
- Table existence checks
- Error handling

### Integration Tests
- Fresh database (no tables exist)
- Existing database (old format data)
- Partial migration (some completed, some pending)
- Failed migration (rollback verification)

See `__tests__/lib/db/companion-migrations*.test.ts`

---

## Common Patterns

### Type Conversion (INTEGER → TEXT)
```typescript
const rows = db.prepare(
  "SELECT id, column FROM table WHERE typeof(column) = 'integer'"
).all();
```

### Timezone-Aware Dates
```typescript
import { formatInTimeZone } from "date-fns-tz";

const userTimezone = getUserTimezone(db);
const dateString = formatInTimeZone(
  new Date(timestamp * 1000),
  userTimezone,
  'yyyy-MM-dd'
);
```

### Null Handling
```typescript
const value = row.column
  ? transformValue(row.column)
  : null;
```

### Progress Logging
```typescript
if (transformed % 100 === 0) {
  logger.info({ transformed, total: rows.length }, "Progress");
}
```

---

## Troubleshooting

### Companion not running?
- Check filename matches pattern: `{4 digits}_{description}.ts`
- Verify `export default migration;` at end of file
- Ensure `name` field matches filename (without extension)

### Fresh database errors?
- Add all required tables to `requiredTables` array
- Framework will skip if tables don't exist

### Already completed?
- Check `migration_metadata` table for completion flag
- Delete row to re-run: `DELETE FROM migration_metadata WHERE key = 'XXXX_migration_name'`

### Transaction issues?
- Ensure all queries use same `db` instance
- Don't call `db.exec("BEGIN")` or `db.exec("COMMIT")` (framework handles)
- Throw error to trigger rollback

---

## Related Documentation

- **ADR-013**: [Companion Migrations Pattern](../../docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md)
- **Pattern 11**: [Implementation Patterns](.../../.specify/memory/patterns.md)
- **Framework**: [lib/db/companion-migrations.ts](../db/companion-migrations.ts)
- **Examples**:
  - [0015_progress_dates_timezone.ts](./0015_progress_dates_timezone.ts)
  - [0016_session_dates_timezone.ts](./0016_session_dates_timezone.ts)

---

**Questions?** See ADR-013 for comprehensive architecture documentation and decision rationale.
