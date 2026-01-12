/**
 * Companion Migrations Framework
 * 
 * Provides infrastructure for running hand-written data transformations
 * after Drizzle schema migrations. Separates schema changes (DDL) from
 * semantic data transformations (DML).
 * 
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 * Pattern 11: .specify/memory/patterns.md
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";
import type { Database } from "better-sqlite3";

const logger = getLogger().child({ module: "companion-migrations" });

/**
 * Companion migration interface
 * 
 * Companions are hand-written data transformations that run after
 * schema migrations to convert existing data when semantic changes
 * are needed (e.g., INTEGER timestamps → TEXT date strings).
 */
export interface CompanionMigration {
  /** Unique name for tracking completion */
  name: string;
  
  /** Tables that must exist for this migration to run */
  requiredTables: string[];
  
  /** Optional description of what this migration does */
  description?: string;
  
  /** Transformation logic - receives database instance */
  execute: (db: Database) => Promise<void>;
}

/**
 * Discover companion migrations in lib/migrations/
 * Returns migrations sorted by number
 * 
 * @param baseDir - Optional base directory for testing (defaults to process.cwd())
 * @internal Exported for testing
 */
export function discoverCompanions(baseDir?: string): CompanionMigration[] {
  const migrationsDir = join(baseDir || process.cwd(), 'lib/migrations');
  
  // Check if directory exists
  if (!existsSync(migrationsDir)) {
    logger.debug({ dir: migrationsDir }, "Migrations directory does not exist");
    return [];
  }
  
  // Find all TypeScript/JavaScript files matching pattern {number}_*.ts
  const files = readdirSync(migrationsDir)
    .filter(f => {
      // Match pattern: 0015_something.ts or 0015_something.js
      return /^\d{4}_.*\.(ts|js)$/.test(f);
    })
    .filter(f => !f.startsWith('_')) // Exclude _template.ts
    .sort(); // Alphabetical = numeric order
  
  logger.debug({ count: files.length, files }, "Discovered companion files");
  
  // Load each companion module
  const companions: CompanionMigration[] = [];
  for (const file of files) {
    try {
      // Dynamic import (works with both .ts and .js)
      const modulePath = join(migrationsDir, file);
      const module = require(modulePath);
      
      // Support both default export and named export
      const companion = module.default || module.migration;
      
      if (!companion) {
        logger.warn({ file }, "Companion file has no default export");
        continue;
      }
      
      // Validate companion structure
      if (!companion.name || !companion.execute) {
        logger.warn({ file }, "Companion missing required fields (name, execute)");
        continue;
      }
      
      companions.push(companion);
    } catch (error) {
      logger.error({ file, error }, "Failed to load companion file");
      // Don't throw - skip invalid companions
    }
  }
  
  logger.info({ count: companions.length }, "Loaded companion migrations");
  return companions;
}

/**
 * Check if companion has already been run
 * 
 * @internal Exported for testing
 */
export function isCompleteMigration(db: Database, name: string): boolean {
  try {
    // Check if migration_metadata table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_metadata'"
    ).get();
    
    if (!tableExists) {
      // Table doesn't exist yet, migration not complete
      return false;
    }
    
    // Check if migration flag exists
    const result = db.prepare(
      "SELECT value FROM migration_metadata WHERE key = ?"
    ).get(name) as { value: string } | undefined;
    
    return result?.value === "true";
  } catch (error) {
    logger.error({ name, error }, "Error checking migration completion status");
    return false;
  }
}

/**
 * Mark companion migration as complete
 * 
 * @internal Exported for testing
 */
export function markComplete(db: Database, name: string): void {
  try {
    // Ensure migration_metadata table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS migration_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      )
    `);
    
    // Insert or update completion flag
    db.prepare(
      "INSERT OR REPLACE INTO migration_metadata (key, value) VALUES (?, ?)"
    ).run(name, "true");
    
    logger.debug({ name }, "Marked migration as complete");
  } catch (error) {
    logger.error({ name, error }, "Failed to mark migration as complete");
    throw error;
  }
}

/**
 * Check if required tables exist
 * 
 * @internal Exported for testing
 */
export function tablesExist(db: Database, tables: string[]): boolean {
  for (const table of tables) {
    try {
      const result = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);
      
      if (!result) {
        logger.debug({ table }, "Required table does not exist");
        return false;
      }
    } catch (error) {
      logger.error({ table, error }, "Error checking table existence");
      return false;
    }
  }
  return true;
}

/**
 * Run all companion migrations
 * 
 * Discovers companions in lib/migrations/, checks completion status,
 * verifies required tables exist, and executes transformations in
 * transactions.
 * 
 * @param db - Database instance (better-sqlite3 format)
 * @param baseDir - Optional base directory for testing (defaults to process.cwd())
 */
export async function runCompanionMigrations(db: Database, baseDir?: string): Promise<void> {
  logger.info("Running companion migrations...");
  
  // Discover companions
  const companions = discoverCompanions(baseDir);
  
  if (companions.length === 0) {
    logger.info("No companion migrations found");
    return;
  }
  
  logger.info({ count: companions.length }, "Found companion migrations");
  
  // Execute each companion
  for (const companion of companions) {
    const companionLog = logger.child({ 
      companion: companion.name,
      description: companion.description 
    });
    
    // Check if already complete
    if (isCompleteMigration(db, companion.name)) {
      companionLog.debug("Companion already complete, skipping");
      continue;
    }
    
    // Check if required tables exist (fresh database)
    if (!tablesExist(db, companion.requiredTables)) {
      companionLog.info({ 
        requiredTables: companion.requiredTables 
      }, "Required tables don't exist (fresh database), marking complete");
      
      markComplete(db, companion.name);
      continue;
    }
    
    // Execute transformation
    companionLog.info("Running companion migration...");
    
    try {
      // Start transaction
      db.exec("BEGIN TRANSACTION");
      
      // Execute companion logic
      await companion.execute(db);
      
      // Mark as complete
      markComplete(db, companion.name);
      
      // Commit transaction
      db.exec("COMMIT");
      
      companionLog.info("Companion migration complete");
    } catch (error) {
      // Rollback on error
      try {
        db.exec("ROLLBACK");
      } catch (rollbackError) {
        companionLog.error({ error: rollbackError }, "Failed to rollback transaction");
      }
      
      companionLog.error({ error }, "Companion migration failed");
      throw error;
    }
  }
  
  logger.info("All companion migrations complete");
}
