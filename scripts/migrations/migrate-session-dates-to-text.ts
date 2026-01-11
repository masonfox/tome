#!/usr/bin/env node
/**
 * Migrate reading_sessions dates from INTEGER (Unix timestamp) to TEXT (YYYY-MM-DD)
 * 
 * This migration converts startedDate and completedDate from timestamp data to date strings
 * using the user's configured timezone from the streaks table. This ensures dates remain
 * semantically correct as "calendar days" rather than "points in time".
 * 
 * Safety features:
 * - Idempotent: Can be run multiple times safely
 * - Transactional: Rolls back on any error
 * - Logging: Comprehensive progress and error reporting
 * - Dry-run mode: Preview conversions without writing
 * - Handles NULL dates gracefully
 * 
 * Usage:
 *   npm run migrate:session-dates          # Apply migration
 *   npm run migrate:session-dates --dry-run # Preview only
 */

import { createDatabase } from "@/lib/db/factory";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "session-dates-to-text" });

const DB_PATH = process.env.DATABASE_PATH || "./data/tome.db";
const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATION_FLAG_KEY = "session_dates_migrated_to_text";

interface SessionRow {
  id: number;
  started_date: number | null; // Unix timestamp (integer) or null
  completed_date: number | null; // Unix timestamp (integer) or null
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
 * Convert Unix timestamp to YYYY-MM-DD string in user's timezone
 */
function timestampToDateString(timestamp: number, timezone: string): string {
  const date = new Date(timestamp * 1000); // SQLite stores as seconds, JS uses milliseconds
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

/**
 * Perform the migration
 */
async function migrateSessions() {
  const { sqlite: db } = createDatabase({ path: DB_PATH, wal: true });

  try {
    logger.info(
      { dryRun: DRY_RUN },
      "Starting session dates migration (INTEGER → TEXT)"
    );

    // Get user's timezone from streaks table
    const streakRow = db
      .prepare("SELECT user_timezone FROM streaks LIMIT 1")
      .get() as StreakRow | undefined;

    const userTimezone = streakRow?.user_timezone || "America/New_York";
    logger.info({ timezone: userTimezone }, "Using user timezone for conversion");

    // Get all sessions that need migration
    // Check if columns are still INTEGER type (have numeric values)
    const sessionsToMigrate = db
      .prepare(`
        SELECT id, started_date, completed_date
        FROM reading_sessions
        WHERE 
          (started_date IS NOT NULL AND typeof(started_date) = 'integer')
          OR (completed_date IS NOT NULL AND typeof(completed_date) = 'integer')
      `)
      .all() as SessionRow[];

    if (sessionsToMigrate.length === 0) {
      logger.info("No sessions need migration (already migrated or no dates)");
      if (!DRY_RUN) {
        // Mark as complete
        db.prepare(
          "INSERT OR REPLACE INTO migration_metadata (key, value) VALUES (?, ?)"
        ).run(MIGRATION_FLAG_KEY, "true");
      }
      return;
    }

    logger.info(
      { count: sessionsToMigrate.length },
      "Found sessions to migrate"
    );

    if (DRY_RUN) {
      // Preview conversions
      logger.info("DRY RUN - Preview of conversions:");
      sessionsToMigrate.slice(0, 10).forEach((session) => {
        const startedStr = session.started_date
          ? timestampToDateString(session.started_date, userTimezone)
          : null;
        const completedStr = session.completed_date
          ? timestampToDateString(session.completed_date, userTimezone)
          : null;

        logger.info({
          sessionId: session.id,
          startedDate: {
            before: session.started_date,
            after: startedStr,
          },
          completedDate: {
            before: session.completed_date,
            after: completedStr,
          },
        });
      });
      logger.info(
        `Showing first 10 of ${sessionsToMigrate.length} sessions. Run without --dry-run to apply.`
      );
      return;
    }

    // Perform migration in transaction
    const updateStmt = db.prepare(`
      UPDATE reading_sessions
      SET started_date = ?, completed_date = ?
      WHERE id = ?
    `);

    db.exec("BEGIN TRANSACTION");

    try {
      let converted = 0;
      for (const session of sessionsToMigrate) {
        const startedStr = session.started_date
          ? timestampToDateString(session.started_date, userTimezone)
          : null;
        const completedStr = session.completed_date
          ? timestampToDateString(session.completed_date, userTimezone)
          : null;

        updateStmt.run(startedStr, completedStr, session.id);
        converted++;

        if (converted % 100 === 0) {
          logger.info({ converted, total: sessionsToMigrate.length }, "Progress");
        }
      }

      // Mark migration as complete
      db.prepare(
        "INSERT OR REPLACE INTO migration_metadata (key, value) VALUES (?, ?)"
      ).run(MIGRATION_FLAG_KEY, "true");

      db.exec("COMMIT");

      logger.info(
        { converted: sessionsToMigrate.length },
        "✅ Session dates migration completed successfully"
      );
    } catch (error) {
      db.exec("ROLLBACK");
      logger.error({ error }, "Migration failed, rolled back");
      throw error;
    }
  } catch (error) {
    logger.error({ error }, "Fatal error during migration");
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
    if (isMigrationComplete()) {
      logger.info("Session dates migration already completed, skipping");
      return;
    }

    await migrateSessions();
  } catch (error) {
    logger.error({ error }, "Migration failed");
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { migrateSessions, isMigrationComplete };
