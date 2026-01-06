import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db, sqlite } from "./sqlite";
import {
  acquireMigrationLock,
  releaseMigrationLock,
  setupLockCleanup,
} from "./migration-lock";
import { validatePreflightChecks } from "./preflight-checks";
import { readdirSync } from "fs";

// Lazy logger initialization to prevent pino from loading during instrumentation phase
let logger: any = null;
function getLoggerSafe() {
  if (!logger) {
    const { getLogger } = require("../logger");
    logger = getLogger();
  }
  return logger;
}

export function runMigrations() {
  // Run pre-flight checks
  validatePreflightChecks();

  // Acquire lock to prevent concurrent migrations
  acquireMigrationLock();
  setupLockCleanup();

  try {
    getLoggerSafe().info("Running migrations...");
    
    // Check which migrations exist and which have been applied
    const migrationsFolder = './drizzle';
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    
    getLoggerSafe().info(`Found ${migrationFiles.length} migration files`);
    
    // Check which migrations have already been applied
    let appliedMigrationCount = 0;
    try {
      const result = sqlite.prepare(
        "SELECT COUNT(*) as count FROM __drizzle_migrations"
      ).get() as { count: number };
      
      appliedMigrationCount = result.count;
      getLoggerSafe().info(`${appliedMigrationCount} migrations already applied`);
    } catch (error) {
      // Table doesn't exist yet (first run)
      getLoggerSafe().info("No migrations applied yet (first run)");
    }
    
    // Note: We can't reliably determine which specific migrations will be applied
    // because Drizzle uses content hashes, not just file counts or names.
    // Drizzle's migrate() function will handle the actual detection and execution.
    getLoggerSafe().info("Checking for pending migrations...");
    
    // Pass the Drizzle database instance (which contains dialect and session)
    migrate(db, { migrationsFolder: "./drizzle" });
    getLoggerSafe().info("Migrations complete!");
  } finally {
    // Always release lock, even if migration fails
    releaseMigrationLock();
  }
}

/**
 * Run migrations on a specific database instance (for test isolation)
 */
export function runMigrationsOnDatabase(database: any) {
  getLoggerSafe().info("Running migrations on test database...");
  // Pass the raw SQLite database, not a Drizzle wrapper
  const { migrate } = require("drizzle-orm/bun-sqlite/migrator");
  migrate(database, { migrationsFolder: "./drizzle" });
  getLoggerSafe().info("Test migrations complete!");
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  try {
    runMigrations();
    sqlite.close();
    getLoggerSafe().info("Database setup complete.");
  } catch (error) {
    getLoggerSafe().error({ err: error }, "Migration failed");
    process.exit(1);
  }
}
