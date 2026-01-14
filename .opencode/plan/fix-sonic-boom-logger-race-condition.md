# Fix: Sonic Boom Logger Race Condition

**Issue:** Production deployment fails during database backup with error: `❌ Backup failed: sonic boom is not ready yet`

**Date:** 2026-01-14
**Status:** Planning Complete - Ready for Implementation

## Background

The error occurs during Docker container startup when the entrypoint script runs database backups before migrations. The issue is a race condition in Pino's file logging infrastructure caused by **cross-process boundaries**:

1. Shell script (`docker-entrypoint.sh`) calls `npx tsx lib/db/backup.ts`
2. New Node.js process starts, initializes logger
3. `pino.destination()` creates a `sonic-boom` stream with initial `fd: -1` (not ready)
4. The stream opens its file descriptor **asynchronously** (next event loop tick)
5. If logs are written before the stream is ready, it throws: "sonic boom is not ready yet"
6. This happens specifically when `LOG_DEST` environment variable is set (file logging enabled)

**Evidence:**
- Error log shows backup process succeeded in creating backups but failed on logger flush
- `sonic-boom/index.js` checks `if (this.fd < 0)` and throws this error
- Testing confirms `fd` starts at `-1` and becomes ready after event loop tick
- Shell script spawns separate processes for backup/migration, each initializing logger independently

**Root Cause:** Cross-language impedance mismatch between shell script entrypoint and TypeScript modules creates timing issues with async logger initialization.

## Solution: Convert Entrypoint to TypeScript (Recommended)

**Primary approach:** Convert `docker-entrypoint.sh` to TypeScript (`scripts/entrypoint.ts`) to eliminate cross-process boundaries and unify the stack. This is the **root cause fix**.

**Why TypeScript entrypoint is better:**
- ✅ Single process = single logger initialization = no race conditions
- ✅ Unified error handling (try/catch instead of exit codes)
- ✅ Type safety for configuration and logic
- ✅ Consistent with 95% TypeScript codebase
- ✅ Easier to test, debug, and maintain
- ✅ Better structured logging with context preservation
- ✅ Industry standard for Node.js containers
- ✅ Negligible performance impact (~50ms tsx startup vs seconds for migrations)

**Fallback approach:** If TypeScript entrypoint is not acceptable, implement logger readiness checks (see Phase 1-3 details below). This is a **workaround** rather than a root cause fix.

---

## Implementation Plan

### Phase 0: Convert Docker Entrypoint to TypeScript (PRIMARY SOLUTION)

**Approach:** Replace shell script with TypeScript entrypoint to eliminate cross-process boundaries.

**Files to create:**
- `scripts/entrypoint.ts` (new TypeScript entrypoint)

**Files to modify:**
- `Dockerfile` (update CMD and COPY directives)
- `docker-entrypoint.sh` (keep for git history, mark as deprecated)

**Tasks:**

- [ ] **P0.1** - Create `scripts/entrypoint.ts` with type-safe configuration
  - Define `EntrypointConfig` interface for environment variables
  - Parse env vars with defaults (DATABASE_PATH, MAX_RETRIES, RETRY_DELAY, etc.)
  - Load dotenv at top of file for environment variable support

- [ ] **P0.2** - Implement banner display function
  - Port `show_banner()` from shell to TypeScript
  - Read version from package.json using `require()` or `fs.readFileSync()`
  - Display ASCII art banner with version

- [ ] **P0.3** - Implement data directory validation
  - Port `ensure_data_directory()` to TypeScript
  - Use `fs.existsSync()`, `fs.mkdirSync()`, `fs.accessSync()` with `fs.constants.W_OK`
  - Provide helpful error messages for permission issues
  - Include structured logging with context

- [ ] **P0.4** - Implement backup orchestration
  - Import and call `createBackups()` from `@/lib/db/backup`
  - Skip backup if database doesn't exist (first run detection)
  - Handle backup failures with proper error logging
  - No need to spawn process - direct function call in same process

- [ ] **P0.5** - Implement migration orchestration with retry logic
  - Import and call appropriate migration function from `@/lib/db/migrate`
  - Implement retry logic with exponential backoff (async/await pattern)
  - Use typed retry configuration (maxRetries, initialDelay)
  - Structured error logging with attempt number and delay

