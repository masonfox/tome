import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from "./sqlite";
import {
  acquireMigrationLock,
  releaseMigrationLock,
  setupLockCleanup,
} from "./migration-lock";
import { validatePreflightChecks } from "./preflight-checks";
import { runCompanionMigrations } from "./companion-migrations";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";

// Lazy logger initialization to prevent pino from loading during instrumentation phase
let logger: any = null;
function getLoggerSafe() {
  // In test mode, return no-op logger to avoid require() issues in Vitest
  if (process.env.NODE_ENV === 'test') {
    return { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, fatal: () => {} };
  }
  if (!logger) {
    logger = getLogger();
  }
  return logger;
}

export async function runMigrations() {
  // Run pre-flight checks
  validatePreflightChecks();

  // Acquire lock to prevent concurrent migrations
  acquireMigrationLock();
  setupLockCleanup();

  let fkWasEnabled = false;
  let fkStateChanged = false;

  try {
    getLoggerSafe().info("Running migrations...");
    
    // SAFEGUARD: Check for other database connections (WAL mode)
    // In WAL mode, we can detect if there are active readers/writers
    try {
      const walInfo = sqlite.pragma('wal_checkpoint(PASSIVE)', { simple: true });
      getLoggerSafe().debug({ walInfo }, "WAL checkpoint status before migration");
    } catch (error) {
      // WAL checkpoint might fail if not in WAL mode - that's fine
      getLoggerSafe().debug("WAL checkpoint check skipped (not in WAL mode or failed)");
    }
    
    // SAFEGUARD: Check foreign key integrity BEFORE disabling
    getLoggerSafe().info("Checking foreign key integrity before migration...");
    const fkViolations = sqlite.pragma('foreign_key_check');
    if (fkViolations.length > 0) {
      getLoggerSafe().error({ violations: fkViolations }, "Foreign key violations detected before migration");
      throw new Error(`Database has ${fkViolations.length} foreign key violations. Cannot proceed with migration.`);
    }
    getLoggerSafe().info("Foreign key integrity check passed");
    
    // CRITICAL: Disable foreign keys before migrations
    // Drizzle wraps migrations in a transaction (BEGIN...COMMIT), and in SQLite,
    // PRAGMA statements inside transactions have no effect. Since migrations 0015/0016
    // include "PRAGMA foreign_keys=OFF" to safely recreate tables, we must disable
    // FK constraints at the connection level BEFORE Drizzle starts its transaction.
    //
    // See: https://www.sqlite.org/pragma.html#pragma_foreign_keys
    // "It is not possible to enable or disable foreign key constraints in the middle
    // of a multi-statement transaction (when SQLite is not in autocommit mode)."
    fkWasEnabled = sqlite.pragma('foreign_keys', { simple: true }) === 1;
    getLoggerSafe().info({ fkEnabled: fkWasEnabled }, "Current foreign key constraint state");
    
    if (fkWasEnabled) {
      getLoggerSafe().warn("Temporarily disabling foreign key constraints for migration");
      sqlite.pragma('foreign_keys = OFF');
      fkStateChanged = true;
      
      // ASSERTION: Verify FK is actually disabled
      const fkAfterDisable = sqlite.pragma('foreign_keys', { simple: true });
      if (fkAfterDisable !== 0) {
        throw new Error(`Failed to disable foreign keys: expected 0, got ${fkAfterDisable}`);
      }
      getLoggerSafe().debug({ fkEnabled: false }, "✓ Verified foreign keys are disabled");
    }
    
    try {
      // Run Drizzle schema migrations (DDL)
      getLoggerSafe().info("Checking for pending schema migrations...");
      
      try {
        migrate(db, { migrationsFolder: "./drizzle" });
        getLoggerSafe().info("Schema migrations complete");
      } catch (migrationError) {
        getLoggerSafe().error(
          { err: migrationError, fkDisabled: !fkWasEnabled || fkStateChanged }, 
          "Schema migration failed"
        );
        throw migrationError;
      }
      
      // Run companion migrations (DML)
      getLoggerSafe().info("Running companion migrations...");
      
      try {
        await runCompanionMigrations(sqlite);
        getLoggerSafe().info("Companion migrations complete");
      } catch (companionError) {
        getLoggerSafe().error(
          { err: companionError, fkDisabled: !fkWasEnabled || fkStateChanged },
          "Companion migration failed"
        );
        throw companionError;
      }
      
      getLoggerSafe().info("All migrations complete!");
    } finally {
      // CRITICAL: Re-enable foreign keys if they were enabled before
      if (fkStateChanged) {
        getLoggerSafe().info("Re-enabling foreign key constraints");
        sqlite.pragma('foreign_keys = ON');
        
        // ASSERTION: Verify FK is actually enabled
        const fkAfterEnable = sqlite.pragma('foreign_keys', { simple: true });
        if (fkAfterEnable !== 1) {
          getLoggerSafe().error(
            { expected: 1, actual: fkAfterEnable },
            "Failed to re-enable foreign keys"
          );
          throw new Error(`Failed to re-enable foreign keys: expected 1, got ${fkAfterEnable}`);
        }
        getLoggerSafe().debug({ fkEnabled: true }, "✓ Verified foreign keys are re-enabled");
        
        // SAFEGUARD: Check foreign key integrity AFTER re-enabling
        getLoggerSafe().info("Checking foreign key integrity after migration...");
        const fkViolationsAfter = sqlite.pragma('foreign_key_check');
        if (fkViolationsAfter.length > 0) {
          getLoggerSafe().error(
            { violations: fkViolationsAfter }, 
            "Foreign key violations detected after migration"
          );
          throw new Error(
            `Migration introduced ${fkViolationsAfter.length} foreign key violations. ` +
            `Database may be in inconsistent state.`
          );
        }
        getLoggerSafe().info("Foreign key integrity check passed after migration");
      }
    }
  } catch (error) {
    getLoggerSafe().error(
      { 
        err: error,
        fkWasEnabled,
        fkStateChanged,
        context: "Migration failed - check logs above for details"
      },
      "Migration process failed"
    );
    throw error;
  } finally {
    // Always release lock, even if migration fails
    releaseMigrationLock();
    
    // Final safety check: ensure FK state is correct
    const finalFkState = sqlite.pragma('foreign_keys', { simple: true });
    getLoggerSafe().info(
      { 
        fkEnabled: finalFkState === 1,
        expectedState: fkWasEnabled 
      },
      "Final foreign key constraint state"
    );
    
    if (fkWasEnabled && finalFkState !== 1) {
      getLoggerSafe().fatal(
        { expected: 1, actual: finalFkState },
        "CRITICAL: Foreign keys should be enabled but are not. Database may be in unsafe state."
      );
    }
  }
}

/**
 * Run migrations on a specific database instance (for test isolation)
 */
export function runMigrationsOnDatabase(database: any) {
  getLoggerSafe().info("Running migrations on test database...");

  // For better-sqlite3, we need to manually handle statement breakpoints
  // because its prepare() doesn't support multiple statements
  const migrationsPath = join(process.cwd(), 'drizzle');
  const migrationFiles = readdirSync(migrationsPath)
    .filter((file: string) => file.endsWith('.sql'))
    .sort();

  // Get the raw SQLite instance
  const sqlite = database.$client;

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsPath, file), 'utf-8');
    // Split by statement breakpoint and execute each statement
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        sqlite.exec(statement);
      }
    }
  }

  getLoggerSafe().info("Test migrations complete!");
}

// Run migrations if this file is executed directly
// ESM-compatible main detection (works with tsx, Node.js ESM, Bun)
// tsx doesn't support import.meta.main, so we use the standard ESM approach
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  (async () => {
    try {
      await runMigrations();
      sqlite.close();
      getLoggerSafe().info("Database setup complete.");
    } catch (error) {
      getLoggerSafe().error({ err: error }, "Migration failed");
      process.exit(1);
    }
  })();
}
