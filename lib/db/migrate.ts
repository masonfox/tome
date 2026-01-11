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

  try {
    getLoggerSafe().info("Running migrations...");
    
    // Run Drizzle schema migrations (DDL)
    getLoggerSafe().info("Checking for pending schema migrations...");
    migrate(db, { migrationsFolder: "./drizzle" });
    getLoggerSafe().info("Schema migrations complete");
    
    // Run companion migrations (DML)
    getLoggerSafe().info("Running companion migrations...");
    await runCompanionMigrations(sqlite);
    getLoggerSafe().info("Companion migrations complete");
    
    getLoggerSafe().info("All migrations complete!");
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