- [ ] **P0.6** - Implement application startup
  - Use `child_process.spawn()` to start `node server.js`
  - Set up proper signal handling (SIGTERM, SIGINT) for graceful shutdown
  - Forward stdout/stderr from application to entrypoint
  - Use `process.exit()` with appropriate exit codes

- [ ] **P0.7** - Implement main execution flow
  - Create async `main()` function with try/catch
  - Chain operations: banner → validate directory → backup → migrate → start app
  - Proper error handling with structured logging
  - Fatal errors should exit with code 1

- [ ] **P0.8** - Update Dockerfile
  - Remove `COPY docker-entrypoint.sh` and `RUN chmod +x`
  - Update to `CMD ["npx", "tsx", "scripts/entrypoint.ts"]`
  - Ensure scripts directory is copied (already done for other scripts)
  - Verify tsx is available in migration-deps layer (already included)

- [ ] **P0.9** - Add shebang and make executable
  - Add `#!/usr/bin/env tsx` as first line
  - Mark file as executable for local testing: `chmod +x scripts/entrypoint.ts`

**Acceptance Criteria:**
- TypeScript entrypoint performs all functions of shell script
- No cross-process tsx invocations for backup/migration
- Logger initializes once in single process
- Type safety for all configuration
- Graceful error handling with structured logs
- Docker container starts successfully
- Zero "sonic boom" errors

**Benefits:**
- **Eliminates root cause** - No cross-process timing issues
- **Single language stack** - Pure TypeScript from entrypoint to application
- **Better error handling** - Unified try/catch instead of exit codes
- **Type safety** - Compile-time validation
- **Easier testing** - Can unit test entrypoint logic
- **Better maintainability** - One language, better IDE support

---

### Phase 1: Testing & Validation (TypeScript Entrypoint)

**Tasks:**

- [ ] **P1.1** - Local testing with tsx
  - Run `npx tsx scripts/entrypoint.ts` locally
  - Verify banner displays correctly
  - Verify data directory validation works
  - Verify backup runs successfully
  - Verify migrations run successfully
  - Verify application starts and serves requests
  - Test with both LOG_DEST set and unset

- [ ] **P1.2** - Test error scenarios
  - Test with non-existent data directory path
  - Test with non-writable data directory
  - Test backup failure handling
  - Test migration failure with retry logic
  - Verify proper exit codes for each failure type

- [ ] **P1.3** - Build and test Docker image
  - Build Docker image: `docker build -t tome:test .`
  - Run container: `docker run -p 3000:3000 -e LOG_DEST=/app/data/tome.log tome:test`
  - Verify startup sequence completes without errors
  - Check logs show structured logging from entrypoint
  - Verify no "sonic boom" errors in any logs

- [ ] **P1.4** - Test with file logging enabled
  - Set `LOG_DEST=/app/data/tome.log` in container
  - Verify log file is created
  - Verify all entrypoint phases log correctly
  - Verify application logs appear in file

- [ ] **P1.5** - Test Docker signal handling
  - Start container
  - Send SIGTERM: `docker stop tome-container`
  - Verify graceful shutdown
  - Check for proper cleanup in logs

- [ ] **P1.6** - Performance baseline
  - Measure container startup time with shell script (baseline)
  - Measure container startup time with TypeScript entrypoint
  - Verify difference is <100ms (tsx startup overhead)
  - Document that migration time dominates (seconds/minutes)

**Acceptance Criteria:**
- All local tests pass
- Docker image builds successfully
- Container starts without "sonic boom" errors
- Structured logging works end-to-end
- Graceful shutdown works correctly
- No performance regression (startup time similar)

---

### Phase 2: Documentation & Cleanup

**Files to modify:**
- `scripts/entrypoint.ts` (inline comments and JSDoc)
- `docker-entrypoint.sh` (add deprecation notice)
- `README.md` or deployment docs (if they reference entrypoint)

**Tasks:**

- [ ] **P2.1** - Add comprehensive JSDoc comments to entrypoint
  - Document each function's purpose
  - Explain retry logic and error handling
  - Note signal handling behavior

