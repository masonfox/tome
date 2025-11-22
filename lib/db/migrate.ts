import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db, sqlite } from "./sqlite";
import {
  acquireMigrationLock,
  releaseMigrationLock,
  setupLockCleanup,
} from "./migration-lock";
import { validatePreflightChecks } from "./preflight-checks";

export function runMigrations() {
  // Run pre-flight checks
  validatePreflightChecks();

  // Acquire lock to prevent concurrent migrations
  acquireMigrationLock();
  setupLockCleanup();

  try {
    console.log("Running migrations...");
    // Pass the Drizzle database instance (which contains dialect and session)
    migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations complete!");
  } finally {
    // Always release lock, even if migration fails
    releaseMigrationLock();
  }
}

/**
 * Run migrations on a specific database instance (for test isolation)
 */
export function runMigrationsOnDatabase(database: any) {
  console.log("Running migrations on test database...");
  // Pass the raw SQLite database, not a Drizzle wrapper
  const { migrate } = require("drizzle-orm/bun-sqlite/migrator");
  migrate(database, { migrationsFolder: "./drizzle" });
  console.log("Test migrations complete!");
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  try {
    runMigrations();
    sqlite.close();
    console.log("Database setup complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}
