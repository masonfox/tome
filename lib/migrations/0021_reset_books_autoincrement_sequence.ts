/**
 * Companion Migration: Reset Books AUTOINCREMENT Sequence
 * 
 * Fixes a bug where the books table AUTOINCREMENT sequence was leaking on every
 * sync update operation. The bug caused the sequence to advance even when updating
 * existing books (not just inserting new ones), resulting in massive ID gaps.
 * 
 * This migration resets the sqlite_sequence for the books table to match the
 * actual maximum ID currently in use. This prevents future book IDs from jumping
 * to unnecessarily high values.
 * 
 * Example:
 * - Before: 894 books with IDs 1-636,267 (gaps), sequence at 645,512
 * - After:  894 books with same IDs, sequence at 636,267 (no waste)
 * 
 * This is safe because:
 * 1. We're only resetting to MAX(id), which is guaranteed to be unused
 * 2. No books are renumbered (all foreign keys remain valid)
 * 3. Future books will continue from the highest existing ID + 1
 * 
 * Root cause fix: lib/repositories/book.repository.ts bulkUpsert() now excludes
 * 'id' from onConflictDoUpdate set to prevent sequence advancement on updates.
 * 
 * Related: Bug discovered in testing - sequence advanced on every other sync cycle
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0021_reset_books_autoincrement_sequence" });

const migration: CompanionMigration = {
  name: "0021_reset_books_autoincrement_sequence",
  
  requiredTables: ["books"],
  
  description: "Reset books AUTOINCREMENT sequence to fix ID leak bug",
  
  async execute(db) {
    logger.info("Checking books AUTOINCREMENT sequence...");
    
    // Get current state
    const sequenceRow = db.prepare(
      "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
    ).get() as { seq: number } | undefined;
    
    const statsRow = db.prepare(
      "SELECT COUNT(*) as count, MAX(id) as max_id FROM books"
    ).get() as { count: number; max_id: number | null };
    
    const currentSequence = sequenceRow?.seq || 0;
    const maxId = statsRow.max_id || 0;
    const bookCount = statsRow.count;
    
    logger.info({
      bookCount,
      maxId,
      currentSequence,
      wastedIds: currentSequence - maxId,
    }, "Current sequence state");
    
    // Check if reset is needed
    if (currentSequence <= maxId) {
      logger.info("Sequence is already correct, no reset needed");
      return;
    }
    
    // Safety check: ensure we have books before resetting
    if (bookCount === 0) {
      logger.info("No books in database, no reset needed");
      return;
    }
    
    // Reset sequence to max ID
    logger.info({ from: currentSequence, to: maxId }, "Resetting sequence...");
    
    db.prepare(
      "UPDATE sqlite_sequence SET seq = ? WHERE name = 'books'"
    ).run(maxId);
    
    // Verify the reset
    const newSequenceRow = db.prepare(
      "SELECT seq FROM sqlite_sequence WHERE name = 'books'"
    ).get() as { seq: number };
    
    const savedIds = currentSequence - newSequenceRow.seq;
    
    logger.info({
      oldSequence: currentSequence,
      newSequence: newSequenceRow.seq,
      savedIds,
    }, `Sequence reset complete - saved ${savedIds} IDs from being wasted`);
  }
};

export default migration;