- [ ] **P2.2** - Mark shell script as deprecated
  - Add deprecation notice at top of `docker-entrypoint.sh`
  - Note: "Replaced by scripts/entrypoint.ts as of 2026-01-14"
  - Keep file in repo for git history (don't delete yet)

- [ ] **P2.3** - Update any documentation that references entrypoint
  - Check README.md for entrypoint references
  - Check deployment documentation
  - Update to reference TypeScript entrypoint
  - Note: This is now a pure TypeScript project

**Acceptance Criteria:**
- Code is well-documented with JSDoc
- Shell script marked as deprecated (not deleted)
- Documentation updated where applicable
- Future developers understand the architecture

---

## Technical Details

### Current Architecture (Shell Script)

```
docker-entrypoint.sh (shell)
  ├─> npx tsx lib/db/backup.ts  (new Node.js process)
  │     └─> Initialize logger → RACE CONDITION
  │
  ├─> npx tsx lib/db/migrate.ts (new Node.js process)
  │     └─> Initialize logger → RACE CONDITION
  │
  └─> exec node server.js       (replace shell with Node.js)
```

**Problem:** Each `npx tsx` spawns a new process. Logger initializes independently in each process. Async stream initialization can cause "sonic boom is not ready yet" errors.

### New Architecture (TypeScript Entrypoint)

```
npx tsx scripts/entrypoint.ts (single Node.js process)
  ├─> Initialize logger once ✓
  ├─> Show banner
  ├─> Validate data directory
  ├─> createBackups() - direct function call (same process)
  ├─> runMigrations() - direct function call (same process)
  └─> spawn('node', ['server.js']) - new process for app
```

**Solution:** Single process for entrypoint → backup → migrations. Logger initialized once, shared across all operations. No race conditions.

### TypeScript Entrypoint Structure

```typescript
#!/usr/bin/env tsx

import { config } from 'dotenv';
config(); // Load env vars first

import { createBackups } from '@/lib/db/backup';
import { runMigrations } from '@/lib/db/migrate';
import { getLogger } from '@/lib/logger';
import { spawn } from 'child_process';
import { dirname } from 'path';
import { existsSync, mkdirSync, accessSync, constants, readFileSync } from 'fs';

interface EntrypointConfig {
  databasePath: string;
  dataDir: string;
  maxRetries: number;
  retryDelay: number;
}

const config: EntrypointConfig = {
  databasePath: process.env.DATABASE_PATH || './data/tome.db',
  dataDir: dirname(process.env.DATABASE_PATH || './data/tome.db'),
  maxRetries: 3,
  retryDelay: 5000,
};

const logger = getLogger();

async function showBanner() {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
  console.log(`
============================================

   ████████╗ ██████╗ ███╗   ███╗███████╗
   ╚══██╔══╝██╔═══██╗████╗ ████║██╔════╝
      ██║   ██║   ██║██╔████╔██║█████╗  
      ██║   ██║   ██║██║╚██╔╝██║██╔══╝  
      ██║   ╚██████╔╝██║ ╚═╝ ██║███████╗
      ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚══════╝

              Version: ${pkg.version}

============================================
`);
}

async function ensureDataDirectory() {
  logger.info({ dataDir: config.dataDir }, 'Ensuring data directory exists');
  
  if (!existsSync(config.dataDir)) {
    logger.info('Creating data directory');
    try {
      mkdirSync(config.dataDir, { recursive: true });
    } catch (error: any) {
      logger.fatal({ error, dataDir: config.dataDir }, 'Failed to create data directory');
      throw new Error(`Failed to create data directory: ${config.dataDir}`);
    }
  }
  
  try {
    accessSync(config.dataDir, constants.W_OK);
  } catch (error) {
    logger.fatal({ dataDir: config.dataDir }, 'Data directory is not writable');
    throw new Error(`Data directory is not writable: ${config.dataDir}`);
  }
  
  logger.info('Data directory ready');
}

async function backupDatabase() {
  if (!existsSync(config.databasePath)) {
    logger.info('Database not found (first run), skipping backup');
    return;
  }
  
  logger.info('Creating database backup(s)');
  const result = await createBackups();
  
  if (!result.tome.success) {
    logger.error({ error: result.tome.error }, 'Backup failed');
    throw new Error(`Backup failed: ${result.tome.error}`);
  }
  
  logger.info({ 
    tomeBackup: result.tome.backupSize,
    calibreBackup: result.calibre?.backupSize 
  }, 'Backup(s) created successfully');
}

async function runMigrationsWithRetry() {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    logger.info({ attempt, maxRetries: config.maxRetries }, 'Running migrations');
    
    try {
      await runMigrations();
      logger.info('Migrations completed successfully');
      return;
    } catch (error: any) {
      logger.error({ attempt, error: error.message }, 'Migration attempt failed');
      
      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * Math.pow(2, attempt - 1);
        logger.info({ delay }, `Retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.fatal('All migration attempts failed');
        throw error;
      }
    }
  }
}

