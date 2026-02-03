/**
 * Database Factory Module
 *
 * Centralizes SQLite database configuration using better-sqlite3.
 * Provides a consistent interface for creating database connections.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { existsSync } from 'fs';
import { getLogger } from "@/lib/logger";

export interface DatabaseConfig {
  /** Path to database file, or ":memory:" for in-memory database */
  path: string;
  /** Drizzle schema for type-safe queries (optional) */
  schema?: any;
  /** Enable WAL mode (default: true for file-based, false for in-memory)
   * - true: Force WAL mode
   * - false: Force DELETE mode
   * - 'auto': Auto-detect from existing WAL files (Calibre 9.x compatibility)
   */
  wal?: boolean | 'auto';
  /** Enable foreign keys (default: true) */
  foreignKeys?: boolean;
  /** Create database if it doesn't exist (default: true) */
  create?: boolean;
  /** Open database in read-only mode (default: false) */
  readonly?: boolean;
}

export interface DatabaseInstance<TSchema = any> {
  /** Drizzle ORM instance */
  db: any;
  /** Raw SQLite instance (better-sqlite3) */
  sqlite: Database.Database;
}

/**
 * Detect if a SQLite database is using WAL (Write-Ahead Logging) mode
 * 
 * WAL mode is indicated by the presence of -wal and -shm files alongside
 * the database file. This is used to detect Calibre 9.x's default journal mode.
 * 
 * @param dbPath - Path to SQLite database file
 * @returns true if -wal file exists, false otherwise
 * 
 * @example
 * if (isWalMode('/path/to/metadata.db')) {
 *   console.log('Database is using WAL mode');
 * }
 */
export function isWalMode(dbPath: string): boolean {
  // WAL mode creates a -wal file (Write-Ahead Log)
  // The -shm file (shared memory) is also created but -wal is the definitive indicator
  const walPath = `${dbPath}-wal`;
  return existsSync(walPath);
}

/**
 * Get recommended journal mode for a database based on existing files
 * 
 * If WAL files exist, returns 'wal' to match the existing mode and avoid
 * journal mode conflicts. Otherwise returns 'delete' as the default.
 * 
 * This is critical for Calibre 9.x compatibility, which uses WAL mode by default.
 * Attempting to change journal mode while another process has the DB open causes
 * SQLITE_BUSY errors.
 * 
 * @param dbPath - Path to SQLite database file
 * @returns 'wal' if WAL files exist, 'delete' otherwise
 * 
 * @example
 * const mode = detectJournalMode('/calibre/metadata.db');
 * // Returns 'wal' if Calibre 9.x is using WAL mode
 */
export function detectJournalMode(dbPath: string): 'wal' | 'delete' {
  return isWalMode(dbPath) ? 'wal' : 'delete';
}

/**
 * Create a SQLite database instance with better-sqlite3
 *
 * @param config - Database configuration
 * @returns Database instance with drizzle ORM and raw sqlite connection
 *
 * @example
 * // File-based database with schema
 * const { db, sqlite } = createDatabase({
 *   path: './data/tome.db',
 *   schema: mySchema
 * });
 *
 * @example
 * // In-memory database for testing
 * const { db, sqlite } = createDatabase({
 *   path: ':memory:',
 *   schema: mySchema,
 *   wal: false
 * });
 *
 * @example
 * // Calibre database (auto-detect journal mode)
 * const { db, sqlite } = createDatabase({
 *   path: '/calibre/metadata.db',
 *   readonly: false,
 *   wal: 'auto' // Detects WAL mode in Calibre 9.x
 * });
 */
export function createDatabase<TSchema = any>(
  config: DatabaseConfig
): DatabaseInstance<TSchema> {
  const {
    path,
    schema,
    wal = path !== ':memory:', // WAL mode for file-based, DELETE for in-memory
    foreignKeys = true,
    readonly = false,
  } = config;

  // Create database instance using better-sqlite3
  const options: Database.Options = {};
  if (readonly) {
    options.readonly = true;
  }
  
  const sqlite = new Database(path, options);

  // Configure PRAGMA settings (skip for readonly)
  if (!readonly) {
    if (foreignKeys) {
      sqlite.pragma('foreign_keys = ON');
    }
    
    // Handle WAL mode configuration
    if (wal === 'auto') {
      // Auto-detect journal mode from existing files but DON'T set pragma
      // This respects Calibre's existing mode without requiring a write lock
      // Critical: Setting journal_mode requires SQLITE_RESERVED lock, which fails
      // if another process (Calibre, Calibre-Web-Automated) has the DB open
      const detectedMode = detectJournalMode(path);
      getLogger().info(
        { path, detectedMode },
        `[DB Factory] Using existing journal mode: ${detectedMode.toUpperCase()} (auto-detected, not modified)`
      );
      // Skip pragma - use whatever mode the database already has
    } else {
      // Explicit mode requested - set pragma
      const useWal = wal as boolean;
      if (useWal) {
        sqlite.pragma('journal_mode = WAL');
      } else {
        sqlite.pragma('journal_mode = DELETE');
      }
    }
  }

  // Create drizzle instance
  const db = schema ? drizzle(sqlite, { schema }) : drizzle(sqlite);

  return { db, sqlite };
}

/**
 * Test database connection
 */
export function testDatabaseConnection(sqlite: Database.Database): boolean {
  try {
    const result = sqlite.prepare('SELECT 1 as test').get() as { test: number };
    return result.test === 1;
  } catch (error) {
    getLogger().error({ err: error }, 'Database connection test failed');
    return false;
  }
}

/**
 * Close database connection gracefully
 */
export function closeDatabaseConnection(sqlite: Database.Database): void {
  try {
    sqlite.close();
    getLogger().info('Database connection closed');
  } catch (error) {
    getLogger().error({ err: error }, 'Error closing database connection');
  }
}
