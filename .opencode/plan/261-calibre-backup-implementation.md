# Plan: Add Calibre DB Backup (#261)

**Issue**: https://github.com/masonfox/tome/issues/261  
**Created**: 2026-01-13  
**Status**: Testing Complete - Ready for Manual Testing

## Context

Currently, Tome backs up its own database (`tome.db`) before migrations run (both in Docker startup via `docker-entrypoint.sh` and manually via `scripts/backup-database.sh`). However, there's no backup of the Calibre database (`metadata.db`), which poses a risk if migrations that interact with Calibre (like rating sync) cause issues.

### Current Backup System
- **Location**: `backup_database()` in `docker-entrypoint.sh` + `scripts/backup-database.sh`
- **Trigger**: Before migrations (Docker startup) or manual (`npm run db:backup`)
- **Storage**: `./data/backups/YYYY-MM-DD/tome.db.backup-TIMESTAMP` (date-based folders)
- **Retention**: Last 3 backups across all date folders
- **Components**: Main `.db` file + `-wal` + `-shm` files (WAL mode)

### Design Decisions
1. **DRY Approach**: Consolidate backup logic into TypeScript (`lib/db/backup.ts`) to eliminate duplication between `docker-entrypoint.sh` and shell scripts
2. **Naming**: Use `BACKUP_CALIBRE_DB` env var (defaults to `true`)
3. **Failure Handling**: Continue with warning if Calibre backup fails (log warning, proceed with Tome backup)
4. **Out of Scope**: Restore functionality for Calibre (violates "Calibre as Source of Truth" principle)
5. **Testing**: Add automated tests for the backup module

---

## Phase 1: Create Unified Backup Module

### Task 1.1: Create `lib/db/backup.ts` module
**Status**: ✅ Complete

Created TypeScript module with full backup functionality (~650 lines):
- `createBackup()` - Single database backup with WAL/SHM support
- `cleanupOldBackups()` - Retention policy implementation
- `listBackups()` - Structured backup listing
- `getBackupConfig()` - Environment variable reading
- `createBackups()` - Dual-database backup orchestration
- CLI execution support with `--docker-mode` flag

---

### Task 1.2: Implement backup cleanup logic
**Status**: ✅ Complete

Implemented in `lib/db/backup.ts`:
- Finds backups across all date folders
- Sorts by modification time
- Keeps last N backups (configurable)
- Removes empty date folders
- Handles WAL/SHM file cleanup

---

### Task 1.3: Implement backup listing logic
**Status**: ✅ Complete

Implemented in `lib/db/backup.ts` with full metadata:
- Timestamp parsing and formatting
- Size calculations (human-readable)
- WAL/SHM detection
- Date folder grouping
- Sorted output (newest first)

---

## Phase 2: Integrate Calibre Backup

### Task 2.1: Update backup module for dual-database support
**Status**: ✅ Complete

