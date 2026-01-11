/**
 * Companion Migration 0016: Session Dates Timezone Conversion
 * 
 * Converts reading_sessions.started_date and completed_date from INTEGER
 * (Unix timestamps) to TEXT (YYYY-MM-DD strings) using the user's configured
 * timezone. Handles NULL dates gracefully.
 * 
 * Related schema migration: drizzle/0016_outstanding_leader.sql
 * 
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { formatInTimeZone } from "date-fns-tz";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0016_session_dates_timezone" });

interface SessionRow {
  id: number;
  started_date: number | null;
  completed_date: number | null;
}

const migration: CompanionMigration = {
  name: "0016_session_dates_timezone",
  requiredTables: ["reading_sessions"],
  description: "Convert session dates from Unix timestamps to YYYY-MM-DD strings with timezone awareness",
  
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
    
    // Get all sessions with INTEGER timestamps (not already converted)
    // Check both started_date and completed_date for INTEGER types
    const sessions = db.prepare(`
      SELECT id, started_date, completed_date
      FROM reading_sessions
      WHERE 
        (started_date IS NOT NULL AND typeof(started_date) = 'integer')
        OR (completed_date IS NOT NULL AND typeof(completed_date) = 'integer')
    `).all() as SessionRow[];
    
    logger.info({ count: sessions.length }, "Found sessions to convert");
    
    if (sessions.length === 0) {
      logger.info("No INTEGER timestamps found, nothing to convert");
      return;
    }
    
    // Preview conversions (first 5)
    logger.info("Preview of conversions:");
    const previewCount = Math.min(5, sessions.length);
    for (let i = 0; i < previewCount; i++) {
      const session = sessions[i];
      
      const startedStr = session.started_date
        ? formatInTimeZone(new Date(session.started_date * 1000), timezone, "yyyy-MM-dd")
        : null;
      
      const completedStr = session.completed_date
        ? formatInTimeZone(new Date(session.completed_date * 1000), timezone, "yyyy-MM-dd")
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
      }, `Preview ${i + 1}/${previewCount}`);
    }
    
    // Convert timestamps to date strings
    const updateStmt = db.prepare(`
      UPDATE reading_sessions
      SET started_date = ?, completed_date = ?
      WHERE id = ?
    `);
    
    let converted = 0;
    for (const session of sessions) {
      try {
        // Convert started_date if it's an INTEGER
        const startedStr = session.started_date
          ? formatInTimeZone(new Date(session.started_date * 1000), timezone, "yyyy-MM-dd")
          : null;
        
        // Convert completed_date if it's an INTEGER
        const completedStr = session.completed_date
          ? formatInTimeZone(new Date(session.completed_date * 1000), timezone, "yyyy-MM-dd")
          : null;
        
        updateStmt.run(startedStr, completedStr, session.id);
        converted++;
        
        // Log progress every 100 records
        if (converted % 100 === 0) {
          logger.info({ converted, total: sessions.length }, "Progress");
        }
      } catch (error) {
        logger.error({ 
          sessionId: session.id, 
          startedDate: session.started_date, 
          completedDate: session.completed_date,
          error 
        }, "Failed to convert record");
        throw error; // Abort on any error (transaction will rollback)
      }
    }
    
    logger.info({ converted }, "Conversion complete");
  }
};

export default migration;
