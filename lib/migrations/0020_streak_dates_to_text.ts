import { CompanionMigration } from "@/lib/db/companion-migrations";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0020_streak_dates_to_text" });

/**
 * Companion migration for 0020_yellow_switch.sql
 * 
 * Converts streak date columns from Unix timestamps (INTEGER) to YYYY-MM-DD strings (TEXT):
 * - last_activity_date: INTEGER → TEXT (YYYY-MM-DD)
 * - streak_start_date: INTEGER → TEXT (YYYY-MM-DD)
 * - last_checked_date: INTEGER → TEXT (YYYY-MM-DD) [nullable]
 * 
 * This completes the date string migration started in PR #251, which converted
 * progress_logs and reading_sessions but left streaks table using timestamps.
 * 
 * Context: The type mismatch between progress_logs.progress_date (TEXT) and
 * streaks.lastActivityDate (INTEGER) caused intermittent streak resets due to
 * timezone conversion errors in checkAndResetStreakIfNeeded().
 */
const migration: CompanionMigration = {
  name: "0020_streak_dates_to_text",
  requiredTables: ["streaks"],
  description: "Convert streak date columns from Unix timestamps to YYYY-MM-DD strings",
  
  async execute(db) {
    // Get user timezone from streaks table (should only be one record in single-user mode)
    let timezone = "America/New_York";
    const existingStreak = db.prepare("SELECT user_timezone FROM streaks LIMIT 1").get() as { user_timezone: string } | undefined;
    
    if (existingStreak?.user_timezone) {
      timezone = existingStreak.user_timezone;
    }
    
    logger.info({ timezone }, "Using timezone for date conversion");
    
    // Get all streak records with INTEGER timestamps
    // Check column type to determine if migration is needed
    const streaksWithTimestamps = db.prepare(`
      SELECT id, last_activity_date, streak_start_date, last_checked_date
      FROM streaks
      WHERE typeof(last_activity_date) = 'integer'
    `).all() as Array<{
      id: number;
      last_activity_date: number;
      streak_start_date: number;
      last_checked_date: number | null;
    }>;
    
    logger.info({ count: streaksWithTimestamps.length }, "Found streak records to convert");
    
    if (streaksWithTimestamps.length === 0) {
      logger.info("No INTEGER timestamps found, migration already complete or no data");
      return;
    }
    
    // Convert timestamps to YYYY-MM-DD strings
    const updateStmt = db.prepare(`
      UPDATE streaks 
      SET 
        last_activity_date = ?,
        streak_start_date = ?,
        last_checked_date = ?
      WHERE id = ?
    `);
    
    let converted = 0;
    for (const streak of streaksWithTimestamps) {
      // Convert Unix seconds to milliseconds, then to date string in user's timezone
      const lastActivityDate = new Date(streak.last_activity_date * 1000);
      const streakStartDate = new Date(streak.streak_start_date * 1000);
      
      const lastActivityStr = formatInTimeZone(lastActivityDate, timezone, 'yyyy-MM-dd');
      const streakStartStr = formatInTimeZone(streakStartDate, timezone, 'yyyy-MM-dd');
      
      // Handle nullable lastCheckedDate
      let lastCheckedStr: string | null = null;
      if (streak.last_checked_date !== null && streak.last_checked_date !== undefined) {
        const lastCheckedDate = new Date(streak.last_checked_date * 1000);
        lastCheckedStr = formatInTimeZone(lastCheckedDate, timezone, 'yyyy-MM-dd');
      }
      
      updateStmt.run(lastActivityStr, streakStartStr, lastCheckedStr, streak.id);
      converted++;
      
      logger.debug({
        id: streak.id,
        lastActivity: `${streak.last_activity_date} → ${lastActivityStr}`,
        streakStart: `${streak.streak_start_date} → ${streakStartStr}`,
        lastChecked: streak.last_checked_date ? `${streak.last_checked_date} → ${lastCheckedStr}` : 'null',
      }, "Converted streak dates");
    }
    
    logger.info({ converted }, "Conversion complete");
  }
};

export default migration;
