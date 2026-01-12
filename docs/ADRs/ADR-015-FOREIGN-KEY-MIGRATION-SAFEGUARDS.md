# ADR-015: Foreign Key Migration Safeguards

**Status:** Accepted  
**Date:** 2026-01-12  
**Deciders:** Development Team  
**Related:** ADR-013 (Companion Migrations), ADR-014 (Date String Storage)

## Context

When implementing migrations 0015 and 0016 to convert date columns from INTEGER to TEXT (see ADR-014), we discovered a critical issue with Drizzle ORM's migration system on SQLite that caused complete data loss of 104 progress_logs rows.

### The Problem

**Root Cause:** Drizzle wraps all migrations in a `BEGIN...COMMIT` transaction. In SQLite, `PRAGMA` statements have **no effect inside transactions**:

> "It is not possible to enable or disable foreign key constraints in the middle of a multi-statement transaction (when SQLite is not in autocommit mode)."  
> — [SQLite Documentation](https://www.sqlite.org/pragma.html#pragma_foreign_keys)

**Consequence:** When migrations 0015/0016 included `PRAGMA foreign_keys=OFF` to safely recreate tables (SQLite's workaround for `ALTER COLUMN`), the PRAGMA was silently ignored. This caused:
1. Foreign key constraints remained enabled during table recreation
2. The `INSERT INTO __new_table SELECT * FROM old_table` failed silently
3. All 104 rows were lost with no error message

### Investigation Results

Through extensive testing, we confirmed:
- Manual execution of migration SQL worked correctly (104 rows preserved)
- Drizzle's `migrate()` function lost all data (0 rows)
- Disabling FK at connection level before Drizzle's transaction resolved the issue
- The companion migrations also needed updates to handle TEXT-stored integers

## Decision

We implement a **defensive foreign key management system** with three layers of protection:

### Layer 1: Connection-Level FK Control

Disable foreign keys at the connection level BEFORE Drizzle starts its transaction:

```typescript
const fkWasEnabled = sqlite.pragma('foreign_keys', { simple: true }) === 1;
if (fkWasEnabled) {
  sqlite.pragma('foreign_keys = OFF');
  // ... run migrations ...
  sqlite.pragma('foreign_keys = ON');
}
```

### Layer 2: Defensive Assertions

Verify state changes at every critical point:

1. **Before disabling FK:**
   - Check for existing FK violations (`PRAGMA foreign_key_check`)
   - Log current FK state
   
2. **After disabling FK:**
   - Assert FK is actually OFF
   - Log confirmation

3. **After re-enabling FK:**
   - Assert FK is actually ON
   - Check for new FK violations
   - Log confirmation

4. **Final verification:**
   - Verify FK state matches expected state
   - Log fatal error if mismatch

### Layer 3: Error Context

Wrap all migration operations with comprehensive error handling:

```typescript
try {
  // ... migration logic ...
} catch (error) {
  getLogger().error({
    err: error,
    fkWasEnabled,
    fkStateChanged,
    context: "Migration failed - check logs above for details"
  }, "Migration process failed");
  throw error;
}
```

### Layer 4: Safeguards

Additional protections:

1. **WAL Checkpoint Check**: Detect other active connections (logged, non-blocking)
2. **Pre-Migration FK Check**: Fail fast if violations exist before migration
3. **Post-Migration FK Check**: Fail if migration introduced violations
4. **Atomic FK State Changes**: Use try-finally to ensure FK always restored

## Implementation

### File: `lib/db/migrate.ts`

Key changes:
- Added `fkWasEnabled` and `fkStateChanged` tracking
- Pre-migration FK integrity check (blocking)
- Post-migration FK integrity check (blocking)
- Nested try-finally blocks for atomicity
- Comprehensive error logging with context
- Assertions after each FK state change

### File: `lib/migrations/0015_progress_dates_timezone.ts`

Enhanced query to detect both INTEGER types and numeric TEXT values:

```sql
SELECT id, progress_date FROM progress_logs 
WHERE typeof(progress_date) = 'integer'
   OR (typeof(progress_date) = 'text' 
       AND CAST(progress_date AS INTEGER) = progress_date 
       AND CAST(progress_date AS INTEGER) > 1000000000)
```

This handles cases where Drizzle's table recreation stores INTEGER values as TEXT type.

### File: `lib/migrations/0016_session_dates_timezone.ts`

Same enhancement for session date columns.

## Consequences

### Positive

1. **Data Safety**: Prevents silent data loss during migrations
2. **Early Detection**: Catches FK violations before starting migration
3. **Auditability**: Comprehensive logging of FK state changes
4. **Fail-Safe**: Multiple layers ensure FK state is always correct
5. **Debuggability**: Error context helps diagnose failures

### Negative

1. **Complexity**: More complex migration code
2. **Performance**: Additional FK checks add ~20ms overhead
3. **Coupling**: Tightly coupled to SQLite's FK behavior
4. **Workaround**: Not using Drizzle's intended migration flow

### Neutral

1. **FK Disable Window**: Brief period where FK constraints are off (10-100ms)
   - Mitigated by migration lock preventing concurrent access
   - Logged with WARNING level for audit trail

## Alternatives Considered

### 1. Custom Migration Runner
Replace Drizzle's `migrate()` with our own implementation.

**Rejected:** Too much deviation from Drizzle's ecosystem. Would need to maintain compatibility with Drizzle Kit's migration format.

### 2. Schema-Only Migrations
Add new columns instead of changing types, migrate data, then drop old columns.

**Rejected:** More complex migration workflow, leaves temporary columns, harder to maintain.

### 3. No Foreign Keys
Don't use FK constraints at all.

**Rejected:** Violates data integrity principles from constitution.md.

### 4. File Issue with Drizzle
Request `disableForeignKeys` option in `MigrationConfig`.

**Status:** Should still do this for upstream fix, but need immediate solution.

## Monitoring

The migration system now logs:

- **INFO**: FK state before/after migration
- **WARN**: When FK is disabled (expected during migration)
- **ERROR**: FK violations detected
- **FATAL**: FK state mismatch after migration
- **DEBUG**: FK verification checks passed

All logs include structured data for parsing/alerting.

## Testing

Verified with production database containing:
- 104 progress_logs with INTEGER timestamps
- 750 reading_sessions (30 with dates)

Results:
- ✅ All 104 progress_logs preserved and converted
- ✅ All 30 session dates converted correctly
- ✅ FK violation detection works (tested with corrupted DB)
- ✅ FK state properly restored after migration
- ✅ FK state properly restored after migration failure

## References

- SQLite PRAGMA documentation: https://www.sqlite.org/pragma.html#pragma_foreign_keys
- Drizzle ORM source: `node_modules/drizzle-orm/sqlite-core/dialect.js:migrate()`
- Related: ADR-013 (Companion Migrations), ADR-014 (Date String Storage)

## Future Work

1. File issue with Drizzle ORM team requesting:
   - Option to disable FK wrapping transactions in a `SAVEPOINT` for SQLite
   - Or add `disableForeignKeys: boolean` to `MigrationConfig`
   
2. Consider contributing PR to Drizzle if receptive to feedback

3. Document this pattern in project patterns.md if it becomes reusable
