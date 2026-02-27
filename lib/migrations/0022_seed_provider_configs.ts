/**
 * Companion Migration: Seed Provider Configs & Migrate Book Sources
 * 
 * This migration performs two critical tasks:
 * 
 * 1. Seeds provider_configs with default configurations:
 *    - calibre: Existing Calibre library sync
 *    - hardcover: Hardcover.app API integration
 *    - openlibrary: OpenLibrary.org API integration
 *    
 * 2. Migrates book source data from books.source to book_sources table:
 *    - Books with source='calibre' and calibre_id → book_sources entry
 *    - Books with source='local' → NO book_sources entry (implicit local)
 * 
 * Note: 'local' provider is no longer needed (implicit via empty book_sources).
 * 
 * Runs only on existing databases (skipped on fresh installations).
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0022_seed_provider_configs" });

const migration: CompanionMigration = {
  name: "0022_seed_provider_configs",
  
  // Only run if provider_configs and book_sources tables exist
  requiredTables: ["provider_configs", "book_sources"],
  
  description: "Seed provider configs & migrate book sources to many-to-many table",
  
  async execute(db) {
    // ===== PART 1: Provider Config Seeding =====
    logger.info("Checking provider configurations...");
    
    // Check if providers already exist (idempotent)
    const existing = db.prepare(
      "SELECT COUNT(*) as count FROM provider_configs"
    ).get() as { count: number };
    
    if (existing.count > 0) {
      logger.info({ count: existing.count }, "Provider configs already exist, skipping seed");
      // NOTE: Continue to book_sources migration even if providers exist
    } else {
      logger.info("Seeding default provider configurations...");
      
      // Default provider configurations
      // Note: 'local' provider removed - implicit via empty book_sources
      const providers = [
        {
          provider: "calibre",
          display_name: "Calibre Library",
          enabled: 1,
          settings: JSON.stringify({}),
          credentials: JSON.stringify({}),
          priority: 1, // Highest priority
        },
        {
          provider: "hardcover",
          display_name: "Hardcover",
          enabled: 1,
          settings: JSON.stringify({
            baseUrl: "https://hardcover.app/api/v1",
            timeout: 5000,
          }),
          credentials: JSON.stringify({}),
          priority: 10,
        },
        {
          provider: "openlibrary",
          display_name: "Open Library",
          enabled: 1,
          settings: JSON.stringify({
            baseUrl: "https://openlibrary.org/api",
            timeout: 5000,
          }),
          credentials: JSON.stringify({}),
          priority: 20,
        },
      ];
      
      const insertStmt = db.prepare(`
        INSERT INTO provider_configs (
          provider, display_name, enabled, settings, credentials, priority
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const provider of providers) {
        insertStmt.run(
          provider.provider,
          provider.display_name,
          provider.enabled,
          provider.settings,
          provider.credentials,
          provider.priority
        );
        
        logger.info({ provider: provider.provider }, "Seeded provider config");
      }
      
      logger.info({ count: providers.length }, "Provider config seeding complete");
    }
    
    // ===== PART 2: Book Sources Data Migration =====
    logger.info("Migrating book source data to book_sources table...");
    
    // Check if book_sources already has data (idempotent)
    const existingSources = db.prepare(
      "SELECT COUNT(*) as count FROM book_sources"
    ).get() as { count: number };
    
    if (existingSources.count > 0) {
      logger.info({ count: existingSources.count }, "Book sources already populated, skipping migration");
      return;
    }
    
    // Populate book_sources from books with valid calibre_id
    // Note: We don't check for 'source' column because this migration CREATES
    // the book_sources table. We only need calibre_id to identify Calibre books.
    const migrateStmt = db.prepare(`
      INSERT INTO book_sources (
        book_id, 
        provider_id, 
        external_id, 
        is_primary, 
        last_synced, 
        sync_enabled,
        created_at, 
        updated_at
      )
      SELECT 
        id,
        'calibre',
        CAST(calibre_id AS TEXT),
        1,  -- is_primary = true
        last_synced,
        1,  -- sync_enabled = true
        created_at,
        updated_at
      FROM books
      WHERE calibre_id IS NOT NULL
    `);
    
    const result = migrateStmt.run();
    logger.info({ rowsInserted: result.changes }, "Calibre books migrated to book_sources");
    
    // Count books without calibre_id (local books get NO book_sources entry)
    const localCount = db.prepare(
      "SELECT COUNT(*) as count FROM books WHERE calibre_id IS NULL"
    ).get() as { count: number };
    
    logger.info(
      { 
        calibreBooks: result.changes, 
        localBooks: localCount.count 
      }, 
      "Book sources migration complete - local books have no book_sources entries (implicit)"
    );
  }
};

export default migration;
