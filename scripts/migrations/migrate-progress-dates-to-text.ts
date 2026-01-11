#!/usr/bin/env node
/**
 * Migrate progress_logs.progressDate from INTEGER (Unix timestamp) to TEXT (YYYY-MM-DD)
 * 
 * This migration converts existing timestamp data to date strings using the user's
 * configured timezone from the streaks table. This ensures dates remain semantically
 * correct as "calendar days" rather than "points in time".
 * 
 * Safety features:
 * - Idempotent: Can be run multiple times safely
 * - Transactional: Rolls back on any error
 * - Logging: Comprehensive progress and error reporting
 * - Dry-run mode: Preview conversions without writing
 * 
 * Usage:
 *   npm run migrate:dates          # Apply migration
 *   npm run migrate:dates --dry-run # Preview only
 */

import { createDatabase } from "@/lib/db/factory";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "progress-dates-to-text" });

const DB_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATION_FLAG_KEY = "progress_dates_migrated_to_text";

interface ProgressLogRow {
  id: number;
  progress_date: number; // Unix timestamp (integer)
}

interface StreakRow {
  user_timezone: string;
}

interface MigrationFlagRow {
  value: string;
}

/**
 * Check if migration has already been completed
 */
function isMigrationComplete(): boolean {
  const { sqlite: db } = createDatabase({ path: DB_PATH, wal: true });
  
  try {
    // Check if metadata table exists
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_metadata'"
      )
      .get();

    if (!tableExists) {
      // Create metadata table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS migration_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL
        )
      `);
      return false;
    }

    // Check if migration flag exists
    const flag = db
      .prepare("SELECT value FROM migration_metadata WHERE key = ?")
      .get(MIGRATION_FLAG_KEY) as MigrationFlagRow | undefined;

    return flag?.value === "true";
  } catch (error) {
    logger.error({ error }, "Error checking migration status");
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Set migration completion flag
 */
function setMigrationComplete(db: any): void {
  db.prepare(
    "INSERT OR REPLACE INTO migration_metadata (key, value) VALUES (?, ?)"
  ).run(MIGRATION_FLAG_KEY, "true");
}

/**
 * Get user's timezone from streaks table
 */
function getUserTimezone(db: any): string {
  const streak = db
    .prepare("SELECT user_timezone FROM streaks LIMIT 1")
    .get() as StreakRow | undefined;

  const timezone = streak?.user_timezone || "America/New_York";
  logger.info({ timezone }, "Using timezone for migration");
  return timezone;
}

/**
 * Get all progress log rows that need migration
 */
function getProgressLogs(db: any): ProgressLogRow[] {
  return db
    .prepare("SELECT id, progress_date FROM progress_logs ORDER BY id")
    .all() as ProgressLogRow[];
}

/**
 * Convert Unix timestamp to YYYY-MM-DD string
 */
function convertTimestampToDateString(
  timestamp: number,
  timezone: string
): string {
  const date = new Date(timestamp * 1000); // Convert Unix seconds to milliseconds
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/**
 * Perform the migration
 */
async function migrate(): Promise<void> {
  logger.info(
    { dryRun: DRY_RUN, dbPath: DB_PATH },
    "Starting progress dates migration"
  );

  // Check if already migrated
  if (isMigrationComplete()) {
    logger.info("Migration already completed, skipping");
    return;
  }

  const { sqlite: db } = createDatabase({ path: DB_PATH, wal: true });

  try {
    // Get user timezone
    const timezone = getUserTimezone(db);

    // Get all progress logs
    const logs = getProgressLogs(db);
    logger.info({ count: logs.length }, "Found progress logs to migrate");

    if (logs.length === 0) {
      logger.info("No progress logs found, marking migration complete");
      if (!DRY_RUN) {
        setMigrationComplete(db);
      }
      return;
    }

    // Preview conversions
    logger.info("Preview of conversions:");
    const previewCount = Math.min(5, logs.length);
    for (let i = 0; i < previewCount; i++) {
      const log = logs[i];
      const dateString = convertTimestampToDateString(log.progress_date, timezone);
      const date = new Date(log.progress_date * 1000);
      logger.info(
        {
          id: log.id,
          timestamp: log.progress_date,
          iso: date.toISOString(),
          converted: dateString,
        },
        `Preview ${i + 1}/${previewCount}`
      );
    }

    if (DRY_RUN) {
      logger.info({ count: logs.length }, "DRY RUN: Would migrate records");
      return;
    }

    // Perform migration in a transaction
    logger.info("Starting transaction...");
    db.exec("BEGIN TRANSACTION");

    try {
      // Update progress_date column directly with TEXT values
      // SQLite's flexible typing allows storing TEXT in INTEGER columns
      const updateStmt = db.prepare(
        "UPDATE progress_logs SET progress_date = ? WHERE id = ?"
      );

      let successCount = 0;
      let errorCount = 0;

      for (const log of logs) {
        try {
          const dateString = convertTimestampToDateString(log.progress_date, timezone);
          updateStmt.run(dateString, log.id);
          successCount++;

          if (successCount % 100 === 0) {
            logger.info({ processed: successCount, total: logs.length }, "Progress");
          }
        } catch (error) {
          errorCount++;
          logger.error(
            { id: log.id, timestamp: log.progress_date, error },
            "Failed to convert record"
          );
          throw error; // Abort transaction on any error
        }
      }

      // Set migration completion flag
      setMigrationComplete(db);

      // Commit transaction
      db.exec("COMMIT");

      logger.info(
        { success: successCount, errors: errorCount, total: logs.length },
        "Data migration completed successfully"
      );
      logger.info("Note: Drizzle schema migration will complete the column type change");
    } catch (error) {
      logger.error({ error }, "Migration failed, rolling back");
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Migration error");
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    await migrate();
  } catch (error) {
    logger.error({ error }, "Migration failed");
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use in instrumentation
export { migrate as migrateProgressDatesToText, isMigrationComplete };
