/**
 * Companion Migration 0019: Initialize Read-Next Order
 * 
 * Assigns sequential read_next_order values (0, 1, 2...) to existing
 * read-next status books, ordered by updated_at DESC (most recent first).
 * 
 * Related schema migration: drizzle/0019_kind_smiling_tiger.sql
 * 
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0019_initialize_read_next_order" });

interface SessionRow {
  id: number;
}

const migration: CompanionMigration = {
  name: "0019_initialize_read_next_order",
  requiredTables: ["reading_sessions"],
  description: "Initialize read_next_order for existing read-next status books",
  
  async execute(db) {
    logger.info("Starting read-next order initialization...");
    
    // Get all read-next sessions, ordered by updated_at DESC
    // (Most recently modified books get lower order numbers = higher priority)
    const readNextSessions = db.prepare(`
      SELECT id FROM reading_sessions 
      WHERE status = 'read-next' 
      ORDER BY updated_at DESC
    `).all() as SessionRow[];
    
    logger.info({ count: readNextSessions.length }, "Found read-next sessions to initialize");
    
    if (readNextSessions.length === 0) {
      logger.info("No read-next sessions found, nothing to initialize");
      return;
    }
    
    // Assign sequential order values (0, 1, 2...)
    const updateStmt = db.prepare(
      "UPDATE reading_sessions SET read_next_order = ? WHERE id = ?"
    );
    
    let initialized = 0;
    for (let i = 0; i < readNextSessions.length; i++) {
      const session = readNextSessions[i];
      
      try {
        updateStmt.run(i, session.id);
        initialized++;
        
        // Log progress every 50 records
        if (initialized % 50 === 0) {
          logger.info({ initialized, total: readNextSessions.length }, "Progress");
        }
      } catch (error) {
        logger.error({ sessionId: session.id, order: i, error }, "Failed to initialize record");
        throw error; // Abort on error (transaction will rollback)
      }
    }
    
    logger.info({ initialized }, "Initialization complete");
    
    // Verify: Check that all read-next sessions now have sequential order
    const verification = db.prepare(`
      SELECT MIN(read_next_order) as min_order, MAX(read_next_order) as max_order, COUNT(*) as count
      FROM reading_sessions
      WHERE status = 'read-next'
    `).get() as { min_order: number; max_order: number; count: number };
    
    logger.info({ 
      minOrder: verification.min_order,
      maxOrder: verification.max_order,
      count: verification.count,
      expectedMax: verification.count - 1
    }, "Verification check");
    
    if (verification.max_order !== verification.count - 1) {
      logger.warn("Order values may not be sequential!");
    }
  }
};

export default migration;