async function startApplication() {
  logger.info('Starting application');
  
  const app = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: process.env,
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    app.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    app.kill('SIGINT');
  });
  
  app.on('exit', (code) => {
    logger.info({ exitCode: code }, 'Application exited');
    process.exit(code || 0);
  });
}

async function main() {
  try {
    await showBanner();
    await ensureDataDirectory();
    await backupDatabase();
    await runMigrationsWithRetry();
    await startApplication();
  } catch (error: any) {
    logger.fatal({ error: error.message, stack: error.stack }, 'Entrypoint failed');
    process.exit(1);
  }
}

main();
```

### Dockerfile Changes

```dockerfile
# Before:
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]

# After:
# scripts/ directory already copied (contains backup.ts, seed.ts, etc.)
CMD ["npx", "tsx", "scripts/entrypoint.ts"]
```

**Note:** The `scripts/` directory is already copied in the Dockerfile for backup/restore/seed scripts. The entrypoint file will be included automatically. The tsx package is already available in the migration-deps layer.

### Files Modified Summary

**Phase 0 (Primary Solution):**
1. **scripts/entrypoint.ts** - NEW: TypeScript entrypoint replacing shell script
2. **Dockerfile** - Update CMD, remove shell script copy
3. **docker-entrypoint.sh** - Add deprecation notice (keep for history)

**Phase 1:**
- No file modifications, only testing

**Phase 2:**
- Documentation updates

### Risk Assessment

**TypeScript Entrypoint Approach:**

**Low Risk:**
- Similar logic to shell script, just different language
- Direct function calls instead of process spawning
- tsx already used throughout project
- Easy rollback (keep shell script in git)
- Can test thoroughly before production deploy

**Benefits:**
- Eliminates root cause of race condition
- Unified error handling and logging
- Type safety prevents configuration errors
- Easier to test and maintain
- Industry standard for Node.js containers

**Mitigation:**
- Keep shell script in repo for emergency rollback
- Comprehensive testing before production
- Performance baseline to ensure no regression
- Signal handling tested for graceful shutdown

**Performance:**
- Single tsx startup (~50ms) vs two tsx startups (shell approach)
- **Net improvement:** Faster startup by eliminating one process spawn
- Migration time dominates (seconds/minutes), tsx overhead negligible

---

## Verification Checklist

Before marking complete:

- [ ] Phase 0 complete - TypeScript entrypoint created and tested
- [ ] Phase 1 complete - All tests pass in Docker
- [ ] Phase 2 complete - Documentation updated
- [ ] Manual testing in Docker environment successful
- [ ] Error no longer appears in production logs
- [ ] Performance baseline shows no regression (likely improvement)
- [ ] Code review completed
- [ ] Shell script marked as deprecated

---

## Alternative Approach: Logger Readiness Checks (FALLBACK)

If converting to TypeScript entrypoint is not acceptable for any reason, the fallback approach is to add explicit logger readiness checks to handle the cross-process race condition.

**Fallback Tasks:**

1. Add `waitForLoggerReady()` function to `lib/logger.ts`
   - Wait for sonic-boom stream `fd >= 0`
   - Timeout after 5 seconds
   - Handle multistream configurations

2. Add `initializeLoggerAndWait()` function
   - Initialize logger and wait for readiness
   - Export as safe initializer

3. Update `lib/db/backup.ts` to use `initializeLoggerAndWait()`
   - Replace lazy initialization
   - Ensure CLI mode initializes logger before operations

4. Update `lib/db/migrate.ts` similarly

**Why this is suboptimal:**
- Works around the symptom, doesn't fix root cause
- Adds complexity to logger initialization
- Still has two separate Node.js processes with separate loggers
- Timeout adds artificial delay on every startup
- Cross-process error handling still complex

**Only use if:**
- Strong requirement to keep shell script entrypoint
- Cannot use TypeScript for entrypoint
- Need quick fix without architectural change

The TypeScript entrypoint is strongly recommended as it provides a cleaner, more maintainable solution.

---

## Future Considerations

1. **Graceful Shutdown Enhancements**
   - Add health check endpoint for container orchestration
   - Implement cleanup hooks for database connections
   - Add timeout for graceful shutdown (force kill after N seconds)

2. **Startup Performance Monitoring**
   - Track timing for each phase (backup, migration, app start)
   - Add telemetry for startup duration
   - Alert if startup exceeds threshold

3. **Pre-flight Checks**
   - Validate environment variables before starting
   - Check database integrity before migrations
   - Verify required dependencies are available

4. **Configuration Validation**
   - Use Zod or similar for type-safe env var parsing
   - Fail fast with helpful messages for misconfiguration
   - Document all environment variables with types

5. **Additional Scripts**
   - Consider converting other scripts to TypeScript imports
   - Unified CLI tool: `tome backup`, `tome migrate`, `tome seed`
   - Better DX with typed configuration throughout

---

## References

- **Pino Documentation:** https://getpino.io/#/docs/api?id=destination
- **Sonic Boom:** https://github.com/pinojs/sonic-boom
- **Issue Context:** Docker entrypoint backup failure in production
- **Related Files:** 
  - `docker-entrypoint.sh` (current shell entrypoint - to be replaced)
  - `scripts/entrypoint.ts` (new TypeScript entrypoint)
  - `lib/db/backup.ts` (backup logic)
  - `lib/db/migrate.ts` (migration logic)
  - `lib/logger.ts` (logger initialization)
  - `Dockerfile` (container configuration)

---

## Decision Record

**Decision:** Convert Docker entrypoint from shell script to TypeScript

**Context:**
- Production error: "sonic boom is not ready yet" during startup
- Root cause: Cross-process logger initialization race condition
- Shell script spawns separate Node.js processes for backup/migration
- Each process initializes Pino logger independently
- Async stream initialization can fail if logs written too early

**Options Considered:**
1. **Add logger readiness checks** (workaround)
   - Pros: Minimal change, keeps shell script
   - Cons: Doesn't fix root cause, adds complexity, still cross-process

2. **Use synchronous logging for startup** (workaround)
   - Pros: Eliminates async race condition
   - Cons: Performance impact, still cross-process issues

3. **Convert entrypoint to TypeScript** (root cause fix) ✅ CHOSEN
   - Pros: Eliminates cross-process issues, unified stack, type safety, better maintainability
   - Cons: Requires rewriting 137 lines of shell (~250 lines TypeScript)

**Rationale:**
- Tome is 95% TypeScript already - shell script is the outlier
- Direct function calls eliminate process boundaries
- Single logger initialization in single process
- Type safety prevents configuration errors
- Easier to test, debug, and extend
- Industry standard for Node.js containers
- Low risk, high reward
- Actually improves startup performance (one tsx vs two)

**Status:** Approved - Ready for implementation

**Date:** 2026-01-14

---

## Summary for Implementation

**Goal:** Fix "sonic boom is not ready yet" production error by converting Docker entrypoint to TypeScript

**Approach:** Replace shell script with TypeScript entrypoint to eliminate cross-process boundaries

**Key Changes:**
- Create `scripts/entrypoint.ts` with all entrypoint logic
- Update Dockerfile CMD to use `npx tsx scripts/entrypoint.ts`
- Mark `docker-entrypoint.sh` as deprecated (keep for rollback)

**Expected Outcome:**
- Zero "sonic boom" errors
- Unified TypeScript stack from entrypoint to application
- Better error handling and logging
- Easier maintenance and testing
- Slight performance improvement

**Risk:** Low - easy to test, easy to rollback, no changes to core application logic

**Estimated Time:** 2-3 hours implementation + testing
