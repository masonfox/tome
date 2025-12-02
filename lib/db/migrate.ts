import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db, sqlite } from "./sqlite";
import {
  acquireMigrationLock,
  releaseMigrationLock,
  setupLockCleanup,
} from "./migration-lock";
import { validatePreflightChecks } from "./preflight-checks";
import { getLogger } from "../logger";
import { readdirSync } from "fs";
const logger = getLogger();

export function runMigrations() {
  // Run pre-flight checks
  validatePreflightChecks();

  // Acquire lock to prevent concurrent migrations
  acquireMigrationLock();
  setupLockCleanup();

  try {
    logger.info("Running migrations...");
    
    // Check which migrations exist
    const migrationsFolder = './drizzle';
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    
    logger.info(`Found ${migrationFiles.length} migration files`);
    
    // Check which migrations have already been applied
    let appliedMigrations: string[] = [];
    try {
      const result = sqlite.prepare(
        "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at"
      ).all() as Array<{ hash: string; created_at: number }>;
      
      appliedMigrations = result.map(row => {
        // The hash is stored as a number, we need to match it to migration files
        // Drizzle uses the migration index (0000, 0001, etc.)
        return row.hash;
      });
      
      logger.info(`${appliedMigrations.length} migrations already applied`);
    } catch (error) {
      // Table doesn't exist yet (first run)
      logger.info("No migrations applied yet (first run)");
    }
    
    // Determine which migrations will be applied
    const pendingCount = migrationFiles.length - appliedMigrations.length;
    if (pendingCount > 0) {
      logger.info(`${pendingCount} new migration(s) to apply:`);
      migrationFiles.slice(appliedMigrations.length).forEach((file) => {
        logger.info(`  → ${file}`);
      });
    } else {
      logger.info("All migrations up to date");
    }
    
    // Pass the Drizzle database instance (which contains dialect and session)
    migrate(db, { migrationsFolder: "./drizzle" });
    logger.info("Migrations complete!");
  } finally {
    // Always release lock, even if migration fails
    releaseMigrationLock();
  }
}

/**
 * Run migrations on a specific database instance (for test isolation)
 */
export function runMigrationsOnDatabase(database: any) {
  logger.info("Running migrations on test database...");
  // Pass the raw SQLite database, not a Drizzle wrapper
  const { migrate } = require("drizzle-orm/bun-sqlite/migrator");
  migrate(database, { migrationsFolder: "./drizzle" });
  logger.info("Test migrations complete!");
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  try {
    runMigrations();
    sqlite.close();
    logger.info("Database setup complete.");
  } catch (error) {
    logger.error({ err: error }, "Migration failed");
    process.exit(1);
  }
}
