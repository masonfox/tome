/**
 * Companion Migration 0015: Progress Dates Timezone Conversion
 * 
 * Converts progress_logs.progress_date from INTEGER (Unix timestamps)
 * to TEXT (YYYY-MM-DD strings) using the user's configured timezone.
 * 
 * Related schema migration: drizzle/0015_opposite_shatterstar.sql
 * 
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0015_progress_dates_timezone" });

const migration: CompanionMigration = {
  name: "0015_progress_dates_timezone",
  requiredTables: ["progress_logs"],
  description: "Convert progress_date from Unix timestamps to YYYY-MM-DD strings with timezone awareness",
  
  async execute(db) {
    // Get user timezone from streaks table
    let timezone = "America/New_York"; // Default
    
    // Check if streaks table exists
    const streaksTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='streaks'"
    ).get();
    
    if (streaksTable) {
      const streak = db.prepare("SELECT user_timezone FROM streaks LIMIT 1").get() as { user_timezone?: string } | undefined;
      timezone = streak?.user_timezone || timezone;
    } else {
      logger.info("streaks table does not exist, using default timezone");
    }
    
    logger.info({ timezone }, "Using timezone for conversion");
    
    // Get all progress logs with INTEGER timestamps
    // Check both:
    // 1. typeof(progress_date) = 'integer' - values stored as INTEGER type
    // 2. Numeric strings that look like Unix timestamps (> 1000000000)
    //    These can occur when Drizzle's table recreation copies INTEGER values
    //    into TEXT columns - SQLite stores them as TEXT type but they're still numbers
    const logs = db.prepare(`
      SELECT id, progress_date FROM progress_logs 
      WHERE typeof(progress_date) = 'integer'
         OR (typeof(progress_date) = 'text' 
             AND CAST(progress_date AS INTEGER) = progress_date 
             AND CAST(progress_date AS INTEGER) > 1000000000)
    `).all() as Array<{ id: number; progress_date: number }>;
    
    logger.info({ count: logs.length }, "Found progress logs to convert");
    
    if (logs.length === 0) {
      logger.info("No INTEGER timestamps found, nothing to convert");
      return;
    }
    
    // Preview conversions (first 5)
    logger.info("Preview of conversions:");
    const previewCount = Math.min(5, logs.length);
    for (let i = 0; i < previewCount; i++) {
      const log = logs[i];
      const date = new Date(log.progress_date * 1000); // Unix seconds → milliseconds
      const dateString = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      
      logger.info({
        id: log.id,
        timestamp: log.progress_date,
        iso: date.toISOString(),
        converted: dateString,
      }, `Preview ${i + 1}/${previewCount}`);
    }
    
    // Convert timestamps to date strings
    const updateStmt = db.prepare(
      "UPDATE progress_logs SET progress_date = ? WHERE id = ?"
    );
    
    let converted = 0;
    for (const log of logs) {
      try {
        const date = new Date(log.progress_date * 1000); // Unix seconds → milliseconds
        const dateString = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
        
        updateStmt.run(dateString, log.id);
        converted++;
        
        // Log progress every 100 records
        if (converted % 100 === 0) {
          logger.info({ converted, total: logs.length }, "Progress");
        }
      } catch (error) {
        logger.error({ id: log.id, timestamp: log.progress_date, error }, "Failed to convert record");
        throw error; // Abort on any error (transaction will rollback)
      }
    }
    
    logger.info({ converted }, "Conversion complete");
  }
};

export default migration;