Implemented `createBackups()` with:
- Required Tome DB backup
- Optional Calibre DB backup
- Graceful failure handling (Calibre failure doesn't block Tome)
- Same timestamp for correlated backups
- Cleanup for both databases

---

### Task 2.2: Add environment variable configuration
**Status**: ✅ Complete

Updated `.env.example` with:
```bash
# Calibre DB Backup Configuration
BACKUP_CALIBRE_DB=true  # Set to false to disable Calibre backups
```

Defaults to `true` to enable backups by default.

---

## Phase 3: Replace Shell Scripts with TypeScript

### Task 3.1: Create `scripts/backup.ts`
**Status**: ✅ Complete

Created CLI wrapper (~120 lines) with:
- User-friendly console output
- Configuration display
- Backup results summary
- Total backup count
- Error handling

---

### Task 3.2: Create `scripts/list-backups.ts`
**Status**: ✅ Complete

Created CLI wrapper (~110 lines) with:
- Date folder grouping
- Tome and Calibre backup icons
- Size and timestamp display
- WAL/SHM indicators
- Empty directory handling

---

### Task 3.3: Update `docker-entrypoint.sh` to use TypeScript backup
**Status**: ✅ Complete

Replaced 35-line bash function with 9-line TypeScript call:
```bash
backup_database() {
  echo "Creating database backup(s)..."
  if npx tsx lib/db/backup.ts --docker-mode 2>&1; then
    echo "Backup(s) created successfully"
  else
    echo "ERROR: Backup failed"
    return 1
  fi
}
```

---

### Task 3.4: Make `lib/db/backup.ts` executable as CLI
**Status**: ✅ Complete

Added CLI execution support with:
- `--docker-mode` flag for minimal output
- Direct execution via tsx
- Proper exit codes

---

### Task 3.5: Update package.json scripts
**Status**: ✅ Complete

Updated scripts:
```json
{
  "db:backup": "tsx scripts/backup.ts",
  "db:list-backups": "tsx scripts/list-backups.ts"
}
```

---

### Task 3.6: Mark old shell scripts for removal
**Status**: ✅ Complete

Added deprecation warnings to:
- `scripts/backup-database.sh`
- `scripts/list-backups.sh`

---

## Phase 4: Testing

### Task 4.1: Create `__tests__/lib/db/backup.test.ts`
**Status**: ✅ Complete (30 tests, all passing)

Comprehensive test coverage:

**createBackup() Tests** (10 tests):
1. ✅ Successful backup of single database
2. ✅ Include WAL file when present
3. ✅ Include SHM file when present
4. ✅ Include both WAL and SHM files
5. ✅ Create date-based folder structure
6. ✅ Use custom timestamp when provided
7. ✅ Skip WAL/SHM when includeWal is false
8. ✅ Handle missing source database
9. ✅ Handle unreadable source database
10. ✅ Handle write permission errors

**cleanupOldBackups() Tests** (5 tests):
11. ✅ Keep only last N backups
12. ✅ Remove empty date folders
13. ✅ Delete associated WAL and SHM files
14. ✅ Handle nonexistent backup directory
15. ✅ Handle cleanup errors gracefully

**listBackups() Tests** (6 tests):
16. ✅ Return correct backup info
17. ✅ Handle empty backup directory
18. ✅ Sort backups by timestamp (newest first)
19. ✅ Handle nonexistent backup directory
20. ✅ Ignore WAL and SHM files in listing
21. ✅ Handle backups across multiple date folders

**getBackupConfig() Tests** (2 tests):
22. ✅ Return config structure
23. ✅ Allow custom config via createBackups()

**createBackups() Tests** (7 tests):
24. ✅ Back up both Tome and Calibre databases
25. ✅ Continue when Calibre backup fails
26. ✅ Respect BACKUP_CALIBRE_DB=false
27. ✅ Skip Calibre when CALIBRE_DB_PATH not set
28. ✅ Fail when Tome backup fails
29. ✅ Clean up old backups after creating new ones
30. ✅ Use same timestamp for correlated backups

**Test Results**: All 30 tests passing, 2981 total tests in suite pass

---

### Task 4.2: Create `__tests__/scripts/backup.test.ts`
**Status**: ⏭️ Skipped

Decision: Manual testing of CLI scripts is sufficient. Core functionality is covered by unit tests.

---

### Task 4.3: Manual testing checklist
**Status**: ⏭️ Ready for Phase 5
# Backup Configuration
# Backup Calibre database before migrations (requires CALIBRE_DB_PATH)
# Set to false to disable Calibre backups
BACKUP_CALIBRE_DB=true
```

Add documentation comment explaining:
- Only applies when CALIBRE_DB_PATH is set
- Backups stored alongside Tome backups
- Same retention policy (last 3)
- Can be disabled for performance/storage reasons

---

## Phase 3: Replace Shell Scripts with TypeScript

### Task 3.1: Create `scripts/backup.ts` CLI wrapper
**Status**: Pending

Create new TypeScript script to replace `scripts/backup-database.sh`:

```typescript
#!/usr/bin/env tsx
/**
 * Manual Database Backup Script
 * 
 * Creates timestamped backups of Tome and (optionally) Calibre databases.
 * Includes WAL and SHM files for consistency.
 * 
 * Usage:
 *   npm run db:backup
 *   tsx scripts/backup.ts
 */
```

**Implementation**:
- Import `createBackups` from `lib/db/backup.ts`
- Use pretty console output with emojis and colors
- Show progress for each database
- Display backup locations and sizes
- Show total backup count after completion
- Handle errors gracefully with clear messages
- Exit with proper exit codes

---

### Task 3.2: Create `scripts/list-backups.ts` CLI wrapper
**Status**: Pending

Create new TypeScript script to replace `scripts/list-backups.sh`:

```typescript
#!/usr/bin/env tsx
/**
 * List Database Backups Script
 * 
 * Lists all available database backups with details.
 * Sorted by date (newest first).
 * 
 * Usage:
 *   npm run db:list-backups
 *   tsx scripts/list-backups.ts
 */
```

**Features**:
- Show both Tome and Calibre backups
- Group by date folder
- Display paired backups (same timestamp)
- Calculate total size
- Show backup details (WAL/SHM status)
- Pretty formatted output

---

### Task 3.3: Update `docker-entrypoint.sh` to use TypeScript backup
**Status**: Pending

Replace the `backup_database()` function in `docker-entrypoint.sh`:

**Before**:
```bash
backup_database() {
  # 70 lines of bash code...
}
```

**After**:
```bash
backup_database() {
  echo "Creating database backup(s)..."
  if npx tsx lib/db/backup.ts --docker-mode 2>&1; then
    echo "Backup(s) created successfully"
  else
    echo "ERROR: Backup failed"
    return 1
  fi
}
```

**Notes**:
- Add `--docker-mode` flag to suppress interactive prompts
- Ensure minimal output for Docker logs
- Maintain same error handling behavior

---

### Task 3.4: Make `lib/db/backup.ts` executable as CLI
**Status**: Pending

Add CLI execution logic to `lib/db/backup.ts`:

```typescript
// At end of file:
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const dockerMode = process.argv.includes('--docker-mode');
  // Run backup with appropriate output formatting
}
```

---

### Task 3.5: Update package.json scripts
**Status**: Pending

Update npm scripts:
```json
{
  "db:backup": "tsx scripts/backup.ts",
  "db:list-backups": "tsx scripts/list-backups.ts",
  "db:restore": "bash scripts/restore-database.sh"
}
```

---

### Task 3.6: Mark old shell scripts for removal
**Status**: Pending

**Do NOT delete yet** - keep for reference during testing:
- `scripts/backup-database.sh` → replaced by `scripts/backup.ts`
- `scripts/list-backups.sh` → replaced by `scripts/list-backups.ts`

Add deprecation comments at top of each file pointing to new TypeScript versions.

---

## Phase 4: Testing

### Task 4.1: Create `__tests__/lib/db/backup.test.ts`
**Status**: Pending

Test coverage for core backup module:

**Test Cases**:
1. `createBackup()` - successful backup of single database
2. `createBackup()` - includes WAL and SHM files
3. `createBackup()` - creates date-based folder structure
4. `createBackup()` - handles missing source database
5. `createBackup()` - handles unreadable source database
6. `createBackup()` - handles write permission errors
7. `cleanupOldBackups()` - keeps only last N backups
8. `cleanupOldBackups()` - removes empty date folders
9. `listBackups()` - returns correct backup info
10. `listBackups()` - handles empty backup directory
11. `createBackups()` - backs up both Tome and Calibre
12. `createBackups()` - continues when Calibre backup fails
13. `createBackups()` - respects BACKUP_CALIBRE_DB=false
14. `createBackups()` - skips Calibre when CALIBRE_DB_PATH not set
15. `getBackupConfig()` - reads environment variables correctly

**Test Setup**:
- Use temporary directories for test backups
- Create mock database files (don't need real SQLite)
- Test with and without WAL/SHM files
- Mock file permission errors
- Clean up temp files after each test

---

### Task 4.2: Create `__tests__/scripts/backup.test.ts`
**Status**: Pending

Integration tests for CLI scripts:

**Test Cases**:
1. CLI script runs successfully
2. CLI script handles errors gracefully
3. CLI script respects environment variables
4. Docker mode suppresses interactive output

**Note**: These tests will execute the actual scripts in a test environment.

---

### Task 4.3: Manual testing checklist
**Status**: Pending

Create manual testing checklist in this plan (see Phase 5).

---

## Phase 5: Manual Testing & Validation

### Task 5.1: Test backup creation
**Status**: Pending

**Test Scenarios**:
- [ ] Run `npm run db:backup` with only Tome DB configured
- [ ] Run `npm run db:backup` with both Tome and Calibre configured
- [ ] Run `npm run db:backup` with `BACKUP_CALIBRE_DB=false`
- [ ] Run `npm run db:backup` when Calibre DB doesn't exist
- [ ] Run `npm run db:backup` when Calibre DB is not readable
- [ ] Verify date-based folder structure is created
- [ ] Verify WAL and SHM files are backed up
- [ ] Verify backup naming: `tome.db.backup-YYYYMMDD_HHMMSS` and `metadata.db.backup-YYYYMMDD_HHMMSS`

---

### Task 5.2: Test backup retention
**Status**: Pending

**Test Scenarios**:
- [ ] Create 5 backups, verify only last 3 remain
- [ ] Verify cleanup works across date folders
- [ ] Verify empty date folders are removed

---

### Task 5.3: Test backup listing
**Status**: Pending

**Test Scenarios**:
- [ ] Run `npm run db:list-backups`
- [ ] Verify both Tome and Calibre backups are shown
- [ ] Verify sorting (newest first)
- [ ] Verify size calculations
- [ ] Verify WAL/SHM indicators

---

### Task 5.4: Test Docker integration
**Status**: Pending

**Test Scenarios**:
- [ ] Start Docker container and verify backup runs before migrations
- [ ] Check Docker logs for backup messages
- [ ] Verify both databases are backed up in container
- [ ] Verify backups persist in mounted volume
- [ ] Test migration with backup failure (should fail startup)
- [ ] Test Calibre backup failure (should log warning, continue)

---

### Task 5.5: Test backward compatibility
**Status**: Pending

**Test Scenarios**:
- [ ] Verify existing Tome-only backups still work
- [ ] Run `npm run db:restore` with old backup (should still work)
- [ ] Verify backup count includes old backups
- [ ] Verify cleanup works with mixed old/new backups

---

## Phase 6: Documentation & Cleanup

### Task 6.1: Update AGENTS.md
**Status**: Pending

Update relevant sections:
- Quick Commands section (if backup commands are mentioned)
- Any references to backup scripts

---

### Task 6.2: Add inline documentation
**Status**: Pending

Ensure `lib/db/backup.ts` has:
- File-level JSDoc explaining purpose
- Function-level JSDoc for all exports
- Inline comments for complex logic
- Clear error messages with debugging hints

---

### Task 6.3: Delete deprecated shell scripts
**Status**: Pending

**Only after all tests pass**:
- Delete `scripts/backup-database.sh`
- Delete `scripts/list-backups.sh`

Keep:
- `scripts/restore-database.sh` (out of scope for this issue)
- `scripts/reset-database.sh` (unrelated)

---

### Task 6.4: Final validation
**Status**: Pending

- [ ] Run full test suite: `npm test`
- [ ] Verify all 119+ tests still pass
- [ ] Run `npm run build` to ensure no TypeScript errors
- [ ] Run `npm run lint` to ensure code quality
- [ ] Test Docker build: `docker build -t tome-test .`
- [ ] Test Docker run with backups

---

## Environment Variables Summary

**New**:
- `BACKUP_CALIBRE_DB` (default: `true`) - Enable/disable Calibre backups

**Existing** (used by backup logic):
- `DATABASE_PATH` - Path to Tome database (default: `./data/tome.db`)
- `CALIBRE_DB_PATH` - Path to Calibre database (no default, optional)
- `BACKUP_DIR` - Backup directory (default: `./data/backups`)

---

## Files to Create

1. `lib/db/backup.ts` - Core backup module (~300-400 lines)
2. `scripts/backup.ts` - CLI wrapper (~100-150 lines)
3. `scripts/list-backups.ts` - CLI wrapper (~100-150 lines)
4. `__tests__/lib/db/backup.test.ts` - Unit tests (~500-600 lines)
5. `__tests__/scripts/backup.test.ts` - Integration tests (~100-150 lines)

---

## Files to Modify

1. `.env.example` - Add `BACKUP_CALIBRE_DB` configuration
2. `docker-entrypoint.sh` - Replace `backup_database()` function (~5 lines)
3. `package.json` - Update `db:backup` and `db:list-backups` scripts
4. `AGENTS.md` - Update references to backup commands (if any)

---

## Files to Delete (After Testing)

1. `scripts/backup-database.sh` - Replaced by `scripts/backup.ts`
2. `scripts/list-backups.sh` - Replaced by `scripts/list-backups.ts`

---

## Code Size Estimate

- **Total new code**: ~1,100-1,400 lines
  - Core module: ~400 lines
  - CLI scripts: ~250 lines
  - Tests: ~600 lines
  - Docs: ~50 lines

- **Total removed code**: ~234 lines
  - `backup-database.sh`: 117 lines
  - `list-backups.sh`: 117 lines

- **Net change**: +866 to +1,166 lines

---

## Migration Strategy

**Development**:
1. Create new TypeScript modules alongside existing shell scripts
2. Test TypeScript versions thoroughly
3. Switch npm scripts to use TypeScript versions
4. Keep shell scripts as backup during testing
5. Delete shell scripts only after full validation

**Docker**:
1. Update entrypoint to call TypeScript backup
2. Ensure tsx is available in Docker image (already is via migration-deps)
3. Test in Docker environment before merging

**Rollback**:
- If issues arise, revert npm scripts to use shell versions
- Shell scripts remain functional during transition
- No data loss risk (backups are additive)

---

## Risk Assessment

**Low Risk**:
- Backup is additive (doesn't modify existing data)
- Failure modes are safe (worst case: no backup, migration fails safely)
- Can easily revert to shell scripts if needed
- Calibre backup failure doesn't block Tome backup

**Medium Risk**:
- Docker entrypoint change needs careful testing
- Must ensure tsx works in Docker environment (already does for migrations)

**Mitigation**:
- Comprehensive automated tests
- Manual testing checklist
- Keep shell scripts during transition
- Test in Docker before merging

---

## Success Criteria

- [ ] All automated tests pass (15+ new test cases)
- [ ] Manual testing checklist complete (20+ scenarios)
- [ ] Both Tome and Calibre databases backed up before migrations
- [ ] Backups stored with consistent naming in date-based folders
- [ ] Retention policy applies to both databases (last 3)
- [ ] Docker startup works with new backup logic
- [ ] npm scripts work with new TypeScript versions
- [ ] Backward compatible with existing Tome-only backups
- [ ] Clear error messages and logging
- [ ] Documentation updated
- [ ] No increase in Docker image size (tsx already included)
- [ ] Shell scripts removed after validation

---

## Timeline Estimate

- **Phase 1-2** (Core Module): 2-3 hours
- **Phase 3** (Shell Script Replacement): 1-2 hours
- **Phase 4** (Automated Tests): 2-3 hours
- **Phase 5** (Manual Testing): 1-2 hours
- **Phase 6** (Documentation & Cleanup): 0.5-1 hour

**Total**: 6.5-11 hours

---

## Notes

- TypeScript approach provides better error handling and type safety
- Consolidates ~234 lines of bash into ~400 lines of TypeScript (more maintainable)
- Easier to test and extend in the future
- Follows existing pattern from `lib/db/preflight-checks.ts` and `lib/db/migrate.ts`
- Aligns with project's TypeScript-first approach
- No breaking changes for end users (same npm scripts, same backup format)
