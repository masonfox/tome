import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, sqlite } from "./sqlite";
import {
  acquireMigrationLock,
  releaseMigrationLock,
  setupLockCleanup,
} from "./migration-lock";
import { validatePreflightChecks } from "./preflight-checks";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";
import { 
  migrateProgressDatesToText, 
  isMigrationComplete as isProgressDatesMigrationComplete 
} from "@/scripts/migrations/migrate-progress-dates-to-text";
import { 
  migrateSessions, 
  isMigrationComplete as isSessionDatesMigrationComplete 
} from "@/scripts/migrations/migrate-session-dates-to-text";

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
    
    // PHASE 1: Run data migration for progress dates (if not already done)
    // This MUST run BEFORE the Drizzle schema migration that changes column types
    if (!isProgressDatesMigrationComplete()) {
      getLoggerSafe().info("Running progress dates data migration...");
      try {
        await migrateProgressDatesToText();
        getLoggerSafe().info("Progress dates migration complete");
      } catch (error) {
        getLoggerSafe().error({ err: error }, "Progress dates migration failed");
        throw error;
      }
    } else {
      getLoggerSafe().info("Progress dates already migrated, skipping");
    }
    
    // PHASE 1.5: Run data migration for session dates (if not already done)
    // This MUST run BEFORE the Drizzle schema migration that changes column types
    if (!isSessionDatesMigrationComplete()) {
      getLoggerSafe().info("Running session dates data migration...");
      try {
        await migrateSessions();
        getLoggerSafe().info("Session dates migration complete");
      } catch (error) {
        getLoggerSafe().error({ err: error }, "Session dates migration failed");
        throw error;
      }
    } else {
      getLoggerSafe().info("Session dates already migrated, skipping");
    }
    
    // PHASE 2: Run Drizzle schema migrations
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
    
    // Special handling for migrations 0015 and 0016 which have data conversion logic
    // These migrations work correctly when executed via raw SQL but fail silently when
    // run through Drizzle's migrate() function. We manually execute them to ensure reliability.
    // However, we only do this if the base tables exist (not a fresh database).
    const specialMigrations = ['0015_opposite_shatterstar.sql', '0016_outstanding_leader.sql'];
    for (const migFile of specialMigrations) {
      const migPath = join(migrationsFolder, migFile);
      if (!require('fs').existsSync(migPath)) continue;
      
      // Check if the tables that these migrations affect exist
      // Migration 0015 affects progress_logs, migration 0016 affects reading_sessions
      const tableToCheck = migFile.includes('0015') ? 'progress_logs' : 'reading_sessions';
      try {
        const tableExists = sqlite.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableToCheck}'`
        ).get();
        
        if (!tableExists) {
          getLoggerSafe().info(`Table ${tableToCheck} doesn't exist yet, skipping special migration ${migFile} (will be handled by regular migrations)`);
          continue;
        }
      } catch (error) {
        // If we can't check, skip this special migration
        getLoggerSafe().info(`Cannot check for ${tableToCheck}, skipping special migration ${migFile}`);
        continue;
      }
      
      // Check if already applied by hash
      const migContent = readFileSync(migPath, 'utf-8');
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(migContent).digest('hex');
      
      try {
        const existing = sqlite.prepare(
          "SELECT hash FROM __drizzle_migrations WHERE hash = ?"
        ).get(hash);
        
        if (existing) {
          getLoggerSafe().info(`Migration ${migFile} already applied, skipping`);
          continue;
        }
      } catch (error) {
        // Table doesn't exist, will be created by first migration
      }
      
      // Run the migration manually
      getLoggerSafe().info(`Manually running migration ${migFile}...`);
      try {
        // Execute each statement separately
        const statements = migContent
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));
        
        for (const stmt of statements) {
          if (stmt.trim()) {
            sqlite.exec(stmt);
          }
        }
        
        // Record migration as applied
        sqlite.prepare(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
        ).run(hash, Date.now());
        
        getLoggerSafe().info(`Migration ${migFile} completed successfully`);
      } catch (error) {
        getLoggerSafe().error({ err: error, migration: migFile }, `Failed to run migration ${migFile}`);
        throw error;
      }
    }
    
    // Note: We can't reliably determine which specific migrations will be applied
    // because Drizzle uses content hashes, not just file counts or names.
    // Drizzle's migrate() function will handle the actual detection and execution.
    getLoggerSafe().info("Checking for pending migrations...");
    
    // Run migrations using better-sqlite3 migrator
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
